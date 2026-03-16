# Implementation Plan: Plugin Node Architecture

**Branch**: `013-plugin-node-architecture` | **Date**: 2026-03-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/013-plugin-node-architecture/spec.md`

## Summary

Complete redesign of the node type system and LLM provider layer, replacing hardcoded enums and if/elif chains with a dynamic plugin architecture inspired by ComfyUI. Two-layer design: (1) an independent LLM Provider Interface (driver layer) for connection, auth, generate, stream, list_models, status/progress; (2) a plugin-based Node Type system where each node type is a self-describing class with INPUT_TYPES, RETURN_TYPES, UI hints, and dual-view support. Includes graph execution engine with topological sort, type-safe connections, composite nodes, and a fully data-driven frontend.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, Pydantic v2, uvicorn, React 18, React Flow, Zustand, Vitest
**Storage**: JSON files (canvases, graphs, providers), SQLite (operations.db local), encrypted file storage (secrets)
**Testing**: pytest (backend), Vitest + jsdom (frontend)
**Target Platform**: Windows + Linux (multiplatform requirement from constitution)
**Project Type**: Web application (Python backend + React frontend)
**Performance Goals**: Graph operations <100ms for <200 nodes, UI updates <1s, discovery endpoint <1s, context building <2s (from constitution)
**Constraints**: No env-var fallbacks, no silent errors, no hardcoded values, no simulation code (from constitution + CLAUDE.md)
**Scale/Scope**: Single-user local app, ~5-50 nodes per canvas typical, 5 LLM providers to migrate, ~30 source files affected

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Graph Integrity | PASS | Topological sort ensures DAG validity. Cycle detection before execution (FR-012). Atomic graph operations preserved. Composite nodes maintain referential integrity as sub-graphs. |
| II. LLM Provider Agnostic | PASS | Core architectural goal. Two-layer design: provider interface is fully abstract. Node plugins consume providers anonymously. New providers added as plugins without code changes. |
| III. Explicit Operations, No Magic | PASS | Zero fallback principle (FR-003, FR-016). All operations explicit. No env-var magic. Clear errors. Author tracking preserved (human/llm/tool). |
| IV. Test-First for Graph Operations | PASS | TDD required. All 15 code review issues get test coverage. Provider interface needs integration tests with mocked providers. Execution engine needs edge case tests. |
| V. Context Transparency | PASS | Context flows through typed connections (CONTEXT type). Users see what inputs feed into each node. Token counts can be exposed via USAGE type. |
| VI. Multiplatform Support | PASS | Python + React = platform-agnostic. Plugin loading uses `pathlib` (cross-platform paths). No platform-specific code needed. |
| VII. No Simulation or Hardcoded Data | PASS | Entire feature removes hardcoded enums and if/elif chains. Plugin system is real, not stubbed. All config via files/manifests. |
| Data Persistence | PASS | Graph JSON format versioned (v2.0.0 with `class_type`). Backward compatibility via auto-migration of legacy `type` enum. Human-readable JSON preserved. |
| Security & Privacy | PASS | Credentials never in graph JSON. Injected at provider construction via encrypted storage. Per-provider isolation (FR-023). |

**Gate result: ALL PASS** — no violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/013-plugin-node-architecture/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── node-types-api.md
│   ├── provider-interface.md
│   └── execution-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Backend (Python)
src/mindflow/
├── plugins/                         # NEW: Plugin infrastructure
│   ├── __init__.py
│   ├── base.py                      # BaseNode, LLMNode base classes
│   ├── types.py                     # Built-in data types (STRING, CONTEXT, USAGE, etc.)
│   ├── registry.py                  # PluginRegistry: discover, load, validate
│   └── composite.py                 # CompositeNode support
├── providers/                       # REFACTORED: LLM Provider Interface (driver layer)
│   ├── __init__.py
│   ├── base.py                      # Abstract LLMProvider with full interface
│   ├── openai.py                    # OpenAIProvider (cleaned up)
│   ├── anthropic.py                 # AnthropicProvider (cleaned up)
│   ├── ollama.py                    # OllamaProvider (cleaned up)
│   ├── gemini.py                    # GeminiProvider (cleaned up)
│   └── openai_chatgpt.py            # OpenAIChatGPTProvider (cleaned up)
├── engine/                          # NEW: Graph execution engine
│   ├── __init__.py
│   ├── executor.py                  # GraphExecutor with topological sort
│   └── validator.py                 # Cycle detection, type validation
├── models/                          # UPDATED: Data models
│   ├── node.py                      # Node with class_type replacing type enum
│   ├── graph.py                     # Graph v2.0.0 format
│   ├── llm_operation.py             # Cleaned up
│   ├── provider.py                  # Cleaned up
│   └── ...                          # Other models unchanged
├── services/                        # CLEANED UP: Remove dead code
│   ├── provider_registry.py         # Refactored to use LLM Provider Interface
│   ├── canvas_service.py            # Migration logic for legacy graphs
│   ├── operation_state.py           # Cleaned up (remove dead cache)
│   └── ...                          # Other services
├── api/
│   ├── routes/
│   │   ├── node_types.py            # NEW: GET /api/node-types (discovery)
│   │   ├── execution.py             # NEW: Graph execution endpoints
│   │   ├── llm_operations.py        # REFACTORED: Use provider interface
│   │   ├── providers.py             # REFACTORED: Use provider interface
│   │   └── ...
│   └── server.py                    # Register new routes
└── utils/                           # Cleanup dead utils

plugins/                             # NEW: Plugin directories (at repo root)
├── core/                            # Built-in plugins
│   ├── llm_openai/
│   │   ├── __init__.py              # PLUGIN_MANIFEST + NODE_CLASS_MAPPINGS
│   │   └── nodes.py                 # OpenAIChatNode
│   ├── llm_anthropic/
│   │   ├── __init__.py
│   │   └── nodes.py
│   ├── llm_ollama/
│   │   ├── __init__.py
│   │   └── nodes.py
│   ├── llm_gemini/
│   │   ├── __init__.py
│   │   └── nodes.py
│   ├── llm_chatgpt_web/
│   │   ├── __init__.py
│   │   └── nodes.py
│   ├── text_input/
│   │   ├── __init__.py
│   │   └── nodes.py                 # TextInputNode (replaces old "note" type)
│   └── llm_chat/
│       ├── __init__.py
│       └── nodes.py                 # LLMChatNode (replaces old "question/answer" dual-zone)
└── community/                       # User-installed plugins (empty, gitignored)

# Frontend (TypeScript/React)
frontend/src/
├── components/
│   ├── Node.tsx                     # REFACTORED: Dynamic rendering from plugin metadata
│   ├── NodeCreator.tsx              # REFACTORED: Data-driven from GET /api/node-types
│   ├── Canvas.tsx                   # UPDATED: Type-safe connections
│   ├── LLMNodeContent.tsx           # PRESERVED as plugin view component
│   ├── DetailPanel.tsx              # REFACTORED: Dynamic detail view from plugin metadata
│   ├── DynamicNodeView.tsx          # NEW: Renders node compact/detail views from plugin UI spec
│   ├── ConnectionValidator.tsx      # NEW: Type-safe connection validation
│   └── CompositeNode.tsx            # NEW: Composite node UI
├── stores/
│   ├── canvasStore.ts               # UPDATED: Support class_type
│   ├── llmOperationsStore.ts        # Minor cleanup
│   ├── providerStore.ts             # UPDATED: Aligned with provider interface
│   ├── nodeTypesStore.ts            # NEW: Fetches/caches GET /api/node-types
│   └── ...
├── types/
│   ├── graph.ts                     # UPDATED: class_type replaces NodeType enum
│   ├── plugin.ts                    # NEW: Plugin metadata types
│   └── ...
└── hooks/
    ├── useNodeTypes.ts              # NEW: Hook for node type discovery
    └── ...

# Tests
tests/
├── backend/
│   ├── unit/
│   │   ├── test_plugin_registry.py
│   │   ├── test_provider_interface.py
│   │   ├── test_graph_executor.py
│   │   ├── test_type_system.py
│   │   └── test_composite_nodes.py
│   └── integration/
│       ├── test_plugin_loading.py
│       ├── test_execution_pipeline.py
│       └── test_migration.py
frontend/tests/
├── unit/
│   ├── NodeTypesStore.test.ts
│   ├── DynamicNodeView.test.ts
│   └── ConnectionValidator.test.ts
└── integration/
    └── PluginNodeFlow.test.ts
```

**Structure Decision**: Web application pattern (backend + frontend). New code goes into `src/mindflow/plugins/`, `src/mindflow/engine/`, and `plugins/` at repo root. Existing code in `src/mindflow/providers/` is refactored in-place. Frontend adds new stores and components alongside existing ones.

## Complexity Tracking

> No constitution violations detected — this section is intentionally empty.
