# Consolidate the three overlapping test trees into one layout

**Area:** backend · **Effort:** medium · **Depends on:** none

## Objective
Collapse the three parallel test trees (tests/unit, tests/integration, tests/backend/{unit,integration}, tests/contract) into ONE coherent layout with no duplicate-named modules and zero lost coverage. After the move, the baseline must still be 654 passed / 3 xfailed.

## Files to touch
- `tests/backend/unit/*.py` — Move all 12 unit test modules into tests/unit/ (they currently live in a second 'backend' tree). Merge, do not overwrite — basenames are unique EXCEPT test_migration.py (handled below).
- `tests/backend/integration/*.py` — Move test_execution_pipeline.py, test_plugin_loading.py into tests/integration/. Handle test_migration.py separately (rename) to avoid colliding with the unit one.
- `tests/backend/unit/test_migration.py` — Rename on move to tests/unit/test_migration_unit.py (a tests/unit/test_migration.py does NOT currently exist, but the integration tree also has a test_migration.py — keep both, give them distinct basenames).
- `tests/backend/integration/test_migration.py` — Rename on move to tests/integration/test_migration_e2e.py so it no longer shares a basename with the unit migration test.
- `tests/backend/unit/test_plugin_registry.py` — After moving to tests/unit/, fix line 352: Path(__file__).resolve().parents[3] must become parents[2] (file is now 2 levels under repo root, not 3).
- `tests/backend/integration/test_plugin_loading.py` — After moving to tests/integration/, fix line 10: Path(__file__).resolve().parents[3] must become parents[2].
- `tests/backend/` — Delete the now-empty tests/backend/ directory tree (including its __init__.py files) once all files are moved out.

## Steps
1. From repo root, confirm the current green baseline: venv\Scripts\python.exe -m pytest tests -o "addopts=" -p no:cacheprovider -q  (expect '654 passed, 3 xfailed').
2. Decide the target layout (kept simple, marker-free since NO test currently uses @pytest.mark): tests/unit/ for unit tests, tests/integration/ for integration tests, tests/contract/ stays as-is. The 'backend' tree is the redundant one and gets emptied.
3. Move the 11 non-migration unit files from tests/backend/unit/ to tests/unit/ : test_composite_nodes.py, test_dirty_clean.py, test_executor.py, test_graph_executor.py, test_orchestrator.py, test_plugin_registry.py, test_provider_interface.py, test_provider_isolation.py, test_provider_no_fallback.py, test_sse_serialization.py, test_type_system.py. Use: git mv tests/backend/unit/<file> tests/unit/<file>
4. Move tests/backend/unit/test_migration.py to tests/unit/test_migration_unit.py (rename to keep it distinct from the integration migration test): git mv tests/backend/unit/test_migration.py tests/unit/test_migration_unit.py
5. Move the integration files: git mv tests/backend/integration/test_execution_pipeline.py tests/integration/test_execution_pipeline.py  and  git mv tests/backend/integration/test_plugin_loading.py tests/integration/test_plugin_loading.py
6. Move + rename the integration migration test: git mv tests/backend/integration/test_migration.py tests/integration/test_migration_e2e.py
7. Open tests/unit/test_plugin_registry.py, find the line 'root = Path(__file__).resolve().parents[3]' (was line 352) and change parents[3] to parents[2]. RATIONALE: at the old depth tests/backend/unit/, parents[3] == repo root; at the new depth tests/unit/, the repo root is parents[2]. Getting this wrong makes the test point above the repo and the core-plugins path will not exist.
8. Open tests/integration/test_plugin_loading.py, find 'CORE_PLUGINS_DIR = str(Path(__file__).resolve().parents[3] / "plugins" / "core")' (line 10) and change parents[3] to parents[2] for the same reason.
9. Delete the empty backend tree and its package files: git rm tests/backend/unit/__init__.py tests/backend/integration/__init__.py tests/backend/__init__.py  then remove the now-empty directories (git rm already stages the deletions).
10. Sanity-check there are no remaining duplicate test basenames: from a Bash shell run  find tests -name 'test_*.py' -printf '%f\n' | sort | uniq -d  — it must print NOTHING.
11. Re-run the full suite and confirm the count is unchanged: still 654 passed, 3 xfailed. The collected count before the move was 657 items (654 passed + 3 xfailed).

## Acceptance criteria
- [ ] tests/backend/ no longer exists.
- [ ] No two test files anywhere under tests/ share the same basename (find ... | uniq -d prints nothing).
- [ ] tests/unit/ contains test_migration_unit.py and tests/integration/ contains test_migration_e2e.py; both still hold their original assertions (no test functions deleted).
- [ ] Both parents[3] occurrences (test_plugin_registry.py and test_plugin_loading.py) are now parents[2] and the plugin-loading tests still pass (they load real plugins from <repo>/plugins/core).
- [ ] Full suite is still 654 passed / 3 xfailed — identical to baseline, proving zero coverage lost.

## Verify
```
venv\Scripts\python.exe -m pytest tests -o "addopts=" -p no:cacheprovider -q   (expect: 654 passed, 3 xfailed)
venv\Scripts\python.exe -m pytest tests/unit/test_plugin_registry.py tests/integration/test_plugin_loading.py -o "addopts=" -p no:cacheprovider -q   (the two files whose parents[N] was edited must pass)
From Git Bash:  find tests -name 'test_*.py' -printf '%f\n' | sort | uniq -d   (must print nothing)
```

## Gotchas
- Every test directory has an __init__.py, so pytest imports tests as PACKAGES (tests.backend.unit.test_migration vs tests.backend.integration.test_migration). That is the ONLY reason the two test_migration.py files don't collide today. The moment you flatten them into trees without renaming, pytest will raise 'import file mismatch' / duplicate module errors. Renaming the basenames (test_migration_unit.py / test_migration_e2e.py) is the safe fix — do NOT rely on keeping deep __init__.py packages.
- THE BIG ONE: tests/backend/unit/test_plugin_registry.py:352 and tests/backend/integration/test_plugin_loading.py:10 both use Path(__file__).resolve().parents[3] to reach the repo root and load real plugins from <repo>/plugins/core. parents[N] is depth-sensitive: at depth tests/backend/unit/ the root is parents[3]; at depth tests/unit/ it is parents[2]. You MUST decrement the index when moving up one directory level, or these tests silently look in the wrong place and fail.
- The strings 'from .nodes import TestNode' inside tests/backend/unit/test_plugin_registry.py (lines 55-56, VALID_MANIFEST constant) are Python source written into a TEMP plugin dir at runtime — they are NOT a real import of a sibling test module. Do not be alarmed; there is no tests/.../nodes.py to move.
- tests/integration/ currently contains only test_mcp_server.py as a real source file (a stale test_providers_api .pyc exists in __pycache__ but the .py was already deleted — ignore it). The integration target dir is mostly empty and safe to populate.
- No test file uses @pytest.mark.unit/integration/contract markers, so you cannot select trees by marker — separation is purely by directory. Do not invent markers; keep it directory-based. pyproject.toml [tool.pytest.ini_options] testpaths=['tests'] already discovers the whole tree, so no config change is needed.
- Use 'git mv' (not plain mv) so the moves are tracked and the commit is a clean rename. Keep it one atomic commit: 'refactor(015): consolidate test trees into tests/{unit,integration,contract}'.
