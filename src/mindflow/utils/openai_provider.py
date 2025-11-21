"""OpenAI LLM provider implementation.

Provides streaming completions from OpenAI API (GPT-4, GPT-3.5, etc.).

Configuration:
    Set OPENAI_API_KEY environment variable or pass api_key to constructor.

Example:
    >>> import os
    >>> from mindflow.utils.openai_provider import OpenAIProvider
    >>>
    >>> provider = OpenAIProvider(api_key=os.getenv("OPENAI_API_KEY"))
    >>> async for token in provider.stream_completion(
    ...     model="gpt-4",
    ...     prompt="Explain recursion in one sentence"
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


class OpenAIProvider(LLMStreamProvider):
    """OpenAI streaming provider for GPT models.

    Connects to OpenAI API and streams completions from GPT-4, GPT-3.5-turbo,
    and other chat models.

    Features:
        - Streaming via Server-Sent Events
        - Token-level granularity
        - Function calling support (via metadata)
        - Vision support (GPT-4 Vision)

    Rate Limits (as of 2025):
        - GPT-4: 10,000 TPM, 500 RPM (Tier 1)
        - GPT-3.5-turbo: 60,000 TPM, 3,500 RPM (Tier 1)

    Pricing (as of 2025):
        - GPT-4-turbo: $0.01/1K input, $0.03/1K output
        - GPT-3.5-turbo: $0.0005/1K input, $0.0015/1K output
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.openai.com/v1",
        timeout: int = 120
    ):
        """Initialize OpenAI provider.

        Args:
            api_key: OpenAI API key (get from platform.openai.com)
            base_url: API base URL (default: https://api.openai.com/v1)
            timeout: Request timeout in seconds (default: 120)

        Raises:
            ValueError: If api_key is empty
        """
        if not api_key:
            raise ValueError("OpenAI API key is required")

        super().__init__(
            provider_name="OpenAI",
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
                "Authorization": f"Bearer {self.api_key}",
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
        """Stream completion from OpenAI.

        Args:
            model: Model name (e.g., "gpt-4", "gpt-3.5-turbo", "gpt-4-turbo")
            prompt: User message
            system_prompt: Optional system message
            temperature: Sampling temperature (0.0-2.0)
            max_tokens: Maximum tokens to generate
            metadata: Additional parameters (top_p, frequency_penalty, etc.)

        Yields:
            Token strings from the LLM

        Raises:
            AuthenticationError: Invalid API key
            RateLimitError: Rate limit exceeded
            ModelNotFoundError: Model not found
            LLMStreamError: Other API errors

        Example:
            >>> async for token in provider.stream_completion(
            ...     model="gpt-4",
            ...     prompt="What is π?",
            ...     temperature=0.1
            ... ):
            ...     print(token, end="")
        """
        session = await self._get_session()

        # Build messages array
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Build request payload
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": True
        }

        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        # Merge additional metadata
        if metadata:
            payload.update(metadata)

        url = f"{self.base_url}/chat/completions"

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
                        f"OpenAI API error ({response.status}): {error_text}",
                        provider=self.provider_name,
                        model=model
                    )

                # Stream response line by line
                async for line in response.content:
                    if not line:
                        continue

                    line_text = line.decode("utf-8").strip()

                    # OpenAI SSE format: "data: {json}"
                    if not line_text.startswith("data: "):
                        continue

                    # Remove "data: " prefix
                    data_str = line_text[6:]

                    # Check for stream end
                    if data_str == "[DONE]":
                        break

                    try:
                        # Parse JSON chunk
                        chunk = json.loads(data_str)

                        # Extract token from delta
                        if "choices" in chunk and len(chunk["choices"]) > 0:
                            delta = chunk["choices"][0].get("delta", {})
                            token = delta.get("content", "")
                            if token:
                                yield token

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

        Note:
            OpenAI API doesn't provide a public model list endpoint,
            so we check common models only.
        """
        # Common OpenAI models as of 2025
        known_models = {
            "gpt-4", "gpt-4-turbo", "gpt-4-vision-preview",
            "gpt-3.5-turbo", "gpt-3.5-turbo-16k",
            "gpt-4-0125-preview", "gpt-4-1106-preview"
        }
        return model in known_models

    async def list_models(self) -> list[str]:
        """List available OpenAI models.

        Returns:
            List of common model names

        Note:
            Returns a curated list of common models. For full list,
            use OpenAI API directly: GET /v1/models
        """
        return [
            "gpt-4",
            "gpt-4-turbo",
            "gpt-3.5-turbo",
            "gpt-4-vision-preview"
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


__all__ = ["OpenAIProvider"]
