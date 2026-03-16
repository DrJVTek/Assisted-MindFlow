"""LLM Provider abstraction for streaming completions (DEPRECATED).

DEPRECATED: Use src/mindflow/providers/ instead. This module is kept only
for backward compatibility with llm_concurrency.py during migration.

This module defines the abstract base class for all LLM providers (OpenAI, Anthropic, Ollama).
Providers implement a unified streaming interface for token-by-token content generation.

Architecture:
    - Abstract base class: LLMStreamProvider
    - Concrete implementations: OpenAIProvider, AnthropicProvider, OllamaProvider
    - All providers support async streaming via AsyncIterator[str]

Example:
    >>> from mindflow.utils.llm_providers import OllamaProvider
    >>>
    >>> provider = OllamaProvider(base_url="http://localhost:11434")
    >>> async for token in provider.stream_completion(
    ...     model="llama2",
    ...     prompt="Explain quantum computing",
    ...     system_prompt="You are a helpful assistant."
    ... ):
    ...     print(token, end="", flush=True)
"""

from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional, Dict, Any
from uuid import UUID


class LLMStreamProvider(ABC):
    """Abstract base class for LLM streaming providers.

    All LLM providers must implement the stream_completion method which
    returns an async iterator yielding tokens as they arrive from the LLM.

    Design Goals:
        - Provider-agnostic interface for concurrent operations
        - Async streaming for non-blocking token delivery
        - Extensible metadata for provider-specific features
        - Clean error handling with typed exceptions

    Attributes:
        provider_name: Human-readable name (e.g., "OpenAI", "Anthropic", "Ollama")
        base_url: Base URL for API requests (e.g., "https://api.openai.com/v1")
        api_key: Optional API key for authenticated providers

    State Management:
        - Providers are stateless (no conversation history)
        - Each stream_completion call is independent
        - Redis handles accumulation and state persistence

    Error Handling:
        - Raise ConnectionError for network issues
        - Raise TimeoutError for request timeouts
        - Raise ValueError for invalid parameters
        - Raise RuntimeError for API errors (rate limits, auth failures)
    """

    def __init__(
        self,
        provider_name: str,
        base_url: str,
        api_key: Optional[str] = None
    ):
        """Initialize the LLM provider.

        Args:
            provider_name: Human-readable provider name
            base_url: Base URL for API requests
            api_key: Optional API key (None for Ollama local)
        """
        self.provider_name = provider_name
        self.base_url = base_url
        self.api_key = api_key

    @abstractmethod
    async def stream_completion(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> AsyncIterator[str]:
        """Stream completion tokens from the LLM.

        This method returns an async iterator that yields tokens as they arrive
        from the LLM. The iterator should be consumed with `async for`.

        Args:
            model: Model identifier (e.g., "gpt-4", "claude-3-opus", "llama2")
            prompt: User prompt/question to send to the LLM
            system_prompt: Optional system prompt for behavior control
            temperature: Sampling temperature (0.0 = deterministic, 1.0 = creative)
            max_tokens: Maximum tokens to generate (None = provider default)
            metadata: Provider-specific parameters (e.g., top_p, frequency_penalty)

        Yields:
            Token strings as they arrive from the LLM

        Raises:
            ConnectionError: Network connectivity issues
            TimeoutError: Request exceeded timeout
            ValueError: Invalid parameters (model, temperature, etc.)
            RuntimeError: API errors (rate limit, authentication, etc.)

        Example:
            >>> async for token in provider.stream_completion(
            ...     model="gpt-4",
            ...     prompt="What is 2+2?",
            ...     temperature=0.1
            ... ):
            ...     print(token, end="")
            # Output: "2 + 2 equals 4."

        Performance Notes:
            - Tokens arrive in 10-100ms intervals
            - Buffer tokens every 50-100ms before UI updates
            - Use asyncio.gather() for concurrent streams
            - Provider handles backpressure automatically
        """
        pass

    @abstractmethod
    async def validate_model(self, model: str) -> bool:
        """Check if the model is available and accessible.

        Args:
            model: Model identifier to validate

        Returns:
            True if model exists and is accessible, False otherwise

        Example:
            >>> is_valid = await provider.validate_model("gpt-4")
            >>> if not is_valid:
            ...     print("Model not found or not accessible")
        """
        pass

    @abstractmethod
    async def list_models(self) -> list[str]:
        """List all available models from this provider.

        Returns:
            List of model identifiers

        Example:
            >>> models = await provider.list_models()
            >>> print(models)
            ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo']
        """
        pass

    def __repr__(self) -> str:
        """String representation for debugging."""
        return f"{self.__class__.__name__}(provider='{self.provider_name}', base_url='{self.base_url}')"


class LLMStreamError(Exception):
    """Base exception for LLM streaming errors.

    All provider-specific errors should inherit from this class.
    """

    def __init__(self, message: str, provider: str, model: str):
        """Initialize the error.

        Args:
            message: Human-readable error description
            provider: Provider name (e.g., "OpenAI")
            model: Model identifier
        """
        self.provider = provider
        self.model = model
        super().__init__(f"[{provider}/{model}] {message}")


class RateLimitError(LLMStreamError):
    """Raised when provider rate limit is exceeded."""
    pass


class AuthenticationError(LLMStreamError):
    """Raised when API key is invalid or missing."""
    pass


class ModelNotFoundError(LLMStreamError):
    """Raised when requested model doesn't exist."""
    pass


__all__ = [
    "LLMStreamProvider",
    "LLMStreamError",
    "RateLimitError",
    "AuthenticationError",
    "ModelNotFoundError"
]
