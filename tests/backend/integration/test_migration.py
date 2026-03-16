"""Integration test: legacy canvas migration end-to-end."""

import json
from uuid import uuid4

import pytest

from mindflow.services.graph_migration import migrate_graph_data, CURRENT_VERSION


class TestLegacyCanvasMigrationEndToEnd:
    """T078: Load legacy canvas JSON, migrate, verify complete transformation."""

    def test_full_legacy_canvas_migrates_correctly(self):
        """Complete legacy canvas with multiple node types migrates to v2.0.0."""
        q_id = str(uuid4())
        a_id = str(uuid4())
        n_id = str(uuid4())
        h_id = str(uuid4())

        legacy_canvas = {
            "id": str(uuid4()),
            "meta": {
                "name": "Legacy Research Canvas",
                "description": "Created before plugin architecture",
                "created_at": "2024-01-15T10:00:00Z",
                "updated_at": "2024-06-20T14:30:00Z",
                "schema_version": "1.0.0",
            },
            "nodes": {
                q_id: {
                    "id": q_id,
                    "type": "question",
                    "author": "human",
                    "content": "What is quantum computing?",
                    "parents": [],
                    "children": [a_id],
                    "meta": {"position": {"x": 100, "y": 100}},
                },
                a_id: {
                    "id": a_id,
                    "type": "answer",
                    "author": "llm",
                    "content": "Quantum computing uses quantum mechanics...",
                    "parents": [q_id],
                    "children": [n_id],
                    "meta": {"position": {"x": 100, "y": 300}},
                },
                n_id: {
                    "id": n_id,
                    "type": "note",
                    "author": "human",
                    "content": "Important: check decoherence section",
                    "parents": [a_id],
                    "children": [],
                    "meta": {"position": {"x": 100, "y": 500}},
                },
                h_id: {
                    "id": h_id,
                    "type": "hypothesis",
                    "author": "human",
                    "content": "Quantum advantage exists for certain problems",
                    "parents": [],
                    "children": [],
                    "meta": {"position": {"x": 400, "y": 100}},
                },
            },
            "groups": {},
            "comments": {},
        }

        migrated = migrate_graph_data(legacy_canvas)

        # Version stamped
        assert migrated["version"] == CURRENT_VERSION

        # question → llm_chat
        assert migrated["nodes"][q_id]["class_type"] == "llm_chat"
        assert migrated["nodes"][q_id]["content"] == "What is quantum computing?"

        # answer → llm_chat
        assert migrated["nodes"][a_id]["class_type"] == "llm_chat"

        # note → text_input
        assert migrated["nodes"][n_id]["class_type"] == "text_input"

        # hypothesis → text_input
        assert migrated["nodes"][h_id]["class_type"] == "text_input"

        # All relationships preserved
        assert migrated["nodes"][q_id]["children"] == [a_id]
        assert migrated["nodes"][a_id]["parents"] == [q_id]

    def test_already_migrated_canvas_unchanged(self):
        """Canvas with version 2.0.0 is returned as-is."""
        v2_canvas = {
            "version": "2.0.0",
            "nodes": {
                "n1": {"class_type": "llm_chat", "content": "hello"},
            },
        }

        result = migrate_graph_data(v2_canvas)
        assert result is v2_canvas  # Same object reference

    def test_migration_roundtrip_serialization(self):
        """Migrated canvas can be serialized and deserialized without loss."""
        legacy = {
            "nodes": {
                "n1": {
                    "id": "n1",
                    "type": "question",
                    "content": "Test?",
                    "position": {"x": 0, "y": 0},
                },
            },
        }

        migrated = migrate_graph_data(legacy)
        serialized = json.dumps(migrated)
        deserialized = json.loads(serialized)

        assert deserialized["version"] == CURRENT_VERSION
        assert deserialized["nodes"]["n1"]["class_type"] == "llm_chat"
