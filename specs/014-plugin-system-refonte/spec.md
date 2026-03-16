# Feature Specification: Plugin System Refonte

**Feature Branch**: `014-plugin-system-refonte`
**Created**: 2026-03-15
**Status**: Draft
**Input**: Refonte complète du système LLM Provider avec architecture plugin inspirée de ComfyUI. Interface stricte, plugins dynamiques, registry backend, type system, execution engine, code cleanup, frontend dynamique, migration incrémentale, support communautaire.

## Clarifications

### Session 2026-03-15

- Q: Backward compatibility for existing graphs — auto-migrate, dual support, or migration script? → A: No existing data to preserve. New format only, no migration needed.
- Q: Should the execution engine re-execute all ancestors every time, or reuse cached results? → A: Dependency-based invalidation (like make/compilation). Each node tracks a dirty/clean state. When a node's inputs change or a parent is re-executed, it and all descendants are marked dirty. Only dirty nodes re-execute; clean nodes reuse cached results.
- Q: What trust level for community plugins? → A: Full trust, same as ComfyUI. Community plugins run with same privileges as core plugins. Warning displayed at install/load time. No sandboxing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plugin-Based Provider Registration (Priority: P1)

As a system administrator, I want each LLM provider (OpenAI, Anthropic, Ollama, Gemini, ChatGPT Web) to be a self-contained plugin with a strict interface, so that adding new providers requires no changes to core code.

**Why this priority**: This is the foundation — nothing else works until providers are plugins. Every other story depends on the plugin discovery and loading mechanism.

**Independent Test**: Can be fully tested by starting the server with 5 migrated provider plugins in `plugins/core/`, verifying that each is discovered, loaded, validated, and callable. The system must refuse to load any plugin missing required interface methods.

**Acceptance Scenarios**:

1. **Given** the server starts with provider plugins in the plugin directory, **When** the plugin registry scans the directory, **Then** each valid plugin is loaded and its node classes are registered.
2. **Given** a plugin is missing a required interface method (e.g., `generate`), **When** the registry attempts to load it, **Then** it logs a clear error and skips the plugin without affecting others.
3. **Given** a plugin declares dependencies in its manifest, **When** a dependency is not installed, **Then** the system reports the missing dependency and skips the plugin.
4. **Given** all 5 core providers are migrated, **When** listing available node types, **Then** all 5 providers appear with their full metadata (inputs, outputs, credentials, UI hints).

---

### User Story 2 - Node Type Discovery Endpoint (Priority: P1)

As a frontend developer, I want a single endpoint that returns all available node type definitions, so the UI can be generated dynamically without hardcoded node types.

**Why this priority**: Equally foundational — the frontend cannot become dynamic until it has a metadata source. This endpoint is the bridge between backend plugins and frontend UI.

**Independent Test**: Can be tested by calling the discovery endpoint and verifying it returns complete metadata for every loaded plugin, including inputs, outputs, types, UI hints, and credential requirements.

**Acceptance Scenarios**:

1. **Given** plugins are loaded, **When** the frontend requests available node types, **Then** it receives a complete catalog of every node type with display name, category, input definitions, output types, streaming capability, and UI hints.
2. **Given** a new plugin is added to the plugin directory and the server restarts, **When** the frontend requests node types, **Then** the new plugin appears in the catalog.
3. **Given** the endpoint returns node metadata, **When** the frontend renders the node creator, **Then** nodes are grouped by category and show the correct display name and brand color.

---

### User Story 3 - Type-Safe Node Connections (Priority: P2)

As a workflow designer, I want the system to enforce type compatibility when connecting nodes, so I cannot accidentally connect incompatible data types (e.g., an integer output to a context input).

**Why this priority**: Type safety prevents user errors and makes workflows more predictable. Depends on US1 (node metadata must be available).

**Independent Test**: Can be tested by attempting to create connections between nodes with various type combinations and verifying that only compatible connections are accepted.

**Acceptance Scenarios**:

1. **Given** a node with a STRING output and another with a STRING input, **When** I drag a connection between them, **Then** the connection is accepted.
2. **Given** a node with a STRING output and another with an INT input, **When** I drag a connection, **Then** the connection is rejected with a visual indicator.
3. **Given** the built-in type catalog (STRING, CONTEXT, USAGE, TOOL_RESULT, INT, FLOAT, BOOLEAN, EMBEDDING, DOCUMENT), **When** the frontend loads, **Then** each type has a distinct color for visual identification on connection ports.
4. **Given** a STRING output connecting to a CONTEXT input, **When** the system allows predefined compatible conversions, **Then** the connection is accepted with a visual hint indicating conversion.

---

### User Story 4 - Graph Execution Engine (Priority: P2)

As a user, I want to trigger execution on a node and have all its ancestor nodes execute first in dependency order, with the final node streaming its response token-by-token.

**Why this priority**: This is the core runtime behavior that replaces the current single-node execution. Depends on US1 (plugins must be loadable and callable).

**Independent Test**: Can be tested by building a 3-node chain (TextInput → LLM → Output), triggering execution on the output node, and verifying ancestors execute in order with the last node streaming.

**Acceptance Scenarios**:

1. **Given** a graph with nodes A → B → C where all are dirty, **When** I trigger execution on C, **Then** A executes first, then B, then C streams its result.
2. **Given** a graph with diamond dependency (A → B, A → C, B → D, C → D) where all are dirty, **When** I trigger execution on D, **Then** A executes once, B and C can execute in parallel, then D streams.
5. **Given** a graph A → B → C where A and B already executed and are clean, **When** I trigger execution on C without changing any inputs, **Then** A and B are skipped (cached results reused) and only C executes.
6. **Given** a graph A → B → C where A is clean, **When** I modify A's prompt, **Then** A, B, and C are all marked dirty, and triggering C re-executes all three.
3. **Given** a parent node fails during execution, **When** the failure propagates, **Then** downstream nodes are skipped and the user sees a clear error indicating which node failed and why.
4. **Given** a streaming node is executing, **When** the user cancels, **Then** execution stops and all in-progress nodes are cleaned up.

---

### User Story 5 - Dynamic Frontend Node Creator (Priority: P3)

As a user, I want the node creator dialog to show all available node types organized by category, with each node's appearance (color, icon, inputs, outputs) generated from plugin metadata rather than hardcoded.

**Why this priority**: This completes the dynamic UI vision. Depends on US1-US2 being stable.

**Independent Test**: Can be tested by adding a new plugin with unique metadata, restarting the server, and verifying the node creator shows the new node type with correct appearance without any frontend code changes.

**Acceptance Scenarios**:

1. **Given** the node creator is open, **When** it displays available nodes, **Then** nodes are grouped by category (e.g., llm/openai, llm/anthropic, tools/mcp, input, transform).
2. **Given** a node type has a brand color and icon in its metadata, **When** it appears in the creator, **Then** it uses that color and icon.
3. **Given** a user selects a node type and places it on the canvas, **When** the node renders, **Then** it shows the correct named input ports (left) and output ports (right) based on plugin metadata.
4. **Given** a node has optional inputs, **When** the user opens its detail panel, **Then** optional inputs appear as configurable widgets (dropdowns for COMBO, sliders for FLOAT, text fields for STRING).

---

### User Story 6 - Dead Code Cleanup and Alignment (Priority: P3)

As a developer, I want all deprecated code removed and inconsistencies fixed, so the codebase is clean and maintainable before community plugins are introduced.

**Why this priority**: Technical hygiene prevents bugs from propagating into the plugin ecosystem. Can be done incrementally alongside other stories.

**Independent Test**: Can be tested by verifying that all identified dead code is removed, all enum values align between backend and frontend, and the test suite passes with no regressions.

**Acceptance Scenarios**:

1. **Given** the deprecated LLMService class exists, **When** cleanup is complete, **Then** all references to it are removed and no code depends on it.
2. **Given** OperationStateManager cache exists but is never read, **When** cleanup is complete, **Then** the unused cache layer is removed.
3. **Given** ProviderType enum has mismatched values between backend and frontend, **When** alignment is complete, **Then** both sides use identical enum values.
4. **Given** manual string escaping exists in the codebase, **When** cleanup is complete, **Then** all instances use standard serialization.
5. **Given** 15 identified code review issues exist, **When** cleanup is complete, **Then** all 15 issues are resolved and documented.

---

### User Story 7 - Community Plugin Support (Priority: P4)

As a power user, I want to install third-party plugins from a git repository or package manager into the community plugins directory, so I can extend MindFlow with custom node types.

**Why this priority**: Future-facing feature that depends on all other stories being stable. Scoped as a preparatory story (directory structure, loading mechanism, documentation) — not a full marketplace.

**Independent Test**: Can be tested by placing a sample community plugin in the community plugins directory, restarting the server, and verifying it loads and appears in the node creator alongside core plugins.

**Acceptance Scenarios**:

1. **Given** a valid plugin exists in the community plugins directory, **When** the server starts, **Then** it is loaded with full trust (same privileges as core plugins) and a warning is logged indicating a community plugin was loaded.
2. **Given** a community plugin has a version incompatibility (declared minimum version higher than current), **When** the registry loads it, **Then** it shows a clear warning and skips the plugin.
3. **Given** a community plugin conflicts with a core plugin (same node ID), **When** the registry loads both, **Then** the core plugin takes precedence and a warning is logged.

---

### Edge Cases

- What happens when a plugin directory is empty or contains only an init file without node class mappings? System skips it with a warning log.
- What happens when two plugins register nodes with the same ID? Core plugins take precedence; among community plugins, the first loaded wins with a warning.
- What happens when a plugin's async generate or stream method raises an unhandled exception? The execution engine catches it, marks the node as errored, and reports the error to the user without crashing other nodes.
- What happens when a graph has a cycle (A → B → A)? The topological sort detects it and returns an error before execution begins.
- What happens when a node type is removed (plugin uninstalled) but existing graphs reference it? The system shows the node as "unknown type" with an error state, and the graph can still be opened and edited.
- What happens when credentials required by a plugin are not configured? Execution fails on that node with a clear message: "Missing credential: [label]". No silent fallback, no environment variable guessing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST discover and load plugins by scanning designated plugin directories at startup.
- **FR-002**: Each plugin MUST declare a manifest with name, version, author, description, category, and compatibility version.
- **FR-003**: Each node class MUST expose a self-describing interface: input types (required, optional, credentials), output types, display name, category, streaming capability, and UI hints.
- **FR-004**: System MUST validate that every loaded node class implements all required interface methods before registering it.
- **FR-005**: System MUST expose a discovery endpoint that returns the complete catalog of available node types with their full metadata.
- **FR-006**: System MUST enforce type compatibility on node connections using a defined type catalog (STRING, CONTEXT, USAGE, TOOL_RESULT, INT, FLOAT, BOOLEAN, COMBO, SECRET, EMBEDDING, DOCUMENT).
- **FR-007**: System MUST execute graph nodes in topological order when a target node is triggered, re-executing only nodes whose inputs have changed (dirty) and reusing cached results for unchanged (clean) nodes.
- **FR-008**: The final (target) node in an execution MUST support token-by-token streaming to the user.
- **FR-009**: Parent nodes in an execution chain MUST execute in batch (non-streaming) mode, with results cached for reuse until invalidated.
- **FR-021**: System MUST track a dirty/clean state per node. A node becomes dirty when its own inputs are modified or when any ancestor is re-executed. Dirty state propagates to all descendants.
- **FR-010**: System MUST detect cycles in the graph and refuse execution with a clear error.
- **FR-011**: The frontend MUST generate its node creator UI dynamically from the discovery endpoint, with zero hardcoded node types.
- **FR-012**: The frontend MUST render node appearance (colors, ports, icons) from plugin metadata.
- **FR-013**: All 5 existing providers (OpenAI, Anthropic, Ollama, Gemini, ChatGPT Web) MUST be migrated to the plugin format.
- **FR-014**: System MUST NOT use silent fallbacks — if a provider, model, or credential is unavailable, the system MUST display a clear error and stop.
- **FR-015**: Credentials MUST never be stored in graph files. They MUST be resolved at runtime from a secure credential store.
- **FR-016**: System MUST support loading community plugins from a separate directory alongside core plugins.
- **FR-017**: Dead code (LLMService, OperationStateManager cache, manual string escaping) MUST be removed.
- **FR-018**: ProviderType enum MUST be aligned between backend and frontend.
- **FR-019**: All 15 identified code review issues MUST be resolved.
- **FR-020**: System MUST support execution cancellation, stopping all in-progress nodes cleanly.

### Key Entities

- **Plugin**: A self-contained directory containing a manifest, node class mappings, and node implementation code. Loaded at startup.
- **Node Type Definition**: The complete metadata describing a node's capabilities: input types, output types, streaming support, UI appearance, required credentials.
- **Type**: A named data type used for node connections (STRING, CONTEXT, USAGE, etc.) with associated color and compatibility rules.
- **Graph Execution Plan**: The topological ordering of dirty nodes from ancestors to target, determining which nodes to re-execute and which to skip (clean, cached).
- **Node Execution State**: A dirty/clean flag per node. Dirty means the node needs re-execution (input changed or ancestor re-executed). Clean means cached result is still valid.
- **Plugin Registry**: The central catalog of all loaded plugins and their node types, serving as the source of truth for both backend execution and frontend rendering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new provider can be added to the system by creating a single plugin directory — zero core code changes required.
- **SC-002**: The frontend renders node types, colors, ports, and categories entirely from server-provided metadata — removing a plugin causes its nodes to disappear from the UI on next load.
- **SC-003**: 100% of node connections in the UI are type-validated — incompatible connections are visually rejected before creation.
- **SC-004**: Graph execution with 5+ chained nodes completes dependency resolution and begins streaming on the target node within 2 seconds.
- **SC-005**: All 5 existing providers function identically after migration — same models, same streaming behavior, same credential management.
- **SC-006**: System startup with 10+ loaded plugins completes in under 5 seconds.
- **SC-007**: Zero silent fallbacks in production — every error condition produces a user-visible message.
- **SC-008**: A community plugin placed in the designated directory loads on next restart without any configuration.
- **SC-009**: All 15 previously identified code review issues are resolved and verified.
- **SC-010**: Test coverage for plugin loading, type validation, and graph execution meets 80% minimum.

## Assumptions

- The existing architecture document serves as the technical design reference for this feature.
- The 5 existing providers already have working implementations that need to be wrapped in the plugin format, not rewritten from scratch.
- Credentials continue to use the existing secure credential store — no new credential system is needed.
- No existing user data needs to be preserved. The graph format uses the new plugin-based schema (class_type, connections) exclusively — no backward compatibility layer or migration is required.
- Community plugin support in this iteration is limited to directory-based loading — no CLI installer, no marketplace UI.
- The current streaming mechanism will be preserved and integrated into the execution engine.
- Graph execution order follows simple topological sort — no priority-based scheduling or resource-aware execution.
