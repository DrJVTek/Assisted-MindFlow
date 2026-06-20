# MindFlow — Conventions & Working Context

> Shared context any contributor (human or LLM) needs BEFORE touching code.
> Read this first, then the task card in [`tasks/`](tasks/). Roadmap: [`ROADMAP.md`](ROADMAP.md).
> Last updated: 2026-06-20 · Branch: `015-foundation-cleanup`.

## 1. How to run the app

Backend and frontend are separate processes. **Use the `venv\` virtualenv** (NOT `.venv\`).

```bash
# One-time install (Windows). NOTE: install.bat runs `pip install -e .` WITHOUT [dev];
# to run tests you must also install dev deps (see §2).
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
#   Current green baseline: 654 passed / 0 failed / 0 errors / 3 xfailed.

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
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Atomic commits; green tests at each step.

## 4. Architecture map (where things live)

**Backend `src/mindflow/`** (layered; lower layers must not import higher ones):
- `api/server.py` — FastAPI app + routers. `api/routes/*` — HTTP endpoints only (no business logic).
- `engine/` — `orchestrator.py` (the real execution path), `executor.py` (`GraphExecutor` = topo sort),
  `validator.py`. **`engine/` MUST NOT import from `mindflow.api`** (dependency inversion — providers
  are injected).
- `plugins/` — `registry.py` (ComfyUI-style node-type loader: `INPUT_TYPES/RETURN_TYPES/FUNCTION/
  CATEGORY`, `NODE_CLASS_MAPPINGS`, `PLUGIN_MANIFEST`), loads `plugins/core` + `plugins/community`.
- `providers/` — LLM providers (`openai`, `anthropic`, `ollama`, `gemini`, `openai_chatgpt`).
- `services/` — currently a 14-file grab-bag (mcp, oauth, storage, graph, chatgpt_client, …) → being
  tidied into sub-packages.
- `models/` — pydantic models (node, graph, group, provider, …).

**Frontend `frontend/src/`** (React 19 + ReactFlow 11 + Zustand 5 + Tailwind 3 + Vite 7):
- `App.tsx` renders only `components/Canvas.tsx` (a god-component holding all interaction).
- `components/` — ~40 flat files (the mess). `features/canvas/` — a half-built feature structure that
  coexists with it. Target: migrate to **feature-based**, keep `components/ui/` as the design system.
- `stores/` — Zustand stores. `types/`, `services/api.ts`.
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

- **Theme:** default is `dark` (`types/canvas.ts`); both themes work; theme is **not persisted**
  (resets on reload). Toggle is in Settings (Sun/Moon).
- **Node colors:** `components/Node.tsx` now reads CSS tokens — keep it that way (it used to hardcode
  `#1E1E2E` and broke light mode).
- **Engine cache:** `GraphExecutor`'s dirty/clean cache is currently **dead code** (the executor is
  recreated per request, so nothing persists; `ExecuteRequest.force_rerun` is unused). Decide kill vs
  wire before relying on it.
- **Gemini SDK** is **`google-genai`** (`from google import genai`, per-instance `genai.Client`), NOT
  the legacy `google-generativeai`. `pyproject` pins `google-genai>=1.0.0`.
- **Node validation is intentionally loose** (Feature 014): `NodeType = str` (dynamic plugin types),
  `content` min_length = 0 (empty plugin nodes). Do NOT "restore" strict validation.
- **Two registries, different things:** `services/provider_registry` (LLM providers) vs
  `plugins/registry` (node types). Don't conflate.
- **Provider endpoints:** the backend `OpenAIProvider` accepts a custom `base_url` (= `endpoint_url`),
  but the UI only exposes that field for the `local` (Ollama) type today.
