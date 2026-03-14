"""OpenAI ChatGPT OAuth-authenticated provider.

Uses OAuth Bearer token (from ChatGPT subscription) to call the ChatGPT
backend API (chatgpt.com/backend-api/codex/responses) — the same endpoint
used by OpenAI's Codex CLI.

This is NOT the same as the OpenAI Platform API (api.openai.com).
"""

import base64
import json
import logging
from typing import AsyncIterator, Dict, Any, Optional

import httpx

from mindflow.providers.base import LLMProvider
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

# Default model for new users
DEFAULT_MODEL = "gpt-5.1-codex"


def _decode_jwt_payload(token: str) -> dict:
    """Decode a JWT token payload without verification (we only need claims)."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        # Add padding if needed
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
    """

    def __init__(
        self,
        oauth_service: Optional[OAuthService] = None,
        token_storage: Optional[TokenStorage] = None,
    ):
        self._storage = token_storage or TokenStorage()
        self._oauth_service = oauth_service or OAuthService(self._storage)

    async def _get_auth(self) -> tuple[str, str]:
        """Get valid token and account ID.

        Returns:
            Tuple of (access_token, chatgpt_account_id)
        """
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
        metadata: Optional[Dict[str, Any]] = None,
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

        # ChatGPT backend REQUIRES stream=true always (confirmed via testing).
        # For non-streaming calls, we collect the full SSE response.
        body = {
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

        return body

    def _extract_text_from_response(self, data: dict) -> str:
        """Extract text content from a Responses API response."""
        output = data.get("output", [])
        texts = []
        for item in output:
            if item.get("type") == "message" and item.get("role") == "assistant":
                for content in item.get("content", []):
                    if content.get("type") == "output_text":
                        texts.append(content.get("text", ""))
        return "".join(texts)

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
            except json.JSONDecodeError:
                continue
            if event.get("type") == "response.output_text.delta":
                delta = event.get("delta", "")
                if delta:
                    texts.append(delta)
        return "".join(texts)

    def _check_error_status(self, status_code: int) -> None:
        """Raise user-friendly errors for known HTTP status codes."""
        if status_code == 429 or status_code == 404:
            raise RuntimeError(
                "Rate limit reached. Your ChatGPT subscription has a usage cap. "
                "Please wait a moment and try again."
            )
        if status_code == 403:
            raise RuntimeError(
                "This model is not available with your current subscription tier. "
                "Try selecting a different model in Settings."
            )

    async def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None,
    ) -> str:
        """Generate complete response using ChatGPT backend Responses API.

        Always uses SSE streaming (backend requires it), then collects the full text.
        """
        token, account_id = await self._get_auth()
        headers = self._build_headers(token, account_id)
        body = self._build_request_body(prompt, model, system_prompt, metadata)

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST", CHATGPT_BACKEND_URL, headers=headers, json=body,
                ) as response:
                    if response.status_code == 401:
                        return await self._handle_401_generate(
                            prompt, model, system_prompt, metadata
                        )
                    self._check_error_status(response.status_code)
                    response.raise_for_status()
                    return await self._collect_sse_text(response)

        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"ChatGPT API error: {exc.response.status_code}"
            ) from exc

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

    async def _handle_401_generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str],
        metadata: Optional[Dict[str, Any]],
    ) -> str:
        """Retry generate after 401 with refreshed token."""
        token, account_id = await self._refresh_auth()
        headers = self._build_headers(token, account_id)
        body = self._build_request_body(prompt, model, system_prompt, metadata)

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", CHATGPT_BACKEND_URL, headers=headers, json=body,
            ) as response:
                response.raise_for_status()
                return await self._collect_sse_text(response)

    async def stream(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None,
    ) -> AsyncIterator[str]:
        """Stream response using ChatGPT backend Responses API (SSE)."""
        token, account_id = await self._get_auth()
        headers = self._build_headers(token, account_id)
        body = self._build_request_body(prompt, model, system_prompt, metadata)

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                CHATGPT_BACKEND_URL,
                headers=headers,
                json=body,
            ) as response:
                if response.status_code == 401:
                    # Can't easily retry streaming; raise error
                    raise RuntimeError(
                        "Session expired. Please sign in again via Settings."
                    )

                if response.status_code == 429 or response.status_code == 404:
                    raise RuntimeError(
                        "Rate limit reached. Your ChatGPT subscription has a usage cap. "
                        "Please wait a moment and try again."
                    )

                if response.status_code == 403:
                    raise RuntimeError(
                        "This model is not available with your current subscription tier. "
                        "Try selecting a different model in Settings."
                    )

                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue

                    data_str = line[6:]  # Strip "data: " prefix
                    if data_str == "[DONE]":
                        break

                    try:
                        event = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    # Extract text deltas from SSE events
                    event_type = event.get("type", "")

                    if event_type == "response.output_text.delta":
                        delta = event.get("delta", "")
                        if delta:
                            yield delta
