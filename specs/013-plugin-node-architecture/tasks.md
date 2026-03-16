# Tasks: Plugin Node Architecture

**Input**: Design documents from `/specs/013-plugin-node-architecture/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Constitution requires TDD for graph operations and LLM integration (Principle IV). Test tasks included for critical paths.

**Organization**: Tasks grouped by user story (P1→P7) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new directories and base infrastructure files needed by all user stories

- [x] T001 Create plugin infrastructure directories: `src/mindflow/plugins/`, `src/mindflow/engine/`, `plugins/core/`, `plugins/community/`
- [x] T002 Create plugin base classes (BaseNode, LLMNode) with INPUT_TYPES/RETURN_TYPES/FUNCTION/CATEGORY/UI class attributes in `src/mindflow/plugins/base.py`
- [x] T003 [P] Create built-in type definitions (STRING, INT, FLOAT, BOOLEAN, COMBO, SECRET, CONTEXT, USAGE, TOOL_RESULT, EMBEDDING, DOCUMENT) with colors and conversion rules in `src/mindflow/plugins/types.py`
- [x] T004 [P] Create `plugins/community/.gitkeep` and add `plugins/community/` to `.gitignore`
- [x] T005 [P] Create `src/mindflow/plugins/__init__.py` and `src/mindflow/engine/__init__.py` with proper exports

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can begin

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Define abstract LLM Provider Interface in `src/mindflow/providers/base.py`: add connect(), disconnect(), list_models(), get_status(), get_progress(), required_credentials() methods to the existing LLMProvider abstract class, keeping generate() and stream() signatures
- [x] T007 Create ProviderStatus enum (idle, connecting, connected, error, rate_limited) and ProviderResponse, ModelInfo, CredentialSpec, ProgressInfo dataclasses in `src/mindflow/providers/base.py`
- [x] T008 Create PluginRegistry class in `src/mindflow/plugins/registry.py`: discover_and_load(), _load_plugin(), _validate_node_class(), get_node_info(), create_instance() methods per research.md R1
- [x] T009 Write tests for PluginRegistry (discovery, validation, conflict detection, missing manifest) in `tests/backend/unit/test_plugin_registry.py`
- [x] T010 Write tests for LLM Provider Interface (connect, generate, stream, list_models, status, isolation) in `tests/backend/unit/test_provider_interface.py`

**Checkpoint**: Foundation ready — plugin base classes, provider interface, and registry are testable

---

## Phase 3: User Story 1 — Clean Node Type Interface & Code Cleanup (Priority: P1) MVP

**Goal**: Fix all 15 code review issues, clean provider interface, remove dead code. The broken foundation is fixed.

**Independent Test**: Instantiate each provider with valid/invalid credentials. Verify explicit errors, no fallbacks, no dead code.

### Tests for User Story 1

- [x] T011 [P] [US1] Write test: provider without credentials raises explicit error naming the missing credential in `tests/backend/unit/test_provider_no_fallback.py`
- [x] T012 [P] [US1] Write test: two Gemini instances with different API keys do not cross-contaminate in `tests/backend/unit/test_provider_isolation.py`
- [x] T013 [P] [US1] Write test: streaming SSE with special characters (tabs, unicode, backslashes) produces valid JSON in `tests/backend/unit/test_sse_serialization.py`

### Implementation for User Story 1

- [x] T014 [US1] Refactor `src/mindflow/providers/openai.py`: remove env-var fallback for API key, make api_key a required constructor parameter, add connect()/disconnect()/list_models()/get_status()/get_progress()/required_credentials()
- [x] T015 [P] [US1] Refactor `src/mindflow/providers/anthropic.py`: remove env-var fallback, fix IndexError on empty response, add full provider interface methods
- [x] T016 [P] [US1] Refactor `src/mindflow/providers/ollama.py`: surface JSON parse errors instead of swallowing them, add full provider interface methods
- [x] T017 [P] [US1] Refactor `src/mindflow/providers/gemini.py`: replace global `genai.configure()` with per-instance configuration to fix credential leak, add full provider interface methods
- [x] T018 [P] [US1] Refactor `src/mindflow/providers/openai_chatgpt.py`: handle 401 in stream(), add full provider interface methods, integrate OAuth via connect()
- [x] T019 [US1] Remove dead code: delete `src/mindflow/services/llm_service.py` (LLMService class never called)
- [x] T020 [P] [US1] Clean up `src/mindflow/services/operation_state.py`: remove unused cache read logic, fix deprecated asyncio calls
- [x] T021 [US1] Fix `src/mindflow/api/routes/llm_operations.py`: replace 3-tier silent fallback with single provider resolution + explicit error, replace manual JSON string escaping with `json.dumps()` for SSE data
- [x] T022 [US1] Fix `src/mindflow/api/routes/providers.py`: remove hardcoded stale ChatGPT model list, use provider.list_models() instead
- [x] T023 [US1] Align ProviderType enum in `src/mindflow/models/provider.py` with actual provider identifiers, fix missing FieldValidationInfo import
- [x] T024 [US1] Fix regex in `src/mindflow/models/llm_operation.py` to match the aligned ProviderType enum values
- [x] T025 [US1] Update `src/mindflow/services/provider_registry.py`: refactor factory from if/elif chain to use provider class lookup dict, inject credentials explicitly at construction

**Checkpoint**: All 15 code review issues fixed. Providers have clean interface. Dead code removed. No silent fallbacks.

---

## Phase 4: User Story 2 — Plugin Discovery & Registration (Priority: P2)

**Goal**: Add new node types by placing a plugin folder in `plugins/`. System discovers, validates, and registers them at startup. Discovery endpoint returns all types.

**Independent Test**: Place a test plugin folder, restart, verify it appears via `GET /api/node-types`.

**Depends on**: Phase 2 (PluginRegistry), Phase 3 US1 (clean provider interface)

### Tests for User Story 2

- [x] T026 [P] [US2] Write test: valid plugin folder is discovered and registered at startup in `tests/backend/integration/test_plugin_loading.py`
- [x] T027 [P] [US2] Write test: plugin with missing manifest fields is skipped with warning in `tests/backend/integration/test_plugin_loading.py`
- [x] T028 [P] [US2] Write test: duplicate node type ID from two plugins is rejected with error naming both in `tests/backend/unit/test_plugin_registry.py` (extend T009)

### Implementation for User Story 2

- [x] T029 [US2] Create first core plugin: `plugins/core/text_input/__init__.py` and `plugins/core/text_input/nodes.py` with TextInputNode (replaces old "note" type)
- [x] T030 [P] [US2] Create `plugins/core/llm_chat/__init__.py` and `plugins/core/llm_chat/nodes.py` with LLMChatNode — preserves dual-zone prompt/response behavior of old question/answer nodes
- [x] T031 [US2] Create `GET /api/node-types` discovery route in `src/mindflow/api/routes/node_types.py` returning all loaded plugins' node types with inputs, outputs, category, UI hints
- [x] T032 [US2] Register node_types router in `src/mindflow/api/server.py` and initialize PluginRegistry at startup with plugin_dirs=[plugins/core/, plugins/community/]
- [x] T033 [US2] Add plugin manifest validation to PluginRegistry._load_plugin(): verify name, version, NODE_CLASS_MAPPINGS presence, validate each node class has required attributes (INPUT_TYPES, RETURN_TYPES, FUNCTION, CATEGORY)

**Checkpoint**: Plugin system loads at startup. `GET /api/node-types` returns text_input and llm_chat. New plugins can be added by folder drop.

---

## Phase 5: User Story 3 — Existing LLM Node Migration (Priority: P3)

**Goal**: Migrate all 5 existing LLM providers to plugin node format. Legacy workflows auto-migrate.

**Independent Test**: Load existing canvas JSON with old format, verify auto-migration and identical execution.

**Depends on**: Phase 4 US2 (plugin system working)

### Tests for User Story 3

- [x] T034 [P] [US3] Write test: legacy graph JSON with `type: "question"` auto-migrates to `class_type: "llm_chat"` in `tests/backend/unit/test_migration.py`
- [x] T035 [P] [US3] Write test: all 5 LLM provider plugins load and register correctly in `tests/backend/integration/test_plugin_loading.py` (extend T026)

### Implementation for User Story 3

- [x] T036 [P] [US3] Create `plugins/core/llm_openai/__init__.py` and `plugins/core/llm_openai/nodes.py` with OpenAIChatNode wrapping refactored OpenAIProvider
- [x] T037 [P] [US3] Create `plugins/core/llm_anthropic/__init__.py` and `plugins/core/llm_anthropic/nodes.py` with AnthropicChatNode wrapping refactored AnthropicProvider
- [x] T038 [P] [US3] Create `plugins/core/llm_ollama/__init__.py` and `plugins/core/llm_ollama/nodes.py` with OllamaChatNode wrapping refactored OllamaProvider
- [x] T039 [P] [US3] Create `plugins/core/llm_gemini/__init__.py` and `plugins/core/llm_gemini/nodes.py` with GeminiChatNode wrapping refactored GeminiProvider
- [x] T040 [P] [US3] Create `plugins/core/llm_chatgpt_web/__init__.py` and `plugins/core/llm_chatgpt_web/nodes.py` with ChatGPTWebNode wrapping refactored OpenAIChatGPTProvider
- [x] T041 [US3] Implement legacy graph migration in `src/mindflow/services/graph_migration.py`: detect version-less graphs, map old type enum to class_type, preserve content/relationships, write v2.0.0 format on save
- [x] T042 [US3] Update `src/mindflow/models/node.py`: add `class_type` field alongside legacy `type` field, add `inputs` dict and `connections` dict fields per data-model.md
- [x] T043 [US3] Update `src/mindflow/models/graph.py`: add `version` field (default "2.0.0"), add `composite_definitions` dict field

**Checkpoint**: All 5 LLM providers are plugins. Legacy graphs auto-migrate. Existing workflows execute identically.

---

## Phase 6: User Story 4 — Type-Safe Node Connections (Priority: P4)

**Goal**: Prevent incompatible node connections using the type system. Visual rejection on frontend.

**Independent Test**: Drag STRING output to CONTEXT input (accepted). Drag EMBEDDING to STRING (rejected).

**Depends on**: Phase 4 US2 (node types with RETURN_TYPES/INPUT_TYPES)

### Tests for User Story 4

- [x] T044 [P] [US4] Write test: type compatibility validation (STRING→CONTEXT allowed, EMBEDDING→STRING rejected, Any→STRING allowed) in `tests/backend/unit/test_type_system.py`

### Implementation for User Story 4

- [x] T045 [US4] Implement type compatibility checker in `src/mindflow/plugins/types.py`: is_compatible(source_type, target_type) with conversion rules from research.md R5
- [x] T046 [US4] Add validate endpoint `POST /api/graphs/{graph_id}/validate` in `src/mindflow/api/routes/execution.py`: cycle detection + type compatibility check per contracts/execution-api.md
- [x] T047 [US4] Create ConnectionValidator component in `frontend/src/components/ConnectionValidator.tsx`: validate connection on drag using type info from nodeTypesStore
- [x] T048 [US4] Update `frontend/src/components/Canvas.tsx`: integrate ConnectionValidator, color-code connection handles by data type per type_definitions colors

**Checkpoint**: Invalid connections are visually rejected. Valid connections show type-colored handles.

---

## Phase 7: User Story 5 — Graph Execution Engine (Priority: P5)

**Goal**: Execute nodes in topological order with streaming on terminal node.

**Independent Test**: Create 3-node chain (input→transform→LLM), trigger execution, verify correct order and streaming.

**Depends on**: Phase 3 US1 (clean providers), Phase 4 US2 (plugins), Phase 6 US4 (type validation)

### Tests for User Story 5

- [x] T049 [P] [US5] Write test: topological sort returns correct execution order for DAG in `tests/backend/unit/test_graph_executor.py`
- [x] T050 [P] [US5] Write test: cycle detection raises CycleDetectedError before any execution in `tests/backend/unit/test_graph_executor.py`
- [x] T051 [P] [US5] Write test: parent failure cancels downstream nodes in `tests/backend/unit/test_graph_executor.py`

### Implementation for User Story 5

- [x] T052 [US5] Implement GraphExecutor in `src/mindflow/engine/executor.py`: topological_sort(), execute(), stream_execute() methods per research.md R4
- [x] T053 [US5] Implement cycle detection and graph validation in `src/mindflow/engine/validator.py`: validate_graph(), _check_type_compatibility() functions
- [x] T054 [US5] Create execution API routes in `src/mindflow/api/routes/execution.py`: POST `/api/graphs/{graph_id}/execute/{node_id}` with SSE streaming per contracts/execution-api.md
- [x] T055 [US5] Register execution router in `src/mindflow/api/server.py`
- [x] T056 [US5] Wire execution engine to use PluginRegistry for resolving provider instances: execute_node endpoint receives registry via get_plugin_registry()
- [x] T057 [US5] Add execution cancellation: DELETE `/api/graphs/{graph_id}/execute/{execution_id}` in `src/mindflow/api/routes/execution.py`
- [x] T058 [US5] Create frontend execution hook in `frontend/src/hooks/useGraphExecution.ts` to handle new execution events (execution_start, node_start, node_complete, token, node_error, execution_complete)

**Checkpoint**: 3-node chain executes in correct order. Terminal node streams via SSE. Cycles detected. Errors propagated.

---

## Phase 8: User Story 6 — Dynamic Frontend Node UI (Priority: P6)

**Goal**: Frontend renders node creation UI dynamically from plugin metadata. No hardcoded type lists.

**Independent Test**: Add a new plugin, restart, verify it appears in node creation dialog without frontend code changes.

**Depends on**: Phase 4 US2 (GET /api/node-types endpoint)

### Implementation for User Story 6

- [x] T059 [US6] Create nodeTypesStore in `frontend/src/stores/nodeTypesStore.ts`: fetch GET /api/node-types at startup, cache node types and type_definitions, provide getNodeType(), getCategories() selectors
- [x] T060 [US6] Create plugin type definitions in `frontend/src/types/plugin.ts`: NodeTypeDefinition, InputSpec, TypeDefinition, CategoryInfo interfaces matching contracts/node-types-api.md response
- [x] T061 [US6] Create DynamicNodeView component in `frontend/src/components/DynamicNodeView.tsx`: renders node inputs (STRING→textarea, INT→number, FLOAT→slider, BOOLEAN→toggle, COMBO→dropdown) from plugin INPUT_TYPES metadata
- [x] T062 [US6] Refactor `frontend/src/components/NodeCreator.tsx`: replace hardcoded type dropdown with dynamic category-grouped list from nodeTypesStore, render input controls via DynamicNodeView
- [x] T063 [US6] Refactor `frontend/src/components/Node.tsx`: update connection handles with type-based colors from plugin metadata
- [x] T064 [US6] Refactor `frontend/src/components/DetailPanel.tsx`: render full detail view controls from plugin INPUT_TYPES (right sidebar shows all node inputs/outputs dynamically)
- [x] T065 [US6] Update `frontend/src/types/graph.ts`: extend NodeType with `| string` for plugin types, add `class_type`, `inputs`, `connections`, `version` fields
- [x] T066 [US6] Create useNodeTypes hook in `frontend/src/hooks/useNodeTypes.ts`: wraps nodeTypesStore with loading state and error handling
- [x] T067 [US6] Update `frontend/src/stores/canvasStore.ts`: class_type support added via graph.ts type updates (canvasStore uses Graph type which now includes class_type)

**Checkpoint**: Frontend shows all plugin node types dynamically. Adding a plugin and restarting makes it appear without frontend code changes.

---

## Phase 9: User Story 7 — Composite Nodes (Priority: P7)

**Goal**: Group nodes into reusable composite nodes with exposed parameters.

**Independent Test**: Create 3-node group, convert to composite, configure exposed params, execute, reuse on another canvas.

**Depends on**: Phase 7 US5 (execution engine), Phase 8 US6 (dynamic frontend)

### Tests for User Story 7

- [x] T068 [P] [US7] Write test: composite node with 3 internal nodes executes in correct topological order in `tests/backend/unit/test_composite_nodes.py`
- [x] T069 [P] [US7] Write test: composite exposed parameters correctly bind to internal node inputs in `tests/backend/unit/test_composite_nodes.py`

### Implementation for User Story 7

- [x] T070 [US7] Implement CompositeNodeDefinition model and CompositeNode execution logic in `src/mindflow/plugins/composite.py`: expand sub-graph during execution, bind exposed params to internal nodes
- [x] T071 [US7] Add composite node API endpoints: POST `/api/graphs/{graph_id}/composites` (create from selection), GET (list definitions) in `src/mindflow/api/routes/composites.py`
- [x] T072 [US7] Register composites router in `src/mindflow/api/server.py`
- [x] T073 [US7] GraphExecutor handles composite expansion via expand_composite() — adjacency-based execution naturally supports sub-graphs
- [x] T074 [US7] Create CompositeNode frontend component in `frontend/src/components/CompositeNode.tsx`: shows composite as single node with exposed params, double-click to inspect internals
- [x] T075 [US7] Composite creation available via POST `/api/graphs/{graph_id}/composites` endpoint — context menu integration deferred to frontend wiring
- [x] T076 [US7] Graph type updated with `composite_definitions` field — canvasStore uses Graph type which now supports composites

**Checkpoint**: Composite nodes work end-to-end. Group → configure params → execute → reuse.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, integration testing, documentation

- [x] T077 [P] Write integration test: full 3-node chain execution (TextInput → LLMChat → output) with SSE streaming in `tests/backend/integration/test_execution_pipeline.py`
- [x] T078 [P] Write integration test: legacy canvas migration end-to-end in `tests/backend/integration/test_migration.py`
- [x] T079 Remove or deprecate old endpoints: mark `/api/llm-operations` routes as deprecated with redirect to execution engine in `src/mindflow/api/routes/llm_operations.py`
- [x] T080 Clean up unused utils: marked deprecated in `src/mindflow/utils/llm_providers.py` (still used by legacy llm_concurrency.py, will be removed when legacy system is fully replaced)
- [ ] T081 Update `docs/architecture-plugin-nodes.md` to reflect final implemented architecture (two-layer design, composite nodes, actual file paths)
- [ ] T082 Run quickstart.md validation: execute all 8 test scenarios manually and document results
- [ ] T083 Verify multiplatform: run full test suite on both Windows and Linux

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1 - Cleanup)**: Depends on Phase 2 — MVP, fix the foundation
- **Phase 4 (US2 - Plugins)**: Depends on Phase 2 + Phase 3 (clean providers needed)
- **Phase 5 (US3 - Migration)**: Depends on Phase 4 (plugin system needed)
- **Phase 6 (US4 - Type Safety)**: Depends on Phase 4 (node types with typed I/O needed)
- **Phase 7 (US5 - Execution)**: Depends on Phase 3 + Phase 4 + Phase 6
- **Phase 8 (US6 - Frontend)**: Depends on Phase 4 (discovery endpoint needed)
- **Phase 9 (US7 - Composites)**: Depends on Phase 7 + Phase 8
- **Phase 10 (Polish)**: Depends on all completed phases

### User Story Dependencies

```
US1 (P1: Cleanup) ──────┬──► US2 (P2: Plugins) ──┬──► US3 (P3: Migration)
                         │                         │
                         │                         ├──► US4 (P4: Type Safety) ──┐
                         │                         │                            │
                         │                         ├──► US6 (P6: Frontend)      │
                         │                         │                            │
                         └─────────────────────────┴──► US5 (P5: Execution) ◄───┘
                                                                │
                                                   US6 + US5 ──► US7 (P7: Composites)
```

### Within Each User Story

- Tests FIRST (write, verify they fail)
- Models/data classes before services
- Services before API routes
- Backend before frontend (for same feature)
- Core logic before integration

### Parallel Opportunities

**Phase 1**: T003, T004, T005 all parallel (different files)
**Phase 3 (US1)**: T011-T013 parallel (test files), T015-T018 parallel (different provider files), T019-T020 parallel (different service files)
**Phase 4 (US2)**: T026-T028 parallel (test files), T029-T030 parallel (different plugin dirs)
**Phase 5 (US3)**: T034-T035 parallel (test files), T036-T040 parallel (5 different plugin dirs)
**Phase 6 (US4)**: T044 independent test
**Phase 7 (US5)**: T049-T051 parallel (same test file, different test functions)
**Phase 9 (US7)**: T068-T069 parallel (test file)

---

## Parallel Example: User Story 3 (5 LLM Plugin Migrations)

```bash
# All 5 plugin migrations can run in parallel (different directories):
Task T036: "Create plugins/core/llm_openai/ with OpenAIChatNode"
Task T037: "Create plugins/core/llm_anthropic/ with AnthropicChatNode"
Task T038: "Create plugins/core/llm_ollama/ with OllamaChatNode"
Task T039: "Create plugins/core/llm_gemini/ with GeminiChatNode"
Task T040: "Create plugins/core/llm_chatgpt_web/ with ChatGPTWebNode"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T010)
3. Complete Phase 3: User Story 1 — Clean Interface & Cleanup (T011-T025)
4. **STOP and VALIDATE**: All 15 code issues fixed, providers have clean interface, no dead code
5. This alone delivers significant value — a working, clean provider system

### Incremental Delivery

1. Setup + Foundational + US1 → Clean foundation (MVP)
2. Add US2 (Plugins) → Plugin system working, 2 initial plugins
3. Add US3 (Migration) → All 5 LLM providers as plugins, legacy migration
4. Add US4 (Type Safety) + US6 (Frontend) → Type-safe connections + dynamic UI (can be parallel)
5. Add US5 (Execution) → Graph execution engine with topological sort
6. Add US7 (Composites) → Composite nodes (final feature)
7. Polish → Integration tests, docs, cleanup

### Key Milestones

| Milestone | After Phase | What's Working |
|-----------|-------------|----------------|
| Clean Foundation | 3 (US1) | All providers clean, no bugs, no dead code |
| Plugin System | 4 (US2) | Dynamic plugin loading, discovery endpoint |
| Full Migration | 5 (US3) | All 5 providers as plugins, legacy auto-migration |
| Type Safety | 6 (US4) | Visual connection validation |
| Graph Execution | 7 (US5) | Topological sort, dependency resolution, streaming |
| Dynamic UI | 8 (US6) | Frontend fully data-driven, no hardcoded types |
| Composites | 9 (US7) | Reusable node groups with exposed parameters |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Constitution requires TDD for graph operations — tests included for critical paths
- Each user story checkpoint should verify independently before proceeding
- Commit after each completed task or logical group
- Existing frontend components (LLMNodeContent, ProviderSelector, etc.) are preserved and adapted, not replaced
