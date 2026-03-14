"""MCP Client Manager (Feature 011 - US5).

Manages outbound MCP client connections to external MCP servers.
Handles connection lifecycle, tool discovery, and tool invocation.
Persists connection configs to data/mcp_connections.json.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID

from mindflow.models.mcp_connection import (
    ConnectionStatus,
    CreateMCPConnectionRequest,
    MCPConnection,
    RemoteMCPTool,
    TransportType,
)
from mindflow.utils.paths import get_data_dir

logger = logging.getLogger(__name__)


class MCPClientManager:
    """Manages outbound MCP client connections."""

    def __init__(self, data_dir: Optional[Path] = None):
        self._data_dir = data_dir or get_data_dir()
        self._config_path = self._data_dir / "mcp_connections.json"
        self._connections: Dict[str, MCPConnection] = {}
        self._sessions: Dict[str, Any] = {}  # Active MCP client sessions
        self._load_configs()

    def _load_configs(self) -> None:
        """Load connection configs from disk."""
        if self._config_path.exists():
            try:
                with open(self._config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for item in data.get("connections", []):
                    conn = MCPConnection(**item)
                    conn.status = ConnectionStatus.DISCONNECTED
                    conn.discovered_tools = []
                    self._connections[str(conn.id)] = conn
            except Exception as exc:
                logger.error("Failed to load MCP connections: %s", exc)

    def _save_configs(self) -> None:
        """Persist connection configs to disk (without session state)."""
        data = {
            "connections": [
                {
                    "id": str(conn.id),
                    "name": conn.name,
                    "transport_type": conn.transport_type.value,
                    "config": conn.config,
                    "created_at": conn.created_at.isoformat(),
                    "updated_at": conn.updated_at.isoformat(),
                }
                for conn in self._connections.values()
            ]
        }
        self._data_dir.mkdir(parents=True, exist_ok=True)
        with open(self._config_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def list_connections(self) -> List[MCPConnection]:
        """List all connections."""
        return list(self._connections.values())

    def get_connection(self, connection_id: str) -> Optional[MCPConnection]:
        """Get a connection by ID."""
        return self._connections.get(connection_id)

    async def add_connection(self, request: CreateMCPConnectionRequest) -> MCPConnection:
        """Add and connect to a new MCP server.

        Creates the connection config, attempts to connect, and discovers tools.
        """
        conn = MCPConnection(
            name=request.name,
            transport_type=request.transport_type,
            config=request.config,
            status=ConnectionStatus.CONNECTING,
        )
        self._connections[str(conn.id)] = conn

        # Attempt to connect and discover tools
        try:
            await self._connect(conn)
            self._save_configs()
        except Exception as exc:
            conn.status = ConnectionStatus.ERROR
            conn.error_message = str(exc)
            conn.touch()
            self._save_configs()
            raise

        return conn

    async def remove_connection(self, connection_id: str) -> bool:
        """Disconnect and remove a connection."""
        conn = self._connections.get(connection_id)
        if conn is None:
            return False

        # Disconnect active session
        await self._disconnect(connection_id)

        del self._connections[connection_id]
        self._save_configs()
        return True

    async def refresh_tools(self, connection_id: str) -> MCPConnection:
        """Re-discover tools from a connected MCP server."""
        conn = self._connections.get(connection_id)
        if conn is None:
            raise ValueError("Connection not found")

        # Reconnect if disconnected
        if conn.status != ConnectionStatus.CONNECTED:
            await self._connect(conn)

        return conn

    def get_all_tools(self) -> List[Dict[str, Any]]:
        """List all tools across all connected MCP servers."""
        tools = []
        for conn in self._connections.values():
            if conn.status == ConnectionStatus.CONNECTED:
                for tool in conn.discovered_tools:
                    tools.append({
                        "connection_id": str(conn.id),
                        "connection_name": conn.name,
                        "name": tool.name,
                        "description": tool.description,
                        "input_schema": tool.input_schema,
                    })
        return tools

    async def invoke_tool(
        self,
        connection_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Invoke a tool on a connected MCP server."""
        conn = self._connections.get(connection_id)
        if conn is None:
            raise ValueError("Connection not found")
        if conn.status != ConnectionStatus.CONNECTED:
            raise ValueError(f"Connection is not active (status: {conn.status.value})")

        session = self._sessions.get(connection_id)
        if session is None:
            raise ValueError("No active session for this connection")

        try:
            result = await session.call_tool(tool_name, arguments)
            # Extract text content from result
            text_parts = []
            if hasattr(result, 'content'):
                for item in result.content:
                    if hasattr(item, 'text'):
                        text_parts.append(item.text)
            return {
                "result": "\n".join(text_parts) if text_parts else str(result),
                "is_error": getattr(result, 'isError', False),
            }
        except Exception as exc:
            return {
                "result": str(exc),
                "is_error": True,
            }

    async def _connect(self, conn: MCPConnection) -> None:
        """Establish connection to an MCP server and discover tools."""
        from mcp import ClientSession

        conn.status = ConnectionStatus.CONNECTING
        conn.touch()

        try:
            if conn.transport_type == TransportType.STDIO:
                from mcp.client.stdio import stdio_client

                command = conn.config.get("command", "")
                args = conn.config.get("args", [])

                # Security: reject shell metacharacters in command/args
                _SHELL_CHARS = set(";|&$`\\><!()")
                if any(c in command for c in _SHELL_CHARS):
                    raise ValueError(f"Command contains disallowed shell characters: {command}")
                for arg in args:
                    if any(c in str(arg) for c in _SHELL_CHARS):
                        raise ValueError(f"Argument contains disallowed shell characters: {arg}")

                server_params = {
                    "command": command,
                    "args": args,
                }

                # Create stdio transport
                read_stream, write_stream = await stdio_client(**server_params).__aenter__()
                session = ClientSession(read_stream, write_stream)
                await session.__aenter__()
                await session.initialize()

            elif conn.transport_type == TransportType.SSE:
                from mcp.client.sse import sse_client

                url = conn.config.get("url", "")
                read_stream, write_stream = await sse_client(url).__aenter__()
                session = ClientSession(read_stream, write_stream)
                await session.__aenter__()
                await session.initialize()

            elif conn.transport_type == TransportType.STREAMABLE_HTTP:
                from mcp.client.streamable_http import streamablehttp_client

                url = conn.config.get("url", "")
                read_stream, write_stream, _ = await streamablehttp_client(url).__aenter__()
                session = ClientSession(read_stream, write_stream)
                await session.__aenter__()
                await session.initialize()

            else:
                raise ValueError(f"Unsupported transport type: {conn.transport_type}")

            # Discover tools
            tools_response = await session.list_tools()
            conn.discovered_tools = [
                RemoteMCPTool(
                    name=tool.name,
                    description=tool.description or "",
                    input_schema=tool.inputSchema if hasattr(tool, 'inputSchema') else {},
                )
                for tool in tools_response.tools
            ]

            self._sessions[str(conn.id)] = session
            conn.status = ConnectionStatus.CONNECTED
            conn.error_message = None
            conn.touch()

            logger.info(
                "Connected to MCP server '%s' (%s), discovered %d tools",
                conn.name, conn.transport_type.value, len(conn.discovered_tools),
            )

        except Exception as exc:
            conn.status = ConnectionStatus.ERROR
            conn.error_message = str(exc)
            conn.touch()
            logger.error("Failed to connect to MCP server '%s': %s", conn.name, exc)
            raise

    async def _disconnect(self, connection_id: str) -> None:
        """Disconnect from an MCP server."""
        session = self._sessions.pop(connection_id, None)
        if session:
            try:
                await session.__aexit__(None, None, None)
            except Exception as exc:
                logger.warning("Error during MCP disconnect: %s", exc)

    async def close_all(self) -> None:
        """Disconnect all active connections."""
        for conn_id in list(self._sessions.keys()):
            await self._disconnect(conn_id)
