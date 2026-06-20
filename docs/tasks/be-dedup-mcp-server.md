# Consolidate the two MCP server modules into one

**Area:** backend · **Effort:** medium · **Depends on:** none

## Objective
There are two modules named mcp_server: src/mindflow/mcp_server.py (a thin CLI entry point) and src/mindflow/services/mcp_server.py (the real FastMCP implementation with the 8 tools). Eliminate the confusing duplication while preserving the documented `python -m mindflow.mcp_server` launch command and keeping all existing tests importing `mindflow.services.mcp_server` green.

## Files to touch
- `src/mindflow/mcp_server.py` — This is the ONLY runnable entry point (defines main() with argparse for --sse/--port and dispatches mcp.run). It imports the FastMCP instance from services.mcp_server. Keep this file as the entry point; do NOT delete it (the public command `python -m mindflow.mcp_server` and specs/011 quickstart depend on the module path).
- `src/mindflow/services/mcp_server.py` — This holds the real implementation: the FastMCP `mcp` instance (line 35) and all 8 @mcp.tool() functions. All tests import from here. Remove the unused dead import `add_graph_to_storage` (imported on line ~27 from mindflow.api.routes.graphs but never referenced in the file).

## Steps
1. Read both files fully: src/mindflow/mcp_server.py and src/mindflow/services/mcp_server.py.
2. Confirm the usage facts with grep (commands in 'verify'): the FastMCP instance `mcp` and all tool functions live ONLY in services/mcp_server.py; the root mcp_server.py only does `from mindflow.services.mcp_server import mcp` inside main() and calls mcp.run(). Both test files (tests/integration/test_mcp_server.py, tests/unit/test_mcp_tools.py) import exclusively from mindflow.services.mcp_server.
3. DECISION (mechanical, low-risk option chosen): Keep BOTH files but make the duplication non-confusing. Root mcp_server.py = entry point only (already is). Implementation stays in services/mcp_server.py. The only concrete change is removing the dead `add_graph_to_storage` import in services/mcp_server.py.
4. In src/mindflow/services/mcp_server.py, edit the import block `from mindflow.api.routes.graphs import (get_graph_from_storage, add_graph_to_storage,)` to import only `get_graph_from_storage` (drop `add_graph_to_storage`). NOTE: tests/integration/test_mcp_server.py patches `mindflow.services.mcp_server.add_graph_to_storage` (line ~131) and tests/unit/test_mcp_tools.py imports add_graph_to_storage from mindflow.api.routes.graphs (NOT from mcp_server) — see gotcha before removing.
5. Add a one-line module docstring note at the top of root src/mindflow/mcp_server.py clarifying it is purely the CLI entry point and that all tools live in mindflow.services.mcp_server, so future readers don't recreate logic here.
6. Run the full test suite to confirm nothing broke.
7. Smoke-test the entry point import path resolves (does NOT need to actually start a stdio server): import the module and assert `mcp` is reachable.

## Acceptance criteria
- [ ] Exactly one FastMCP instance and one copy of the 8 tool functions exist in the codebase (in services/mcp_server.py). grep for `FastMCP(` returns a single hit under src/.
- [ ] `python -m mindflow.mcp_server --help` still works and shows the --sse/--port options (entry point preserved).
- [ ] All tests importing `mindflow.services.mcp_server` still pass.
- [ ] No dead/unused import remains in services/mcp_server.py (add_graph_to_storage removed) UNLESS a test patches it — see gotcha; if the test patches it, keep the import and instead leave a comment, do not break the test.
- [ ] Full backend test suite stays green at 654 passed / 0 failed / 0 errors.
- [ ] Root mcp_server.py contains no @mcp.tool definitions and no business logic — only argparse + dispatch.

## Verify
```
grep -rn "FastMCP(" src/  (expect exactly one match: src/mindflow/services/mcp_server.py)
grep -rn "from mindflow.services.mcp_server\|from mindflow.mcp_server\|mindflow.mcp_server" src/ tests/  (review every importer before changing anything)
grep -n "add_graph_to_storage" tests/integration/test_mcp_server.py tests/unit/test_mcp_tools.py  (CHECK: integration test patches mindflow.services.mcp_server.add_graph_to_storage — if so, removing the import will break that patch target)
venv\Scripts\python.exe -m pytest tests/integration/test_mcp_server.py tests/unit/test_mcp_tools.py -o "addopts=" -p no:cacheprovider -q
venv\Scripts\python.exe -m pytest tests -o "addopts=" -p no:cacheprovider -q
venv\Scripts\python.exe -m mindflow.mcp_server --help
```

## Gotchas
- BLOCKER on removing add_graph_to_storage: tests/integration/test_mcp_server.py line ~131 does `with patch("mindflow.services.mcp_server.add_graph_to_storage"):`. unittest.mock.patch will FAIL with AttributeError if the name no longer exists in that module's namespace. So you must EITHER (a) leave the `add_graph_to_storage` import in services/mcp_server.py (simplest, keeps tests green — then this card's only real change is the docstring clarification on root mcp_server.py), OR (b) also edit that test to drop the patch. Option (a) is the safe mechanical choice; the import is harmless. Verify by running the integration test BOTH ways. Do NOT remove the import without running the integration test.
- Do NOT delete src/mindflow/mcp_server.py: it is the documented launch command. specs/011-multi-provider-llm-mcp/quickstart.md line 53 configures MCP clients with `"args": ["-m", "mindflow.mcp_server"]`. Deleting it breaks the public contract.
- Do NOT move the implementation INTO the root mcp_server.py (the opposite direction): every test imports `mindflow.services.mcp_server`, so moving tools would require rewriting both test files and the root entry point — much higher risk and out of scope for a mechanical dedup.
- The two files are NOT actually duplicate implementations — root is an entry point that imports from services. The 'dedup' here is really about (1) removing a genuinely dead import and (2) documenting the split so nobody clones logic into the root file. Be honest in the commit message about this; do not claim you merged two implementations.
- docs/ROADMAP.md (line 19) and docs/architecture/foundation-cleanup-plan.md track this dedup — if updating docs, mark it done rather than describing a merge that didn't happen.
