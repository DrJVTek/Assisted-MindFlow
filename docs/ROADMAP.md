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
- [ ] **Phase 1b — single execution engine.** Decide the dirty/clean cache: **kill** the dead code, or **wire** it for real incremental recompute (re-run a branch without recomputing unchanged ancestors). *Decision pending.* — ◐
- [ ] **Tidy `services/`** (14 mixed services → sub-packages: `mcp/`, `auth/`, `storage/`, `llm_web/`, `graph/`). — ◐
- [ ] **Dedup `mcp_server.py`** (root vs `services/mcp_server.py`). — ⚡
- [ ] `@app.on_event("startup")` → FastAPI **`lifespan`** + a single **composition root** for singletons. — ⚡
- [ ] **Consolidate the 3 test trees** (`tests/unit`, `tests/integration`, `tests/backend`) + duplicate migration tests. — ◐
- [ ] `install.bat` should install `.[dev]` (tests can't run after a fresh install today). — ⚡
- [ ] Replace deprecated `FieldValidationInfo` import (`models/provider.py`). — ⚡
- [ ] **Guardrail:** layering lint forbidding `engine → api`; architecture docs. — ⚡

## 🎨 UI — the active track (dark / ComfyUI finish)
- [ ] **Node refinement** — typography, spacing, header treatment, hover states. — ⚡
- [ ] **Thread mode** — the simple "ChatGPT-like" stacked view; one graph, two views (Thread ⟷ Canvas). The core of the *simple + powerful* vision. — ⛰
- [ ] **Frontend modularization** — flat `components/` (~40 files) → feature-based; decompose `Canvas.tsx` (god-component); fix ReactFlow `nodeTypes` memoization warning. — ◐
- [ ] **Branding** — integrate `logo.png` / `Logo2.png`, a real top bar. — ⚡
- [ ] **Theme** — persistence (localStorage) + configurable default / follow system (`prefers-color-scheme`). — ⚡
- [ ] **Custom `endpoint_url` for OpenAI providers** — unlocks pointing at an OpenAI-compatible proxy from the UI (backend already supports `base_url`; only `local`/Ollama exposes the field today). *Decision pending.* — ⚡

## 🚀 Vision — beyond cleanup (larger)
- [ ] **MCP in/out** — finish bidirectional MCP: consume MCP servers **and** expose graphs/groups **as** callable MCP tools. — ⛰
- [ ] **Groups as reusable functions** — input variables + outputs, callable from another canvas (currently embryonic: `models/group.py`, `plugins/composite.py`, `subgraphs` route). — ⛰
- [ ] **Debate node finalized** — multi-model debate/validation/consensus (embryonic: `debate_engine`, `debateStore`, `DebateControls`). — ◐
- [ ] **Web / proxy providers** — Gemini Web (native, like ChatGPT Web = path A) and/or OpenAI-compatible proxy support (path B), ideally **providers as plugins** (today only node-types are pluggable; providers are core). — ⛰
- [ ] **First-class "merge two branches" gesture** — the engine supports multi-parent merge via named ports; the UX doesn't surface it as a one-click action. — ◐
- [ ] **Image / schema generating nodes** (new plugin node types). — ◐
- [ ] **Deep ChatGPT import** — pull projects / memory, work them as a tree (embryonic: `conversation_import`). — ⛰

---

## ⏳ Open decisions (waiting on the user)
1. **OpenAI custom endpoint field** — add it now (enables proxies) or note for later?
2. **Engine dirty/clean cache** — kill the dead cache, or wire real incremental recompute?

## Suggested next order
Node refinement (⚡, visible) → scope **Thread mode** together (the core) → close out the backend tidy. Reorder freely.
