"""Provider registry service for managing multiple LLM provider instances.

Handles CRUD operations for provider configurations, credential management
via SecretStorage, provider validation, OAuth lifecycle, and JSON persistence.
"""

import json
import logging
from pathlib import Path
from typing import Optional
from uuid import UUID

from mindflow.models.provider import (
    AuthMethod,
    CreateProviderRequest,
    ProviderConfig,
    ProviderCredentials,
    ProviderStatus,
    ProviderType,
    UpdateProviderRequest,
)
from mindflow.providers.base import LLMProvider
from mindflow.services.oauth_service import OAuthService, get_oauth_config
from mindflow.services.secret_storage import SecretStorage
from mindflow.services.token_storage import TokenStorage

logger = logging.getLogger(__name__)

PROVIDERS_FILE = Path("data/providers.json")


class ProviderRegistry:
    """Manages the lifecycle of LLM provider registrations.

    Providers are stored in memory for fast access, persisted to
    data/providers.json for restart survival, with credentials
    stored separately in encrypted storage.

    OAuth services are cached per-provider for session management.
    """

    def __init__(
        self,
        providers_file: Optional[Path] = None,
        secret_storage: Optional[SecretStorage] = None,
        token_storage: Optional[TokenStorage] = None,
    ):
        self._providers_file = providers_file or PROVIDERS_FILE
        self._secret_storage = secret_storage or SecretStorage()
        self._token_storage = token_storage or TokenStorage()
        self._providers: dict[str, ProviderConfig] = {}
        self._oauth_services: dict[str, OAuthService] = {}
        self._load()
        self._migrate_legacy_oauth()

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

    def _migrate_legacy_oauth(self) -> None:
        """Migrate legacy single-session OAuth to per-provider format."""
        for pid, config in self._providers.items():
            if config.auth_method == AuthMethod.OAUTH:
                if self._token_storage.migrate_legacy_session(pid):
                    logger.info("Migrated legacy OAuth session to provider %s", pid)
                    break  # Only one legacy session exists

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
            auth_method=request.auth_method,
            color=request.color,
            endpoint_url=request.endpoint_url,
            selected_model=request.selected_model,
            status=ProviderStatus.DISCONNECTED,
        )

        # Store credentials separately
        creds = ProviderCredentials(
            provider_id=config.id,
            auth_method=request.auth_method,
            api_key=request.api_key,
            oauth_token=request.oauth_token,
        )
        self._secret_storage.save_credentials(creds)

        self._providers[str(config.id)] = config
        self._save()
        logger.info(
            "Registered provider '%s' (type=%s, auth=%s, id=%s)",
            config.name, config.type, config.auth_method, config.id,
        )
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
        if request.auth_method is not None:
            config.auth_method = request.auth_method

        # Update credentials if provided
        if request.api_key is not None or request.oauth_token is not None:
            existing_creds = self._secret_storage.get_credentials(provider_id)
            creds = ProviderCredentials(
                provider_id=UUID(provider_id),
                auth_method=config.auth_method,
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
        self._token_storage.delete_session(provider_id)
        self._oauth_services.pop(provider_id, None)
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

    # ── OAuth Lifecycle ──────────────────────────────────────────────

    def get_oauth_service(self, provider_id: str) -> Optional[OAuthService]:
        """Get or create an OAuthService for a provider.

        Returns None if the provider doesn't exist or doesn't support OAuth.
        """
        config = self._providers.get(provider_id)
        if config is None or config.auth_method != AuthMethod.OAUTH:
            return None

        if provider_id not in self._oauth_services:
            oauth_config = get_oauth_config(config.type)
            if oauth_config is None:
                return None
            self._oauth_services[provider_id] = OAuthService(
                provider_id=provider_id,
                oauth_config=oauth_config,
                token_storage=self._token_storage,
            )

        return self._oauth_services[provider_id]

    async def start_oauth_login(self, provider_id: str) -> dict:
        """Start OAuth login for a provider."""
        service = self.get_oauth_service(provider_id)
        if service is None:
            return {"status": "error", "message": "Provider not found or OAuth not supported"}

        result = await service.start_login_flow()

        # Update provider config with OAuth status
        if result.get("status") == "connected":
            config = self._providers.get(provider_id)
            if config:
                config.oauth_status = "connected"
                config.oauth_email = result.get("user_email")
                config.status = ProviderStatus.CONNECTED
                config.update_timestamp()
                self._save()

        return result

    def get_oauth_status(self, provider_id: str) -> dict:
        """Get OAuth session status for a provider."""
        service = self.get_oauth_service(provider_id)
        if service is None:
            return {"status": "not_connected"}

        status = service.get_session_status()

        # Sync status to provider config
        config = self._providers.get(provider_id)
        if config:
            config.oauth_status = status.get("status")
            config.oauth_email = status.get("user_email")
            self._save()

        return status

    def oauth_logout(self, provider_id: str) -> dict:
        """Clear OAuth session for a provider."""
        service = self.get_oauth_service(provider_id)
        if service is None:
            return {"status": "error", "message": "Provider not found or OAuth not supported"}

        result = service.logout()

        config = self._providers.get(provider_id)
        if config:
            config.oauth_status = "not_connected"
            config.oauth_email = None
            config.status = ProviderStatus.DISCONNECTED
            config.update_timestamp()
            self._save()

        return result

    async def start_device_code(self, provider_id: str) -> dict:
        """Start device code flow for a provider."""
        service = self.get_oauth_service(provider_id)
        if service is None:
            return {"status": "error", "message": "Provider not found or OAuth not supported"}
        return await service.start_device_code_flow()

    # ── Provider Instance Creation ──────────────────────────────────

    def get_provider_instance(self, provider_id: str) -> Optional[LLMProvider]:
        """Create an LLMProvider instance for a registered provider.

        Returns None if provider not found or credentials missing.
        """
        config = self._providers.get(provider_id)
        if config is None:
            return None

        creds = self._secret_storage.get_credentials(provider_id)
        if creds is None and config.auth_method != AuthMethod.OAUTH:
            return None

        return self._create_provider_instance(config, creds, provider_id)

    def _create_provider_instance(
        self,
        config: ProviderConfig,
        creds: Optional[ProviderCredentials],
        provider_id: str,
    ) -> Optional[LLMProvider]:
        """Create a concrete LLMProvider from config and credentials.

        Uses a factory lookup by ProviderType. OAuth providers get an
        OAuthService instead of an API key.
        """
        from mindflow.providers.anthropic import AnthropicProvider
        from mindflow.providers.gemini import GeminiProvider
        from mindflow.providers.ollama import OllamaProvider
        from mindflow.providers.openai import OpenAIProvider
        from mindflow.providers.openai_chatgpt import OpenAIChatGPTProvider

        try:
            # OAuth-authenticated providers
            if config.auth_method == AuthMethod.OAUTH or config.type == ProviderType.CHATGPT_WEB:
                oauth_service = self.get_oauth_service(provider_id)
                return OpenAIChatGPTProvider(oauth_service=oauth_service)

            # API-key / endpoint providers
            factory = {
                ProviderType.OPENAI: lambda: OpenAIProvider(
                    api_key=creds.api_key if creds else None,
                    base_url=config.endpoint_url,
                ),
                ProviderType.ANTHROPIC: lambda: AnthropicProvider(
                    api_key=creds.api_key if creds else None,
                ),
                ProviderType.GEMINI: lambda: GeminiProvider(
                    api_key=creds.api_key if creds else None,
                ),
                ProviderType.LOCAL: lambda: OllamaProvider(
                    base_url=config.endpoint_url,
                ),
            }

            builder = factory.get(config.type)
            if builder is None:
                logger.error("Unknown provider type: %s", config.type)
                return None

            return builder()

        except Exception as exc:
            logger.error("Failed to create provider instance for %s: %s", config.id, exc)
            raise
