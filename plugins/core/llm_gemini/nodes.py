"""Gemini Chat node — LLM node pre-bound to Google Gemini provider."""

from typing import Any, AsyncIterator

from mindflow.plugins.base import LLMNode


class GeminiChatNode(LLMNode):
    """Chat node using Google Gemini API."""

    RETURN_TYPES = ("STRING", "CONTEXT", "STRING")
    RETURN_NAMES = ("response", "context", "prompt")
    FUNCTION = "execute"
    CATEGORY = "llm/gemini"
    STREAMING = True
    UI = {
        "color": "#4285F4",
        "icon": "gemini",
        "min_height": 200,
        "dual_zone": True,
    }

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "prompt": ("STRING", {"multiline": True}),
                "model": ("COMBO", {"options": [
                    "gemini-2.5-pro", "gemini-2.5-flash",
                    "gemini-2.0-flash",
                ]}),
            },
            "optional": {
                "context": ("CONTEXT", {}),
                "system_prompt": ("STRING", {"multiline": True, "default": ""}),
                "temperature": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 2.0, "step": 0.1}),
                "max_tokens": ("INT", {"default": 1024, "min": 1, "max": 1000000}),
            },
            "credentials": {
                "provider_id": ("SECRET", {"label": "Gemini Provider"}),
            },
        }

    async def execute(self, prompt: str, model: str, provider: Any = None,
                      context: str = "", system_prompt: str = "",
                      temperature: float = 0.7, max_tokens: int = 1024,
                      **kwargs: Any) -> tuple[str, str]:
        if provider is None:
            raise ValueError("GeminiChatNode requires a Gemini provider instance.")

        full_prompt = f"Context:\n{context}\n\nUser:\n{prompt}" if context else prompt
        response = await provider.generate(
            prompt=full_prompt, model=model,
            system_prompt=system_prompt or None,
            temperature=temperature, max_tokens=max_tokens,
        )
        updated_context = (context + "\n\n" if context else "") + f"User: {prompt}\nAssistant: {response.content}"
        return (response.content, updated_context, prompt)

    async def stream(self, prompt: str, model: str, provider: Any = None,
                     context: str = "", system_prompt: str = "",
                     temperature: float = 0.7, max_tokens: int = 1024,
                     **kwargs: Any) -> AsyncIterator[str]:
        if provider is None:
            raise ValueError("GeminiChatNode requires a Gemini provider instance.")

        full_prompt = f"Context:\n{context}\n\nUser:\n{prompt}" if context else prompt
        async for token in provider.stream(
            prompt=full_prompt, model=model,
            system_prompt=system_prompt or None,
            temperature=temperature, max_tokens=max_tokens,
        ):
            yield token
