"""LLM Provider Interface (Driver Layer).

Defines the abstract interface that all LLM providers must implement.
This is the independent driver layer — it knows nothing about nodes,
plugins, or the canvas. Node plugins consume provider instances through
this interface.

The interface covers:
- Connection lifecycle (connect, disconnect)
- Authentication (credentials injected at construction)
- Generation (batch and streaming)
- Model discovery (list_models)
- Status and progress reporting
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncIterator, Optional


class ProviderStatus(str, Enum):
    """Status of an LLM provider instance."""
    IDLE = "idle"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"
    RATE_LIMITED = "rate_limited"


@dataclass
class ModelInfo:
    """Information about an available model."""
    id: str
    name: str
    context_length: Optional[int] = None
    capabilities: list[str] = field(default_factory=list)


@dataclass
class ProviderResponse:
    """Response from a provider generate() call."""
    content: str
    model: str
    usage: Optional[dict[str, int]] = None
    metadata: Optional[dict[str, Any]] = None


@dataclass
class ProgressInfo:
    """Progress information for a running operation."""
    percentage: Optional[float] = None
    tokens_generated: Optional[int] = None
    estimated_total: Optional[int] = None


@dataclass(frozen=True)
class CredentialSpec:
    """Specification for a required credential."""
    key: str
    label: str
    type: str  # "api_key", "oauth", "endpoint_url"
    required: bool = True


class LLMProvider(ABC):
    """Abstract base class for LLM providers.

    All credentials are injected at construction time.
    No provider may silently fall back to environment variables,
    configuration files, or default values for authentication.
    """

    def __init__(self) -> None:
        self._status: ProviderStatus = ProviderStatus.IDLE
        self._progress: Optional[ProgressInfo] = None
        self._error: Optional[str] = None

    # ── Connection lifecycle ─────────────────────────────────────

    async def connect(self) -> None:
        """Establish connection and verify credentials.

        Implementations should test that the provider is reachable
        and credentials are valid. Sets status to CONNECTED on success
        or ERROR on failure.
        """
        self._status = ProviderStatus.CONNECTED

    async def disconnect(self) -> None:
        """Clean up resources and close connection."""
        self._status = ProviderStatus.IDLE
        self._progress = None

    # ── Generation ───────────────────────────────────────────────

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> ProviderResponse:
        """Generate a complete response (batch mode).

        Args:
            prompt: The user prompt
            model: The model identifier to use
            system_prompt: Optional system instructions
            **kwargs: Provider-specific parameters (temperature, max_tokens, etc.)

        Returns:
            ProviderResponse with content and optional usage info

        Raises:
            ValueError: If required parameters are missing
            ConnectionError: If provider is not connected
            PermissionError: If credentials are invalid
        """
        ...

    @abstractmethod
    async def stream(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Stream response tokens one by one.

        Args:
            prompt: The user prompt
            model: The model identifier to use
            system_prompt: Optional system instructions
            **kwargs: Provider-specific parameters

        Yields:
            Tokens as they are generated

        Raises:
            ValueError: If required parameters are missing
            ConnectionError: If provider is not connected
            PermissionError: If credentials are invalid
        """
        ...

    # ── Model discovery ──────────────────────────────────────────

    @abstractmethod
    async def list_models(self) -> list[ModelInfo]:
        """List available models for this provider.

        Returns:
            List of ModelInfo with model details

        Raises:
            ConnectionError: If provider is not connected
        """
        ...

    # ── Status & Progress ────────────────────────────────────────

    def get_status(self) -> ProviderStatus:
        """Get current provider status (synchronous)."""
        return self._status

    def get_progress(self) -> Optional[ProgressInfo]:
        """Get progress for the current operation, if any."""
        return self._progress

    def get_error(self) -> Optional[str]:
        """Get the last error message, if any."""
        return self._error

    # ── Credential specification ─────────────────────────────────

    @classmethod
    @abstractmethod
    def required_credentials(cls) -> list[CredentialSpec]:
        """Declare what credentials this provider needs.

        Returns:
            List of CredentialSpec describing required and optional credentials
        """
        ...
