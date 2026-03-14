# Feature Specification: Multi-Provider LLM & MCP Integration

**Feature Branch**: `011-multi-provider-llm-mcp`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "je veux qu'on puisse avoir plusieurs providers en meme temps (plusieurs LLM, par exemple local + ChatGPT OAuth, Gemini OAuth, ou OpenAI ou Claude etc.) donc oui plusieurs LLM donc on peut les faire discuter ou debater entre eux pour resoudre un probleme via les nodes. L'idee est d'avoir des nodes de chaque provider. L'idee aussi c'est que tout ca peut etre un MCP et donc avoir par exemple Claude Code ou Codex ou autre qui peut se connecter sur le truc et discuter avec les nodes / LLM aussi."

## Clarifications

### Session 2026-03-14

- Q: Should the multi-provider system replace, extend, or coexist with the existing LLM node system (feature 009)? → A: Extend — keep the existing system as-is, add a provider registry where users can add multiple providers (each with a color). Every node (new or imported) is assigned to a provider. Existing nodes default to the current provider. Nodes from different providers can then interact/debate via the canvas edges.
- Q: How should API keys and OAuth tokens be stored at rest? → A: Encrypted file with a machine-derived key — not plaintext on disk, no password required from the user.
- Q: How should debate context be forwarded between nodes? → A: Full history — each node receives all prior messages. Additionally, users can optionally generate a global summary of an entire group of nodes (e.g., summarize a full debate into a single synthesis node).
- Q: Can users register multiple instances of the same provider type? → A: Yes — multiple instances allowed, each with its own name, color, and credentials (e.g., two OpenAI keys: "Work GPT" and "Personal GPT").
- Q: How should external MCP clients authenticate when connecting to MindFlow's MCP server? → A: No authentication — open access on localhost, consistent with the single-user local app assumption and the current API pattern.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register and Use Multiple LLM Providers (Priority: P1)

A user opens the MindFlow settings and registers multiple LLM providers they have access to. For example, they add their OpenAI API key, connect their Google Gemini account via OAuth, configure a local Ollama endpoint, and connect their Anthropic Claude API key. Each provider shows its connection status (connected, error, rate-limited). The user can then create nodes on the canvas that are powered by any of these registered providers.

**Why this priority**: This is the foundational capability. Without multi-provider registration and provider-aware nodes, none of the other features (debates, MCP) are possible. Even as a standalone feature, it delivers value by letting users choose the best LLM for each task.

**Independent Test**: Can be fully tested by registering at least two providers (e.g., OpenAI API + local Ollama), creating a node for each, and verifying that each node generates responses from its designated provider.

**Acceptance Scenarios**:

1. **Given** no providers are configured, **When** the user opens the provider settings panel, **Then** they see a list of supported provider types (OpenAI API, Anthropic Claude, Google Gemini, Local/Ollama, ChatGPT Web) with an "Add" action for each.
2. **Given** the user adds an API-key-based provider (e.g., OpenAI), **When** they enter their API key and save, **Then** the system validates the key by making a lightweight test call and shows "Connected" or an error message.
3. **Given** the user adds an OAuth-based provider (e.g., Gemini), **When** they initiate the OAuth flow, **Then** they are redirected to the provider's consent page and upon return the provider shows "Connected".
4. **Given** the user adds a local provider (e.g., Ollama), **When** they enter the endpoint URL, **Then** the system checks reachability and lists available models.
5. **Given** multiple providers are connected, **When** the user creates a new LLM node on the canvas, **Then** they can select which provider and model to use for that node.
6. **Given** a node is assigned to a provider, **When** the user enters a prompt and triggers generation, **Then** the response comes from the designated provider's model.

---

### User Story 2 - Inter-LLM Debate Through Nodes (Priority: P2)

A user creates a "debate" or "discussion" workflow on the canvas where multiple LLM nodes from different providers are connected. The user poses a question or problem to a starting node. That node's response is automatically forwarded to the next connected LLM node (from a different provider), which responds with its perspective. The chain continues through all connected LLM nodes, creating a multi-perspective discussion. The user can observe the full debate, compare viewpoints, and optionally trigger additional rounds.

**Why this priority**: This is the core differentiating feature — making LLMs collaborate and challenge each other. It requires US1 (multi-provider) as a prerequisite but delivers the unique "debate" value proposition.

**Independent Test**: Can be tested by connecting 2+ provider nodes in a chain, sending a prompt to the first, and verifying that each subsequent node receives the previous response as context and generates its own reply.

**Acceptance Scenarios**:

1. **Given** two LLM nodes (e.g., Claude and GPT) are connected via an edge on the canvas, **When** the user sends a prompt to the first node, **Then** the first node generates a response, and that response is automatically sent as input to the second node.
2. **Given** a chain of 3+ LLM nodes from different providers, **When** a debate is triggered, **Then** each node responds in sequence, with access to the full conversation history from prior nodes in the chain.
3. **Given** a debate has completed one round, **When** the user clicks "Continue debate", **Then** the chain runs another round where each LLM responds to the latest messages from all other participants.
4. **Given** a debate is in progress, **When** one provider returns an error or times out, **Then** the system marks that node with an error status and continues the debate with the remaining nodes, noting the missing perspective.
5. **Given** a completed debate, **When** the user reviews the canvas, **Then** each node displays its provider's response, and the conversation flow is visually traceable through the edges.

---

### User Story 3 - MCP Server for External Tool Integration (Priority: P3)

MindFlow exposes itself as an MCP (Model Context Protocol) server. External AI-powered tools such as Claude Code, OpenAI Codex CLI, or any MCP-compatible client can connect to MindFlow and interact with the canvas. These external tools can read existing nodes, create new nodes, trigger LLM operations, and participate in debates as additional LLM participants. This turns MindFlow into a collaborative AI workspace accessible from any MCP client.

**Why this priority**: This extends the platform's reach beyond the browser UI, enabling power users and developer tools to integrate. It depends on US1 (providers exist) and optionally US2 (debates work), but adds the "ultimate" extensibility layer.

**Independent Test**: Can be tested by starting the MCP server, connecting with an MCP client (e.g., Claude Code), and verifying that the client can list canvases, read nodes, create nodes, and trigger LLM generation.

**Acceptance Scenarios**:

1. **Given** MindFlow is running, **When** an MCP client connects using the MCP protocol on localhost, **Then** the client can immediately access the list of available MCP tools/resources (no authentication required).
2. **Given** an MCP client is connected, **When** it calls the "list_canvases" tool, **Then** it receives the list of existing canvases with their IDs and names.
3. **Given** an MCP client is connected, **When** it calls "read_node" with a node ID, **Then** it receives the node's content, provider info, LLM response, and metadata.
4. **Given** an MCP client is connected, **When** it calls "create_node" with content and a provider designation, **Then** a new node appears on the canvas and is visible in the UI.
5. **Given** an MCP client is connected, **When** it calls "trigger_llm" on a node, **Then** the node's designated LLM provider generates a response, and the MCP client receives the result.
6. **Given** an active debate on the canvas, **When** an MCP client calls "join_debate" with a node ID, **Then** the MCP client's responses are included in the debate flow alongside the other LLM nodes.

---

### User Story 4 - Provider-Specific Node Appearance (Priority: P4)

Each LLM provider has a distinct visual identity on the canvas. Nodes show the provider's name/icon, use provider-specific color coding, and display the model name. This allows users to instantly identify which LLM is behind each node when viewing a debate or a complex workflow.

**Why this priority**: Quality-of-life improvement that makes multi-provider canvases readable. Low complexity but depends on US1 being complete.

**Independent Test**: Can be tested by creating nodes from 3+ different providers and verifying each has distinct visual appearance (color, label, icon).

**Acceptance Scenarios**:

1. **Given** a node is assigned to OpenAI, **When** the node is rendered, **Then** it displays the OpenAI provider name, model name, and uses a green color scheme.
2. **Given** a node is assigned to a local Ollama model, **When** the node is rendered, **Then** it displays "Local" with the model name and uses a distinct color scheme.
3. **Given** a canvas with nodes from 4 different providers, **When** the user views the canvas, **Then** each provider's nodes are visually distinguishable at a glance.

---

### User Story 5 - MCP Client for Consuming External Tools (Priority: P3)

MindFlow acts as an MCP **client**, connecting to external MCP servers to consume their tools and resources. For example, a user can connect MindFlow to a file-system MCP server, a database MCP server, a web-search MCP server, or any custom MCP server. The tools exposed by these external servers become available as actions within the canvas — LLM nodes can call external MCP tools as part of their workflows, and users can manually invoke external tools from the UI. This makes MindFlow a hub that orchestrates not just LLMs but also the broader ecosystem of MCP-compatible services.

**Why this priority**: Same priority as US3 (MCP server). Together, server + client make MindFlow a full MCP participant — it can both expose its canvas to external AI tools AND consume external capabilities. This enables powerful workflows like "ask Claude to analyze data from a database MCP server, then debate the findings with GPT using web search results from another MCP server."

**Independent Test**: Can be tested by connecting MindFlow to at least one external MCP server (e.g., a filesystem MCP server), discovering its tools, and invoking one of those tools from within a canvas node.

**Acceptance Scenarios**:

1. **Given** MindFlow is running, **When** the user opens the MCP connections settings, **Then** they can add an external MCP server by providing its connection details (transport type, URL/command).
2. **Given** an external MCP server is connected, **When** the user views the available tools list, **Then** they see all tools exposed by that server with their names, descriptions, and input schemas.
3. **Given** external MCP tools are available, **When** the user creates or edits an LLM node, **Then** they can attach one or more external MCP tools that the LLM can call during generation (tool use / function calling).
4. **Given** an LLM node has external MCP tools attached, **When** the LLM generates a response that includes a tool call, **Then** MindFlow executes the tool call against the external MCP server and feeds the result back to the LLM.
5. **Given** multiple external MCP servers are connected, **When** the user browses available tools, **Then** tools are grouped by their source server and clearly labeled.
6. **Given** an external MCP server disconnects, **When** a node tries to use one of its tools, **Then** the system shows a clear error indicating the MCP server is unavailable, without crashing the node's workflow.

---

### Edge Cases

- What happens when a provider's API key is revoked or expires mid-session? The system must show a clear error on affected nodes and allow re-authentication without losing the node's content or position.
- What happens when a local LLM endpoint (Ollama) goes offline during a debate? The debate continues with remaining providers; the offline node shows a "provider unavailable" status.
- What happens when two providers return conflicting rate-limit errors simultaneously during a debate? Each node handles rate limits independently; the system queues retries per-provider and shows per-node status.
- What happens when an MCP client tries to access a canvas that another user is actively editing? The MCP server uses the same in-memory state, so changes are immediately visible but no conflict resolution is provided (single-user assumption).
- What happens when a provider is removed while nodes using it still exist? Existing nodes retain their content but are marked as "provider disconnected"; they cannot generate new responses until reassigned to an active provider.
- What happens when the debate chain forms a cycle (node A → B → C → A)? The system detects cycles and limits debate rounds to a configurable maximum (default: 5 rounds) to prevent infinite loops.
- What happens when an external MCP server responds slowly or times out? The system applies a configurable timeout per MCP tool call and surfaces the timeout error to the LLM node, allowing the LLM to decide whether to retry or proceed without the tool result.
- What happens when an external MCP tool returns an error? The error is passed back to the LLM as a tool result with an error status, allowing the LLM to handle it gracefully (e.g., try a different approach or report the issue).
- What happens when an external MCP server's tool schema changes after initial discovery? The system re-discovers tools when the user manually refreshes or when a tool call fails with a schema mismatch error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extend the existing LLM node system (feature 009) with a provider registry — users can add multiple provider instances, each with its own name, authentication method (API key, OAuth token, or endpoint URL), and a user-chosen color. Multiple instances of the same provider type are allowed (e.g., two OpenAI accounts with different keys). Existing nodes and behavior are preserved; nodes without an explicit provider assignment use a default provider.
- **FR-002**: System MUST support at least these provider types: OpenAI API, Anthropic Claude API, Google Gemini (API key or OAuth), local inference (Ollama/LM Studio), and ChatGPT Web (existing access token flow).
- **FR-003**: Each provider registration MUST include a validation step that confirms connectivity before marking the provider as "connected".
- **FR-004**: System MUST allow each LLM node on the canvas to be assigned to a specific registered provider and model.
- **FR-005**: System MUST persist provider configurations across application restarts. API keys and OAuth tokens MUST be stored in an encrypted file using a machine-derived key (not plaintext on disk, no user password required).
- **FR-006**: System MUST support sequential message forwarding between connected LLM nodes to enable debate/discussion workflows.
- **FR-007**: System MUST include the full conversation history from prior nodes when forwarding to the next node in a debate chain. Each provider handles its own context window limits.
- **FR-008**: System MUST allow users to trigger additional debate rounds on an existing chain.
- **FR-008b**: System SHOULD allow users to generate a global summary of a group of nodes (e.g., synthesize a full debate into a single summary node). This is optional and user-triggered.
- **FR-009**: System MUST handle provider failures gracefully during debates — marking failed nodes and continuing with remaining providers.
- **FR-010**: System MUST expose an MCP-compliant server that allows external tools to interact with canvases, nodes, and LLM operations.
- **FR-011**: MCP server MUST expose tools for: listing canvases, reading/creating/updating nodes, triggering LLM generation, and participating in debates.
- **FR-012**: System MUST display provider identity (name, model, color) on each LLM node for visual differentiation.
- **FR-013**: System MUST detect and prevent infinite loops in debate chains by enforcing a configurable maximum round count.
- **FR-014**: System MUST allow reassigning a node from one provider to another without losing the node's existing content or position.
- **FR-015**: System MUST act as an MCP client, capable of connecting to one or more external MCP servers simultaneously.
- **FR-016**: System MUST discover and list all tools exposed by connected external MCP servers, including their names, descriptions, and input schemas.
- **FR-017**: System MUST allow LLM nodes to be configured with access to external MCP tools, enabling tool-use / function-calling during LLM generation.
- **FR-018**: When an LLM generates a tool call targeting an external MCP tool, the system MUST execute the call against the appropriate MCP server and return the result to the LLM.
- **FR-019**: System MUST handle external MCP server disconnections gracefully, showing clear errors without crashing active workflows.
- **FR-020**: System MUST persist external MCP server connection configurations across application restarts.

### Key Entities

- **LLM Provider**: A registered connection to an LLM service. Has a type (openai, anthropic, gemini, local, chatgpt-web), authentication credentials, connection status, user-chosen color, and list of available models. Multiple providers of the same type can coexist (e.g., two OpenAI accounts with different keys).
- **LLM Node**: A canvas node bound to a specific provider and model. Contains prompt content, generated response, provider assignment, and visual styling derived from the provider.
- **Debate Chain**: An ordered sequence of connected LLM nodes that pass messages between each other. Has a starting prompt, round count, max rounds, and completion status.
- **MCP Tool (Server)**: A capability exposed by MindFlow's MCP server (e.g., "list_canvases", "create_node", "trigger_llm"). Each tool has a name, description, input schema, and handler function.
- **MCP Connection (Client)**: A connection from MindFlow to an external MCP server. Has a transport type (stdio, SSE, streamable HTTP), connection details, status, and a discovered list of remote tools.
- **Remote MCP Tool**: A tool discovered from an external MCP server, available for LLM nodes to invoke. Has a source server, name, description, input schema, and invocation handler.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can register and validate at least 3 different LLM providers within 5 minutes of first setup.
- **SC-002**: A debate between 3 LLM providers completes a full round (each provider responds once) within 60 seconds under normal network conditions.
- **SC-003**: An MCP client can connect and successfully execute a basic workflow (list canvases, read a node, create a node) within 30 seconds of connection.
- **SC-004**: Users can visually distinguish between nodes from different providers at a glance, without reading labels, based on color coding alone.
- **SC-005**: Provider failures during debates do not block or crash the remaining debate participants — the debate completes with available providers in 100% of failure scenarios.
- **SC-006**: System supports at least 5 concurrent provider registrations without performance degradation.
- **SC-007**: Users can connect to an external MCP server and discover its tools within 30 seconds of adding the connection.
- **SC-008**: An LLM node with external MCP tools attached can successfully execute a tool call and incorporate the result into its response in a single generation cycle.

## Assumptions

- The application is single-user (no multi-tenancy or concurrent user conflicts).
- Provider API keys and OAuth tokens are managed per-installation, not per-user.
- Local LLM providers (Ollama, LM Studio) expose an OpenAI-compatible API endpoint.
- The MCP server runs alongside the existing FastAPI backend on a separate port or as an additional transport.
- External MCP servers may use stdio, SSE, or streamable HTTP transports; the system supports all three.
- Debate chains are explicit (user-created edges between LLM nodes), not automatically inferred.
- Rate limiting is handled per-provider with standard retry logic; no cross-provider rate coordination is needed.
- This feature extends the existing feature 009 LLM node system — it does not replace or duplicate it. Existing canvas data and node behavior remain compatible.
