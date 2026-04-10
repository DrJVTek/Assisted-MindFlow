"""Plugin management API endpoints.

Exposes the loaded plugin registry to the frontend Settings panel so the
user can inspect, upload, remove, and (fake) update plugins without
touching the filesystem manually.

Endpoints:
- GET    /api/plugins              — list all loaded plugins with metadata
- POST   /api/plugins/reload       — rescan plugin dirs and reload registry
- POST   /api/plugins/upload       — upload a .zip containing a plugin dir
- DELETE /api/plugins/{name}       — remove a plugin directory from disk
- POST   /api/plugins/{name}/update — stub "check for update" endpoint

Community plugins live in `plugins/community/`; core plugins in
`plugins/core/`. Delete and upload target the community directory only —
core plugins are immutable from the UI to avoid accidentally wiping
bundled functionality.
"""

import logging
import shutil
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field

from mindflow.plugins.registry import PluginRegistry
from mindflow.api.routes import node_types

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/plugins", tags=["plugins"])


# ─── Response models ──────────────────────────────────────────────


class PluginListItem(BaseModel):
    """Single plugin entry in the list response."""
    name: str
    version: str
    author: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    path: str
    source: str = Field(description="'core' or 'community'")
    node_ids: list[str]
    load_error: Optional[str] = None


class PluginListResponse(BaseModel):
    plugins: list[PluginListItem]
    total: int
    core_count: int
    community_count: int


class ReloadResponse(BaseModel):
    success: bool
    plugin_count: int
    node_count: int
    message: str


class DeleteResponse(BaseModel):
    success: bool
    message: str


class UploadResponse(BaseModel):
    success: bool
    plugin_name: str
    message: str


class UpdateCheckResponse(BaseModel):
    plugin_name: str
    current_version: str
    latest_version: str
    update_available: bool
    message: str


# ─── Helpers ──────────────────────────────────────────────────────


def _classify_source(plugin_path: str) -> str:
    """Return 'core' or 'community' based on parent directory name."""
    p = Path(plugin_path)
    for part in p.parts:
        if part == "community":
            return "community"
        if part == "core":
            return "core"
    return "unknown"


def _to_list_item(name: str, info: Any) -> PluginListItem:
    manifest = info.manifest or {}
    return PluginListItem(
        name=name,
        version=str(manifest.get("version", "?")),
        author=manifest.get("author"),
        description=manifest.get("description"),
        category=manifest.get("category"),
        path=info.path,
        source=_classify_source(info.path),
        node_ids=list(info.node_ids or []),
        load_error=info.load_error,
    )


def _reload_registry() -> PluginRegistry:
    """Rescan plugin directories and rebuild the shared registry in place.

    The old registry instance is kept but its internal dicts are cleared
    and re-populated so that any existing references (in node_types.py
    and execution.py) stay valid after the reload.
    """
    registry = node_types.get_plugin_registry()
    registry.plugins.clear()
    registry.node_classes.clear()
    registry.node_display_names.clear()
    registry._node_to_plugin.clear()

    # Drop cached plugin modules from sys.modules so the next load picks
    # up fresh source (e.g., after upload or edit).
    import sys
    stale = [m for m in sys.modules if m.startswith("mindflow_plugin_")]
    for m in stale:
        del sys.modules[m]

    registry.discover_and_load()
    return registry


# ─── Endpoints ────────────────────────────────────────────────────


@router.get("", response_model=PluginListResponse)
async def list_plugins() -> PluginListResponse:
    """Return the current registry state with per-plugin metadata."""
    registry = node_types.get_plugin_registry()
    items = [_to_list_item(name, info) for name, info in sorted(registry.plugins.items())]
    core_count = sum(1 for i in items if i.source == "core")
    community_count = sum(1 for i in items if i.source == "community")
    return PluginListResponse(
        plugins=items,
        total=len(items),
        core_count=core_count,
        community_count=community_count,
    )


@router.post("/reload", response_model=ReloadResponse)
async def reload_plugins() -> ReloadResponse:
    """Rescan the plugin directories and rebuild the registry."""
    try:
        registry = _reload_registry()
    except Exception as exc:
        logger.exception("Plugin reload failed")
        raise HTTPException(status_code=500, detail=f"Plugin reload failed: {exc}")

    plugin_count = len(registry.plugins)
    node_count = len(registry.node_classes)
    logger.info(
        "Plugins reloaded: %d plugins, %d node types",
        plugin_count,
        node_count,
    )
    return ReloadResponse(
        success=True,
        plugin_count=plugin_count,
        node_count=node_count,
        message=f"Reloaded {plugin_count} plugins, {node_count} node types",
    )


@router.delete("/{plugin_name}", response_model=DeleteResponse)
async def delete_plugin(plugin_name: str) -> DeleteResponse:
    """Remove a community plugin directory from disk and reload.

    Core plugins are protected — delete requests against them return 403.
    """
    registry = node_types.get_plugin_registry()
    info = registry.plugins.get(plugin_name)
    if info is None:
        raise HTTPException(
            status_code=404, detail=f"Plugin '{plugin_name}' is not loaded"
        )

    source = _classify_source(info.path)
    if source != "community":
        raise HTTPException(
            status_code=403,
            detail=(
                f"Plugin '{plugin_name}' is a core plugin and cannot be "
                f"deleted from the UI. Remove it from plugins/core/ manually "
                f"if you really want to."
            ),
        )

    plugin_dir = Path(info.path)
    if not plugin_dir.exists() or not plugin_dir.is_dir():
        raise HTTPException(
            status_code=404,
            detail=f"Plugin directory not found on disk: {info.path}",
        )

    try:
        shutil.rmtree(plugin_dir)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete plugin directory: {exc}",
        )

    _reload_registry()
    logger.info("Deleted community plugin '%s' from %s", plugin_name, info.path)
    return DeleteResponse(
        success=True,
        message=f"Plugin '{plugin_name}' removed and registry reloaded.",
    )


@router.post("/upload", response_model=UploadResponse)
async def upload_plugin(file: UploadFile = File(...)) -> UploadResponse:
    """Upload a .zip archive containing a plugin directory.

    The zip must contain a single top-level directory with an __init__.py
    exposing PLUGIN_MANIFEST and NODE_CLASS_MAPPINGS. It's extracted into
    plugins/community/ and the registry is reloaded.
    """
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=400,
            detail="Plugin upload must be a .zip file",
        )

    content = await file.read()
    try:
        zf = zipfile.ZipFile(BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid zip")

    # Identify the top-level plugin directory from the zip.
    # Must have exactly one top-level dir containing __init__.py.
    top_dirs: set[str] = set()
    has_init = False
    for name in zf.namelist():
        parts = Path(name).parts
        if not parts:
            continue
        top_dirs.add(parts[0])
        if len(parts) == 2 and parts[1] == "__init__.py":
            has_init = True

    if len(top_dirs) != 1:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Plugin zip must contain exactly one top-level directory, "
                f"found {len(top_dirs)}: {sorted(top_dirs)}"
            ),
        )
    if not has_init:
        raise HTTPException(
            status_code=400,
            detail="Plugin zip must contain <name>/__init__.py at its root",
        )

    plugin_name = top_dirs.pop()

    # Resolve community directory from the current registry's plugin_dirs
    registry = node_types.get_plugin_registry()
    community_dir = None
    for d in registry.plugin_dirs:
        if Path(d).name == "community":
            community_dir = Path(d)
            break
    if community_dir is None:
        raise HTTPException(
            status_code=500,
            detail="No community plugins directory configured on the server",
        )
    community_dir.mkdir(parents=True, exist_ok=True)

    target_dir = community_dir / plugin_name
    if target_dir.exists():
        raise HTTPException(
            status_code=409,
            detail=(
                f"A plugin named '{plugin_name}' already exists in "
                f"plugins/community/. Delete it first if you want to replace it."
            ),
        )

    try:
        zf.extractall(community_dir)
    except Exception as exc:
        # Clean up partial extraction
        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to extract zip: {exc}"
        )

    _reload_registry()
    logger.info("Uploaded community plugin '%s' to %s", plugin_name, target_dir)
    return UploadResponse(
        success=True,
        plugin_name=plugin_name,
        message=f"Plugin '{plugin_name}' uploaded and loaded.",
    )


@router.post("/{plugin_name}/update", response_model=UpdateCheckResponse)
async def check_plugin_update(plugin_name: str) -> UpdateCheckResponse:
    """STUB: Check for plugin updates.

    Real implementation would query a registry / git remote. For now this
    endpoint just reports the current version and "no update available"
    so the UI flow can be wired end-to-end before the remote-check logic
    exists.
    """
    registry = node_types.get_plugin_registry()
    info = registry.plugins.get(plugin_name)
    if info is None:
        raise HTTPException(status_code=404, detail=f"Plugin '{plugin_name}' not found")

    current_version = str(info.manifest.get("version", "?"))
    return UpdateCheckResponse(
        plugin_name=plugin_name,
        current_version=current_version,
        latest_version=current_version,
        update_available=False,
        message=(
            "Plugin is up to date. (Note: update checking is not yet "
            "connected to a remote registry — this is a stub.)"
        ),
    )
