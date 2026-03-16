"""Plugin Registry — discovers, loads, and manages node type plugins.

Scans plugin directories at startup, validates manifests and node classes,
and provides a unified registry for all available node types.
"""

import importlib.util
import logging
import sys
from dataclasses import dataclass, field
from importlib.metadata import packages_distributions
from pathlib import Path
from typing import Any, Optional

from mindflow.plugins.base import BaseNode
from mindflow.plugins.types import get_type_definitions

logger = logging.getLogger(__name__)


@dataclass
class PluginInfo:
    """Metadata about a loaded plugin."""
    manifest: dict[str, Any]
    path: str
    node_ids: list[str]
    load_error: Optional[str] = None


# Required manifest fields
REQUIRED_MANIFEST_FIELDS = {"name", "version"}

# Required node class attributes
REQUIRED_NODE_ATTRIBUTES = {"INPUT_TYPES", "RETURN_TYPES", "FUNCTION", "CATEGORY"}


class PluginRegistry:
    """Discovers, loads, and manages plugins.

    Usage:
        registry = PluginRegistry(["plugins/core", "plugins/community"])
        registry.discover_and_load()
        node_info = registry.get_node_info()
    """

    def __init__(self, plugin_dirs: list[str]) -> None:
        self.plugin_dirs = plugin_dirs
        self.plugins: dict[str, PluginInfo] = {}
        self.node_classes: dict[str, type] = {}
        self.node_display_names: dict[str, str] = {}
        # Track which plugin registered each node ID (for conflict detection)
        self._node_to_plugin: dict[str, str] = {}

    def discover_and_load(self) -> None:
        """Scan plugin directories and load all valid plugins."""
        for plugin_dir in self.plugin_dirs:
            dir_path = Path(plugin_dir)
            if not dir_path.exists():
                logger.warning("Plugin directory does not exist: %s", plugin_dir)
                continue

            is_community = dir_path.name == "community"
            dir_label = "community" if is_community else "core"
            candidates = [
                entry for entry in sorted(dir_path.iterdir())
                if entry.is_dir() and (entry / "__init__.py").exists()
            ]

            if not candidates:
                logger.debug("No plugins found in %s directory: %s", dir_label, plugin_dir)
                continue

            for entry in candidates:
                if is_community:
                    logger.warning(
                        "Loading community plugin: %s (full trust)",
                        entry.name,
                    )
                try:
                    self._load_plugin(str(entry))
                except Exception as e:
                    logger.error(
                        "Skipped plugin: %s (reason: %s)", entry.name, e
                    )

    def _load_plugin(self, path: str) -> None:
        """Load a single plugin from a directory."""
        plugin_path = Path(path)
        init_file = plugin_path / "__init__.py"

        # Dynamic import — add parent directory to sys.path so that
        # relative imports within the plugin (e.g., from .nodes import X) work.
        parent_dir = str(plugin_path.parent)
        added_to_path = False
        if parent_dir not in sys.path:
            sys.path.insert(0, parent_dir)
            added_to_path = True

        module_name = f"mindflow_plugin_{plugin_path.name}"
        try:
            spec = importlib.util.spec_from_file_location(
                module_name,
                str(init_file),
                submodule_search_locations=[str(plugin_path)],
            )
            if spec is None or spec.loader is None:
                logger.warning(
                    "Cannot create module spec for %s, skipping", path
                )
                return

            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)
        finally:
            if added_to_path:
                sys.path.remove(parent_dir)

        # Extract manifest
        manifest = getattr(module, "PLUGIN_MANIFEST", None)
        if manifest is None:
            logger.warning(
                "Plugin %s has no PLUGIN_MANIFEST, skipping", plugin_path.name
            )
            return

        # Validate manifest
        missing_fields = REQUIRED_MANIFEST_FIELDS - set(manifest.keys())
        if missing_fields:
            logger.warning(
                "Plugin '%s' missing required manifest fields: %s, skipping",
                plugin_path.name,
                ", ".join(sorted(missing_fields)),
            )
            return

        # Check version compatibility
        mindflow_version = manifest.get("mindflow_version")
        if mindflow_version:
            try:
                from packaging.version import Version
                required = Version(mindflow_version)
                current = Version("1.0.0")  # Current MindFlow version
                if required > current:
                    logger.warning(
                        "Plugin '%s' requires MindFlow >= %s (current: %s), skipping",
                        manifest.get("name", plugin_path.name),
                        mindflow_version,
                        "1.0.0",
                    )
                    return
            except ImportError:
                # packaging not available — skip version check
                pass
            except Exception:
                pass  # Invalid version format — proceed anyway

        # Check pip dependencies
        requires = manifest.get("requires", [])
        if requires:
            missing_deps = self._check_dependencies(requires)
            if missing_deps:
                logger.error(
                    "Plugin '%s' has missing dependencies: %s, skipping",
                    manifest.get("name", plugin_path.name),
                    ", ".join(missing_deps),
                )
                return

        # Extract node class mappings
        mappings = getattr(module, "NODE_CLASS_MAPPINGS", None)
        if not mappings:
            logger.warning(
                "Plugin '%s' has no NODE_CLASS_MAPPINGS, skipping",
                manifest.get("name", plugin_path.name),
            )
            return

        display_names = getattr(module, "NODE_DISPLAY_NAME_MAPPINGS", {})

        plugin_name = manifest["name"]

        # Validate and register each node class
        registered_ids = []
        for node_id, node_class in mappings.items():
            # Check for ID conflicts
            if node_id in self.node_classes:
                existing_plugin = self._node_to_plugin.get(node_id, "unknown")
                logger.error(
                    "Node type ID '%s' from plugin '%s' conflicts with "
                    "plugin '%s'. Rejecting duplicate.",
                    node_id,
                    plugin_name,
                    existing_plugin,
                )
                continue

            # Validate node class
            error = self._validate_node_class(node_id, node_class)
            if error:
                logger.warning(
                    "Node class '%s' in plugin '%s' is invalid: %s, skipping",
                    node_id,
                    plugin_name,
                    error,
                )
                continue

            self.node_classes[node_id] = node_class
            self.node_display_names[node_id] = display_names.get(
                node_id, node_id
            )
            self._node_to_plugin[node_id] = plugin_name
            registered_ids.append(node_id)

        if registered_ids:
            self.plugins[plugin_name] = PluginInfo(
                manifest=manifest,
                path=path,
                node_ids=registered_ids,
            )
            logger.info(
                "Loaded plugin '%s' v%s with node types: %s",
                plugin_name,
                manifest.get("version", "?"),
                ", ".join(registered_ids),
            )

    def _validate_node_class(
        self, node_id: str, node_class: type
    ) -> Optional[str]:
        """Validate a node class has all required attributes.

        Checks:
        - INPUT_TYPES exists and is callable (classmethod)
        - RETURN_TYPES exists and is a tuple
        - FUNCTION exists, is a string, and names a callable method
        - CATEGORY exists and is a string

        Sets defaults for optional attributes:
        - STREAMING = False
        - CATEGORY = "uncategorized" (if missing)
        - UI = {}

        Returns:
            None if valid, error message string if invalid.
        """
        # Check it's a class
        if not isinstance(node_class, type):
            return f"'{node_id}' is not a class"

        # Check required attributes
        missing = []
        for attr in REQUIRED_NODE_ATTRIBUTES:
            if not hasattr(node_class, attr):
                missing.append(attr)

        if missing:
            return f"missing required attributes: {', '.join(missing)}"

        # Validate INPUT_TYPES is callable (classmethod)
        input_types_attr = getattr(node_class, "INPUT_TYPES", None)
        if not callable(input_types_attr):
            return "INPUT_TYPES must be a classmethod"

        # Validate RETURN_TYPES is a tuple
        return_types = getattr(node_class, "RETURN_TYPES", None)
        if not isinstance(return_types, tuple):
            return (
                f"RETURN_TYPES must be a tuple, got {type(return_types).__name__}"
            )

        # Validate FUNCTION is a string pointing to a callable method
        func_name = getattr(node_class, "FUNCTION", None)
        if not isinstance(func_name, str):
            return (
                f"FUNCTION must be a string, got {type(func_name).__name__}"
            )
        if not hasattr(node_class, func_name):
            return f"FUNCTION '{func_name}' method not found on class"
        func_method = getattr(node_class, func_name)
        if not callable(func_method):
            return f"FUNCTION '{func_name}' is not callable"

        # Set defaults for optional attributes
        if not hasattr(node_class, "STREAMING"):
            node_class.STREAMING = False
        if not hasattr(node_class, "UI"):
            node_class.UI = {}

        return None

    @staticmethod
    def _check_dependencies(requires: list[str]) -> list[str]:
        """Check if required pip packages are installed.

        Returns list of missing package names (empty if all satisfied).
        """
        missing = []
        for pkg_name in requires:
            # Normalize package name for importlib lookup
            normalized = pkg_name.lower().replace("-", "_").replace(".", "_")
            try:
                importlib.import_module(normalized)
            except ImportError:
                # Try the original name too (some packages differ)
                try:
                    importlib.import_module(pkg_name)
                except ImportError:
                    missing.append(pkg_name)
        return missing

    def get_node_info(self) -> dict[str, Any]:
        """Return all node definitions for the frontend discovery endpoint.

        Returns:
            Dict with node_types, type_definitions, and categories.
        """
        node_types = {}
        categories_seen: dict[str, str] = {}

        for node_id, node_class in self.node_classes.items():
            try:
                input_types = node_class.INPUT_TYPES()
            except Exception as e:
                logger.error(
                    "Error calling INPUT_TYPES() on '%s': %s", node_id, e
                )
                continue

            category = getattr(node_class, "CATEGORY", "uncategorized")
            ui = getattr(node_class, "UI", {})
            # Track unique categories with icon from first node in category
            cat_root = category.split("/")[0]
            if cat_root not in categories_seen:
                categories_seen[cat_root] = {
                    "display_name": cat_root.replace("_", " ").title(),
                    "icon": ui.get("icon", ""),
                }

            node_types[node_id] = {
                "display_name": self.node_display_names.get(node_id, node_id),
                "category": category,
                "inputs": input_types,
                "return_types": getattr(node_class, "RETURN_TYPES", ()),
                "return_names": getattr(node_class, "RETURN_NAMES", ()),
                "streaming": getattr(node_class, "STREAMING", False),
                "ui": getattr(node_class, "UI", {}),
                "function": getattr(node_class, "FUNCTION", "execute"),
            }

        categories = [
            {
                "name": cat_id,
                "display_name": info["display_name"],
                "icon": info["icon"],
            }
            for cat_id, info in sorted(categories_seen.items())
        ]

        return {
            "node_types": node_types,
            "type_definitions": get_type_definitions(),
            "categories": categories,
        }

    def create_instance(self, node_id: str) -> BaseNode:
        """Instantiate a node by its registered ID.

        Args:
            node_id: The registered node type identifier

        Returns:
            An instance of the node class

        Raises:
            ValueError: If node_id is not registered
        """
        if node_id not in self.node_classes:
            raise ValueError(
                f"Unknown node type: '{node_id}'. "
                f"Available types: {', '.join(sorted(self.node_classes.keys()))}"
            )
        return self.node_classes[node_id]()

    def get_node_class(self, node_id: str) -> Optional[type]:
        """Get the class for a registered node type."""
        return self.node_classes.get(node_id)

    def is_registered(self, node_id: str) -> bool:
        """Check if a node type ID is registered."""
        return node_id in self.node_classes
