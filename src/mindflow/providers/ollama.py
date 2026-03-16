"""Ollama LLM provider implementation."""

import json

import aiohttp

from typing import Any, AsyncIterator, Optional

from mindflow.providers.base import (
    CredentialSpec,
    LLMProvider,
    ModelInfo,
    ProviderResponse,
    ProviderStatus,
)


class OllamaProvider(LLMProvider):
    """Provider for Ollama (Local LLM).

    Requires explicit base_url injection — no env-var fallback.
    """

    def __init__(self, base_url: Optional[str] = None):
        if not base_url:
            raise ValueError(
                "Ollama base_url is required. "
                "Pass it explicitly — no environment variable fallback."
            )
        super().__init__()
        self.base_url = base_url

    # ── Connection lifecycle ─────────────────────────────────────

    async def connect(self) -> None:
        """Verify Ollama server is reachable."""
        self._status = ProviderStatus.CONNECTING
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/api/tags") as response:
                    if response.status != 200:
                        raise ConnectionError(
                            f"Ollama server returned status {response.status}"
                        )
            self._status = ProviderStatus.CONNECTED
        except aiohttp.ClientError as exc:
            self._status = ProviderStatus.ERROR
            self._error = str(exc)
            raise ConnectionError(f"Ollama connection failed: {exc}") from exc

    # ── Generation ───────────────────────────────────────────────

    async def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> ProviderResponse:
        """Generate complete response using Ollama."""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "options": {
                "temperature": kwargs.get("temperature", 0.7),
            },
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise RuntimeError(f"Ollama API error ({response.status}): {error_text}")
                data = await response.json()
                return ProviderResponse(
                    content=data.get("response", ""),
                    model=model,
                    usage={
                        "prompt_tokens": data.get("prompt_eval_count", 0),
                        "completion_tokens": data.get("eval_count", 0),
                        "total_tokens": data.get("prompt_eval_count", 0) + data.get("eval_count", 0),
                    },
                )

    async def stream(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Stream response using Ollama."""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": True,
            "options": {
                "temperature": kwargs.get("temperature", 0.7),
            },
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise RuntimeError(f"Ollama API error ({response.status}): {error_text}")

                async for line in response.content:
                    if line:
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError as exc:
                            raise RuntimeError(
                                f"Ollama returned invalid JSON: {line!r}"
                            ) from exc
                        if "response" in data:
                            yield data["response"]

    # ── Model discovery ──────────────────────────────────────────

    async def list_models(self) -> list[ModelInfo]:
        """List locally available Ollama models."""
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.base_url}/api/tags") as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise RuntimeError(f"Ollama API error ({response.status}): {error_text}")
                data = await response.json()
                return [
                    ModelInfo(id=m["name"], name=m["name"])
                    for m in data.get("models", [])
                ]

    # ── Credential specification ─────────────────────────────────

    @classmethod
    def required_credentials(cls) -> list[CredentialSpec]:
        return [
            CredentialSpec(
                key="base_url",
                label="Ollama Server URL",
                type="endpoint_url",
                required=True,
            ),
        ]
