"""Unit tests for Graph model.

Tests cover:
- Graph creation with metadata
- Adding/accessing nodes, groups, comments
- JSON serialization/deserialization with to_json/from_json
- Graph metadata (name, description, timestamps, version)
"""

import pytest
import json
from datetime import UTC, datetime
from uuid import UUID, uuid4
from pydantic import ValidationError

from mindflow.models.graph import Graph, GraphMetadata
from mindflow.models.node import Node
from mindflow.models.group import Group
from mindflow.models.comment import Comment


class TestGraphMetadata:
    """Tests for GraphMetadata model."""

    def test_metadata_minimal(self) -> None:
        """Test GraphMetadata with only required fields."""
        meta = GraphMetadata(name="My Graph")

        assert meta.name == "My Graph"
        assert meta.description is None
        assert isinstance(meta.created_at, datetime)
        assert isinstance(meta.updated_at, datetime)
        assert meta.schema_version == "1.0.0"

    def test_metadata_full(self) -> None:
        """Test GraphMetadata with all fields."""
        now = datetime.now(UTC)

        meta = GraphMetadata(
            name="Research Project",
            description="A graph for my research",
            created_at=now,
            updated_at=now,
            schema_version="1.0.0"
        )

        assert meta.name == "Research Project"
        assert meta.description == "A graph for my research"
        assert meta.created_at == now
        assert meta.updated_at == now
        assert meta.schema_version == "1.0.0"

    def test_schema_version_default(self) -> None:
        """Test schema_version defaults to 1.0.0."""
        meta = GraphMetadata(name="Test")
        assert meta.schema_version == "1.0.0"


class TestGraph:
    """Tests for Graph model."""

    def test_graph_creation_minimal(self) -> None:
        """Test creating graph with minimal metadata."""
        meta = GraphMetadata(name="Empty Graph")
        graph = Graph(meta=meta)

        assert isinstance(graph.id, UUID)
        assert graph.meta.name == "Empty Graph"
        assert graph.nodes == {}
        assert graph.groups == {}
        assert graph.comments == {}

    def test_graph_unique_id_generation(self) -> None:
        """Test that each graph gets a unique UUID."""
        meta1 = GraphMetadata(name="Graph 1")
        meta2 = GraphMetadata(name="Graph 2")

        graph1 = Graph(meta=meta1)
        graph2 = Graph(meta=meta2)

        assert graph1.id != graph2.id
        assert isinstance(graph1.id, UUID)
        assert isinstance(graph2.id, UUID)

    def test_graph_with_nodes(self) -> None:
        """Test graph can contain nodes in dict."""
        meta = GraphMetadata(name="Graph with Nodes")
        graph = Graph(meta=meta)

        node1 = Node(type="question", author="human", content="Question 1")
        node2 = Node(type="answer", author="llm", content="Answer 1")

        graph.nodes[node1.id] = node1
        graph.nodes[node2.id] = node2

        assert len(graph.nodes) == 2
        assert graph.nodes[node1.id] == node1
        assert graph.nodes[node2.id] == node2

    def test_graph_with_groups(self) -> None:
        """Test graph can contain groups in dict."""
        meta = GraphMetadata(name="Graph with Groups")
        graph = Graph(meta=meta)

        group1 = Group(label="Project", kind="project")
        group2 = Group(label="Cluster", kind="cluster")

        graph.groups[group1.id] = group1
        graph.groups[group2.id] = group2

        assert len(graph.groups) == 2
        assert graph.groups[group1.id] == group1
        assert graph.groups[group2.id] == group2

    def test_graph_with_comments(self) -> None:
        """Test graph can contain comments in dict."""
        meta = GraphMetadata(name="Graph with Comments")
        graph = Graph(meta=meta)

        node_id = uuid4()
        comment1 = Comment(
            author="human",
            content="Comment 1",
            attached_to={"node_id": node_id}
        )
        comment2 = Comment(
            author="llm",
            content="Comment 2",
            attached_to={"node_id": node_id}
        )

        graph.comments[comment1.id] = comment1
        graph.comments[comment2.id] = comment2

        assert len(graph.comments) == 2
        assert graph.comments[comment1.id] == comment1
        assert graph.comments[comment2.id] == comment2

    def test_graph_with_all_entities(self) -> None:
        """Test graph containing nodes, groups, and comments."""
        meta = GraphMetadata(name="Full Graph")
        graph = Graph(meta=meta)

        # Add nodes
        node = Node(type="note", author="human", content="Test note")
        graph.nodes[node.id] = node

        # Add groups
        group = Group(label="Test Group", kind="cluster")
        graph.groups[group.id] = group

        # Add comments
        comment = Comment(
            author="human",
            content="Test comment",
            attached_to={"node_id": node.id}
        )
        graph.comments[comment.id] = comment

        assert len(graph.nodes) == 1
        assert len(graph.groups) == 1
        assert len(graph.comments) == 1

    def test_to_json_empty_graph(self) -> None:
        """Test to_json serializes empty graph."""
        meta = GraphMetadata(name="Empty")
        graph = Graph(meta=meta)

        json_str = graph.to_json()

        assert isinstance(json_str, str)
        assert '"name": "Empty"' in json_str
        assert '"nodes": {}' in json_str
        assert '"groups": {}' in json_str
        assert '"comments": {}' in json_str

    def test_to_json_with_nodes(self) -> None:
        """Test to_json serializes graph with nodes."""
        meta = GraphMetadata(name="Graph")
        graph = Graph(meta=meta)

        node = Node(type="question", author="human", content="Test?")
        graph.nodes[node.id] = node

        json_str = graph.to_json()

        assert isinstance(json_str, str)
        assert str(node.id) in json_str
        assert '"type": "question"' in json_str
        assert '"content": "Test?"' in json_str

    def test_from_json_empty_graph(self) -> None:
        """Test from_json deserializes empty graph."""
        json_str = """{
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "meta": {
                "name": "Test Graph",
                "description": null,
                "created_at": "2025-11-17T12:00:00",
                "updated_at": "2025-11-17T12:00:00",
                "schema_version": "1.0.0"
            },
            "nodes": {},
            "groups": {},
            "comments": {}
        }"""

        graph = Graph.from_json(json_str)

        assert isinstance(graph, Graph)
        assert graph.meta.name == "Test Graph"
        assert graph.nodes == {}
        assert graph.groups == {}
        assert graph.comments == {}

    def test_from_json_with_nodes(self) -> None:
        """Test from_json deserializes graph with nodes."""
        node_id = uuid4()
        json_str = f"""{{
            "id": "{uuid4()}",
            "meta": {{
                "name": "Test",
                "description": null,
                "created_at": "2025-11-17T12:00:00",
                "updated_at": "2025-11-17T12:00:00",
                "schema_version": "1.0.0"
            }},
            "nodes": {{
                "{node_id}": {{
                    "id": "{node_id}",
                    "type": "question",
                    "author": "human",
                    "content": "Test question?",
                    "parents": [],
                    "children": [],
                    "groups": [],
                    "meta": {{
                        "created_at": "2025-11-17T12:00:00",
                        "updated_at": "2025-11-17T12:00:00",
                        "importance": 0.5,
                        "tags": [],
                        "status": "draft",
                        "stop": false
                    }}
                }}
            }},
            "groups": {{}},
            "comments": {{}}
        }}"""

        graph = Graph.from_json(json_str)

        assert len(graph.nodes) == 1
        assert node_id in graph.nodes
        assert graph.nodes[node_id].content == "Test question?"

    def test_json_round_trip_empty(self) -> None:
        """Test JSON serialization + deserialization for empty graph."""
        meta = GraphMetadata(name="Round Trip Test")
        original = Graph(meta=meta)

        json_str = original.to_json()
        restored = Graph.from_json(json_str)

        assert restored.id == original.id
        assert restored.meta.name == original.meta.name
        assert restored.nodes == {}
        assert restored.groups == {}
        assert restored.comments == {}

    def test_json_round_trip_with_data(self) -> None:
        """Test JSON round trip preserves all data."""
        meta = GraphMetadata(
            name="Full Graph",
            description="Test description"
        )
        original = Graph(meta=meta)

        # Add node
        node = Node(type="note", author="human", content="Test note")
        original.nodes[node.id] = node

        # Add group
        group = Group(label="Test Group", kind="cluster")
        original.groups[group.id] = group

        # Add comment
        comment = Comment(
            author="llm",
            content="Test comment",
            attached_to={"node_id": node.id}
        )
        original.comments[comment.id] = comment

        # Round trip
        json_str = original.to_json()
        restored = Graph.from_json(json_str)

        assert restored.id == original.id
        assert restored.meta.name == original.meta.name
        assert restored.meta.description == original.meta.description
        assert len(restored.nodes) == 1
        assert len(restored.groups) == 1
        assert len(restored.comments) == 1
        assert restored.nodes[node.id].content == "Test note"
        assert restored.groups[group.id].label == "Test Group"
        assert restored.comments[comment.id].content == "Test comment"

    def test_json_formatting(self) -> None:
        """Test that to_json produces properly indented JSON."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        json_str = graph.to_json()

        # Should be pretty-printed with indentation
        assert "\n" in json_str
        assert "  " in json_str  # Indentation present

        # Should be valid JSON
        parsed = json.loads(json_str)
        assert parsed["meta"]["name"] == "Test"

    def test_empty_collections_default(self) -> None:
        """Test that collections default to empty dicts."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        assert isinstance(graph.nodes, dict)
        assert isinstance(graph.groups, dict)
        assert isinstance(graph.comments, dict)
        assert len(graph.nodes) == 0
        assert len(graph.groups) == 0
        assert len(graph.comments) == 0

    def test_graph_with_relationships(self) -> None:
        """Test graph with parent-child node relationships."""
        meta = GraphMetadata(name="Graph with Relationships")
        graph = Graph(meta=meta)

        # Create parent-child relationship
        parent = Node(type="question", author="human", content="Parent?")
        child = Node(type="answer", author="llm", content="Child answer")

        parent.children.append(child.id)
        child.parents.append(parent.id)

        graph.nodes[parent.id] = parent
        graph.nodes[child.id] = child

        # Verify relationship
        assert child.id in graph.nodes[parent.id].children
        assert parent.id in graph.nodes[child.id].parents

    def test_graph_with_node_groups(self) -> None:
        """Test nodes can belong to groups."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        group = Group(label="Research", kind="cluster")
        node = Node(type="note", author="human", content="Note")
        node.groups.append(group.id)

        graph.groups[group.id] = group
        graph.nodes[node.id] = node

        assert group.id in graph.nodes[node.id].groups
        assert node.id in graph.nodes
        assert group.id in graph.groups
