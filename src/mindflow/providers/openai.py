"""OpenAI LLM provider implementation."""

from typing import Any, AsyncIterator, Optional

from openai import AsyncOpenAI

from mindflow.providers.base import (
    CredentialSpec,
    LLMProvider,
    ModelInfo,
    ProviderResponse,
    ProviderStatus,
)


class OpenAIProvider(LLMProvider):
    """Provider for OpenAI API.

    Requires explicit api_key injection — no env-var fallback.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        if not api_key:
            raise ValueError(
                "OpenAI api_key is required. "
                "Pass it explicitly — no environment variable fallback."
            )
        super().__init__()
        self._api_key = api_key
        self._base_url = base_url
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    # ── Connection lifecycle ─────────────────────────────────────

    async def connect(self) -> None:
        """Verify credentials by listing models."""
        self._status = ProviderStatus.CONNECTING
        try:
            await self.client.models.list()
            self._status = ProviderStatus.CONNECTED
        except Exception as exc:
            self._status = ProviderStatus.ERROR
            self._error = str(exc)
            raise ConnectionError(f"OpenAI connection failed: {exc}") from exc

    async def disconnect(self) -> None:
        await self.client.close()
        await super().disconnect()

    # ── Generation ───────────────────────────────────────────────

    async def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> ProviderResponse:
        """Generate complete response using OpenAI."""
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=kwargs.get("temperature", 0.7),
            max_tokens=kwargs.get("max_tokens"),
        )

        choice = response.choices[0]
        usage = None
        if response.usage:
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }

        return ProviderResponse(
            content=choice.message.content or "",
            model=response.model,
            usage=usage,
        )

    async def stream(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Stream response using OpenAI."""
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        stream = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=kwargs.get("temperature", 0.7),
            max_tokens=kwargs.get("max_tokens"),
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    # ── Model discovery ──────────────────────────────────────────

    async def list_models(self) -> list[ModelInfo]:
        """List available OpenAI models."""
        response = await self.client.models.list()
        return [
            ModelInfo(id=m.id, name=m.id)
            for m in response.data
        ]

    # ── Credential specification ─────────────────────────────────

    @classmethod
    def required_credentials(cls) -> list[CredentialSpec]:
        return [
            CredentialSpec(
                key="api_key",
                label="OpenAI API Key",
                type="api_key",
                required=True,
            ),
        ]
