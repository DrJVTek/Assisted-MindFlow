"""Node Types discovery API endpoint.

Exposes GET /api/node-types for the frontend to dynamically build its UI
from loaded plugin metadata. No hardcoded type lists — everything comes
from the PluginRegistry.
"""

import logging
from typing import Optional

from fastapi import APIRouter

from mindflow.plugins.registry import PluginRegistry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/node-types", tags=["node-types"])

# Singleton — initialized at startup by server.py
_plugin_registry: Optional[PluginRegistry] = None


def set_plugin_registry(registry: PluginRegistry) -> None:
    """Set the global plugin registry (called at startup)."""
    global _plugin_registry
    _plugin_registry = registry


def get_plugin_registry() -> PluginRegistry:
    """Get the global plugin registry.

    Raises:
        RuntimeError: If registry has not been initialized.
    """
    if _plugin_registry is None:
        raise RuntimeError(
            "PluginRegistry not initialized. "
            "Ensure server startup calls set_plugin_registry()."
        )
    return _plugin_registry


@router.get("")
async def get_node_types() -> dict:
    """Return all loaded node type definitions for frontend discovery.

    Response format:
    {
        "node_types": {
            "text_input": {
                "display_name": "Text Input",
                "category": "input",
                "inputs": {"required": {...}, "optional": {...}},
                "return_types": ("STRING",),
                "return_names": ("text",),
                "streaming": false,
                "ui": {"color": "#4A90D9", ...},
                "function": "execute"
            },
            ...
        },
        "type_definitions": {
            "STRING": {"color": "#22C55E", ...},
            ...
        },
        "categories": [
            {"id": "input", "display_name": "Input"},
            ...
        ]
    }
    """
    registry = get_plugin_registry()
    return registry.get_node_info()
