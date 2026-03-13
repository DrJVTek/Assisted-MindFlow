"""Contract tests for auth API endpoints.

Tests the API contract (request/response shapes) using FastAPI TestClient.
Does NOT test actual OAuth flow (that requires browser interaction).
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from mindflow.api.server import app


@pytest.fixture
def client():
    return TestClient(app)


class TestLoginEndpoint:
    """POST /api/auth/openai/login"""

    def test_login_returns_connected_on_success(self, client: TestClient):
        mock_result = {
            "status": "connected",
            "subscription_tier": "plus",
            "user_email": "user@example.com",
        }
        with patch("mindflow.api.routes.auth._oauth_service") as mock_service:
            mock_service.flow_in_progress = False
            mock_service.start_login_flow = MagicMock()

            # Make the async mock work with TestClient
            import asyncio

            async def mock_login():
                return mock_result

            mock_service.start_login_flow = MagicMock(side_effect=lambda: asyncio.coroutine(lambda: mock_result)())

            # Use a simpler approach: patch the route function
            with patch("mindflow.api.routes.auth.get_oauth_service") as mock_get:
                mock_svc = MagicMock()
                mock_svc.flow_in_progress = False

                async def async_login():
                    return mock_result

                mock_svc.start_login_flow = async_login
                mock_get.return_value = mock_svc

                response = client.post("/api/auth/openai/login")

                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "connected"
                assert data["subscription_tier"] == "plus"
                assert data["user_email"] == "user@example.com"

    def test_login_returns_409_when_flow_in_progress(self, client: TestClient):
        with patch("mindflow.api.routes.auth.get_oauth_service") as mock_get:
            mock_svc = MagicMock()
            mock_svc.flow_in_progress = True
            mock_get.return_value = mock_svc

            response = client.post("/api/auth/openai/login")
            assert response.status_code == 409


class TestStatusEndpoint:
    """GET /api/auth/openai/status"""

    def test_status_returns_not_connected(self, client: TestClient):
        with patch("mindflow.api.routes.auth.get_oauth_service") as mock_get:
            mock_svc = MagicMock()
            mock_svc.flow_in_progress = False
            mock_svc.get_session_status.return_value = {"status": "not_connected"}
            mock_get.return_value = mock_svc

            response = client.get("/api/auth/openai/status")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "not_connected"
            assert data["auth_method"] == "chatgpt_oauth"

    def test_status_returns_connected_with_session_info(self, client: TestClient):
        with patch("mindflow.api.routes.auth.get_oauth_service") as mock_get:
            mock_svc = MagicMock()
            mock_svc.flow_in_progress = False
            mock_svc.get_session_status.return_value = {
                "status": "connected",
                "subscription_tier": "plus",
                "user_email": "user@example.com",
                "expires_at": "2026-03-13T20:00:00+00:00",
            }
            mock_get.return_value = mock_svc

            response = client.get("/api/auth/openai/status")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "connected"
            assert data["subscription_tier"] == "plus"
            assert data["user_email"] == "user@example.com"

    def test_status_returns_session_expired(self, client: TestClient):
        with patch("mindflow.api.routes.auth.get_oauth_service") as mock_get:
            mock_svc = MagicMock()
            mock_svc.flow_in_progress = False
            mock_svc.get_session_status.return_value = {
                "status": "session_expired",
                "needs_reauth": True,
                "user_email": "user@example.com",
                "subscription_tier": "plus",
            }
            mock_get.return_value = mock_svc

            response = client.get("/api/auth/openai/status")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "session_expired"
            assert data["needs_reauth"] is True


class TestLogoutEndpoint:
    """POST /api/auth/openai/logout"""

    def test_logout_clears_session(self, client: TestClient):
        with patch("mindflow.api.routes.auth.get_oauth_service") as mock_get:
            mock_svc = MagicMock()
            mock_svc.logout.return_value = {
                "status": "signed_out",
                "message": "ChatGPT session cleared.",
            }
            mock_get.return_value = mock_svc

            response = client.post("/api/auth/openai/logout")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "signed_out"
            assert data["message"] == "ChatGPT session cleared."
