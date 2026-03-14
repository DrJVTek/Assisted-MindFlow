# API Contract: MCP Client Connections

**Prefix**: `/api/mcp-connections`

Management endpoints for MindFlow's outbound MCP client connections.

## Endpoints

### POST /api/mcp-connections
Add a new external MCP server connection.

**Request**:
```json
{
  "name": "File System",
  "transport_type": "stdio",
  "config": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/docs"]
  }
}
```

Alternative configs:
```json
// SSE transport
{ "name": "Web Search", "transport_type": "sse", "config": { "url": "http://localhost:3001/sse" } }

// Streamable HTTP transport
{ "name": "Database", "transport_type": "streamable_http", "config": { "url": "http://localhost:3002/mcp" } }
```

**Response** (201):
```json
{
  "id": "uuid",
  "name": "File System",
  "transport_type": "stdio",
  "config": { "command": "npx", "args": ["..."] },
  "status": "connected",
  "discovered_tools": [
    { "name": "read_file", "description": "Read file contents", "input_schema": { "type": "object", "properties": { "path": { "type": "string" } } } },
    { "name": "write_file", "description": "Write to a file", "input_schema": { "..." } }
  ],
  "created_at": "2026-03-14T10:00:00Z"
}
```

**Behavior**: Connects to the MCP server, performs tool discovery, and returns the connection with discovered tools.

**Errors**:
- 400: Invalid transport type or missing config fields
- 502: Cannot connect to MCP server
- 504: MCP server connection timed out

---

### GET /api/mcp-connections
List all external MCP server connections.

**Response** (200):
```json
{
  "connections": [
    {
      "id": "uuid",
      "name": "File System",
      "transport_type": "stdio",
      "status": "connected",
      "tool_count": 5,
      "created_at": "2026-03-14T10:00:00Z"
    }
  ]
}
```

---

### GET /api/mcp-connections/{connection_id}
Get connection details including discovered tools.

**Response** (200): Full connection object with `discovered_tools`.

---

### DELETE /api/mcp-connections/{connection_id}
Disconnect and remove an MCP server connection.

**Response** (200):
```json
{ "message": "MCP connection removed" }
```

---

### POST /api/mcp-connections/{connection_id}/refresh
Re-discover tools from the connected MCP server.

**Response** (200): Updated connection with refreshed `discovered_tools`.

---

### GET /api/mcp-connections/tools
List all available tools across all connected MCP servers.

**Response** (200):
```json
{
  "tools": [
    {
      "connection_id": "uuid",
      "connection_name": "File System",
      "name": "read_file",
      "description": "Read file contents",
      "input_schema": { "..." }
    }
  ]
}
```

---

### POST /api/mcp-connections/{connection_id}/tools/{tool_name}/invoke
Manually invoke an MCP tool (for testing or direct use).

**Request**:
```json
{
  "arguments": { "path": "/home/user/docs/readme.md" }
}
```

**Response** (200):
```json
{
  "result": "# README\n\nThis is the readme content...",
  "is_error": false
}
```

**Errors**:
- 404: Connection or tool not found
- 502: MCP server error during tool execution
- 504: Tool execution timed out
