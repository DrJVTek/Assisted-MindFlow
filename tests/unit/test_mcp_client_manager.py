"""Unit tests for mindflow.services.mcp_client_manager module (T050).

Tests MCPClientManager lifecycle: list, get_all_tools, config persistence.
Uses mocks to avoid actual MCP server connections.
"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mindflow.models.mcp_connection import (
    ConnectionStatus,
    CreateMCPConnectionRequest,
    MCPConnection,
    RemoteMCPTool,
    TransportType,
)
from mindflow.services.mcp_client_manager import MCPClientManager


# ── Fixtures ──────────────────────────────────────────────────


@pytest.fixture
def tmp_data_dir(tmp_path):
    """Provide a temporary data directory for the manager."""
    return tmp_path


@pytest.fixture
def manager(tmp_data_dir):
    """Create a fresh MCPClientManager with temp storage."""
    return MCPClientManager(data_dir=tmp_data_dir)


# ── list_connections ──────────────────────────────────────────


class TestListConnections:
    """Tests for listing connections."""

    def test_returns_empty_list_initially(self, manager):
        result = manager.list_connections()
        assert result == []
        assert isinstance(result, list)

    def test_returns_connections_after_adding(self, manager):
        """Directly inject a connection to verify listing."""
        conn = MCPConnection(
            name="Test",
            transport_type=TransportType.STDIO,
            config={"command": "echo"},
        )
        manager._connections[str(conn.id)] = conn

        result = manager.list_connections()
        assert len(result) == 1
        assert result[0].name == "Test"


# ── get_connection ────────────────────────────────────────────


class TestGetConnection:
    """Tests for getting a single connection."""

    def test_returns_none_for_unknown_id(self, manager):
        assert manager.get_connection("nonexistent-id") is None

    def test_returns_connection_for_known_id(self, manager):
        conn = MCPConnection(
            name="Found",
            transport_type=TransportType.SSE,
            config={"url": "http://localhost:3000"},
        )
        conn_id = str(conn.id)
        manager._connections[conn_id] = conn

        result = manager.get_connection(conn_id)
        assert result is not None
        assert result.name == "Found"


# ── get_all_tools ─────────────────────────────────────────────


class TestGetAllTools:
    """Tests for listing all tools across connections."""

    def test_returns_empty_when_no_connections(self, manager):
        result = manager.get_all_tools()
        assert result == []

    def test_returns_empty_when_connections_disconnected(self, manager):
        conn = MCPConnection(
            name="Disconnected",
            transport_type=TransportType.STDIO,
            status=ConnectionStatus.DISCONNECTED,
            discovered_tools=[RemoteMCPTool(name="tool1")],
        )
        manager._connections[str(conn.id)] = conn

        result = manager.get_all_tools()
        assert result == []

    def test_returns_tools_from_connected_servers(self, manager):
        conn = MCPConnection(
            name="Connected Server",
            transport_type=TransportType.STDIO,
            status=ConnectionStatus.CONNECTED,
            discovered_tools=[
                RemoteMCPTool(name="search", description="Search web"),
                RemoteMCPTool(name="calc", description="Calculator"),
            ],
        )
        manager._connections[str(conn.id)] = conn

        result = manager.get_all_tools()
        assert len(result) == 2
        assert result[0]["name"] == "search"
        assert result[0]["connection_name"] == "Connected Server"
        assert result[1]["name"] == "calc"

    def test_returns_tools_from_multiple_servers(self, manager):
        conn1 = MCPConnection(
            name="Server A",
            transport_type=TransportType.STDIO,
            status=ConnectionStatus.CONNECTED,
            discovered_tools=[RemoteMCPTool(name="toolA")],
        )
        conn2 = MCPConnection(
            name="Server B",
            transport_type=TransportType.SSE,
            status=ConnectionStatus.CONNECTED,
            discovered_tools=[RemoteMCPTool(name="toolB")],
        )
        manager._connections[str(conn1.id)] = conn1
        manager._connections[str(conn2.id)] = conn2

        result = manager.get_all_tools()
        assert len(result) == 2
        names = {t["name"] for t in result}
        assert names == {"toolA", "toolB"}


# ── _load_configs ─────────────────────────────────────────────


class TestLoadConfigs:
    """Tests for loading config from disk."""

    def test_creates_empty_dict_when_no_file(self, tmp_data_dir):
        """When mcp_connections.json does not exist, connections should be empty."""
        mgr = MCPClientManager(data_dir=tmp_data_dir)
        assert mgr._connections == {}

    def test_loads_existing_config(self, tmp_data_dir):
        """Should load connections from a valid config file."""
        config_path = tmp_data_dir / "mcp_connections.json"
        config_data = {
            "connections": [
                {
                    "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                    "name": "Saved Server",
                    "transport_type": "stdio",
                    "config": {"command": "echo"},
                    "created_at": "2025-01-01T00:00:00+00:00",
                    "updated_at": "2025-01-01T00:00:00+00:00",
                }
            ]
        }
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f)

        mgr = MCPClientManager(data_dir=tmp_data_dir)
        assert len(mgr._connections) == 1
        conn = list(mgr._connections.values())[0]
        assert conn.name == "Saved Server"
        # Loaded connections should always start as DISCONNECTED
        assert conn.status == ConnectionStatus.DISCONNECTED
        # Loaded connections should always have empty discovered_tools
        assert conn.discovered_tools == []

    def test_handles_corrupt_config_gracefully(self, tmp_data_dir):
        """Should not crash on invalid JSON."""
        config_path = tmp_data_dir / "mcp_connections.json"
        config_path.write_text("NOT VALID JSON", encoding="utf-8")

        mgr = MCPClientManager(data_dir=tmp_data_dir)
        assert mgr._connections == {}


# ── _save_configs ─────────────────────────────────────────────


class TestSaveConfigs:
    """Tests for saving config to disk."""

    def test_writes_valid_json(self, manager, tmp_data_dir):
        conn = MCPConnection(
            name="Persist Me",
            transport_type=TransportType.SSE,
            config={"url": "http://localhost:3000/sse"},
        )
        manager._connections[str(conn.id)] = conn

        manager._save_configs()

        config_path = tmp_data_dir / "mcp_connections.json"
        assert config_path.exists()

        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert "connections" in data
        assert len(data["connections"]) == 1
        saved = data["connections"][0]
        assert saved["name"] == "Persist Me"
        assert saved["transport_type"] == "sse"
        assert saved["config"]["url"] == "http://localhost:3000/sse"
        assert "id" in saved
        assert "created_at" in saved
        assert "updated_at" in saved

    def test_creates_data_dir_if_missing(self, tmp_path):
        nested_dir = tmp_path / "deep" / "nested" / "dir"
        mgr = MCPClientManager(data_dir=nested_dir)

        conn = MCPConnection(name="T", transport_type=TransportType.STDIO)
        mgr._connections[str(conn.id)] = conn
        mgr._save_configs()

        assert (nested_dir / "mcp_connections.json").exists()

    def test_does_not_save_session_state(self, manager, tmp_data_dir):
        """Saved configs should not include status or discovered_tools."""
        conn = MCPConnection(
            name="Active",
            transport_type=TransportType.STDIO,
            status=ConnectionStatus.CONNECTED,
            discovered_tools=[RemoteMCPTool(name="tool1")],
        )
        manager._connections[str(conn.id)] = conn
        manager._save_configs()

        config_path = tmp_data_dir / "mcp_connections.json"
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        saved = data["connections"][0]
        # status and discovered_tools are session state, not persisted
        assert "status" not in saved
        assert "discovered_tools" not in saved


# ── add_connection (mocked) ───────────────────────────────────


class TestAddConnection:
    """Tests for add_connection with mocked _connect."""

    @pytest.mark.asyncio
    async def test_add_connection_calls_connect(self, manager):
        """add_connection should attempt to connect and save config."""
        with patch.object(manager, "_connect", new_callable=AsyncMock) as mock_connect:
            request = CreateMCPConnectionRequest(
                name="New Server",
                transport_type=TransportType.STDIO,
                config={"command": "echo"},
            )
            conn = await manager.add_connection(request)

            assert conn.name == "New Server"
            assert conn.transport_type == TransportType.STDIO
            assert str(conn.id) in manager._connections
            mock_connect.assert_awaited_once_with(conn)

    @pytest.mark.asyncio
    async def test_add_connection_sets_error_on_failure(self, manager):
        """Should set error status when connection fails."""
        with patch.object(
            manager, "_connect", new_callable=AsyncMock, side_effect=RuntimeError("No server")
        ):
            request = CreateMCPConnectionRequest(
                name="Failing",
                transport_type=TransportType.SSE,
                config={"url": "http://localhost:9999"},
            )
            with pytest.raises(RuntimeError, match="No server"):
                await manager.add_connection(request)

            # Connection should still be stored but with error status
            conn = list(manager._connections.values())[0]
            assert conn.status == ConnectionStatus.ERROR
            assert conn.error_message == "No server"


# ── remove_connection (mocked) ────────────────────────────────


class TestRemoveConnection:
    """Tests for remove_connection with mocked _disconnect."""

    @pytest.mark.asyncio
    async def test_remove_existing_connection(self, manager):
        conn = MCPConnection(name="Remove Me", transport_type=TransportType.STDIO)
        conn_id = str(conn.id)
        manager._connections[conn_id] = conn

        with patch.object(manager, "_disconnect", new_callable=AsyncMock):
            result = await manager.remove_connection(conn_id)

        assert result is True
        assert conn_id not in manager._connections

    @pytest.mark.asyncio
    async def test_remove_nonexistent_returns_false(self, manager):
        result = await manager.remove_connection("nonexistent")
        assert result is False
