"""Unit tests for OpenAIChatGPTProvider.

The provider authenticates via a ChatGPT OAuth subscription and calls the
ChatGPT backend Responses API (SSE), NOT the OpenAI Platform Chat Completions
API. It enforces a NO-FALLBACK contract: it requires an explicit ``oauth_service``
OR ``token_storage`` to be injected — there is no silent default-storage fallback.
"""

import base64
import json
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock

import httpx
import pytest

from mindflow.models.oauth_session import OAuthSession
from mindflow.providers.base import ProviderResponse
from mindflow.providers.openai_chatgpt import (
    CHATGPT_BACKEND_URL,
    OpenAIChatGPTProvider,
)
from mindflow.services.auth.oauth_service import OAuthService


def _make_jwt_with_account(account_id: str) -> str:
    """Build a (signature-less) JWT whose payload carries a chatgpt_account_id.

    ``_extract_account_id`` only base64url-decodes the payload segment and reads
    the ``https://api.openai.com/auth`` claim — it never verifies the signature.
    """

    def b64url(obj: dict) -> str:
        raw = json.dumps(obj).encode("utf-8")
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")

    header = b64url({"alg": "none", "typ": "JWT"})
    payload = b64url(
        {"https://api.openai.com/auth": {"chatgpt_account_id": account_id}}
    )
    return f"{header}.{payload}.sig"


# A token that yields a real account id through _extract_account_id.
VALID_TOKEN = _make_jwt_with_account("acct_test_123")


@pytest.fixture
def valid_session() -> OAuthSession:
    return OAuthSession(
        access_token=VALID_TOKEN,
        refresh_token="test_refresh_456",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        subscription_tier="plus",
        user_email="test@example.com",
    )


@pytest.fixture
def mock_oauth_service() -> AsyncMock:
    """An OAuthService double that returns a valid token."""
    service = AsyncMock(spec=OAuthService)
    service.get_valid_token = AsyncMock(return_value=VALID_TOKEN)
    return service


class TestProviderInitialization:
    """Test provider initialization and the NO-FALLBACK injection contract."""

    def test_requires_explicit_oauth_service_or_storage(self):
        # NO-FALLBACK: constructing without either dependency must raise.
        with pytest.raises(ValueError, match="requires either oauth_service or token_storage"):
            OpenAIChatGPTProvider()

    def test_creates_with_injected_oauth_service(self, mock_oauth_service: AsyncMock):
        provider = OpenAIChatGPTProvider(oauth_service=mock_oauth_service)
        assert provider._oauth_service is mock_oauth_service


class TestAuth:
    """Test the auth resolution that gates every API call."""

    @pytest.mark.asyncio
    async def test_raises_when_no_session(self):
        # No valid token available → provider refuses to proceed (no fallback).
        service = AsyncMock(spec=OAuthService)
        service.get_valid_token = AsyncMock(return_value=None)
        provider = OpenAIChatGPTProvider(oauth_service=service)

        with pytest.raises(RuntimeError, match="No valid ChatGPT OAuth session"):
            await provider._get_auth()

    @pytest.mark.asyncio
    async def test_get_auth_with_valid_token(self, mock_oauth_service: AsyncMock):
        provider = OpenAIChatGPTProvider(oauth_service=mock_oauth_service)
        token, account_id = await provider._get_auth()
        assert token == VALID_TOKEN
        assert account_id == "acct_test_123"

    @pytest.mark.asyncio
    async def test_connect_succeeds_with_valid_session(self, mock_oauth_service: AsyncMock):
        from mindflow.providers.base import ProviderStatus

        provider = OpenAIChatGPTProvider(oauth_service=mock_oauth_service)
        await provider.connect()
        assert provider.get_status() == ProviderStatus.CONNECTED


def _sse_response(*deltas: str) -> bytes:
    """Build a ChatGPT-backend SSE body emitting output_text deltas."""
    lines = []
    for delta in deltas:
        event = {"type": "response.output_text.delta", "delta": delta}
        lines.append(f"data: {json.dumps(event)}")
    lines.append("data: [DONE]")
    return ("\n".join(lines) + "\n").encode("utf-8")


class TestGenerateStream:
    """Test generate/stream against the ChatGPT backend Responses API (SSE)."""

    @pytest.mark.asyncio
    async def test_generate_collects_sse_text(
        self, mock_oauth_service: AsyncMock, monkeypatch: pytest.MonkeyPatch
    ):
        provider = OpenAIChatGPTProvider(oauth_service=mock_oauth_service)

        captured: dict = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["url"] = str(request.url)
            captured["auth"] = request.headers.get("Authorization")
            return httpx.Response(200, content=_sse_response("Test ", "response"))

        transport = httpx.MockTransport(handler)
        _patch_async_client(monkeypatch, transport)

        result = await provider.generate(
            prompt="Hello",
            model="gpt-5.1-codex",
            system_prompt="You are helpful",
        )

        assert isinstance(result, ProviderResponse)
        assert result.content == "Test response"
        assert result.model == "gpt-5.1-codex"
        # Verifies it hit the ChatGPT backend with the Bearer token.
        assert captured["url"] == CHATGPT_BACKEND_URL
        assert captured["auth"] == f"Bearer {VALID_TOKEN}"

    @pytest.mark.asyncio
    async def test_stream_yields_tokens(
        self, mock_oauth_service: AsyncMock, monkeypatch: pytest.MonkeyPatch
    ):
        provider = OpenAIChatGPTProvider(oauth_service=mock_oauth_service)

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=_sse_response("Hello", " world"))

        transport = httpx.MockTransport(handler)
        _patch_async_client(monkeypatch, transport)

        tokens = []
        async for token in provider.stream(prompt="Hello", model="gpt-5.1-codex"):
            tokens.append(token)

        assert tokens == ["Hello", " world"]


def _patch_async_client(monkeypatch: pytest.MonkeyPatch, transport: httpx.MockTransport) -> None:
    """Force httpx.AsyncClient instances in the provider to use the mock transport."""
    real_init = httpx.AsyncClient.__init__

    def patched_init(self, *args, **kwargs):
        kwargs["transport"] = transport
        real_init(self, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "__init__", patched_init)
