"""Unit tests for Group model.

Tests cover:
- Group creation with required fields
- Hierarchy validation (parent_group)
- Kind types validation
- Metadata (color, pinned_nodes, tags)
- JSON serialization/deserialization
"""

import pytest
from datetime import UTC, datetime
from uuid import UUID, uuid4
from pydantic import ValidationError

from mindflow.models.group import Group, GroupMetadata, GroupKind


class TestGroupMetadata:
    """Tests for GroupMetadata model."""

    def test_metadata_defaults(self) -> None:
        """Test that GroupMetadata has correct default values."""
        meta = GroupMetadata()

        assert meta.color is None
        assert meta.pinned_nodes == []
        assert isinstance(meta.created_at, datetime)
        assert meta.tags == []

    def test_metadata_custom_values(self) -> None:
        """Test GroupMetadata with custom values."""
        now = datetime.now(UTC)
        node_ids = [uuid4(), uuid4()]

        meta = GroupMetadata(
            color="#FF5733",
            pinned_nodes=node_ids,
            created_at=now,
            tags=["important", "work"]
        )

        assert meta.color == "#FF5733"
        assert meta.pinned_nodes == node_ids
        assert meta.created_at == now
        assert meta.tags == ["important", "work"]

    def test_color_format(self) -> None:
        """Test various color format strings."""
        # Valid hex colors
        valid_colors = ["#FF5733", "#000000", "#FFFFFF", "#abc", "#123456"]

        for color in valid_colors:
            meta = GroupMetadata(color=color)
            assert meta.color == color

    def test_pinned_nodes_empty(self) -> None:
        """Test pinned_nodes defaults to empty list."""
        meta = GroupMetadata()
        assert meta.pinned_nodes == []

    def test_pinned_nodes_multiple(self) -> None:
        """Test multiple pinned nodes."""
        node_ids = [uuid4() for _ in range(5)]
        meta = GroupMetadata(pinned_nodes=node_ids)

        assert len(meta.pinned_nodes) == 5
        assert meta.pinned_nodes == node_ids


class TestGroup:
    """Tests for Group model."""

    def test_group_creation_minimal(self) -> None:
        """Test creating group with only required fields."""
        group = Group(
            label="My Project",
            kind="project"
        )

        assert isinstance(group.id, UUID)
        assert group.label == "My Project"
        assert group.kind == "project"
        assert group.parent_group is None
        assert isinstance(group.meta, GroupMetadata)

    def test_group_creation_full(self) -> None:
        """Test creating group with all fields specified."""
        group_id = uuid4()
        parent_id = uuid4()
        now = datetime.now(UTC)

        meta = GroupMetadata(
            color="#00FF00",
            pinned_nodes=[uuid4()],
            created_at=now,
            tags=["test"]
        )

        group = Group(
            id=group_id,
            label="Subgroup",
            kind="subgroup",
            parent_group=parent_id,
            meta=meta
        )

        assert group.id == group_id
        assert group.label == "Subgroup"
        assert group.kind == "subgroup"
        assert group.parent_group == parent_id
        assert group.meta == meta

    def test_group_unique_id_generation(self) -> None:
        """Test that each group gets a unique UUID by default."""
        group1 = Group(label="Group 1", kind="cluster")
        group2 = Group(label="Group 2", kind="cluster")

        assert group1.id != group2.id
        assert isinstance(group1.id, UUID)
        assert isinstance(group2.id, UUID)

    def test_group_kind_validation(self) -> None:
        """Test all valid group kinds are accepted."""
        valid_kinds: list[GroupKind] = ["project", "cluster", "subgroup", "generated", "auto"]

        for kind in valid_kinds:
            group = Group(label="Test Group", kind=kind)
            assert group.kind == kind

    def test_group_invalid_kind(self) -> None:
        """Test invalid group kind raises ValidationError."""
        with pytest.raises(ValidationError):
            Group(label="Test", kind="invalid_kind")  # type: ignore

    def test_label_min_length(self) -> None:
        """Test label must be at least 1 character."""
        with pytest.raises(ValidationError) as exc_info:
            Group(label="", kind="project")

        assert "at least 1 character" in str(exc_info.value)

    def test_label_max_length(self) -> None:
        """Test label cannot exceed 100 characters."""
        long_label = "x" * 101

        with pytest.raises(ValidationError) as exc_info:
            Group(label=long_label, kind="project")

        assert "at most 100 characters" in str(exc_info.value)

    def test_label_boundary_lengths(self) -> None:
        """Test label accepts 1 and 100 characters."""
        group_min = Group(label="x", kind="project")
        group_max = Group(label="x" * 100, kind="project")

        assert len(group_min.label) == 1
        assert len(group_max.label) == 100

    def test_parent_group_none(self) -> None:
        """Test parent_group defaults to None for root groups."""
        group = Group(label="Root Group", kind="project")
        assert group.parent_group is None

    def test_parent_group_set(self) -> None:
        """Test parent_group can be set to UUID."""
        parent_id = uuid4()
        group = Group(label="Child Group", kind="subgroup", parent_group=parent_id)

        assert group.parent_group == parent_id
        assert isinstance(group.parent_group, UUID)

    def test_hierarchy_project_root(self) -> None:
        """Test project groups are typically root-level (no parent)."""
        project = Group(label="My Project", kind="project")
        assert project.parent_group is None
        assert project.kind == "project"

    def test_hierarchy_subgroup_with_parent(self) -> None:
        """Test subgroups can have parent groups."""
        parent_id = uuid4()
        subgroup = Group(
            label="Subgroup",
            kind="subgroup",
            parent_group=parent_id
        )

        assert subgroup.parent_group == parent_id
        assert subgroup.kind == "subgroup"

    def test_cluster_group(self) -> None:
        """Test cluster group type."""
        cluster = Group(label="Research Topics", kind="cluster")

        assert cluster.kind == "cluster"
        assert cluster.parent_group is None

    def test_generated_group(self) -> None:
        """Test auto-generated group types."""
        auto_group = Group(label="Auto Group", kind="auto")
        generated_group = Group(label="Generated Group", kind="generated")

        assert auto_group.kind == "auto"
        assert generated_group.kind == "generated"

    def test_json_serialization(self) -> None:
        """Test group can be serialized to JSON."""
        group = Group(
            label="Test Group",
            kind="cluster"
        )

        json_data = group.model_dump()

        assert json_data["label"] == "Test Group"
        assert json_data["kind"] == "cluster"
        assert json_data["parent_group"] is None
        assert "id" in json_data
        assert "meta" in json_data

    def test_json_deserialization(self) -> None:
        """Test group can be deserialized from JSON."""
        group_id = uuid4()
        parent_id = uuid4()

        json_data = {
            "id": str(group_id),
            "label": "Test Group",
            "kind": "subgroup",
            "parent_group": str(parent_id),
            "meta": {
                "color": "#FF0000",
                "pinned_nodes": [],
                "created_at": "2025-11-17T12:00:00",
                "tags": ["test"]
            }
        }

        group = Group.model_validate(json_data)

        assert group.id == group_id
        assert group.label == "Test Group"
        assert group.kind == "subgroup"
        assert group.parent_group == parent_id
        assert group.meta.color == "#FF0000"
        assert group.meta.tags == ["test"]

    def test_json_round_trip(self) -> None:
        """Test serialization + deserialization preserves data."""
        parent_id = uuid4()

        original = Group(
            label="Test Group",
            kind="subgroup",
            parent_group=parent_id
        )
        original.meta.color = "#123456"
        original.meta.tags = ["tag1", "tag2"]

        json_data = original.model_dump()
        restored = Group.model_validate(json_data)

        assert restored.id == original.id
        assert restored.label == original.label
        assert restored.kind == original.kind
        assert restored.parent_group == original.parent_group
        assert restored.meta.color == original.meta.color
        assert restored.meta.tags == original.meta.tags

    def test_metadata_with_pinned_nodes(self) -> None:
        """Test group metadata with pinned nodes."""
        node_ids = [uuid4(), uuid4(), uuid4()]

        group = Group(label="Pinned Group", kind="cluster")
        group.meta.pinned_nodes = node_ids
        group.meta.color = "#ABCDEF"

        assert len(group.meta.pinned_nodes) == 3
        assert group.meta.pinned_nodes == node_ids
        assert group.meta.color == "#ABCDEF"
