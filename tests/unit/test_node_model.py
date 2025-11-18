"""Unit tests for Node model.

Tests cover:
- Node creation with required fields
- Default values (UUID, lists, metadata)
- Validation rules (content length, importance range)
- update_timestamp method
- JSON serialization/deserialization
"""

import pytest
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4
from pydantic import ValidationError

from mindflow.models.node import Node, NodeMetadata, NodeType, NodeAuthor, NodeStatus


class TestNodeMetadata:
    """Tests for NodeMetadata model."""

    def test_metadata_defaults(self) -> None:
        """Test that NodeMetadata has correct default values."""
        meta = NodeMetadata()

        assert isinstance(meta.created_at, datetime)
        assert isinstance(meta.updated_at, datetime)
        assert meta.importance == 0.5
        assert meta.tags == []
        assert meta.status == "draft"
        assert meta.stop is False

    def test_metadata_custom_values(self) -> None:
        """Test NodeMetadata with custom values."""
        now = datetime.now(UTC)
        meta = NodeMetadata(
            created_at=now,
            updated_at=now,
            importance=0.8,
            tags=["important", "review"],
            status="valid",
            stop=True
        )

        assert meta.created_at == now
        assert meta.updated_at == now
        assert meta.importance == 0.8
        assert meta.tags == ["important", "review"]
        assert meta.status == "valid"
        assert meta.stop is True

    def test_importance_validation_min(self) -> None:
        """Test importance cannot be < 0.0."""
        with pytest.raises(ValidationError) as exc_info:
            NodeMetadata(importance=-0.1)

        assert "greater than or equal to 0" in str(exc_info.value)

    def test_importance_validation_max(self) -> None:
        """Test importance cannot be > 1.0."""
        with pytest.raises(ValidationError) as exc_info:
            NodeMetadata(importance=1.1)

        assert "less than or equal to 1" in str(exc_info.value)

    def test_importance_boundary_values(self) -> None:
        """Test importance accepts 0.0 and 1.0."""
        meta_min = NodeMetadata(importance=0.0)
        meta_max = NodeMetadata(importance=1.0)

        assert meta_min.importance == 0.0
        assert meta_max.importance == 1.0

    def test_status_validation(self) -> None:
        """Test status accepts only valid literals."""
        valid_statuses: list[NodeStatus] = ["draft", "valid", "invalid", "final", "experimental"]

        for status in valid_statuses:
            meta = NodeMetadata(status=status)
            assert meta.status == status

    def test_invalid_status(self) -> None:
        """Test invalid status raises ValidationError."""
        with pytest.raises(ValidationError):
            NodeMetadata(status="unknown")  # type: ignore


class TestNode:
    """Tests for Node model."""

    def test_node_creation_minimal(self) -> None:
        """Test creating node with only required fields."""
        node = Node(
            type="question",
            author="human",
            content="What is the meaning of life?"
        )

        assert isinstance(node.id, UUID)
        assert node.type == "question"
        assert node.author == "human"
        assert node.content == "What is the meaning of life?"
        assert node.parents == []
        assert node.children == []
        assert node.groups == []
        assert isinstance(node.meta, NodeMetadata)

    def test_node_creation_full(self) -> None:
        """Test creating node with all fields specified."""
        node_id = uuid4()
        parent_id = uuid4()
        child_id = uuid4()
        group_id = uuid4()
        now = datetime.now(UTC)

        meta = NodeMetadata(
            created_at=now,
            updated_at=now,
            importance=0.9,
            tags=["critical"],
            status="valid",
            stop=False
        )

        node = Node(
            id=node_id,
            type="hypothesis",
            author="llm",
            content="The answer is 42",
            parents=[parent_id],
            children=[child_id],
            groups=[group_id],
            meta=meta
        )

        assert node.id == node_id
        assert node.type == "hypothesis"
        assert node.author == "llm"
        assert node.content == "The answer is 42"
        assert node.parents == [parent_id]
        assert node.children == [child_id]
        assert node.groups == [group_id]
        assert node.meta == meta

    def test_node_unique_id_generation(self) -> None:
        """Test that each node gets a unique UUID by default."""
        node1 = Node(type="note", author="human", content="First")
        node2 = Node(type="note", author="human", content="Second")

        assert node1.id != node2.id
        assert isinstance(node1.id, UUID)
        assert isinstance(node2.id, UUID)

    def test_node_types_validation(self) -> None:
        """Test all valid node types are accepted."""
        valid_types: list[NodeType] = [
            "question", "answer", "note", "hypothesis",
            "evaluation", "summary", "plan", "group_meta",
            "comment", "stop"
        ]

        for node_type in valid_types:
            node = Node(type=node_type, author="human", content="Test")
            assert node.type == node_type

    def test_node_invalid_type(self) -> None:
        """Test invalid node type raises ValidationError."""
        with pytest.raises(ValidationError):
            Node(type="invalid_type", author="human", content="Test")  # type: ignore

    def test_node_author_validation(self) -> None:
        """Test all valid authors are accepted."""
        valid_authors: list[NodeAuthor] = ["human", "llm", "tool"]

        for author in valid_authors:
            node = Node(type="note", author=author, content="Test")
            assert node.author == author

    def test_node_invalid_author(self) -> None:
        """Test invalid author raises ValidationError."""
        with pytest.raises(ValidationError):
            Node(type="note", author="robot", content="Test")  # type: ignore

    def test_content_min_length(self) -> None:
        """Test content must be at least 1 character."""
        with pytest.raises(ValidationError) as exc_info:
            Node(type="note", author="human", content="")

        assert "at least 1 character" in str(exc_info.value)

    def test_content_max_length(self) -> None:
        """Test content cannot exceed 10000 characters."""
        long_content = "x" * 10001

        with pytest.raises(ValidationError) as exc_info:
            Node(type="note", author="human", content=long_content)

        assert "at most 10000 characters" in str(exc_info.value)

    def test_content_boundary_lengths(self) -> None:
        """Test content accepts 1 and 10000 characters."""
        node_min = Node(type="note", author="human", content="x")
        node_max = Node(type="note", author="human", content="x" * 10000)

        assert len(node_min.content) == 1
        assert len(node_max.content) == 10000

    def test_update_timestamp(self) -> None:
        """Test update_timestamp updates meta.updated_at."""
        node = Node(type="note", author="human", content="Original")
        original_updated = node.meta.updated_at

        # Wait a tiny bit to ensure different timestamp
        import time
        time.sleep(0.01)

        node.update_timestamp()

        assert node.meta.updated_at > original_updated

    def test_update_timestamp_does_not_change_created(self) -> None:
        """Test update_timestamp doesn't modify created_at."""
        node = Node(type="note", author="human", content="Original")
        original_created = node.meta.created_at

        import time
        time.sleep(0.01)

        node.update_timestamp()

        assert node.meta.created_at == original_created

    def test_multiple_parents(self) -> None:
        """Test node can have multiple parents."""
        parent_ids = [uuid4() for _ in range(3)]
        node = Node(
            type="answer",
            author="human",
            content="Answer",
            parents=parent_ids
        )

        assert len(node.parents) == 3
        assert node.parents == parent_ids

    def test_multiple_children(self) -> None:
        """Test node can have multiple children."""
        child_ids = [uuid4() for _ in range(5)]
        node = Node(
            type="question",
            author="human",
            content="Question",
            children=child_ids
        )

        assert len(node.children) == 5
        assert node.children == child_ids

    def test_multiple_groups(self) -> None:
        """Test node can belong to multiple groups."""
        group_ids = [uuid4() for _ in range(4)]
        node = Node(
            type="note",
            author="human",
            content="Note",
            groups=group_ids
        )

        assert len(node.groups) == 4
        assert node.groups == group_ids

    def test_json_serialization(self) -> None:
        """Test node can be serialized to JSON."""
        node = Node(
            type="hypothesis",
            author="llm",
            content="Test hypothesis"
        )

        json_data = node.model_dump()

        assert json_data["type"] == "hypothesis"
        assert json_data["author"] == "llm"
        assert json_data["content"] == "Test hypothesis"
        assert "id" in json_data
        assert "meta" in json_data

    def test_json_deserialization(self) -> None:
        """Test node can be deserialized from JSON."""
        node_id = uuid4()
        json_data = {
            "id": str(node_id),
            "type": "answer",
            "author": "human",
            "content": "Test answer",
            "parents": [],
            "children": [],
            "groups": [],
            "meta": {
                "created_at": "2025-11-17T12:00:00",
                "updated_at": "2025-11-17T12:00:00",
                "importance": 0.7,
                "tags": ["test"],
                "status": "draft",
                "stop": False
            }
        }

        node = Node.model_validate(json_data)

        assert node.id == node_id
        assert node.type == "answer"
        assert node.author == "human"
        assert node.content == "Test answer"
        assert node.meta.importance == 0.7
        assert node.meta.tags == ["test"]

    def test_json_round_trip(self) -> None:
        """Test serialization + deserialization preserves data."""
        original = Node(
            type="evaluation",
            author="llm",
            content="Evaluation result",
            parents=[uuid4()],
            children=[uuid4(), uuid4()],
            groups=[uuid4()]
        )

        json_data = original.model_dump()
        restored = Node.model_validate(json_data)

        assert restored.id == original.id
        assert restored.type == original.type
        assert restored.author == original.author
        assert restored.content == original.content
        assert restored.parents == original.parents
        assert restored.children == original.children
        assert restored.groups == original.groups
        assert restored.meta.importance == original.meta.importance
