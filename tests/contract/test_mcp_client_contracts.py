"""Contract tests for MCP client API endpoints (T051).

Tests the API contract (request/response shapes, status codes) using
FastAPI TestClient. Does NOT test actual MCP server connectivity.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from mindflow.api.server import app
from mindflow.services.mcp_client_manager import MCPClientManager


@pytest.fixture(autouse=True)
def _isolated_manager(tmp_path):
    """Replace the global MCP manager with a fresh instance using temp storage.

    Each test starts with an empty connection list and avoids
    touching real data files.
    """
    manager = MCPClientManager(data_dir=tmp_path)

    with patch("mindflow.api.routes.mcp_connections._manager", manager):
        with patch("mindflow.api.routes.mcp_connections._get_manager", return_value=manager):
            yield manager


@pytest.fixture
def client():
    return TestClient(app)


# ── Helper payloads ─────────────────────────────────────────────────


def _stdio_payload(name: str = "My Stdio Server") -> dict:
    return {
        "name": name,
        "transport_type": "stdio",
        "config": {"command": "npx", "args": ["-y", "some-mcp-server"]},
    }


def _sse_payload(name: str = "My SSE Server") -> dict:
    return {
        "name": name,
        "transport_type": "sse",
        "config": {"url": "http://localhost:3000/sse"},
    }


# ── POST /api/mcp-connections ──────────────────────────────────────


class TestAddConnection:
    """POST /api/mcp-connections — Add a new MCP server connection."""

    def test_returns_422_with_missing_name(self, client: TestClient):
        payload = {"transport_type": "stdio", "config": {}}
        resp = client.post("/api/mcp-connections", json=payload)
        assert resp.status_code == 422

    def test_returns_422_with_missing_transport_type(self, client: TestClient):
        payload = {"name": "No Transport", "config": {}}
        resp = client.post("/api/mcp-connections", json=payload)
        assert resp.status_code == 422

    def test_returns_422_with_invalid_transport_type(self, client: TestClient):
        payload = {"name": "Bad", "transport_type": "websocket", "config": {}}
        resp = client.post("/api/mcp-connections", json=payload)
        assert resp.status_code == 422

    def test_returns_422_with_empty_body(self, client: TestClient):
        resp = client.post("/api/mcp-connections", json={})
        assert resp.status_code == 422

    def test_successful_add_returns_201(self, client: TestClient, _isolated_manager):
        """When _connect succeeds, should return 201 with connection data."""
        with patch.object(_isolated_manager, "_connect", new_callable=AsyncMock):
            resp = client.post("/api/mcp-connections", json=_stdio_payload())

        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Stdio Server"
        assert data["transport_type"] == "stdio"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        assert "status" in data
        assert "discovered_tools" in data
        assert "tool_count" in data

    def test_connection_failure_returns_502(self, client: TestClient, _isolated_manager):
        """When MCP server is unreachable, should return 502."""
        with patch.object(
            _isolated_manager, "_connect",
            new_callable=AsyncMock,
            side_effect=ConnectionError("Connection refused"),
        ):
            resp = client.post("/api/mcp-connections", json=_stdio_payload())

        assert resp.status_code == 502


# ── GET /api/mcp-connections ───────────────────────────────────────


class TestListConnections:
    """GET /api/mcp-connections — List all connections."""

    def test_list_empty(self, client: TestClient):
        resp = client.get("/api/mcp-connections")
        assert resp.status_code == 200
        data = resp.json()
        assert data["connections"] == []

    def test_list_returns_connections(self, client: TestClient, _isolated_manager):
        """After adding connections, list should return them."""
        with patch.object(_isolated_manager, "_connect", new_callable=AsyncMock):
            client.post("/api/mcp-connections", json=_stdio_payload("Server A"))
            client.post("/api/mcp-connections", json=_sse_payload("Server B"))

        resp = client.get("/api/mcp-connections")
        assert resp.status_code == 200
        connections = resp.json()["connections"]
        assert len(connections) == 2

    def test_list_response_shape(self, client: TestClient, _isolated_manager):
        """Each connection in list should have the expected fields."""
        with patch.object(_isolated_manager, "_connect", new_callable=AsyncMock):
            client.post("/api/mcp-connections", json=_stdio_payload())

        resp = client.get("/api/mcp-connections")
        conn = resp.json()["connections"][0]

        expected_fields = {
            "id", "name", "transport_type", "config", "status",
            "discovered_tools", "tool_count", "error_message",
            "created_at", "updated_at",
        }
        assert expected_fields.issubset(set(conn.keys()))


# ── GET /api/mcp-connections/tools ─────────────────────────────────


class TestListAllTools:
    """GET /api/mcp-connections/tools — List all available tools."""

    def test_returns_empty_tools_when_no_connections(self, client: TestClient):
        resp = client.get("/api/mcp-connections/tools")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tools"] == []

    def test_returns_tools_list_structure(self, client: TestClient):
        resp = client.get("/api/mcp-connections/tools")
        assert resp.status_code == 200
        assert "tools" in resp.json()
        assert isinstance(resp.json()["tools"], list)


# ── GET /api/mcp-connections/{id} ──────────────────────────────────


class TestGetConnection:
    """GET /api/mcp-connections/{id} — Get a single connection."""

    def test_returns_404_for_unknown_id(self, client: TestClient):
        resp = client.get("/api/mcp-connections/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404

    def test_returns_connection_for_known_id(self, client: TestClient, _isolated_manager):
        with patch.object(_isolated_manager, "_connect", new_callable=AsyncMock):
            create_resp = client.post("/api/mcp-connections", json=_stdio_payload())
        conn_id = create_resp.json()["id"]

        resp = client.get(f"/api/mcp-connections/{conn_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == conn_id
        assert resp.json()["name"] == "My Stdio Server"


# ── DELETE /api/mcp-connections/{id} ───────────────────────────────


class TestRemoveConnection:
    """DELETE /api/mcp-connections/{id} — Remove a connection."""

    def test_returns_404_for_unknown_id(self, client: TestClient):
        resp = client.delete("/api/mcp-connections/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404

    def test_removes_existing_connection(self, client: TestClient, _isolated_manager):
        with patch.object(_isolated_manager, "_connect", new_callable=AsyncMock):
            create_resp = client.post("/api/mcp-connections", json=_stdio_payload())
        conn_id = create_resp.json()["id"]

        with patch.object(_isolated_manager, "_disconnect", new_callable=AsyncMock):
            resp = client.delete(f"/api/mcp-connections/{conn_id}")

        assert resp.status_code == 200
        assert "message" in resp.json()

        # Verify it's gone
        get_resp = client.get(f"/api/mcp-connections/{conn_id}")
        assert get_resp.status_code == 404
