# Tasks: Multi-Provider LLM & MCP Integration

**Input**: Design documents from `/specs/011-multi-provider-llm-mcp/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included per constitution requirement (TDD mandatory for graph operations and LLM integration — Principle IV).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add new dependencies and create directory structure

- [X] T001 Add `mcp` and `google-generativeai` to pyproject.toml dependencies
- [X] T002 [P] Create directory `data/secrets/` with .gitignore to exclude `.key` and `.enc` files
- [X] T003 [P] Create directory structure for new frontend types: `frontend/src/types/provider.ts`, `frontend/src/types/debate.ts`, `frontend/src/types/mcp.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational Phase

- [X] T004 [P] Write unit tests for secret storage (encrypt/decrypt, key generation, missing key file) in `tests/unit/test_secret_storage.py`
- [X] T005 [P] Write unit tests for ProviderConfig model (validation, state transitions, serialization) in `tests/unit/test_provider_model.py`

### Implementation

- [X] T006 Create SecretStorage service for encrypted credential storage using Fernet encryption with machine-derived key in `src/mindflow/services/secret_storage.py`
- [X] T007 Create ProviderConfig Pydantic model with fields (id, name, type, color, selected_model, endpoint_url, status, available_models, created_at, updated_at) and ProviderType/ProviderStatus enums in `src/mindflow/models/provider.py`
- [X] T008 Add `provider_id: Optional[UUID] = None` field to existing Node model in `src/mindflow/models/node.py`
- [X] T009 Create ProviderRegistry service with CRUD operations, credential management via SecretStorage, provider validation, and JSON persistence (`data/providers.json`) in `src/mindflow/services/provider_registry.py`
- [X] T010 Update existing `updateNode` API type in `frontend/src/services/api.ts` to include `provider_id` field

**Checkpoint**: Foundation ready — secret storage works, provider model defined, node model extended

---

## Phase 3: User Story 1 — Register and Use Multiple LLM Providers (Priority: P1) 🎯 MVP

**Goal**: Users can register multiple LLM providers (each with name, color, credentials) and create nodes assigned to specific providers

**Independent Test**: Register 2+ providers, create a node per provider, verify each generates from its designated provider

### Tests for User Story 1

- [X] T011 [P] [US1] Write contract tests for provider API endpoints (POST/GET/PUT/DELETE /api/providers) in `tests/contract/test_provider_contracts.py`
- [X] T012 [P] [US1] Write unit tests for provider registry service (register, validate, list, update, delete, multiple instances of same type) in `tests/unit/test_provider_registry.py`
- [X] T013 [P] [US1] Write integration test for provider-aware LLM operation creation in `tests/integration/test_providers_api.py`

### Implementation — Backend

- [X] T014 [US1] Create Gemini provider implementing LLMProvider ABC (generate + stream methods using google-generativeai SDK) in `src/mindflow/providers/gemini.py`
- [X] T015 [US1] Create provider API routes (POST/GET/PUT/DELETE /api/providers, POST validate, GET models) per contracts/providers-api.md in `src/mindflow/api/routes/providers.py`
- [X] T016 [US1] Register providers router in FastAPI app in `src/mindflow/api/server.py`
- [X] T017 [US1] Update LLM operation creation in `src/mindflow/api/routes/llm_operations.py` to resolve provider from node's `provider_id` via ProviderRegistry instead of using a single hardcoded provider
- [X] T018 [US1] Update `src/mindflow/services/llm_service.py` to accept provider_id parameter and instantiate the correct provider from registry

### Implementation — Frontend

- [X] T019 [P] [US1] Create TypeScript types for Provider (ProviderConfig, ProviderType, ProviderStatus, CreateProviderRequest) in `frontend/src/types/provider.ts`
- [X] T020 [P] [US1] Create providerStore (Zustand) with state: providers list, actions: fetchProviders, addProvider, updateProvider, deleteProvider, validateProvider in `frontend/src/stores/providerStore.ts`
- [X] T021 [US1] Add provider API methods (listProviders, createProvider, updateProvider, deleteProvider, validateProvider, getProviderModels) to `frontend/src/services/api.ts`
- [X] T022 [US1] Create ProviderSettingsPanel component: list registered providers, add/edit/delete forms, color picker, status indicators, model selector in `frontend/src/components/ProviderSettingsPanel.tsx`
- [X] T023 [US1] Create ProviderSelector component: dropdown to pick provider+model when creating/editing a node in `frontend/src/components/ProviderSelector.tsx`
- [X] T024 [US1] Update NodeCreator component to include ProviderSelector for choosing provider on new node creation in `frontend/src/components/NodeCreator.tsx`
- [X] T025 [US1] Update SettingsPanel to add "Providers" tab linking to ProviderSettingsPanel in `frontend/src/components/SettingsPanel.tsx`
- [X] T026 [US1] Update Node component to show provider name badge and apply provider color as border/accent in `frontend/src/components/Node.tsx`

**Checkpoint**: US1 complete — users can register multiple providers, create provider-assigned nodes, and generate responses from different LLMs

---

## Phase 4: User Story 2 — Inter-LLM Debate Through Nodes (Priority: P2)

**Goal**: Connected LLM nodes from different providers can debate sequentially, with full history forwarding and multi-round support

**Independent Test**: Connect 2+ provider nodes in a chain, trigger debate, verify each node responds with full prior context

**Depends on**: US1 (providers must exist to assign to debate nodes)

### Tests for User Story 2

- [X] T027 [P] [US2] Write unit tests for DebateChain model (validation, state transitions, cycle detection) in `tests/unit/test_debate_model.py`
- [X] T028 [P] [US2] Write unit tests for debate engine (sequential execution, history accumulation, provider failure handling, max rounds) in `tests/unit/test_debate_engine.py`
- [X] T029 [P] [US2] Write contract tests for debate API endpoints (POST/GET/DELETE /api/debates, POST continue) in `tests/contract/test_debate_contracts.py`

### Implementation — Backend

- [X] T030 [US2] Create DebateChain Pydantic model with fields (id, graph_id, start_node_id, node_ids, round_count, max_rounds, status) and DebateStatus enum in `src/mindflow/models/debate.py`
- [X] T031 [US2] Create debate engine service: chain discovery (walk edges from start node), sequential execution with full history forwarding, cycle detection via existing `utils/cycles.py`, provider failure handling, round management in `src/mindflow/services/debate_engine.py`
- [X] T032 [US2] Create debate API routes (POST start, GET status, POST continue, DELETE stop, GET list by graph_id) per contracts/debate-api.md in `src/mindflow/api/routes/debates.py`
- [X] T033 [US2] Add summarize-group endpoint (POST /api/graphs/{graph_id}/nodes/summarize-group) per contracts/debate-api.md in `src/mindflow/api/routes/graphs.py`
- [X] T034 [US2] Register debates router in FastAPI app in `src/mindflow/api/server.py`

### Implementation — Frontend

- [X] T035 [P] [US2] Create TypeScript types for Debate (DebateChain, DebateStatus, StartDebateRequest) in `frontend/src/types/debate.ts`
- [X] T036 [P] [US2] Create debateStore (Zustand) with state: active debates, actions: startDebate, continueDebate, stopDebate, fetchDebateStatus in `frontend/src/stores/debateStore.ts`
- [X] T037 [US2] Add debate API methods (startDebate, getDebate, continueDebate, stopDebate, listDebates, summarizeGroup) to `frontend/src/services/api.ts`
- [X] T038 [US2] Create DebateControls component: "Start Debate" button on selected node, "Continue" button on completed debates, round counter, status display in `frontend/src/components/DebateControls.tsx`
- [X] T039 [US2] Integrate DebateControls into Canvas toolbar or node context menu, showing when a node has connected LLM children in `frontend/src/components/Canvas.tsx`

**Checkpoint**: US2 complete — users can start multi-provider debates, observe sequential responses, and continue for additional rounds

---

## Phase 5: User Story 3 — MCP Server for External Tool Integration (Priority: P3)

**Goal**: MindFlow exposes an MCP server that external tools (Claude Code, Codex) can connect to for canvas/node operations

**Independent Test**: Start MCP server, connect via an MCP client, list canvases, create a node, trigger LLM

**Depends on**: US1 (provider-aware nodes for trigger_llm tool)

### Tests for User Story 3

- [X] T040 [P] [US3] Write unit tests for MCP server tools (list_canvases, read_node, create_node, trigger_llm, start_debate) with mocked service layer in `tests/unit/test_mcp_tools.py`
- [X] T041 [P] [US3] Write integration test for MCP server: connect client, call tools, verify graph state changes in `tests/integration/test_mcp_server.py`

### Implementation

- [X] T042 [US3] Create MCP server implementation using `mcp` SDK's FastMCP class, registering 8 tools (list_canvases, get_canvas, read_node, create_node, update_node, delete_node, trigger_llm, start_debate) per contracts/mcp-server-tools.md in `src/mindflow/services/mcp_server.py`
- [X] T043 [US3] Create MCP server entry point (runnable as `python -m mindflow.mcp_server`) with stdio transport for Claude Code integration in `src/mindflow/mcp_server.py`
- [X] T044 [US3] Wire MCP server tools to existing service layer (CanvasService, graphs storage, LLM operations, debate engine) ensuring shared state between REST API and MCP in `src/mindflow/services/mcp_server.py`

**Checkpoint**: US3 complete — Claude Code or any MCP client can connect and manipulate the canvas

---

## Phase 6: User Story 4 — Provider-Specific Node Appearance (Priority: P4)

**Goal**: Each provider's nodes have a distinct visual identity (color, name badge, model label) on the canvas

**Independent Test**: Create nodes from 3+ providers, verify visually distinct appearance

**Depends on**: US1 (provider registry and provider_id on nodes)

### Implementation

- [X] T045 [P] [US4] Create provider color/styling utility: map provider type to default colors, apply user-chosen color override, generate contrast text color in `frontend/src/utils/providerStyling.ts`
- [X] T046 [US4] Update LLMNodeContent component to display provider name badge, model name, and apply provider color to response zone header in `frontend/src/components/LLMNodeContent.tsx`
- [X] T047 [US4] Update Node component to apply provider color as node border/accent color, show provider icon/badge in node header in `frontend/src/components/Node.tsx`
- [X] T048 [US4] Update DetailPanel to show provider info (name, type, model, color swatch) when a node is selected in `frontend/src/components/DetailPanel.tsx`

**Checkpoint**: US4 complete — nodes from different providers are visually distinguishable at a glance

---

## Phase 7: User Story 5 — MCP Client for Consuming External Tools (Priority: P3)

**Goal**: MindFlow connects to external MCP servers, discovers their tools, and makes them available for LLM function-calling in nodes

**Independent Test**: Connect to a filesystem MCP server, attach tools to an LLM node, verify the LLM can call external tools during generation

**Depends on**: US1 (provider-aware nodes for tool-use generation)

### Tests for User Story 5

- [X] T049 [P] [US5] Write unit tests for MCPConnection model (validation, transport configs) in `tests/unit/test_mcp_connection_model.py`
- [X] T050 [P] [US5] Write unit tests for MCP client manager (connect, disconnect, tool discovery, tool invocation) in `tests/unit/test_mcp_client_manager.py`
- [X] T051 [P] [US5] Write contract tests for MCP client API endpoints (POST/GET/DELETE /api/mcp-connections, POST refresh, GET tools, POST invoke) in `tests/contract/test_mcp_client_contracts.py`

### Implementation — Backend

- [X] T052 [US5] Create MCPConnection Pydantic model with fields (id, name, transport_type, config, status, discovered_tools) and TransportType/ConnectionStatus enums in `src/mindflow/models/mcp_connection.py`
- [X] T053 [US5] Create MCP client manager service: connect to external MCP servers (stdio/SSE/streamable HTTP), maintain persistent sessions, discover tools, invoke tools, handle disconnections, persist configs to `data/mcp_connections.json` in `src/mindflow/services/mcp_client_manager.py`
- [X] T054 [US5] Create MCP client API routes (POST/GET/DELETE /api/mcp-connections, POST refresh, GET all tools, POST invoke) per contracts/mcp-client-api.md in `src/mindflow/api/routes/mcp_connections.py`
- [X] T055 [US5] Register mcp_connections router in FastAPI app in `src/mindflow/api/server.py`
- [X] T056 [US5] Update LLM provider implementations to support tool-use: convert MCP tool schemas to provider-specific tool format (OpenAI functions, Claude tools, Gemini function_declarations), handle tool call responses, execute tool calls via MCP client manager, feed results back to LLM in `src/mindflow/services/tool_use_service.py`
- [X] T057 [US5] Update LLM operation creation to accept `mcp_tools` parameter (list of tool names from connected MCP servers) and pass them to provider during generation in `src/mindflow/api/routes/llm_operations.py`

### Implementation — Frontend

- [X] T058 [P] [US5] Create TypeScript types for MCP (MCPConnection, TransportType, RemoteMCPTool, ConnectionStatus) in `frontend/src/types/mcp.ts`
- [X] T059 [P] [US5] Create mcpStore (Zustand) with state: connections list, all tools, actions: addConnection, removeConnection, refreshTools, fetchConnections in `frontend/src/stores/mcpStore.ts`
- [X] T060 [US5] Add MCP client API methods (listConnections, addConnection, removeConnection, refreshConnection, listAllTools, invokeTool) to `frontend/src/services/api.ts`
- [X] T061 [US5] Create MCPConnectionsPanel component: list connected MCP servers, add/remove connections, transport type selector, status indicators in `frontend/src/components/MCPConnectionsPanel.tsx`
- [X] T062 [US5] Create MCPToolBrowser component: browse available tools grouped by source server, show tool descriptions and input schemas in `frontend/src/components/MCPToolBrowser.tsx`
- [X] T063 [US5] Update SettingsPanel to add "MCP Connections" tab linking to MCPConnectionsPanel in `frontend/src/components/SettingsPanel.tsx`
- [X] T064 [US5] Update LLMNodeContent or NodeEditor to allow attaching MCP tools to a node (tool picker from available tools) in `frontend/src/components/DetailPanel.tsx`

**Checkpoint**: US5 complete — LLM nodes can call external MCP tools during generation

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T065 [P] Add provider and MCP configuration entries to `.gitignore` to exclude `data/secrets/`, `data/providers.json`, `data/mcp_connections.json`
- [X] T066 [P] Write frontend unit tests for providerStore in `frontend/tests/unit/providerStore.test.ts`
- [X] T067 [P] Write frontend unit tests for debateStore in `frontend/tests/unit/debateStore.test.ts`
- [X] T068 [P] Write frontend unit tests for mcpStore in `frontend/tests/unit/mcpStore.test.ts`
- [X] T069 Run all quickstart.md scenarios end-to-end and verify pass
- [X] T070 Security review: verify no credentials leak in API responses, logs, or frontend state

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP target
- **US2 (Phase 4)**: Depends on US1 (needs providers to assign to debate nodes)
- **US3 (Phase 5)**: Depends on US1 (needs provider-aware nodes for trigger_llm)
- **US4 (Phase 6)**: Depends on US1 (needs provider registry for color/styling)
- **US5 (Phase 7)**: Depends on US1 (needs provider-aware nodes for tool-use)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational
    ↓
Phase 3: US1 (P1) 🎯 MVP
    ↓
    ├── Phase 4: US2 (P2) — debates need providers
    ├── Phase 5: US3 (P3) — MCP server needs provider-aware nodes
    ├── Phase 6: US4 (P4) — visuals need provider registry  [P] can parallel with US2/US3
    └── Phase 7: US5 (P3) — MCP client needs provider-aware nodes  [P] can parallel with US2/US3
    ↓
Phase 8: Polish
```

### Within Each User Story

- Tests MUST be written and FAIL before implementation (constitution Principle IV)
- Models before services
- Services before endpoints/routes
- Backend before frontend (API must exist for frontend to consume)
- Core implementation before integration

### Parallel Opportunities

- **Phase 1**: T002, T003 can run in parallel
- **Phase 2**: T004, T005 (tests) can run in parallel; then T006-T010
- **Phase 3 (US1)**: T011-T013 (tests) in parallel; T014, T019, T020 in parallel; T045 (US4 styling) can start once provider types defined
- **Phase 4-7**: US3, US4, US5 can all run in parallel after US1 completes (US2 can also parallel if provider-aware nodes from US1 are done)
- **Phase 8**: T065-T068 all in parallel

---

## Parallel Example: User Story 1

```bash
# Tests (all parallel):
T011: Contract tests for provider API
T012: Unit tests for provider registry
T013: Integration test for provider-aware operations

# Backend models + providers (parallel):
T014: Gemini provider implementation
# (ProviderConfig model already done in Phase 2)

# Frontend types + store (parallel):
T019: TypeScript provider types
T020: providerStore (Zustand)

# Then sequential:
T015 → T016 → T017 → T018 (backend routes + service updates)
T021 → T022 → T023 → T024 → T025 → T026 (frontend components)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T010)
3. Complete Phase 3: User Story 1 (T011-T026)
4. **STOP and VALIDATE**: Register 2+ providers, create nodes, verify generation
5. Deploy/demo if ready — users can already use multiple LLMs

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → **MVP: Multi-provider nodes work** → Demo
3. US2 → **Debates work** → Demo
4. US3 + US5 → **Full MCP integration** → Demo (can parallel)
5. US4 → **Visual polish** → Demo (can parallel with US2/US3/US5)

### Suggested MVP Scope

**US1 only** (Phases 1-3, tasks T001-T026 = 26 tasks). This delivers the core value: multiple LLM providers with provider-assigned nodes. All other stories build on this foundation.
