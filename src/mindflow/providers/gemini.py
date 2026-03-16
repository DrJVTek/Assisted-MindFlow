"""Google Gemini LLM provider implementation."""

from typing import Any, AsyncIterator, Optional

from mindflow.providers.base import (
    CredentialSpec,
    LLMProvider,
    ModelInfo,
    ProviderResponse,
    ProviderStatus,
)


class GeminiProvider(LLMProvider):
    """Provider for Google Gemini API.

    Uses per-instance genai.Client — no global genai.configure().
    Requires explicit api_key injection — no env-var fallback.
    """

    def __init__(self, api_key: Optional[str] = None):
        if not api_key:
            raise ValueError(
                "Gemini api_key is required. "
                "Pass it explicitly — no environment variable fallback."
            )
        super().__init__()
        self._api_key = api_key

        # Per-instance client — no global state pollution
        from google import genai as google_genai
        self._client = google_genai.Client(api_key=api_key)

    # ── Connection lifecycle ─────────────────────────────────────

    async def connect(self) -> None:
        """Verify credentials by listing models."""
        self._status = ProviderStatus.CONNECTING
        try:
            self._client.models.list()
            self._status = ProviderStatus.CONNECTED
        except Exception as exc:
            self._status = ProviderStatus.ERROR
            self._error = str(exc)
            raise ConnectionError(f"Gemini connection failed: {exc}") from exc

    # ── Generation ───────────────────────────────────────────────

    async def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> ProviderResponse:
        """Generate complete response using Gemini."""
        from google.genai import types

        config = types.GenerateContentConfig(
            temperature=kwargs.get("temperature", 0.7),
            max_output_tokens=kwargs.get("max_tokens", 1024),
            system_instruction=system_prompt or None,
        )

        response = await self._client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=config,
        )

        usage = None
        if response.usage_metadata:
            usage = {
                "prompt_tokens": response.usage_metadata.prompt_token_count or 0,
                "completion_tokens": response.usage_metadata.candidates_token_count or 0,
                "total_tokens": response.usage_metadata.total_token_count or 0,
            }

        return ProviderResponse(
            content=response.text or "",
            model=model,
            usage=usage,
        )

    async def stream(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Stream response using Gemini."""
        from google.genai import types

        config = types.GenerateContentConfig(
            temperature=kwargs.get("temperature", 0.7),
            max_output_tokens=kwargs.get("max_tokens", 1024),
            system_instruction=system_prompt or None,
        )

        response = await self._client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=config,
            stream=True,
        )

        async for chunk in response:
            if chunk.text:
                yield chunk.text

    # ── Model discovery ──────────────────────────────────────────

    async def list_models(self) -> list[ModelInfo]:
        """List available Gemini models."""
        models = self._client.models.list()
        return [
            ModelInfo(
                id=m.name,
                name=m.display_name or m.name,
            )
            for m in models
        ]

    # ── Credential specification ─────────────────────────────────

    @classmethod
    def required_credentials(cls) -> list[CredentialSpec]:
        return [
            CredentialSpec(
                key="api_key",
                label="Google AI API Key",
                type="api_key",
                required=True,
            ),
        ]
