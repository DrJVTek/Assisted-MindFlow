"""Ollama LLM provider implementation."""

import os
import json
import aiohttp
from typing import AsyncIterator, Dict, Any, Optional
from mindflow.providers.base import LLMProvider

class OllamaProvider(LLMProvider):
    """Provider for Ollama (Local LLM)."""

    def __init__(self, base_url: str = "http://localhost:11434"):
        """Initialize Ollama provider.
        
        Args:
            base_url: URL of the Ollama server.
        """
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    async def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> str:
        """Generate complete response using Ollama."""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "options": {
                "temperature": metadata.get("temperature", 0.7) if metadata else 0.7
            }
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                if response.status != 200:
                    raise Exception(f"Ollama API error: {await response.text()}")
                data = await response.json()
                return data.get("response", "")

    async def stream(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> AsyncIterator[str]:
        """Stream response using Ollama."""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": True,
            "options": {
                "temperature": metadata.get("temperature", 0.7) if metadata else 0.7
            }
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                if response.status != 200:
                    raise Exception(f"Ollama API error: {await response.text()}")
                
                async for line in response.content:
                    if line:
                        try:
                            data = json.loads(line)
                            if "response" in data:
                                yield data["response"]
                        except json.JSONDecodeError:
                            continue
