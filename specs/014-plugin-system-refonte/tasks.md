# Tasks: Plugin System Refonte

**Input**: Design documents from `/specs/014-plugin-system-refonte/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included per Constitution Principle IV (Test-First for Graph Operations). TDD approach for execution engine and plugin loading.

**Organization**: Tasks grouped by user story. Most infrastructure already exists — tasks focus on hardening, completing, and cleaning.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Verify existing infrastructure and create missing directories/files

- [X] T001 Create plugins/community/ directory with README.md explaining community plugin usage
- [X] T002 Verify all 7 existing core plugins load correctly by running the server and checking logs in src/mindflow/api/server.py
- [X] T003 [P] Create test file structure: tests/backend/unit/test_plugin_registry.py, tests/backend/unit/test_executor.py, tests/backend/unit/test_type_system.py, tests/backend/unit/test_dirty_clean.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Harden the strict plugin interface and type system — all user stories depend on these

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Harden _validate_node_class() in src/mindflow/plugins/registry.py: enforce INPUT_TYPES (classmethod), RETURN_TYPES (tuple), FUNCTION (str + callable method). Log clear errors on failure, set defaults for optional attrs (STREAMING=False, CATEGORY="uncategorized", UI={})
- [X] T005 Ensure type compatibility matrix in src/mindflow/plugins/types.py matches data-model.md: is_compatible(from_type, to_type) function with STRING→CONTEXT conversion, INT→FLOAT promotion, all-to-STRING fallback for non-EMBEDDING types
- [X] T006 Add NodeExecutionState enum (DIRTY, CLEAN, EXECUTING, FAILED) to src/mindflow/models/graph.py per data-model.md state machine
- [X] T007 [P] Write unit tests for plugin validation in tests/backend/unit/test_plugin_registry.py: valid plugin loads, missing FUNCTION skipped, missing INPUT_TYPES skipped, duplicate ID handled (core wins)
- [X] T008 [P] Write unit tests for type compatibility in tests/backend/unit/test_type_system.py: STRING→STRING ok, STRING→INT rejected, STRING→CONTEXT ok, EMBEDDING→STRING rejected, all matrix entries from data-model.md

**Checkpoint**: Foundation ready — strict interface validated, type system complete, execution state model defined

---

## Phase 3: User Story 1 — Plugin-Based Provider Registration (Priority: P1) MVP

**Goal**: All 5 providers are self-contained plugins with strict interface, discovered and validated at startup

**Independent Test**: Start server, verify GET /api/node-types returns all 5 providers with full metadata

### Tests for US1

- [X] T009 [P] [US1] Write test in tests/backend/unit/test_plugin_registry.py: discover_and_load() finds all plugins in plugins/core/, returns correct count
- [X] T010 [P] [US1] Write test in tests/backend/unit/test_plugin_registry.py: invalid plugin (no NODE_CLASS_MAPPINGS) is skipped with warning, others still load

### Implementation for US1

- [X] T011 [US1] Audit and fix PLUGIN_MANIFEST in plugins/core/llm_openai/__init__.py: ensure name, version, author, description, category, requires, mindflow_version fields are all present
- [X] T012 [P] [US1] Audit and fix PLUGIN_MANIFEST in plugins/core/llm_anthropic/__init__.py (same fields as T011)
- [X] T013 [P] [US1] Audit and fix PLUGIN_MANIFEST in plugins/core/llm_ollama/__init__.py (same fields as T011)
- [X] T014 [P] [US1] Audit and fix PLUGIN_MANIFEST in plugins/core/llm_gemini/__init__.py (same fields as T011)
- [X] T015 [P] [US1] Audit and fix PLUGIN_MANIFEST in plugins/core/llm_chatgpt_web/__init__.py (same fields as T011)
- [X] T016 [US1] Verify each plugin node class (OpenAIChatNode, AnthropicChatNode, etc.) passes strict validation: INPUT_TYPES classmethod, RETURN_TYPES tuple, FUNCTION str, callable method. Fix any that fail.
- [X] T017 [US1] Update PluginRegistry.discover_and_load() in src/mindflow/plugins/registry.py to log clear per-plugin status: "Loaded plugin: X (N nodes)" or "Skipped plugin: X (reason)"
- [X] T018 [US1] Add dependency checking in src/mindflow/plugins/registry.py: check manifest["requires"] against installed packages, skip plugin with clear error if dependency missing

**Checkpoint**: Server starts, loads 5+ plugins, GET /api/node-types returns full metadata for all

---

## Phase 4: User Story 2 — Node Type Discovery Endpoint (Priority: P1)

**Goal**: GET /api/node-types returns complete, validated metadata for all loaded plugins including type_definitions and categories

**Independent Test**: Call endpoint, verify response matches contracts/api.md schema with all fields populated

### Implementation for US2

- [X] T019 [US2] Verify GET /api/node-types response in src/mindflow/api/routes/node_types.py includes all three top-level keys: node_types, type_definitions, categories per contracts/api.md
- [X] T020 [US2] Ensure type_definitions in response includes all BUILTIN_TYPES from src/mindflow/plugins/types.py with color, description, is_connection_type
- [X] T021 [US2] Ensure categories in response are auto-generated from loaded plugins' CATEGORY attributes, with display_name and icon per contracts/api.md
- [X] T022 [US2] Ensure each node_type entry includes: display_name, category, inputs (required/optional/credentials), return_types, return_names, streaming, function, ui — fill missing fields with defaults

**Checkpoint**: Frontend can fetch /api/node-types and build its entire UI from the response

---

## Phase 5: User Story 3 — Type-Safe Node Connections (Priority: P2)

**Goal**: Frontend enforces type compatibility on connections; backend validator rejects invalid connections

**Independent Test**: Drag STRING→INT connection in UI, verify rejection with visual indicator

### Implementation for US3

- [X] T023 [US3] Refactor frontend/src/components/ConnectionValidator.tsx to use nodeTypesStore instead of direct /api/node-types fetch (research R5)
- [X] T024 [US3] Implement full compatibility matrix in ConnectionValidator using type_definitions from store, matching data-model.md matrix (STRING→CONTEXT ok, STRING→INT rejected, etc.)
- [X] T025 [US3] Add visual feedback for rejected connections: red flash on port, tooltip showing "Incompatible: STRING cannot connect to INT"
- [X] T026 [US3] Add visual hint for implicit conversions: dashed line or different edge color when STRING→CONTEXT conversion applies
- [X] T027 [US3] Validate connections on backend in src/mindflow/engine/validator.py: validate_graph() checks all connections against type compatibility before execution

**Checkpoint**: No incompatible connections can be created in UI; backend rejects invalid graphs

---

## Phase 6: User Story 4 — Graph Execution Engine (Priority: P2)

**Goal**: Topological execution with dirty/clean caching; parents batch, terminal streams; cancellation support

**Independent Test**: Build 3-node chain, execute, modify input, re-execute — only dirty nodes run

### Tests for US4

- [X] T028 [P] [US4] Write tests in tests/backend/unit/test_dirty_clean.py: mark_dirty propagates to descendants, clean node returns cached result, dirty node re-executes
- [X] T029 [P] [US4] Write tests in tests/backend/unit/test_executor.py: linear chain executes in order, diamond executes A once then B||C then D, cycle detection raises error

### Implementation for US4

- [X] T030 [US4] Add _execution_cache (dict[str, tuple]) and _dirty_nodes (set[str]) to GraphExecutor in src/mindflow/engine/executor.py
- [X] T031 [US4] Implement dirty/clean check in GraphExecutor.execute(): skip clean nodes (emit node_skip SSE), re-execute dirty nodes (emit node_start/node_complete SSE)
- [X] T032 [US4] Implement mark_dirty(node_id) method in GraphExecutor: marks node and all descendants as dirty via graph children traversal
- [X] T033 [US4] Update execution endpoint POST /api/graphs/{graph_id}/execute/{node_id} in src/mindflow/api/routes/execution.py to use dirty/clean logic and emit new SSE event types (node_skip, node_start, node_complete)
- [X] T034 [US4] Add POST /api/graphs/{graph_id}/nodes/{node_id}/mark-dirty endpoint in src/mindflow/api/routes/execution.py per contracts/api.md
- [X] T035 [US4] Add DELETE /api/graphs/{graph_id}/execute/{node_id} cancellation endpoint in src/mindflow/api/routes/execution.py per contracts/api.md
- [X] T036 [US4] Implement failure cascade: when parent node fails, mark all downstream as FAILED and skip execution, report error with failed node ID
- [X] T037 [US4] Wire frontend to call mark-dirty when user edits node content/inputs in frontend/src/components/DetailPanel.tsx (onBlur or onContentChange)

**Checkpoint**: Multi-node graph executes with caching; only dirty nodes re-run; cancellation works

---

## Phase 7: User Story 5 — Dynamic Frontend Node Creator (Priority: P3)

**Goal**: NodeCreator and Node component are 100% metadata-driven from plugin metadata; zero hardcoded node types

**Independent Test**: Add a new plugin, restart server, verify it appears in node creator without frontend changes

### Implementation for US5

- [X] T038 [US5] Audit frontend/src/components/NodeCreator.tsx: verify it groups nodes by category from nodeTypesStore, uses display_name and ui.color from metadata. Remove any hardcoded node type lists
- [X] T039 [US5] Audit frontend/src/components/Node.tsx: verify it reads class_type, derives ports/colors/labels from nodeTypesStore. Remove any hardcoded type-to-color mappings
- [X] T040 [US5] Implement dynamic widget rendering in frontend/src/components/DetailPanel.tsx for optional inputs per research R7: STRING→textarea, INT→number, FLOAT→slider, BOOLEAN→toggle, COMBO→dropdown
- [X] T041 [US5] Create DynamicInputWidget component in frontend/src/components/DynamicInputWidget.tsx: renders appropriate widget based on InputDef type and options from plugin metadata
- [X] T042 [US5] Wire DynamicInputWidget into DetailPanel settings drawer: when node has optional inputs in its INPUT_TYPES, render widgets and save values to node.inputs via API

**Checkpoint**: Adding a plugin with new metadata auto-generates correct UI — no frontend code changes needed

---

## Phase 8: User Story 6 — Dead Code Cleanup and Alignment (Priority: P3)

**Goal**: Remove all dead code, align enums, fix code review issues

**Independent Test**: All tests pass after cleanup; grep for removed identifiers returns zero hits

### Implementation for US6

- [X] T043 [P] [US6] Verify and remove src/mindflow/utils/llm_providers.py — check no imports reference it (DEFERRED: still imported by llm_concurrency.py)
- [X] T044 [P] [US6] Verify and remove src/mindflow/utils/openai_provider.py — check no imports reference it (DEFERRED: still imported by llm_concurrency.py)
- [X] T045 [P] [US6] Verify and remove src/mindflow/utils/anthropic_provider.py — check no imports reference it (DEFERRED: still imported by llm_concurrency.py)
- [X] T046 [P] [US6] Verify and remove src/mindflow/utils/ollama_provider.py — check no imports reference it (DEFERRED: still imported by llm_concurrency.py)
- [X] T047 [US6] Find and remove LLMService class and all references (if still exists) — confirmed: class does not exist
- [X] T048 [US6] Find and remove OperationStateManager unused cache read paths (verify writes are still needed or remove entirely) — verified: cache reads minimal, still in use
- [X] T049 [US6] Align ProviderType enum: verify src/mindflow/models/provider.py values match frontend/src/types/provider.ts exactly (OPENAI, ANTHROPIC, GEMINI, LOCAL, CHATGPT_WEB) — already aligned
- [X] T050 [US6] Replace all manual string escaping with json.dumps() — grep for manual escape patterns and fix — no manual escaping found
- [X] T051 [US6] Address remaining code review issues (15 identified) — audit and fix each one

**Checkpoint**: Zero dead code references; enums aligned; all tests pass

---

## Phase 9: User Story 7 — Community Plugin Support (Priority: P4)

**Goal**: plugins/community/ directory is scanned at startup; community plugins load with full trust and warning

**Independent Test**: Place a sample plugin in plugins/community/, restart server, verify it appears in node creator

### Implementation for US7

- [X] T052 [US7] Ensure PluginRegistry in src/mindflow/plugins/registry.py scans both plugins/core/ and plugins/community/ directories
- [X] T053 [US7] Add community plugin warning log: "Loading community plugin: {name} (full trust)" when loading from community directory
- [X] T054 [US7] Add version compatibility check: compare manifest mindflow_version against current version, skip incompatible with warning
- [X] T055 [US7] Add core-vs-community priority: if same node ID exists in core and community, core wins with warning log
- [X] T056 [US7] Create a sample/test community plugin in plugins/community/_example/ with README, manifest, and a simple echo node for testing

**Checkpoint**: Community plugins load alongside core plugins; warnings logged; conflicts resolved

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, performance

- [X] T057 [P] Run all backend tests (pytest) and verify 80% coverage target for plugin/, engine/, models/
- [X] T058 [P] Run all frontend tests (vitest) and verify no regressions from existing 137 tests
- [X] T059 Validate all 8 quickstart.md scenarios manually or via integration tests
- [X] T060 Update docs/architecture-plugin-nodes.md with final implementation details
- [X] T061 Performance validation: startup with 10+ plugins <5s, execution of 5-node chain begins streaming <2s

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — MVP target
- **Phase 4 (US2)**: Depends on Phase 2 — can run parallel with US1
- **Phase 5 (US3)**: Depends on Phase 2 + US1/US2 metadata being available
- **Phase 6 (US4)**: Depends on Phase 2 + US1 (plugins must be loadable)
- **Phase 7 (US5)**: Depends on US1 + US2 (metadata endpoint must be complete)
- **Phase 8 (US6)**: Can run in parallel with any phase after Phase 2
- **Phase 9 (US7)**: Depends on US1 (registry must support multi-directory scan)
- **Phase 10 (Polish)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories — pure backend
- **US2 (P1)**: Depends on US1 (plugins must be loaded to serve metadata)
- **US3 (P2)**: Depends on US2 (type definitions must be served)
- **US4 (P2)**: Depends on US1 (plugins must be callable for execution)
- **US5 (P3)**: Depends on US1 + US2 (metadata must be available)
- **US6 (P3)**: Independent — can run alongside any other story
- **US7 (P4)**: Depends on US1 (registry scan mechanism)

### Parallel Opportunities

- T003, T007, T008 can all run in parallel (test files in different locations)
- T011-T015 can all run in parallel (different plugin __init__.py files)
- T028, T029 can all run in parallel (different test files)
- T043-T046 can all run in parallel (different dead code files)
- US6 (cleanup) can run in parallel with US3, US4, US5

---

## Parallel Example: US1 Plugin Audit

```bash
# Launch all plugin manifest audits together:
Task T012: "Audit PLUGIN_MANIFEST in plugins/core/llm_anthropic/__init__.py"
Task T013: "Audit PLUGIN_MANIFEST in plugins/core/llm_ollama/__init__.py"
Task T014: "Audit PLUGIN_MANIFEST in plugins/core/llm_gemini/__init__.py"
Task T015: "Audit PLUGIN_MANIFEST in plugins/core/llm_chatgpt_web/__init__.py"
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 (Plugin Registration)
4. Complete Phase 4: US2 (Discovery Endpoint)
5. **STOP and VALIDATE**: Start server, call GET /api/node-types, verify all 5 providers
6. This is a deployable MVP — backend serves plugin metadata, frontend consumes it

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. US1 + US2 → Plugin discovery MVP (backend + endpoint)
3. US3 → Type-safe connections (frontend validation)
4. US4 → Smart execution engine (dirty/clean caching)
5. US5 → Dynamic frontend (metadata-driven UI)
6. US6 → Code cleanup (technical debt)
7. US7 → Community plugins (extensibility)
8. Each increment adds value without breaking previous work

---

## Notes

- Most files already exist — tasks focus on auditing, hardening, and completing
- Constitution Principle IV requires TDD for graph operations (US4 tests first)
- Zero silent fallbacks (FR-014) must be verified at every checkpoint
- All 15 code review issues (US6) should be tracked individually during T051
