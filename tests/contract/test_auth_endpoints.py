"""Contract tests for the deprecated auth API endpoints.

These endpoints (/api/auth/openai/*) are backward-compat wrappers that
delegate to the unified provider OAuth lifecycle. They locate the first
CHATGPT_WEB + OAUTH provider via the provider registry and call the
registry's OAuth methods.

Tests the API contract (request/response shapes) using FastAPI TestClient.
Does NOT test the actual OAuth flow (that requires browser interaction).
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from mindflow.api.server import app
from mindflow.models.provider import (
    AuthMethod,
    CreateProviderRequest,
    ProviderType,
)
from mindflow.services.provider_registry import ProviderRegistry


@pytest.fixture
def registry(tmp_path):
    """Fresh provider registry backed by temp storage.

    The deprecated /api/auth/openai/* routes obtain the registry through
    mindflow.api.routes.providers._get_registry, so patching that (and the
    module-level singleton) routes the wrappers to this isolated instance.
    """
    reg = ProviderRegistry(
        providers_file=tmp_path / "providers.json",
        secret_storage=MagicMock(),
    )
    reg._secret_storage.save_credentials = MagicMock()
    reg._secret_storage.get_credentials = MagicMock(return_value=None)
    reg._secret_storage.delete_credentials = MagicMock(return_value=True)

    with patch("mindflow.api.routes.providers._registry", reg):
        with patch("mindflow.api.routes.providers._get_registry", return_value=reg):
            yield reg


@pytest.fixture
def client():
    return TestClient(app)


def _register_chatgpt_provider(registry: ProviderRegistry) -> str:
    """Register a CHATGPT_WEB OAuth provider and return its id."""
    config = registry.register_provider(
        CreateProviderRequest(
            name="ChatGPT",
            type=ProviderType.CHATGPT_WEB,
            auth_method=AuthMethod.OAUTH,
            color="#10A37F",
        )
    )
    return str(config.id)


class TestLoginEndpoint:
    """POST /api/auth/openai/login"""

    def test_login_returns_connected_on_success(self, client: TestClient, registry):
        _register_chatgpt_provider(registry)

        mock_result = {
            "status": "connected",
            "subscription_tier": "plus",
            "user_email": "user@example.com",
        }
        with patch.object(
            registry,
            "start_oauth_login",
            new=AsyncMock(return_value=mock_result),
        ):
            response = client.post("/api/auth/openai/login")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "connected"
        assert data["subscription_tier"] == "plus"
        assert data["user_email"] == "user@example.com"

    def test_login_returns_404_when_no_chatgpt_provider(self, client: TestClient, registry):
        """With no ChatGPT provider registered, the wrapper returns 404.

        (The legacy 409 "flow already in progress" status no longer exists:
        an in-progress flow now surfaces as a registry error result, and the
        relevant client-facing error path is the missing-provider 404.)
        """
        response = client.post("/api/auth/openai/login")
        assert response.status_code == 404


class TestStatusEndpoint:
    """GET /api/auth/openai/status"""

    def test_status_returns_not_connected(self, client: TestClient, registry):
        # No ChatGPT provider registered -> wrapper reports not_connected.
        response = client.get("/api/auth/openai/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "not_connected"
        assert data["auth_method"] == "chatgpt_oauth"

    def test_status_returns_connected_with_session_info(self, client: TestClient, registry):
        _register_chatgpt_provider(registry)

        with patch.object(
            registry,
            "get_oauth_status",
            return_value={
                "status": "connected",
                "subscription_tier": "plus",
                "user_email": "user@example.com",
                "expires_at": "2026-03-13T20:00:00+00:00",
            },
        ):
            response = client.get("/api/auth/openai/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "connected"
        assert data["subscription_tier"] == "plus"
        assert data["user_email"] == "user@example.com"

    def test_status_returns_session_expired(self, client: TestClient, registry):
        _register_chatgpt_provider(registry)

        with patch.object(
            registry,
            "get_oauth_status",
            return_value={
                "status": "session_expired",
                "needs_reauth": True,
                "user_email": "user@example.com",
                "subscription_tier": "plus",
            },
        ):
            response = client.get("/api/auth/openai/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "session_expired"
        assert data["needs_reauth"] is True


class TestLogoutEndpoint:
    """POST /api/auth/openai/logout"""

    def test_logout_clears_session(self, client: TestClient, registry):
        _register_chatgpt_provider(registry)

        with patch.object(
            registry,
            "oauth_logout",
            return_value={
                "status": "signed_out",
                "message": "ChatGPT session cleared.",
            },
        ):
            response = client.post("/api/auth/openai/logout")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "signed_out"
        assert data["message"] == "ChatGPT session cleared."
