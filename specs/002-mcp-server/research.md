# MCP Server Integration - Technical Research

**Feature**: 002-mcp-server
**Created**: 2025-11-21
**Research Phase**: Phase 0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [MCP Protocol Specification](#mcp-protocol-specification)
3. [MCP Server Implementations](#mcp-server-implementations)
4. [Authentication and Security](#authentication-and-security)
5. [Configuration Management](#configuration-management)
6. [LLM Tool Integration Patterns](#llm-tool-integration-patterns)
7. [Transport Layers](#transport-layers)
8. [UI Design Patterns](#ui-design-patterns)
9. [Testing Strategies](#testing-strategies)
10. [Performance Considerations](#performance-considerations)
11. [Technology Stack Decisions](#technology-stack-decisions)
12. [Implementation Recommendations](#implementation-recommendations)

---

## Executive Summary

### What is MCP?

**Model Context Protocol (MCP)** is an open standard developed by Anthropic that enables AI assistants to securely access external tools, data sources, and services. It provides a standardized interface for:

- **Tool Discovery**: LLMs can discover available capabilities from MCP servers
- **Tool Invocation**: LLMs can call tools with structured parameters
- **Resource Access**: LLMs can read external data (files, APIs, databases)
- **Prompt Templates**: Servers can provide reusable prompt patterns

### Why MCP Matters for MindFlow

MindFlow currently operates on static graph data created by users. MCP integration will enable:

1. **Dynamic Data Integration**: LLMs can pull live data into reasoning graphs
2. **Action Capabilities**: LLMs can perform operations (file search, API calls, calculations)
3. **Extensibility**: Users can add custom capabilities without modifying MindFlow code
4. **Ecosystem Access**: Leverage growing MCP server marketplace

### Key Research Findings

| Area | Recommendation | Rationale |
|------|---------------|-----------|
| **Protocol Version** | MCP 1.0 (2024 spec) | Stable, widely adopted |
| **Python SDK** | Official `mcp` package | Anthropic-maintained, well-documented |
| **Transport** | HTTP/SSE for web UI | WebSocket alternative, server-sent events for streaming |
| **Authentication** | Bearer tokens + API keys | Simple, secure, widely supported |
| **Configuration Storage** | SQLite database | Encrypted credentials, portable, no external DB dependency |
| **LLM Integration** | Function calling API | Supported by Claude, GPT-4, local models |
| **UI Framework** | React + Zustand | Consistent with existing MindFlow frontend |
| **Testing** | pytest + MCP test server | Protocol compliance, integration tests |

### Critical Dependencies

- **mcp** (Python package): Official MCP SDK from Anthropic
- **httpx**: Async HTTP client for MCP server communication
- **cryptography**: Secure credential storage
- **pydantic**: Schema validation for tool parameters
- **FastAPI**: REST endpoints for MCP management

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| MCP server unavailable during AI session | High | Medium | Graceful degradation, offline fallback |
| Malformed tool responses | Medium | High | Strict schema validation, error handling |
| Credential leakage | Low | Critical | Encryption at rest, no logging of secrets |
| Protocol changes (v2.0) | Medium | Medium | Abstraction layer, version detection |
| Performance degradation | Medium | Medium | Caching, async operations, timeouts |

---

## MCP Protocol Specification

### Protocol Overview

MCP is a **client-server protocol** where:
- **MCP Server**: Hosts tools, resources, and prompts
- **MCP Client**: (MindFlow) Discovers and invokes capabilities
- **LLM**: Uses discovered tools to augment responses

```
┌──────────┐         ┌──────────────┐         ┌────────────┐
│   User   │ ◄─────► │   MindFlow   │ ◄─────► │ MCP Server │
│          │         │  (MCP Client)│         │  (Tools)   │
└──────────┘         └──────┬───────┘         └────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   LLM API    │
                     │ (Claude/GPT) │
                     └──────────────┘
```

### Core Concepts

#### 1. Tools

**Definition**: Functions that LLMs can invoke to perform actions.

**Example Tool Schema**:
```json
{
  "name": "search_files",
  "description": "Search for files by name or content pattern",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query (filename or content pattern)"
      },
      "path": {
        "type": "string",
        "description": "Directory to search (optional)",
        "default": "."
      },
      "max_results": {
        "type": "integer",
        "description": "Maximum number of results",
        "default": 10
      }
    },
    "required": ["query"]
  }
}
```

**Tool Invocation Flow**:
```
1. MindFlow discovers tools from MCP server
2. LLM receives tool list in system prompt
3. User asks: "find Python files related to authentication"
4. LLM decides to use search_files tool
5. MindFlow invokes MCP server with parameters
6. Server returns results
7. LLM incorporates results into response
```

#### 2. Resources

**Definition**: Data sources that LLMs can read (files, API responses, database queries).

**Example Resource**:
```json
{
  "uri": "file:///home/user/notes/project.md",
  "name": "Project Notes",
  "mimeType": "text/markdown",
  "description": "Project planning and design notes"
}
```

**Resource Access Pattern**:
```python
# Client requests resource
GET /resources/file:///home/user/notes/project.md

# Server responds with content
{
  "contents": [
    {
      "uri": "file:///home/user/notes/project.md",
      "mimeType": "text/markdown",
      "text": "# Project Notes\n\n..."
    }
  ]
}
```

#### 3. Prompts

**Definition**: Reusable prompt templates with parameters.

**Example Prompt**:
```json
{
  "name": "code_review",
  "description": "Review code for best practices and bugs",
  "arguments": [
    {
      "name": "language",
      "description": "Programming language",
      "required": true
    },
    {
      "name": "focus",
      "description": "Review focus (security, performance, style)",
      "required": false
    }
  ]
}
```

### Protocol Messages

MCP uses **JSON-RPC 2.0** over various transports.

#### Discovery (tools/list)

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "search_files",
        "description": "Search for files",
        "inputSchema": { /* JSON Schema */ }
      },
      {
        "name": "calculate",
        "description": "Perform mathematical calculations",
        "inputSchema": { /* JSON Schema */ }
      }
    ]
  }
}
```

#### Tool Invocation (tools/call)

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "search_files",
    "arguments": {
      "query": "authentication",
      "path": "./src",
      "max_results": 5
    }
  }
}
```

**Response (Success)**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 3 files:\n1. src/auth/login.py\n2. src/auth/token.py\n3. tests/test_auth.py"
      }
    ]
  }
}
```

**Response (Error)**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32603,
    "message": "Tool execution failed",
    "data": {
      "reason": "Permission denied: cannot access ./src"
    }
  }
}
```

### Protocol Capabilities

MCP servers can advertise capabilities during handshake:

```json
{
  "capabilities": {
    "tools": {
      "listChanged": true  // Server can notify of tool changes
    },
    "resources": {
      "subscribe": true,   // Support resource subscriptions
      "listChanged": true
    },
    "prompts": {
      "listChanged": true
    },
    "logging": {}          // Server accepts log messages
  }
}
```

### Error Codes

| Code | Meaning | Handling |
|------|---------|----------|
| -32700 | Parse error | Invalid JSON, retry with valid JSON |
| -32600 | Invalid request | Check request format |
| -32601 | Method not found | Tool/method doesn't exist on server |
| -32602 | Invalid params | Check parameter types/required fields |
| -32603 | Internal error | Server-side failure, log and notify user |
| -32000 to -32099 | Server error | Custom server errors, display to user |

---

## MCP Server Implementations

### Official Python SDK

**Package**: `mcp` (PyPI)
**Repository**: https://github.com/anthropics/python-sdk-mcp
**Status**: Production-ready (v1.0+)

#### Installation

```bash
pip install mcp
```

#### Client Example

```python
from mcp import Client
from mcp.client.stdio import stdio_client
from mcp.types import Tool, TextContent

async def main():
    # Connect to MCP server via stdio
    async with stdio_client("/path/to/mcp-server") as (read, write):
        async with Client(read, write) as client:
            # Initialize connection
            await client.initialize()

            # List available tools
            tools_response = await client.list_tools()
            tools = tools_response.tools

            print(f"Found {len(tools)} tools:")
            for tool in tools:
                print(f"  - {tool.name}: {tool.description}")

            # Invoke a tool
            result = await client.call_tool(
                name="search_files",
                arguments={"query": "test", "max_results": 5}
            )

            print(f"Tool result: {result.content}")
```

#### Server Example (for understanding)

```python
from mcp.server import Server
from mcp.types import Tool, TextContent

server = Server("my-tool-server")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="echo",
            description="Echo back the input message",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {"type": "string"}
                },
                "required": ["message"]
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "echo":
        message = arguments.get("message", "")
        return [TextContent(
            type="text",
            text=f"Echo: {message}"
        )]

    raise ValueError(f"Unknown tool: {name}")
```

### Alternative: HTTP/REST Implementation

For web-based MindFlow, stdio is not ideal. We need HTTP transport.

#### Custom HTTP Client (Recommended)

```python
import httpx
from typing import List, Dict, Any

class MCPHTTPClient:
    """MCP client using HTTP transport."""

    def __init__(self, base_url: str, api_key: str = None):
        self.base_url = base_url.rstrip('/')
        self.session = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
            timeout=30.0
        )
        self._request_id = 0

    async def _call(self, method: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Make JSON-RPC call to MCP server."""
        self._request_id += 1

        payload = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params or {}
        }

        response = await self.session.post(
            f"{self.base_url}/mcp",
            json=payload
        )
        response.raise_for_status()

        result = response.json()

        if "error" in result:
            raise MCPError(result["error"])

        return result.get("result", {})

    async def list_tools(self) -> List[Dict[str, Any]]:
        """Discover available tools."""
        result = await self._call("tools/list")
        return result.get("tools", [])

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Invoke a tool."""
        result = await self._call("tools/call", {
            "name": name,
            "arguments": arguments
        })
        return result

class MCPError(Exception):
    """MCP protocol error."""
    def __init__(self, error_obj: Dict[str, Any]):
        self.code = error_obj.get("code")
        self.message = error_obj.get("message")
        self.data = error_obj.get("data")
        super().__init__(f"MCP Error {self.code}: {self.message}")
```

### Server-Sent Events (SSE) for Streaming

For long-running tool executions, SSE provides progress updates:

```python
async def call_tool_streaming(self, name: str, arguments: Dict[str, Any]):
    """Invoke tool with streaming response."""
    async with self.session.stream(
        "POST",
        f"{self.base_url}/mcp/stream",
        json={
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments}
        }
    ) as response:
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                data = json.loads(line[6:])
                yield data
```

---

## Authentication and Security

### Authentication Methods

#### 1. Bearer Token (Recommended)

**Server Config**:
```json
{
  "name": "My MCP Server",
  "url": "https://mcp.example.com",
  "auth": {
    "type": "bearer",
    "token": "mcp_aBcDeF123456..."
  }
}
```

**Client Implementation**:
```python
headers = {
    "Authorization": f"Bearer {server.auth_token}"
}
```

**Pros**:
- Simple to implement
- Stateless
- Works with most HTTP clients

**Cons**:
- Token must be securely stored
- No built-in expiration (unless JWT)

#### 2. API Key Header

**Server Config**:
```json
{
  "auth": {
    "type": "api_key",
    "header": "X-API-Key",
    "key": "sk_live_abc123..."
  }
}
```

**Client Implementation**:
```python
headers = {
    server.auth_header: server.auth_key
}
```

#### 3. OAuth 2.0 (Future Enhancement)

For enterprise MCP servers with SSO:

```json
{
  "auth": {
    "type": "oauth2",
    "token_url": "https://auth.example.com/token",
    "client_id": "mindflow-client",
    "client_secret": "secret_abc123",
    "scope": "mcp.tools.read mcp.tools.execute"
  }
}
```

**Flow**:
1. User clicks "Connect to MCP Server"
2. Redirect to OAuth provider
3. User grants permissions
4. MindFlow receives access token
5. Token stored encrypted in database

#### 4. No Authentication

For local/trusted MCP servers:

```json
{
  "auth": {
    "type": "none"
  }
}
```

### Credential Storage

**Requirements**:
- Credentials MUST be encrypted at rest
- MUST NOT be logged or displayed in UI
- MUST be isolated per user (if multi-user)

**Implementation**:

```python
from cryptography.fernet import Fernet
import base64
import os

class CredentialStore:
    """Secure credential storage."""

    def __init__(self, encryption_key: bytes = None):
        if encryption_key is None:
            # Load from environment or generate
            encryption_key = os.getenv("MINDFLOW_ENCRYPTION_KEY")
            if not encryption_key:
                encryption_key = Fernet.generate_key()
                # Store securely (e.g., system keyring)

        self.cipher = Fernet(encryption_key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypt credential."""
        encrypted = self.cipher.encrypt(plaintext.encode())
        return base64.b64encode(encrypted).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt credential."""
        encrypted = base64.b64decode(ciphertext.encode())
        decrypted = self.cipher.decrypt(encrypted)
        return decrypted.decode()

# Usage
store = CredentialStore()

# Encrypt before saving to database
encrypted_token = store.encrypt("mcp_secret_token_123")
server.auth_token_encrypted = encrypted_token
db.commit()

# Decrypt when making request
token = store.decrypt(server.auth_token_encrypted)
headers = {"Authorization": f"Bearer {token}"}
```

### Security Best Practices

#### 1. Input Validation

**Validate MCP server URLs**:
```python
from urllib.parse import urlparse

def validate_mcp_url(url: str) -> bool:
    """Validate MCP server URL to prevent SSRF."""
    parsed = urlparse(url)

    # Must be HTTP/HTTPS
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must use http or https")

    # Block localhost/private IPs in production
    if ENV == "production":
        if parsed.hostname in ("localhost", "127.0.0.1", "0.0.0.0"):
            raise ValueError("Cannot connect to localhost in production")

        # Block private IP ranges (10.x, 192.168.x, 172.16-31.x)
        # Implementation left as exercise

    return True
```

#### 2. Tool Parameter Sanitization

**Prevent injection attacks**:
```python
def sanitize_tool_params(params: Dict[str, Any], schema: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and sanitize tool parameters."""
    from jsonschema import validate, ValidationError

    try:
        validate(instance=params, schema=schema)
    except ValidationError as e:
        raise ValueError(f"Invalid parameters: {e.message}")

    # Additional sanitization for specific types
    sanitized = {}
    for key, value in params.items():
        if isinstance(value, str):
            # Strip dangerous characters for shell commands
            value = value.replace(";", "").replace("&", "").replace("|", "")
        sanitized[key] = value

    return sanitized
```

#### 3. Rate Limiting

**Prevent abuse**:
```python
from collections import defaultdict
from datetime import datetime, timedelta

class RateLimiter:
    """Rate limiter for MCP tool invocations."""

    def __init__(self, max_calls: int = 100, window_seconds: int = 60):
        self.max_calls = max_calls
        self.window = timedelta(seconds=window_seconds)
        self.calls = defaultdict(list)

    def check_limit(self, server_id: str) -> bool:
        """Check if rate limit exceeded."""
        now = datetime.now()
        cutoff = now - self.window

        # Remove old calls
        self.calls[server_id] = [
            ts for ts in self.calls[server_id] if ts > cutoff
        ]

        if len(self.calls[server_id]) >= self.max_calls:
            return False

        self.calls[server_id].append(now)
        return True
```

#### 4. Tool Result Validation

**Prevent malicious responses**:
```python
def validate_tool_result(result: Any, max_size: int = 1024 * 1024) -> Any:
    """Validate tool result before sending to LLM."""

    # Check result size (prevent memory exhaustion)
    result_str = str(result)
    if len(result_str) > max_size:
        raise ValueError(f"Tool result too large: {len(result_str)} bytes")

    # Check for sensitive data patterns
    import re

    # Credit card numbers
    if re.search(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b', result_str):
        raise ValueError("Tool result contains credit card number")

    # API keys
    if re.search(r'\b(sk|pk)_[a-zA-Z0-9]{32,}\b', result_str):
        raise ValueError("Tool result contains API key")

    return result
```

---

## Configuration Management

### Database Schema

**MCPServer Model**:
```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class MCPServer(Base):
    """MCP server configuration."""
    __tablename__ = "mcp_servers"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    url = Column(String(1024), nullable=False)

    # Authentication
    auth_type = Column(String(50), default="none")  # bearer, api_key, oauth2, none
    auth_token_encrypted = Column(Text, nullable=True)
    auth_header = Column(String(255), nullable=True)  # For api_key auth

    # Status
    enabled = Column(Boolean, default=True)
    last_connected = Column(DateTime, nullable=True)
    status = Column(String(50), default="unknown")  # connected, disconnected, error
    error_message = Column(Text, nullable=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Cached capabilities
    capabilities = Column(Text, nullable=True)  # JSON string
    tools_cache = Column(Text, nullable=True)  # JSON string of discovered tools
    cache_expires_at = Column(DateTime, nullable=True)
```

**MCPTool Model**:
```python
class MCPTool(Base):
    """Discovered MCP tool."""
    __tablename__ = "mcp_tools"

    id = Column(Integer, primary_key=True)
    server_id = Column(Integer, ForeignKey("mcp_servers.id"), nullable=False)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    input_schema = Column(Text, nullable=False)  # JSON schema

    # Permissions
    enabled = Column(Boolean, default=True)
    requires_confirmation = Column(Boolean, default=False)

    discovered_at = Column(DateTime, default=datetime.utcnow)

    # Composite unique constraint
    __table_args__ = (UniqueConstraint('server_id', 'name'),)
```

**ToolInvocation Model**:
```python
class ToolInvocation(Base):
    """Tool invocation audit log."""
    __tablename__ = "tool_invocations"

    id = Column(Integer, primary_key=True)
    tool_id = Column(Integer, ForeignKey("mcp_tools.id"), nullable=False)

    # Invocation details
    arguments = Column(Text, nullable=False)  # JSON
    result = Column(Text, nullable=True)  # JSON
    error = Column(Text, nullable=True)

    # Timing
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)

    # Status
    status = Column(String(50), nullable=False)  # pending, success, error

    # Context
    user_id = Column(Integer, nullable=True)  # If multi-user
    conversation_id = Column(String(255), nullable=True)
```

### Configuration File (Alternative)

For single-user deployments, YAML config:

```yaml
# config/mcp_servers.yaml
servers:
  - name: "Local File Server"
    url: "http://localhost:8001"
    auth:
      type: none
    enabled: true

  - name: "GitHub API"
    url: "https://mcp.github.example.com"
    auth:
      type: bearer
      token: "${GITHUB_MCP_TOKEN}"  # Environment variable
    enabled: true

  - name: "Calculator Server"
    url: "http://localhost:8002"
    auth:
      type: api_key
      header: "X-API-Key"
      key: "${CALC_API_KEY}"
    enabled: false  # Disabled by default

# Tool permissions
tool_permissions:
  "file_delete":
    enabled: true
    requires_confirmation: true

  "shell_exec":
    enabled: false  # Dangerous tool
```

**Loading Configuration**:
```python
import yaml
import os

def load_mcp_config(config_path: str) -> Dict[str, Any]:
    """Load MCP configuration from YAML."""
    with open(config_path) as f:
        config = yaml.safe_load(f)

    # Expand environment variables
    for server in config.get("servers", []):
        auth = server.get("auth", {})
        if "token" in auth and auth["token"].startswith("${"):
            var_name = auth["token"][2:-1]
            auth["token"] = os.getenv(var_name)
        if "key" in auth and auth["key"].startswith("${"):
            var_name = auth["key"][2:-1]
            auth["key"] = os.getenv(var_name)

    return config
```

### Hybrid Approach (Recommended)

- **Default servers**: YAML config (shipped with MindFlow)
- **User servers**: Database (user-added via UI)
- **Priority**: User DB > Config file

```python
class MCPConfigManager:
    """Manage MCP server configuration."""

    def __init__(self, db_session, config_path: str = None):
        self.db = db_session
        self.config_path = config_path
        self._file_config = None

    def load_file_config(self) -> List[Dict[str, Any]]:
        """Load servers from config file."""
        if not self.config_path or not os.path.exists(self.config_path):
            return []

        if self._file_config is None:
            self._file_config = load_mcp_config(self.config_path)

        return self._file_config.get("servers", [])

    def get_all_servers(self) -> List[MCPServer]:
        """Get all configured servers (DB + file)."""
        servers = []

        # Load from database
        db_servers = self.db.query(MCPServer).all()
        servers.extend(db_servers)

        # Load from config file
        file_servers = self.load_file_config()
        for config in file_servers:
            # Skip if already in database (DB takes precedence)
            if any(s.name == config["name"] for s in servers):
                continue

            # Convert config to MCPServer object (read-only)
            server = MCPServer(
                name=config["name"],
                url=config["url"],
                auth_type=config.get("auth", {}).get("type", "none"),
                enabled=config.get("enabled", True)
            )
            servers.append(server)

        return servers
```

---

## LLM Tool Integration Patterns

### Pattern 1: Function Calling (Recommended)

Modern LLMs (Claude, GPT-4, Llama 3) support function calling natively.

#### Step 1: Convert MCP Tools to LLM Functions

```python
def mcp_tool_to_llm_function(tool: Dict[str, Any]) -> Dict[str, Any]:
    """Convert MCP tool schema to LLM function format."""
    return {
        "name": tool["name"],
        "description": tool["description"],
        "parameters": tool["inputSchema"]
    }

# Example
mcp_tool = {
    "name": "search_files",
    "description": "Search for files by name or content",
    "inputSchema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "max_results": {"type": "integer", "default": 10}
        },
        "required": ["query"]
    }
}

llm_function = mcp_tool_to_llm_function(mcp_tool)
# {
#     "name": "search_files",
#     "description": "Search for files by name or content",
#     "parameters": {
#         "type": "object",
#         "properties": {
#             "query": {"type": "string", "description": "Search query"},
#             "max_results": {"type": "integer", "default": 10}
#         },
#         "required": ["query"]
#     }
# }
```

#### Step 2: Send Tools to LLM

**Claude (Anthropic)**:
```python
import anthropic

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Get available MCP tools
mcp_tools = await mcp_client.list_tools()
llm_tools = [mcp_tool_to_llm_function(t) for t in mcp_tools]

response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    tools=llm_tools,
    messages=[
        {"role": "user", "content": "Find Python files about authentication"}
    ]
)
```

**OpenAI (GPT-4)**:
```python
import openai

client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

response = client.chat.completions.create(
    model="gpt-4-turbo",
    messages=[
        {"role": "user", "content": "Find Python files about authentication"}
    ],
    tools=[
        {"type": "function", "function": llm_tool}
        for llm_tool in llm_tools
    ]
)
```

#### Step 3: Handle Tool Calls

```python
async def handle_llm_response(response, mcp_client):
    """Process LLM response and execute tool calls."""

    if response.stop_reason == "tool_use":
        for content in response.content:
            if content.type == "tool_use":
                tool_name = content.name
                tool_args = content.input
                tool_use_id = content.id

                # Execute MCP tool
                try:
                    result = await mcp_client.call_tool(tool_name, tool_args)
                    tool_result = {
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": result["content"]
                    }
                except Exception as e:
                    tool_result = {
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "is_error": True,
                        "content": str(e)
                    }

                # Send result back to LLM
                followup = client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=1024,
                    messages=[
                        {"role": "user", "content": "Find Python files about authentication"},
                        {"role": "assistant", "content": response.content},
                        {"role": "user", "content": [tool_result]}
                    ]
                )

                return followup.content[0].text
```

### Pattern 2: Prompt Engineering (Fallback)

For LLMs without function calling, use structured prompts.

#### Tool List in System Prompt

```python
def generate_tool_prompt(tools: List[Dict[str, Any]]) -> str:
    """Generate prompt describing available tools."""
    tool_descriptions = []

    for tool in tools:
        params = tool["inputSchema"].get("properties", {})
        param_list = ", ".join(
            f"{name}: {props.get('type', 'any')}"
            for name, props in params.items()
        )

        tool_descriptions.append(
            f"- {tool['name']}({param_list}): {tool['description']}"
        )

    return f"""
You have access to the following tools:

{chr(10).join(tool_descriptions)}

To use a tool, respond with:
TOOL: tool_name
ARGS:
  param1: value1
  param2: value2
END_TOOL

I will execute the tool and provide results.
"""

# Example output:
# You have access to the following tools:
#
# - search_files(query: string, max_results: integer): Search for files by name or content
# - calculate(expression: string): Evaluate mathematical expression
#
# To use a tool, respond with:
# TOOL: tool_name
# ARGS:
#   param1: value1
#   param2: value2
# END_TOOL
```

#### Parsing Tool Calls from Response

```python
import re
import yaml

def parse_tool_call(llm_response: str) -> Optional[Dict[str, Any]]:
    """Parse tool call from LLM response."""
    pattern = r'TOOL:\s*(\w+)\s*ARGS:\s*(.+?)\s*END_TOOL'
    match = re.search(pattern, llm_response, re.DOTALL)

    if not match:
        return None

    tool_name = match.group(1)
    args_yaml = match.group(2)

    try:
        args = yaml.safe_load(args_yaml)
    except yaml.YAMLError:
        return None

    return {"name": tool_name, "arguments": args}

# Example
response = """
I'll search for Python authentication files.

TOOL: search_files
ARGS:
  query: "authentication *.py"
  max_results: 5
END_TOOL
"""

tool_call = parse_tool_call(response)
# {"name": "search_files", "arguments": {"query": "authentication *.py", "max_results": 5}}
```

### Pattern 3: Agentic Workflow

For complex tasks requiring multiple tool calls.

```python
async def agentic_workflow(user_query: str, mcp_client, llm_client):
    """Run agentic workflow with tool chaining."""

    messages = [{"role": "user", "content": user_query}]
    max_iterations = 10

    for i in range(max_iterations):
        # Get LLM response
        response = await llm_client.generate(messages, tools=available_tools)

        # Check if done
        if response.stop_reason == "end_turn":
            return response.content

        # Execute tool calls
        if response.stop_reason == "tool_use":
            tool_results = []

            for tool_use in response.tool_uses:
                result = await mcp_client.call_tool(
                    tool_use.name,
                    tool_use.arguments
                )
                tool_results.append({
                    "tool_use_id": tool_use.id,
                    "result": result
                })

            # Add to message history
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

    return "Maximum iterations reached"
```

---

## Transport Layers

### Comparison

| Transport | Use Case | Pros | Cons |
|-----------|----------|------|------|
| **stdio** | CLI tools, local servers | Simple, no network | Not web-compatible |
| **HTTP/REST** | Web apps, remote servers | Widely supported, firewall-friendly | Polling for long operations |
| **WebSocket** | Real-time updates | Bidirectional, efficient | More complex, proxy issues |
| **SSE (Server-Sent Events)** | Streaming results | Simple, HTTP-based | One-way (server → client) |

### HTTP/REST Implementation

**Endpoint Design**:

```
POST /mcp/initialize
POST /mcp/tools/list
POST /mcp/tools/call
POST /mcp/resources/list
GET  /mcp/resources/{uri}
POST /mcp/prompts/list
POST /mcp/prompts/get
```

**Request/Response Format**:

All endpoints use JSON-RPC 2.0 payload:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Error Handling**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {"details": "Database connection failed"}
  }
}
```

### WebSocket Implementation (Alternative)

For bidirectional communication:

```python
import websockets

async def mcp_websocket_client(uri: str, api_key: str):
    """Connect to MCP server via WebSocket."""

    headers = {"Authorization": f"Bearer {api_key}"}

    async with websockets.connect(uri, extra_headers=headers) as ws:
        # Send initialize
        await ws.send(json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {"capabilities": {}}
        }))

        # Receive response
        response = await ws.recv()
        print(f"Connected: {response}")

        # List tools
        await ws.send(json.dumps({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list"
        }))

        tools_response = await ws.recv()
        print(f"Tools: {tools_response}")
```

### SSE for Streaming (Recommended)

For long-running tool executions:

**Server (FastAPI)**:
```python
from fastapi import FastAPI
from sse_starlette.sse import EventSourceResponse

@app.post("/mcp/tools/call/stream")
async def call_tool_streaming(request: ToolCallRequest):
    async def event_generator():
        tool_name = request.name
        arguments = request.arguments

        yield {
            "event": "start",
            "data": json.dumps({"tool": tool_name, "status": "running"})
        }

        try:
            # Simulated streaming execution
            for i in range(10):
                await asyncio.sleep(0.5)
                yield {
                    "event": "progress",
                    "data": json.dumps({"progress": i * 10})
                }

            result = {"content": [{"type": "text", "text": "Result here"}]}
            yield {
                "event": "result",
                "data": json.dumps(result)
            }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }

    return EventSourceResponse(event_generator())
```

**Client**:
```python
import httpx_sse

async def call_tool_with_progress(tool_name: str, arguments: dict):
    """Call tool and receive streaming updates."""

    async with httpx_sse.aconnect_sse(
        httpx.AsyncClient(),
        "POST",
        f"{base_url}/mcp/tools/call/stream",
        json={"name": tool_name, "arguments": arguments}
    ) as event_source:
        async for sse in event_source.aiter_sse():
            event = sse.event
            data = json.loads(sse.data)

            if event == "start":
                print(f"Started: {data['tool']}")
            elif event == "progress":
                print(f"Progress: {data['progress']}%")
            elif event == "result":
                return data
            elif event == "error":
                raise Exception(data["error"])
```

---

## UI Design Patterns

### MCP Settings Panel

**Location**: Settings → MCP Servers

**Layout**:

```
┌─────────────────────────────────────────────────────┐
│ MCP Servers                                    [+]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ 🟢 Local File Server              [Edit] [×] │   │
│ │ http://localhost:8001                         │   │
│ │ Tools: search_files, read_file, list_dir     │   │
│ │ Last connected: 2 minutes ago                 │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ 🔴 GitHub API                     [Edit] [×] │   │
│ │ https://mcp.github.example.com                │   │
│ │ Error: Authentication failed                  │   │
│ │ Last attempted: 1 hour ago                    │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ ⚪ Calculator (Disabled)          [Edit] [×] │   │
│ │ http://localhost:8002                         │   │
│ │ Never connected                               │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Add/Edit Server Dialog

```
┌──────────────────────────────────────────┐
│ Add MCP Server                      [×]  │
├──────────────────────────────────────────┤
│                                           │
│ Server Name *                            │
│ ┌────────────────────────────────────┐  │
│ │ My MCP Server                      │  │
│ └────────────────────────────────────┘  │
│                                           │
│ Endpoint URL *                           │
│ ┌────────────────────────────────────┐  │
│ │ https://mcp.example.com            │  │
│ └────────────────────────────────────┘  │
│                                           │
│ Authentication                           │
│ ┌────────────────────────────────────┐  │
│ │ Bearer Token            ▼          │  │
│ └────────────────────────────────────┘  │
│                                           │
│ API Token *                              │
│ ┌────────────────────────────────────┐  │
│ │ mcp_*********************          │  │
│ └────────────────────────────────────┘  │
│                                           │
│ ☑ Enable this server                    │
│                                           │
│        [Test Connection]  [Cancel] [Save]│
└──────────────────────────────────────────┘
```

### Tool Permissions Panel

```
┌─────────────────────────────────────────────────────┐
│ Tool Permissions                                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Search: [_______________]  Filter: [All Servers ▼]  │
│                                                      │
│ Local File Server                                   │
│   ☑ search_files         [Allowed]                 │
│   ☑ read_file            [Allowed]                 │
│   ☑ write_file           [Requires Confirmation]   │
│   ☐ delete_file          [Disabled]                │
│                                                      │
│ GitHub API                                          │
│   ☑ search_code          [Allowed]                 │
│   ☑ create_issue         [Requires Confirmation]   │
│   ☑ list_repos           [Allowed]                 │
│                                                      │
│ Calculator                                          │
│   ☑ calculate            [Allowed]                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Tool Usage History

```
┌─────────────────────────────────────────────────────┐
│ Tool Usage History                                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Date: [Last 7 days ▼]  Server: [All ▼]             │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ ✓ search_files                  2:15 PM      │   │
│ │   Server: Local File Server                  │   │
│ │   Arguments: query="authentication"          │   │
│ │   Duration: 1.2s                             │   │
│ │   [View Details]                             │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ ✓ calculate                     2:10 PM      │   │
│ │   Server: Calculator                         │   │
│ │   Arguments: expression="2+2"                │   │
│ │   Duration: 0.3s                             │   │
│ │   [View Details]                             │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ ✗ create_issue                  1:45 PM      │   │
│ │   Server: GitHub API                         │   │
│ │   Error: Authentication failed               │   │
│ │   Duration: 5.2s (timeout)                   │   │
│ │   [View Details] [Retry]                     │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### React Component Structure

```typescript
// MCP Settings Panel
src/components/mcp/
  ├── MCPSettingsPanel.tsx          // Main panel
  ├── ServerList.tsx                 // List of servers
  ├── ServerCard.tsx                 // Individual server display
  ├── ServerDialog.tsx               // Add/Edit server form
  ├── TestConnectionButton.tsx       // Connection test UI
  ├── ToolPermissionsPanel.tsx       // Tool permissions manager
  ├── ToolHistoryPanel.tsx           // Tool usage history
  └── types.ts                       // TypeScript types
```

**Example Component**:

```typescript
// ServerCard.tsx
import React from 'react';
import { Circle, Edit2, X } from 'lucide-react';

interface ServerCardProps {
  server: MCPServer;
  onEdit: (server: MCPServer) => void;
  onDelete: (serverId: string) => void;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  server,
  onEdit,
  onDelete
}) => {
  const statusIcon = {
    connected: <Circle fill="green" className="text-green-500" size={12} />,
    disconnected: <Circle fill="red" className="text-red-500" size={12} />,
    unknown: <Circle className="text-gray-400" size={12} />
  }[server.status];

  return (
    <div className="border rounded-lg p-4 mb-2 hover:bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusIcon}
          <h3 className="font-semibold">{server.name}</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(server)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(server.id)}
            className="p-1 hover:bg-red-100 rounded"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-1">{server.url}</p>

      {server.tools && server.tools.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          Tools: {server.tools.map(t => t.name).join(', ')}
        </p>
      )}

      {server.lastConnected && (
        <p className="text-xs text-gray-400 mt-1">
          Last connected: {formatRelativeTime(server.lastConnected)}
        </p>
      )}

      {server.errorMessage && (
        <p className="text-xs text-red-500 mt-1">
          Error: {server.errorMessage}
        </p>
      )}
    </div>
  );
};
```

---

## Testing Strategies

### Unit Tests

**Test MCP Client**:

```python
# tests/unit/test_mcp_client.py
import pytest
from unittest.mock import AsyncMock, patch
from mindflow.services.mcp_client import MCPHTTPClient, MCPError

@pytest.mark.asyncio
async def test_list_tools_success():
    """Test successful tool discovery."""
    client = MCPHTTPClient("http://localhost:8001")

    # Mock HTTP response
    with patch.object(client.session, 'post', new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "tools": [
                    {
                        "name": "echo",
                        "description": "Echo input",
                        "inputSchema": {
                            "type": "object",
                            "properties": {"message": {"type": "string"}},
                            "required": ["message"]
                        }
                    }
                ]
            }
        }

        tools = await client.list_tools()

        assert len(tools) == 1
        assert tools[0]["name"] == "echo"

@pytest.mark.asyncio
async def test_call_tool_error():
    """Test tool invocation error handling."""
    client = MCPHTTPClient("http://localhost:8001")

    with patch.object(client.session, 'post', new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = {
            "jsonrpc": "2.0",
            "id": 2,
            "error": {
                "code": -32603,
                "message": "Tool not found"
            }
        }

        with pytest.raises(MCPError) as exc_info:
            await client.call_tool("nonexistent", {})

        assert exc_info.value.code == -32603
        assert "Tool not found" in str(exc_info.value)
```

**Test Configuration Management**:

```python
# tests/unit/test_mcp_config.py
import pytest
from mindflow.services.mcp_config import MCPConfigManager
from mindflow.models import MCPServer

def test_get_all_servers_merges_db_and_file(db_session, tmp_path):
    """Test that DB servers take precedence over file servers."""

    # Create config file
    config_file = tmp_path / "mcp_servers.yaml"
    config_file.write_text("""
servers:
  - name: "File Server"
    url: "http://file.example.com"
    enabled: true
  - name: "Shared Server"
    url: "http://file.shared.com"
    enabled: true
""")

    # Add server to database with same name
    db_server = MCPServer(
        name="Shared Server",
        url="http://db.shared.com",  # Different URL
        enabled=False
    )
    db_session.add(db_server)
    db_session.commit()

    # Load configuration
    manager = MCPConfigManager(db_session, str(config_file))
    servers = manager.get_all_servers()

    # Should have 2 servers: File Server from file, Shared Server from DB
    assert len(servers) == 2

    file_server = next(s for s in servers if s.name == "File Server")
    assert file_server.url == "http://file.example.com"

    shared_server = next(s for s in servers if s.name == "Shared Server")
    assert shared_server.url == "http://db.shared.com"  # DB wins
    assert shared_server.enabled == False
```

### Integration Tests

**Test with Mock MCP Server**:

```python
# tests/integration/test_mcp_integration.py
import pytest
import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Mock MCP Server
app = FastAPI()

@app.post("/mcp")
async def mcp_endpoint(request: dict):
    method = request["method"]

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": request["id"],
            "result": {
                "tools": [
                    {
                        "name": "test_tool",
                        "description": "Test tool",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "input": {"type": "string"}
                            }
                        }
                    }
                ]
            }
        }

    elif method == "tools/call":
        return {
            "jsonrpc": "2.0",
            "id": request["id"],
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": f"Executed with: {request['params']['arguments']}"
                    }
                ]
            }
        }

@pytest.mark.asyncio
async def test_full_mcp_workflow():
    """Test complete MCP workflow: discover, invoke, handle result."""

    # Start mock server
    client = TestClient(app)
    base_url = "http://testserver"

    # Initialize MCP client
    mcp_client = MCPHTTPClient(base_url)

    # Discover tools
    tools = await mcp_client.list_tools()
    assert len(tools) == 1
    assert tools[0]["name"] == "test_tool"

    # Invoke tool
    result = await mcp_client.call_tool("test_tool", {"input": "hello"})
    assert "Executed with" in result["content"][0]["text"]
```

### End-to-End Tests

**Test UI Workflow**:

```typescript
// tests/e2e/mcp-config.spec.ts
import { test, expect } from '@playwright/test';

test('user can add and test MCP server', async ({ page }) => {
  await page.goto('/settings/mcp');

  // Click Add Server button
  await page.click('button:has-text("Add Server")');

  // Fill in server details
  await page.fill('input[name="name"]', 'Test Server');
  await page.fill('input[name="url"]', 'http://localhost:8001');
  await page.selectOption('select[name="authType"]', 'none');

  // Test connection
  await page.click('button:has-text("Test Connection")');

  // Wait for success message
  await expect(page.locator('text=Connection successful')).toBeVisible();

  // Save server
  await page.click('button:has-text("Save")');

  // Verify server appears in list
  await expect(page.locator('text=Test Server')).toBeVisible();
  await expect(page.locator('text=http://localhost:8001')).toBeVisible();
});

test('user can view tool usage history', async ({ page }) => {
  await page.goto('/settings/mcp/history');

  // Should show recent tool invocations
  await expect(page.locator('text=Tool Usage History')).toBeVisible();

  // Click on a tool invocation
  await page.click('button:has-text("View Details")').first();

  // Should show invocation details
  await expect(page.locator('text=Arguments')).toBeVisible();
  await expect(page.locator('text=Result')).toBeVisible();
  await expect(page.locator('text=Duration')).toBeVisible();
});
```

### Protocol Compliance Tests

**Test MCP Protocol Conformance**:

```python
# tests/protocol/test_mcp_compliance.py
import pytest

@pytest.mark.asyncio
async def test_jsonrpc_version():
    """MCP must use JSON-RPC 2.0."""
    client = MCPHTTPClient("http://localhost:8001")

    # Spy on HTTP requests
    requests = []
    original_post = client.session.post

    async def spy_post(*args, **kwargs):
        requests.append(kwargs.get('json'))
        return await original_post(*args, **kwargs)

    client.session.post = spy_post

    await client.list_tools()

    # Verify JSON-RPC 2.0 format
    request = requests[0]
    assert request["jsonrpc"] == "2.0"
    assert "id" in request
    assert "method" in request

@pytest.mark.asyncio
async def test_tool_schema_validation():
    """Tools must have valid JSON Schema."""
    from jsonschema import validate, ValidationError

    client = MCPHTTPClient("http://localhost:8001")
    tools = await client.list_tools()

    for tool in tools:
        assert "name" in tool
        assert "description" in tool
        assert "inputSchema" in tool

        # Validate inputSchema is valid JSON Schema
        schema = tool["inputSchema"]
        assert schema["type"] == "object"
        assert "properties" in schema
```

---

## Performance Considerations

### Caching Strategy

**Tool Discovery Caching**:

```python
from datetime import datetime, timedelta
import json

class MCPClientWithCache:
    """MCP client with intelligent caching."""

    def __init__(self, base_url: str, cache_ttl: int = 300):
        self.client = MCPHTTPClient(base_url)
        self.cache_ttl = timedelta(seconds=cache_ttl)
        self._tools_cache = None
        self._tools_cache_time = None

    async def list_tools(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """List tools with caching."""
        now = datetime.now()

        # Check cache validity
        if (not force_refresh and
            self._tools_cache is not None and
            self._tools_cache_time is not None and
            now - self._tools_cache_time < self.cache_ttl):
            return self._tools_cache

        # Fetch from server
        tools = await self.client.list_tools()

        # Update cache
        self._tools_cache = tools
        self._tools_cache_time = now

        return tools
```

**Database Query Optimization**:

```python
from sqlalchemy import select
from sqlalchemy.orm import joinedload

async def get_servers_with_tools(db_session):
    """Efficiently load servers with their tools."""

    # Use joinedload to avoid N+1 queries
    query = (
        select(MCPServer)
        .options(joinedload(MCPServer.tools))
        .where(MCPServer.enabled == True)
    )

    result = await db_session.execute(query)
    servers = result.scalars().unique().all()

    return servers
```

### Async Operations

**Parallel Tool Invocation**:

```python
import asyncio

async def invoke_tools_parallel(invocations: List[Dict[str, Any]]) -> List[Any]:
    """Invoke multiple tools in parallel."""

    async def invoke_one(inv: Dict[str, Any]):
        try:
            client = get_mcp_client(inv["server_id"])
            result = await client.call_tool(inv["tool_name"], inv["arguments"])
            return {"success": True, "result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # Run all invocations concurrently
    results = await asyncio.gather(*[
        invoke_one(inv) for inv in invocations
    ])

    return results
```

### Timeout Handling

```python
import asyncio

async def call_tool_with_timeout(
    client: MCPHTTPClient,
    tool_name: str,
    arguments: Dict[str, Any],
    timeout: float = 30.0
) -> Dict[str, Any]:
    """Call tool with timeout."""

    try:
        result = await asyncio.wait_for(
            client.call_tool(tool_name, arguments),
            timeout=timeout
        )
        return result
    except asyncio.TimeoutError:
        raise MCPError({
            "code": -32000,
            "message": f"Tool execution timed out after {timeout}s"
        })
```

### Connection Pooling

```python
import httpx

class MCPClientPool:
    """Pool of MCP clients for concurrent requests."""

    def __init__(self, base_url: str, pool_size: int = 10):
        self.base_url = base_url
        self.session = httpx.AsyncClient(
            limits=httpx.Limits(
                max_keepalive_connections=pool_size,
                max_connections=pool_size * 2
            )
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.session.aclose()
```

### Memory Management

**Limit Result Size**:

```python
MAX_RESULT_SIZE = 1024 * 1024  # 1 MB

async def call_tool_safe(client: MCPHTTPClient, tool_name: str, arguments: dict):
    """Call tool with result size limit."""

    result = await client.call_tool(tool_name, arguments)

    # Check result size
    result_str = json.dumps(result)
    if len(result_str) > MAX_RESULT_SIZE:
        # Truncate and warn
        result = {
            "content": [
                {
                    "type": "text",
                    "text": f"[Result truncated: {len(result_str)} bytes > {MAX_RESULT_SIZE} bytes]"
                }
            ]
        }

    return result
```

---

## Technology Stack Decisions

### Backend Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Web Framework** | FastAPI | Already used in MindFlow, async support, OpenAPI generation |
| **MCP Client** | Custom HTTP client | Official SDK is stdio-based, need HTTP for web |
| **Database** | SQLite | Portable, no setup, sufficient for single-user |
| **ORM** | SQLAlchemy 2.0 | Type-safe, async support, widely used |
| **Validation** | Pydantic | FastAPI integration, JSON Schema validation |
| **Encryption** | cryptography (Fernet) | Symmetric encryption for credentials |
| **HTTP Client** | httpx | Async, modern, well-maintained |
| **Testing** | pytest + pytest-asyncio | Standard Python testing, async support |

### Frontend Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Framework** | React 19 | Already used in MindFlow |
| **State Management** | Zustand | Already used, simple, no boilerplate |
| **HTTP Client** | axios | Already in package.json, widely used |
| **UI Components** | Custom + lucide-react | Consistent with existing UI |
| **Form Handling** | Controlled components | React best practice |
| **TypeScript** | Yes | Type safety, better DX |
| **Testing** | Vitest + Testing Library | Fast, modern, React-focused |

### Dependencies to Add

**Backend** (requirements.txt):
```
# MCP support
httpx==0.28.1              # Already present
cryptography==43.0.0       # For credential encryption
jsonschema==4.23.0         # Tool parameter validation

# Optional: SSE support
sse-starlette==1.8.2       # Server-Sent Events for streaming
```

**Frontend** (package.json):
```json
{
  "dependencies": {
    "axios": "^1.13.2",     // Already present
    "react": "^19.2.0",     // Already present
    "zustand": "^5.0.8"     // Already present
  }
}
```

### Architecture Decisions

#### Decision 1: HTTP Transport Over stdio

**Chosen**: HTTP/REST with JSON-RPC over HTTP
**Alternative**: Official MCP SDK with stdio transport

**Rationale**:
- MindFlow has web UI (React frontend)
- stdio requires process spawning, not suitable for browser
- HTTP is firewall-friendly, works with remote servers
- Can still support local servers via localhost

**Trade-offs**:
- Need to implement custom HTTP client (official SDK is stdio)
- Less "official" but more practical for web apps

#### Decision 2: SQLite Database for Configuration

**Chosen**: SQLite with SQLAlchemy
**Alternative**: YAML config files only

**Rationale**:
- Users need to add servers via UI (not just config files)
- Database allows audit logging (tool invocation history)
- SQLite is portable, no setup required
- Can still support YAML for default servers

**Trade-offs**:
- More complex than files
- Need migration strategy

#### Decision 3: Zustand for MCP State

**Chosen**: Zustand store for MCP servers and tools
**Alternative**: React Context API

**Rationale**:
- Already used in MindFlow for canvas state
- Simple, no boilerplate
- Good performance for frequent updates

**Trade-offs**:
- Another state management pattern (but already in use)

---

## Implementation Recommendations

### Phase 0: Research & Design (COMPLETE)

This document covers:
- MCP protocol understanding
- Technology stack selection
- Architecture decisions

### Phase 1: Core MCP Client (Week 1)

**Priority**: P0 (Foundation)

1. **Implement HTTP MCP Client**
   - `MCPHTTPClient` class with JSON-RPC over HTTP
   - Tool discovery (`tools/list`)
   - Tool invocation (`tools/call`)
   - Error handling and retries

2. **Database Models**
   - `MCPServer` model with SQLAlchemy
   - `MCPTool` model
   - `ToolInvocation` model for audit log

3. **Credential Storage**
   - `CredentialStore` with Fernet encryption
   - Environment variable for encryption key

4. **Unit Tests**
   - Test MCP client with mocked HTTP responses
   - Test database models
   - Test credential encryption/decryption

### Phase 2: Configuration UI (Week 2)

**Priority**: P1 (User Story 1 & 2)

1. **Backend API**
   - `POST /api/mcp/servers` - Add server
   - `GET /api/mcp/servers` - List servers
   - `PUT /api/mcp/servers/{id}` - Update server
   - `DELETE /api/mcp/servers/{id}` - Delete server
   - `POST /api/mcp/servers/{id}/test` - Test connection

2. **Frontend Components**
   - `MCPSettingsPanel` - Main settings UI
   - `ServerList` - Display configured servers
   - `ServerDialog` - Add/Edit server form
   - `TestConnectionButton` - Connection test

3. **State Management**
   - Zustand store for MCP servers
   - React hooks for server operations

4. **Integration Tests**
   - Test full UI workflow (add, edit, delete, test)
   - Test API endpoints

### Phase 3: LLM Tool Integration (Week 3)

**Priority**: P2 (User Story 3)

1. **Tool Discovery Service**
   - Discover tools from all connected servers
   - Convert MCP tools to LLM function format
   - Cache tool definitions

2. **LLM Integration**
   - Inject tools into LLM system prompt
   - Handle tool calls from LLM responses
   - Execute tools via MCP client
   - Return results to LLM

3. **Agentic Workflow**
   - Multi-turn conversation with tool calls
   - Tool chaining support
   - Error handling and fallbacks

4. **End-to-End Tests**
   - Test AI discovering and using tools
   - Test tool call execution
   - Test error scenarios

### Phase 4: Advanced Features (Week 4)

**Priority**: P3 (User Story 4 & 5)

1. **Tool Usage History**
   - UI panel showing recent invocations
   - Detail view with parameters and results
   - Filtering and search

2. **Tool Permissions**
   - UI for enabling/disabling tools
   - Confirmation dialogs for sensitive tools
   - Permission enforcement

3. **Performance Optimization**
   - Connection pooling
   - Parallel tool invocation
   - Result caching

4. **Documentation**
   - User guide for adding MCP servers
   - Developer guide for creating MCP servers
   - Troubleshooting guide

### Testing Strategy Summary

1. **Unit Tests** (80% coverage target)
   - All service classes
   - Database models
   - Utility functions

2. **Integration Tests**
   - API endpoints
   - MCP client with mock server
   - Database operations

3. **E2E Tests**
   - UI workflows
   - Full tool invocation flow
   - Error scenarios

4. **Protocol Compliance Tests**
   - JSON-RPC 2.0 conformance
   - MCP spec compliance
   - Schema validation

### Security Checklist

- [ ] Credentials encrypted at rest
- [ ] No credentials in logs
- [ ] URL validation (SSRF prevention)
- [ ] Parameter sanitization
- [ ] Rate limiting
- [ ] Result size limits
- [ ] Tool permission enforcement
- [ ] Audit logging

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tool discovery | < 2s | Time to fetch tools from server |
| Tool invocation | < 5s | 90th percentile response time |
| UI responsiveness | < 200ms | Time to render server list |
| Connection test | < 3s | Time to test server connection |
| History load | < 1s | Time to load 100 invocations |

---

## References

### Official Documentation

- **MCP Specification**: https://spec.modelcontextprotocol.io/
- **MCP Python SDK**: https://github.com/anthropics/python-sdk-mcp
- **JSON-RPC 2.0**: https://www.jsonrpc.org/specification

### Related Projects

- **Claude Desktop MCP**: Built-in MCP support in Claude desktop app
- **MCP Servers**: https://github.com/anthropics/mcp-servers (example servers)
- **LangChain MCP**: Integration with LangChain framework

### Technical Resources

- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **SQLAlchemy 2.0**: https://docs.sqlalchemy.org/en/20/
- **Pydantic**: https://docs.pydantic.dev/
- **React Function Calling**: Anthropic/OpenAI API docs
- **JSON Schema**: https://json-schema.org/

---

## Appendix: Example MCP Servers to Test With

### 1. Local File Server

Simple MCP server for file operations:

```python
# example_mcp_server.py
from fastapi import FastAPI
import os
import glob

app = FastAPI()

@app.post("/mcp")
async def mcp_handler(request: dict):
    method = request["method"]
    params = request.get("params", {})

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": request["id"],
            "result": {
                "tools": [
                    {
                        "name": "search_files",
                        "description": "Search for files matching pattern",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "pattern": {"type": "string"},
                                "path": {"type": "string", "default": "."}
                            },
                            "required": ["pattern"]
                        }
                    }
                ]
            }
        }

    elif method == "tools/call":
        name = params["name"]
        args = params["arguments"]

        if name == "search_files":
            pattern = args["pattern"]
            path = args.get("path", ".")
            matches = glob.glob(f"{path}/**/{pattern}", recursive=True)

            return {
                "jsonrpc": "2.0",
                "id": request["id"],
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Found {len(matches)} files:\n" + "\n".join(matches[:10])
                        }
                    ]
                }
            }

# Run with: uvicorn example_mcp_server:app --port 8001
```

### 2. Calculator Server

```python
# calculator_mcp_server.py
from fastapi import FastAPI
import re

app = FastAPI()

@app.post("/mcp")
async def mcp_handler(request: dict):
    method = request["method"]
    params = request.get("params", {})

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": request["id"],
            "result": {
                "tools": [
                    {
                        "name": "calculate",
                        "description": "Evaluate mathematical expression",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "expression": {"type": "string"}
                            },
                            "required": ["expression"]
                        }
                    }
                ]
            }
        }

    elif method == "tools/call":
        name = params["name"]
        args = params["arguments"]

        if name == "calculate":
            expr = args["expression"]

            # Sanitize expression
            if not re.match(r'^[0-9+\-*/().\s]+$', expr):
                return {
                    "jsonrpc": "2.0",
                    "id": request["id"],
                    "error": {
                        "code": -32602,
                        "message": "Invalid expression"
                    }
                }

            try:
                result = eval(expr)
                return {
                    "jsonrpc": "2.0",
                    "id": request["id"],
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": f"{expr} = {result}"
                            }
                        ]
                    }
                }
            except Exception as e:
                return {
                    "jsonrpc": "2.0",
                    "id": request["id"],
                    "error": {
                        "code": -32603,
                        "message": str(e)
                    }
                }

# Run with: uvicorn calculator_mcp_server:app --port 8002
```

---

**Research Complete**: This document provides comprehensive technical research for implementing MCP server integration in MindFlow. Next steps: Create data models, API contracts, quickstart guide, and implementation plan.
