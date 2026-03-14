"""Unit tests for mindflow.models.mcp_connection module (T049).

Tests MCPConnection, TransportType, ConnectionStatus, RemoteMCPTool,
and CreateMCPConnectionRequest models.
"""

import time
from datetime import datetime, timezone
from uuid import UUID

import pytest
from pydantic import ValidationError

from mindflow.models.mcp_connection import (
    ConnectionStatus,
    CreateMCPConnectionRequest,
    MCPConnection,
    RemoteMCPTool,
    TransportType,
)


# ── TransportType Enum ────────────────────────────────────────


class TestTransportType:
    """Tests for the TransportType enum."""

    def test_enum_values(self):
        assert TransportType.STDIO == "stdio"
        assert TransportType.SSE == "sse"
        assert TransportType.STREAMABLE_HTTP == "streamable_http"

    def test_enum_member_count(self):
        assert len(TransportType) == 3

    def test_is_str_subclass(self):
        """TransportType should be a string enum for JSON serialization."""
        assert isinstance(TransportType.STDIO, str)
        assert isinstance(TransportType.SSE, str)
        assert isinstance(TransportType.STREAMABLE_HTTP, str)


# ── ConnectionStatus Enum ─────────────────────────────────────


class TestConnectionStatus:
    """Tests for the ConnectionStatus enum."""

    def test_enum_values(self):
        assert ConnectionStatus.DISCONNECTED == "disconnected"
        assert ConnectionStatus.CONNECTING == "connecting"
        assert ConnectionStatus.CONNECTED == "connected"
        assert ConnectionStatus.ERROR == "error"

    def test_enum_member_count(self):
        assert len(ConnectionStatus) == 4

    def test_is_str_subclass(self):
        assert isinstance(ConnectionStatus.DISCONNECTED, str)


# ── RemoteMCPTool ─────────────────────────────────────────────


class TestRemoteMCPTool:
    """Tests for RemoteMCPTool model."""

    def test_create_with_all_fields(self):
        tool = RemoteMCPTool(
            name="search",
            description="Search the web",
            input_schema={"type": "object", "properties": {"query": {"type": "string"}}},
        )
        assert tool.name == "search"
        assert tool.description == "Search the web"
        assert "properties" in tool.input_schema

    def test_create_with_defaults(self):
        tool = RemoteMCPTool(name="ping")
        assert tool.name == "ping"
        assert tool.description == ""
        assert tool.input_schema == {}

    def test_name_required(self):
        with pytest.raises(ValidationError):
            RemoteMCPTool()

    def test_serialization_roundtrip(self):
        tool = RemoteMCPTool(
            name="calc",
            description="Calculator",
            input_schema={"type": "object"},
        )
        data = tool.model_dump(mode="json")
        restored = RemoteMCPTool(**data)
        assert restored.name == tool.name
        assert restored.description == tool.description
        assert restored.input_schema == tool.input_schema


# ── MCPConnection ─────────────────────────────────────────────


class TestMCPConnection:
    """Tests for MCPConnection model creation and behavior."""

    def test_creation_with_defaults(self):
        conn = MCPConnection(
            name="My Server",
            transport_type=TransportType.STDIO,
        )
        assert conn.name == "My Server"
        assert conn.transport_type == TransportType.STDIO
        assert conn.status == ConnectionStatus.DISCONNECTED
        assert conn.config == {}
        assert conn.discovered_tools == []
        assert conn.error_message is None
        assert isinstance(conn.id, UUID)
        assert isinstance(conn.created_at, datetime)
        assert isinstance(conn.updated_at, datetime)

    def test_uuid_auto_generation(self):
        c1 = MCPConnection(name="A", transport_type=TransportType.SSE)
        c2 = MCPConnection(name="B", transport_type=TransportType.SSE)
        assert c1.id != c2.id

    def test_timestamps_auto_generated(self):
        before = datetime.now(timezone.utc)
        conn = MCPConnection(name="T", transport_type=TransportType.STDIO)
        after = datetime.now(timezone.utc)

        assert before <= conn.created_at <= after
        assert before <= conn.updated_at <= after

    def test_touch_updates_updated_at(self):
        conn = MCPConnection(name="T", transport_type=TransportType.STDIO)
        original = conn.updated_at

        time.sleep(0.01)
        conn.touch()

        assert conn.updated_at > original

    def test_touch_does_not_change_created_at(self):
        conn = MCPConnection(name="T", transport_type=TransportType.STDIO)
        original_created = conn.created_at

        time.sleep(0.01)
        conn.touch()

        assert conn.created_at == original_created

    def test_stdio_transport_config(self):
        """STDIO transport should accept command and args in config."""
        conn = MCPConnection(
            name="Stdio Server",
            transport_type=TransportType.STDIO,
            config={"command": "npx", "args": ["-y", "@modelcontextprotocol/server-everything"]},
        )
        assert conn.config["command"] == "npx"
        assert conn.config["args"] == ["-y", "@modelcontextprotocol/server-everything"]

    def test_sse_transport_config(self):
        """SSE transport should accept url in config."""
        conn = MCPConnection(
            name="SSE Server",
            transport_type=TransportType.SSE,
            config={"url": "http://localhost:3000/sse"},
        )
        assert conn.config["url"] == "http://localhost:3000/sse"

    def test_streamable_http_transport_config(self):
        """Streamable HTTP transport should accept url in config."""
        conn = MCPConnection(
            name="HTTP Server",
            transport_type=TransportType.STREAMABLE_HTTP,
            config={"url": "http://localhost:3000/mcp"},
        )
        assert conn.config["url"] == "http://localhost:3000/mcp"

    def test_status_transitions(self):
        conn = MCPConnection(name="T", transport_type=TransportType.STDIO)
        assert conn.status == ConnectionStatus.DISCONNECTED

        conn.status = ConnectionStatus.CONNECTING
        assert conn.status == ConnectionStatus.CONNECTING

        conn.status = ConnectionStatus.CONNECTED
        assert conn.status == ConnectionStatus.CONNECTED

        conn.status = ConnectionStatus.ERROR
        assert conn.status == ConnectionStatus.ERROR

    def test_discovered_tools_storage(self):
        tools = [
            RemoteMCPTool(name="search", description="Search"),
            RemoteMCPTool(name="calc", description="Calculate"),
        ]
        conn = MCPConnection(
            name="T",
            transport_type=TransportType.STDIO,
            discovered_tools=tools,
        )
        assert len(conn.discovered_tools) == 2
        assert conn.discovered_tools[0].name == "search"
        assert conn.discovered_tools[1].name == "calc"

    def test_error_message_storage(self):
        conn = MCPConnection(
            name="T",
            transport_type=TransportType.STDIO,
            status=ConnectionStatus.ERROR,
            error_message="Connection refused",
        )
        assert conn.error_message == "Connection refused"

    def test_serialization_roundtrip(self):
        conn = MCPConnection(
            name="Roundtrip",
            transport_type=TransportType.SSE,
            config={"url": "http://example.com/sse"},
            discovered_tools=[RemoteMCPTool(name="tool1")],
        )
        data = conn.model_dump(mode="json")
        restored = MCPConnection(**data)
        assert restored.name == conn.name
        assert restored.transport_type == conn.transport_type
        assert restored.config == conn.config
        assert len(restored.discovered_tools) == 1


# ── CreateMCPConnectionRequest ────────────────────────────────


class TestCreateMCPConnectionRequest:
    """Tests for CreateMCPConnectionRequest validation."""

    def test_valid_stdio_request(self):
        req = CreateMCPConnectionRequest(
            name="My MCP",
            transport_type=TransportType.STDIO,
            config={"command": "npx", "args": ["-y", "some-server"]},
        )
        assert req.name == "My MCP"
        assert req.transport_type == TransportType.STDIO
        assert req.config["command"] == "npx"

    def test_valid_sse_request(self):
        req = CreateMCPConnectionRequest(
            name="SSE MCP",
            transport_type=TransportType.SSE,
            config={"url": "http://localhost:3000/sse"},
        )
        assert req.transport_type == TransportType.SSE

    def test_valid_streamable_http_request(self):
        req = CreateMCPConnectionRequest(
            name="HTTP MCP",
            transport_type=TransportType.STREAMABLE_HTTP,
            config={"url": "http://localhost:3000/mcp"},
        )
        assert req.transport_type == TransportType.STREAMABLE_HTTP

    def test_default_config_is_empty_dict(self):
        req = CreateMCPConnectionRequest(
            name="Minimal",
            transport_type=TransportType.STDIO,
        )
        assert req.config == {}

    def test_missing_name_raises(self):
        with pytest.raises(ValidationError):
            CreateMCPConnectionRequest(transport_type=TransportType.STDIO)

    def test_missing_transport_type_raises(self):
        with pytest.raises(ValidationError):
            CreateMCPConnectionRequest(name="No Transport")

    def test_invalid_transport_type_raises(self):
        with pytest.raises(ValidationError):
            CreateMCPConnectionRequest(
                name="Bad",
                transport_type="websocket",
            )
