# Implementation Plan: Multi-Provider LLM & MCP Integration

**Branch**: `011-multi-provider-llm-mcp` | **Date**: 2026-03-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/011-multi-provider-llm-mcp/spec.md`

## Summary

Extend the existing MindFlow LLM node system with a **provider registry** that allows multiple LLM providers (OpenAI, Claude, Gemini, Ollama, ChatGPT Web) to coexist, each with user-defined name and color. Nodes are assigned to providers, enabling **inter-LLM debates** through connected node chains. MindFlow also becomes a full **MCP participant** — exposing its canvas as an MCP server (external tools connect in) and acting as an MCP client (consuming tools from external MCP servers for LLM function-calling).

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.9 (frontend)
**Primary Dependencies**:
- Backend: FastAPI 0.108, Pydantic 2.6, anthropic, openai, httpx, cryptography
- Frontend: React 19, React Flow 11, Zustand 5, Axios, Tailwind CSS 3.4
- New: `mcp` (Python MCP SDK for server+client), `google-generativeai` (Gemini provider)
**Storage**: SQLite (operations), JSON files (canvases, provider configs), in-memory (graphs)
**Testing**: pytest + pytest-asyncio (backend), vitest (frontend)
**Target Platform**: Windows + Linux (multiplatform, NON-NEGOTIABLE per constitution)
**Project Type**: Web application (FastAPI backend + React frontend)
**Performance Goals**: Graph operations < 100ms, UI updates < 1s, debate round < 60s (per constitution + spec)
**Constraints**: Single-user local app, no multi-tenancy, offline-capable for local providers
**Scale/Scope**: Up to 5+ concurrent providers, graphs with 200+ nodes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Graph Integrity | PASS | Provider assignment is a new field on existing nodes. Debate chains use existing edges. No structural graph changes. |
| II. LLM Provider Agnostic | PASS | Core design — provider registry with unified interface. Existing `LLMProvider` ABC in `providers/base.py` already enforces this. |
| III. Explicit Operations, No Magic | PASS | Debates are user-triggered (not automatic). Each node records its provider (author traceability). MCP operations are explicit tool calls. |
| IV. Test-First for Graph Operations | PASS | Plan includes TDD for provider registry, debate engine, and MCP tools. |
| V. Context Transparency | PASS | Full debate history visible on canvas. Provider name/model shown on each node. MCP tool calls logged. |
| VI. Multiplatform Support | PASS | Python + React stack. No platform-specific code needed. MCP SDK is cross-platform. |
| VII. No Simulation or Hardcoded Data | PASS | Real provider implementations, no mocks in production. Encrypted key storage with `cryptography` library. |
| Data Persistence | PASS | Provider configs persisted as encrypted JSON. MCP connection configs as JSON. |
| Security & Privacy | PASS | API keys encrypted at rest (machine-derived key). Warning when sending to cloud providers (existing behavior). |
| Performance Standards | PASS | Provider registry operations are in-memory lookups. Debate is async sequential. No performance regression expected. |

**No violations. Gate passed.**

## Project Structure

### Documentation (this feature)

```text
specs/011-multi-provider-llm-mcp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── providers-api.md
│   ├── debate-api.md
│   ├── mcp-server-tools.md
│   └── mcp-client-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Backend (Python)
src/mindflow/
├── api/
│   ├── routes/
│   │   ├── providers.py          # NEW: Provider registry CRUD endpoints
│   │   ├── debates.py            # NEW: Debate chain management endpoints
│   │   ├── mcp_connections.py    # NEW: MCP client connection management
│   │   ├── graphs.py             # MODIFIED: Node provider assignment
│   │   └── llm_operations.py     # MODIFIED: Provider-aware operation creation
│   └── server.py                 # MODIFIED: Register new routers
├── models/
│   ├── provider.py               # NEW: LLMProviderConfig model
│   ├── debate.py                 # NEW: DebateChain model
│   ├── mcp_connection.py         # NEW: MCPConnection model
│   └── node.py                   # MODIFIED: Add provider_id field
├── services/
│   ├── provider_registry.py      # NEW: Provider lifecycle management
│   ├── debate_engine.py          # NEW: Debate orchestration
│   ├── mcp_server.py             # NEW: MCP server implementation
│   ├── mcp_client_manager.py     # NEW: MCP client connection manager
│   ├── secret_storage.py         # NEW: Encrypted credential storage
│   └── llm_service.py            # MODIFIED: Route to provider from registry
├── providers/
│   ├── base.py                   # EXISTING: LLMProvider ABC (unchanged)
│   ├── anthropic.py              # EXISTING (minor updates)
│   ├── openai.py                 # EXISTING (minor updates)
│   ├── ollama.py                 # EXISTING (minor updates)
│   ├── openai_chatgpt.py         # EXISTING (minor updates)
│   └── gemini.py                 # NEW: Google Gemini provider
└── utils/
    └── cycles.py                 # EXISTING: Cycle detection (reuse for debates)

# Frontend (TypeScript/React)
frontend/src/
├── components/
│   ├── ProviderSettingsPanel.tsx  # NEW: Provider registry UI
│   ├── ProviderSelector.tsx      # NEW: Provider picker for node creation
│   ├── DebateControls.tsx        # NEW: Debate trigger/continue UI
│   ├── MCPConnectionsPanel.tsx   # NEW: MCP client connections UI
│   ├── MCPToolBrowser.tsx        # NEW: Browse available MCP tools
│   ├── Node.tsx                  # MODIFIED: Provider color/badge
│   ├── LLMNodeContent.tsx        # MODIFIED: Provider info display
│   ├── NodeCreator.tsx           # MODIFIED: Provider selection
│   └── SettingsPanel.tsx         # MODIFIED: Add provider/MCP tabs
├── stores/
│   ├── providerStore.ts          # NEW: Provider registry state
│   ├── debateStore.ts            # NEW: Debate chain state
│   └── mcpStore.ts               # NEW: MCP connections state
├── services/
│   └── api.ts                    # MODIFIED: Add provider/debate/MCP endpoints
└── types/
    ├── provider.ts               # NEW: Provider types
    ├── debate.ts                 # NEW: Debate types
    └── mcp.ts                    # NEW: MCP connection types

# Tests
frontend/tests/
├── unit/
│   ├── providerStore.test.ts     # NEW
│   ├── debateStore.test.ts       # NEW
│   └── mcpStore.test.ts          # NEW
└── features/
    └── debate/
        └── useDebateChain.test.ts # NEW

tests/                             # Backend tests
├── unit/
│   ├── test_provider_registry.py  # NEW
│   ├── test_debate_engine.py      # NEW
│   ├── test_secret_storage.py     # NEW
│   └── test_mcp_tools.py          # NEW
├── integration/
│   ├── test_providers_api.py      # NEW
│   ├── test_debate_api.py         # NEW
│   └── test_mcp_server.py         # NEW
└── contract/
    └── test_provider_contracts.py  # NEW
```

**Structure Decision**: Web application pattern (existing). New files follow the established directory conventions. Backend models in `src/mindflow/models/`, services in `src/mindflow/services/`, routes in `src/mindflow/api/routes/`. Frontend components in `frontend/src/components/`, stores in `frontend/src/stores/`.

## Complexity Tracking

No constitution violations to justify.
