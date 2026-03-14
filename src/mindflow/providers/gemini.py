"""Google Gemini LLM provider implementation."""

import os
from typing import Any, AsyncIterator, Dict, Optional

from mindflow.providers.base import LLMProvider


class GeminiProvider(LLMProvider):
    """Provider for Google Gemini API."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize Gemini provider.

        Args:
            api_key: Google AI API key. If None, reads from GOOGLE_API_KEY env var.
        """
        import google.generativeai as genai

        self._api_key = api_key or os.getenv("GOOGLE_API_KEY")
        genai.configure(api_key=self._api_key)
        self._genai = genai

    async def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None,
    ) -> str:
        """Generate complete response using Gemini."""
        gen_model = self._genai.GenerativeModel(
            model_name=model,
            system_instruction=system_prompt or None,
            generation_config=self._genai.GenerationConfig(
                temperature=metadata.get("temperature", 0.7) if metadata else 0.7,
                max_output_tokens=metadata.get("max_tokens", 1024) if metadata else 1024,
            ),
        )
        response = await gen_model.generate_content_async(prompt)
        return response.text

    async def stream(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None,
    ) -> AsyncIterator[str]:
        """Stream response using Gemini."""
        gen_model = self._genai.GenerativeModel(
            model_name=model,
            system_instruction=system_prompt or None,
            generation_config=self._genai.GenerationConfig(
                temperature=metadata.get("temperature", 0.7) if metadata else 0.7,
                max_output_tokens=metadata.get("max_tokens", 1024) if metadata else 1024,
            ),
        )
        response = await gen_model.generate_content_async(prompt, stream=True)
        async for chunk in response:
            if chunk.text:
                yield chunk.text
