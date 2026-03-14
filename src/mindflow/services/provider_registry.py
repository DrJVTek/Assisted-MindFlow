"""Provider registry service for managing multiple LLM provider instances.

Handles CRUD operations for provider configurations, credential management
via SecretStorage, provider validation, and JSON persistence.
"""

import json
import logging
from pathlib import Path
from typing import Optional
from uuid import UUID

from mindflow.models.provider import (
    CreateProviderRequest,
    ProviderConfig,
    ProviderCredentials,
    ProviderStatus,
    ProviderType,
    UpdateProviderRequest,
)
from mindflow.providers.base import LLMProvider
from mindflow.services.secret_storage import SecretStorage

logger = logging.getLogger(__name__)

PROVIDERS_FILE = Path("data/providers.json")


class ProviderRegistry:
    """Manages the lifecycle of LLM provider registrations.

    Providers are stored in memory for fast access, persisted to
    data/providers.json for restart survival, with credentials
    stored separately in encrypted storage.
    """

    def __init__(
        self,
        providers_file: Optional[Path] = None,
        secret_storage: Optional[SecretStorage] = None,
    ):
        self._providers_file = providers_file or PROVIDERS_FILE
        self._secret_storage = secret_storage or SecretStorage()
        self._providers: dict[str, ProviderConfig] = {}
        self._load()

    def _load(self) -> None:
        """Load provider configs from JSON file."""
        if not self._providers_file.exists():
            return

        try:
            data = json.loads(self._providers_file.read_text(encoding="utf-8"))
            for provider_data in data.get("providers", []):
                config = ProviderConfig(**provider_data)
                self._providers[str(config.id)] = config
            logger.info("Loaded %d providers from %s", len(self._providers), self._providers_file)
        except (json.JSONDecodeError, Exception) as exc:
            logger.error("Failed to load providers: %s", exc)

    def _save(self) -> None:
        """Save provider configs to JSON file."""
        self._providers_file.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "providers": [
                p.model_dump(mode="json") for p in self._providers.values()
            ]
        }
        self._providers_file.write_text(
            json.dumps(data, indent=2, default=str),
            encoding="utf-8",
        )

    def list_providers(self) -> list[ProviderConfig]:
        """List all registered providers."""
        return list(self._providers.values())

    def get_provider(self, provider_id: str) -> Optional[ProviderConfig]:
        """Get a provider by ID."""
        return self._providers.get(provider_id)

    def register_provider(self, request: CreateProviderRequest) -> ProviderConfig:
        """Register a new provider instance.

        Creates the config, stores credentials, and returns the config.
        Does NOT validate connectivity — call validate_provider() separately.
        """
        config = ProviderConfig(
            name=request.name,
            type=request.type,
            color=request.color,
            endpoint_url=request.endpoint_url,
            selected_model=request.selected_model,
            status=ProviderStatus.DISCONNECTED,
        )

        # Store credentials separately
        creds = ProviderCredentials(
            provider_id=config.id,
            api_key=request.api_key,
            oauth_token=request.oauth_token,
        )
        self._secret_storage.save_credentials(creds)

        self._providers[str(config.id)] = config
        self._save()
        logger.info("Registered provider '%s' (type=%s, id=%s)", config.name, config.type, config.id)
        return config

    def update_provider(self, provider_id: str, request: UpdateProviderRequest) -> Optional[ProviderConfig]:
        """Update an existing provider's configuration."""
        config = self._providers.get(provider_id)
        if config is None:
            return None

        if request.name is not None:
            config.name = request.name
        if request.color is not None:
            config.color = request.color
        if request.selected_model is not None:
            config.selected_model = request.selected_model
        if request.endpoint_url is not None:
            config.endpoint_url = request.endpoint_url

        # Update credentials if provided
        if request.api_key is not None or request.oauth_token is not None:
            existing_creds = self._secret_storage.get_credentials(provider_id)
            creds = ProviderCredentials(
                provider_id=UUID(provider_id),
                api_key=request.api_key or (existing_creds.api_key if existing_creds else None),
                oauth_token=request.oauth_token or (existing_creds.oauth_token if existing_creds else None),
            )
            self._secret_storage.save_credentials(creds)
            config.status = ProviderStatus.DISCONNECTED  # Re-validation needed

        config.update_timestamp()
        self._save()
        return config

    def delete_provider(self, provider_id: str) -> bool:
        """Remove a provider and its credentials."""
        if provider_id not in self._providers:
            return False

        del self._providers[provider_id]
        self._secret_storage.delete_credentials(provider_id)
        self._save()
        logger.info("Deleted provider %s", provider_id)
        return True

    def get_credentials(self, provider_id: str) -> Optional[ProviderCredentials]:
        """Get decrypted credentials for a provider."""
        return self._secret_storage.get_credentials(provider_id)

    def set_status(self, provider_id: str, status: ProviderStatus) -> None:
        """Update a provider's connection status."""
        config = self._providers.get(provider_id)
        if config:
            config.status = status
            config.update_timestamp()
            self._save()

    def set_available_models(self, provider_id: str, models: list[str]) -> None:
        """Update a provider's list of available models."""
        config = self._providers.get(provider_id)
        if config:
            config.available_models = models
            config.update_timestamp()
            self._save()

    def get_provider_instance(self, provider_id: str) -> Optional[LLMProvider]:
        """Create an LLMProvider instance for a registered provider.

        Returns None if provider not found or credentials missing.
        """
        config = self._providers.get(provider_id)
        if config is None:
            return None

        creds = self._secret_storage.get_credentials(provider_id)
        if creds is None:
            return None

        return self._create_provider_instance(config, creds)

    def _create_provider_instance(
        self, config: ProviderConfig, creds: ProviderCredentials
    ) -> Optional[LLMProvider]:
        """Create a concrete LLMProvider from config and credentials."""
        try:
            if config.type == ProviderType.ANTHROPIC:
                from mindflow.providers.anthropic import AnthropicProvider
                return AnthropicProvider(api_key=creds.api_key)

            if config.type == ProviderType.OPENAI:
                from mindflow.providers.openai import OpenAIProvider
                return OpenAIProvider(api_key=creds.api_key)

            if config.type == ProviderType.GEMINI:
                from mindflow.providers.gemini import GeminiProvider
                return GeminiProvider(api_key=creds.api_key)

            if config.type == ProviderType.LOCAL:
                from mindflow.providers.ollama import OllamaProvider
                return OllamaProvider(endpoint_url=config.endpoint_url)

            if config.type == ProviderType.CHATGPT_WEB:
                from mindflow.providers.openai_chatgpt import OpenAIChatGPTProvider
                return OpenAIChatGPTProvider(access_token=creds.oauth_token)

        except Exception as exc:
            logger.error("Failed to create provider instance for %s: %s", config.id, exc)

        return None
