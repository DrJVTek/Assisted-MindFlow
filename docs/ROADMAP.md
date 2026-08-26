# MindFlow — Roadmap & Remaining Work

> Master checklist across cleanup, UI, and vision. Backend cleanup detail lives in
> [`architecture/foundation-cleanup-plan.md`](architecture/foundation-cleanup-plan.md).
> **New here? Read [`CONVENTIONS.md`](CONVENTIONS.md) first.** Executable, self-contained task cards
> for the well-scoped items live in [`tasks/`](tasks/README.md) — each has exact paths, steps,
> acceptance criteria, and verify commands.
> Effort: ⚡ quick · ◐ medium · ⛰ large.  ·  Last updated: 2026-06-20 · Branch: `015-foundation-cleanup`

## ✅ Shipped this session (branch 015)
- `a93400c` — engine decoupled from API (provider resolution injected; `engine/` no longer imports `mindflow.api`).
- `456653a` + `c93327b` — **test suite repaired: 594/34-red → 654 passed / 0 failed / 0 errors.**
- `4a160c0` — UI unified on **dark** theme (default + nodes driven by design tokens; light mode also repaired).
- `67d6323` — **bezier edges tinted by source port type** (ComfyUI-style links).
- `1bde808` / `e9da75f` — architecture plan + status in `docs/`.

---

## 🛠️ Backend — finish the foundation cleanup
- [x] **Phase 1b — single execution engine.** Decided: **killed** the dead dirty/clean cache; `GraphExecutor` is a pure topology utility. Real incremental recompute moved to Vision below. — ◐
- [x] **Tidy `services/`** — reorganized into `mcp/`, `auth/`, `storage/`, `graph/`, `llm_web/` sub-packages. — ◐
- [x] **Dedup `mcp_server.py`** — root `mindflow/mcp_server.py` is the documented CLI entry point; the implementation lives in `services/mcp/server.py`. — ⚡
- [x] `@app.on_event("startup")` → FastAPI **`lifespan`** + a single composition root. — ⚡
- [x] **Consolidate the 3 test trees** → `tests/{unit,integration,contract}`; `tests/backend/` removed. — ◐
- [x] `install.bat`/`install.sh` install `.[dev]`. — ⚡
- [x] Replace deprecated `FieldValidationInfo` import (`models/provider.py`). — ⚡
- [x] **Guardrail:** AST layering test forbidding `engine → api` (`tests/unit/test_engine_layering.py`). — ⚡
- [ ] **Decide `services/mcp/tool_use_service.py`** — dead code since the legacy `llm_operations` route was removed; either wire MCP tool-use into graph execution (fits the MCP vision) or delete it. — ⚡

## 🎨 UI — the active track (dark / ComfyUI finish)
- [x] **Node refinement** — tokenized shadows/radius, typography hierarchy, hover/selected states. — ⚡
- [ ] **Thread mode** — the simple "ChatGPT-like" stacked view; one graph, two views (Thread ⟷ Canvas). The core of the *simple + powerful* vision. — ⛰
- [x] **Frontend modularization (folder migration)** — components live under `features/*/components/`. — ◐
- [ ] **Decompose `Canvas.tsx` internals** (still ~1400 lines; design-sensitive, do deliberately). ReactFlow warning #002 persists in dev StrictMode only (memoization is in place; harmless). — ◐
- [x] **Branding** — favicon + MindFlow top bar; assets in `frontend/public/` (`logo-full.png` is shipped but not yet referenced — use or drop it). — ⚡
- [x] **Theme** — persisted (localStorage) + first-run follows the OS. NOTE: this supersedes the earlier hard-`dark` default — flip `defaultPreferences.theme` back if dark-always is preferred. — ⚡
- [x] **Custom `endpoint_url` for OpenAI providers** — 'Custom base URL (advanced)' field in the provider UI (OpenAI-compatible proxies). — ⚡

## 🚀 Vision — beyond cleanup (larger)
- [ ] **MCP in/out** — finish bidirectional MCP: consume MCP servers **and** expose graphs/groups **as** callable MCP tools. — ⛰
- [ ] **Groups as reusable functions** — input variables + outputs, callable from another canvas (currently embryonic: `models/group.py`, `plugins/composite.py`, `subgraphs` route). — ⛰
- [ ] **Debate node finalized** — multi-model debate/validation/consensus (embryonic: `debate_engine`, `debateStore`, `DebateControls`). — ◐
- [ ] **Web / proxy providers** — Gemini Web (native, like ChatGPT Web = path A) and/or OpenAI-compatible proxy support (path B), ideally **providers as plugins** (today only node-types are pluggable; providers are core). — ⛰
- [ ] **First-class "merge two branches" gesture** — the engine supports multi-parent merge via named ports; the UX doesn't surface it as a one-click action. — ◐
- [ ] **Image / schema generating nodes** (new plugin node types). — ◐
- [ ] **Deep ChatGPT import** — pull projects / memory, work them as a tree (embryonic: `conversation_import`). — ⛰

---

## ⏳ Open decisions
*(Both earlier decisions are resolved: the OpenAI endpoint field shipped, and the dead engine
cache was killed — incremental recompute is now a Vision item.)*
1. **Theme default** — first-run currently follows the OS; flip to always-dark if preferred (1 line).
2. **`tool_use_service.py`** — wire into the MCP vision or delete (see Backend list).

## Suggested next order
Scope **Thread mode** together (the core of the vision) → MCP in/out → debate node / web providers.
