"""Integration tests: plugin discovery and loading from real plugin directories."""

import pytest
from pathlib import Path

from mindflow.plugins.registry import PluginRegistry


# Path to the actual core plugins
CORE_PLUGINS_DIR = str(Path(__file__).resolve().parents[3] / "plugins" / "core")


class TestCorePluginDiscovery:
    """Verify that real core plugins are discovered and loaded correctly."""

    def test_discovers_text_input_plugin(self):
        """text_input plugin folder is discovered and registered at startup."""
        registry = PluginRegistry([CORE_PLUGINS_DIR])
        registry.discover_and_load()

        assert "text_input" in registry.node_classes
        assert registry.is_registered("text_input")

        # Check the plugin info
        assert "text_input" in registry.plugins
        info = registry.plugins["text_input"]
        assert info.manifest["name"] == "text_input"
        assert info.manifest["version"] == "1.0.0"
        assert "text_input" in info.node_ids

    def test_discovers_llm_chat_plugin(self):
        """llm_chat plugin folder is discovered and registered at startup."""
        registry = PluginRegistry([CORE_PLUGINS_DIR])
        registry.discover_and_load()

        assert "llm_chat" in registry.node_classes
        assert registry.is_registered("llm_chat")

        info = registry.plugins["llm_chat"]
        assert info.manifest["name"] == "llm_chat"
        assert "llm_chat" in info.node_ids

    def test_all_core_plugins_load_without_errors(self):
        """All core plugins load successfully — no errors, no skips."""
        registry = PluginRegistry([CORE_PLUGINS_DIR])
        registry.discover_and_load()

        # We expect at least text_input and llm_chat
        assert len(registry.plugins) >= 2
        for plugin_info in registry.plugins.values():
            assert plugin_info.load_error is None

    def test_node_info_contains_all_core_plugins(self):
        """get_node_info() returns metadata for all core plugins."""
        registry = PluginRegistry([CORE_PLUGINS_DIR])
        registry.discover_and_load()

        info = registry.get_node_info()
        node_types = info["node_types"]

        assert "text_input" in node_types
        assert "llm_chat" in node_types

        # Verify text_input metadata
        ti = node_types["text_input"]
        assert ti["category"] == "input"
        assert ti["display_name"] == "Text Input"
        assert "required" in ti["inputs"]
        assert "text" in ti["inputs"]["required"]

        # Verify llm_chat metadata.
        # Post spec 015 hotfix: `prompt` moved from required to optional so
        # advanced users can override the typed content with a connection
        # without making the port mandatory. Only `model` stays required
        # (prompt falls back to node.content in the orchestrator).
        lc = node_types["llm_chat"]
        assert lc["category"] == "llm"
        assert lc["display_name"] == "LLM Chat"
        assert lc["streaming"] is True
        assert "model" in lc["inputs"]["required"]
        assert "prompt" in lc["inputs"]["optional"]


class TestCorePluginsLoad:
    """Verify the core plugins (text_input + generic llm_chat) load correctly.

    Spec 015 Étape 5 deleted the provider-specific plugins (openai_chat,
    anthropic_chat, ollama_chat, gemini_chat, chatgpt_web_chat) in favor
    of a single generic `llm_chat` node that takes any provider via its
    provider_id credential. The execute/stream logic was identical across
    all five specific nodes anyway — they only differed by hardcoded model
    lists and brand colors, which violated FR-014 (no hardcode).
    """

    BASE_PLUGINS = ["text_input", "llm_chat"]

    def test_base_plugins_registered(self):
        """text_input and llm_chat load and register."""
        registry = PluginRegistry([CORE_PLUGINS_DIR])
        registry.discover_and_load()

        for plugin_id in self.BASE_PLUGINS:
            assert plugin_id in registry.node_classes, (
                f"Plugin '{plugin_id}' not found in registry. "
                f"Registered: {list(registry.node_classes.keys())}"
            )

    def test_base_plugins_load_without_errors(self):
        """No plugin has a load error after discovery."""
        registry = PluginRegistry([CORE_PLUGINS_DIR])
        registry.discover_and_load()

        for name, info in registry.plugins.items():
            assert info.load_error is None, (
                f"Plugin '{name}' has load error: {info.load_error}"
            )

    def test_llm_chat_is_generic_and_streaming(self):
        """llm_chat has no hardcoded model list and supports streaming."""
        registry = PluginRegistry([CORE_PLUGINS_DIR])
        registry.discover_and_load()

        info = registry.get_node_info()
        node_types = info["node_types"]

        nt = node_types["llm_chat"]
        assert nt.get("streaming") is True
        assert nt["category"] == "llm"

        # Model COMBO exists but has no hardcoded options — options are
        # populated dynamically from the selected provider's list_models().
        model_spec = nt["inputs"]["required"]["model"]
        assert model_spec[0] == "COMBO"
        assert model_spec[1]["options"] == []


class TestPluginWithMissingManifest:
    """Plugin with missing manifest fields is skipped with warning."""

    def test_missing_manifest_fields_skipped(self, tmp_path):
        """Plugin with incomplete manifest is skipped gracefully."""
        bad_plugin = tmp_path / "bad_plugin"
        bad_plugin.mkdir()
        (bad_plugin / "__init__.py").write_text(
            'PLUGIN_MANIFEST = {"name": "bad"}\n'  # missing "version"
            'NODE_CLASS_MAPPINGS = {}\n'
        )

        registry = PluginRegistry([str(tmp_path)])
        registry.discover_and_load()

        assert "bad" not in registry.plugins
        assert len(registry.node_classes) == 0
