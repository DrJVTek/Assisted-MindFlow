"""MCP Connection models (Feature 011 - US5).

Represents outbound MCP client connections to external MCP servers.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class TransportType(str, Enum):
    """MCP transport type."""

    STDIO = "stdio"
    SSE = "sse"
    STREAMABLE_HTTP = "streamable_http"


class ConnectionStatus(str, Enum):
    """MCP connection lifecycle status."""

    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


class RemoteMCPTool(BaseModel):
    """A tool discovered from an external MCP server."""

    name: str
    description: str = ""
    input_schema: Dict[str, Any] = Field(default_factory=dict)


class MCPConnection(BaseModel):
    """An outbound connection to an external MCP server."""

    id: UUID = Field(default_factory=uuid4)
    name: str
    transport_type: TransportType
    config: Dict[str, Any] = Field(default_factory=dict)
    status: ConnectionStatus = ConnectionStatus.DISCONNECTED
    discovered_tools: List[RemoteMCPTool] = Field(default_factory=list)
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def touch(self) -> None:
        self.updated_at = datetime.now(timezone.utc)


class CreateMCPConnectionRequest(BaseModel):
    """Request to add a new MCP server connection."""

    name: str
    transport_type: TransportType
    config: Dict[str, Any] = Field(default_factory=dict)
