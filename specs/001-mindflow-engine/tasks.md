# Implementation Tasks: MindFlow Engine

**Branch**: `001-mindflow-engine`
**Generated**: 2025-11-17
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

This document breaks down the MindFlow Engine implementation into concrete, executable tasks organized by user story. Each phase represents an independently testable increment of functionality.

**Test-Driven Development**: Per Constitution Principle IV, TDD is MANDATORY. All implementation tasks follow: Tests Written → Tests Fail → Implementation → Tests Pass.

**Total Tasks**: 127 tasks across 9 phases
**Parallelizable Tasks**: 68 tasks marked with [P]
**Estimated MVP**: Phase 1-4 (Setup + Foundational + US1 + US3) ≈ 45 tasks

## Implementation Strategy

### MVP Scope (Phases 1-4)
Focus on P1 user stories for minimum viable product:
- **User Story 1**: Core graph operations (create, link, recable nodes)
- **User Story 3**: Group organization and project management
- Result: Functional reasoning graph with organization, no AI yet

### Incremental Delivery
- **Phase 5**: Add AI integration (US4) - makes graph "assisted"
- **Phase 6-8**: Enhanced features (comments, context, merge, orchestration)
- **Phase 9**: Polish and cross-cutting concerns

### Parallel Execution
Tasks marked `[P]` can run concurrently (different files, no dependencies). See "Parallel Opportunities" section for examples.

---

## Phase 1: Setup & Project Initialization

**Goal**: Initialize Python project with dependencies, config, and folder structure

**Duration**: ~2 hours

### Tasks

- [ ] T001 Create Python project structure as defined in plan.md (src/, tests/, config/, docs/, workbench/)
- [ ] T002 Create pyproject.toml with dependencies from research.md (anthropic>=0.18.0, openai>=1.12.0, networkx>=3.2, pydantic>=2.6.0, tiktoken>=0.6.0)
- [ ] T003 Create config/config.example.json with LLM provider templates from research.md
- [ ] T004 Create .gitignore for Python (exclude __pycache__, .pytest_cache, workbench/, config/config.json)
- [ ] T005 Create README.md with project overview and setup instructions
- [ ] T006 Initialize pytest configuration in pyproject.toml (testpaths, pytest-cov settings)
- [ ] T007 Create src/mindflow/__init__.py package markers for all modules
- [ ] T008 Install dependencies and verify import of anthropic, openai, networkx, pydantic, tiktoken
- [ ] T009 Create data/graphs/ and data/backups/ directories for graph storage
- [ ] T010 Verify multiplatform path handling with pathlib (test on Windows/Linux if possible)

**Validation**: Run `pytest --collect-only` to verify test discovery works (should find 0 tests initially)

---

## Phase 2: Foundational Layer

**Goal**: Build data models, validation, and core utilities needed by all user stories

**Duration**: ~8 hours

**Dependencies**: Phase 1 complete

### Data Models (Test-First)

- [ ] T011 [P] Write tests for Node model in tests/unit/test_node_model.py (validation, defaults, update_timestamp)
- [ ] T012 [P] Implement Node model in src/mindflow/models/node.py with Pydantic (id, type, author, content, parents, children, groups, meta)
- [ ] T013 [P] Write tests for Group model in tests/unit/test_group_model.py (hierarchy, validation, kind types)
- [ ] T014 [P] Implement Group model in src/mindflow/models/group.py with Pydantic
- [ ] T015 [P] Write tests for Comment model in tests/unit/test_comment_model.py (attachment validation)
- [ ] T016 [P] Implement Comment model in src/mindflow/models/comment.py with Pydantic
- [ ] T017 [P] Write tests for Graph model in tests/unit/test_graph_model.py (nodes dict, groups dict, to_json/from_json)
- [ ] T018 [P] Implement Graph container model in src/mindflow/models/graph.py with metadata and serialization

### Core Utilities (Test-First)

- [ ] T019 [P] Write tests for cycle detection in tests/unit/test_cycles.py (simple cycle, complex cycles, DAG validation)
- [ ] T020 [P] Implement cycle detection utility in src/mindflow/utils/cycles.py using networkx
- [ ] T021 [P] Write tests for token counting in tests/unit/test_tokens.py (OpenAI, Claude approximation)
- [ ] T022 [P] Implement token counter in src/mindflow/utils/tokens.py using tiktoken
- [ ] T023 [P] Write tests for JSON schema validation in tests/unit/test_validation.py
- [ ] T024 [P] Implement validation utilities in src/mindflow/utils/validation.py using Pydantic

### Graph Operation Framework (Test-First)

- [ ] T025 Write tests for GraphOperation base protocol in tests/unit/test_graph_operation.py (execute, undo methods)
- [ ] T026 Implement GraphOperation protocol in src/mindflow/models/operations.py with base classes
- [ ] T027 Write tests for Transaction mechanism in tests/unit/test_transaction.py (rollback, atomic execution)
- [ ] T028 Implement Transaction class in src/mindflow/services/transaction.py with command pattern

**Validation**:
- All model tests pass (`pytest tests/unit/test_*_model.py`)
- All utility tests pass (`pytest tests/unit/test_cycles.py tests/unit/test_tokens.py`)
- 100% coverage on models and utilities

---

## Phase 3: User Story 1 - Create and Navigate Reasoning Graph (P1)

**Goal**: Enable creating nodes, linking them, recabling relationships, and loading/saving graphs

**Independent Test**: Create 5 nodes of different types, link them with parent-child relationships, recable one node, save and reload graph

**Duration**: ~12 hours

**Dependencies**: Phase 2 complete

### Contract Tests (Test-First)

- [ ] T029 [P] [US1] Write contract tests for CREATE_NODE in tests/contract/test_create_node.py (schema validation)
- [ ] T030 [P] [US1] Write contract tests for LINK in tests/contract/test_link.py (schema validation)
- [ ] T031 [P] [US1] Write contract tests for UPDATE_NODE in tests/contract/test_update_node.py
- [ ] T032 [P] [US1] Write contract tests for RECABLE_NODE in tests/contract/test_recable_node.py
- [ ] T033 [P] [US1] Write contract tests for DELETE_NODE in tests/contract/test_delete_node.py

### Graph Engine Core (Test-First)

- [ ] T034 [US1] Write tests for GraphEngine initialization in tests/unit/test_graph_engine.py
- [ ] T035 [US1] Implement GraphEngine class in src/mindflow/services/graph_engine.py with operation executor
- [ ] T036 [US1] Write tests for CREATE_NODE operation in tests/unit/test_create_node_op.py (various node types, parent linking, cycle detection)
- [ ] T037 [US1] Implement CREATE_NODE operation in src/mindflow/services/operations/create_node.py
- [ ] T038 [US1] Write tests for LINK operation in tests/unit/test_link_op.py (cycle detection, bidirectional consistency)
- [ ] T039 [US1] Implement LINK operation in src/mindflow/services/operations/link.py
- [ ] T040 [US1] Write tests for UPDATE_NODE operation in tests/unit/test_update_node_op.py (content update, meta update, timestamp)
- [ ] T041 [US1] Implement UPDATE_NODE operation in src/mindflow/services/operations/update_node.py
- [ ] T042 [US1] Write tests for RECABLE_NODE operation in tests/unit/test_recable_node_op.py (parent replacement, cycle prevention)
- [ ] T043 [US1] Implement RECABLE_NODE operation in src/mindflow/services/operations/recable_node.py
- [ ] T044 [US1] Write tests for DELETE_NODE operation in tests/unit/test_delete_node_op.py (orphan handling, safeguards)
- [ ] T045 [US1] Implement DELETE_NODE operation in src/mindflow/services/operations/delete_node.py

### Graph Persistence (Test-First)

- [ ] T046 [P] [US1] Write tests for graph serialization in tests/unit/test_graph_persistence.py (to_json, from_json, atomic writes)
- [ ] T047 [P] [US1] Implement graph save/load in src/mindflow/services/persistence.py with atomic file writes
- [ ] T048 [P] [US1] Write tests for backup mechanism in tests/unit/test_backup.py
- [ ] T049 [P] [US1] Implement backup creation in src/mindflow/services/persistence.py

### Integration Tests

- [ ] T050 [US1] Write integration test for complete workflow in tests/integration/test_us1_workflow.py (create 5 nodes, link, recable, save, load)
- [ ] T051 [US1] Run integration test and verify all acceptance scenarios pass

**Validation**:
- ✅ Create at least 5 nodes of different types
- ✅ Connect nodes with parent-child relationships
- ✅ Manually recable a node to different parents
- ✅ Save graph to JSON file
- ✅ Reload graph and verify all nodes and relationships intact
- All tests pass, 80%+ coverage

---

## Phase 4: User Story 3 - Organize with Groups and Projects (P1)

**Goal**: Enable hierarchical organization with groups, mark stop nodes, import/export projects

**Independent Test**: Create project with 2 subgroups, assign nodes to groups, mark stop nodes, export project, import into new graph

**Duration**: ~8 hours

**Dependencies**: Phase 3 complete (needs nodes to organize)

### Contract Tests (Test-First)

- [ ] T052 [P] [US3] Write contract tests for CREATE_GROUP in tests/contract/test_create_group.py
- [ ] T053 [P] [US3] Write contract tests for ADD_NODE_TO_GROUP in tests/contract/test_add_node_to_group.py
- [ ] T054 [P] [US3] Write contract tests for REMOVE_NODE_FROM_GROUP in tests/contract/test_remove_node_from_group.py
- [ ] T055 [P] [US3] Write contract tests for MERGE_GROUPS in tests/contract/test_merge_groups.py
- [ ] T056 [P] [US3] Write contract tests for SET_STOP in tests/contract/test_set_stop.py

### Group Operations (Test-First)

- [ ] T057 [US3] Write tests for CREATE_GROUP in tests/unit/test_create_group_op.py (hierarchy, kind validation, cycle prevention)
- [ ] T058 [US3] Implement CREATE_GROUP operation in src/mindflow/services/operations/create_group.py
- [ ] T059 [US3] Write tests for ADD_NODE_TO_GROUP in tests/unit/test_add_node_to_group_op.py
- [ ] T060 [US3] Implement ADD_NODE_TO_GROUP operation in src/mindflow/services/operations/add_node_to_group.py
- [ ] T061 [US3] Write tests for REMOVE_NODE_FROM_GROUP in tests/unit/test_remove_node_from_group_op.py
- [ ] T062 [US3] Implement REMOVE_NODE_FROM_GROUP operation in src/mindflow/services/operations/remove_node_from_group.py
- [ ] T063 [US3] Write tests for MERGE_GROUPS in tests/unit/test_merge_groups_op.py
- [ ] T064 [US3] Implement MERGE_GROUPS operation in src/mindflow/services/operations/merge_groups.py
- [ ] T065 [US3] Write tests for SET_STOP in tests/unit/test_set_stop_op.py (validation, warning for children)
- [ ] T066 [US3] Implement SET_STOP operation in src/mindflow/services/operations/set_stop.py

### Project Import/Export (Test-First)

- [ ] T067 [P] [US3] Write tests for project export in tests/unit/test_project_export.py (stop node identification)
- [ ] T068 [P] [US3] Implement project export in src/mindflow/services/project_manager.py
- [ ] T069 [P] [US3] Write tests for project import in tests/unit/test_project_import.py (UUID regeneration, reference preservation)
- [ ] T070 [P] [US3] Implement project import in src/mindflow/services/project_manager.py with UUID handling

### Integration Tests

- [ ] T071 [US3] Write integration test for US3 workflow in tests/integration/test_us3_workflow.py (project + subgroups + stop nodes + import)
- [ ] T072 [US3] Run integration test and verify all acceptance scenarios pass

**Validation**:
- ✅ Create project group with 2 subgroups
- ✅ Assign nodes to groups
- ✅ Mark nodes with stop=true
- ✅ Export project as subgraph
- ✅ Import project into another graph with stop nodes as entry points
- All tests pass, 80%+ coverage

---

## Phase 5: User Story 4 - AI-Assisted Reasoning with LLM Integration (P1)

**Goal**: Enable LLM provider management, generate responses with graph_actions, execute AI-suggested operations

**Independent Test**: Configure Claude provider, ask question on node, receive text response + graph updates (new hypothesis nodes)

**Duration**: ~14 hours

**Dependencies**: Phase 3 complete (needs graph operations), Phase 4 recommended (for groups)

### Contract Tests (Test-First)

- [ ] T073 [P] [US4] Write contract tests for LLM provider interface in tests/contract/test_llm_provider.py (listProviders, setActiveProvider, generate, getCapabilities)
- [ ] T074 [P] [US4] Write contract tests for generation request/response in tests/contract/test_generation.py (JSON schema validation)

### LLM Provider Framework (Test-First)

- [ ] T075 [US4] Write tests for LLMManager in tests/unit/test_llm_manager.py (provider registration, switching, availability)
- [ ] T076 [US4] Implement LLMManager class in src/mindflow/services/llm_manager.py
- [ ] T077 [US4] Write tests for base LLM provider interface in tests/unit/test_llm_base_provider.py
- [ ] T078 [US4] Implement base provider in src/mindflow/providers/base.py with abstract methods
- [ ] T079 [P] [US4] Write tests for Claude provider in tests/unit/test_claude_provider.py (mock anthropic SDK)
- [ ] T080 [P] [US4] Implement Claude provider in src/mindflow/providers/claude.py using anthropic SDK
- [ ] T081 [P] [US4] Write tests for OpenAI provider in tests/unit/test_openai_provider.py (mock openai SDK)
- [ ] T082 [P] [US4] Implement OpenAI provider in src/mindflow/providers/openai.py using openai SDK
- [ ] T083 [P] [US4] Write tests for local LLM provider in tests/unit/test_local_provider.py (mock HTTP requests)
- [ ] T084 [P] [US4] Implement local provider in src/mindflow/providers/local.py for llama.cpp/Ollama HTTP endpoints

### Graph Actions Execution (Test-First)

- [ ] T085 [US4] Write tests for graph_actions parsing in tests/unit/test_graph_actions_parser.py (JSON validation, operation mapping)
- [ ] T086 [US4] Implement graph actions parser in src/mindflow/services/graph_actions_parser.py
- [ ] T087 [US4] Write tests for graph_actions executor in tests/unit/test_graph_actions_executor.py (batch execution, rollback on error)
- [ ] T088 [US4] Implement graph actions executor in src/mindflow/services/graph_actions_executor.py with transaction support

### Integration Tests

- [ ] T089 [US4] Write integration test with mocked LLM in tests/integration/test_us4_workflow.py (configure provider, generate response, execute actions)
- [ ] T090 [US4] Run integration test and verify all acceptance scenarios pass

**Validation**:
- ✅ List available LLM providers (Claude, OpenAI, local)
- ✅ Set active provider to Claude (or mock)
- ✅ Ask question on existing node
- ✅ Receive text response
- ✅ Receive graph_actions array
- ✅ System automatically executes graph_actions (creates hypothesis nodes)
- All tests pass, 80%+ coverage

---

## Phase 6: User Story 2 - Add Comments and Annotations (P2)

**Goal**: Enable adding comments to nodes/edges, view comments chronologically, AI-generated comments

**Independent Test**: Add 3 comments to different nodes, view them with author attribution

**Duration**: ~4 hours

**Dependencies**: Phase 3 complete (needs nodes to comment on)

### Contract Tests (Test-First)

- [ ] T091 [P] [US2] Write contract tests for ADD_COMMENT in tests/contract/test_add_comment.py

### Comment Operations (Test-First)

- [ ] T092 [US2] Write tests for ADD_COMMENT operation in tests/unit/test_add_comment_op.py (node attachment, edge attachment, author tracking)
- [ ] T093 [US2] Implement ADD_COMMENT operation in src/mindflow/services/operations/add_comment.py
- [ ] T094 [P] [US2] Write tests for comment retrieval in tests/unit/test_get_comments.py (chronological order, filtering by node)
- [ ] T095 [P] [US2] Implement comment retrieval methods in src/mindflow/services/graph_engine.py

### Integration Tests

- [ ] T096 [US2] Write integration test for US2 workflow in tests/integration/test_us2_workflow.py (add 3 comments, view chronologically)
- [ ] T097 [US2] Run integration test and verify all acceptance scenarios pass

**Validation**:
- ✅ Add comment to node with author="human"
- ✅ Add comment to edge
- ✅ Add comment with author="llm" (AI-generated)
- ✅ View all comments for a node in chronological order
- ✅ Comments show timestamp and author attribution
- All tests pass, 80%+ coverage

---

## Phase 7: User Story 5 - Context-Aware AI Responses (P2)

**Goal**: Implement context selection strategies and summarization for optimized LLM calls

**Independent Test**: Select "GraphNeighborhood" strategy, build context from node with 3 parents + 5 children, verify token count within budget

**Duration**: ~10 hours

**Dependencies**: Phase 5 complete (needs LLM integration)

### Contract Tests (Test-First)

- [ ] T098 [P] [US5] Write contract tests for context engine in tests/contract/test_context_engine.py (buildContext, previewContext, countTokens)

### Context Selection Strategies (Test-First)

- [ ] T099 [US5] Write tests for ContextEngine in tests/unit/test_context_engine.py (strategy selection, token budget enforcement)
- [ ] T100 [US5] Implement ContextEngine class in src/mindflow/services/context_engine.py
- [ ] T101 [P] [US5] Write tests for Timeline strategy in tests/unit/test_timeline_strategy.py
- [ ] T102 [P] [US5] Implement Timeline strategy in src/mindflow/services/context/timeline.py
- [ ] T103 [P] [US5] Write tests for GraphNeighborhood strategy in tests/unit/test_graph_neighborhood_strategy.py
- [ ] T104 [P] [US5] Implement GraphNeighborhood strategy in src/mindflow/services/context/graph_neighborhood.py
- [ ] T105 [P] [US5] Write tests for GroupContext strategy in tests/unit/test_group_context_strategy.py
- [ ] T106 [P] [US5] Implement GroupContext strategy in src/mindflow/services/context/group_context.py
- [ ] T107 [P] [US5] Write tests for ManualOverride strategy in tests/unit/test_manual_override_strategy.py
- [ ] T108 [P] [US5] Implement ManualOverride strategy in src/mindflow/services/context/manual_override.py

### Summarization Types (Test-First)

- [ ] T109 [P] [US5] Write tests for HybridSummary in tests/unit/test_hybrid_summary.py (importance + recency + depth prioritization)
- [ ] T110 [P] [US5] Implement HybridSummary in src/mindflow/services/summarization/hybrid_summary.py
- [ ] T111 [P] [US5] Write tests for WeightedSummary in tests/unit/test_weighted_summary.py
- [ ] T112 [P] [US5] Implement WeightedSummary in src/mindflow/services/summarization/weighted_summary.py

### Integration Tests

- [ ] T113 [US5] Write integration test for US5 workflow in tests/integration/test_us5_workflow.py (build context with GraphNeighborhood + HybridSummary)
- [ ] T114 [US5] Run integration test and verify all acceptance scenarios pass

**Validation**:
- ✅ Select "GraphNeighborhood" context strategy
- ✅ Build context from node with 3 parents + 5 children
- ✅ Verify parents, children, and siblings included
- ✅ Token count visible and within max_tokens budget
- ✅ Context text formatted and ready for LLM
- All tests pass, 80%+ coverage

---

## Phase 8: User Story 7 - Merge and Synthesize Nodes (P2)

**Goal**: Enable merging multiple nodes into synthesis node, optionally with AI-generated summary

**Independent Test**: Select 3 hypothesis nodes, merge with AI synthesis, receive summary node linking to sources

**Duration**: ~6 hours

**Dependencies**: Phase 5 complete (for AI synthesis option)

### Contract Tests (Test-First)

- [ ] T115 [P] [US7] Write contract tests for MERGE_NODES in tests/contract/test_merge_nodes.py
- [ ] T116 [P] [US7] Write contract tests for FORK_FROM in tests/contract/test_fork_from.py

### Merge Operations (Test-First)

- [ ] T117 [US7] Write tests for MERGE_NODES operation in tests/unit/test_merge_nodes_op.py (synthesis creation, original preservation, AI synthesis)
- [ ] T118 [US7] Implement MERGE_NODES operation in src/mindflow/services/operations/merge_nodes.py
- [ ] T119 [P] [US7] Write tests for FORK_FROM operation in tests/unit/test_fork_from_op.py
- [ ] T120 [P] [US7] Implement FORK_FROM operation in src/mindflow/services/operations/fork_from.py

### Integration Tests

- [ ] T121 [US7] Write integration test for US7 workflow in tests/integration/test_us7_workflow.py (merge 3 nodes with AI synthesis)
- [ ] T122 [US7] Run integration test and verify all acceptance scenarios pass

**Validation**:
- ✅ Select 3 related nodes
- ✅ Execute MERGE_NODES with objective and use_ai_synthesis=true
- ✅ Receive new summary node
- ✅ Summary node links to all 3 source nodes
- ✅ Original nodes remain in graph
- ✅ AI generates synthesized content
- All tests pass, 80%+ coverage

---

## Phase 9: User Story 6 - Automatic Orchestration (P3)

**Goal**: Enable optional automatic exploration with hypothesis generation, evaluation, and stopping conditions

**Independent Test**: Enable orchestration on group with BreadthFirst mode, generate hypotheses to maxDepth=3, verify stop nodes created

**Duration**: ~12 hours

**Dependencies**: Phase 5 complete (needs LLM), Phase 7 recommended (for context)

### Contract Tests (Test-First)

- [ ] T123 [P] [US6] Write contract tests for orchestrator in tests/contract/test_orchestrator.py (startOrchestration, pauseOrchestration, getStatus)

### Orchestrator Core (Test-First)

- [ ] T124 [US6] Write tests for Orchestrator class in tests/unit/test_orchestrator.py (modes, stopping conditions, state machine)
- [ ] T125 [US6] Implement Orchestrator class in src/mindflow/services/orchestrator.py with state management
- [ ] T126 [P] [US6] Write tests for BreadthFirst mode in tests/unit/test_breadth_first.py
- [ ] T127 [P] [US6] Implement BreadthFirst exploration in src/mindflow/services/orchestration/breadth_first.py
- [ ] T128 [P] [US6] Write tests for DepthFirst mode in tests/unit/test_depth_first.py
- [ ] T129 [P] [US6] Implement DepthFirst exploration in src/mindflow/services/orchestration/depth_first.py
- [ ] T130 [P] [US6] Write tests for stopping conditions in tests/unit/test_stopping_conditions.py (maxDepth, maxNodesPerPass, timeBudget, minConfidence)
- [ ] T131 [P] [US6] Implement stopping condition checks in src/mindflow/services/orchestrator.py

### Integration Tests

- [ ] T132 [US6] Write integration test for US6 workflow in tests/integration/test_us6_workflow.py (enable orchestration, generate hypotheses, verify stop nodes)
- [ ] T133 [US6] Run integration test and verify all acceptance scenarios pass

**Validation**:
- ✅ Orchestration disabled by default
- ✅ User explicitly enables on group
- ✅ BreadthFirst mode generates hypotheses level by level
- ✅ Pauses at maxNodesPerPass for review
- ✅ Creates evaluation nodes with valid/invalid status
- ✅ Stops at maxDepth and marks nodes with stop=true
- All tests pass, 80%+ coverage

---

## Phase 10: Polish & Cross-Cutting Concerns

**Goal**: Logging, configuration management, error handling, documentation

**Duration**: ~6 hours

**Dependencies**: All user story phases complete

### Logging & Observability

- [ ] T134 [P] Write tests for structured logging in tests/unit/test_logging.py (operation logging, privacy-safe content)
- [ ] T135 [P] Implement GraphLogger in src/mindflow/utils/logging.py with JSON structured logs
- [ ] T136 Integrate logging into GraphEngine for all operations

### Configuration Management

- [ ] T137 [P] Write tests for config loading in tests/unit/test_config.py (file loading, env override, validation)
- [ ] T138 [P] Implement ConfigManager in src/mindflow/utils/config.py with Pydantic validation
- [ ] T139 Update LLMManager to use ConfigManager for provider settings

### Error Handling

- [ ] T140 [P] Write tests for custom exceptions in tests/unit/test_exceptions.py (GraphIntegrityError, CircularDependencyError, etc.)
- [ ] T141 [P] Implement exception hierarchy in src/mindflow/exceptions.py with informative messages
- [ ] T142 Review all operations and add proper exception handling with rollback

### Documentation

- [ ] T143 [P] Add docstrings to all public classes and methods (models, services, operations)
- [ ] T144 [P] Create API reference documentation in docs/api.md (generated from docstrings if possible)
- [ ] T145 [P] Create examples/ directory with complete usage examples from quickstart.md
- [ ] T146 Update README.md with quick start, examples, and links to docs

### Performance Optimization

- [ ] T147 [P] Write tests for graph indexing in tests/unit/test_indexing.py (nodes_by_type, nodes_by_group caching)
- [ ] T148 [P] Implement GraphIndexes class in src/mindflow/services/graph_indexes.py with cache invalidation
- [ ] T149 Profile large graph performance (100+ nodes) and optimize bottlenecks

### Multiplatform Verification

- [ ] T150 Run full test suite on Windows and verify all tests pass
- [ ] T151 Run full test suite on Linux and verify all tests pass (if available)
- [ ] T152 Fix any platform-specific path handling issues discovered

**Validation**:
- All tests pass on both Windows and Linux
- Structured logging captures all operations
- Configuration validated and loaded correctly
- Error messages are informative and actionable
- Documentation complete and accurate
- Performance meets targets (<100ms for ops, <2s for context)

---

## Dependency Graph (User Story Completion Order)

### Critical Path (MVP)
```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
Phase 3 (US1: Graph Operations) ← FIRST DELIVERABLE
    ↓
Phase 4 (US3: Groups) ← SECOND DELIVERABLE
    ↓
Phase 5 (US4: AI Integration) ← THIRD DELIVERABLE (AI-assisted graph complete)
```

### Independent Branches (Can parallelize after Phase 2)
```
Phase 6 (US2: Comments) - depends only on Phase 3
Phase 7 (US5: Context) - depends on Phase 5
Phase 8 (US7: Merge) - depends on Phase 5
Phase 9 (US6: Orchestration) - depends on Phase 5, recommended Phase 7
```

### Suggested Implementation Order
1. **Week 1**: Phases 1-3 (Setup, Foundational, US1) → Deliverable: Working graph
2. **Week 2**: Phases 4-5 (US3, US4) → Deliverable: AI-assisted organized graph (MVP COMPLETE)
3. **Week 3**: Phases 6-8 (US2, US5, US7) → Deliverable: Enhanced features
4. **Week 4**: Phases 9-10 (US6, Polish) → Deliverable: Production-ready system

---

## Parallel Execution Opportunities

### Phase 2 (Foundational) - Can run in parallel
- **Track A**: Models (T011-T018) - 4 model files
- **Track B**: Utilities (T019-T024) - 3 utility files
- **Track C**: Operations Framework (T025-T028) - 1 framework file

**Example**: 3 developers can work simultaneously on models, utilities, and operations framework.

### Phase 3 (US1) - Can run in parallel after contracts
- **Track A**: CREATE_NODE + UPDATE_NODE operations (T036-T041)
- **Track B**: LINK + RECABLE_NODE operations (T038-T043)
- **Track C**: DELETE_NODE + Persistence (T044-T049)

### Phase 5 (US4) - Can run in parallel after framework
- **Track A**: Claude provider (T079-T080)
- **Track B**: OpenAI provider (T081-T082)
- **Track C**: Local provider (T083-T084)

### Phase 7 (US5) - Can run in parallel
- **Track A**: Timeline + GraphNeighborhood strategies (T101-T104)
- **Track B**: GroupContext + ManualOverride strategies (T105-T108)
- **Track C**: Summarization types (T109-T112)

### Phase 10 (Polish) - Can run in parallel
- **Track A**: Logging (T134-T136)
- **Track B**: Config (T137-T139)
- **Track C**: Errors (T140-T142)
- **Track D**: Docs (T143-T146)
- **Track E**: Performance (T147-T149)

---

## Task Format Validation

✅ All tasks follow required format: `- [ ] T### [P?] [US#?] Description with file path`
✅ Task IDs sequential (T001-T152)
✅ [P] marker for parallelizable tasks (68 tasks)
✅ [US#] label for user story tasks (phases 3-9)
✅ File paths specified for all implementation tasks
✅ Test-first approach: tests before implementation
✅ Contract tests before implementation for all operations

---

## Summary

- **Total Tasks**: 152
- **Parallelizable**: 68 (45%)
- **Test Tasks**: 76 (50% - TDD enforced)
- **Implementation Tasks**: 76 (50%)

**User Story Distribution**:
- US1 (P1): 23 tasks (Create and Navigate Graph)
- US3 (P1): 21 tasks (Groups and Projects)
- US4 (P1): 18 tasks (AI Integration)
- US2 (P2): 7 tasks (Comments)
- US5 (P2): 17 tasks (Context Strategies)
- US7 (P2): 8 tasks (Merge/Synthesize)
- US6 (P3): 11 tasks (Orchestration)
- Setup: 10 tasks
- Foundational: 18 tasks
- Polish: 19 tasks

**MVP Scope** (Phases 1-5): 90 tasks (~3 weeks for 1 developer, ~1.5 weeks for 2 developers)

**Estimated Total Duration**: 4-6 weeks for complete implementation (1 developer, full-time)

---

**Next Steps**:
1. Start with Phase 1 (Setup)
2. Proceed through phases sequentially
3. Mark tasks complete as you finish them
4. Run tests continuously (TDD)
5. Celebrate at each phase completion! 🎉
