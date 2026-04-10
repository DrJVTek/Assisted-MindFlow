"""Tests for PluginRegistry — discovery, validation, conflict detection."""

import os
import tempfile
import textwrap
from pathlib import Path

import pytest

from mindflow.plugins.registry import PluginRegistry


def _create_plugin(
    base_dir: str,
    name: str,
    manifest: str,
    nodes_code: str,
    init_extra: str = "",
) -> str:
    """Helper: create a plugin directory with __init__.py and nodes.py."""
    plugin_dir = Path(base_dir) / name
    plugin_dir.mkdir(parents=True, exist_ok=True)

    nodes_file = plugin_dir / "nodes.py"
    nodes_file.write_text(textwrap.dedent(nodes_code))

    init_file = plugin_dir / "__init__.py"
    init_content = textwrap.dedent(manifest) + "\n" + textwrap.dedent(init_extra)
    init_file.write_text(init_content)

    return str(plugin_dir)


VALID_NODE_CODE = '''\
from mindflow.plugins.base import BaseNode

class TestNode(BaseNode):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"multiline": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("output",)
    FUNCTION = "execute"
    CATEGORY = "test"

    async def execute(self, text):
        return (text,)
'''

VALID_MANIFEST = '''\
from .nodes import TestNode

PLUGIN_MANIFEST = {
    "name": "Test Plugin",
    "version": "1.0.0",
}

NODE_CLASS_MAPPINGS = {
    "test_node": TestNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "test_node": "Test Node",
}
'''


class TestPluginDiscovery:
    """Test plugin discovery and loading."""

    def test_discovers_valid_plugin(self, tmp_path: Path):
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(plugin_dir)
        _create_plugin(plugin_dir, "my_plugin", VALID_MANIFEST, VALID_NODE_CODE)

        registry = PluginRegistry([plugin_dir])
        registry.discover_and_load()

        assert "test_node" in registry.node_classes
        assert registry.node_display_names["test_node"] == "Test Node"
        assert "Test Plugin" in registry.plugins

    def test_skips_directory_without_init_py(self, tmp_path: Path):
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(os.path.join(plugin_dir, "no_init_plugin"))

        registry = PluginRegistry([plugin_dir])
        registry.discover_and_load()

        assert len(registry.node_classes) == 0
        assert len(registry.plugins) == 0

    def test_skips_plugin_without_manifest(self, tmp_path: Path):
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(plugin_dir)
        _create_plugin(
            plugin_dir,
            "no_manifest",
            'NODE_CLASS_MAPPINGS = {}\n',
            VALID_NODE_CODE,
        )

        registry = PluginRegistry([plugin_dir])
        registry.discover_and_load()

        assert len(registry.plugins) == 0

    def test_skips_plugin_with_missing_manifest_fields(self, tmp_path: Path):
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(plugin_dir)

        incomplete_manifest = '''\
from .nodes import TestNode

PLUGIN_MANIFEST = {
    "name": "Incomplete",
    # missing "version"
}

NODE_CLASS_MAPPINGS = {
    "test_node": TestNode,
}
'''
        _create_plugin(
            plugin_dir, "incomplete", incomplete_manifest, VALID_NODE_CODE
        )

        registry = PluginRegistry([plugin_dir])
        registry.discover_and_load()

        assert len(registry.plugins) == 0

    def test_skips_nonexistent_plugin_directory(self):
        registry = PluginRegistry(["/nonexistent/path"])
        registry.discover_and_load()  # should not raise

        assert len(registry.plugins) == 0


class TestPluginValidation:
    """Test node class validation."""

    def test_rejects_node_missing_required_attributes(self, tmp_path: Path):
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(plugin_dir)

        bad_node_code = '''\
class BadNode:
    """Missing INPUT_TYPES, RETURN_TYPES, FUNCTION, CATEGORY."""
    pass
'''
        bad_manifest = '''\
from .nodes import BadNode

PLUGIN_MANIFEST = {"name": "Bad Plugin", "version": "1.0.0"}
NODE_CLASS_MAPPINGS = {"bad_node": BadNode}
'''
        _create_plugin(plugin_dir, "bad_plugin", bad_manifest, bad_node_code)

        registry = PluginRegistry([plugin_dir])
        registry.discover_and_load()

        assert "bad_node" not in registry.node_classes

    def test_rejects_node_with_non_tuple_return_types(self, tmp_path: Path):
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(plugin_dir)

        bad_return_code = '''\
from mindflow.plugins.base import BaseNode

class BadReturnNode(BaseNode):
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ["STRING"]  # list instead of tuple
    RETURN_NAMES = ("out",)
    FUNCTION = "execute"
    CATEGORY = "test"

    async def execute(self):
        return ("ok",)
'''
        bad_return_manifest = '''\
from .nodes import BadReturnNode

PLUGIN_MANIFEST = {"name": "Bad Return", "version": "1.0.0"}
NODE_CLASS_MAPPINGS = {"bad_return_node": BadReturnNode}
'''
        _create_plugin(
            plugin_dir, "bad_return", bad_return_manifest, bad_return_code
        )

        registry = PluginRegistry([plugin_dir])
        registry.discover_and_load()

        assert "bad_return_node" not in registry.node_classes

    def test_sets_default_streaming_false(self, tmp_path: Path):
        """Optional attrs get defaults when missing."""
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(plugin_dir)

        # VALID_NODE_CODE's TestNode doesn't set STREAMING explicitly
        # (it inherits from BaseNode which sets STREAMING=False)
        _create_plugin(plugin_dir, "my_plugin", VALID_MANIFEST, VALID_NODE_CODE)

        registry = PluginRegistry([plugin_dir])
        registry.discover_and_load()

        info = registry.get_node_info()
        assert info["node_types"]["test_node"]["streaming"] is False

    def test_rejects_node_with_invalid_function_ref(self, tmp_path: Path):
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(plugin_dir)

        bad_func_code = '''\
from mindflow.plugins.base import BaseNode

class BadFuncNode(BaseNode):
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("out",)
    FUNCTION = "nonexistent_method"
    CATEGORY = "test"
'''
        bad_func_manifest = '''\
from .nodes import BadFuncNode

PLUGIN_MANIFEST = {"name": "Bad Func", "version": "1.0.0"}
NODE_CLASS_MAPPINGS = {"bad_func_node": BadFuncNode}
'''
        _create_plugin(
            plugin_dir, "bad_func", bad_func_manifest, bad_func_code
        )

        registry = PluginRegistry([plugin_dir])
        registry.discover_and_load()

        assert "bad_func_node" not in registry.node_classes


class TestPluginConflicts:
    """Test node type ID conflict detection."""

    def test_rejects_duplicate_node_id(self, tmp_path: Path):
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(plugin_dir)

        # Create two plugins that both register "test_node"
        _create_plugin(
            plugin_dir, "plugin_a", VALID_MANIFEST, VALID_NODE_CODE
        )

        manifest_b = '''\
from .nodes import TestNode

PLUGIN_MANIFEST = {
    "name": "Plugin B",
    "version": "1.0.0",
}

NODE_CLASS_MAPPINGS = {
    "test_node": TestNode,  # same ID as plugin_a
}
'''
        _create_plugin(plugin_dir, "plugin_b", manifest_b, VALID_NODE_CODE)

        registry = PluginRegistry([plugin_dir])
        registry.discover_and_load()

        # First plugin wins, second is rejected
        assert "test_node" in registry.node_classes
        assert registry._node_to_plugin["test_node"] == "Test Plugin"

    def test_duplicate_node_id_names_both_plugins(self, tmp_path: Path, caplog):
        """Conflict error message must name BOTH conflicting plugins."""
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(plugin_dir)

        _create_plugin(plugin_dir, "first_plugin", VALID_MANIFEST, VALID_NODE_CODE)

        manifest_dup = '''\
from .nodes import TestNode

PLUGIN_MANIFEST = {
    "name": "Duplicate Plugin",
    "version": "1.0.0",
}

NODE_CLASS_MAPPINGS = {
    "test_node": TestNode,
}
'''
        _create_plugin(plugin_dir, "second_plugin", manifest_dup, VALID_NODE_CODE)

        import logging
        with caplog.at_level(logging.ERROR):
            registry = PluginRegistry([plugin_dir])
            registry.discover_and_load()

        # Error log must name both plugins
        conflict_logs = [r for r in caplog.records if "conflicts" in r.message.lower()]
        assert len(conflict_logs) >= 1
        msg = conflict_logs[0].message
        assert "Test Plugin" in msg
        assert "Duplicate Plugin" in msg


class TestNodeInfo:
    """Test get_node_info() for frontend discovery."""

    def test_returns_complete_node_info(self, tmp_path: Path):
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(plugin_dir)
        _create_plugin(plugin_dir, "my_plugin", VALID_MANIFEST, VALID_NODE_CODE)

        registry = PluginRegistry([plugin_dir])
        registry.discover_and_load()

        info = registry.get_node_info()

        assert "node_types" in info
        assert "type_definitions" in info
        assert "categories" in info

        node = info["node_types"]["test_node"]
        assert node["display_name"] == "Test Node"
        assert node["category"] == "test"
        assert node["streaming"] is False
        assert "required" in node["inputs"]
        assert node["return_types"] == ("STRING",)


class TestCorePluginDiscovery:
    """Test discover_and_load() against actual core plugins."""

    def test_discovers_all_core_plugins(self):
        """All core plugins with satisfied dependencies load correctly."""
        from pathlib import Path

        root = Path(__file__).resolve().parents[3]
        core_dir = str(root / "plugins" / "core")

        registry = PluginRegistry([core_dir])
        registry.discover_and_load()

        # After spec 015 Étape 5, only two core plugins exist:
        # text_input (raw input) and llm_chat (generic LLM, provider-agnostic).
        # The provider-specific plugins (openai, anthropic, etc.) were deleted
        # because their execute logic was identical to llm_chat — they only
        # differed by hardcoded model lists, violating FR-014.
        assert len(registry.plugins) >= 2
        assert len(registry.node_classes) >= 2

        expected_always = {"text_input", "llm_chat"}
        for name in expected_always:
            assert name in registry.plugins, f"Plugin '{name}' should always load"

    def test_invalid_plugin_skipped_others_still_load(self, tmp_path: Path):
        """A plugin with no NODE_CLASS_MAPPINGS is skipped; others load."""
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(plugin_dir)

        # Create a valid plugin
        _create_plugin(plugin_dir, "good_plugin", VALID_MANIFEST, VALID_NODE_CODE)

        # Create an invalid plugin (no NODE_CLASS_MAPPINGS)
        bad_dir = Path(plugin_dir) / "bad_plugin"
        bad_dir.mkdir()
        (bad_dir / "__init__.py").write_text(
            'PLUGIN_MANIFEST = {"name": "Bad", "version": "1.0.0"}\n'
        )
        (bad_dir / "nodes.py").write_text("")

        registry = PluginRegistry([plugin_dir])
        registry.discover_and_load()

        # Good plugin loaded, bad one skipped
        assert "test_node" in registry.node_classes
        assert len(registry.plugins) == 1


class TestCreateInstance:
    """Test node instantiation."""

    def test_creates_valid_instance(self, tmp_path: Path):
        plugin_dir = str(tmp_path / "plugins")
        os.makedirs(plugin_dir)
        _create_plugin(plugin_dir, "my_plugin", VALID_MANIFEST, VALID_NODE_CODE)

        registry = PluginRegistry([plugin_dir])
        registry.discover_and_load()

        instance = registry.create_instance("test_node")
        assert instance is not None
        assert hasattr(instance, "execute")

    def test_raises_on_unknown_node_type(self):
        registry = PluginRegistry([])
        with pytest.raises(ValueError, match="Unknown node type"):
            registry.create_instance("nonexistent")
