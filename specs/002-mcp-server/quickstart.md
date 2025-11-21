# MCP Server Integration - Quickstart Guide

**Feature**: 002-mcp-server
**Created**: 2025-11-21
**Audience**: Developers implementing this feature

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Key Components](#key-components)
3. [5-Minute Walkthrough](#5-minute-walkthrough)
4. [Implementation Phases](#implementation-phases)
5. [Testing Checklist](#testing-checklist)
6. [Common Issues](#common-issues)
7. [Example MCP Servers](#example-mcp-servers)
8. [Architecture Diagrams](#architecture-diagrams)

---

## Feature Overview

### What is MCP?

**Model Context Protocol (MCP)** is an open standard that enables AI assistants to:
- **Discover tools** from external servers
- **Invoke tools** with structured parameters
- **Access resources** (files, APIs, databases)
- **Use prompt templates** for consistent interactions

Think of MCP as a "plugin system" for AI assistants.

### Why MCP for MindFlow?

MindFlow currently operates on static graph data. MCP integration enables:

1. **Dynamic Data**: LLMs can pull live data into reasoning graphs
2. **Action Capabilities**: LLMs can perform operations (file search, calculations, API calls)
3. **Extensibility**: Users add capabilities without modifying MindFlow code
4. **Ecosystem**: Leverage growing MCP server marketplace

### Feature Goals

| Goal | Success Metric |
|------|---------------|
| **Easy Configuration** | Users can add MCP server in < 2 minutes |
| **Reliable Tool Discovery** | 95%+ success rate for tool discovery |
| **Fast Tool Invocation** | < 5 seconds for 90% of tool calls |
| **Transparent Usage** | Users can view complete tool history |
| **Secure by Default** | Credentials encrypted, permissions enforced |

### User Journey

```
1. User opens MCP Settings
   ↓
2. User clicks "Add Server"
   ↓
3. User enters server URL and auth token
   ↓
4. User clicks "Test Connection"
   ↓
5. System discovers tools (e.g., search_files, calculate)
   ↓
6. User saves configuration
   ↓
7. User asks AI: "find Python files about authentication"
   ↓
8. AI discovers search_files tool
   ↓
9. AI invokes tool with query="authentication *.py"
   ↓
10. Tool returns file list
    ↓
11. AI presents results to user
```

---

## Key Components

### Backend Architecture

```
src/mindflow/
├── api/routes/
│   └── mcp.py                    # REST API endpoints
├── services/
│   ├── mcp_client.py             # HTTP MCP client
│   ├── mcp_config.py             # Configuration management
│   ├── mcp_discovery.py          # Tool discovery service
│   ├── mcp_invocation.py         # Tool invocation handler
│   └── llm_integration.py        # LLM function calling
├── models/
│   ├── mcp_server.py             # MCPServer SQLAlchemy model
│   ├── mcp_tool.py               # MCPTool model
│   ├── mcp_resource.py           # MCPResource model
│   ├── mcp_prompt.py             # MCPPrompt model
│   └── tool_invocation.py        # ToolInvocation audit log
└── schemas/
    └── mcp_schemas.py            # Pydantic API schemas
```

### Frontend Architecture

```
frontend/src/
├── components/mcp/
│   ├── MCPSettingsPanel.tsx      # Main settings UI
│   ├── ServerList.tsx            # Server list display
│   ├── ServerCard.tsx            # Individual server card
│   ├── ServerDialog.tsx          # Add/Edit server form
│   ├── TestConnectionButton.tsx  # Connection test UI
│   ├── ToolPermissionsPanel.tsx  # Tool permissions manager
│   └── ToolHistoryPanel.tsx      # Tool usage history
├── stores/
│   └── mcpStore.ts               # Zustand state management
├── services/
│   └── mcpApi.ts                 # API client
└── types/
    └── mcp.ts                    # TypeScript types
```

### Core Classes

#### 1. MCPHTTPClient (Backend)

**Purpose**: Communicate with MCP servers using HTTP transport

**Key Methods**:
```python
class MCPHTTPClient:
    async def list_tools() -> List[Dict[str, Any]]
    async def call_tool(name: str, args: dict) -> Dict[str, Any]
    async def list_resources() -> List[Dict[str, Any]]
    async def read_resource(uri: str) -> Dict[str, Any]
```

**Example Usage**:
```python
client = MCPHTTPClient("http://localhost:8001", api_key="mcp_abc123")
tools = await client.list_tools()
result = await client.call_tool("search_files", {"query": "test"})
```

#### 2. MCPConfigManager (Backend)

**Purpose**: Manage server configurations from DB and files

**Key Methods**:
```python
class MCPConfigManager:
    def get_all_servers() -> List[MCPServer]
    def get_enabled_servers() -> List[MCPServer]
    def test_connection(server_id: int) -> ConnectionTestResponse
    def discover_tools(server_id: int) -> ToolDiscoveryResponse
```

#### 3. ToolInvoker (Backend)

**Purpose**: Execute MCP tools and log invocations

**Key Methods**:
```python
class ToolInvoker:
    async def invoke(tool_id: int, arguments: dict) -> ToolInvocation
    async def get_history(filters: dict) -> List[ToolInvocation]
```

#### 4. LLMIntegration (Backend)

**Purpose**: Convert MCP tools to LLM functions

**Key Methods**:
```python
class LLMIntegration:
    def get_available_functions() -> List[Dict[str, Any]]
    async def handle_tool_calls(llm_response) -> str
```

#### 5. useMCPStore (Frontend)

**Purpose**: Zustand store for MCP state

**Key State**:
```typescript
interface MCPState {
  servers: MCPServer[];
  tools: MCPTool[];
  invocations: ToolInvocation[];

  // Actions
  setServers(servers: MCPServer[]): void;
  addServer(server: MCPServer): void;
  updateServer(id: number, updates: Partial<MCPServer>): void;
  // ...
}
```

---

## 5-Minute Walkthrough

### Prerequisites

- MindFlow backend running (http://localhost:8000)
- MindFlow frontend running (http://localhost:5173)
- Example MCP server running (http://localhost:8001)

### Step 1: Start Example MCP Server

```bash
# In specs/002-mcp-server/examples/
python file_server.py

# Output:
# INFO:     Started server process [12345]
# INFO:     Waiting for application startup.
# INFO:     Application startup complete.
# INFO:     Uvicorn running on http://127.0.0.1:8001
```

### Step 2: Open MCP Settings

1. Open MindFlow UI: http://localhost:5173
2. Click **Settings** (gear icon)
3. Click **MCP Servers** tab

### Step 3: Add Server

1. Click **"+ Add Server"** button
2. Fill in form:
   - **Name**: `Local File Server`
   - **URL**: `http://localhost:8001`
   - **Auth Type**: `None`
3. Click **"Test Connection"**
4. Wait for success message: `✓ Connected successfully. Found 3 tools.`
5. Click **"Save"**

### Step 4: Verify Tools

1. Navigate to **Tool Permissions** tab
2. You should see:
   - `search_files` (Enabled)
   - `read_file` (Enabled)
   - `list_directory` (Enabled)

### Step 5: Test AI Tool Usage

1. Open a MindFlow canvas
2. Ask AI: `"Find all Python files in the current directory"`
3. AI response should include:
   ```
   I'll search for Python files using the search_files tool.

   [Tool: search_files]
   Arguments: {"query": "*.py", "path": "."}

   Found 5 Python files:
   1. server.py
   2. models.py
   3. routes.py
   4. schemas.py
   5. tests.py
   ```

### Step 6: View History

1. Navigate to **Tool History** tab
2. You should see recent invocation:
   - **Tool**: `search_files`
   - **Status**: ✓ Success
   - **Duration**: 234 ms
   - **Arguments**: `{"query": "*.py", "path": "."}`
3. Click **"View Details"** to see full result

**Congratulations!** You've successfully configured and used an MCP server.

---

## Implementation Phases

### Phase 1: Core MCP Client (Week 1)

**Goal**: Implement HTTP-based MCP client and database models

**Tasks**:
1. ✅ Create database models (MCPServer, MCPTool, ToolInvocation)
2. ✅ Implement MCPHTTPClient with JSON-RPC over HTTP
3. ✅ Implement CredentialStore with encryption
4. ✅ Write unit tests (80% coverage)

**Deliverables**:
- `src/mindflow/models/mcp_*.py`
- `src/mindflow/services/mcp_client.py`
- `src/mindflow/services/credential_store.py`
- `tests/unit/test_mcp_client.py`

**Testing**:
```bash
# Run unit tests
pytest tests/unit/test_mcp_client.py -v

# Expected output:
# test_list_tools_success ✓
# test_list_tools_connection_error ✓
# test_call_tool_success ✓
# test_call_tool_invalid_params ✓
# test_call_tool_timeout ✓
```

**Definition of Done**:
- [ ] All models created with migrations
- [ ] MCP client can list tools and invoke tools
- [ ] Credentials encrypted at rest
- [ ] 80%+ test coverage
- [ ] No hardcoded values

---

### Phase 2: Configuration UI (Week 2)

**Goal**: Build UI for managing MCP servers

**Tasks**:
1. ✅ Create REST API endpoints (`/api/mcp/servers`)
2. ✅ Create React components (ServerList, ServerDialog)
3. ✅ Implement Zustand store
4. ✅ Add connection testing functionality

**Deliverables**:
- `src/mindflow/api/routes/mcp.py`
- `frontend/src/components/mcp/`
- `frontend/src/stores/mcpStore.ts`
- `tests/integration/test_mcp_api.py`

**Testing**:
```bash
# Backend API tests
pytest tests/integration/test_mcp_api.py -v

# Frontend component tests
cd frontend && npm test -- mcp

# E2E tests
cd frontend && npm run test:e2e -- mcp-config.spec.ts
```

**Definition of Done**:
- [ ] Users can add/edit/delete servers via UI
- [ ] Connection test shows success/error status
- [ ] Tools are discovered and displayed
- [ ] Form validation prevents invalid inputs
- [ ] All API endpoints have integration tests
- [ ] E2E tests cover full workflow

---

### Phase 3: LLM Tool Integration (Week 3)

**Goal**: Enable AI to discover and use MCP tools

**Tasks**:
1. ✅ Implement tool discovery service
2. ✅ Convert MCP tools to LLM function format
3. ✅ Handle tool calls in LLM responses
4. ✅ Implement agentic workflow (multi-turn)

**Deliverables**:
- `src/mindflow/services/mcp_discovery.py`
- `src/mindflow/services/llm_integration.py`
- `src/mindflow/services/mcp_invocation.py`
- `tests/integration/test_llm_mcp.py`

**Testing**:
```bash
# Test tool discovery
pytest tests/integration/test_mcp_discovery.py -v

# Test LLM integration
pytest tests/integration/test_llm_mcp.py -v

# Test end-to-end AI workflow
pytest tests/e2e/test_ai_tool_usage.py -v
```

**Example Test**:
```python
async def test_ai_uses_mcp_tool():
    """Test AI discovers and invokes MCP tool."""
    # Setup
    client = TestClient(app)

    # Add MCP server
    response = client.post("/api/mcp/servers", json={
        "name": "Test Server",
        "url": "http://localhost:8001",
        "auth_type": "none"
    })
    assert response.status_code == 201

    # Discover tools
    response = client.post("/api/mcp/servers/1/discover")
    assert response.status_code == 200
    assert response.json()["tools_discovered"] > 0

    # AI query
    response = client.post("/api/chat", json={
        "message": "Find Python files"
    })

    # Verify tool was called
    invocations = client.get("/api/mcp/invocations").json()["invocations"]
    assert len(invocations) > 0
    assert invocations[0]["tool_name"] == "search_files"
    assert invocations[0]["status"] == "success"
```

**Definition of Done**:
- [ ] AI can discover tools from connected servers
- [ ] AI correctly selects tools based on user query
- [ ] Tool invocations are logged
- [ ] AI handles tool errors gracefully
- [ ] Multi-turn conversations with tool calls work
- [ ] 90%+ tool selection accuracy in tests

---

### Phase 4: Advanced Features (Week 4)

**Goal**: Tool history, permissions, and optimizations

**Tasks**:
1. ✅ Implement tool history UI
2. ✅ Implement tool permissions management
3. ✅ Add confirmation dialogs for sensitive tools
4. ✅ Optimize with caching and connection pooling

**Deliverables**:
- `frontend/src/components/mcp/ToolHistoryPanel.tsx`
- `frontend/src/components/mcp/ToolPermissionsPanel.tsx`
- Performance optimizations
- Documentation

**Testing**:
```bash
# Test permissions enforcement
pytest tests/integration/test_tool_permissions.py -v

# Test history filtering
pytest tests/integration/test_tool_history.py -v

# Performance tests
pytest tests/performance/test_mcp_performance.py -v
```

**Performance Tests**:
```python
async def test_tool_invocation_performance():
    """Test tool invocation meets performance targets."""
    # Invoke tool 100 times
    durations = []
    for _ in range(100):
        start = time.time()
        await invoker.invoke(tool_id=5, arguments={"query": "test"})
        durations.append((time.time() - start) * 1000)

    # 90th percentile should be < 5 seconds
    p90 = sorted(durations)[89]
    assert p90 < 5000, f"P90 latency {p90}ms exceeds 5000ms"

    # Average should be < 2 seconds
    avg = sum(durations) / len(durations)
    assert avg < 2000, f"Average latency {avg}ms exceeds 2000ms"
```

**Definition of Done**:
- [ ] Users can view complete tool history
- [ ] Users can filter history by date/tool/status
- [ ] Users can enable/disable tools
- [ ] Sensitive tools require confirmation
- [ ] Tool invocation P90 < 5 seconds
- [ ] Tool discovery cached (5 min TTL)
- [ ] Documentation complete

---

## Testing Checklist

### Unit Tests (80% Coverage)

**Backend**:
- [ ] MCPHTTPClient
  - [ ] list_tools() success
  - [ ] list_tools() connection error
  - [ ] list_tools() timeout
  - [ ] call_tool() success
  - [ ] call_tool() invalid parameters
  - [ ] call_tool() server error
- [ ] CredentialStore
  - [ ] encrypt() / decrypt() roundtrip
  - [ ] decrypt() with wrong key fails
- [ ] MCPConfigManager
  - [ ] get_all_servers() merges DB + file
  - [ ] DB servers take precedence
- [ ] ToolInvoker
  - [ ] invoke() creates invocation record
  - [ ] invoke() updates statistics
  - [ ] invoke() handles errors

**Frontend**:
- [ ] useMCPStore
  - [ ] addServer() adds to state
  - [ ] updateServer() updates correct server
  - [ ] removeServer() removes and clears selection
  - [ ] getFilteredServers() applies filters
- [ ] ServerDialog
  - [ ] Form validation works
  - [ ] Submit calls API correctly

### Integration Tests

- [ ] REST API Endpoints
  - [ ] POST /api/mcp/servers creates server
  - [ ] GET /api/mcp/servers lists servers
  - [ ] PUT /api/mcp/servers/{id} updates
  - [ ] DELETE /api/mcp/servers/{id} deletes
  - [ ] POST /api/mcp/servers/{id}/test tests connection
  - [ ] POST /api/mcp/tools/invoke invokes tool
  - [ ] GET /api/mcp/invocations lists history
- [ ] MCP Client + Mock Server
  - [ ] Can connect to mock MCP server
  - [ ] Can discover tools
  - [ ] Can invoke tools
  - [ ] Handles server errors

### End-to-End Tests

- [ ] User Workflows
  - [ ] Add server via UI → saves to DB
  - [ ] Test connection → shows success/error
  - [ ] Discovered tools → appear in list
  - [ ] Disable tool → AI cannot use it
  - [ ] AI uses tool → appears in history
  - [ ] View history → filters work

### Protocol Compliance Tests

- [ ] JSON-RPC Format
  - [ ] Requests have jsonrpc: "2.0"
  - [ ] Requests have unique id
  - [ ] Responses match request id
- [ ] MCP Spec Compliance
  - [ ] Tools have valid JSON Schema
  - [ ] Error codes match spec
  - [ ] Capabilities negotiated correctly

### Security Tests

- [ ] Credentials
  - [ ] Stored encrypted in DB
  - [ ] Not logged in plaintext
  - [ ] Not exposed in API responses
- [ ] Input Validation
  - [ ] URL validation prevents SSRF
  - [ ] Parameter sanitization prevents injection
- [ ] Permissions
  - [ ] Disabled tools cannot be invoked
  - [ ] Confirmation required for sensitive tools

### Performance Tests

- [ ] Tool Discovery
  - [ ] < 2 seconds for 10 tools
  - [ ] Caching works (no repeated calls)
- [ ] Tool Invocation
  - [ ] P90 < 5 seconds
  - [ ] Average < 2 seconds
  - [ ] Handles concurrent calls
- [ ] UI Responsiveness
  - [ ] Server list renders < 200ms
  - [ ] History loads 100 items < 1 second

---

## Common Issues

### Issue 1: Connection Refused

**Symptom**: `Connection test failed: Connection refused`

**Causes**:
1. MCP server not running
2. Wrong URL/port
3. Firewall blocking connection

**Solution**:
```bash
# Check if server is running
curl http://localhost:8001/health

# If not running, start it
python examples/file_server.py

# Verify correct port
netstat -an | grep 8001

# Test with curl
curl -X POST http://localhost:8001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Issue 2: Authentication Failed

**Symptom**: `Connection test failed: 401 Unauthorized`

**Causes**:
1. Wrong auth token
2. Auth type mismatch (bearer vs api_key)
3. Token expired

**Solution**:
```python
# Check server logs for auth errors
# Verify token is correct
# Try with curl:
curl -X POST http://localhost:8001/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Issue 3: Tool Not Found

**Symptom**: `Tool 'search_files' not found`

**Causes**:
1. Tools not discovered yet
2. Server restarted (cache stale)
3. Tool removed from server

**Solution**:
```bash
# Re-discover tools
POST /api/mcp/servers/1/discover

# Check tool list
GET /api/mcp/tools?server_id=1

# Refresh server connection
POST /api/mcp/servers/1/test
```

### Issue 4: Tool Invocation Timeout

**Symptom**: `Tool execution timed out after 30s`

**Causes**:
1. Tool operation is slow (large file search)
2. Server overloaded
3. Network latency

**Solution**:
```python
# Increase timeout for specific server
PUT /api/mcp/servers/1
{
  "timeout_seconds": 60
}

# Check server performance
GET /api/mcp/servers/1
# Look at avg_response_time_ms

# Consider caching results
```

### Issue 5: Invalid Tool Parameters

**Symptom**: `Invalid parameters: query must not be empty`

**Causes**:
1. AI provided wrong parameter names
2. Missing required parameters
3. Parameter type mismatch

**Solution**:
```python
# Check tool schema
GET /api/mcp/tools/5

# Verify input_schema matches invocation
# Update LLM prompt to include correct schema

# Test manually first
POST /api/mcp/tools/invoke
{
  "tool_id": 5,
  "arguments": {
    "query": "test",
    "max_results": 10
  }
}
```

### Issue 6: AI Not Using Tools

**Symptom**: AI responds without using available tools

**Causes**:
1. Tools not in LLM prompt
2. LLM doesn't recognize when to use tool
3. Tool description unclear

**Solution**:
```python
# Verify tools are exposed to LLM
from mindflow.services.llm_integration import LLMIntegration
integration = LLMIntegration()
functions = integration.get_available_functions()
print(functions)  # Should include MCP tools

# Improve tool descriptions
PUT /api/mcp/tools/5
{
  "description": "Use this to search for files by name or content. Call when user asks to 'find files', 'search files', or 'locate files'."
}

# Test with explicit request
"Use the search_files tool to find Python files"
```

---

## Example MCP Servers

### 1. File Server (Included)

**Location**: `specs/002-mcp-server/examples/file_server.py`

**Features**:
- Search files by name/pattern
- Read file contents
- List directory

**Run**:
```bash
python specs/002-mcp-server/examples/file_server.py
```

**Tools**:
- `search_files(query, path, max_results)`
- `read_file(path)`
- `list_directory(path)`

### 2. Calculator Server

**Location**: `specs/002-mcp-server/examples/calculator_server.py`

**Features**:
- Evaluate mathematical expressions
- Unit conversions

**Run**:
```bash
python specs/002-mcp-server/examples/calculator_server.py --port 8002
```

**Tools**:
- `calculate(expression)`
- `convert_units(value, from_unit, to_unit)`

### 3. Web Search Server

**Location**: `specs/002-mcp-server/examples/web_search_server.py`

**Features**:
- Web search via DuckDuckGo
- URL content extraction

**Run**:
```bash
python specs/002-mcp-server/examples/web_search_server.py --port 8003
```

**Tools**:
- `web_search(query, max_results)`
- `fetch_url(url)`

### 4. GitHub Server (External)

**Repository**: https://github.com/anthropics/mcp-servers/tree/main/github

**Features**:
- Search repositories
- Read file contents
- Create issues

**Run**:
```bash
git clone https://github.com/anthropics/mcp-servers.git
cd mcp-servers/github
npm install
npm start
```

**Configuration**:
```json
{
  "name": "GitHub MCP",
  "url": "http://localhost:3000",
  "auth_type": "bearer",
  "auth_token": "your_github_token"
}
```

---

## Architecture Diagrams

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MindFlow System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐         ┌─────────────────────────────────┐  │
│  │   Frontend   │         │         Backend                  │  │
│  │   (React)    │◄───────►│        (FastAPI)                │  │
│  │              │  HTTP   │                                  │  │
│  │ - MCP UI     │         │  ┌──────────────────────────┐   │  │
│  │ - Tool List  │         │  │  MCP Services            │   │  │
│  │ - History    │         │  │  ├─ MCPClient           │   │  │
│  └──────────────┘         │  │  ├─ ToolDiscovery       │   │  │
│                            │  │  ├─ ToolInvoker         │   │  │
│                            │  │  └─ LLMIntegration      │   │  │
│                            │  └──────────────────────────┘   │  │
│                            │                                  │  │
│                            │  ┌──────────────────────────┐   │  │
│                            │  │  Database (SQLite)       │   │  │
│                            │  │  ├─ mcp_servers          │   │  │
│                            │  │  ├─ mcp_tools            │   │  │
│                            │  │  └─ tool_invocations     │   │  │
│                            │  └──────────────────────────┘   │  │
│                            └──────────┬───────────────────────┘  │
└───────────────────────────────────────┼──────────────────────────┘
                                        │
                                        │ HTTP/JSON-RPC
                                        │
                            ┌───────────▼────────────┐
                            │   External MCP Server  │
                            │   ──────────────────  │
                            │   - File Operations    │
                            │   - Calculations       │
                            │   - Web Search         │
                            │   - Custom Tools       │
                            └────────────────────────┘
```

### Tool Invocation Flow

```
┌────────┐    ┌─────────┐    ┌──────────┐    ┌────────────┐    ┌──────────┐
│  User  │    │   AI    │    │ Backend  │    │ MCP Client │    │   MCP    │
│        │    │   LLM   │    │   API    │    │            │    │  Server  │
└───┬────┘    └────┬────┘    └────┬─────┘    └─────┬──────┘    └────┬─────┘
    │              │              │                 │                │
    │ "Find files" │              │                 │                │
    ├─────────────>│              │                 │                │
    │              │              │                 │                │
    │              │ Available    │                 │                │
    │              │ tools in     │                 │                │
    │              │ system       │                 │                │
    │              │ prompt       │                 │                │
    │              │              │                 │                │
    │              │ Decides:     │                 │                │
    │              │ use          │                 │                │
    │              │ search_files │                 │                │
    │              │              │                 │                │
    │              │ Tool call    │                 │                │
    │              │ request      │                 │                │
    │              ├─────────────>│                 │                │
    │              │              │ Create record   │                │
    │              │              │ (pending)       │                │
    │              │              ├──────────┐      │                │
    │              │              │          │      │                │
    │              │              │◄─────────┘      │                │
    │              │              │                 │                │
    │              │              │ JSON-RPC call   │                │
    │              │              ├────────────────>│                │
    │              │              │                 │ POST /mcp      │
    │              │              │                 ├───────────────>│
    │              │              │                 │                │
    │              │              │                 │ Execute tool   │
    │              │              │                 │                │
    │              │              │                 │ Result         │
    │              │              │                 │<───────────────┤
    │              │              │ Result          │                │
    │              │              │<────────────────┤                │
    │              │              │                 │                │
    │              │              │ Update record   │                │
    │              │              │ (success)       │                │
    │              │              ├──────────┐      │                │
    │              │              │          │      │                │
    │              │              │◄─────────┘      │                │
    │              │ Tool result  │                 │                │
    │              │<─────────────┤                 │                │
    │              │              │                 │                │
    │              │ Format       │                 │                │
    │              │ response     │                 │                │
    │ Response     │              │                 │                │
    │<─────────────┤              │                 │                │
    │              │              │                 │                │
```

### Data Flow

```
┌────────────────────────────────────────────────────────────┐
│                   Configuration Phase                      │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  User Input ──> UI Form ──> API ──> Database               │
│  (name, url)    (validate)  (save)  (mcp_servers)          │
│                                                             │
│  Test Btn ──> API ──> MCPClient ──> MCP Server            │
│               (test)  (list_tools)  (JSON-RPC)             │
│                  │                                          │
│                  └──> Database ──> UI                      │
│                      (save tools)  (display)               │
│                                                             │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    Invocation Phase                        │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  User Query ──> AI (LLM) ──> Tool Decision                │
│  "find files"   (analyze)   (search_files)                │
│                     │                                       │
│                     └──> Backend API                       │
│                          (invoke_tool)                     │
│                              │                              │
│                              ├──> Database                 │
│                              │    (create invocation)      │
│                              │                              │
│                              ├──> MCP Client               │
│                              │    (call_tool)              │
│                              │        │                     │
│                              │        └──> MCP Server      │
│                              │            (execute)        │
│                              │                │             │
│                              │        Result ◄┘            │
│                              │                              │
│                              ├──> Database                 │
│                              │    (update invocation)      │
│                              │                              │
│                              └──> AI (LLM)                 │
│                                   (format response)        │
│                                        │                    │
│                                        └──> User           │
│                                             (display)       │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

**Quickstart Complete**: This guide provides everything needed to understand and implement MCP server integration in MindFlow. Next: Create comprehensive implementation plan (plan.md).
