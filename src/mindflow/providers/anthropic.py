"""Anthropic LLM provider implementation."""

import os
from typing import AsyncIterator, Dict, Any, Optional
from anthropic import AsyncAnthropic
from mindflow.providers.base import LLMProvider

class AnthropicProvider(LLMProvider):
    """Provider for Anthropic API (Claude)."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize Anthropic provider.
        
        Args:
            api_key: Anthropic API key. If None, reads from ANTHROPIC_API_KEY env var.
        """
        self.client = AsyncAnthropic(api_key=api_key or os.getenv("ANTHROPIC_API_KEY"))

    async def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> str:
        """Generate complete response using Anthropic."""
        response = await self.client.messages.create(
            model=model,
            max_tokens=metadata.get("max_tokens", 1024) if metadata else 1024,
            temperature=metadata.get("temperature", 0.7) if metadata else 0.7,
            system=system_prompt or "",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

    async def stream(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> AsyncIterator[str]:
        """Stream response using Anthropic."""
        async with self.client.messages.stream(
            model=model,
            max_tokens=metadata.get("max_tokens", 1024) if metadata else 1024,
            temperature=metadata.get("temperature", 0.7) if metadata else 0.7,
            system=system_prompt or "",
            messages=[{"role": "user", "content": prompt}]
        ) as stream:
            async for text in stream.text_stream:
                yield text
