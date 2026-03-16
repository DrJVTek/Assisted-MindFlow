# Implementation Plan: Plugin System Refonte

**Branch**: `014-plugin-system-refonte` | **Date**: 2026-03-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-plugin-system-refonte/spec.md`

## Summary

Complete overhaul of the LLM Provider system to a ComfyUI-inspired plugin architecture. The codebase already has significant foundations (PluginRegistry, BaseNode/LLMNode, GraphExecutor, type system, node-types endpoint, frontend nodeTypesStore). This plan focuses on solidifying the strict interface, adding dirty/clean execution caching, cleaning dead code, and ensuring the entire frontend is dynamically driven from plugin metadata.

## Technical Context

**Language/Version**: Python 3.13+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, Pydantic v2, uvicorn (backend); React 18, React Flow, Zustand, Vite (frontend)
**Storage**: JSON files (graphs in `data/canvases/`, providers in `data/providers.json`, credentials in encrypted storage)
**Testing**: pytest + coverage (backend); Vitest + React Testing Library (frontend)
**Target Platform**: Windows + Linux (multiplatform, NON-NEGOTIABLE per constitution)
**Project Type**: Web application (Python backend + React frontend)
**Performance Goals**: Plugin startup <5s with 10+ plugins; graph execution begins streaming within 2s for 5+ node chains; graph operations <100ms for <200 nodes
**Constraints**: Zero silent fallbacks; no hardcoded node types in frontend; credentials never in graph files
**Scale/Scope**: 5 core plugins (OpenAI, Anthropic, Ollama, Gemini, ChatGPT Web) + community plugin directory; single-user local deployment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Graph Integrity | **PASS** | Cycle detection in executor, atomic graph ops, referential integrity maintained |
| II. LLM Provider Agnostic | **PASS** | Core design — every provider is a plugin, core code is provider-independent |
| III. Explicit Operations, No Magic | **PASS** | No silent fallbacks (FR-014), author tracking on nodes, user-triggered execution |
| IV. Test-First for Graph Operations | **PASS** | 80% coverage target (SC-010), existing test infrastructure, TDD for new execution logic |
| V. Context Transparency | **PASS** | Context reconstruction via connections is explicit and traceable |
| VI. Multiplatform Support | **PASS** | Python + JS are platform-agnostic; path handling via pathlib; tested on Windows |
| VII. No Simulation or Hardcoded Data | **PASS** | Real provider implementations, config-driven, no demo mode |
| Data Persistence | **PASS** | JSON format, schema versioned, human-readable |
| Security & Privacy | **PASS** | Credentials in encrypted storage (FR-015), community plugins full trust with warning |
| Performance Standards | **PASS** | Explicit targets in SC-004, SC-006 |

**Gate Result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/014-plugin-system-refonte/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
# Backend
src/mindflow/
├── plugins/
│   ├── __init__.py          # Exports BaseNode, LLMNode
│   ├── base.py              # Abstract base classes (EXISTING - needs strict interface enforcement)
│   ├── registry.py          # PluginRegistry (EXISTING - needs dirty/clean state, validation hardening)
│   ├── types.py             # Type system (EXISTING - needs compatibility matrix)
│   └── composite.py         # Composite node support
├── engine/
│   ├── executor.py          # GraphExecutor (EXISTING - needs dirty/clean caching)
│   ├── orchestrator.py      # Orchestrator (EXISTING - needs alignment with executor)
│   └── validator.py         # Graph validator (EXISTING - needs type validation)
├── providers/
│   ├── base.py              # LLMProvider interface (EXISTING)
│   ├── openai.py            # (EXISTING)
│   ├── anthropic.py         # (EXISTING)
│   ├── ollama.py            # (EXISTING)
│   ├── gemini.py            # (EXISTING)
│   └── openai_chatgpt.py    # (EXISTING)
├── models/
│   ├── graph.py             # Graph/Node models (EXISTING - needs execution_state field)
│   ├── node.py              # (EXISTING)
│   └── provider.py          # ProviderType enum (EXISTING - needs alignment)
├── services/
│   ├── provider_registry.py # Provider instance management (EXISTING)
│   ├── graph_service.py     # (EXISTING)
│   └── secret_storage.py    # Encrypted credentials (EXISTING)
├── api/
│   ├── server.py            # FastAPI app (EXISTING - plugin loading at startup)
│   └── routes/
│       ├── node_types.py    # GET /api/node-types (EXISTING)
│       ├── execution.py     # Graph execution endpoints (EXISTING - needs dirty/clean)
│       └── providers.py     # Provider CRUD (EXISTING)
└── utils/
    ├── llm_providers.py     # (DEAD CODE - remove)
    ├── openai_provider.py   # (DEAD CODE - remove)
    ├── anthropic_provider.py # (DEAD CODE - remove)
    └── ollama_provider.py   # (DEAD CODE - remove)

# Plugins
plugins/
├── core/
│   ├── llm_openai/          # (EXISTING)
│   ├── llm_anthropic/       # (EXISTING)
│   ├── llm_ollama/          # (EXISTING)
│   ├── llm_gemini/          # (EXISTING)
│   ├── llm_chatgpt_web/     # (EXISTING)
│   ├── llm_chat/            # (EXISTING - generic chat node)
│   └── text_input/          # (EXISTING)
└── community/               # (CREATE - empty, with README)

# Frontend
frontend/src/
├── stores/
│   ├── nodeTypesStore.ts    # (EXISTING - central store for plugin metadata)
│   └── canvasStore.ts       # (EXISTING)
├── components/
│   ├── Node.tsx             # (EXISTING - already reads from nodeTypesStore)
│   ├── NodeCreator.tsx      # (EXISTING - already groups by category)
│   ├── Canvas.tsx           # (EXISTING)
│   ├── ConnectionValidator.tsx # (EXISTING - needs to use store instead of direct fetch)
│   └── DetailPanel.tsx      # (EXISTING - needs dynamic widget rendering for optional inputs)
├── types/
│   ├── plugin.ts            # (EXISTING - NodeTypeDefinition, TypeDefinition)
│   └── graph.ts             # (EXISTING - includes class_type, connections)
├── hooks/
│   └── useNodeTypes.ts      # (EXISTING)
└── services/
    └── api.ts               # (EXISTING)

# Tests
tests/
├── backend/
│   ├── unit/
│   │   ├── test_orchestrator.py  # (EXISTING - 12 tests)
│   │   ├── test_plugin_registry.py # (CREATE)
│   │   ├── test_executor.py      # (CREATE)
│   │   ├── test_type_system.py   # (CREATE)
│   │   └── test_dirty_clean.py   # (CREATE)
│   └── integration/
│       └── test_graph_execution.py # (CREATE)
└── frontend/
    └── tests/                     # (EXISTING - 137 tests passing)
```

**Structure Decision**: Web application with existing backend/frontend separation. Most files already exist — this feature is primarily about hardening, completing, and cleaning up the existing architecture rather than building from scratch.

## Complexity Tracking

No constitution violations requiring justification. The plugin architecture is the simplest viable approach for provider extensibility, directly aligned with Constitution Principle II (LLM Provider Agnostic).
