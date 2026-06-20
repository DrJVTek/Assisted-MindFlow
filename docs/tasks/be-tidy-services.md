# Reorganize src/mindflow/services/ grab-bag into sub-packages (behavior-preserving)

**Area:** backend · **Effort:** medium · **Depends on:** none

## Objective
Split the flat 14-file src/mindflow/services/ directory into 5 cohesive sub-packages (mcp/, auth/, storage/, llm_web/, graph/) by physically moving each module and rewriting every import that references it. Pure mechanical refactor: no behavior change, no logic edits, the full test suite (654 passed) must stay green afterward.

## Files to touch
- `src/mindflow/services/mcp_server.py` — MOVE to src/mindflow/services/mcp/server.py
- `src/mindflow/services/mcp_client_manager.py` — MOVE to src/mindflow/services/mcp/client_manager.py
- `src/mindflow/services/tool_use_service.py` — MOVE to src/mindflow/services/mcp/tool_use_service.py
- `src/mindflow/services/oauth_service.py` — MOVE to src/mindflow/services/auth/oauth_service.py
- `src/mindflow/services/token_storage.py` — MOVE to src/mindflow/services/auth/token_storage.py
- `src/mindflow/services/secret_storage.py` — MOVE to src/mindflow/services/auth/secret_storage.py
- `src/mindflow/services/provider_registry.py` — MOVE to src/mindflow/services/auth/provider_registry.py (imports oauth_service/secret_storage/token_storage — all become same-package siblings)
- `src/mindflow/services/canvas_service.py` — MOVE to src/mindflow/services/storage/canvas_service.py
- `src/mindflow/services/version_storage.py` — MOVE to src/mindflow/services/storage/version_storage.py
- `src/mindflow/services/graph_service.py` — MOVE to src/mindflow/services/graph/graph_service.py
- `src/mindflow/services/graph_migration.py` — MOVE to src/mindflow/services/graph/graph_migration.py
- `src/mindflow/services/debate_engine.py` — MOVE to src/mindflow/services/graph/debate_engine.py (imports provider_registry — now a cross-package import to mindflow.services.auth.provider_registry)
- `src/mindflow/services/chatgpt_client.py` — MOVE to src/mindflow/services/llm_web/chatgpt_client.py
- `src/mindflow/services/conversation_import.py` — MOVE to src/mindflow/services/llm_web/conversation_import.py
- `src/mindflow/services/mcp/__init__.py` — CREATE empty (one comment line) — new sub-package marker
- `src/mindflow/services/auth/__init__.py` — CREATE empty — new sub-package marker
- `src/mindflow/services/storage/__init__.py` — CREATE empty — new sub-package marker
- `src/mindflow/services/graph/__init__.py` — CREATE empty — new sub-package marker
- `src/mindflow/services/llm_web/__init__.py` — CREATE empty — new sub-package marker
- `src/mindflow/api/routes/canvases.py` — line 16: rewrite import canvas_service -> services.storage.canvas_service
- `src/mindflow/api/routes/graphs.py` — lines 23-24: version_storage -> services.storage.version_storage; graph_service -> services.graph.graph_service
- `src/mindflow/api/routes/import_conversations.py` — lines 19-20: chatgpt_client -> services.llm_web.chatgpt_client; conversation_import -> services.llm_web.conversation_import
- `src/mindflow/api/routes/mcp_connections.py` — line 24: mcp_client_manager -> services.mcp.client_manager
- `src/mindflow/api/routes/providers.py` — line 31: provider_registry -> services.auth.provider_registry
- `src/mindflow/api/routes/debates.py` — line 23: 'from mindflow.services import debate_engine' -> 'from mindflow.services.graph import debate_engine'
- `src/mindflow/mcp_server.py` — line 34: 'from mindflow.services.mcp_server import mcp' -> 'from mindflow.services.mcp.server import mcp' (this is the top-level launcher, a DIFFERENT file from the one being moved)
- `src/mindflow/providers/openai_chatgpt.py` — lines 24-25: oauth_service -> services.auth.oauth_service; token_storage -> services.auth.token_storage
- `tests/integration/test_mcp_server.py` — lines 12,33,45,87,105,128,131: import + every mock.patch('mindflow.services.mcp_server....') string -> 'mindflow.services.mcp.server....'
- `tests/unit/test_mcp_tools.py` — lines 18,19,40: canvas_service -> services.storage.canvas_service; mcp_server -> services.mcp.server; 'import mindflow.services.mcp_server as mcp_mod' -> 'import mindflow.services.mcp.server as mcp_mod' (the _canvas_service patch at L42-46 uses the mcp_mod alias, no string change needed)
- `tests/unit/test_mcp_client_manager.py` — line 20: mcp_client_manager -> services.mcp.client_manager (docstring line 1 mention is cosmetic)
- `tests/contract/test_mcp_client_contracts.py` — line 12: mcp_client_manager -> services.mcp.client_manager
- `tests/unit/test_oauth_service.py` — lines 15,23 imports + lines 203,227,264,272 mock.patch('mindflow.services.oauth_service....') strings -> 'mindflow.services.auth.oauth_service....'; token_storage -> services.auth.token_storage
- `tests/unit/test_token_storage.py` — line 10: token_storage -> services.auth.token_storage
- `tests/unit/test_secret_storage.py` — line 8: secret_storage -> services.auth.secret_storage
- `tests/unit/test_provider_registry.py` — line 20: provider_registry -> services.auth.provider_registry
- `tests/contract/test_provider_contracts.py` — line 13: provider_registry -> services.auth.provider_registry
- `tests/contract/test_auth_endpoints.py` — line 23: provider_registry -> services.auth.provider_registry
- `tests/unit/test_openai_chatgpt_provider.py` — line 23: oauth_service -> services.auth.oauth_service
- `tests/unit/test_debate_engine.py` — line 14: 'from mindflow.services import debate_engine' -> 'from mindflow.services.graph import debate_engine'
- `tests/contract/test_debate_contracts.py` — line 15: 'from mindflow.services import debate_engine' -> 'from mindflow.services.graph import debate_engine'
- `tests/backend/unit/test_migration.py` — line 5: graph_migration -> services.graph.graph_migration
- `tests/backend/integration/test_migration.py` — line 8: graph_migration -> services.graph.graph_migration
- `tests/unit/test_node_version.py` — line 20: version_storage -> services.storage.version_storage

## Steps
1. STEP 0 — verify clean baseline. From repo root run: venv\Scripts\python.exe -m pytest tests -o "addopts=" -p no:cacheprovider -q  — confirm it ends with '654 passed, 3 xfailed'. If not green, STOP and report; do not start the move.
2. STEP 1 — create the 5 sub-packages. Make directories src/mindflow/services/mcp, .../auth, .../storage, .../graph, .../llm_web. In EACH create an __init__.py whose ONLY content is a single comment line, e.g. '# MindFlow Engine - services.mcp sub-package'. Do NOT add any re-exports — the parent src/mindflow/services/__init__.py is also empty (just a comment) and nothing is re-exported, so empty markers preserve behavior.
3. STEP 2 — move the files with `git mv` (preserves history; one move per file). From repo root: git mv src/mindflow/services/mcp_server.py src/mindflow/services/mcp/server.py ; git mv src/mindflow/services/mcp_client_manager.py src/mindflow/services/mcp/client_manager.py ; git mv src/mindflow/services/tool_use_service.py src/mindflow/services/mcp/tool_use_service.py ; git mv src/mindflow/services/oauth_service.py src/mindflow/services/auth/oauth_service.py ; git mv src/mindflow/services/token_storage.py src/mindflow/services/auth/token_storage.py ; git mv src/mindflow/services/secret_storage.py src/mindflow/services/auth/secret_storage.py ; git mv src/mindflow/services/provider_registry.py src/mindflow/services/auth/provider_registry.py ; git mv src/mindflow/services/canvas_service.py src/mindflow/services/storage/canvas_service.py ; git mv src/mindflow/services/version_storage.py src/mindflow/services/storage/version_storage.py ; git mv src/mindflow/services/graph_service.py src/mindflow/services/graph/graph_service.py ; git mv src/mindflow/services/graph_migration.py src/mindflow/services/graph/graph_migration.py ; git mv src/mindflow/services/debate_engine.py src/mindflow/services/graph/debate_engine.py ; git mv src/mindflow/services/chatgpt_client.py src/mindflow/services/llm_web/chatgpt_client.py ; git mv src/mindflow/services/conversation_import.py src/mindflow/services/llm_web/conversation_import.py  (NOTE: mcp_server.py -> server.py drops the 'mcp_' prefix; keep exact target names as listed in filesToTouch).
4. STEP 3 — fix INTRA-services imports (between the moved files). There are exactly 5, all absolute (no relative imports exist in services/): (a) auth/provider_registry.py: 'from mindflow.services.oauth_service import OAuthService, get_oauth_config' -> 'from mindflow.services.auth.oauth_service import OAuthService, get_oauth_config'; 'from mindflow.services.secret_storage import SecretStorage' -> 'from mindflow.services.auth.secret_storage import SecretStorage'; 'from mindflow.services.token_storage import TokenStorage' -> 'from mindflow.services.auth.token_storage import TokenStorage'. (b) auth/oauth_service.py: 'from mindflow.services.token_storage import TokenStorage' -> 'from mindflow.services.auth.token_storage import TokenStorage'. (c) graph/debate_engine.py: 'from mindflow.services.provider_registry import ProviderRegistry' -> 'from mindflow.services.auth.provider_registry import ProviderRegistry'. (d) mcp/server.py: 'from mindflow.services.canvas_service import CanvasService' -> 'from mindflow.services.storage.canvas_service import CanvasService' AND 'from mindflow.services import debate_engine' -> 'from mindflow.services.graph import debate_engine'. mcp/server.py also imports 'from mindflow.api.routes.graphs import ...' and 'from mindflow.api.routes.providers import _get_registry' — these are NOT services, leave them UNCHANGED. tool_use_service.py imports nothing from siblings — leave it.
5. STEP 4 — fix src/ CALLERS outside services. Edit each exactly: api/routes/canvases.py L16 canvas_service->services.storage.canvas_service ; api/routes/graphs.py L23 version_storage->services.storage.version_storage and L24 graph_service->services.graph.graph_service ; api/routes/import_conversations.py L19 chatgpt_client->services.llm_web.chatgpt_client and L20 conversation_import->services.llm_web.conversation_import ; api/routes/mcp_connections.py L24 mcp_client_manager->services.mcp.client_manager ; api/routes/providers.py L31 provider_registry->services.auth.provider_registry ; api/routes/debates.py L23 'from mindflow.services import debate_engine'->'from mindflow.services.graph import debate_engine' ; mindflow/mcp_server.py L34 'from mindflow.services.mcp_server import mcp'->'from mindflow.services.mcp.server import mcp' ; providers/openai_chatgpt.py L24 oauth_service->services.auth.oauth_service and L25 token_storage->services.auth.token_storage.
6. STEP 5 — fix TEST callers. Update the import line in each test file per the filesToTouch list. CRITICAL extra work in two files: (1) tests/integration/test_mcp_server.py uses mock.patch with STRING targets 'mindflow.services.mcp_server.<x>' at lines 33,45,87,105,128,131 — change EVERY such string to 'mindflow.services.mcp.server.<x>' (and the import at L12). (2) tests/unit/test_oauth_service.py uses mock.patch('mindflow.services.oauth_service.<x>') at lines 203,227,264,272 — change EVERY such string to 'mindflow.services.auth.oauth_service.<x>'. mock.patch targets that follow a module alias (e.g. test_mcp_tools.py patches mcp_mod._canvas_service via the imported alias, not a string literal) need NO change.
7. STEP 6 — search for stragglers. From repo root grep (or use the Grep tool) for the old flat paths: pattern 'mindflow\.services\.(mcp_server|mcp_client_manager|tool_use_service|oauth_service|token_storage|secret_storage|provider_registry|canvas_service|version_storage|graph_service|graph_migration|chatgpt_client|conversation_import)' across src and tests, AND the literal 'from mindflow.services import debate_engine'. Both must return ZERO hits. The only allowed remaining 'mindflow.services.X' references are the new dotted paths (e.g. mindflow.services.mcp.server).
8. STEP 7 — run tests and assert green (see verify). Then commit atomically with message 'refactor(015): reorganize services into mcp/auth/storage/graph/llm_web sub-packages'.

## Acceptance criteria
- [ ] All 14 modules physically live under one of the 5 new sub-packages (mcp/, auth/, storage/, graph/, llm_web/); src/mindflow/services/ no longer contains any of the original 14 .py files at top level (only __init__.py + the 5 sub-dirs).
- [ ] Each new sub-package has an __init__.py with a single comment line and no re-exports.
- [ ] The straggler greps in STEP 6 return zero hits for old flat paths and for 'from mindflow.services import debate_engine'.
- [ ] Full backend suite is GREEN at the same count as baseline: 654 passed, 3 xfailed (no new failures, errors, or collection errors).
- [ ] No logic/behavior changed — only import paths and file locations. `git diff` of any moved file beyond the import lines listed is empty.
- [ ] Single atomic commit with message 'refactor(015): reorganize services into mcp/auth/storage/graph/llm_web sub-packages'.

## Verify
```
From repo root, full suite (must match baseline 654 passed / 3 xfailed): venv\Scripts\python.exe -m pytest tests -o "addopts=" -p no:cacheprovider -q
Import smoke test (catches broken module paths fast): venv\Scripts\python.exe -c "import mindflow.services.mcp.server, mindflow.services.mcp.client_manager, mindflow.services.mcp.tool_use_service, mindflow.services.auth.oauth_service, mindflow.services.auth.token_storage, mindflow.services.auth.secret_storage, mindflow.services.auth.provider_registry, mindflow.services.storage.canvas_service, mindflow.services.storage.version_storage, mindflow.services.graph.graph_service, mindflow.services.graph.graph_migration, mindflow.services.graph.debate_engine, mindflow.services.llm_web.chatgpt_client, mindflow.services.llm_web.conversation_import; print('OK')"  (must print OK)
App boot smoke (FastAPI app still constructs — catches route-file import breakage): venv\Scripts\python.exe -c "from mindflow.api.app import app; print('app ok')"  (if the app module path differs, instead start the backend via run-backend.bat and confirm it serves on :8000 with no ImportError in console)
Straggler greps from STEP 6 return empty output.
```

## Gotchas
- NO relative imports exist inside services/ — every cross-service import is absolute 'mindflow.services.X'. The rewrite is purely a path-segment insertion; there is nothing to convert to '..' relative form. Do NOT introduce relative imports.
- tool_use_service.py has ZERO importers anywhere (no src, no test). It is effectively unused production code today. Move it into mcp/ for cohesion but do NOT delete it (out of scope); expect no test to reference it.
- graph_migration.py has NO src/ caller — only tests/backend/unit/test_migration.py and tests/backend/integration/test_migration.py import it. It is not wired into any production deserialization path. Just move it and update those two test files.
- TWO mock.patch STRING hotspots are easy to miss because they are string literals, not import statements: tests/integration/test_mcp_server.py (5 patch strings 'mindflow.services.mcp_server....') and tests/unit/test_oauth_service.py (4 patch strings 'mindflow.services.oauth_service....'). Fixing only the import lines leaves these tests failing at runtime with ModuleNotFoundError / AttributeError. Grep the literal old dotted strings to find them all.
- mcp_server.py is renamed to server.py (drops 'mcp_' since it now lives in mcp/). Its top-level launcher importer at src/mindflow/mcp_server.py is a DIFFERENT file (not moved) and must point to 'mindflow.services.mcp.server'. Don't confuse the two mcp_server.py files.
- mcp/server.py imports from mindflow.api.routes.graphs and mindflow.api.routes.providers (NOT services). Leave those two lines untouched — only its two services imports change. Moving the file preserves the existing api<->services import direction 1:1, so no new circular-import risk is introduced.
- Two test trees exist: flat tests/unit + tests/integration + tests/contract AND nested tests/backend/unit + tests/backend/integration. The migration tests live under tests/backend/. Don't forget the backend/ subtree.
- Use `git mv` (not an OS move) so history is preserved and the diff shows renames, keeping the commit reviewable.
- The parent src/mindflow/services/__init__.py is empty (only a comment) and re-exports nothing — keep it that way. Do NOT add convenience re-exports there or in the new sub-package __init__.py files; that would be a behavior/design change beyond this card's scope.
