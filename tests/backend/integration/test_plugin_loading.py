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

        # Verify llm_chat metadata
        lc = node_types["llm_chat"]
        assert lc["category"] == "llm"
        assert lc["display_name"] == "LLM Chat"
        assert lc["streaming"] is True
        assert "prompt" in lc["inputs"]["required"]
        assert "model" in lc["inputs"]["required"]


def _is_dependency_available(pkg_name: str) -> bool:
    """Check if a pip package is available for import."""
    import importlib
    normalized = pkg_name.lower().replace("-", "_").replace(".", "_")
    try:
        importlib.import_module(normalized)
        return True
    except ImportError:
        try:
            importlib.import_module(pkg_name)
            return True
        except ImportError:
            return False


# Plugins that may be skipped if their dependencies are not installed
_OPTIONAL_DEPS = {
    "gemini_chat": "google-generativeai",
}


class TestAllLLMProviderPlugins:
    """T035: Verify all LLM provider plugins load and register correctly.

    Plugins whose pip dependencies are not installed are expected to be
    skipped by the registry's dependency checker — those are excluded from
    assertions rather than treated as failures.
    """

    # Base plugins (no exotic deps)
    BASE_PLUGINS = ["text_input", "llm_chat"]

    LLM_PROVIDER_PLUGINS = {
        "openai_chat": {"category_prefix": "llm/openai", "display_contains": "OpenAI"},
        "anthropic_chat": {"category_prefix": "llm/anthropic", "display_contains": "Anthropic"},
        "ollama_chat": {"category_prefix": "llm/ollama", "display_contains": "Ollama"},
        "gemini_chat": {"category_prefix": "llm/gemini", "display_contains": "Gemini"},
        "chatgpt_web_chat": {"category_prefix": "llm/chatgpt", "display_contains": "ChatGPT"},
    }

    @staticmethod
    def _expected_node_ids() -> list[str]:
        """Return node IDs that should be loadable given installed dependencies."""
        ids = ["text_input", "llm_chat", "openai_chat", "anthropic_chat",
               "ollama_chat", "chatgpt_web_chat"]
        for node_id, dep in _OPTIONAL_DEPS.items():
            if _is_dependency_available(dep):
                ids.append(node_id)
        return ids

    def test_all_available_plugins_registered(self):
        """All core plugins whose dependencies are satisfied are registered."""
        registry = PluginRegistry([CORE_PLUGINS_DIR])
        registry.discover_and_load()

        expected = self._expected_node_ids()
        for plugin_id in expected:
            assert plugin_id in registry.node_classes, (
                f"Plugin '{plugin_id}' not found in registry. "
                f"Registered: {list(registry.node_classes.keys())}"
            )

    def test_all_plugins_load_without_errors(self):
        """All loaded plugins have no load errors."""
        registry = PluginRegistry([CORE_PLUGINS_DIR])
        registry.discover_and_load()

        # At least base + providers with available deps
        expected_count = len(self._expected_node_ids())
        # Plugins map may have fewer entries than node IDs (some plugins register multiple nodes)
        assert len(registry.plugins) >= expected_count - 1
        for name, info in registry.plugins.items():
            assert info.load_error is None, (
                f"Plugin '{name}' has load error: {info.load_error}"
            )

    def test_provider_plugins_have_correct_categories(self):
        """Each loaded LLM provider plugin has the correct category prefix."""
        registry = PluginRegistry([CORE_PLUGINS_DIR])
        registry.discover_and_load()

        info = registry.get_node_info()
        node_types = info["node_types"]

        for node_id, expected in self.LLM_PROVIDER_PLUGINS.items():
            if node_id not in node_types:
                # Plugin was skipped due to missing dependency — acceptable
                dep = _OPTIONAL_DEPS.get(node_id)
                if dep and not _is_dependency_available(dep):
                    continue
                pytest.fail(f"Node '{node_id}' missing from node_types (no missing deps)")
            nt = node_types[node_id]
            assert nt["category"].startswith(expected["category_prefix"]), (
                f"Node '{node_id}' category '{nt['category']}' "
                f"doesn't start with '{expected['category_prefix']}'"
            )

    def test_provider_plugins_have_streaming(self):
        """All loaded LLM provider plugins support streaming."""
        registry = PluginRegistry([CORE_PLUGINS_DIR])
        registry.discover_and_load()

        info = registry.get_node_info()
        node_types = info["node_types"]

        for node_id in self.LLM_PROVIDER_PLUGINS:
            if node_id not in node_types:
                continue  # Skipped due to missing dependency
            nt = node_types[node_id]
            assert nt.get("streaming") is True, (
                f"Node '{node_id}' should have streaming=True"
            )

    def test_chatgpt_web_supports_import(self):
        """ChatGPT Web plugin declares import support for conversations/projects."""
        registry = PluginRegistry([CORE_PLUGINS_DIR])
        registry.discover_and_load()

        info = registry.get_node_info()
        node_types = info["node_types"]

        cw = node_types["chatgpt_web_chat"]
        assert cw["ui"].get("supports_import") is True
        assert "conversations" in cw["ui"].get("import_types", [])
        assert "projects" in cw["ui"].get("import_types", [])


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
