"""Contract tests for provider API endpoints.

Tests the API contract (request/response shapes, status codes, credential hiding)
using FastAPI TestClient. Does NOT test actual LLM connectivity.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from mindflow.api.server import app
from mindflow.models.provider import ProviderStatus, ProviderType
from mindflow.services.provider_registry import ProviderRegistry


@pytest.fixture(autouse=True)
def _isolated_registry(tmp_path):
    """Replace the global registry with a fresh instance using temp storage.

    This ensures each test starts with an empty provider list and avoids
    touching the real data/providers.json or data/secrets directory.
    """
    registry = ProviderRegistry(
        providers_file=tmp_path / "providers.json",
        secret_storage=MagicMock(),
    )
    # SecretStorage mocks — save/get/delete are no-ops by default
    registry._secret_storage.save_credentials = MagicMock()
    registry._secret_storage.get_credentials = MagicMock(return_value=None)
    registry._secret_storage.delete_credentials = MagicMock(return_value=True)

    with patch("mindflow.api.routes.providers._registry", registry):
        with patch("mindflow.api.routes.providers._get_registry", return_value=registry):
            yield registry


@pytest.fixture
def client():
    return TestClient(app)


# ── Helper payloads ─────────────────────────────────────────────────


def _openai_payload(name: str = "My OpenAI") -> dict:
    return {
        "name": name,
        "type": "openai",
        "color": "#10A37F",
        "api_key": "sk-test-key-12345",
    }


def _anthropic_payload(name: str = "My Claude") -> dict:
    return {
        "name": name,
        "type": "anthropic",
        "color": "#6B4FBB",
        "api_key": "sk-ant-test-key",
    }


def _local_payload(name: str = "Ollama") -> dict:
    return {
        "name": name,
        "type": "local",
        "color": "#333333",
        "endpoint_url": "http://localhost:11434",
    }


# ── POST /api/providers ─────────────────────────────────────────────


class TestCreateProvider:
    """POST /api/providers — Register a new provider."""

    def test_create_openai_provider(self, client: TestClient):
        resp = client.post("/api/providers", json=_openai_payload())
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My OpenAI"
        assert data["type"] == "openai"
        assert data["color"] == "#10A37F"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_anthropic_provider(self, client: TestClient):
        resp = client.post("/api/providers", json=_anthropic_payload())
        assert resp.status_code == 201
        assert resp.json()["type"] == "anthropic"

    def test_create_local_provider(self, client: TestClient):
        resp = client.post("/api/providers", json=_local_payload())
        assert resp.status_code == 201
        data = resp.json()
        assert data["type"] == "local"
        assert data["endpoint_url"] == "http://localhost:11434"

    def test_create_provider_never_returns_api_key(self, client: TestClient):
        resp = client.post("/api/providers", json=_openai_payload())
        assert resp.status_code == 201
        data = resp.json()
        assert "api_key" not in data
        assert "oauth_token" not in data
        assert "credentials" not in data

    def test_create_provider_missing_name_returns_422(self, client: TestClient):
        payload = {"type": "openai", "color": "#10A37F"}
        resp = client.post("/api/providers", json=payload)
        assert resp.status_code == 422

    def test_create_provider_invalid_color_returns_422(self, client: TestClient):
        payload = _openai_payload()
        payload["color"] = "not-a-color"
        resp = client.post("/api/providers", json=payload)
        assert resp.status_code == 422

    def test_create_provider_invalid_type_returns_422(self, client: TestClient):
        payload = _openai_payload()
        payload["type"] = "unknown_provider"
        resp = client.post("/api/providers", json=payload)
        assert resp.status_code == 422


# ── GET /api/providers ──────────────────────────────────────────────


class TestListProviders:
    """GET /api/providers — List all providers."""

    def test_list_empty(self, client: TestClient):
        resp = client.get("/api/providers")
        assert resp.status_code == 200
        data = resp.json()
        assert data["providers"] == []

    def test_list_after_create(self, client: TestClient):
        client.post("/api/providers", json=_openai_payload())
        client.post("/api/providers", json=_anthropic_payload())

        resp = client.get("/api/providers")
        assert resp.status_code == 200
        providers = resp.json()["providers"]
        assert len(providers) == 2

    def test_list_never_returns_credentials(self, client: TestClient):
        client.post("/api/providers", json=_openai_payload())
        resp = client.get("/api/providers")
        for provider in resp.json()["providers"]:
            assert "api_key" not in provider
            assert "oauth_token" not in provider
            assert "credentials" not in provider


# ── GET /api/providers/{id} ─────────────────────────────────────────


class TestGetProvider:
    """GET /api/providers/{id} — Get a single provider."""

    def test_get_existing_provider(self, client: TestClient):
        create_resp = client.post("/api/providers", json=_openai_payload())
        provider_id = create_resp.json()["id"]

        resp = client.get(f"/api/providers/{provider_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == provider_id
        assert resp.json()["name"] == "My OpenAI"

    def test_get_nonexistent_provider_returns_404(self, client: TestClient):
        resp = client.get("/api/providers/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404

    def test_get_provider_never_returns_credentials(self, client: TestClient):
        create_resp = client.post("/api/providers", json=_openai_payload())
        provider_id = create_resp.json()["id"]

        resp = client.get(f"/api/providers/{provider_id}")
        data = resp.json()
        assert "api_key" not in data
        assert "oauth_token" not in data


# ── PUT /api/providers/{id} ─────────────────────────────────────────


class TestUpdateProvider:
    """PUT /api/providers/{id} — Update provider name/color."""

    def test_update_name(self, client: TestClient):
        create_resp = client.post("/api/providers", json=_openai_payload())
        provider_id = create_resp.json()["id"]

        resp = client.put(
            f"/api/providers/{provider_id}",
            json={"name": "Renamed OpenAI"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed OpenAI"

    def test_update_color(self, client: TestClient):
        create_resp = client.post("/api/providers", json=_openai_payload())
        provider_id = create_resp.json()["id"]

        resp = client.put(
            f"/api/providers/{provider_id}",
            json={"color": "#FF0000"},
        )
        assert resp.status_code == 200
        assert resp.json()["color"] == "#FF0000"

    def test_update_nonexistent_returns_404(self, client: TestClient):
        resp = client.put(
            "/api/providers/00000000-0000-0000-0000-000000000000",
            json={"name": "No Such"},
        )
        assert resp.status_code == 404

    def test_update_never_returns_credentials(self, client: TestClient):
        create_resp = client.post("/api/providers", json=_openai_payload())
        provider_id = create_resp.json()["id"]

        resp = client.put(
            f"/api/providers/{provider_id}",
            json={"name": "Updated"},
        )
        data = resp.json()
        assert "api_key" not in data
        assert "oauth_token" not in data


# ── DELETE /api/providers/{id} ──────────────────────────────────────


class TestDeleteProvider:
    """DELETE /api/providers/{id} — Delete a provider."""

    def test_delete_existing_provider(self, client: TestClient):
        create_resp = client.post("/api/providers", json=_openai_payload())
        provider_id = create_resp.json()["id"]

        resp = client.delete(f"/api/providers/{provider_id}")
        assert resp.status_code == 200
        assert "message" in resp.json()

        # Verify it's gone
        get_resp = client.get(f"/api/providers/{provider_id}")
        assert get_resp.status_code == 404

    def test_delete_nonexistent_returns_404(self, client: TestClient):
        resp = client.delete("/api/providers/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


# ── POST /api/providers/{id}/validate ───────────────────────────────


class TestValidateProvider:
    """POST /api/providers/{id}/validate — Re-validate provider."""

    def test_validate_nonexistent_returns_404(self, client: TestClient):
        resp = client.post(
            "/api/providers/00000000-0000-0000-0000-000000000000/validate"
        )
        assert resp.status_code == 404

    def test_validate_returns_status_and_models(self, client: TestClient, _isolated_registry):
        """Validate returns status + available_models when provider instance works."""
        create_resp = client.post("/api/providers", json=_anthropic_payload())
        provider_id = create_resp.json()["id"]

        mock_provider = MagicMock()
        _isolated_registry._secret_storage.get_credentials = MagicMock(
            return_value=MagicMock(api_key="sk-test", oauth_token=None)
        )

        with patch.object(
            _isolated_registry,
            "get_provider_instance",
            return_value=mock_provider,
        ):
            with patch(
                "mindflow.api.routes.providers._discover_models",
                new_callable=AsyncMock,
                return_value=["claude-sonnet-4-20250514"],
            ):
                resp = client.post(f"/api/providers/{provider_id}/validate")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ["connected", "disconnected", "error", "rate_limited"]
        assert "available_models" in data

    def test_validate_no_instance_returns_502(self, client: TestClient, _isolated_registry):
        """Validate returns 502 when provider instance cannot be created."""
        create_resp = client.post("/api/providers", json=_openai_payload())
        provider_id = create_resp.json()["id"]

        with patch.object(
            _isolated_registry,
            "get_provider_instance",
            return_value=None,
        ):
            resp = client.post(f"/api/providers/{provider_id}/validate")

        assert resp.status_code == 502


# ── Credential hiding (cross-cutting) ──────────────────────────────


class TestCredentialHiding:
    """Verify that API never leaks credentials in any endpoint response."""

    SENSITIVE_KEYS = {"api_key", "oauth_token", "refresh_token", "credentials", "secret"}

    def _assert_no_credentials(self, data: dict):
        for key in self.SENSITIVE_KEYS:
            assert key not in data, f"Response contains sensitive key: {key}"

    def test_all_endpoints_hide_credentials(self, client: TestClient):
        # Create
        create_resp = client.post("/api/providers", json=_openai_payload())
        self._assert_no_credentials(create_resp.json())

        provider_id = create_resp.json()["id"]

        # Get single
        get_resp = client.get(f"/api/providers/{provider_id}")
        self._assert_no_credentials(get_resp.json())

        # List
        list_resp = client.get("/api/providers")
        for p in list_resp.json()["providers"]:
            self._assert_no_credentials(p)

        # Update
        update_resp = client.put(
            f"/api/providers/{provider_id}",
            json={"name": "Updated"},
        )
        self._assert_no_credentials(update_resp.json())
