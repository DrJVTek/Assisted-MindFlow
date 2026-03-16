# Feature Specification: MCP Client Support - Unified Provider Integration

**Feature Branch**: `012-mcp-client-support`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "faut un mcp client support aussi :p" + context: "une interface commune avec tout les LLM provider pour qu'ils soit tous utiliser de la même facon a tous les niveau (y compris les mpc server et clients)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - MCP Tools Available During LLM Operations (Priority: P1)

When a user runs an LLM operation from the canvas (e.g., asking a question to any provider), the system automatically makes all tools from connected MCP servers available to the LLM. The LLM can decide to call these tools during its response, and the system handles the full tool-use loop transparently regardless of which LLM provider is being used.

**Why this priority**: This is the core value proposition — MCP tools work uniformly with every LLM provider (OpenAI, Anthropic, Gemini, Ollama, ChatGPT Web). Without this, MCP connections exist but aren't usable during normal LLM workflows.

**Independent Test**: Can be fully tested by connecting an MCP server (e.g., a filesystem tool), sending a prompt that requires tool use to any configured LLM provider, and verifying the tool gets called and the result incorporated into the response.

**Acceptance Scenarios**:

1. **Given** an MCP server is connected with tools discovered, **When** the user runs an LLM operation with any provider, **Then** the LLM receives the tool definitions and can invoke them during generation.
2. **Given** an LLM decides to call an MCP tool, **When** the tool is executed, **Then** the result is fed back to the LLM and the final response includes the tool output naturally.
3. **Given** an MCP server is disconnected or unavailable, **When** the user runs an LLM operation, **Then** the operation proceeds without tools and completes normally (no error).
4. **Given** multiple MCP servers are connected, **When** the LLM generates a response, **Then** tools from all connected servers are available and can be invoked.

---

### User Story 2 - MCP Connection Management in Provider UI (Priority: P2)

Users can manage MCP server connections from the same provider settings area where they configure LLM providers. MCP connections appear alongside LLM providers as a unified list of "capabilities" the system has access to. Users can add, remove, test, and view discovered tools for each MCP connection.

**Why this priority**: Users need a consistent place to manage all external integrations. Having MCP connections in a separate, disconnected UI creates confusion.

**Independent Test**: Can be tested by opening the provider/settings panel, adding an MCP server connection (stdio or HTTP), verifying it connects and lists discovered tools, then removing it.

**Acceptance Scenarios**:

1. **Given** the user opens the provider management area, **When** they view the list, **Then** both LLM providers and MCP connections are visible with clear distinction.
2. **Given** the user adds a new MCP server, **When** the connection succeeds, **Then** discovered tools are listed with names and descriptions.
3. **Given** the user has an MCP connection, **When** they click to view details, **Then** all discovered tools, connection status, and transport type are shown.
4. **Given** the user removes an MCP connection, **When** confirmed, **Then** the connection is closed and removed from the list.

---

### User Story 3 - Tool Usage Visibility and Feedback (Priority: P3)

When an LLM uses MCP tools during an operation, the user sees which tools were called, what arguments were passed, and what results came back. This visibility appears in the node's detail panel or operation log so users understand how their answer was produced.

**Why this priority**: Transparency builds trust. Users need to know when and how external tools were used to produce a response, especially for debugging or verifying accuracy.

**Independent Test**: Can be tested by running an LLM operation that triggers a tool call, then checking the operation details/node panel for tool call logs.

**Acceptance Scenarios**:

1. **Given** an LLM operation used MCP tools, **When** the user views the operation details, **Then** each tool call is listed with tool name, arguments, and result summary.
2. **Given** a tool call failed during an operation, **When** the user views the operation details, **Then** the failure is clearly indicated with the error message.
3. **Given** multiple tool calls occurred in sequence, **When** the user views the log, **Then** calls are shown in chronological order with iteration numbers.

---

### Edge Cases

- What happens when an MCP server disconnects mid-operation (during tool call)?
  - The tool call returns an error, the LLM receives the error as tool result, and can either retry or respond with an explanation.
- What happens when an MCP tool takes longer than expected?
  - Tool calls have a timeout (30 seconds default). If exceeded, the call returns a timeout error to the LLM.
- What happens when the LLM enters a tool-call loop (repeatedly calling tools)?
  - A maximum iteration limit (10) prevents infinite loops. After the limit, the last text response is returned.
- What happens when two MCP servers expose tools with the same name?
  - Tools are namespaced by connection name (e.g., "filesystem:read_file" vs "github:read_file") to prevent conflicts.
- What happens when no MCP servers are connected?
  - LLM operations work normally without tools. No error, no degradation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST make all tools from connected MCP servers available to LLM providers during generation operations.
- **FR-002**: System MUST support the MCP tool-use loop (LLM calls tool, result fed back, LLM continues) for all supported LLM providers.
- **FR-003**: System MUST handle provider-specific tool format conversion (OpenAI functions, Claude tools, Gemini function_declarations) transparently.
- **FR-004**: System MUST support three MCP transport types: stdio (local processes), SSE (server-sent events), and streamable HTTP.
- **FR-005**: System MUST persist MCP connection configurations across restarts.
- **FR-006**: System MUST discover and list available tools when connecting to an MCP server.
- **FR-007**: System MUST display MCP connections and their tools in the provider management interface.
- **FR-008**: System MUST log tool calls with arguments and results for user visibility.
- **FR-009**: System MUST handle MCP server disconnections gracefully without crashing LLM operations.
- **FR-010**: System MUST enforce a maximum tool iteration limit to prevent infinite loops.
- **FR-011**: System MUST namespace tools from different MCP servers to prevent name collisions.
- **FR-012**: System MUST allow users to enable/disable specific MCP connections without removing them.

### Key Entities

- **MCP Connection**: A configured link to an external MCP server, with transport type, connection parameters, status, and list of discovered tools.
- **MCP Tool**: A capability exposed by an MCP server, with name, description, and input schema. Tools are invoked by LLMs during generation.
- **Tool Call Log**: A record of a tool invocation during an LLM operation, including tool name, arguments, result, timing, and success/failure status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can connect to an MCP server and see its tools listed within 10 seconds of establishing the connection.
- **SC-002**: LLM operations with tool use complete successfully for all 5 supported provider types (OpenAI, Anthropic, Gemini, Ollama, ChatGPT Web).
- **SC-003**: Tool call results are visible to users within 2 seconds of the tool completing execution.
- **SC-004**: System handles MCP server disconnection mid-operation without data loss or application crash in 100% of cases.
- **SC-005**: Users can manage MCP connections (add, remove, view tools) without leaving the provider management area.
- **SC-006**: 90% of users can successfully add a new MCP server connection on their first attempt without external documentation.

## Assumptions

- The existing MCP client infrastructure (MCPClientManager, tool_use_service) provides a solid foundation and will be extended rather than replaced.
- MCP servers follow the Model Context Protocol specification and expose tools via the standard `tools/list` method.
- Users have access to MCP server binaries or URLs for the servers they want to connect.
- The stdio transport assumes the MCP server binary is locally installed and accessible from the system PATH or an absolute path.
- Tool call timeouts default to 30 seconds, which is sufficient for most MCP tool operations.
- The 10-iteration maximum for tool-use loops is sufficient for real-world use cases.

## Out of Scope

- Acting as an MCP server (exposing MindFlow's own capabilities via MCP) — this is a separate feature.
- MCP resource access (reading resources from MCP servers) — only tool invocation is covered.
- MCP prompt templates — only tool use is covered.
- Authentication/authorization for MCP server connections beyond what the transport layer provides.
- Custom tool UI (rendering tool-specific interfaces) — tools are invoked programmatically by LLMs.
