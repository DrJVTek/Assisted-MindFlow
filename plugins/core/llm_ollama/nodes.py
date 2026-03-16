"""Ollama Chat node — LLM node pre-bound to Ollama (local) provider."""

from typing import Any, AsyncIterator

from mindflow.plugins.base import LLMNode


class OllamaChatNode(LLMNode):
    """Chat node using Ollama (local LLM server)."""

    RETURN_TYPES = ("STRING", "CONTEXT", "STRING")
    RETURN_NAMES = ("response", "context", "prompt")
    FUNCTION = "execute"
    CATEGORY = "llm/ollama"
    STREAMING = True
    UI = {
        "color": "#1D1D1F",
        "icon": "ollama",
        "min_height": 200,
        "dual_zone": True,
    }

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "prompt": ("STRING", {"multiline": True}),
                "model": ("COMBO", {"options": [], "dynamic": True}),
            },
            "optional": {
                "context": ("CONTEXT", {}),
                "system_prompt": ("STRING", {"multiline": True, "default": ""}),
                "temperature": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 2.0, "step": 0.1}),
            },
            "credentials": {
                "provider_id": ("SECRET", {"label": "Ollama Provider"}),
            },
        }

    async def execute(self, prompt: str, model: str, provider: Any = None,
                      context: str = "", system_prompt: str = "",
                      temperature: float = 0.7, **kwargs: Any) -> tuple[str, str]:
        if provider is None:
            raise ValueError("OllamaChatNode requires an Ollama provider instance.")

        full_prompt = f"Context:\n{context}\n\nUser:\n{prompt}" if context else prompt
        response = await provider.generate(
            prompt=full_prompt, model=model,
            system_prompt=system_prompt or None,
            temperature=temperature,
        )
        updated_context = (context + "\n\n" if context else "") + f"User: {prompt}\nAssistant: {response.content}"
        return (response.content, updated_context, prompt)

    async def stream(self, prompt: str, model: str, provider: Any = None,
                     context: str = "", system_prompt: str = "",
                     temperature: float = 0.7, **kwargs: Any) -> AsyncIterator[str]:
        if provider is None:
            raise ValueError("OllamaChatNode requires an Ollama provider instance.")

        full_prompt = f"Context:\n{context}\n\nUser:\n{prompt}" if context else prompt
        async for token in provider.stream(
            prompt=full_prompt, model=model,
            system_prompt=system_prompt or None,
            temperature=temperature,
        ):
            yield token
