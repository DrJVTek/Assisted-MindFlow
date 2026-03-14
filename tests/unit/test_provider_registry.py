"""Unit tests for ProviderRegistry service.

Tests CRUD operations, status management, model listing, and provider
instance creation (with mocked provider classes).
"""

import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from uuid import uuid4

from mindflow.models.provider import (
    CreateProviderRequest,
    ProviderConfig,
    ProviderCredentials,
    ProviderStatus,
    ProviderType,
    UpdateProviderRequest,
)
from mindflow.services.provider_registry import ProviderRegistry


@pytest.fixture
def secret_storage():
    """Create a mock SecretStorage that stores credentials in-memory."""
    storage = MagicMock()
    _store: dict[str, ProviderCredentials] = {}

    def save(creds: ProviderCredentials):
        _store[str(creds.provider_id)] = creds

    def get(pid: str):
        return _store.get(pid)

    def delete(pid: str):
        return _store.pop(pid, None) is not None

    storage.save_credentials = MagicMock(side_effect=save)
    storage.get_credentials = MagicMock(side_effect=get)
    storage.delete_credentials = MagicMock(side_effect=delete)
    return storage


@pytest.fixture
def registry(tmp_path, secret_storage):
    """Create a ProviderRegistry with temp file storage and mock secrets."""
    return ProviderRegistry(
        providers_file=tmp_path / "providers.json",
        secret_storage=secret_storage,
    )


def _create_request(
    name: str = "Test Provider",
    provider_type: ProviderType = ProviderType.OPENAI,
    color: str = "#10A37F",
    api_key: str = "sk-test-key",
    endpoint_url: str = None,
) -> CreateProviderRequest:
    return CreateProviderRequest(
        name=name,
        type=provider_type,
        color=color,
        api_key=api_key,
        endpoint_url=endpoint_url,
    )


# ── Register & Retrieve ────────────────────────────────────────────


class TestRegisterProvider:
    """register_provider + get_provider basics."""

    def test_register_returns_config(self, registry):
        req = _create_request()
        config = registry.register_provider(req)
        assert config.name == "Test Provider"
        assert config.type == ProviderType.OPENAI
        assert config.status == ProviderStatus.DISCONNECTED
        assert config.id is not None

    def test_retrieve_by_id(self, registry):
        config = registry.register_provider(_create_request())
        retrieved = registry.get_provider(str(config.id))
        assert retrieved is not None
        assert retrieved.id == config.id

    def test_register_stores_credentials(self, registry, secret_storage):
        req = _create_request(api_key="sk-secret-123")
        registry.register_provider(req)
        secret_storage.save_credentials.assert_called_once()
        creds_arg = secret_storage.save_credentials.call_args[0][0]
        assert creds_arg.api_key == "sk-secret-123"


class TestRegisterMultipleProviders:
    """Multiple providers, including same type."""

    def test_register_multiple_different_types(self, registry):
        registry.register_provider(_create_request(name="OpenAI", provider_type=ProviderType.OPENAI))
        registry.register_provider(_create_request(name="Claude", provider_type=ProviderType.ANTHROPIC))
        registry.register_provider(
            _create_request(
                name="Ollama",
                provider_type=ProviderType.LOCAL,
                endpoint_url="http://localhost:11434",
            )
        )
        assert len(registry.list_providers()) == 3

    def test_register_multiple_same_type(self, registry):
        registry.register_provider(_create_request(name="Work OpenAI"))
        registry.register_provider(_create_request(name="Personal OpenAI"))
        providers = registry.list_providers()
        assert len(providers) == 2
        names = {p.name for p in providers}
        assert names == {"Work OpenAI", "Personal OpenAI"}


# ── Update ──────────────────────────────────────────────────────────


class TestUpdateProvider:
    """update_provider for name, color, selected_model."""

    def test_update_name(self, registry):
        config = registry.register_provider(_create_request())
        updated = registry.update_provider(
            str(config.id),
            UpdateProviderRequest(name="Renamed"),
        )
        assert updated.name == "Renamed"

    def test_update_color(self, registry):
        config = registry.register_provider(_create_request())
        updated = registry.update_provider(
            str(config.id),
            UpdateProviderRequest(color="#FF0000"),
        )
        assert updated.color == "#FF0000"

    def test_update_selected_model(self, registry):
        config = registry.register_provider(_create_request())
        updated = registry.update_provider(
            str(config.id),
            UpdateProviderRequest(selected_model="gpt-4o"),
        )
        assert updated.selected_model == "gpt-4o"

    def test_update_nonexistent_returns_none(self, registry):
        result = registry.update_provider(
            str(uuid4()),
            UpdateProviderRequest(name="Ghost"),
        )
        assert result is None

    def test_update_advances_timestamp(self, registry):
        config = registry.register_provider(_create_request())
        original_updated_at = config.updated_at
        updated = registry.update_provider(
            str(config.id),
            UpdateProviderRequest(name="Changed"),
        )
        assert updated.updated_at >= original_updated_at


# ── Delete ──────────────────────────────────────────────────────────


class TestDeleteProvider:
    """delete_provider removes from list and credentials."""

    def test_delete_existing(self, registry, secret_storage):
        config = registry.register_provider(_create_request())
        result = registry.delete_provider(str(config.id))
        assert result is True
        assert registry.get_provider(str(config.id)) is None
        secret_storage.delete_credentials.assert_called_once_with(str(config.id))

    def test_delete_nonexistent_returns_false(self, registry):
        result = registry.delete_provider(str(uuid4()))
        assert result is False

    def test_delete_removes_from_list(self, registry):
        config = registry.register_provider(_create_request())
        registry.delete_provider(str(config.id))
        assert len(registry.list_providers()) == 0


# ── List ────────────────────────────────────────────────────────────


class TestListProviders:
    """list_providers returns all registered providers."""

    def test_list_empty(self, registry):
        assert registry.list_providers() == []

    def test_list_returns_all(self, registry):
        registry.register_provider(_create_request(name="A"))
        registry.register_provider(_create_request(name="B"))
        assert len(registry.list_providers()) == 2


# ── Get by ID ───────────────────────────────────────────────────────


class TestGetProvider:
    """get_provider found and not found."""

    def test_get_found(self, registry):
        config = registry.register_provider(_create_request())
        result = registry.get_provider(str(config.id))
        assert result is not None
        assert result.name == "Test Provider"

    def test_get_not_found(self, registry):
        result = registry.get_provider(str(uuid4()))
        assert result is None


# ── Status & Models ─────────────────────────────────────────────────


class TestSetStatus:
    """set_status and set_available_models."""

    def test_set_status_connected(self, registry):
        config = registry.register_provider(_create_request())
        registry.set_status(str(config.id), ProviderStatus.CONNECTED)
        updated = registry.get_provider(str(config.id))
        assert updated.status == ProviderStatus.CONNECTED

    def test_set_status_error(self, registry):
        config = registry.register_provider(_create_request())
        registry.set_status(str(config.id), ProviderStatus.ERROR)
        assert registry.get_provider(str(config.id)).status == ProviderStatus.ERROR

    def test_set_status_nonexistent_does_nothing(self, registry):
        # Should not raise
        registry.set_status(str(uuid4()), ProviderStatus.CONNECTED)

    def test_set_available_models(self, registry):
        config = registry.register_provider(_create_request())
        models = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]
        registry.set_available_models(str(config.id), models)
        updated = registry.get_provider(str(config.id))
        assert updated.available_models == models

    def test_set_available_models_nonexistent_does_nothing(self, registry):
        registry.set_available_models(str(uuid4()), ["model-a"])


# ── get_provider_instance ──────────────────────────────────────────


class TestGetProviderInstance:
    """get_provider_instance creates the correct provider type."""

    def test_returns_none_for_unknown_id(self, registry):
        assert registry.get_provider_instance(str(uuid4())) is None

    def test_returns_none_when_no_credentials(self, registry, secret_storage):
        config = registry.register_provider(_create_request())
        # Override get_credentials to return None
        secret_storage.get_credentials = MagicMock(return_value=None)
        assert registry.get_provider_instance(str(config.id)) is None

    @patch("mindflow.providers.openai.OpenAIProvider")
    def test_creates_openai_provider(self, mock_openai_cls, registry):
        config = registry.register_provider(
            _create_request(provider_type=ProviderType.OPENAI, api_key="sk-key")
        )
        mock_instance = MagicMock()
        mock_openai_cls.return_value = mock_instance

        result = registry.get_provider_instance(str(config.id))
        assert result is not None
        mock_openai_cls.assert_called_once_with(api_key="sk-key")

    @patch("mindflow.providers.anthropic.AnthropicProvider")
    def test_creates_anthropic_provider(self, mock_anthropic_cls, registry):
        config = registry.register_provider(
            _create_request(
                name="Claude",
                provider_type=ProviderType.ANTHROPIC,
                api_key="sk-ant-key",
            )
        )
        mock_instance = MagicMock()
        mock_anthropic_cls.return_value = mock_instance

        result = registry.get_provider_instance(str(config.id))
        assert result is not None
        mock_anthropic_cls.assert_called_once_with(api_key="sk-ant-key")

    @patch("mindflow.providers.ollama.OllamaProvider")
    def test_creates_local_provider(self, mock_ollama_cls, registry):
        config = registry.register_provider(
            _create_request(
                name="Ollama",
                provider_type=ProviderType.LOCAL,
                api_key=None,
                endpoint_url="http://localhost:11434",
            )
        )
        mock_instance = MagicMock()
        mock_ollama_cls.return_value = mock_instance

        result = registry.get_provider_instance(str(config.id))
        assert result is not None
        mock_ollama_cls.assert_called_once_with(endpoint_url="http://localhost:11434")

    @patch("mindflow.providers.gemini.GeminiProvider")
    def test_creates_gemini_provider(self, mock_gemini_cls, registry):
        config = registry.register_provider(
            _create_request(
                name="Gemini",
                provider_type=ProviderType.GEMINI,
                api_key="gemini-key",
            )
        )
        mock_instance = MagicMock()
        mock_gemini_cls.return_value = mock_instance

        result = registry.get_provider_instance(str(config.id))
        assert result is not None
        mock_gemini_cls.assert_called_once_with(api_key="gemini-key")


# ── Persistence ─────────────────────────────────────────────────────


class TestPersistence:
    """Verify that provider configs survive save/load cycles."""

    def test_providers_persist_across_instances(self, tmp_path, secret_storage):
        providers_file = tmp_path / "providers.json"

        reg1 = ProviderRegistry(providers_file=providers_file, secret_storage=secret_storage)
        config = reg1.register_provider(_create_request(name="Persisted"))

        # Create a second registry from the same file
        reg2 = ProviderRegistry(providers_file=providers_file, secret_storage=secret_storage)
        loaded = reg2.get_provider(str(config.id))
        assert loaded is not None
        assert loaded.name == "Persisted"
