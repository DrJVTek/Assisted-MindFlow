"""MCP Client Connections API routes (Feature 011 - US5).

Manages outbound MCP client connections:
- POST   /api/mcp-connections                           — Add connection
- GET    /api/mcp-connections                           — List connections
- GET    /api/mcp-connections/{id}                      — Get connection
- DELETE /api/mcp-connections/{id}                      — Remove connection
- POST   /api/mcp-connections/{id}/refresh              — Refresh tools
- GET    /api/mcp-connections/tools                     — List all tools
- POST   /api/mcp-connections/{id}/tools/{name}/invoke  — Invoke tool
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from mindflow.models.mcp_connection import (
    ConnectionStatus,
    CreateMCPConnectionRequest,
    TransportType,
)
from mindflow.services.mcp_client_manager import MCPClientManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp-connections", tags=["mcp-connections"])

# Singleton manager
_manager: Optional[MCPClientManager] = None


def _get_manager() -> MCPClientManager:
    global _manager
    if _manager is None:
        _manager = MCPClientManager()
    return _manager


# ── Response Models ────────────────────────────────────────────


class ToolResponse(BaseModel):
    name: str
    description: str = ""
    input_schema: Dict[str, Any] = Field(default_factory=dict)


class ConnectionResponse(BaseModel):
    id: str
    name: str
    transport_type: str
    config: Dict[str, Any] = Field(default_factory=dict)
    status: str
    discovered_tools: List[ToolResponse] = Field(default_factory=list)
    tool_count: int = 0
    error_message: Optional[str] = None
    created_at: str
    updated_at: str


class ConnectionListResponse(BaseModel):
    connections: List[ConnectionResponse]


class AllToolsResponse(BaseModel):
    tools: List[Dict[str, Any]]


class InvokeRequest(BaseModel):
    arguments: Dict[str, Any] = Field(default_factory=dict)


class InvokeResponse(BaseModel):
    result: str
    is_error: bool = False


def _to_response(conn) -> ConnectionResponse:
    return ConnectionResponse(
        id=str(conn.id),
        name=conn.name,
        transport_type=conn.transport_type.value,
        config=conn.config,
        status=conn.status.value,
        discovered_tools=[
            ToolResponse(
                name=t.name,
                description=t.description,
                input_schema=t.input_schema,
            )
            for t in conn.discovered_tools
        ],
        tool_count=len(conn.discovered_tools),
        error_message=conn.error_message,
        created_at=conn.created_at.isoformat(),
        updated_at=conn.updated_at.isoformat(),
    )


# ── Endpoints ──────────────────────────────────────────────────


@router.post("", response_model=ConnectionResponse, status_code=201)
async def add_connection(request: CreateMCPConnectionRequest):
    """Add and connect to a new external MCP server."""
    manager = _get_manager()
    try:
        conn = await manager.add_connection(request)
        return _to_response(conn)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except TimeoutError:
        raise HTTPException(status_code=504, detail="MCP server connection timed out")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Cannot connect to MCP server: {exc}")


@router.get("", response_model=ConnectionListResponse)
async def list_connections():
    """List all MCP server connections."""
    manager = _get_manager()
    connections = manager.list_connections()
    return ConnectionListResponse(
        connections=[_to_response(c) for c in connections]
    )


@router.get("/tools", response_model=AllToolsResponse)
async def list_all_tools():
    """List all available tools across all connected MCP servers."""
    manager = _get_manager()
    tools = manager.get_all_tools()
    return AllToolsResponse(tools=tools)


@router.get("/{connection_id}", response_model=ConnectionResponse)
async def get_connection(connection_id: str):
    """Get connection details including discovered tools."""
    manager = _get_manager()
    conn = manager.get_connection(connection_id)
    if conn is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    return _to_response(conn)


@router.delete("/{connection_id}")
async def remove_connection(connection_id: str):
    """Disconnect and remove an MCP server connection."""
    manager = _get_manager()
    if not await manager.remove_connection(connection_id):
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"message": "MCP connection removed"}


@router.post("/{connection_id}/refresh", response_model=ConnectionResponse)
async def refresh_connection(connection_id: str):
    """Re-discover tools from a connected MCP server."""
    manager = _get_manager()
    try:
        conn = await manager.refresh_tools(connection_id)
        return _to_response(conn)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Refresh failed: {exc}")


@router.post("/{connection_id}/tools/{tool_name}/invoke", response_model=InvokeResponse)
async def invoke_tool(connection_id: str, tool_name: str, request: InvokeRequest):
    """Invoke a tool on a connected MCP server."""
    manager = _get_manager()
    try:
        result = await manager.invoke_tool(connection_id, tool_name, request.arguments)
        return InvokeResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Tool execution timed out")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Tool execution failed: {exc}")
