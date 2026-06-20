"""Layering guard — modules under ``src/mindflow/engine/`` must NOT import ``mindflow.api``.

The engine is a lower layer than the API; provider resolution is *injected*
(see ``Orchestrator(provider_resolver=..., provider_type_resolver=...)``). This
AST-based test turns the documented dependency-inversion rule into a CI-checked
invariant. It parses the AST (not text) so the rule's mention in orchestrator.py
*comments* does not false-positive — only real ``import``/``from`` statements count.
"""

import ast
from pathlib import Path

# tests/unit/test_engine_layering.py -> parents[2] is the repo root.
ENGINE_DIR = Path(__file__).resolve().parents[2] / "src" / "mindflow" / "engine"


def _is_api_module(name: str | None) -> bool:
    return bool(name) and (name == "mindflow.api" or name.startswith("mindflow.api."))


def test_engine_does_not_import_api() -> None:
    """Fail if any engine module imports mindflow.api (absolute import)."""
    assert ENGINE_DIR.is_dir(), f"engine dir not found: {ENGINE_DIR}"

    offenders: list[str] = []
    for py_file in sorted(ENGINE_DIR.rglob("*.py")):
        tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if _is_api_module(alias.name):
                        offenders.append(f"{py_file.name}:{node.lineno} (import {alias.name})")
            elif isinstance(node, ast.ImportFrom):
                if _is_api_module(node.module):
                    offenders.append(f"{py_file.name}:{node.lineno} (from {node.module})")

    assert not offenders, (
        "engine/ must not import mindflow.api (dependency inversion is broken). "
        "Inject the dependency instead. Offenders:\n  " + "\n  ".join(offenders)
    )
