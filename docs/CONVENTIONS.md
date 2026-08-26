# MindFlow — Conventions & Working Context

> Shared context any contributor (human or LLM) needs BEFORE touching code.
> Read this first, then the task card in [`tasks/`](tasks/). Roadmap: [`ROADMAP.md`](ROADMAP.md).
> Last updated: 2026-06-20 · Branch: `015-foundation-cleanup`.

## 1. How to run the app

Backend and frontend are separate processes. **Use the `venv\` virtualenv** (NOT `.venv\`).

```bash
# One-time install (Windows). install.bat installs `-e .[dev]` (dev extras included,
# so tests run out of the box).
install.bat                 # or: python -m venv venv && venv\Scripts\pip install -e .[dev]
                            # + cd frontend && npm install

# Backend  → http://127.0.0.1:8000   (health: GET /health)
venv\Scripts\python.exe -m uvicorn mindflow.api.server:app --host 127.0.0.1 --port 8000
# Frontend → http://127.0.0.1:5173
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173

# Or both at once:
restart.bat                 # Windows   ·   ./restart.sh  Linux
```

## 2. How to test (ALWAYS test before claiming something works)

```bash
# Backend (run from repo root, using venv):
venv\Scripts\python.exe -m pip install -e ".[dev]"      # once: installs pytest, pytest-asyncio, etc.
venv\Scripts\python.exe -m pytest tests -o "addopts=" -p no:cacheprovider -q
#   -o "addopts="  disables the coverage flags baked into pyproject (faster).
#   Current green baseline: 635 passed / 0 failed / 0 errors / 3 xfailed.
#   Frontend baseline: 129 passed / 3 skipped (12 files).

# Frontend:
npm --prefix frontend run test     # vitest
npm --prefix frontend run lint     # eslint
```

To verify a **UI** change, run the app and look at it (screenshot / open `localhost:5173`). A green
unit test is not proof the screen renders — launch it.

## 3. Hard rules (non-negotiable)

- **NO FALLBACK.** Never add silent fallbacks, default substitutions, stubs, mocks, TODOs, or demo
  code in production. If something fails (model/API/tool), surface a clear error and stop. The user
  chooses explicitly. (This is already enforced in the engine and covered by tests.)
- **No secrets in the repo.** It's open source. API keys live in encrypted local storage
  (`data/secrets/`, git-ignored) or env — never hardcoded, never committed. Missing key = fail clearly.
- **Minimal root files.** Only essentials at root. Tests → `tests/`, docs → `docs/`, temp/experiments →
  `workbench/` (git-ignored). Do NOT create new root files or unauthorized docs/scripts.
- **Multiplatform.** Code must work on Windows AND Linux (path separators, etc.).
- **Commits:** `type(015): subject` (feat/fix/refactor/test/docs). End the message with a trailer:
  `Co-Authored-By: Claude <noreply@anthropic.com>` (or the current model name). Atomic commits; green tests at each step.

## 4. Architecture map (where things live)

**Backend `src/mindflow/`** (layered; lower layers must not import higher ones):
- `api/server.py` — FastAPI app + routers. `api/routes/*` — HTTP endpoints only (no business logic).
- `engine/` — `orchestrator.py` (the real execution path), `executor.py` (`GraphExecutor` = a PURE
  topology utility: topological_sort + cycle detection, nothing else), `validator.py`. **`engine/` MUST NOT import from `mindflow.api`** (dependency inversion — providers
  are injected).
- `plugins/` — `registry.py` (ComfyUI-style node-type loader: `INPUT_TYPES/RETURN_TYPES/FUNCTION/
  CATEGORY`, `NODE_CLASS_MAPPINGS`, `PLUGIN_MANIFEST`), loads `plugins/core` + `plugins/community`.
- `providers/` — LLM providers (`openai`, `anthropic`, `ollama`, `gemini`, `openai_chatgpt`).
- `services/` — organized into sub-packages: `mcp/` (server, client_manager, tool_use_service),
  `auth/` (oauth, token/secret storage, provider_registry), `storage/` (canvas, versions),
  `graph/` (graph_service, migration, debate_engine), `llm_web/` (chatgpt_client, conversation_import).
- `models/` — pydantic models (node, graph, group, provider, …).

**Frontend `frontend/src/`** (React 19 + ReactFlow 11 + Zustand 5 + Tailwind 3 + Vite 7):
- `App.tsx` renders only `features/canvas/components/Canvas.tsx` (still a large orchestrator —
  internal decomposition is deferred, see ROADMAP).
- **Feature-based layout**: components live under `features/{canvas,nodes,providers,mcp,plugins,
  debate,settings,logging,import}/components/`. `components/` keeps only the shared `ui/` design
  system (Button, Card, Dialog, Input), `icons/`, and `ErrorBoundary`.
- `stores/` — Zustand stores. `types/`, `services/api.ts`.
- NOTE: `npm run build` type-checks ONLY `src/` (tsconfig.app.json include) — a green build does
  NOT cover `frontend/tests/`; always run `npm --prefix frontend run test` too.
- **Design tokens** live in `src/index.css` (`:root` = light, `.dark` = dark). Components must use
  `var(--node-bg / --node-text / --node-border / --primary-color / …)`, NEVER hardcoded hex.

## 5. Execution model (the core idea)

- The **graph IS the memory.** Each node's context is rebuilt from its ancestors at execution time
  (`orchestrator._resolve_inputs`), NOT from any LLM conversation history.
- Edges/links are **derived from each node's `connections` dict** (named ports: `{input_name:
  {source_node_id, output_name}}`). There is no separate persisted edges array. A node can have
  **multiple parents** (merge) by wiring each into a distinct named input port.
- `POST /api/graphs/{gid}/execute/{node_id}` runs only the target's **ancestor sub-tree** (partial
  execution), streaming via SSE. `{{template}}` vars in prompts are substituted at execution time.

## 6. Key gotchas (discovered — don't relearn the hard way)

- **Theme:** first-run default follows the OS (`getSystemDefaultTheme()` in `types/canvas.ts`);
  the user's choice IS persisted (zustand persist, localStorage key `mindflow-ui-preferences`,
  preferences slice only — rehydration is shape-guarded against corrupt values). Toggle in Settings.
- **Node colors:** `features/nodes/components/Node.tsx` reads CSS tokens — keep it that way (it used to hardcode
  `#1E1E2E` and broke light mode).
- **Engine cache (RESOLVED — killed):** the never-wired dirty/clean cache was removed;
  `GraphExecutor` is a pure topology utility and `force_rerun`/`mark-dirty` no longer exist.
  Real incremental recompute is a future vision feature (see ROADMAP), to be designed deliberately.
- **Gemini SDK** is **`google-genai`** (`from google import genai`, per-instance `genai.Client`), NOT
  the legacy `google-generativeai`. `pyproject` pins `google-genai>=1.0.0`.
- **Node validation is intentionally loose** (Feature 014): `NodeType = str` (dynamic plugin types),
  `content` min_length = 0 (empty plugin nodes). Do NOT "restore" strict validation.
- **Two registries, different things:** `services/auth/provider_registry` (LLM providers) vs
  `plugins/registry` (node types). Don't conflate.
- **Provider endpoints:** `OpenAIProvider` accepts a custom `base_url` (= `endpoint_url`); the UI
  exposes it for `local` (Ollama) AND as an optional "Custom base URL (advanced)" field on OpenAI
  providers (for OpenAI-compatible proxies).
