# MCP Server Integration - Data Models

**Feature**: 002-mcp-server
**Created**: 2025-11-21
**Phase**: Phase 0

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Models (Python/SQLAlchemy)](#backend-models-pythonsqlalchemy)
3. [Frontend Types (TypeScript)](#frontend-types-typescript)
4. [State Management (Zustand)](#state-management-zustand)
5. [API Data Transfer Objects](#api-data-transfer-objects)
6. [Database Schema](#database-schema)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Validation Rules](#validation-rules)
9. [Example Data](#example-data)

---

## Overview

### Entity Relationship Diagram

```
┌─────────────────┐
│   MCPServer     │
│─────────────────│
│ id (PK)         │
│ name            │◄─────┐
│ url             │      │
│ auth_*          │      │ 1:N
│ status          │      │
│ capabilities    │      │
└─────────────────┘      │
                         │
                    ┌────┴──────────┐
                    │    MCPTool    │
                    │───────────────│
                    │ id (PK)       │
                    │ server_id(FK) │◄─────┐
                    │ name          │      │
                    │ description   │      │ 1:N
                    │ input_schema  │      │
                    │ enabled       │      │
                    └───────────────┘      │
                                           │
                                    ┌──────┴──────────────┐
                                    │  ToolInvocation     │
                                    │─────────────────────│
                                    │ id (PK)             │
                                    │ tool_id (FK)        │
                                    │ arguments           │
                                    │ result              │
                                    │ status              │
                                    │ duration_ms         │
                                    └─────────────────────┘
```

### Core Entities

1. **MCPServer**: Configuration for an external MCP server
2. **MCPTool**: Discovered tool from an MCP server
3. **MCPResource**: Resource (file, API) exposed by MCP server
4. **MCPPrompt**: Reusable prompt template from MCP server
5. **ToolInvocation**: Audit log of tool executions
6. **ServerConfiguration**: Runtime configuration and status
7. **ToolPermission**: User-defined tool permissions

---

## Backend Models (Python/SQLAlchemy)

### Base Configuration

```python
# src/mindflow/models/mcp_base.py
"""Base configuration for MCP models."""

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, DateTime
from datetime import datetime

Base = declarative_base()

class TimestampMixin:
    """Mixin for created_at and updated_at timestamps."""

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
```

### MCPServer Model

```python
# src/mindflow/models/mcp_server.py
"""MCPServer model - MCP server configuration."""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, Enum
)
from sqlalchemy.orm import relationship
from typing import Optional, List, Dict, Any
import json
from enum import Enum as PyEnum

from mindflow.models.mcp_base import Base, TimestampMixin


class AuthType(PyEnum):
    """Authentication method for MCP server."""
    NONE = "none"
    BEARER = "bearer"
    API_KEY = "api_key"
    OAUTH2 = "oauth2"


class ServerStatus(PyEnum):
    """Connection status of MCP server."""
    UNKNOWN = "unknown"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class MCPServer(Base, TimestampMixin):
    """MCP server configuration and status.

    Represents a configured connection to an external MCP server
    that provides tools, resources, and prompts.
    """
    __tablename__ = "mcp_servers"

    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Basic information
    name = Column(String(255), nullable=False, unique=True, index=True)
    url = Column(String(1024), nullable=False)
    description = Column(Text, nullable=True)

    # Authentication
    auth_type = Column(
        Enum(AuthType),
        default=AuthType.NONE,
        nullable=False
    )
    auth_token_encrypted = Column(Text, nullable=True)
    auth_header = Column(String(255), nullable=True)  # For API_KEY type
    oauth_config = Column(Text, nullable=True)  # JSON: client_id, token_url, etc.

    # Connection status
    enabled = Column(Boolean, default=True, nullable=False, index=True)
    status = Column(
        Enum(ServerStatus),
        default=ServerStatus.UNKNOWN,
        nullable=False,
        index=True
    )
    last_connected = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    connection_attempts = Column(Integer, default=0, nullable=False)

    # Capabilities (from MCP handshake)
    capabilities = Column(Text, nullable=True)  # JSON: tools, resources, prompts

    # Caching (to reduce repeated calls)
    tools_cache = Column(Text, nullable=True)  # JSON: list of tools
    resources_cache = Column(Text, nullable=True)  # JSON: list of resources
    prompts_cache = Column(Text, nullable=True)  # JSON: list of prompts
    cache_expires_at = Column(DateTime, nullable=True)

    # Performance metrics
    avg_response_time_ms = Column(Integer, nullable=True)
    total_invocations = Column(Integer, default=0, nullable=False)
    failed_invocations = Column(Integer, default=0, nullable=False)

    # Relationships
    tools = relationship(
        "MCPTool",
        back_populates="server",
        cascade="all, delete-orphan"
    )
    resources = relationship(
        "MCPResource",
        back_populates="server",
        cascade="all, delete-orphan"
    )
    prompts = relationship(
        "MCPPrompt",
        back_populates="server",
        cascade="all, delete-orphan"
    )

    # Configuration flags
    auto_discover = Column(Boolean, default=True, nullable=False)
    max_concurrent_calls = Column(Integer, default=5, nullable=False)
    timeout_seconds = Column(Integer, default=30, nullable=False)

    def get_capabilities(self) -> Dict[str, Any]:
        """Parse capabilities from JSON."""
        if self.capabilities:
            return json.loads(self.capabilities)
        return {}

    def set_capabilities(self, caps: Dict[str, Any]) -> None:
        """Store capabilities as JSON."""
        self.capabilities = json.dumps(caps)

    def get_tools_cache(self) -> List[Dict[str, Any]]:
        """Parse tools cache from JSON."""
        if self.tools_cache:
            return json.loads(self.tools_cache)
        return []

    def set_tools_cache(self, tools: List[Dict[str, Any]]) -> None:
        """Store tools cache as JSON."""
        self.tools_cache = json.dumps(tools)

    def is_cache_valid(self) -> bool:
        """Check if cache is still valid."""
        if not self.cache_expires_at:
            return False
        return datetime.utcnow() < self.cache_expires_at

    def get_success_rate(self) -> float:
        """Calculate tool invocation success rate."""
        if self.total_invocations == 0:
            return 0.0
        success = self.total_invocations - self.failed_invocations
        return (success / self.total_invocations) * 100

    def __repr__(self) -> str:
        return f"<MCPServer(id={self.id}, name='{self.name}', status={self.status.value})>"
```

### MCPTool Model

```python
# src/mindflow/models/mcp_tool.py
"""MCPTool model - Tool discovered from MCP server."""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from typing import Dict, Any
import json

from mindflow.models.mcp_base import Base, TimestampMixin


class MCPTool(Base, TimestampMixin):
    """Tool discovered from MCP server.

    Represents a callable function exposed by an MCP server
    that LLMs can invoke to perform actions.
    """
    __tablename__ = "mcp_tools"

    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign key to server
    server_id = Column(
        Integer,
        ForeignKey("mcp_servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Tool definition
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    input_schema = Column(Text, nullable=False)  # JSON Schema

    # Permissions
    enabled = Column(Boolean, default=True, nullable=False)
    requires_confirmation = Column(Boolean, default=False, nullable=False)
    allowed_for_roles = Column(Text, nullable=True)  # JSON: ["admin", "user"]

    # Discovery metadata
    discovered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Usage statistics
    invocation_count = Column(Integer, default=0, nullable=False)
    success_count = Column(Integer, default=0, nullable=False)
    failure_count = Column(Integer, default=0, nullable=False)
    avg_duration_ms = Column(Integer, nullable=True)

    # Relationships
    server = relationship("MCPServer", back_populates="tools")
    invocations = relationship(
        "ToolInvocation",
        back_populates="tool",
        cascade="all, delete-orphan"
    )

    # Composite unique constraint: server + tool name
    __table_args__ = (
        UniqueConstraint('server_id', 'name', name='uq_server_tool'),
    )

    def get_input_schema(self) -> Dict[str, Any]:
        """Parse input schema from JSON."""
        return json.loads(self.input_schema)

    def set_input_schema(self, schema: Dict[str, Any]) -> None:
        """Store input schema as JSON."""
        self.input_schema = json.dumps(schema)

    def get_success_rate(self) -> float:
        """Calculate success rate."""
        if self.invocation_count == 0:
            return 0.0
        return (self.success_count / self.invocation_count) * 100

    def get_full_name(self) -> str:
        """Get namespaced tool name (server/tool)."""
        return f"{self.server.name}/{self.name}"

    def to_llm_function(self) -> Dict[str, Any]:
        """Convert to LLM function calling format."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.get_input_schema()
        }

    def __repr__(self) -> str:
        return f"<MCPTool(id={self.id}, name='{self.name}', server_id={self.server_id})>"
```

### MCPResource Model

```python
# src/mindflow/models/mcp_resource.py
"""MCPResource model - Resource exposed by MCP server."""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship

from mindflow.models.mcp_base import Base, TimestampMixin


class MCPResource(Base, TimestampMixin):
    """Resource exposed by MCP server.

    Represents a data source (file, API, database) that
    LLMs can read via the MCP server.
    """
    __tablename__ = "mcp_resources"

    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign key to server
    server_id = Column(
        Integer,
        ForeignKey("mcp_servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Resource definition
    uri = Column(String(1024), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    mime_type = Column(String(127), nullable=False)
    description = Column(Text, nullable=True)

    # Metadata
    size_bytes = Column(Integer, nullable=True)
    last_modified = Column(DateTime, nullable=True)

    # Access control
    enabled = Column(Boolean, default=True, nullable=False)
    requires_confirmation = Column(Boolean, default=False, nullable=False)

    # Discovery
    discovered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    server = relationship("MCPServer", back_populates="resources")

    def __repr__(self) -> str:
        return f"<MCPResource(id={self.id}, uri='{self.uri}')>"
```

### MCPPrompt Model

```python
# src/mindflow/models/mcp_prompt.py
"""MCPPrompt model - Reusable prompt template from MCP server."""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from typing import Dict, Any, List
import json

from mindflow.models.mcp_base import Base, TimestampMixin


class MCPPrompt(Base, TimestampMixin):
    """Reusable prompt template from MCP server.

    Represents a parameterized prompt that can be used
    to structure LLM interactions.
    """
    __tablename__ = "mcp_prompts"

    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign key to server
    server_id = Column(
        Integer,
        ForeignKey("mcp_servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Prompt definition
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    arguments = Column(Text, nullable=False)  # JSON: list of argument definitions
    template = Column(Text, nullable=True)  # Optional: cached template

    # Access control
    enabled = Column(Boolean, default=True, nullable=False)

    # Discovery
    discovered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Usage statistics
    usage_count = Column(Integer, default=0, nullable=False)

    # Relationships
    server = relationship("MCPServer", back_populates="prompts")

    def get_arguments(self) -> List[Dict[str, Any]]:
        """Parse arguments from JSON."""
        return json.loads(self.arguments)

    def set_arguments(self, args: List[Dict[str, Any]]) -> None:
        """Store arguments as JSON."""
        self.arguments = json.dumps(args)

    def __repr__(self) -> str:
        return f"<MCPPrompt(id={self.id}, name='{self.name}')>"
```

### ToolInvocation Model

```python
# src/mindflow/models/tool_invocation.py
"""ToolInvocation model - Audit log of tool executions."""

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Enum, Index
)
from sqlalchemy.orm import relationship
from typing import Dict, Any, Optional
import json
from enum import Enum as PyEnum

from mindflow.models.mcp_base import Base


class InvocationStatus(PyEnum):
    """Status of tool invocation."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class ToolInvocation(Base):
    """Audit log of MCP tool invocations.

    Tracks all tool executions for transparency, debugging,
    and analytics.
    """
    __tablename__ = "tool_invocations"

    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign key to tool
    tool_id = Column(
        Integer,
        ForeignKey("mcp_tools.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Invocation details
    arguments = Column(Text, nullable=False)  # JSON
    result = Column(Text, nullable=True)  # JSON
    error_message = Column(Text, nullable=True)
    error_code = Column(Integer, nullable=True)

    # Timing
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)

    # Status
    status = Column(
        Enum(InvocationStatus),
        default=InvocationStatus.PENDING,
        nullable=False,
        index=True
    )

    # Context
    user_id = Column(Integer, nullable=True)  # If multi-user
    session_id = Column(String(255), nullable=True, index=True)
    conversation_id = Column(String(255), nullable=True, index=True)
    graph_id = Column(Integer, nullable=True)  # Link to MindFlow graph

    # Metadata
    triggered_by = Column(String(50), default="llm", nullable=False)  # llm, user, system
    retry_count = Column(Integer, default=0, nullable=False)

    # Relationships
    tool = relationship("MCPTool", back_populates="invocations")

    # Indexes for common queries
    __table_args__ = (
        Index('ix_tool_invocations_session_started', 'session_id', 'started_at'),
        Index('ix_tool_invocations_status_started', 'status', 'started_at'),
    )

    def get_arguments(self) -> Dict[str, Any]:
        """Parse arguments from JSON."""
        return json.loads(self.arguments)

    def set_arguments(self, args: Dict[str, Any]) -> None:
        """Store arguments as JSON."""
        self.arguments = json.dumps(args)

    def get_result(self) -> Optional[Dict[str, Any]]:
        """Parse result from JSON."""
        if self.result:
            return json.loads(self.result)
        return None

    def set_result(self, result: Dict[str, Any]) -> None:
        """Store result as JSON."""
        self.result = json.dumps(result)

    def calculate_duration(self) -> None:
        """Calculate duration if completed."""
        if self.completed_at and self.started_at:
            delta = self.completed_at - self.started_at
            self.duration_ms = int(delta.total_seconds() * 1000)

    def __repr__(self) -> str:
        return f"<ToolInvocation(id={self.id}, tool_id={self.tool_id}, status={self.status.value})>"
```

### Pydantic Schemas (API DTOs)

```python
# src/mindflow/schemas/mcp_schemas.py
"""Pydantic schemas for MCP API endpoints."""

from pydantic import BaseModel, Field, HttpUrl, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# Enums
class AuthType(str, Enum):
    """Authentication types."""
    NONE = "none"
    BEARER = "bearer"
    API_KEY = "api_key"
    OAUTH2 = "oauth2"


class ServerStatus(str, Enum):
    """Server connection status."""
    UNKNOWN = "unknown"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class InvocationStatus(str, Enum):
    """Tool invocation status."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


# Server schemas
class MCPServerCreate(BaseModel):
    """Schema for creating MCP server."""
    name: str = Field(..., min_length=1, max_length=255)
    url: HttpUrl
    description: Optional[str] = None
    auth_type: AuthType = AuthType.NONE
    auth_token: Optional[str] = None
    auth_header: Optional[str] = None
    enabled: bool = True
    timeout_seconds: int = Field(default=30, ge=5, le=300)

    @validator('name')
    def name_alphanumeric(cls, v):
        """Validate name is alphanumeric with spaces/dashes."""
        import re
        if not re.match(r'^[a-zA-Z0-9\s\-_]+$', v):
            raise ValueError('Name must be alphanumeric with spaces, dashes, or underscores')
        return v


class MCPServerUpdate(BaseModel):
    """Schema for updating MCP server."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    url: Optional[HttpUrl] = None
    description: Optional[str] = None
    auth_type: Optional[AuthType] = None
    auth_token: Optional[str] = None
    auth_header: Optional[str] = None
    enabled: Optional[bool] = None
    timeout_seconds: Optional[int] = Field(None, ge=5, le=300)


class MCPServerResponse(BaseModel):
    """Schema for MCP server response."""
    id: int
    name: str
    url: str
    description: Optional[str]
    auth_type: AuthType
    status: ServerStatus
    enabled: bool
    last_connected: Optional[datetime]
    last_error: Optional[str]
    capabilities: Optional[Dict[str, Any]]
    tool_count: int = 0
    resource_count: int = 0
    prompt_count: int = 0
    success_rate: float = 0.0
    avg_response_time_ms: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Tool schemas
class MCPToolResponse(BaseModel):
    """Schema for MCP tool response."""
    id: int
    server_id: int
    server_name: str
    name: str
    description: str
    input_schema: Dict[str, Any]
    enabled: bool
    requires_confirmation: bool
    success_rate: float = 0.0
    invocation_count: int = 0
    discovered_at: datetime

    class Config:
        from_attributes = True


class MCPToolUpdate(BaseModel):
    """Schema for updating tool permissions."""
    enabled: Optional[bool] = None
    requires_confirmation: Optional[bool] = None


# Tool invocation schemas
class ToolInvocationRequest(BaseModel):
    """Schema for invoking a tool."""
    tool_id: int
    arguments: Dict[str, Any]
    session_id: Optional[str] = None
    conversation_id: Optional[str] = None


class ToolInvocationResponse(BaseModel):
    """Schema for tool invocation response."""
    id: int
    tool_id: int
    tool_name: str
    arguments: Dict[str, Any]
    result: Optional[Dict[str, Any]]
    error_message: Optional[str]
    status: InvocationStatus
    started_at: datetime
    completed_at: Optional[datetime]
    duration_ms: Optional[int]

    class Config:
        from_attributes = True


# Connection test schemas
class ConnectionTestRequest(BaseModel):
    """Schema for testing connection."""
    server_id: int


class ConnectionTestResponse(BaseModel):
    """Schema for connection test result."""
    success: bool
    status: ServerStatus
    message: str
    capabilities: Optional[Dict[str, Any]] = None
    tool_count: int = 0
    resource_count: int = 0
    prompt_count: int = 0
    response_time_ms: int


# Tool discovery schemas
class ToolDiscoveryResponse(BaseModel):
    """Schema for tool discovery result."""
    server_id: int
    server_name: str
    tools_discovered: int
    tools_updated: int
    resources_discovered: int
    prompts_discovered: int
    success: bool
    message: str
```

---

## Frontend Types (TypeScript)

### Core Types

```typescript
// frontend/src/types/mcp.ts
/**
 * TypeScript types for MCP integration.
 */

// Enums
export enum AuthType {
  NONE = 'none',
  BEARER = 'bearer',
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2'
}

export enum ServerStatus {
  UNKNOWN = 'unknown',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

export enum InvocationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  ERROR = 'error',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled'
}

// Server types
export interface MCPServer {
  id: number;
  name: string;
  url: string;
  description?: string;
  auth_type: AuthType;
  status: ServerStatus;
  enabled: boolean;
  last_connected?: string;  // ISO timestamp
  last_error?: string;
  capabilities?: Record<string, any>;
  tool_count: number;
  resource_count: number;
  prompt_count: number;
  success_rate: number;
  avg_response_time_ms?: number;
  created_at: string;
  updated_at: string;
}

export interface MCPServerCreate {
  name: string;
  url: string;
  description?: string;
  auth_type: AuthType;
  auth_token?: string;
  auth_header?: string;
  enabled?: boolean;
  timeout_seconds?: number;
}

export interface MCPServerUpdate {
  name?: string;
  url?: string;
  description?: string;
  auth_type?: AuthType;
  auth_token?: string;
  auth_header?: string;
  enabled?: boolean;
  timeout_seconds?: number;
}

// Tool types
export interface MCPTool {
  id: number;
  server_id: number;
  server_name: string;
  name: string;
  description: string;
  input_schema: Record<string, any>;
  enabled: boolean;
  requires_confirmation: boolean;
  success_rate: number;
  invocation_count: number;
  discovered_at: string;
}

export interface MCPToolUpdate {
  enabled?: boolean;
  requires_confirmation?: boolean;
}

// Tool invocation types
export interface ToolInvocationRequest {
  tool_id: number;
  arguments: Record<string, any>;
  session_id?: string;
  conversation_id?: string;
}

export interface ToolInvocation {
  id: number;
  tool_id: number;
  tool_name: string;
  arguments: Record<string, any>;
  result?: Record<string, any>;
  error_message?: string;
  status: InvocationStatus;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
}

// Connection test types
export interface ConnectionTestRequest {
  server_id: number;
}

export interface ConnectionTestResponse {
  success: boolean;
  status: ServerStatus;
  message: string;
  capabilities?: Record<string, any>;
  tool_count: number;
  resource_count: number;
  prompt_count: number;
  response_time_ms: number;
}

// Tool discovery types
export interface ToolDiscoveryResponse {
  server_id: number;
  server_name: string;
  tools_discovered: number;
  tools_updated: number;
  resources_discovered: number;
  prompts_discovered: number;
  success: boolean;
  message: string;
}

// Filter types
export interface ServerFilter {
  status?: ServerStatus;
  enabled?: boolean;
  search?: string;
}

export interface ToolFilter {
  server_id?: number;
  enabled?: boolean;
  search?: string;
}

export interface InvocationFilter {
  tool_id?: number;
  server_id?: number;
  status?: InvocationStatus;
  session_id?: string;
  date_from?: string;
  date_to?: string;
}
```

---

## State Management (Zustand)

### MCP Store

```typescript
// frontend/src/stores/mcpStore.ts
/**
 * Zustand store for MCP state management.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  MCPServer,
  MCPTool,
  ToolInvocation,
  ServerFilter,
  ToolFilter,
  InvocationFilter
} from '../types/mcp';

interface MCPState {
  // Servers
  servers: MCPServer[];
  selectedServer: MCPServer | null;
  serverFilter: ServerFilter;

  // Tools
  tools: MCPTool[];
  selectedTool: MCPTool | null;
  toolFilter: ToolFilter;

  // Invocations
  invocations: ToolInvocation[];
  invocationFilter: InvocationFilter;

  // UI state
  isLoadingServers: boolean;
  isLoadingTools: boolean;
  isLoadingInvocations: boolean;
  error: string | null;

  // Server actions
  setServers: (servers: MCPServer[]) => void;
  addServer: (server: MCPServer) => void;
  updateServer: (id: number, updates: Partial<MCPServer>) => void;
  removeServer: (id: number) => void;
  selectServer: (server: MCPServer | null) => void;
  setServerFilter: (filter: ServerFilter) => void;

  // Tool actions
  setTools: (tools: MCPTool[]) => void;
  updateTool: (id: number, updates: Partial<MCPTool>) => void;
  selectTool: (tool: MCPTool | null) => void;
  setToolFilter: (filter: ToolFilter) => void;

  // Invocation actions
  setInvocations: (invocations: ToolInvocation[]) => void;
  addInvocation: (invocation: ToolInvocation) => void;
  updateInvocation: (id: number, updates: Partial<ToolInvocation>) => void;
  setInvocationFilter: (filter: InvocationFilter) => void;

  // Loading states
  setLoadingServers: (loading: boolean) => void;
  setLoadingTools: (loading: boolean) => void;
  setLoadingInvocations: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Utility functions
  getServerById: (id: number) => MCPServer | undefined;
  getToolById: (id: number) => MCPTool | undefined;
  getToolsByServer: (serverId: number) => MCPTool[];
  getInvocationsByTool: (toolId: number) => ToolInvocation[];
  getFilteredServers: () => MCPServer[];
  getFilteredTools: () => MCPTool[];
  getFilteredInvocations: () => ToolInvocation[];
}

export const useMCPStore = create<MCPState>()(
  devtools(
    (set, get) => ({
      // Initial state
      servers: [],
      selectedServer: null,
      serverFilter: {},
      tools: [],
      selectedTool: null,
      toolFilter: {},
      invocations: [],
      invocationFilter: {},
      isLoadingServers: false,
      isLoadingTools: false,
      isLoadingInvocations: false,
      error: null,

      // Server actions
      setServers: (servers) => set({ servers }),

      addServer: (server) =>
        set((state) => ({
          servers: [...state.servers, server]
        })),

      updateServer: (id, updates) =>
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          )
        })),

      removeServer: (id) =>
        set((state) => ({
          servers: state.servers.filter((s) => s.id !== id),
          selectedServer:
            state.selectedServer?.id === id ? null : state.selectedServer
        })),

      selectServer: (server) => set({ selectedServer: server }),

      setServerFilter: (filter) => set({ serverFilter: filter }),

      // Tool actions
      setTools: (tools) => set({ tools }),

      updateTool: (id, updates) =>
        set((state) => ({
          tools: state.tools.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          )
        })),

      selectTool: (tool) => set({ selectedTool: tool }),

      setToolFilter: (filter) => set({ toolFilter: filter }),

      // Invocation actions
      setInvocations: (invocations) => set({ invocations }),

      addInvocation: (invocation) =>
        set((state) => ({
          invocations: [invocation, ...state.invocations]
        })),

      updateInvocation: (id, updates) =>
        set((state) => ({
          invocations: state.invocations.map((i) =>
            i.id === id ? { ...i, ...updates } : i
          )
        })),

      setInvocationFilter: (filter) => set({ invocationFilter: filter }),

      // Loading states
      setLoadingServers: (loading) => set({ isLoadingServers: loading }),
      setLoadingTools: (loading) => set({ isLoadingTools: loading }),
      setLoadingInvocations: (loading) => set({ isLoadingInvocations: loading }),
      setError: (error) => set({ error }),

      // Utility functions
      getServerById: (id) => get().servers.find((s) => s.id === id),

      getToolById: (id) => get().tools.find((t) => t.id === id),

      getToolsByServer: (serverId) =>
        get().tools.filter((t) => t.server_id === serverId),

      getInvocationsByTool: (toolId) =>
        get().invocations.filter((i) => i.tool_id === toolId),

      getFilteredServers: () => {
        const { servers, serverFilter } = get();
        return servers.filter((server) => {
          if (serverFilter.status && server.status !== serverFilter.status) {
            return false;
          }
          if (serverFilter.enabled !== undefined && server.enabled !== serverFilter.enabled) {
            return false;
          }
          if (serverFilter.search) {
            const search = serverFilter.search.toLowerCase();
            return (
              server.name.toLowerCase().includes(search) ||
              server.url.toLowerCase().includes(search)
            );
          }
          return true;
        });
      },

      getFilteredTools: () => {
        const { tools, toolFilter } = get();
        return tools.filter((tool) => {
          if (toolFilter.server_id && tool.server_id !== toolFilter.server_id) {
            return false;
          }
          if (toolFilter.enabled !== undefined && tool.enabled !== toolFilter.enabled) {
            return false;
          }
          if (toolFilter.search) {
            const search = toolFilter.search.toLowerCase();
            return (
              tool.name.toLowerCase().includes(search) ||
              tool.description.toLowerCase().includes(search)
            );
          }
          return true;
        });
      },

      getFilteredInvocations: () => {
        const { invocations, invocationFilter } = get();
        return invocations.filter((inv) => {
          if (invocationFilter.tool_id && inv.tool_id !== invocationFilter.tool_id) {
            return false;
          }
          if (invocationFilter.status && inv.status !== invocationFilter.status) {
            return false;
          }
          if (invocationFilter.session_id) {
            // Implement session filtering if needed
          }
          if (invocationFilter.date_from) {
            if (new Date(inv.started_at) < new Date(invocationFilter.date_from)) {
              return false;
            }
          }
          if (invocationFilter.date_to) {
            if (new Date(inv.started_at) > new Date(invocationFilter.date_to)) {
              return false;
            }
          }
          return true;
        });
      }
    }),
    { name: 'MCPStore' }
  )
);
```

---

## API Data Transfer Objects

### Request/Response Examples

**Create Server**:
```json
// POST /api/mcp/servers
{
  "name": "Local File Server",
  "url": "http://localhost:8001",
  "description": "File operations tool",
  "auth_type": "none",
  "enabled": true,
  "timeout_seconds": 30
}

// Response: 201 Created
{
  "id": 1,
  "name": "Local File Server",
  "url": "http://localhost:8001",
  "description": "File operations tool",
  "auth_type": "none",
  "status": "unknown",
  "enabled": true,
  "last_connected": null,
  "last_error": null,
  "capabilities": null,
  "tool_count": 0,
  "resource_count": 0,
  "prompt_count": 0,
  "success_rate": 0.0,
  "avg_response_time_ms": null,
  "created_at": "2025-11-21T10:00:00Z",
  "updated_at": "2025-11-21T10:00:00Z"
}
```

**Test Connection**:
```json
// POST /api/mcp/servers/1/test
{
  "server_id": 1
}

// Response: 200 OK
{
  "success": true,
  "status": "connected",
  "message": "Connected successfully",
  "capabilities": {
    "tools": {"listChanged": true},
    "resources": {"subscribe": true}
  },
  "tool_count": 3,
  "resource_count": 0,
  "prompt_count": 0,
  "response_time_ms": 245
}
```

**Invoke Tool**:
```json
// POST /api/mcp/tools/invoke
{
  "tool_id": 5,
  "arguments": {
    "query": "authentication",
    "max_results": 5
  },
  "session_id": "sess_abc123",
  "conversation_id": "conv_xyz789"
}

// Response: 200 OK
{
  "id": 42,
  "tool_id": 5,
  "tool_name": "search_files",
  "arguments": {
    "query": "authentication",
    "max_results": 5
  },
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 3 files:\n1. src/auth/login.py\n2. src/auth/token.py\n3. tests/test_auth.py"
      }
    ]
  },
  "error_message": null,
  "status": "success",
  "started_at": "2025-11-21T10:05:00Z",
  "completed_at": "2025-11-21T10:05:01.234Z",
  "duration_ms": 1234
}
```

---

## Database Schema

### SQL Schema

```sql
-- MCP Servers table
CREATE TABLE mcp_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    url VARCHAR(1024) NOT NULL,
    description TEXT,

    -- Authentication
    auth_type VARCHAR(50) NOT NULL DEFAULT 'none',
    auth_token_encrypted TEXT,
    auth_header VARCHAR(255),
    oauth_config TEXT,

    -- Connection status
    enabled BOOLEAN NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'unknown',
    last_connected DATETIME,
    last_error TEXT,
    connection_attempts INTEGER NOT NULL DEFAULT 0,

    -- Capabilities and caching
    capabilities TEXT,
    tools_cache TEXT,
    resources_cache TEXT,
    prompts_cache TEXT,
    cache_expires_at DATETIME,

    -- Performance metrics
    avg_response_time_ms INTEGER,
    total_invocations INTEGER NOT NULL DEFAULT 0,
    failed_invocations INTEGER NOT NULL DEFAULT 0,

    -- Configuration
    auto_discover BOOLEAN NOT NULL DEFAULT 1,
    max_concurrent_calls INTEGER NOT NULL DEFAULT 5,
    timeout_seconds INTEGER NOT NULL DEFAULT 30,

    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_mcp_servers_name ON mcp_servers(name);
CREATE INDEX ix_mcp_servers_enabled ON mcp_servers(enabled);
CREATE INDEX ix_mcp_servers_status ON mcp_servers(status);

-- MCP Tools table
CREATE TABLE mcp_tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,

    -- Tool definition
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    input_schema TEXT NOT NULL,

    -- Permissions
    enabled BOOLEAN NOT NULL DEFAULT 1,
    requires_confirmation BOOLEAN NOT NULL DEFAULT 0,
    allowed_for_roles TEXT,

    -- Discovery metadata
    discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Usage statistics
    invocation_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    avg_duration_ms INTEGER,

    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE,
    UNIQUE(server_id, name)
);

CREATE INDEX ix_mcp_tools_server_id ON mcp_tools(server_id);
CREATE INDEX ix_mcp_tools_name ON mcp_tools(name);

-- Tool Invocations table
CREATE TABLE tool_invocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL,

    -- Invocation details
    arguments TEXT NOT NULL,
    result TEXT,
    error_message TEXT,
    error_code INTEGER,

    -- Timing
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    duration_ms INTEGER,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',

    -- Context
    user_id INTEGER,
    session_id VARCHAR(255),
    conversation_id VARCHAR(255),
    graph_id INTEGER,

    -- Metadata
    triggered_by VARCHAR(50) NOT NULL DEFAULT 'llm',
    retry_count INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (tool_id) REFERENCES mcp_tools(id) ON DELETE CASCADE
);

CREATE INDEX ix_tool_invocations_tool_id ON tool_invocations(tool_id);
CREATE INDEX ix_tool_invocations_started_at ON tool_invocations(started_at);
CREATE INDEX ix_tool_invocations_status ON tool_invocations(status);
CREATE INDEX ix_tool_invocations_session_id ON tool_invocations(session_id);
CREATE INDEX ix_tool_invocations_conversation_id ON tool_invocations(conversation_id);
CREATE INDEX ix_tool_invocations_session_started ON tool_invocations(session_id, started_at);
CREATE INDEX ix_tool_invocations_status_started ON tool_invocations(status, started_at);

-- MCP Resources table
CREATE TABLE mcp_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,

    -- Resource definition
    uri VARCHAR(1024) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(127) NOT NULL,
    description TEXT,

    -- Metadata
    size_bytes INTEGER,
    last_modified DATETIME,

    -- Access control
    enabled BOOLEAN NOT NULL DEFAULT 1,
    requires_confirmation BOOLEAN NOT NULL DEFAULT 0,

    -- Discovery
    discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
);

CREATE INDEX ix_mcp_resources_server_id ON mcp_resources(server_id);
CREATE INDEX ix_mcp_resources_uri ON mcp_resources(uri);

-- MCP Prompts table
CREATE TABLE mcp_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,

    -- Prompt definition
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    arguments TEXT NOT NULL,
    template TEXT,

    -- Access control
    enabled BOOLEAN NOT NULL DEFAULT 1,

    -- Discovery
    discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Usage statistics
    usage_count INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
);

CREATE INDEX ix_mcp_prompts_server_id ON mcp_prompts(server_id);
CREATE INDEX ix_mcp_prompts_name ON mcp_prompts(name);
```

---

## Data Flow Diagrams

### Tool Discovery Flow

```
┌─────────┐         ┌───────────┐         ┌────────────┐         ┌──────────┐
│   UI    │         │  Backend  │         │ MCP Client │         │  MCP     │
│         │         │    API    │         │            │         │ Server   │
└────┬────┘         └─────┬─────┘         └──────┬─────┘         └────┬─────┘
     │                    │                       │                    │
     │ POST /servers      │                       │                    │
     ├───────────────────>│                       │                    │
     │                    │ Save to DB            │                    │
     │                    ├───────────────────────>                    │
     │                    │                       │                    │
     │ POST /test         │                       │                    │
     ├───────────────────>│                       │                    │
     │                    │ list_tools()          │                    │
     │                    ├──────────────────────>│                    │
     │                    │                       │ JSON-RPC tools/list│
     │                    │                       ├───────────────────>│
     │                    │                       │                    │
     │                    │                       │ Response: tools[]  │
     │                    │                       │<───────────────────┤
     │                    │ tools[]               │                    │
     │                    │<──────────────────────┤                    │
     │                    │ Save tools to DB      │                    │
     │                    ├───────────────────────>                    │
     │ Connected + tools  │                       │                    │
     │<───────────────────┤                       │                    │
     │                    │                       │                    │
```

### Tool Invocation Flow

```
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌────────────┐    ┌─────────┐
│  User   │    │   LLM   │    │ Backend  │    │ MCP Client │    │   MCP   │
│         │    │   API   │    │   API    │    │            │    │ Server  │
└────┬────┘    └────┬────┘    └────┬─────┘    └──────┬─────┘    └────┬────┘
     │              │              │                  │               │
     │ "Find auth   │              │                  │               │
     │  files"      │              │                  │               │
     ├─────────────>│              │                  │               │
     │              │ Available    │                  │               │
     │              │ tools in     │                  │               │
     │              │ prompt       │                  │               │
     │              │              │                  │               │
     │              │ Decides to   │                  │               │
     │              │ use          │                  │               │
     │              │ search_files │                  │               │
     │              │              │                  │               │
     │              │ POST /tools/invoke              │               │
     │              ├─────────────>│                  │               │
     │              │              │ Create invocation│               │
     │              │              │ record (pending) │               │
     │              │              ├──────────────────>               │
     │              │              │                  │               │
     │              │              │ call_tool()      │               │
     │              │              ├─────────────────>│               │
     │              │              │                  │ JSON-RPC      │
     │              │              │                  │ tools/call    │
     │              │              │                  ├──────────────>│
     │              │              │                  │               │
     │              │              │                  │ Execute tool  │
     │              │              │                  │               │
     │              │              │                  │ Result        │
     │              │              │                  │<──────────────┤
     │              │              │ Result           │               │
     │              │              │<─────────────────┤               │
     │              │              │ Update invocation│               │
     │              │              │ (success)        │               │
     │              │              ├──────────────────>               │
     │              │ Tool result  │                  │               │
     │              │<─────────────┤                  │               │
     │ Response     │              │                  │               │
     │ with tool    │              │                  │               │
     │ results      │              │                  │               │
     │<─────────────┤              │                  │               │
     │              │              │                  │               │
```

---

## Validation Rules

### Server Validation

```python
# Validation rules for MCPServer
VALIDATION_RULES = {
    "name": {
        "required": True,
        "min_length": 1,
        "max_length": 255,
        "pattern": r"^[a-zA-Z0-9\s\-_]+$",
        "unique": True
    },
    "url": {
        "required": True,
        "format": "url",
        "schemes": ["http", "https"],
        "max_length": 1024
    },
    "auth_type": {
        "required": True,
        "enum": ["none", "bearer", "api_key", "oauth2"]
    },
    "auth_token": {
        "required_if": "auth_type in ['bearer', 'api_key']",
        "min_length": 10,
        "no_whitespace": True
    },
    "timeout_seconds": {
        "type": "integer",
        "min": 5,
        "max": 300,
        "default": 30
    }
}
```

### Tool Parameter Validation

```python
from jsonschema import validate, ValidationError

def validate_tool_arguments(
    arguments: Dict[str, Any],
    input_schema: Dict[str, Any]
) -> None:
    """Validate tool arguments against JSON schema."""
    try:
        validate(instance=arguments, schema=input_schema)
    except ValidationError as e:
        raise ValueError(f"Invalid tool arguments: {e.message}")

# Example
tool_schema = {
    "type": "object",
    "properties": {
        "query": {"type": "string", "minLength": 1},
        "max_results": {"type": "integer", "minimum": 1, "maximum": 100}
    },
    "required": ["query"]
}

# Valid
validate_tool_arguments(
    {"query": "test", "max_results": 10},
    tool_schema
)  # OK

# Invalid - missing required field
validate_tool_arguments(
    {"max_results": 10},
    tool_schema
)  # Raises ValueError
```

---

## Example Data

### Sample Server Configuration

```json
{
  "id": 1,
  "name": "Local File Server",
  "url": "http://localhost:8001",
  "description": "Provides file system operations",
  "auth_type": "none",
  "status": "connected",
  "enabled": true,
  "last_connected": "2025-11-21T10:30:00Z",
  "capabilities": {
    "tools": {
      "listChanged": true
    }
  },
  "tool_count": 3,
  "resource_count": 0,
  "prompt_count": 0,
  "success_rate": 95.5,
  "avg_response_time_ms": 320,
  "total_invocations": 42,
  "failed_invocations": 2,
  "timeout_seconds": 30,
  "created_at": "2025-11-20T09:00:00Z",
  "updated_at": "2025-11-21T10:30:00Z"
}
```

### Sample Tool Definition

```json
{
  "id": 5,
  "server_id": 1,
  "server_name": "Local File Server",
  "name": "search_files",
  "description": "Search for files by name or content pattern",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query (filename or content pattern)",
        "minLength": 1
      },
      "path": {
        "type": "string",
        "description": "Directory to search (optional)",
        "default": "."
      },
      "max_results": {
        "type": "integer",
        "description": "Maximum number of results",
        "minimum": 1,
        "maximum": 100,
        "default": 10
      }
    },
    "required": ["query"]
  },
  "enabled": true,
  "requires_confirmation": false,
  "success_rate": 98.2,
  "invocation_count": 28,
  "discovered_at": "2025-11-20T09:05:00Z"
}
```

### Sample Tool Invocation

```json
{
  "id": 42,
  "tool_id": 5,
  "tool_name": "search_files",
  "arguments": {
    "query": "authentication",
    "path": "./src",
    "max_results": 5
  },
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 3 files:\n1. src/auth/login.py (245 lines)\n2. src/auth/token.py (120 lines)\n3. tests/test_auth.py (89 lines)"
      }
    ]
  },
  "error_message": null,
  "status": "success",
  "started_at": "2025-11-21T10:25:30.123Z",
  "completed_at": "2025-11-21T10:25:31.456Z",
  "duration_ms": 1333,
  "session_id": "sess_abc123",
  "conversation_id": "conv_xyz789",
  "triggered_by": "llm",
  "retry_count": 0
}
```

---

**Data Models Complete**: This document provides comprehensive entity definitions, database schema, TypeScript types, and state management for MCP server integration. Next: Create API contracts and implementation plan.
