"""Unit tests for Comment model.

Tests cover:
- Comment creation with required fields
- Attachment to nodes and edges
- Content validation
- Author validation
- JSON serialization/deserialization
"""

import pytest
from datetime import UTC, datetime
from uuid import UUID, uuid4
from pydantic import ValidationError

from mindflow.models.comment import Comment
from mindflow.models.node import NodeAuthor


class TestComment:
    """Tests for Comment model."""

    def test_comment_creation_node_attachment(self) -> None:
        """Test creating comment attached to a node."""
        node_id = uuid4()

        comment = Comment(
            author="human",
            content="This is a great point!",
            attached_to={"node_id": node_id}
        )

        assert isinstance(comment.id, UUID)
        assert comment.author == "human"
        assert comment.content == "This is a great point!"
        assert comment.attached_to == {"node_id": node_id}
        assert isinstance(comment.created_at, datetime)

    def test_comment_creation_edge_attachment(self) -> None:
        """Test creating comment attached to an edge."""
        parent_id = uuid4()
        child_id = uuid4()

        comment = Comment(
            author="llm",
            content="This connection is weak",
            attached_to={"edge": (parent_id, child_id)}
        )

        assert isinstance(comment.id, UUID)
        assert comment.author == "llm"
        assert comment.content == "This connection is weak"
        assert comment.attached_to == {"edge": (parent_id, child_id)}

    def test_comment_unique_id_generation(self) -> None:
        """Test that each comment gets a unique UUID by default."""
        node_id = uuid4()

        comment1 = Comment(
            author="human",
            content="First comment",
            attached_to={"node_id": node_id}
        )
        comment2 = Comment(
            author="human",
            content="Second comment",
            attached_to={"node_id": node_id}
        )

        assert comment1.id != comment2.id
        assert isinstance(comment1.id, UUID)
        assert isinstance(comment2.id, UUID)

    def test_comment_author_validation(self) -> None:
        """Test all valid authors are accepted."""
        node_id = uuid4()
        valid_authors: list[NodeAuthor] = ["human", "llm", "tool"]

        for author in valid_authors:
            comment = Comment(
                author=author,
                content="Test comment",
                attached_to={"node_id": node_id}
            )
            assert comment.author == author

    def test_comment_invalid_author(self) -> None:
        """Test invalid author raises ValidationError."""
        node_id = uuid4()

        with pytest.raises(ValidationError):
            Comment(
                author="robot",  # type: ignore
                content="Test",
                attached_to={"node_id": node_id}
            )

    def test_content_min_length(self) -> None:
        """Test content must be at least 1 character."""
        node_id = uuid4()

        with pytest.raises(ValidationError) as exc_info:
            Comment(
                author="human",
                content="",
                attached_to={"node_id": node_id}
            )

        assert "at least 1 character" in str(exc_info.value)

    def test_content_max_length(self) -> None:
        """Test content cannot exceed 5000 characters."""
        node_id = uuid4()
        long_content = "x" * 5001

        with pytest.raises(ValidationError) as exc_info:
            Comment(
                author="human",
                content=long_content,
                attached_to={"node_id": node_id}
            )

        assert "at most 5000 characters" in str(exc_info.value)

    def test_content_boundary_lengths(self) -> None:
        """Test content accepts 1 and 5000 characters."""
        node_id = uuid4()

        comment_min = Comment(
            author="human",
            content="x",
            attached_to={"node_id": node_id}
        )
        comment_max = Comment(
            author="human",
            content="x" * 5000,
            attached_to={"node_id": node_id}
        )

        assert len(comment_min.content) == 1
        assert len(comment_max.content) == 5000

    def test_node_attachment_structure(self) -> None:
        """Test node attachment uses correct dict structure."""
        node_id = uuid4()

        comment = Comment(
            author="human",
            content="Comment on node",
            attached_to={"node_id": node_id}
        )

        assert "node_id" in comment.attached_to
        assert comment.attached_to["node_id"] == node_id
        assert isinstance(comment.attached_to["node_id"], UUID)

    def test_edge_attachment_structure(self) -> None:
        """Test edge attachment uses correct dict structure."""
        parent_id = uuid4()
        child_id = uuid4()

        comment = Comment(
            author="llm",
            content="Comment on edge",
            attached_to={"edge": (parent_id, child_id)}
        )

        assert "edge" in comment.attached_to
        assert comment.attached_to["edge"] == (parent_id, child_id)
        assert len(comment.attached_to["edge"]) == 2  # type: ignore
        assert comment.attached_to["edge"][0] == parent_id  # type: ignore
        assert comment.attached_to["edge"][1] == child_id  # type: ignore

    def test_edge_tuple_both_uuids(self) -> None:
        """Test edge attachment has both parent and child UUIDs."""
        parent_id = uuid4()
        child_id = uuid4()

        comment = Comment(
            author="human",
            content="Edge comment",
            attached_to={"edge": (parent_id, child_id)}
        )

        edge_tuple = comment.attached_to["edge"]  # type: ignore
        assert isinstance(edge_tuple[0], UUID)
        assert isinstance(edge_tuple[1], UUID)

    def test_json_serialization_node_attachment(self) -> None:
        """Test comment with node attachment serializes to JSON."""
        node_id = uuid4()

        comment = Comment(
            author="human",
            content="Test comment",
            attached_to={"node_id": node_id}
        )

        json_data = comment.model_dump()

        assert json_data["author"] == "human"
        assert json_data["content"] == "Test comment"
        assert "node_id" in json_data["attached_to"]
        assert "id" in json_data
        assert "created_at" in json_data

    def test_json_serialization_edge_attachment(self) -> None:
        """Test comment with edge attachment serializes to JSON."""
        parent_id = uuid4()
        child_id = uuid4()

        comment = Comment(
            author="llm",
            content="Edge comment",
            attached_to={"edge": (parent_id, child_id)}
        )

        json_data = comment.model_dump()

        assert json_data["author"] == "llm"
        assert json_data["content"] == "Edge comment"
        assert "edge" in json_data["attached_to"]

    def test_json_deserialization_node_attachment(self) -> None:
        """Test comment with node attachment deserializes from JSON."""
        comment_id = uuid4()
        node_id = uuid4()

        json_data = {
            "id": str(comment_id),
            "author": "human",
            "content": "Test comment",
            "attached_to": {"node_id": str(node_id)},
            "created_at": "2025-11-17T12:00:00"
        }

        comment = Comment.model_validate(json_data)

        assert comment.id == comment_id
        assert comment.author == "human"
        assert comment.content == "Test comment"
        assert comment.attached_to["node_id"] == node_id

    def test_json_deserialization_edge_attachment(self) -> None:
        """Test comment with edge attachment deserializes from JSON."""
        comment_id = uuid4()
        parent_id = uuid4()
        child_id = uuid4()

        json_data = {
            "id": str(comment_id),
            "author": "tool",
            "content": "Edge comment",
            "attached_to": {"edge": [str(parent_id), str(child_id)]},
            "created_at": "2025-11-17T12:00:00"
        }

        comment = Comment.model_validate(json_data)

        assert comment.id == comment_id
        assert comment.author == "tool"
        assert comment.content == "Edge comment"

    def test_json_round_trip_node(self) -> None:
        """Test serialization + deserialization preserves node attachment."""
        node_id = uuid4()

        original = Comment(
            author="human",
            content="Original comment",
            attached_to={"node_id": node_id}
        )

        json_data = original.model_dump()
        restored = Comment.model_validate(json_data)

        assert restored.id == original.id
        assert restored.author == original.author
        assert restored.content == original.content
        assert restored.attached_to["node_id"] == original.attached_to["node_id"]

    def test_json_round_trip_edge(self) -> None:
        """Test serialization + deserialization preserves edge attachment."""
        parent_id = uuid4()
        child_id = uuid4()

        original = Comment(
            author="llm",
            content="Edge comment",
            attached_to={"edge": (parent_id, child_id)}
        )

        json_data = original.model_dump()
        restored = Comment.model_validate(json_data)

        assert restored.id == original.id
        assert restored.author == original.author
        assert restored.content == original.content
        assert restored.attached_to["edge"] == original.attached_to["edge"]

    def test_multiple_comments_same_node(self) -> None:
        """Test multiple comments can attach to the same node."""
        node_id = uuid4()

        comments = [
            Comment(
                author="human",
                content=f"Comment {i}",
                attached_to={"node_id": node_id}
            )
            for i in range(3)
        ]

        # All comments have different IDs
        ids = [c.id for c in comments]
        assert len(ids) == len(set(ids))

        # All attached to same node
        for comment in comments:
            assert comment.attached_to["node_id"] == node_id
