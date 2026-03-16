"""OpenAI ChatGPT OAuth-authenticated provider.

Uses OAuth Bearer token (from ChatGPT subscription) to call the ChatGPT
backend API (chatgpt.com/backend-api/codex/responses) — the same endpoint
used by OpenAI's Codex CLI.

This is NOT the same as the OpenAI Platform API (api.openai.com).
"""

import base64
import json
import logging
from typing import Any, AsyncIterator, Optional

import httpx

from mindflow.providers.base import (
    CredentialSpec,
    LLMProvider,
    ModelInfo,
    ProviderResponse,
    ProviderStatus,
)
from mindflow.services.oauth_service import OAuthService
from mindflow.services.token_storage import TokenStorage

logger = logging.getLogger(__name__)

CHATGPT_BACKEND_URL = "https://chatgpt.com/backend-api/codex/responses"

# Known ChatGPT/Codex models (subscription-based)
CHATGPT_MODELS = [
    "gpt-5.2-codex",
    "gpt-5.1-codex-max",
    "gpt-5.1-codex",
    "gpt-5.1-codex-mini",
    "gpt-5.1",
    "gpt-5.2",
    "codex-mini-latest",
]

DEFAULT_MODEL = "gpt-5.1-codex"


def _decode_jwt_payload(token: str) -> dict:
    """Decode a JWT token payload without verification (we only need claims)."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        payload_b64 = parts[1]
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        return json.loads(payload_bytes)
    except Exception:
        return {}


def _extract_account_id(token: str) -> Optional[str]:
    """Extract chatgpt_account_id from JWT token."""
    payload = _decode_jwt_payload(token)
    auth_claim = payload.get("https://api.openai.com/auth", {})
    return auth_claim.get("chatgpt_account_id")


class OpenAIChatGPTProvider(LLMProvider):
    """Provider for OpenAI via ChatGPT OAuth subscription.

    Uses the ChatGPT backend Responses API (same as Codex CLI),
    NOT the OpenAI Platform Chat Completions API.

    Requires explicit oauth_service and token_storage injection.
    """

    def __init__(
        self,
        oauth_service: Optional[OAuthService] = None,
        token_storage: Optional[TokenStorage] = None,
    ):
        if not oauth_service and not token_storage:
            raise ValueError(
                "ChatGPT provider requires either oauth_service or token_storage. "
                "Pass them explicitly — no default fallback."
            )
        super().__init__()
        self._storage = token_storage or TokenStorage()
        self._oauth_service = oauth_service or OAuthService(self._storage)

    # ── Connection lifecycle ─────────────────────────────────────

    async def connect(self) -> None:
        """Verify OAuth session is valid."""
        self._status = ProviderStatus.CONNECTING
        try:
            token = await self._oauth_service.get_valid_token()
            if not token:
                raise ConnectionError(
                    "No valid ChatGPT OAuth session. Please sign in via Settings."
                )
            account_id = _extract_account_id(token)
            if not account_id:
                raise ConnectionError(
                    "Could not extract ChatGPT account ID from token. "
                    "Please sign out and sign in again."
                )
            self._status = ProviderStatus.CONNECTED
        except ConnectionError:
            self._status = ProviderStatus.ERROR
            raise
        except Exception as exc:
            self._status = ProviderStatus.ERROR
            self._error = str(exc)
            raise ConnectionError(f"ChatGPT connection failed: {exc}") from exc

    # ── Internal helpers ─────────────────────────────────────────

    async def _get_auth(self) -> tuple[str, str]:
        """Get valid token and account ID."""
        token = await self._oauth_service.get_valid_token()
        if not token:
            raise RuntimeError(
                "No valid ChatGPT OAuth session. Please sign in via Settings."
            )
        account_id = _extract_account_id(token)
        if not account_id:
            raise RuntimeError(
                "Could not extract ChatGPT account ID from token. "
                "Please sign out and sign in again."
            )
        return token, account_id

    def _build_headers(self, token: str, account_id: str) -> dict:
        """Build headers matching Codex CLI format."""
        return {
            "Authorization": f"Bearer {token}",
            "chatgpt-account-id": account_id,
            "OpenAI-Beta": "responses=experimental",
            "originator": "codex_cli_rs",
            "Content-Type": "application/json",
            "accept": "text/event-stream",
        }

    def _build_request_body(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> dict:
        """Build Responses API request body."""
        input_items = []

        if system_prompt:
            input_items.append({
                "type": "message",
                "role": "developer",
                "content": [{"type": "input_text", "text": system_prompt}],
            })

        input_items.append({
            "type": "message",
            "role": "user",
            "content": [{"type": "input_text", "text": prompt}],
        })

        instructions = system_prompt or "You are a helpful assistant."

        return {
            "model": model,
            "instructions": instructions,
            "input": input_items,
            "store": False,
            "stream": True,
            "reasoning": {
                "effort": "medium",
                "summary": "auto",
            },
            "text": {
                "verbosity": "medium",
            },
            "include": ["reasoning.encrypted_content"],
        }

    def _check_error_status(self, status_code: int) -> None:
        """Raise user-friendly errors for known HTTP status codes."""
        if status_code == 401:
            raise RuntimeError(
                "Session expired. Please sign in again via Settings."
            )
        if status_code in (429, 404):
            self._status = ProviderStatus.RATE_LIMITED
            raise RuntimeError(
                "Rate limit reached. Your ChatGPT subscription has a usage cap. "
                "Please wait a moment and try again."
            )
        if status_code == 403:
            raise RuntimeError(
                "This model is not available with your current subscription tier. "
                "Try selecting a different model in Settings."
            )

    async def _collect_sse_text(self, response: httpx.Response) -> str:
        """Collect all text deltas from an SSE stream into a single string."""
        texts = []
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue
            data_str = line[6:]
            if data_str == "[DONE]":
                break
            try:
                event = json.loads(data_str)
            except json.JSONDecodeError as exc:
                raise RuntimeError(
                    f"ChatGPT returned invalid SSE JSON: {data_str!r}"
                ) from exc
            if event.get("type") == "response.output_text.delta":
                delta = event.get("delta", "")
                if delta:
                    texts.append(delta)
        return "".join(texts)

    async def _refresh_auth(self) -> tuple[str, str]:
        """Refresh token and return new (token, account_id)."""
        logger.info("Got 401 from ChatGPT backend, attempting token refresh")
        refreshed = await self._oauth_service.refresh_token()
        if not refreshed:
            raise RuntimeError(
                "Session expired and refresh failed. Please sign in again via Settings."
            )
        token = refreshed.access_token
        account_id = _extract_account_id(token)
        if not account_id:
            raise RuntimeError("Could not extract account ID after token refresh.")
        return token, account_id

    # ── Generation ───────────────────────────────────────────────

    async def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> ProviderResponse:
        """Generate complete response using ChatGPT backend Responses API.

        Always uses SSE streaming (backend requires it), then collects the full text.
        """
        token, account_id = await self._get_auth()
        headers = self._build_headers(token, account_id)
        body = self._build_request_body(prompt, model, system_prompt, **kwargs)

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST", CHATGPT_BACKEND_URL, headers=headers, json=body,
                ) as response:
                    if response.status_code == 401:
                        # One retry after token refresh
                        token, account_id = await self._refresh_auth()
                        headers = self._build_headers(token, account_id)

                async with client.stream(
                    "POST", CHATGPT_BACKEND_URL, headers=headers, json=body,
                ) as response:
                    self._check_error_status(response.status_code)
                    response.raise_for_status()
                    content = await self._collect_sse_text(response)

        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"ChatGPT API error: {exc.response.status_code}"
            ) from exc

        return ProviderResponse(
            content=content,
            model=model,
        )

    async def stream(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Stream response using ChatGPT backend Responses API (SSE)."""
        token, account_id = await self._get_auth()
        headers = self._build_headers(token, account_id)
        body = self._build_request_body(prompt, model, system_prompt, **kwargs)

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", CHATGPT_BACKEND_URL, headers=headers, json=body,
            ) as response:
                self._check_error_status(response.status_code)
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        event = json.loads(data_str)
                    except json.JSONDecodeError as exc:
                        raise RuntimeError(
                            f"ChatGPT returned invalid SSE JSON: {data_str!r}"
                        ) from exc
                    if event.get("type") == "response.output_text.delta":
                        delta = event.get("delta", "")
                        if delta:
                            yield delta

    # ── Model discovery ──────────────────────────────────────────

    async def list_models(self) -> list[ModelInfo]:
        """List known ChatGPT/Codex models."""
        return [
            ModelInfo(id=model_id, name=model_id)
            for model_id in CHATGPT_MODELS
        ]

    # ── Credential specification ─────────────────────────────────

    @classmethod
    def required_credentials(cls) -> list[CredentialSpec]:
        return [
            CredentialSpec(
                key="oauth_token",
                label="ChatGPT OAuth Session",
                type="oauth",
                required=True,
            ),
        ]
