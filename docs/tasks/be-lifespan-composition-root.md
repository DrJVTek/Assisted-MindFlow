# Migrate startup event to FastAPI lifespan + single composition root

**Area:** backend · **Effort:** medium · **Depends on:** none

## Objective
Replace the deprecated @app.on_event("startup") in src/mindflow/api/server.py with a FastAPI lifespan handler, and centralize wiring of the PluginRegistry and the ProviderRegistry singleton into ONE composition-root function so both registries are built in one place instead of being scattered across module import-time side effects.

## Files to touch
- `src/mindflow/api/server.py` — Remove the @app.on_event("startup") decorator/function (lines ~65-88). Add a new composition-root helper that builds the PluginRegistry (and primes the ProviderRegistry singleton) and an @asynccontextmanager lifespan function. Pass lifespan=lifespan to the FastAPI(...) constructor (line ~18).
- `src/mindflow/api/routes/node_types.py` — No code change required — keep set_plugin_registry(registry) as the wiring seam. The new lifespan must still call node_types.set_plugin_registry(registry). Only touch if you choose to add a helper; otherwise leave as-is.
- `src/mindflow/api/routes/providers.py` — No change required. _get_registry() already lazily builds the ProviderRegistry singleton (lines 41-45). The composition root may call it to eagerly build the singleton at startup, but must NOT change its signature or remove the lazy behavior (tests rely on _get_registry / _registry).

## Steps
1. Open src/mindflow/api/server.py and read the whole file first.
2. Add `from contextlib import asynccontextmanager` near the top imports (after `import os`).
3. Define a composition-root function ABOVE the `app = FastAPI(...)` line, e.g. `def _build_plugin_registry() -> PluginRegistry:` that contains the body currently inside `_load_plugins` EXCEPT the `node_types.set_plugin_registry(registry)` call and the logging — i.e. it resolves `project_root = Path(__file__).resolve().parents[3]`, builds `plugin_dirs`, constructs `PluginRegistry(plugin_dirs)`, calls `registry.discover_and_load()`, and `return registry`.
4. Define the lifespan handler ABOVE the `app = FastAPI(...)` line: `@asynccontextmanager` over `async def lifespan(app: FastAPI):`. Inside, call `registry = _build_plugin_registry()`, then `node_types.set_plugin_registry(registry)`, then eagerly build the provider singleton via `from mindflow.api.routes.providers import _get_registry; _get_registry()`, then emit the same `logger.info("Plugin system ready: %d plugins, %d node types", len(registry.plugins), len(registry.node_classes))` log. Then `yield`. No shutdown logic is needed (there is none today), so nothing after `yield`.
5. Add `lifespan=lifespan` as a keyword argument to the existing `FastAPI(...)` constructor call (alongside title/description/version).
6. Delete the entire old block: the comment `# ── Plugin system startup ──` , the `@app.on_event("startup")` decorator and the `async def _load_plugins()` function (currently lines ~65-88).
7. Keep the `node_types` import (it is already imported on line 13 via the routes import list — confirm `node_types` is accessible as `node_types.set_plugin_registry`; it is imported as a name in the `from mindflow.api.routes import (... node_types ...)` line).
8. Run the backend test suite and start the server to confirm startup still logs 'Plugin system ready'.

## Acceptance criteria
- [ ] No occurrence of `@app.on_event` remains anywhere in src/mindflow/api/server.py (verify with grep).
- [ ] The FastAPI constructor receives a `lifespan=` argument and an `@asynccontextmanager`-decorated `lifespan` coroutine exists.
- [ ] Starting the server (uvicorn) logs exactly one line matching 'Plugin system ready: N plugins, M node types' with M > 0 (core plugins load).
- [ ] The PluginRegistry is constructed in exactly ONE place (the `_build_plugin_registry` helper), and `node_types.set_plugin_registry` is called exactly once from `lifespan`.
- [ ] Full backend test suite stays green at 654 passed / 0 failed / 0 errors.
- [ ] No silent fallback added: if `discover_and_load()` raises, the exception must propagate (do NOT wrap it in a try/except that swallows it).

## Verify
```
venv\Scripts\python.exe -m pytest tests -o "addopts=" -p no:cacheprovider -q
venv\Scripts\python.exe -c "from mindflow.api.server import app; assert app.router.lifespan_context is not None; print('lifespan wired OK')"
grep -rn "on_event" src/mindflow/api/server.py  (expect: no matches)
restart.bat  (then confirm the backend log prints 'Plugin system ready: ... plugins, ... node types' and GET http://127.0.0.1:8000/api/node-types returns 200 with a non-empty node_types map)
```

## Gotchas
- CRITICAL behavioral difference: with the OLD `@app.on_event("startup")`, FastAPI does NOT run the handler when tests do plain `TestClient(app)` (non-context-manager) — and ~all contract tests in tests/contract/ use `TestClient(app)` without a `with` block. A `lifespan=` handler has the SAME property (also only runs under `with TestClient(app):` or real ASGI server / uvicorn). So this migration preserves current test behavior. Do NOT 'helpfully' add `with` blocks to existing tests — that would fire the registry build and could change outcomes.
- No existing test calls set_plugin_registry, and no test hits /api/node-types, /api/plugins, or /execute/ through TestClient — those endpoints rely on the startup wiring which only runs under a real server. Keeping the lazy `get_plugin_registry()` RuntimeError (in node_types.py) intact is important; do not pre-initialize `_plugin_registry` at module import.
- plugins.py and execution.py both call `node_types.get_plugin_registry()` at request time — they depend on `set_plugin_registry` having run. The lifespan MUST call it, or those endpoints raise RuntimeError at runtime.
- `Path(__file__).resolve().parents[3]` resolves the repo root from src/mindflow/api/server.py — keep this exact index; changing the file's directory depth would break plugin dir resolution.
- Eagerly building the provider singleton via `_get_registry()` reads data/providers.json from disk; that is fine but must not be wrapped to swallow errors (NO FALLBACK rule).
