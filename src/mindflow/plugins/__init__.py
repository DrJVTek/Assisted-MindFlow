"""MindFlow Plugin System.

Provides dynamic node type loading inspired by ComfyUI.
Plugins define node types with INPUT_TYPES, RETURN_TYPES, and
self-describing metadata for automatic frontend UI generation.
"""

from mindflow.plugins.base import BaseNode, LLMNode
from mindflow.plugins.types import BUILTIN_TYPES, is_compatible, get_type_definitions

__all__ = [
    "BaseNode",
    "LLMNode",
    "BUILTIN_TYPES",
    "is_compatible",
    "get_type_definitions",
]
