"""Unit tests for ProviderConfig model."""

import pytest
from uuid import uuid4

from mindflow.models.provider import (
    CreateProviderRequest,
    ProviderConfig,
    ProviderCredentials,
    ProviderStatus,
    ProviderType,
    UpdateProviderRequest,
)


class TestProviderConfig:
    """Tests for ProviderConfig model validation and behavior."""

    def test_create_valid_provider(self):
        """Should create a provider with all required fields."""
        config = ProviderConfig(
            name="My Claude",
            type=ProviderType.ANTHROPIC,
            color="#6B4FBB",
        )
        assert config.name == "My Claude"
        assert config.type == ProviderType.ANTHROPIC
        assert config.color == "#6B4FBB"
        assert config.status == ProviderStatus.DISCONNECTED
        assert config.id is not None
        assert config.available_models == []

    def test_uuid_auto_generated(self):
        """Each provider should get a unique ID."""
        p1 = ProviderConfig(name="A", type=ProviderType.OPENAI, color="#10A37F")
        p2 = ProviderConfig(name="B", type=ProviderType.OPENAI, color="#10A37F")
        assert p1.id != p2.id

    def test_invalid_color_rejected(self):
        """Should reject invalid hex color codes."""
        with pytest.raises(Exception):
            ProviderConfig(name="Bad", type=ProviderType.OPENAI, color="not-a-color")

    def test_valid_short_color(self):
        """Should accept 3-char hex colors."""
        config = ProviderConfig(name="Short", type=ProviderType.OPENAI, color="#F00")
        assert config.color == "#F00"

    def test_empty_name_rejected(self):
        """Should reject empty names."""
        with pytest.raises(Exception):
            ProviderConfig(name="", type=ProviderType.OPENAI, color="#000")

    def test_long_name_rejected(self):
        """Should reject names over 100 characters."""
        with pytest.raises(Exception):
            ProviderConfig(name="x" * 101, type=ProviderType.OPENAI, color="#000")

    def test_local_provider_requires_endpoint(self):
        """Local providers must have an endpoint_url."""
        with pytest.raises(Exception):
            ProviderConfig(
                name="Local",
                type=ProviderType.LOCAL,
                color="#888",
                endpoint_url=None,
            )

    def test_local_provider_with_endpoint(self):
        """Local providers should work with endpoint_url."""
        config = ProviderConfig(
            name="My Ollama",
            type=ProviderType.LOCAL,
            color="#888",
            endpoint_url="http://localhost:11434",
        )
        assert config.endpoint_url == "http://localhost:11434"

    def test_non_local_no_endpoint_required(self):
        """Non-local providers don't need endpoint_url."""
        config = ProviderConfig(
            name="Cloud",
            type=ProviderType.ANTHROPIC,
            color="#6B4FBB",
        )
        assert config.endpoint_url is None

    def test_status_transitions(self):
        """Should allow status changes."""
        config = ProviderConfig(name="Test", type=ProviderType.OPENAI, color="#000")
        assert config.status == ProviderStatus.DISCONNECTED

        config.status = ProviderStatus.CONNECTED
        assert config.status == ProviderStatus.CONNECTED

        config.status = ProviderStatus.ERROR
        assert config.status == ProviderStatus.ERROR

        config.status = ProviderStatus.RATE_LIMITED
        assert config.status == ProviderStatus.RATE_LIMITED

    def test_update_timestamp(self):
        """update_timestamp should change updated_at."""
        config = ProviderConfig(name="Test", type=ProviderType.OPENAI, color="#000")
        original = config.updated_at
        config.update_timestamp()
        assert config.updated_at >= original

    def test_all_provider_types(self):
        """Should support all defined provider types."""
        for ptype in ProviderType:
            kwargs = {"name": f"Test {ptype.value}", "type": ptype, "color": "#000"}
            if ptype == ProviderType.LOCAL:
                kwargs["endpoint_url"] = "http://localhost:11434"
            config = ProviderConfig(**kwargs)
            assert config.type == ptype

    def test_serialization_roundtrip(self):
        """Should serialize to JSON and back."""
        config = ProviderConfig(
            name="Serialize Test",
            type=ProviderType.GEMINI,
            color="#4285F4",
            selected_model="gemini-pro",
            available_models=["gemini-pro", "gemini-ultra"],
        )
        data = config.model_dump(mode="json")
        restored = ProviderConfig(**data)
        assert restored.name == config.name
        assert restored.type == config.type
        assert restored.color == config.color
        assert restored.available_models == config.available_models


class TestProviderCredentials:
    """Tests for ProviderCredentials model."""

    def test_create_with_api_key(self):
        """Should store API key."""
        creds = ProviderCredentials(provider_id=uuid4(), api_key="sk-test")
        assert creds.api_key == "sk-test"
        assert creds.oauth_token is None

    def test_create_with_oauth(self):
        """Should store OAuth token."""
        creds = ProviderCredentials(provider_id=uuid4(), oauth_token="oauth-123")
        assert creds.oauth_token == "oauth-123"
        assert creds.api_key is None


class TestCreateProviderRequest:
    """Tests for CreateProviderRequest validation."""

    def test_valid_request(self):
        """Should accept valid creation requests."""
        req = CreateProviderRequest(
            name="My GPT",
            type=ProviderType.OPENAI,
            color="#10A37F",
            api_key="sk-test",
        )
        assert req.name == "My GPT"

    def test_invalid_color(self):
        """Should reject invalid colors in requests."""
        with pytest.raises(Exception):
            CreateProviderRequest(
                name="Bad", type=ProviderType.OPENAI, color="red"
            )
