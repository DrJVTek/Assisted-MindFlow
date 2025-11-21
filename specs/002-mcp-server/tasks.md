# MCP Server Integration - Tasks

**Feature**: 002-mcp-server
**Created**: 2025-11-21
**Status**: Phase 0 Complete (Planning)
**Total Tasks**: 98

---

## Task Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[P]` Can be parallelized (different files)
- `[P1]` Priority 1 (MVP)
- `[P2]` Priority 2 (High value)
- `[P3]` Priority 3 (Nice-to-have)

---

## Phase 0: Research & Planning ✅ COMPLETE

- [x] PLAN-001 [P1] Create research.md with MCP protocol analysis
- [x] PLAN-002 [P1] Create data-model.md with entity definitions
- [x] PLAN-003 [P1] Create API contracts (api-mcp.yaml, mcp-protocol.yaml)
- [x] PLAN-004 [P1] Create quickstart.md with setup instructions
- [x] PLAN-005 [P1] Create plan.md with implementation strategy
- [x] PLAN-006 [P1] Verify constitution compliance

---

## Phase 1: Setup & Foundation (Week 1, Days 1-2)

### Dependencies & Project Structure

- [ ] SETUP-001 [P1] [P] Add cryptography==43.0.0 to requirements.txt for credential encryption
- [ ] SETUP-002 [P1] [P] Add jsonschema==4.23.0 to requirements.txt for tool parameter validation
- [ ] SETUP-003 [P1] Install Python dependencies (pip install -r requirements.txt)
- [ ] SETUP-004 [P1] [P] Create src/mindflow/services/mcp/ directory structure
- [ ] SETUP-005 [P1] [P] Create src/mindflow/models/mcp_base.py with Base and TimestampMixin
- [ ] SETUP-006 [P1] [P] Create frontend/src/components/mcp/ directory structure
- [ ] SETUP-007 [P1] [P] Create frontend/src/stores/ directory if not exists
- [ ] SETUP-008 [P1] [P] Create frontend/src/types/mcp.ts with TypeScript enums and interfaces

### Database Models

- [ ] MODEL-001 [P1] Create src/mindflow/models/mcp_server.py with MCPServer model (AuthType, ServerStatus enums, all columns, relationships, helper methods)
- [ ] MODEL-002 [P1] [P] Create src/mindflow/models/mcp_tool.py with MCPTool model (columns, relationships, to_llm_function(), unique constraint)
- [ ] MODEL-003 [P1] [P] Create src/mindflow/models/mcp_resource.py with MCPResource model (URI, mime_type, metadata)
- [ ] MODEL-004 [P1] [P] Create src/mindflow/models/mcp_prompt.py with MCPPrompt model (arguments, template, usage stats)
- [ ] MODEL-005 [P1] [P] Create src/mindflow/models/tool_invocation.py with ToolInvocation model (InvocationStatus enum, timing, context, indexes)
- [ ] MODEL-006 [P1] Update src/mindflow/models/__init__.py to export MCP models
- [ ] MODEL-007 [P1] Create database migration for mcp_servers table with indexes
- [ ] MODEL-008 [P1] Create database migration for mcp_tools table with composite unique constraint
- [ ] MODEL-009 [P1] Create database migration for tool_invocations table with composite indexes
- [ ] MODEL-010 [P1] Create database migration for mcp_resources and mcp_prompts tables
- [ ] MODEL-011 [P1] Test database migrations (upgrade and downgrade)

### Pydantic Schemas

- [ ] SCHEMA-001 [P1] Create src/mindflow/schemas/mcp_schemas.py with enums (AuthType, ServerStatus, InvocationStatus)
- [ ] SCHEMA-002 [P1] Add MCPServerCreate, MCPServerUpdate, MCPServerResponse schemas with validation
- [ ] SCHEMA-003 [P1] [P] Add MCPToolResponse, MCPToolUpdate schemas
- [ ] SCHEMA-004 [P1] [P] Add ToolInvocationRequest, ToolInvocationResponse schemas
- [ ] SCHEMA-005 [P1] [P] Add ConnectionTestRequest, ConnectionTestResponse schemas
- [ ] SCHEMA-006 [P1] [P] Add ToolDiscoveryResponse schema

---

## Phase 2: Core MCP Services (Week 1, Days 3-5)

### Credential Store

- [ ] CRED-001 [P1] Create src/mindflow/services/credential_store.py with CredentialStore class
- [ ] CRED-002 [P1] Implement Fernet encryption initialization (generate or load key from env)
- [ ] CRED-003 [P1] Implement encrypt(plaintext) -> encrypted_base64
- [ ] CRED-004 [P1] Implement decrypt(encrypted_base64) -> plaintext
- [ ] CRED-005 [P1] Add error handling for wrong encryption key
- [ ] CRED-006 [P1] Add unit tests for encryption/decryption roundtrip (tests/unit/test_credential_store.py)
- [ ] CRED-007 [P1] Add unit test for wrong key failure

### MCP HTTP Client

- [ ] CLIENT-001 [P1] Create src/mindflow/services/mcp_client.py with MCPHTTPClient class
- [ ] CLIENT-002 [P1] Implement __init__ with httpx.AsyncClient session, base_url, auth configuration
- [ ] CLIENT-003 [P1] Implement _call(method, params) for JSON-RPC 2.0 protocol
- [ ] CLIENT-004 [P1] Implement list_tools() -> List[Dict] (calls tools/list)
- [ ] CLIENT-005 [P1] Implement call_tool(tool_name, arguments) -> Dict (calls tools/call)
- [ ] CLIENT-006 [P1] Implement list_resources() -> List[Dict] (calls resources/list)
- [ ] CLIENT-007 [P1] Implement read_resource(uri) -> Dict (calls resources/read)
- [ ] CLIENT-008 [P1] Implement list_prompts() -> List[Dict] (calls prompts/list)
- [ ] CLIENT-009 [P1] Implement get_prompt(name, arguments) -> Dict (calls prompts/get)
- [ ] CLIENT-010 [P1] Implement initialize() for handshake and capability negotiation
- [ ] CLIENT-011 [P1] Add timeout handling (default 30s, configurable)
- [ ] CLIENT-012 [P1] Add connection error handling (timeout, unreachable, SSL errors)
- [ ] CLIENT-013 [P1] Add authentication error handling (401, 403)
- [ ] CLIENT-014 [P1] Add JSON-RPC error handling (parse error codes)
- [ ] CLIENT-015 [P1] Add unit tests for list_tools() (tests/unit/test_mcp_client.py)
- [ ] CLIENT-016 [P1] Add unit tests for call_tool() with mock responses
- [ ] CLIENT-017 [P1] Add unit tests for error handling scenarios

### Configuration Manager

- [ ] CONFIG-001 [P1] Create src/mindflow/services/mcp_config.py with MCPConfigManager class
- [ ] CONFIG-002 [P1] Implement get_all_servers() (load from database)
- [ ] CONFIG-003 [P1] Implement create_server(server_data) with credential encryption
- [ ] CONFIG-004 [P1] Implement update_server(server_id, updates) with credential re-encryption if needed
- [ ] CONFIG-005 [P1] Implement delete_server(server_id)
- [ ] CONFIG-006 [P1] Implement get_server_by_id(server_id)
- [ ] CONFIG-007 [P1] Implement get_server_by_name(name)
- [ ] CONFIG-008 [P1] Implement get_enabled_servers() for filtering
- [ ] CONFIG-009 [P1] Add URL validation (SSRF prevention, valid schemes)
- [ ] CONFIG-010 [P1] Add name uniqueness validation
- [ ] CONFIG-011 [P1] Add unit tests for CRUD operations (tests/unit/test_mcp_config.py)
- [ ] CONFIG-012 [P1] Add unit tests for validation edge cases

---

## Phase 3: User Story 1 - MCP Server Management (Week 2, Days 1-2) [P1 - MVP]

**Goal**: Users can register, update, list, and delete MCP servers
**Test**: Open config UI → Add server → Save → See in list → Edit → Delete

### Backend API Endpoints

- [ ] US1-001 [P1] Create src/mindflow/api/routes/mcp.py with APIRouter
- [ ] US1-002 [P1] Implement POST /api/mcp/servers (create server endpoint)
- [ ] US1-003 [P1] Add request validation (name, URL, auth_type, auth_token)
- [ ] US1-004 [P1] Add credential encryption before database storage
- [ ] US1-005 [P1] Implement GET /api/mcp/servers (list all servers endpoint)
- [ ] US1-006 [P1] Add filtering support (status, enabled, search)
- [ ] US1-007 [P1] Implement GET /api/mcp/servers/{id} (get single server endpoint)
- [ ] US1-008 [P1] Implement PUT /api/mcp/servers/{id} (update server endpoint)
- [ ] US1-009 [P1] Handle credential updates (re-encrypt if changed)
- [ ] US1-010 [P1] Implement DELETE /api/mcp/servers/{id} (delete server endpoint)
- [ ] US1-011 [P1] Add cascade deletion for tools/resources/prompts
- [ ] US1-012 [P1] Register MCP router in src/mindflow/api/server.py
- [ ] US1-013 [P1] Add integration tests for POST /servers (tests/integration/test_mcp_api.py)
- [ ] US1-014 [P1] Add integration tests for GET /servers
- [ ] US1-015 [P1] Add integration tests for PUT /servers/{id}
- [ ] US1-016 [P1] Add integration tests for DELETE /servers/{id}

### Frontend Components

- [ ] US1-017 [P1] [P] Create frontend/src/types/mcp.ts with full TypeScript types (MCPServer, AuthType, ServerStatus)
- [ ] US1-018 [P1] [P] Create frontend/src/services/mcpApi.ts with axios API client (listServers, createServer, updateServer, deleteServer)
- [ ] US1-019 [P1] [P] Create frontend/src/stores/mcpStore.ts with Zustand store (servers state, actions, filters)
- [ ] US1-020 [P1] Create frontend/src/components/mcp/MCPSettingsPanel.tsx (main container component)
- [ ] US1-021 [P1] Create frontend/src/components/mcp/ServerList.tsx (displays server list)
- [ ] US1-022 [P1] Create frontend/src/components/mcp/ServerCard.tsx (individual server card with status, actions)
- [ ] US1-023 [P1] Create frontend/src/components/mcp/ServerDialog.tsx (add/edit form dialog)
- [ ] US1-024 [P1] Add form fields (name, URL, description, auth_type, auth_token)
- [ ] US1-025 [P1] Add form validation (required fields, URL format, name uniqueness)
- [ ] US1-026 [P1] Add server status indicators (connected/disconnected/error with colors)
- [ ] US1-027 [P1] Add loading states (spinner during API calls)
- [ ] US1-028 [P1] Add error message display (toast/alert for API errors)
- [ ] US1-029 [P1] Add delete confirmation dialog
- [ ] US1-030 [P1] Connect MCPSettingsPanel to main app navigation
- [ ] US1-031 [P1] Add component tests for ServerList (tests/frontend/mcp/)
- [ ] US1-032 [P1] Add component tests for ServerDialog with form validation

---

## Phase 4: User Story 2 - Connection Testing (Week 2, Day 3) [P1 - MVP]

**Goal**: Users can configure auth and test server connections
**Test**: Add server with auth → Save credentials → Click "Test Connection" → See success/failure

### Backend Connection Testing

- [ ] US2-001 [P1] Implement POST /api/mcp/servers/{id}/test endpoint
- [ ] US2-002 [P1] Add connection test service method (test_connection)
- [ ] US2-003 [P1] Decrypt credentials before connection
- [ ] US2-004 [P1] Call MCP client initialize() to handshake
- [ ] US2-005 [P1] Discover capabilities (tools, resources, prompts support)
- [ ] US2-006 [P1] Call list_tools() to count available tools
- [ ] US2-007 [P1] Update server status (CONNECTED/ERROR) in database
- [ ] US2-008 [P1] Update last_connected timestamp
- [ ] US2-009 [P1] Store last_error message on failure
- [ ] US2-010 [P1] Measure response time (avg_response_time_ms)
- [ ] US2-011 [P1] Handle timeout errors (set status to TIMEOUT)
- [ ] US2-012 [P1] Handle authentication errors (set status to ERROR with message)
- [ ] US2-013 [P1] Handle connection refused errors
- [ ] US2-014 [P1] Add integration tests for successful connection
- [ ] US2-015 [P1] Add integration tests for failed connections (timeout, auth failure, unreachable)

### Frontend Connection Testing

- [ ] US2-016 [P1] Create frontend/src/components/mcp/TestConnectionButton.tsx
- [ ] US2-017 [P1] Add "Test Connection" button to ServerCard
- [ ] US2-018 [P1] Add loading indicator during test
- [ ] US2-019 [P1] Display success message with capabilities (tool count, response time)
- [ ] US2-020 [P1] Display error message with specific reason (timeout, auth failed, unreachable)
- [ ] US2-021 [P1] Update server status in store after test
- [ ] US2-022 [P1] Add component tests for TestConnectionButton

### Authentication Configuration UI

- [ ] US2-023 [P1] Add auth_type dropdown in ServerDialog (None, Bearer, API Key, OAuth2)
- [ ] US2-024 [P1] Show/hide auth_token field based on auth_type
- [ ] US2-025 [P1] Add auth_header field for API Key type
- [ ] US2-026 [P1] Add password field masking for auth_token
- [ ] US2-027 [P1] Validate auth_token when auth_type requires it
- [ ] US2-028 [P1] Add "Show/Hide" toggle for auth_token field

---

## Phase 5: User Story 3 - Tool Discovery (Week 2, Days 4-5) [P2]

**Goal**: Users can see all tools available from registered MCP servers
**Test**: Register server → View tools tab → See tool list with descriptions and parameters

### Backend Tool Discovery Service

- [ ] US3-001 [P2] Create src/mindflow/services/mcp_discovery.py with ToolDiscoveryService class
- [ ] US3-002 [P2] Implement discover_all_tools(force_refresh=False)
- [ ] US3-003 [P2] Loop through all enabled servers
- [ ] US3-004 [P2] Call list_tools() for each server
- [ ] US3-005 [P2] Parse tool definitions (name, description, inputSchema)
- [ ] US3-006 [P2] Create or update MCPTool records in database
- [ ] US3-007 [P2] Update last_seen timestamp for existing tools
- [ ] US3-008 [P2] Mark tools not seen as potentially removed
- [ ] US3-009 [P2] Implement cache with 5-minute TTL (check cache_expires_at)
- [ ] US3-010 [P2] Skip discovery if cache valid (unless force_refresh=True)
- [ ] US3-011 [P2] Update tools_cache JSON in MCPServer
- [ ] US3-012 [P2] Update tool_count on server
- [ ] US3-013 [P2] Similarly implement discover_resources() for MCPResource
- [ ] US3-014 [P2] Similarly implement discover_prompts() for MCPPrompt
- [ ] US3-015 [P2] Add error handling for discovery failures (log but don't crash)
- [ ] US3-016 [P2] Add unit tests for tool discovery (tests/unit/test_mcp_discovery.py)
- [ ] US3-017 [P2] Add unit tests for cache behavior

### Backend Tool API Endpoints

- [ ] US3-018 [P2] Implement GET /api/mcp/tools (list all tools from all servers)
- [ ] US3-019 [P2] Add filtering (server_id, enabled, search)
- [ ] US3-020 [P2] Add pagination support (offset, limit)
- [ ] US3-021 [P2] Implement GET /api/mcp/tools/{id} (get single tool)
- [ ] US3-022 [P2] Implement PUT /api/mcp/tools/{id} (update tool permissions)
- [ ] US3-023 [P2] Allow updating enabled and requires_confirmation fields
- [ ] US3-024 [P2] Implement POST /api/mcp/servers/{id}/discover (manual tool discovery trigger)
- [ ] US3-025 [P2] Add integration tests for GET /tools
- [ ] US3-026 [P2] Add integration tests for PUT /tools/{id}
- [ ] US3-027 [P2] Add integration tests for POST /servers/{id}/discover

### Frontend Tool Display Components

- [ ] US3-028 [P2] [P] Create frontend/src/components/mcp/MCPToolList.tsx (tool list component)
- [ ] US3-029 [P2] Display tool name, description, server name
- [ ] US3-030 [P2] Add enabled/disabled toggle for each tool
- [ ] US3-031 [P2] Add search filter input
- [ ] US3-032 [P2] Add server filter dropdown
- [ ] US3-033 [P2] [P] Create frontend/src/components/mcp/ToolDetailsPanel.tsx (tool details drawer)
- [ ] US3-034 [P2] Display full input_schema (JSON Schema)
- [ ] US3-035 [P2] Display parameter types, required fields, defaults
- [ ] US3-036 [P2] Display success_rate and invocation_count statistics
- [ ] US3-037 [P2] Add "Refresh Tools" button to trigger discovery
- [ ] US3-038 [P2] Add loading state during discovery
- [ ] US3-039 [P2] Update store with tools from API
- [ ] US3-040 [P2] Add component tests for MCPToolList
- [ ] US3-041 [P2] Add component tests for ToolDetailsPanel

---

## Phase 6: User Story 3 (continued) - LLM Tool Integration (Week 3, Days 1-3) [P2]

**Goal**: LLM can invoke MCP tools with proper parameter handling
**Test**: Ask LLM to use tool → LLM calls tool → See invocation log → Verify result

### Tool Invocation Service

- [ ] US3-042 [P2] Create src/mindflow/services/mcp_invocation.py with ToolInvoker class
- [ ] US3-043 [P2] Implement invoke_tool(tool_id, arguments, session_id=None, conversation_id=None)
- [ ] US3-044 [P2] Load MCPTool from database
- [ ] US3-045 [P2] Check if tool is enabled (raise error if disabled)
- [ ] US3-046 [P2] Validate arguments against input_schema (using jsonschema)
- [ ] US3-047 [P2] Create ToolInvocation record with status=PENDING
- [ ] US3-048 [P2] Get MCP client for tool's server
- [ ] US3-049 [P2] Decrypt server credentials
- [ ] US3-050 [P2] Call mcp_client.call_tool(tool_name, arguments)
- [ ] US3-051 [P2] Update invocation status to SUCCESS with result
- [ ] US3-052 [P2] Calculate duration_ms
- [ ] US3-053 [P2] Update tool statistics (invocation_count, success_count, avg_duration_ms)
- [ ] US3-054 [P2] Update server statistics (total_invocations, avg_response_time_ms)
- [ ] US3-055 [P2] Handle tool execution errors (update status to ERROR, store error_message)
- [ ] US3-056 [P2] Handle timeout errors (update status to TIMEOUT)
- [ ] US3-057 [P2] Update failure_count on error
- [ ] US3-058 [P2] Add retry logic (max 3 attempts with exponential backoff)
- [ ] US3-059 [P2] Add unit tests for successful invocation (tests/unit/test_mcp_invocation.py)
- [ ] US3-060 [P2] Add unit tests for validation errors
- [ ] US3-061 [P2] Add unit tests for execution errors

### Tool Invocation API Endpoint

- [ ] US3-062 [P2] Implement POST /api/mcp/tools/invoke
- [ ] US3-063 [P2] Accept tool_id, arguments, session_id, conversation_id
- [ ] US3-064 [P2] Call ToolInvoker.invoke_tool()
- [ ] US3-065 [P2] Return ToolInvocationResponse (id, status, result, duration)
- [ ] US3-066 [P2] Implement GET /api/mcp/invocations (list tool invocation history)
- [ ] US3-067 [P2] Add filtering (tool_id, server_id, status, session_id, date_from, date_to)
- [ ] US3-068 [P2] Add pagination and sorting (most recent first)
- [ ] US3-069 [P2] Implement GET /api/mcp/invocations/{id} (get single invocation)
- [ ] US3-070 [P2] Add integration tests for POST /tools/invoke
- [ ] US3-071 [P2] Add integration tests for GET /invocations with filters

### LLM Integration Service

- [ ] US3-072 [P2] Create src/mindflow/services/llm_integration.py with LLMIntegration class
- [ ] US3-073 [P2] Implement get_available_functions() -> List[Dict]
- [ ] US3-074 [P2] Call ToolDiscoveryService.discover_all_tools()
- [ ] US3-075 [P2] Filter only enabled tools
- [ ] US3-076 [P2] Convert each MCPTool to LLM function format (name, description, parameters)
- [ ] US3-077 [P2] Ensure parameters match JSON Schema format expected by LLM
- [ ] US3-078 [P2] Implement handle_tool_call(tool_name, arguments, session_id)
- [ ] US3-079 [P2] Find tool by name
- [ ] US3-080 [P2] Call ToolInvoker.invoke_tool()
- [ ] US3-081 [P2] Return formatted result for LLM consumption
- [ ] US3-082 [P2] Handle tool not found error
- [ ] US3-083 [P2] Handle invocation errors (return error message to LLM)
- [ ] US3-084 [P2] Modify src/mindflow/services/llm_service.py to integrate MCP tools
- [ ] US3-085 [P2] Add MCP tools to LLM prompt as available functions
- [ ] US3-086 [P2] Detect when LLM requests tool call
- [ ] US3-087 [P2] Call LLMIntegration.handle_tool_call()
- [ ] US3-088 [P2] Pass tool result back to LLM for synthesis
- [ ] US3-089 [P2] Add integration tests for full LLM + MCP flow (tests/integration/test_llm_mcp.py)

---

## Phase 7: User Story 4 - Tool History & Permissions (Week 3, Days 4-5) [P3]

**Goal**: Users can view tool usage history and manage permissions
**Test**: View history panel → See invocation logs → Manage tool permissions

### Tool History UI

- [ ] US4-001 [P3] [P] Create frontend/src/components/mcp/ToolHistoryPanel.tsx
- [ ] US4-002 [P3] Display list of recent invocations (most recent first)
- [ ] US4-003 [P3] Show tool name, server name, status, timestamp, duration
- [ ] US4-004 [P3] Add status color coding (success=green, error=red, timeout=orange)
- [ ] US4-005 [P3] Add filtering UI (by tool, server, status, date range)
- [ ] US4-006 [P3] Add pagination controls
- [ ] US4-007 [P3] [P] Create ToolInvocationDetail component (drawer/modal)
- [ ] US4-008 [P3] Display full arguments (formatted JSON)
- [ ] US4-009 [P3] Display full result (formatted JSON)
- [ ] US4-010 [P3] Display error_message if failed
- [ ] US4-011 [P3] Display execution timing details
- [ ] US4-012 [P3] Add "Copy" buttons for arguments and result
- [ ] US4-013 [P3] Add component tests for ToolHistoryPanel

### Tool Permissions UI

- [ ] US4-014 [P3] [P] Create frontend/src/components/mcp/ToolPermissionsPanel.tsx
- [ ] US4-015 [P3] Display all discovered tools in list
- [ ] US4-016 [P3] Add enabled/disabled toggle switch for each tool
- [ ] US4-017 [P3] Add requires_confirmation checkbox for each tool
- [ ] US4-018 [P3] Add bulk actions (enable all, disable all)
- [ ] US4-019 [P3] Add server grouping (group tools by server)
- [ ] US4-020 [P3] Show success_rate and usage statistics per tool
- [ ] US4-021 [P3] Save permission changes to API (PUT /api/mcp/tools/{id})
- [ ] US4-022 [P3] Add confirmation dialog for disabling frequently-used tools
- [ ] US4-023 [P3] Add component tests for ToolPermissionsPanel

### Confirmation Dialog for Sensitive Tools

- [ ] US4-024 [P3] [P] Create frontend/src/components/mcp/ToolConfirmationDialog.tsx
- [ ] US4-025 [P3] Display when tool has requires_confirmation=true
- [ ] US4-026 [P3] Show tool name, description, and parameters
- [ ] US4-027 [P3] Show warning message for sensitive operation
- [ ] US4-028 [P3] Add "Confirm" and "Cancel" buttons
- [ ] US4-029 [P3] Modify LLM service to check requires_confirmation before execution
- [ ] US4-030 [P3] Pause execution and show dialog to user
- [ ] US4-031 [P3] Resume execution if confirmed, cancel if rejected

---

## Phase 8: Polish & Cross-Cutting (Week 4)

### Error Handling

- [ ] POLISH-001 [P2] [P] Add global error handler for MCP client errors
- [ ] POLISH-002 [P2] [P] Add error codes and categorization (connection, auth, protocol, tool)
- [ ] POLISH-003 [P2] [P] Add user-friendly error messages (avoid technical jargon)
- [ ] POLISH-004 [P2] [P] Add retry logic with exponential backoff for transient errors
- [ ] POLISH-005 [P2] [P] Add circuit breaker pattern for repeatedly failing servers

### Security Enhancements

- [ ] SECURITY-001 [P1] [P] Audit credential encryption implementation (no logging of secrets)
- [ ] SECURITY-002 [P1] [P] Add URL validation to prevent SSRF attacks (whitelist schemes, block private IPs)
- [ ] SECURITY-003 [P1] [P] Add input sanitization for tool arguments (prevent injection)
- [ ] SECURITY-004 [P2] [P] Add rate limiting (100 calls/min per server)
- [ ] SECURITY-005 [P2] [P] Add rate limiting per tool (configurable)
- [ ] SECURITY-006 [P2] [P] Add access control checks (if multi-user support added later)

### Performance Optimizations

- [ ] PERF-001 [P2] [P] Implement connection pooling for MCP clients (reuse httpx sessions)
- [ ] PERF-002 [P2] [P] Add result caching for idempotent tools (5-min TTL)
- [ ] PERF-003 [P2] [P] Optimize database queries with proper indexes
- [ ] PERF-004 [P2] [P] Add database query for common filters (server_id, status)
- [ ] PERF-005 [P2] [P] Implement parallel tool invocation when LLM requests multiple tools
- [ ] PERF-006 [P2] [P] Add async/await throughout (ensure no blocking calls)
- [ ] PERF-007 [P2] [P] Measure P90 latency for tool invocations (target < 5s)

### Logging & Monitoring

- [ ] LOG-001 [P2] [P] Add structured logging for all MCP operations (JSON format)
- [ ] LOG-002 [P2] [P] Log connection attempts with outcomes
- [ ] LOG-003 [P2] [P] Log tool invocations with timing
- [ ] LOG-004 [P2] [P] Add log filtering to exclude sensitive data (credentials, tokens)
- [ ] LOG-005 [P2] [P] Add metrics collection (invocation count, success rate, latency)
- [ ] LOG-006 [P2] [P] Create simple metrics dashboard (tool usage over time)

### UI Polish

- [ ] UI-001 [P2] [P] Add loading skeletons for all lists (servers, tools, invocations)
- [ ] UI-002 [P2] [P] Add empty states with helpful messages ("No servers configured yet")
- [ ] UI-003 [P2] [P] Add success toast notifications (server added, connection successful)
- [ ] UI-004 [P2] [P] Add error toast notifications with retry options
- [ ] UI-005 [P2] [P] Improve form layouts with better spacing and grouping
- [ ] UI-006 [P2] [P] Add keyboard shortcuts (Escape to close dialogs, Enter to submit)
- [ ] UI-007 [P2] [P] Add tooltips for complex fields (auth_type, input_schema)
- [ ] UI-008 [P2] [P] Ensure responsive design (mobile, tablet, desktop)

### Accessibility

- [ ] A11Y-001 [P3] [P] Add ARIA labels for all interactive elements
- [ ] A11Y-002 [P3] [P] Ensure keyboard navigation works (tab order, focus management)
- [ ] A11Y-003 [P3] [P] Add screen reader support for status indicators
- [ ] A11Y-004 [P3] [P] Test with screen reader (NVDA or JAWS)
- [ ] A11Y-005 [P3] [P] Ensure color contrast meets WCAG AA standards

### Documentation

- [ ] DOC-001 [P2] [P] Create example MCP server: specs/002-mcp-server/examples/file_server.py
- [ ] DOC-002 [P2] [P] Create example MCP server: specs/002-mcp-server/examples/calculator_server.py
- [ ] DOC-003 [P2] [P] Create example MCP server: specs/002-mcp-server/examples/weather_server.py
- [ ] DOC-004 [P2] [P] Update quickstart.md with setup instructions
- [ ] DOC-005 [P2] [P] Add API documentation with OpenAPI/Swagger
- [ ] DOC-006 [P2] [P] Create user guide with screenshots

### Testing

- [ ] TEST-001 [P1] [P] Add E2E test: full workflow (add server → test → discover → invoke) in tests/e2e/test_mcp_workflow.py
- [ ] TEST-002 [P1] [P] Add E2E test: LLM uses MCP tool in conversation
- [ ] TEST-003 [P1] [P] Add E2E test: error scenarios (server offline, auth failure)
- [ ] TEST-004 [P2] [P] Add performance test: concurrent tool invocations (10 parallel)
- [ ] TEST-005 [P2] [P] Add performance test: tool discovery latency (< 2s)
- [ ] TEST-006 [P2] [P] Add performance test: P90 invocation latency (< 5s)
- [ ] TEST-007 [P1] [P] Run full test suite and ensure 80%+ coverage
- [ ] TEST-008 [P1] [P] Set up CI pipeline to run tests on PR

### Configuration & Deployment

- [ ] DEPLOY-001 [P1] [P] Add encryption key generation to setup script
- [ ] DEPLOY-002 [P1] [P] Add environment variable for ENCRYPTION_KEY
- [ ] DEPLOY-003 [P2] [P] Add backup/restore functionality for MCP configurations
- [ ] DEPLOY-004 [P2] [P] Add import/export server configurations (JSON format)
- [ ] DEPLOY-005 [P2] [P] Update restart scripts to handle MCP services

---

## Task Dependencies

### Critical Path (Must be sequential)

1. **Setup → Models → Schemas**: Database foundation must exist first
2. **Credential Store → MCP Client**: Client needs encryption for auth
3. **MCP Client → Config Manager**: Config needs client for testing
4. **Config Manager → US1 (Server Management)**: API needs config layer
5. **US1 → US2 (Connection Testing)**: Testing needs servers to exist
6. **US2 → US3 (Tool Discovery)**: Discovery needs working connections
7. **US3 (Discovery) → US3 (LLM Integration)**: LLM needs discovered tools

### Parallelizable Work

- **Models**: All 5 models can be created in parallel (different files)
- **Schemas**: Pydantic schemas can be written in parallel with models
- **Frontend Types**: TypeScript types can be created early
- **Frontend Components**: UI components can be built in parallel once API contracts are defined
- **Backend Services**: Services can be developed in parallel if dependencies are mocked
- **Tests**: Unit tests can be written in parallel with implementation

### MVP Definition (Minimum Viable Product)

**Phase 1-4 Complete = MVP**:
- Setup & Foundation ✓
- Core MCP Services ✓
- US1: Server Management ✓
- US2: Connection Testing ✓

**MVP Allows**:
- Users to configure MCP servers
- Test connections
- View server status
- Basic functionality without tool invocation

**Phase 5-6 = Core Value**:
- US3: Tool Discovery & Invocation
- Full LLM integration

**Phase 7-8 = Polish**:
- History & permissions
- Error handling
- Performance
- Documentation

---

## Progress Tracking

**Total Tasks**: 98
**Completed**: 6 (Phase 0)
**Remaining**: 92

**By Priority**:
- P1 (MVP): ~45 tasks
- P2 (High Value): ~35 tasks
- P3 (Nice-to-have): ~12 tasks

**By Phase**:
- Phase 0 (Planning): 6 ✅
- Phase 1 (Setup): 11
- Phase 2 (Core Services): 17
- Phase 3 (US1 - Server Management): 16
- Phase 4 (US2 - Connection Testing): 12
- Phase 5 (US3 - Tool Discovery): 24
- Phase 6 (US3 - LLM Integration): 18
- Phase 7 (US4 - History/Permissions): 23
- Phase 8 (Polish): 71

**Estimated Duration**: 4 weeks (160 hours)

---

**Tasks Complete**: Comprehensive breakdown of 98 actionable tasks with clear dependencies, parallelization opportunities, and success criteria. Ready for implementation.
