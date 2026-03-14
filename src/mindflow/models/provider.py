"""LLM Provider configuration models.

Defines the ProviderConfig model for the multi-provider registry.
Each provider instance has a unique ID, name, type, color, credentials,
and connection status. Multiple instances of the same type are allowed.

AuthMethod determines HOW credentials are obtained (API key, OAuth, or local endpoint).
ProviderType determines WHICH API implementation is used.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator


class ProviderType(str, Enum):
    """Supported LLM provider types.

    Determines which API implementation is used (request format, endpoints, etc.).
    """

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    LOCAL = "local"
    CHATGPT_WEB = "chatgpt_web"


class AuthMethod(str, Enum):
    """How credentials are obtained for a provider.

    - API_KEY: standard API key (OpenAI, Claude, Gemini, Mistral, Groq...)
    - OAUTH: browser-based OAuth flow (ChatGPT, future Claude/Gemini OAuth)
    - ENDPOINT: local endpoint URL, no auth needed (Ollama, LM Studio, vLLM...)
    """

    API_KEY = "api_key"
    OAUTH = "oauth"
    ENDPOINT = "endpoint"


class ProviderStatus(str, Enum):
    """Provider connection status."""

    DISCONNECTED = "disconnected"
    CONNECTED = "connected"
    ERROR = "error"
    RATE_LIMITED = "rate_limited"


class ProviderConfig(BaseModel):
    """Configuration for a registered LLM provider instance.

    Each provider has its own name, color, credentials, and model selection.
    Multiple instances of the same type are allowed (e.g., two OpenAI accounts).
    """

    id: UUID = Field(default_factory=uuid4)
    name: str = Field(..., min_length=1, max_length=100)
    type: ProviderType
    auth_method: AuthMethod = AuthMethod.API_KEY
    color: str = Field(..., pattern=r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
    selected_model: Optional[str] = None
    endpoint_url: Optional[str] = None
    status: ProviderStatus = ProviderStatus.DISCONNECTED
    available_models: list[str] = Field(default_factory=list)
    oauth_status: Optional[str] = None
    oauth_email: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @field_validator("endpoint_url")
    @classmethod
    def validate_endpoint_url(cls, v: Optional[str], info: "FieldValidationInfo") -> Optional[str]:
        """Endpoint URL is required for endpoint auth method."""
        auth = info.data.get("auth_method")
        ptype = info.data.get("type")
        if (auth == AuthMethod.ENDPOINT or ptype == ProviderType.LOCAL) and not v:
            raise ValueError("endpoint_url is required for local/endpoint providers")
        return v

    def update_timestamp(self) -> None:
        """Update the updated_at timestamp."""
        self.updated_at = datetime.now(UTC)


class ProviderCredentials(BaseModel):
    """Credentials for a provider instance (stored encrypted)."""

    provider_id: UUID
    auth_method: AuthMethod = AuthMethod.API_KEY
    api_key: Optional[str] = None
    oauth_token: Optional[str] = None
    refresh_token: Optional[str] = None


class CreateProviderRequest(BaseModel):
    """Request to create a new provider registration."""

    name: str = Field(..., min_length=1, max_length=100)
    type: ProviderType
    auth_method: AuthMethod = AuthMethod.API_KEY
    color: str = Field(..., pattern=r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
    api_key: Optional[str] = None
    oauth_token: Optional[str] = None
    endpoint_url: Optional[str] = None
    selected_model: Optional[str] = None


class UpdateProviderRequest(BaseModel):
    """Request to update an existing provider."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern=r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
    auth_method: Optional[AuthMethod] = None
    selected_model: Optional[str] = None
    api_key: Optional[str] = None
    oauth_token: Optional[str] = None
    endpoint_url: Optional[str] = None
