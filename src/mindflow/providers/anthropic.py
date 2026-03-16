"""Anthropic LLM provider implementation."""

from typing import Any, AsyncIterator, Optional

from anthropic import AsyncAnthropic

from mindflow.providers.base import (
    CredentialSpec,
    LLMProvider,
    ModelInfo,
    ProviderResponse,
    ProviderStatus,
)


class AnthropicProvider(LLMProvider):
    """Provider for Anthropic API (Claude).

    Requires explicit api_key injection — no env-var fallback.
    """

    def __init__(self, api_key: Optional[str] = None):
        if not api_key:
            raise ValueError(
                "Anthropic api_key is required. "
                "Pass it explicitly — no environment variable fallback."
            )
        super().__init__()
        self._api_key = api_key
        self.client = AsyncAnthropic(api_key=api_key)

    # ── Connection lifecycle ─────────────────────────────────────

    async def connect(self) -> None:
        """Verify credentials by sending a minimal request."""
        self._status = ProviderStatus.CONNECTING
        try:
            # Anthropic has no dedicated "list models" endpoint;
            # a minimal message verifies the key is valid.
            await self.client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
            )
            self._status = ProviderStatus.CONNECTED
        except Exception as exc:
            self._status = ProviderStatus.ERROR
            self._error = str(exc)
            raise ConnectionError(f"Anthropic connection failed: {exc}") from exc

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
        """Generate complete response using Anthropic."""
        response = await self.client.messages.create(
            model=model,
            max_tokens=kwargs.get("max_tokens", 1024),
            temperature=kwargs.get("temperature", 0.7),
            system=system_prompt or "",
            messages=[{"role": "user", "content": prompt}],
        )

        usage = None
        if response.usage:
            usage = {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
            }

        return ProviderResponse(
            content=response.content[0].text,
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
        """Stream response using Anthropic."""
        async with self.client.messages.stream(
            model=model,
            max_tokens=kwargs.get("max_tokens", 1024),
            temperature=kwargs.get("temperature", 0.7),
            system=system_prompt or "",
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield text

    # ── Model discovery ──────────────────────────────────────────

    async def list_models(self) -> list[ModelInfo]:
        """List known Anthropic models.

        Anthropic does not expose a list-models API endpoint,
        so we return the well-known model family.
        """
        return [
            ModelInfo(id="claude-opus-4-20250514", name="Claude Opus 4", context_length=200000, capabilities=["chat", "vision"]),
            ModelInfo(id="claude-sonnet-4-20250514", name="Claude Sonnet 4", context_length=200000, capabilities=["chat", "vision"]),
            ModelInfo(id="claude-haiku-4-5-20251001", name="Claude Haiku 4.5", context_length=200000, capabilities=["chat", "vision"]),
        ]

    # ── Credential specification ─────────────────────────────────

    @classmethod
    def required_credentials(cls) -> list[CredentialSpec]:
        return [
            CredentialSpec(
                key="api_key",
                label="Anthropic API Key",
                type="api_key",
                required=True,
            ),
        ]
