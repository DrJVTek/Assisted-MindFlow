"""Unit tests for OpenAIChatGPTProvider."""

from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mindflow.models.oauth_session import OAuthSession
from mindflow.providers.openai_chatgpt import OpenAIChatGPTProvider
from mindflow.services.oauth_service import OAuthService
from mindflow.services.token_storage import TokenStorage


@pytest.fixture
def valid_session() -> OAuthSession:
    return OAuthSession(
        access_token="test_token_123",
        refresh_token="test_refresh_456",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        subscription_tier="plus",
        user_email="test@example.com",
    )


@pytest.fixture
def expired_session() -> OAuthSession:
    return OAuthSession(
        access_token="expired_token",
        refresh_token="test_refresh_456",
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )


@pytest.fixture
def mock_storage(tmp_path: Path, valid_session: OAuthSession) -> TokenStorage:
    storage = TokenStorage(
        session_path=tmp_path / "session.enc",
        salt_path=tmp_path / ".salt",
    )
    storage.save_session(valid_session)
    return storage


class TestProviderInitialization:
    """Test provider initialization with token."""

    def test_creates_with_default_storage(self):
        provider = OpenAIChatGPTProvider()
        assert provider._storage is not None
        assert provider._oauth_service is not None

    def test_creates_with_custom_storage(self, mock_storage: TokenStorage):
        provider = OpenAIChatGPTProvider(token_storage=mock_storage)
        assert provider._storage is mock_storage


class TestTokenExpiryCheck:
    """Test token expiry check before API calls."""

    @pytest.mark.asyncio
    async def test_raises_when_no_session(self, tmp_path: Path):
        storage = TokenStorage(
            session_path=tmp_path / "empty.enc",
            salt_path=tmp_path / ".salt",
        )
        provider = OpenAIChatGPTProvider(token_storage=storage)

        with pytest.raises(RuntimeError, match="No valid ChatGPT OAuth session"):
            await provider._get_client()

    @pytest.mark.asyncio
    async def test_gets_client_with_valid_token(self, mock_storage: TokenStorage):
        provider = OpenAIChatGPTProvider(token_storage=mock_storage)
        client = await provider._get_client()
        assert client is not None


class TestGenerateStream:
    """Test generate/stream delegation with mocked AsyncOpenAI."""

    @pytest.mark.asyncio
    async def test_generate_calls_openai(self, mock_storage: TokenStorage):
        provider = OpenAIChatGPTProvider(token_storage=mock_storage)

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Test response"

        with patch("mindflow.providers.openai_chatgpt.AsyncOpenAI") as MockClient:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            MockClient.return_value = mock_client

            result = await provider.generate(
                prompt="Hello",
                model="gpt-4o",
                system_prompt="You are helpful",
            )

            assert result == "Test response"
            mock_client.chat.completions.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_stream_yields_tokens(self, mock_storage: TokenStorage):
        provider = OpenAIChatGPTProvider(token_storage=mock_storage)

        # Create mock chunks
        chunk1 = MagicMock()
        chunk1.choices = [MagicMock()]
        chunk1.choices[0].delta.content = "Hello"

        chunk2 = MagicMock()
        chunk2.choices = [MagicMock()]
        chunk2.choices[0].delta.content = " world"

        async def mock_stream():
            for chunk in [chunk1, chunk2]:
                yield chunk

        with patch("mindflow.providers.openai_chatgpt.AsyncOpenAI") as MockClient:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_stream())
            MockClient.return_value = mock_client

            tokens = []
            async for token in provider.stream(prompt="Hello", model="gpt-4o"):
                tokens.append(token)

            assert tokens == ["Hello", " world"]
