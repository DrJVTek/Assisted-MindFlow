"""Tests: legacy graph JSON auto-migration to v2.0.0 plugin format."""

import pytest

from mindflow.services.graph_migration import migrate_graph_data, LEGACY_TYPE_MAP


class TestLegacyGraphMigration:
    """Verify old type enum values are migrated to class_type."""

    def test_question_type_migrates_to_llm_chat(self):
        """Legacy 'question' type becomes class_type 'llm_chat'."""
        legacy_node = {
            "id": "abc-123",
            "type": "question",
            "content": "What is AI?",
            "position": {"x": 100, "y": 200},
        }
        legacy_graph = {
            "nodes": {"abc-123": legacy_node},
            "edges": [],
        }

        migrated = migrate_graph_data(legacy_graph)

        node = migrated["nodes"]["abc-123"]
        assert node["class_type"] == "llm_chat"
        assert node["content"] == "What is AI?"
        assert migrated["version"] == "2.0.0"

    def test_answer_type_migrates_to_llm_chat(self):
        """Legacy 'answer' type also becomes 'llm_chat'."""
        legacy_graph = {
            "nodes": {
                "n1": {"id": "n1", "type": "answer", "content": "AI is...",
                       "position": {"x": 0, "y": 0}},
            },
            "edges": [],
        }

        migrated = migrate_graph_data(legacy_graph)
        assert migrated["nodes"]["n1"]["class_type"] == "llm_chat"

    def test_note_type_migrates_to_text_input(self):
        """Legacy 'note' type becomes 'text_input'."""
        legacy_graph = {
            "nodes": {
                "n1": {"id": "n1", "type": "note", "content": "My notes",
                       "position": {"x": 0, "y": 0}},
            },
            "edges": [],
        }

        migrated = migrate_graph_data(legacy_graph)
        assert migrated["nodes"]["n1"]["class_type"] == "text_input"

    def test_already_v2_graph_is_unchanged(self):
        """Graph with version 2.0.0 is not re-migrated."""
        v2_graph = {
            "version": "2.0.0",
            "nodes": {
                "n1": {"id": "n1", "class_type": "llm_chat", "content": "hello",
                       "position": {"x": 0, "y": 0}},
            },
            "edges": [],
        }

        migrated = migrate_graph_data(v2_graph)
        assert migrated is v2_graph  # same object, not modified

    def test_preserves_node_content_and_position(self):
        """Migration preserves all existing node data."""
        legacy_graph = {
            "nodes": {
                "n1": {
                    "id": "n1", "type": "question",
                    "content": "Complex question?",
                    "position": {"x": 42, "y": 99},
                    "parents": ["p1"],
                    "metadata": {"key": "value"},
                },
            },
            "edges": [],
        }

        migrated = migrate_graph_data(legacy_graph)
        node = migrated["nodes"]["n1"]
        assert node["content"] == "Complex question?"
        assert node["position"] == {"x": 42, "y": 99}
        assert node["parents"] == ["p1"]
        assert node["metadata"] == {"key": "value"}

    def test_preserves_edges(self):
        """Edges are preserved during migration."""
        legacy_graph = {
            "nodes": {
                "n1": {"id": "n1", "type": "note", "content": "", "position": {"x": 0, "y": 0}},
                "n2": {"id": "n2", "type": "question", "content": "", "position": {"x": 0, "y": 0}},
            },
            "edges": [{"source": "n1", "target": "n2"}],
        }

        migrated = migrate_graph_data(legacy_graph)
        assert migrated["edges"] == [{"source": "n1", "target": "n2"}]

    def test_unknown_legacy_type_maps_to_text_input(self):
        """Unknown legacy types default to text_input."""
        legacy_graph = {
            "nodes": {
                "n1": {"id": "n1", "type": "hypothesis", "content": "",
                       "position": {"x": 0, "y": 0}},
            },
            "edges": [],
        }

        migrated = migrate_graph_data(legacy_graph)
        assert migrated["nodes"]["n1"]["class_type"] == "text_input"

    def test_legacy_type_map_covers_all_known_types(self):
        """All known legacy types have a mapping."""
        known_types = ["question", "answer", "note", "hypothesis", "evaluation", "summary"]
        for t in known_types:
            assert t in LEGACY_TYPE_MAP, f"Missing mapping for legacy type: {t}"
