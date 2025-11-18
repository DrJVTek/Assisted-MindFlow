"""Unit tests for validation utilities.

Tests cover:
- JSON schema validation
- Node reference validation
- Group reference validation
- Edge validation
- Graph integrity checks
"""

import pytest
from uuid import uuid4
from pydantic import ValidationError

from mindflow.models.node import Node
from mindflow.models.group import Group
from mindflow.models.graph import Graph, GraphMetadata
from mindflow.utils.validation import (
    validate_node_references,
    validate_group_references,
    validate_parent_child_consistency,
    validate_graph_integrity,
    ValidationResult,
)


class TestValidationResult:
    """Tests for ValidationResult model."""

    def test_validation_result_valid(self) -> None:
        """Test creating a valid validation result."""
        result = ValidationResult(valid=True, errors=[])
        assert result.valid is True
        assert result.errors == []

    def test_validation_result_invalid(self) -> None:
        """Test creating an invalid validation result with errors."""
        result = ValidationResult(
            valid=False,
            errors=["Error 1", "Error 2"]
        )
        assert result.valid is False
        assert len(result.errors) == 2


class TestNodeReferenceValidation:
    """Tests for node reference validation."""

    def test_validate_empty_graph(self) -> None:
        """Test validation of empty graph."""
        meta = GraphMetadata(name="Empty")
        graph = Graph(meta=meta)

        result = validate_node_references(graph)
        assert result.valid is True
        assert result.errors == []

    def test_validate_single_node_no_refs(self) -> None:
        """Test validation of single node with no references."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        node = Node(type="note", author="human", content="Test")
        graph.nodes[node.id] = node

        result = validate_node_references(graph)
        assert result.valid is True

    def test_validate_valid_parent_child(self) -> None:
        """Test validation of valid parent-child relationship."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        parent = Node(type="question", author="human", content="Q?")
        child = Node(type="answer", author="llm", content="A")

        parent.children.append(child.id)
        child.parents.append(parent.id)

        graph.nodes[parent.id] = parent
        graph.nodes[child.id] = child

        result = validate_node_references(graph)
        assert result.valid is True

    def test_validate_invalid_parent_reference(self) -> None:
        """Test detection of invalid parent reference."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        node = Node(type="note", author="human", content="Test")
        fake_parent_id = uuid4()
        node.parents.append(fake_parent_id)  # Reference non-existent node

        graph.nodes[node.id] = node

        result = validate_node_references(graph)
        assert result.valid is False
        assert len(result.errors) > 0
        assert "parent" in result.errors[0].lower()

    def test_validate_invalid_child_reference(self) -> None:
        """Test detection of invalid child reference."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        node = Node(type="note", author="human", content="Test")
        fake_child_id = uuid4()
        node.children.append(fake_child_id)  # Reference non-existent node

        graph.nodes[node.id] = node

        result = validate_node_references(graph)
        assert result.valid is False
        assert len(result.errors) > 0
        assert "child" in result.errors[0].lower()

    def test_validate_multiple_invalid_references(self) -> None:
        """Test detection of multiple invalid references."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        node = Node(type="note", author="human", content="Test")
        node.parents.append(uuid4())
        node.children.append(uuid4())
        node.children.append(uuid4())

        graph.nodes[node.id] = node

        result = validate_node_references(graph)
        assert result.valid is False
        assert len(result.errors) >= 3


class TestGroupReferenceValidation:
    """Tests for group reference validation."""

    def test_validate_no_groups(self) -> None:
        """Test validation when no groups exist."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        result = validate_group_references(graph)
        assert result.valid is True

    def test_validate_valid_group_hierarchy(self) -> None:
        """Test validation of valid group parent reference."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        parent_group = Group(label="Parent", kind="project")
        child_group = Group(label="Child", kind="subgroup", parent_group=parent_group.id)

        graph.groups[parent_group.id] = parent_group
        graph.groups[child_group.id] = child_group

        result = validate_group_references(graph)
        assert result.valid is True

    def test_validate_invalid_group_parent(self) -> None:
        """Test detection of invalid group parent reference."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        group = Group(label="Test", kind="subgroup", parent_group=uuid4())
        graph.groups[group.id] = group

        result = validate_group_references(graph)
        assert result.valid is False
        assert "parent group" in result.errors[0].lower()

    def test_validate_node_group_membership(self) -> None:
        """Test validation of node group membership."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        group = Group(label="Group", kind="cluster")
        node = Node(type="note", author="human", content="Test")
        node.groups.append(group.id)

        graph.groups[group.id] = group
        graph.nodes[node.id] = node

        result = validate_group_references(graph)
        assert result.valid is True

    def test_validate_invalid_node_group(self) -> None:
        """Test detection of invalid group in node."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        node = Node(type="note", author="human", content="Test")
        node.groups.append(uuid4())  # Non-existent group

        graph.nodes[node.id] = node

        result = validate_group_references(graph)
        assert result.valid is False


class TestParentChildConsistency:
    """Tests for parent-child relationship consistency."""

    def test_validate_consistent_relationship(self) -> None:
        """Test validation of consistent parent-child relationship."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        parent = Node(type="question", author="human", content="Q?")
        child = Node(type="answer", author="llm", content="A")

        parent.children.append(child.id)
        child.parents.append(parent.id)

        graph.nodes[parent.id] = parent
        graph.nodes[child.id] = child

        result = validate_parent_child_consistency(graph)
        assert result.valid is True

    def test_validate_inconsistent_parent_missing_child(self) -> None:
        """Test detection of parent->child edge missing reverse edge."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        parent = Node(type="question", author="human", content="Q?")
        child = Node(type="answer", author="llm", content="A")

        parent.children.append(child.id)
        # Missing: child.parents.append(parent.id)

        graph.nodes[parent.id] = parent
        graph.nodes[child.id] = child

        result = validate_parent_child_consistency(graph)
        assert result.valid is False
        assert "inconsistent" in result.errors[0].lower()

    def test_validate_inconsistent_child_missing_parent(self) -> None:
        """Test detection of child->parent edge missing reverse edge."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        parent = Node(type="question", author="human", content="Q?")
        child = Node(type="answer", author="llm", content="A")

        child.parents.append(parent.id)
        # Missing: parent.children.append(child.id)

        graph.nodes[parent.id] = parent
        graph.nodes[child.id] = child

        result = validate_parent_child_consistency(graph)
        assert result.valid is False

    def test_validate_multiple_relationships(self) -> None:
        """Test validation of complex graph with multiple relationships."""
        meta = GraphMetadata(name="Test")
        graph = Graph(meta=meta)

        nodes = [
            Node(type="question", author="human", content=f"Q{i}")
            for i in range(5)
        ]

        # Create consistent relationships
        for i in range(4):
            nodes[i].children.append(nodes[i + 1].id)
            nodes[i + 1].parents.append(nodes[i].id)

        for node in nodes:
            graph.nodes[node.id] = node

        result = validate_parent_child_consistency(graph)
        assert result.valid is True


class TestGraphIntegrityValidation:
    """Tests for complete graph integrity validation."""

    def test_validate_integrity_valid_graph(self) -> None:
        """Test validation of fully valid graph."""
        meta = GraphMetadata(name="Valid Graph")
        graph = Graph(meta=meta)

        parent = Node(type="question", author="human", content="Q?")
        child = Node(type="answer", author="llm", content="A")
        parent.children.append(child.id)
        child.parents.append(parent.id)

        group = Group(label="Group", kind="cluster")
        parent.groups.append(group.id)

        graph.nodes[parent.id] = parent
        graph.nodes[child.id] = child
        graph.groups[group.id] = group

        result = validate_graph_integrity(graph)
        assert result.valid is True
        assert result.errors == []

    def test_validate_integrity_multiple_errors(self) -> None:
        """Test detection of multiple integrity violations."""
        meta = GraphMetadata(name="Invalid Graph")
        graph = Graph(meta=meta)

        node1 = Node(type="note", author="human", content="Test1")
        node1.parents.append(uuid4())  # Invalid parent
        node1.groups.append(uuid4())  # Invalid group

        node2 = Node(type="note", author="human", content="Test2")
        node2.children.append(node1.id)
        # Missing reverse edge

        graph.nodes[node1.id] = node1
        graph.nodes[node2.id] = node2

        result = validate_graph_integrity(graph)
        assert result.valid is False
        assert len(result.errors) >= 2

    def test_validate_integrity_empty_graph(self) -> None:
        """Test validation of empty graph passes."""
        meta = GraphMetadata(name="Empty")
        graph = Graph(meta=meta)

        result = validate_graph_integrity(graph)
        assert result.valid is True

    def test_validate_integrity_complex_graph(self) -> None:
        """Test validation of complex but valid graph."""
        meta = GraphMetadata(name="Complex")
        graph = Graph(meta=meta)

        # Create a diamond structure
        root = Node(type="question", author="human", content="Root")
        left = Node(type="hypothesis", author="llm", content="Left")
        right = Node(type="hypothesis", author="llm", content="Right")
        bottom = Node(type="evaluation", author="human", content="Bottom")

        root.children.extend([left.id, right.id])
        left.parents.append(root.id)
        right.parents.append(root.id)
        left.children.append(bottom.id)
        right.children.append(bottom.id)
        bottom.parents.extend([left.id, right.id])

        for node in [root, left, right, bottom]:
            graph.nodes[node.id] = node

        result = validate_graph_integrity(graph)
        assert result.valid is True
