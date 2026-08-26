# Foundation Cleanup Plan — Branch `015-foundation-cleanup`

> **STATUS: CLEANUP COMPLETE** — every phase below shipped on branch `015` (PR #1).
> This document is kept as the historical working plan: §2 "Current architecture" and
> §4 "Confirmed technical debt" describe the **pre-cleanup** state that motivated the work
> (e.g. the old flat `services/mcp_server.py` layout). For the CURRENT layout and conventions,
> read [`../CONVENTIONS.md`](../CONVENTIONS.md); for remaining work, [`../ROADMAP.md`](../ROADMAP.md).
> Status legend: ✅ done & solid · 🟡 embryonic / partial · ❌ missing · 🧹 cleanup target

## 1. What MindFlow is (the vision, in one paragraph)

A node/box canvas that replaces linear LLM chat. Each **box** holds a question/response;
boxes are **linked** into a **DAG** (a node can have multiple parents → two branches can be
**merged** into a new combined question). The **graph is the memory**: context is rebuilt from
a node's ancestors at execution time, not from any LLM's accumulated history. On top of this:
multi-model **debate/validation**, node **plugins** (ComfyUI-style), **groups as reusable
functions**, and a **bidirectional MCP** layer (MindFlow consumes MCP tools *and* exposes whole
graphs as callable MCP tools). Providers are centralized — API **and** web sessions (ChatGPT,
Claude, Codex) — partly to leverage flat-rate web subscriptions over metered API. Open source,
so **no secrets in the repo**. UX target: as clean and powerful as UE5 Blueprints / ComfyUI.

## 2. Current architecture (verified)

### Backend — `src/mindflow/` (already layered)
- `api/server.py` — FastAPI app, 13 routers, plugin discovery on startup.
- `api/routes/` — graphs, nodes, execution, node_types, providers, plugins, composites,
  subgraphs, canvases, viewport, auth, debates, mcp_connections, import_conversations.
- `engine/` — `orchestrator.py` (real execution path), `executor.py` (`GraphExecutor`), `validator.py`.
- `plugins/` — `registry.py` (ComfyUI-style loader), `base.py`, `types.py`, `composite.py`.
- `providers/` — openai, anthropic, ollama, gemini, openai_chatgpt + `base.py`.
- `services/` — 14 mixed services (mcp client/server, oauth, chatgpt_client, debate_engine,
  graph_service, provider_registry, secret/token/version storage, conversation_import, …).
- `models/` — node, graph, group, comment, canvas, conversation, debate, provider, mcp_connection, …

### Frontend — `frontend/src/` (ReactFlow 11 + Zustand 5 + Vite 7)
- `App.tsx` → renders only `<Canvas/>`; **`Canvas.tsx` is a god-component** holding every interaction.
- `components/` — ~40 files, **flat dump** (Canvas, Node, DetailPanel, all panels, selectors…).
- `features/canvas/` — a **half-built** feature-based structure (hooks/services/utils) coexisting
  with the flat `components/` → two paradigms at once.
- `stores/` — 8 flat Zustand stores. `types/`, `hooks/`, `services/api.ts`, `constants/`.
- Links are **derived from each node's `connections` dict**, not a persisted edges array.

## 3. Vision ↔ reality

| Capability | State | Evidence |
|---|---|---|
| Boxes + branches (DAG) | ✅ | `models/node.py` `connections`, topo-sort over multi-parents |
| Merge multiple parents into one | ✅ engine / 🟡 UX | `orchestrator._resolve_inputs`; merge = wire each parent to a **distinct named port** (no first-class "merge" gesture) |
| Graph = memory (context rebuilt) | ✅ | `orchestrator.py` reconstructs per execution; no LLM history |
| `{{variables}}` substitution | ✅ | `orchestrator._substitute_template_vars` |
| Partial execution (run one node) | ✅ | `executor.topological_sort(target)` = ancestor sub-tree |
| NO-FALLBACK discipline | ✅ + tested | silent fallbacks removed; `tests/backend/unit/test_provider_no_fallback.py` |
| Node plugins (ComfyUI-style) | ✅ | `PluginRegistry`, `plugins/core` + `community`, `.zip` upload |
| Multi-model debate/validation | 🟡 | `services/debate_engine.py`, `debateStore`, `DebateControls` |
| Groups = reusable functions | 🟡 | `models/group.py`, `plugins/composite.py`, `subgraphs` route |
| MCP client **+** server | 🟡 + 🧹 dup | `mcp_client_manager`; `mcp_server.py` (root) **and** `services/mcp_server.py` |
| Provider hub (API + web) | ✅ API / 🟡 web | `providers/*` + `services/chatgpt_client.py` |
| Import ChatGPT projects | 🟡 | `services/conversation_import.py`, `ImportConversationDialog` |
| Clean secrets (open source) | ✅ | Fernet in `data/secrets/` (git-ignored); thorough `.gitignore` |
| Clean & modular UI | ❌ 🧹 | flat `components/` vs half-built `features/`; `Canvas.tsx` god-component |
| Image / schema nodes | ❌ | none yet (trivial as a plugin once arch is clean) |

## 4. Confirmed technical debt (the real "bazar")

### Backend
- 🧹 **Duplicated execution engine.** `routes/execution.py` runs via `Orchestrator`. The
  `Orchestrator` builds a `GraphExecutor` but uses it **only** for `topological_sort`.
  `GraphExecutor.execute` / `stream_execute` + the **dirty/clean cache** are not on the prod path;
  the executor is recreated per request, so the cache never persists. `ExecuteRequest.force_rerun`
  is unused. *(Note: dirty/clean is still covered by `test_dirty_clean.py` / `test_graph_executor.py`.)*
- 🧹 **Layering violation.** `engine/orchestrator.py` does `from mindflow.api.routes.providers import _get_registry`
  → the engine imports the API layer. It already receives a `provider_resolver`; route everything through it.
- 🧹 **`services/` god-folder** + duplicates (`mcp_server.py` root vs `services/mcp_server.py`);
  two different "registry" concepts (`services/provider_registry` vs `plugins/registry`).
- 🧹 Deprecated `@app.on_event("startup")` → FastAPI `lifespan`; centralize singleton wiring.
- 🧹 Three overlapping test trees (`tests/unit`, `tests/integration`, `tests/backend/*`) with
  duplicate migration tests.

### Frontend
- 🧹 **Two organizational paradigms** (`components/` flat vs `features/`). Pick **feature-based**.
- 🧹 **`Canvas.tsx` god-component** — decompose.
- 🧹 Flat `stores/` — colocate per feature; keep `components/ui/` as the design system.

## 5. Target module layout

### Backend (keep layers, tidy `services/`)
```
src/mindflow/
  api/        # routers only (HTTP), no business logic
  engine/     # orchestrator + pure topo util; NO import from api (DI for providers)
  plugins/    # node-type registry & base
  providers/  # LLM providers (api + web)
  services/
    mcp/      # client manager + server (single, dedup)
    auth/     # oauth, token storage
    storage/  # secret / version / graph persistence
    llm_web/  # chatgpt_client & web-session drivers
    graph/    # graph_service, migration, import
  models/     # pydantic models
  composition.py  # single wiring/composition root
```

### Frontend (feature-based)
```
frontend/src/
  features/
    canvas/      # Canvas decomposed: host, viewport, interactions
    nodes/       # Node, ports, node-type rendering
    execution/   # run/stream, executionStore
    providers/   # provider selectors + settings
    plugins/     # plugin manager
    mcp/         # connections + tool browser
    debate/      # debate controls + store
    settings/    # settings panel
    logging/     # log panel + store
    import/      # ChatGPT import
  components/ui/  # design system (Button, Dialog, Input, Card)
  lib/           # api client, shared utils
```

## 6. Phased roadmap (backend first — chosen)

- [x] **Phase 0 — Baseline recorded.** `venv` repaired (`pip install -e ".[dev]"`); suite =
      **594 passed / 17 failed / 17 errors / 3 xfailed**. All 34 reds are **pre-existing** stale
      tests / env mismatch, none in the engine:
  - `test_token_storage` (14): `TokenStorage(session_path=...)` arg removed.
  - `test_auth_endpoints` (6) + `test_oauth_service`: patch `auth.get_oauth_service` / `AUTH_ENDPOINT` (gone).
  - `test_openai_chatgpt_provider` (6): assert an old fallback that NO-FALLBACK removed (code is right).
  - `test_node_model` (2) + `test_provider_contracts` (1): expect validations / `502` the code relaxed (now `400`).
  - Gemini (`test_provider_isolation`, `..._no_fallback::Gemini`, `test_provider_registry`): `from google import genai` ↔ installed `google-generativeai` SDK mismatch (dependency decision needed).
  → **all repaired** (4 stale-test clusters + 2 decisions: Node validation relaxation kept,
    Gemini dep → `google-genai`). Suite now **654 passed / 0 failed / 0 errors**.
- [ ] **Phase 1 — Engine coherence.**
  - [x] **Invert engine→api dependency** — provider resolution fully injected via new
        `Orchestrator(provider_type_resolver=…)`; engine no longer imports `mindflow.api`.
        Suite unchanged (594/34) = no regression.
  - [ ] One execution implementation — decision pending: **kill** the dead dirty/clean cache
        (simplest) vs **properly wire** it as real incremental recompute (a vision feature).
- [ ] **Phase 2 — Backend tidy.** Sub-package `services/`, dedup MCP server, `on_event`→`lifespan`,
      single composition root, consolidate test trees.
- [ ] **Phase 3 — Frontend modularization.** Feature-based migration; decompose `Canvas.tsx`.
- [~] **Phase 4 — UI polish** (started). Done: dark theme unified (default + nodes driven by
      tokens), bezier edges tinted by source port type. Next: node refinement, **Thread mode** (the
      simple ChatGPT-like view), branding (logos). Both light + dark themes verified coherent.
- [ ] **Phase 5 — Unblock the vision.** Real incremental recompute; first-class "merge" gesture;
      image/schema nodes; finalized debate node; groups-as-functions exposed over MCP.
- [ ] **Phase 6 — Docs & guardrails.** Architecture docs; layering lint (forbid `engine → api`).

**Rules:** every phase ends on a green test suite; atomic commits; nothing broken between commits;
no silent fallbacks introduced; no secrets committed.
