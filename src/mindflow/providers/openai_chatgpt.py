"""OpenAI ChatGPT OAuth-authenticated provider.

Uses OAuth Bearer token (from ChatGPT subscription) instead of API key.
Token refresh is handled transparently before each API call.
"""

import logging
from typing import AsyncIterator, Dict, Any, Optional

from openai import AsyncOpenAI, APIStatusError

from mindflow.providers.base import LLMProvider
from mindflow.services.oauth_service import OAuthService
from mindflow.services.token_storage import TokenStorage

logger = logging.getLogger(__name__)


class OpenAIChatGPTProvider(LLMProvider):
    """Provider for OpenAI via ChatGPT OAuth subscription."""

    def __init__(
        self,
        oauth_service: Optional[OAuthService] = None,
        token_storage: Optional[TokenStorage] = None,
    ):
        self._storage = token_storage or TokenStorage()
        self._oauth_service = oauth_service or OAuthService(self._storage)

    async def _get_client(self) -> AsyncOpenAI:
        """Get an AsyncOpenAI client with a valid OAuth token."""
        token = await self._oauth_service.get_valid_token()
        if not token:
            raise RuntimeError(
                "No valid ChatGPT OAuth session. Please sign in via Settings."
            )
        return AsyncOpenAI(api_key=token)

    async def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None,
    ) -> str:
        """Generate complete response using ChatGPT OAuth token."""
        client = await self._get_client()

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=metadata.get("temperature", 0.7) if metadata else 0.7,
            )
            return response.choices[0].message.content or ""
        except APIStatusError as exc:
            return await self._handle_api_error(exc, client, model, messages, metadata)

    async def _handle_api_error(
        self,
        exc: APIStatusError,
        client: AsyncOpenAI,
        model: str,
        messages: list,
        metadata: Optional[Dict[str, Any]],
    ) -> str:
        """Handle OpenAI API errors with user-friendly messages."""
        status = exc.status_code

        if status == 401:
            logger.info("Got 401, attempting token refresh")
            refreshed = await self._oauth_service.refresh_token()
            if refreshed:
                client = AsyncOpenAI(api_key=refreshed.access_token)
                response = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=metadata.get("temperature", 0.7) if metadata else 0.7,
                )
                return response.choices[0].message.content or ""
            raise RuntimeError(
                "Session expired and refresh failed. Please sign in again via Settings."
            ) from exc

        if status == 429:
            raise RuntimeError(
                "Rate limit reached. Your ChatGPT subscription has a usage cap. "
                "Please wait a moment and try again."
            ) from exc

        if status == 403:
            raise RuntimeError(
                "This model is not available with your current subscription tier. "
                "Try selecting a different model in Settings."
            ) from exc

        raise

    async def stream(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None,
    ) -> AsyncIterator[str]:
        """Stream response using ChatGPT OAuth token."""
        client = await self._get_client()

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=metadata.get("temperature", 0.7) if metadata else 0.7,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
