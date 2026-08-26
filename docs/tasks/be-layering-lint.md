# Add an automated guard that fails if engine/ imports mindflow.api

**Area:** backend · **Effort:** quick · **Depends on:** none

## Objective
Add a self-contained pytest that statically asserts no module under src/mindflow/engine/ imports mindflow.api. This enforces the dependency-inversion rule the engine already documents in comments ('the engine must NOT import from mindflow.api'), turning an unenforced convention into a CI-checked invariant.

## Files to touch
- `tests/unit/test_engine_layering.py` — CREATE this new file: a pytest that AST-parses every .py under src/mindflow/engine and fails if any contains an `import mindflow.api...` or `from mindflow.api... import` statement.

## Steps
1. Confirm the rule is real and currently satisfied: grep for 'mindflow.api' under src/mindflow/engine — the only two hits are in COMMENTS (orchestrator.py lines 53 and 317), there are ZERO actual import statements. So the test will pass on commit and act as a regression guard.
2. Create tests/unit/test_engine_layering.py with a single test that uses Python's ast module (NOT a text grep) so that the word 'mindflow.api' appearing in a comment or docstring does NOT trip it — only real import/ImportFrom nodes count. This is important: a naive grep would FALSE-POSITIVE on the existing two comments.
3. Resolve the engine dir relative to the repo root via Path(__file__).resolve().parents[2] / 'src' / 'mindflow' / 'engine'  (file is at tests/unit/, so parents[2] is the repo root — matches the layout AFTER be-consolidate-test-trees; if that card has not run yet and the file lives elsewhere, adjust the parents index to reach repo root).
4. Implement the check: for each .py file, ast.parse its source, walk the tree; for ast.Import nodes flag any alias.name == 'mindflow.api' or starting with 'mindflow.api.'; for ast.ImportFrom nodes flag any node.module that equals 'mindflow.api' or starts with 'mindflow.api.'. Collect offenders as 'file:lineno' strings and assert the list is empty with a helpful message.
5. Run the new test alone, then the full suite, and confirm both stay green (654 passed baseline must become 655 passed — one new test — plus 3 xfailed).

## Acceptance criteria
- [ ] tests/unit/test_engine_layering.py exists and contains exactly one test function that AST-parses engine sources.
- [ ] The test PASSES today (engine has no real mindflow.api imports).
- [ ] The test would FAIL if someone adds `from mindflow.api.server import app` (or similar) to any engine module — verify this manually by temporarily adding such a line, seeing red, then reverting.
- [ ] The test does NOT false-positive on the existing 'mindflow.api' mentions in orchestrator.py comments (proving it is AST-based, not a text grep).
- [ ] Full suite is green and the passed count increased by exactly 1 (655 passed, 3 xfailed).

## Verify
```
venv\Scripts\python.exe -m pytest tests/unit/test_engine_layering.py -o "addopts=" -p no:cacheprovider -q   (must pass)
venv\Scripts\python.exe -m pytest tests -o "addopts=" -p no:cacheprovider -q   (must show 655 passed, 3 xfailed)
Manual negative check: temporarily add a line 'from mindflow.api.server import app' to src/mindflow/engine/validator.py, re-run the new test (must FAIL and name validator.py), then REVERT the edit and confirm it passes again.
```

## Gotchas
- DESIGN/SCOPE NOTE — do NOT add import-linter as a dependency: it is NOT installed in the venv (confirmed: `import importlinter` -> ModuleNotFoundError). Adding it would mean a new dep + a [tool.importlinter] config section. Ruff also has no built-in 'forbid module import from package X' rule in the installed ruff 0.15.18 (flake8-tidy-imports banned-api can ban a module name, but configuring it cleanly for a single subpackage is fiddly). The simplest robust, zero-new-dependency guard is a tiny AST-based pytest — that is what this card specifies.
- MUST use ast, not a string/grep search. orchestrator.py already contains the literal text 'mindflow.api' in two COMMENTS (lines 53 and 317) explaining the rule. A grep-based test would fail immediately on those comments. AST parsing only flags real Import/ImportFrom nodes, so it ignores comments and docstrings.
- Account for relative imports too if you want to be thorough: ast.ImportFrom has a `level` attribute (>0 means relative like 'from ..api import x'). Engine modules are deep enough that a relative '..api' could resolve to mindflow.api; if you want maximal strictness, also flag ImportFrom with level>0 whose resolved tail is 'api'. Minimum viable: catch absolute 'mindflow.api' imports, which is what the rule literally says.
- The repo-root resolution (parents[N]) depends on where this test file ends up. As written for tests/unit/ it is parents[2]. If be-consolidate-test-trees has not run, place the file under tests/unit/ anyway (that dir already exists) and parents[2] is correct.
- Atomic commit: 'test(015): guard against engine importing mindflow.api (layering)'.
