# Install dev extras so tests run after a fresh install (install.bat + install.sh)

**Area:** backend · **Effort:** quick · **Depends on:** none

## Objective
Make a fresh install produce a venv that can actually run the test suite. Today both installers run 'pip install -e .' which omits the [dev] optional-dependencies (pytest, pytest-asyncio, etc.), so tests fail to even import after install. Fix both scripts to install the dev extras.

## Files to touch
- `install.bat` — Line 49: change 'pip install -e .' to 'pip install -e .[dev]'.
- `install.sh` — Line 47: change 'pip install -e .' to 'pip install -e ".[dev]"' (quote the spec for shells like zsh that glob brackets).

## Steps
1. Open pyproject.toml and confirm the dev extras exist under [project.optional-dependencies] -> dev = [pytest, pytest-mock, pytest-asyncio, pytest-cov, mypy, black, ruff]. (They do — this is the set tests need.)
2. Edit install.bat line 49. Current line is exactly:  pip install -e .  Change it to:  pip install -e .[dev]   (cmd.exe does not glob brackets, so no quoting needed).
3. Edit install.sh line 47. Current line is exactly:  pip install -e .  Change it to:  pip install -e ".[dev]"   — the double quotes prevent bracket globbing under zsh/bash and keep it POSIX-safe.
4. Do NOT touch the surrounding error-handling lines (install.bat lines 50-54 'if errorlevel 1' and install.sh 'set -e' on line 5) — they already abort on failure, which satisfies the NO-FALLBACK rule.
5. Verify the spec resolves WITHOUT mutating the developer's working venv: run  venv\Scripts\python.exe -m pip install -e .[dev] --dry-run  and confirm pip reports it would install/confirm pytest et al. (a dry run does not change anything).

## Acceptance criteria
- [ ] install.bat line 49 reads 'pip install -e .[dev]'.
- [ ] install.sh line 47 reads 'pip install -e ".[dev]"' (quoted).
- [ ] The dry-run of the new command resolves successfully and references the dev extras (pytest, ruff, etc.).
- [ ] No other lines in either script changed; the existing 5-step structure and error handling are intact.

## Verify
```
venv\Scripts\python.exe -m pip install -e .[dev] --dry-run   (must exit 0 and mention pytest / pytest-asyncio in the would-install set; does not modify the env)
From Git Bash:  grep -n 'pip install -e' install.bat install.sh   (each must show the [dev] variant; install.sh must be quoted)
```

## Gotchas
- This is the ONLY thing blocking tests after a clean checkout — without [dev] there is no pytest, so the green baseline command in every other card is unrunnable on a fresh machine.
- Quote the spec on install.sh ('".[dev]"'). zsh (default on modern macOS) treats unquoted brackets as a glob and errors with 'no matches found: .[dev]'. cmd.exe (install.bat) does NOT glob, so install.bat must stay UNquoted as .[dev] — quoting it in .bat would pass literal quotes to pip and fail.
- Do not add pytest/ruff to the core [dependencies] in pyproject.toml as a shortcut — they belong in the dev extra and that is already correctly set up. Fixing the installer is the right layer.
- Keep it one atomic commit: 'fix(015): install dev extras in install.bat/.sh so tests run after fresh install'.
