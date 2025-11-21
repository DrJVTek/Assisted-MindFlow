"""Anthropic LLM provider implementation.

Provides streaming completions from Anthropic API (Claude models).

Configuration:
    Set ANTHROPIC_API_KEY environment variable or pass api_key to constructor.

Example:
    >>> import os
    >>> from mindflow.utils.anthropic_provider import AnthropicProvider
    >>>
    >>> provider = AnthropicProvider(api_key=os.getenv("ANTHROPIC_API_KEY"))
    >>> async for token in provider.stream_completion(
    ...     model="claude-3-opus-20240229",
    ...     prompt="Explain quantum entanglement briefly"
    ... ):
    ...     print(token, end="", flush=True)
"""

import json
from typing import AsyncIterator, Optional, Dict, Any

import aiohttp

from mindflow.utils.llm_providers import (
    LLMStreamProvider,
    LLMStreamError,
    ModelNotFoundError,
    AuthenticationError,
    RateLimitError
)


class AnthropicProvider(LLMStreamProvider):
    """Anthropic streaming provider for Claude models.

    Connects to Anthropic API and streams completions from Claude 3 models
    (Opus, Sonnet, Haiku).

    Features:
        - Streaming via Server-Sent Events
        - 200K context window (Claude 3)
        - Vision support (Claude 3)
        - Function calling (tool use)

    Rate Limits (as of 2025):
        - Tier 1: 50,000 TPM, 50 RPM
        - Tier 2: 100,000 TPM, 1,000 RPM

    Pricing (as of 2025):
        - Claude 3 Opus: $15/MTok input, $75/MTok output
        - Claude 3 Sonnet: $3/MTok input, $15/MTok output
        - Claude 3 Haiku: $0.25/MTok input, $1.25/MTok output
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.anthropic.com/v1",
        timeout: int = 120
    ):
        """Initialize Anthropic provider.

        Args:
            api_key: Anthropic API key (get from console.anthropic.com)
            base_url: API base URL (default: https://api.anthropic.com/v1)
            timeout: Request timeout in seconds (default: 120)

        Raises:
            ValueError: If api_key is empty
        """
        if not api_key:
            raise ValueError("Anthropic API key is required")

        super().__init__(
            provider_name="Anthropic",
            base_url=base_url,
            api_key=api_key
        )
        self.timeout = timeout
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session with auth headers.

        Returns:
            Active ClientSession instance
        """
        if self._session is None or self._session.closed:
            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            }
            self._session = aiohttp.ClientSession(
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=self.timeout)
            )
        return self._session

    async def stream_completion(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> AsyncIterator[str]:
        """Stream completion from Anthropic.

        Args:
            model: Model name (e.g., "claude-3-opus-20240229", "claude-3-sonnet-20240229")
            prompt: User message
            system_prompt: Optional system prompt
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Maximum tokens to generate (default: 4096)
            metadata: Additional parameters (top_p, top_k, etc.)

        Yields:
            Token strings from the LLM

        Raises:
            AuthenticationError: Invalid API key
            RateLimitError: Rate limit exceeded
            ModelNotFoundError: Model not found
            LLMStreamError: Other API errors

        Example:
            >>> async for token in provider.stream_completion(
            ...     model="claude-3-sonnet-20240229",
            ...     prompt="Write a haiku about AI",
            ...     temperature=0.8
            ... ):
            ...     print(token, end="")
        """
        session = await self._get_session()

        # Build request payload (Anthropic format)
        payload: Dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens or 4096,
            "stream": True
        }

        # Add system prompt if provided
        if system_prompt:
            payload["system"] = system_prompt

        # Merge additional metadata
        if metadata:
            payload.update(metadata)

        url = f"{self.base_url}/messages"

        try:
            async with session.post(url, json=payload) as response:
                # Check for errors
                if response.status == 401:
                    raise AuthenticationError(
                        "Invalid API key",
                        provider=self.provider_name,
                        model=model
                    )
                elif response.status == 429:
                    raise RateLimitError(
                        "Rate limit exceeded",
                        provider=self.provider_name,
                        model=model
                    )
                elif response.status == 404:
                    raise ModelNotFoundError(
                        f"Model '{model}' not found",
                        provider=self.provider_name,
                        model=model
                    )
                elif response.status != 200:
                    error_text = await response.text()
                    raise LLMStreamError(
                        f"Anthropic API error ({response.status}): {error_text}",
                        provider=self.provider_name,
                        model=model
                    )

                # Stream response line by line
                async for line in response.content:
                    if not line:
                        continue

                    line_text = line.decode("utf-8").strip()

                    # Anthropic SSE format: "data: {json}"
                    if not line_text.startswith("data: "):
                        continue

                    # Remove "data: " prefix
                    data_str = line_text[6:]

                    try:
                        # Parse JSON chunk
                        chunk = json.loads(data_str)

                        # Anthropic event types
                        event_type = chunk.get("type")

                        # Extract token from content_block_delta
                        if event_type == "content_block_delta":
                            delta = chunk.get("delta", {})
                            if delta.get("type") == "text_delta":
                                token = delta.get("text", "")
                                if token:
                                    yield token

                        # Check for stream end
                        elif event_type == "message_stop":
                            break

                    except json.JSONDecodeError:
                        # Skip malformed JSON
                        continue

        except aiohttp.ClientError as e:
            raise LLMStreamError(
                f"HTTP client error: {str(e)}",
                provider=self.provider_name,
                model=model
            ) from e

    async def validate_model(self, model: str) -> bool:
        """Check if model is available.

        Args:
            model: Model name to validate

        Returns:
            True if model exists, False otherwise
        """
        # Claude 3 models as of 2025
        known_models = {
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
            "claude-2.1",
            "claude-2.0"
        }
        return model in known_models

    async def list_models(self) -> list[str]:
        """List available Anthropic models.

        Returns:
            List of Claude model names
        """
        return [
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307"
        ]

    async def close(self):
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()


__all__ = ["AnthropicProvider"]
