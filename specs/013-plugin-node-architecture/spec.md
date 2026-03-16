# Feature Specification: Plugin Node Architecture

**Feature Branch**: `013-plugin-node-architecture`
**Created**: 2026-03-15
**Status**: Draft
**Input**: Refonte complete du systeme LLM Provider avec architecture plugin inspiree de ComfyUI. Interface propre, plugins dynamiques, type system, execution engine, nettoyage du code existant, frontend dynamique, migration incrementale.

## Clarifications

### Session 2026-03-15

- Q: Are LLM providers a separate concept from node types, or are providers just one category of node type in the unified plugin registry? → A: Two-layer architecture. Layer 1: LLM Provider Interface is an independent driver layer with a common interface for all LLM providers (connection, authentication, generate, stream, list_models, status/progress/queue). Layer 2: Node Type Plugins are visual canvas nodes that USE provider instances. An `llm_chat` node references a configured LLM provider instance. Providers are NOT node types — they are a separate subsystem consumed by LLM-category node plugins.
- Q: Should the old node type enum (question, answer, note...) be preserved alongside plugin class_type, or replaced entirely? → A: Replace entirely (Option A). The old enum disappears. Everything is defined by plugins. The current dual-zone prompt/response node becomes a plugin (e.g., `llm_chat`). New node types like `llm_battle`, `text_summarize`, `sticky_note` are just plugins.
- Q: Can node inputs be both inline (typed in the node) and connected (from another node)? → A: Yes. Same as ComfyUI: an input can be either filled directly in the node widget OR received via a connection from another node's output. The plugin defines its inputs; the user chooses how to provide them.
- Q: Do nodes have multiple visual representations? → A: Yes. Each plugin defines at least two views: a compact canvas view (inline, minimal) and a full detail panel view (right sidebar, all controls and content). The frontend renders the appropriate view based on context.
- Q: Is the LLM provider interface independent from the node plugin system? → A: Yes. The LLM Provider Interface is a separate, self-contained driver layer. It manages connection/disconnection, authentication, prompt/response methods, execution, queue/progress tracking (with percentage), and provider-specific parameters. Node plugins that need LLM capabilities consume provider instances through this common interface, allowing providers to be used anonymously via the plugin system.
- Q: Can nodes be grouped into reusable composite nodes (sub-functions)? → A: Yes. Users can group multiple nodes into a Composite Node that acts as a single node on the canvas. The composite exposes configurable parameters (e.g., summary type: linear vs temporal) while hiding internal complexity. This is a key differentiator from ComfyUI which lacks native sub-graph support.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean Node Type Interface & Code Cleanup (Priority: P1)

As a developer, I need a clean, strict node type interface AND a separate LLM Provider Interface (driver layer), plus the 15 identified bugs fixed, so that every node type behaves consistently, LLM providers are properly isolated with explicit credentials, and errors are explicit — no silent fallbacks, no env-var magic, no dead code.

The current codebase has 15 identified issues: silent 3-tier fallback chains, dead classes (LLMService), unsafe manual JSON escaping, credential leaks between Gemini instances, swallowed Ollama errors, inconsistent type identifiers, deprecated API usage, and more.

**Why this priority**: Nothing can be built reliably on a broken foundation. This is the prerequisite for all other stories.

**Independent Test**: Can be tested by instantiating each node type with valid and invalid credentials, verifying correct behavior and explicit errors. Automated tests verify each of the 15 issues is resolved.

**Acceptance Scenarios**:

1. **Given** a node type instantiated without required credentials, **When** any operation is attempted, **Then** the system raises an immediate, explicit error with a message naming the missing credential.
2. **Given** two node type instances of the same kind with different credentials, **When** both are used concurrently, **Then** each uses its own credentials without cross-contamination.
3. **Given** the streaming endpoint emits a token containing special characters (tabs, carriage returns, unicode, backslashes), **When** the frontend receives it, **Then** the JSON is valid and parses correctly.
4. **Given** a node type cannot be resolved for a streaming operation, **When** the stream is requested, **Then** a single clear error event is emitted — no multi-tier silent fallback.
5. **Given** the codebase after cleanup, **When** inspected, **Then** dead code (LLMService, unused cache, deprecated asyncio calls) has been removed and node type identifiers are consistent across models, routes, and registry.

---

### User Story 2 - Plugin Discovery & Registration (Priority: P2)

As a system administrator, I want to add new node types (LLM nodes, transform nodes, input nodes, tool nodes, or any other kind) by placing a plugin folder in the plugins directory, so that the system discovers and loads it at startup without modifying core code.

**Why this priority**: This is the architectural shift from hardcoded node types to a dynamic plugin system. Depends on the clean interface from US1. Enables all future extensibility.

**Independent Test**: Can be tested by placing a new plugin folder, restarting the application, and verifying the new node type appears in the available types list via the discovery endpoint.

**Acceptance Scenarios**:

1. **Given** a valid plugin folder in the plugins directory, **When** the application starts, **Then** the plugin is discovered, validated, and its node types are registered in the unified registry.
2. **Given** a plugin with missing required manifest fields, **When** the application starts, **Then** the plugin is skipped with a clear warning log naming the plugin and the missing fields.
3. **Given** a plugin that registers a node type ID already claimed by another plugin, **When** the application starts, **Then** the duplicate is rejected with an error naming both conflicting plugins.
4. **Given** the application is running, **When** a user requests the node type discovery endpoint, **Then** all loaded plugins' node types are returned with their metadata: inputs, outputs, category, display name, UI hints.

---

### User Story 3 - Existing LLM Node Migration (Priority: P3)

As a user with existing workflows using OpenAI, Anthropic, Ollama, Gemini, or ChatGPT Web, I want my current LLM nodes to continue working seamlessly after migration to the plugin architecture.

**Why this priority**: Users must not lose functionality. The 5 existing LLM node types must be migrated to plugin format while preserving all capabilities (streaming, OAuth, model discovery).

**Independent Test**: Can be tested by loading an existing workflow with each of the 5 LLM node types and verifying identical execution results and behavior.

**Acceptance Scenarios**:

1. **Given** an existing workflow using any of the 5 current LLM node types, **When** the system runs on the plugin architecture, **Then** the workflow executes without modification and produces identical results.
2. **Given** a ChatGPT Web node configured with OAuth, **When** used through the plugin system, **Then** OAuth authentication and token refresh work as before.
3. **Given** a node with saved credentials and model selection, **When** the plugin system loads, **Then** credentials and model settings are preserved and applied automatically.
4. **Given** an Ollama node, **When** it encounters a server error (e.g., model not found), **Then** the error message is surfaced to the user instead of being silently swallowed.

---

### User Story 4 - Type-Safe Node Connections (Priority: P4)

As a user building workflows on the canvas, I want the system to prevent me from connecting incompatible nodes, so that I only create valid data flows.

**Why this priority**: Type safety prevents runtime errors and provides visual feedback. Depends on plugins defining their input/output types.

**Independent Test**: Can be tested by attempting compatible and incompatible connections on the canvas and verifying acceptance or visual rejection.

**Acceptance Scenarios**:

1. **Given** a node with a text output, **When** I drag a connection to another node's text input, **Then** the connection is established successfully.
2. **Given** a node with a text output, **When** I drag it to a node expecting an incompatible type, **Then** the connection is visually rejected.
3. **Given** connected nodes with compatible types, **When** the graph executes, **Then** data flows correctly between them with no type errors.

---

### User Story 5 - Graph Execution Engine (Priority: P5)

As a user running a multi-node workflow, I want nodes to execute in the correct dependency order with the final node streaming in real-time, so that parent context is resolved before child nodes execute.

**Why this priority**: The execution engine ties everything together. Currently each node executes independently with no graph awareness.

**Independent Test**: Can be tested by creating a 3-node chain (input -> transform -> LLM) and verifying sequential execution with streaming on the final node.

**Acceptance Scenarios**:

1. **Given** a graph with nodes A -> B -> C, **When** execution is triggered on node C, **Then** A and B execute first (in dependency order), and C executes last with their outputs as its inputs.
2. **Given** a node with two parents, **When** execution is triggered, **Then** both parents complete before the child executes, and both outputs are available.
3. **Given** a streaming-capable terminal node, **When** it executes, **Then** its response streams token-by-token to the user in real-time.
4. **Given** a parent node that fails, **When** the error occurs, **Then** child nodes do not execute and the user sees which node failed and why.
5. **Given** a graph with a cycle (A -> B -> A), **When** execution is triggered, **Then** the system detects the cycle and reports an error before any node executes.

---

### User Story 6 - Dynamic Frontend Node UI (Priority: P6)

As a user, I want the node creation interface to automatically show all available node types (LLM, transform, input, tool, etc.) with their specific inputs, so that new plugins appear in the UI without frontend code changes.

**Why this priority**: Eliminates the current problem where new node types require frontend code changes. The frontend becomes fully data-driven from the unified registry.

**Independent Test**: Can be tested by adding a new plugin, restarting, and verifying the node creation dialog shows the new type with correct inputs.

**Acceptance Scenarios**:

1. **Given** plugins are loaded, **When** the user opens the node creation dialog, **Then** all available node types are listed, organized by category (llm, input, transform, tools, etc.), with display names and icons.
2. **Given** a node type with specific inputs (e.g., temperature slider, model dropdown), **When** the user creates that node type, **Then** the UI renders appropriate input controls from the plugin's input definitions.
3. **Given** a streaming-capable node type, **When** the node executes, **Then** the UI shows real-time token streaming.
4. **Given** the discovery endpoint returns node types, **When** the frontend loads, **Then** it renders the complete node palette within 1 second without any hardcoded type lists.

---

### User Story 7 - Composite Nodes (Node Groups) (Priority: P7)

As a user building complex workflows, I want to group multiple nodes into a single reusable composite node with exposed parameters, so that I can encapsulate common patterns (e.g., a "smart summary" group with summary type options) and reuse them without recreating the internal graph each time.

**Why this priority**: Composite nodes are a major differentiator from ComfyUI and enable power users to build reusable workflow components. Depends on the plugin system (US2) and execution engine (US5) being functional first.

**Independent Test**: Can be tested by creating a group of 3 nodes, converting them to a composite, configuring exposed parameters, and verifying the composite executes as a single unit with correct results.

**Acceptance Scenarios**:

1. **Given** a selection of connected nodes on the canvas, **When** the user groups them into a composite node, **Then** a single composite node replaces them on the canvas, with the internal graph hidden.
2. **Given** a composite node, **When** the user configures its exposed parameters (e.g., summary type: linear, temporal), **Then** the internal nodes use those parameter values during execution.
3. **Given** a composite node, **When** execution is triggered, **Then** the internal nodes execute in correct dependency order and the composite's outputs are produced.
4. **Given** a saved composite node definition, **When** the user places a new instance of it on another canvas, **Then** it works identically with its own independent parameter values.
5. **Given** a composite node, **When** the user double-clicks it, **Then** the internal graph is revealed for inspection or editing.

---

### Edge Cases

- What happens when a composite node's internal graph references a plugin that is no longer installed? The composite loads with a "missing plugin" indicator on the affected internal node; the composite itself is marked as broken with a clear error.

- What happens when a plugin folder has no `__init__.py`? The system ignores it (no error, just skipped).
- What happens when two plugins register the same node type ID? The second is rejected with a clear error naming both plugins.
- What happens when a workflow references a node type from a removed plugin? The workflow loads with a "missing plugin" indicator on affected nodes; other nodes remain functional.
- What happens when a graph has a cycle? The execution engine detects it and reports an error before any node executes.
- What happens when execution of a long chain is cancelled mid-way? Completed nodes retain their results; the currently executing node is interrupted; downstream nodes are marked as cancelled.
- What happens when a plugin's node type has no streaming support but the user expects streaming? The node executes in batch mode and delivers the complete result at once — the UI indicates "non-streaming."
- What happens when an old workflow using the legacy `type` enum (question, answer, note) is loaded? An automatic migration maps legacy types to their corresponding plugin node types (e.g., `question` -> `llm_chat` with prompt content preserved).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define two separate interfaces: (1) a base node type interface with a mandatory execution method for all node plugins, and (2) an LLM Provider Interface — an independent driver layer with a common interface for connection management, authentication, generate, stream, list_models, status/progress/queue tracking, and provider-specific parameters. LLM-category node plugins consume provider instances through the provider interface; they do not implement LLM logic directly.
- **FR-002**: System MUST reject any node type that does not implement all mandatory interface methods for its category, at load time, with a clear error message.
- **FR-003**: LLM providers MUST receive credentials explicitly at construction time. No provider may silently fall back to environment variables, configuration files, or default values for authentication. Node plugins that consume providers receive a pre-authenticated provider instance.
- **FR-004**: System MUST scan designated plugin directories at startup and dynamically load all valid plugins found.
- **FR-005**: Each plugin MUST declare a manifest with at minimum: name, version, and node-to-class mappings.
- **FR-006**: System MUST expose a single discovery endpoint that returns all available node type definitions from the unified registry, including inputs, outputs, categories, and UI hints.
- **FR-007**: System MUST define a set of data types for node connections and enforce type compatibility when users create connections between nodes.
- **FR-008**: The frontend MUST construct node creation UI dynamically from the node type definitions returned by the discovery endpoint — no hardcoded node type lists.
- **FR-019**: Each node type MUST define at least two visual representations: a compact canvas view (for inline display on the graph) and a full detail panel view (for the right sidebar with all controls and content).
- **FR-020**: Node inputs MUST support two provision modes: inline (value typed directly in the node widget) and connected (value received from another node's output via a connection). The mode is chosen by the user per-input.
- **FR-021**: The old node type enum (question, answer, note, hypothesis, etc.) MUST be fully replaced by plugin-defined node types. The current dual-zone prompt/response node behavior MUST be preserved as a plugin (e.g., an LLM chat plugin).
- **FR-022**: The LLM Provider Interface MUST support: connect/disconnect, authenticate, generate (batch), stream (token-by-token), list_models, get_status (idle/working/error), get_progress (percentage when available), and queue management. Each provider implementation handles its own specifics (OAuth for ChatGPT Web, local server for Ollama, API keys for OpenAI/Anthropic/Gemini) behind this common interface.
- **FR-023**: LLM provider instances MUST be independent and isolated. Two instances of the same provider type with different credentials MUST operate without cross-contamination of state, credentials, or configuration.
- **FR-009**: System MUST execute graph nodes in topological order, resolving parent outputs before executing child nodes.
- **FR-010**: The terminal node in an execution chain MUST support streaming its response token-by-token in real-time when the node type supports streaming.
- **FR-011**: The 5 existing LLM node types (OpenAI API, Anthropic, Ollama, Gemini, ChatGPT Web) MUST be migrated to plugin format and function identically.
- **FR-012**: System MUST detect and reject circular dependencies in the graph before execution begins.
- **FR-013**: System MUST use proper data serialization for all server-sent events — no manual string character escaping.
- **FR-014**: Node type identifiers MUST be consistent across the entire system: data storage, operation requests, registry, and API responses.
- **FR-015**: All dead code identified in the code review MUST be removed: unused services, unreachable cache logic, deprecated API calls.
- **FR-016**: When a node type cannot be resolved, the system MUST return a single clear error. No multi-tier silent fallback chains.
- **FR-017**: Existing user workflows and saved configurations MUST be preserved during migration with no manual reconfiguration.
- **FR-018**: System MUST handle plugin node type ID conflicts by rejecting the duplicate and logging the conflict with both plugin names.
- **FR-024**: System MUST allow users to group a selection of connected nodes into a Composite Node. The composite acts as a single node on the canvas with its own inputs, outputs, and exposed configurable parameters.
- **FR-025**: Composite Nodes MUST expose user-selected parameters from their internal nodes as top-level configuration options (e.g., summary type, weighting strategy). Internal complexity is hidden from the canvas view.
- **FR-026**: Composite Nodes MUST be reusable — a composite definition can be instantiated multiple times, each with independent parameter values. Composite definitions MUST be saveable and loadable.
- **FR-027**: The execution engine MUST treat a Composite Node as a sub-graph, executing its internal nodes in correct topological order as part of the larger graph execution.

### Key Entities

- **Plugin**: A self-contained unit providing one or more node types. Contains a manifest (name, version, author, dependencies) and node class mappings. Loaded from a directory at startup.
- **Node Type**: A definition of what a node can do — its inputs, outputs, execution capability, category, UI hints, and visual representations (compact canvas view + full detail panel view). All node types (LLM, transform, input, tool, etc.) live in one unified registry. Registered by a plugin and discoverable by the frontend. Inputs can be inline (widget) or connected (from another node).
- **LLM Provider**: An independent driver implementing the LLM Provider Interface. Manages connection, authentication, generation (batch and streaming), model listing, status reporting, and progress/queue tracking for a specific LLM service. Providers are NOT node types — they are a separate subsystem consumed by LLM-category node plugins.
- **LLM Provider Instance**: A configured, authenticated instance of an LLM Provider. Holds its own credentials, connection state, and provider-specific parameters. Multiple instances of the same provider type can coexist with different configurations.
- **Composite Node**: A user-created group of nodes packaged as a single reusable unit. Exposes selected internal parameters as top-level configuration options. Acts as a sub-graph during execution. Can be saved, shared, and instantiated multiple times with independent configurations.
- **Data Type**: A named type (text, context, usage, tool result, etc.) that defines what flows between nodes. Used to validate connections.
- **Node Instance**: A concrete node in a user's graph with a specific node type, configured input values, and connections to other nodes. LLM-category nodes hold a reference to an LLM Provider Instance.
- **Execution Plan**: The topologically sorted sequence of nodes to execute for a given target, including dependency resolution and streaming designation for the terminal node.
- **Credential Set**: Per-provider credentials stored securely and injected explicitly at provider construction. Never stored in graph data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adding a new node type (LLM, transform, tool, or any kind) requires zero changes to core application code — only placing a plugin folder and restarting.
- **SC-002**: All 15 identified code review issues are resolved and verified by tests.
- **SC-003**: 100% of existing workflows using the 5 current LLM node types execute identically after migration.
- **SC-004**: Users see clear, actionable error messages within 2 seconds when a node type fails — no silent failures or infinite retries.
- **SC-005**: The frontend node creation interface shows all available node types within 1 second of page load, without any hardcoded type lists.
- **SC-006**: A 5-node chain executes correctly in dependency order with the terminal node streaming in real-time.
- **SC-007**: Concurrent use of two instances of the same node type with different credentials never results in credential cross-contamination.
- **SC-008**: Invalid node connections (type mismatch) are visually rejected before execution, with zero type errors at runtime for validated graphs.
- **SC-009**: A composite node grouping 3+ internal nodes executes correctly as a single unit, with exposed parameters controlling internal behavior, and can be reused across canvases.

## Assumptions

- Plugins are loaded once at startup. Hot-reloading during runtime is out of scope (restart required).
- The existing credential storage mechanism is preserved. Node types receive credentials via the existing secure storage.
- Community plugins are architecturally supported but the marketplace/CLI installer is out of scope. Users manually place plugin folders.
- The type system starts with 5-8 built-in types and may be extended in the future.
- OAuth flows (ChatGPT Web) are supported through the LLM Provider Interface via provider-specific authentication methods.
- The system has two distinct layers: (1) LLM Provider Interface for driver-level provider management, and (2) Plugin Node Type Registry for all visual/workflow node types. The old hardcoded provider registry is replaced by the LLM Provider Interface; the old node type enum is replaced by the plugin system.

## Scope Boundaries

### In Scope
- Two-layer interface: base node type interface for all plugins + independent LLM Provider Interface (driver layer) for connection, auth, generate, stream, list_models, status, progress/queue
- Single plugin registry for all node types (LLM, transform, input, tool, etc.) — LLM nodes consume provider instances
- Plugin discovery, validation, and loading at startup
- Migration of 5 existing LLM node types to plugin format
- Node type definition with inputs, outputs, and UI hints
- Type system for node connections with built-in types
- Graph execution engine with topological sort and terminal node streaming
- Discovery endpoint for frontend node type enumeration
- Frontend dynamic UI from plugin metadata
- All 15 code review bug fixes and dead code removal
- Composite Nodes (node groups) with exposed parameters, reusable definitions, and sub-graph execution
- Backward compatibility with existing workflows and credentials
- Replacement of the old hardcoded provider registry with the new LLM Provider Interface
- Removal of the old node type enum in favor of the unified plugin system

### Out of Scope
- Plugin hot-reloading without restart
- Plugin marketplace or CLI installer
- Plugin sandboxing or security isolation
- Visual plugin manager in the UI
- Custom type definitions by plugins (only built-in types)
- Plugin-to-plugin dependency resolution
- Parallel execution of independent graph branches (future optimization)
