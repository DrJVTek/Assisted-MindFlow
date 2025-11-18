"""Validation utilities for MindFlow Engine.

This module provides functions to validate graph integrity, including
reference validation and relationship consistency.
"""

from typing import List
from pydantic import BaseModel, Field

from mindflow.models.graph import Graph


class ValidationResult(BaseModel):
    """Result of a validation check.

    Attributes:
        valid: True if validation passed, False otherwise
        errors: List of error messages (empty if valid)
    """

    valid: bool
    errors: List[str] = Field(default_factory=list)


def validate_node_references(graph: Graph) -> ValidationResult:
    """Validate that all node references point to existing nodes.

    Checks:
    - All parent references exist in graph.nodes
    - All child references exist in graph.nodes

    Args:
        graph: Graph to validate

    Returns:
        ValidationResult with errors if any references are invalid

    Example:
        >>> result = validate_node_references(graph)
        >>> if not result.valid:
        ...     print(f"Errors: {result.errors}")
    """
    errors = []

    for node_id, node in graph.nodes.items():
        # Check parent references
        for parent_id in node.parents:
            if parent_id not in graph.nodes:
                errors.append(
                    f"Node {node_id} references non-existent parent {parent_id}"
                )

        # Check child references
        for child_id in node.children:
            if child_id not in graph.nodes:
                errors.append(
                    f"Node {node_id} references non-existent child {child_id}"
                )

    return ValidationResult(valid=len(errors) == 0, errors=errors)


def validate_group_references(graph: Graph) -> ValidationResult:
    """Validate that all group references are valid.

    Checks:
    - Group parent_group references exist in graph.groups
    - Node group memberships reference existing groups

    Args:
        graph: Graph to validate

    Returns:
        ValidationResult with errors if any group references are invalid

    Example:
        >>> result = validate_group_references(graph)
        >>> assert result.valid
    """
    errors = []

    # Check group parent references
    for group_id, group in graph.groups.items():
        if group.parent_group is not None:
            if group.parent_group not in graph.groups:
                errors.append(
                    f"Group {group_id} references non-existent parent group {group.parent_group}"
                )

    # Check node group memberships
    for node_id, node in graph.nodes.items():
        for group_id in node.groups:
            if group_id not in graph.groups:
                errors.append(
                    f"Node {node_id} references non-existent group {group_id}"
                )

    return ValidationResult(valid=len(errors) == 0, errors=errors)


def validate_parent_child_consistency(graph: Graph) -> ValidationResult:
    """Validate parent-child relationship consistency.

    Ensures bidirectional consistency:
    - If A has B in children, then B must have A in parents
    - If B has A in parents, then A must have B in children

    Args:
        graph: Graph to validate

    Returns:
        ValidationResult with errors if relationships are inconsistent

    Example:
        >>> result = validate_parent_child_consistency(graph)
        >>> if not result.valid:
        ...     print("Parent-child relationships are inconsistent!")
    """
    errors = []

    for node_id, node in graph.nodes.items():
        # Check forward consistency: children should have this node as parent
        for child_id in node.children:
            if child_id in graph.nodes:
                child = graph.nodes[child_id]
                if node_id not in child.parents:
                    errors.append(
                        f"Node {node_id} has {child_id} as child, "
                        f"but {child_id} doesn't have {node_id} as parent (inconsistent)"
                    )

        # Check backward consistency: parents should have this node as child
        for parent_id in node.parents:
            if parent_id in graph.nodes:
                parent = graph.nodes[parent_id]
                if node_id not in parent.children:
                    errors.append(
                        f"Node {node_id} has {parent_id} as parent, "
                        f"but {parent_id} doesn't have {node_id} as child (inconsistent)"
                    )

    return ValidationResult(valid=len(errors) == 0, errors=errors)


def validate_graph_integrity(graph: Graph) -> ValidationResult:
    """Perform complete graph integrity validation.

    Runs all validation checks:
    - Node reference validation
    - Group reference validation
    - Parent-child consistency

    Args:
        graph: Graph to validate

    Returns:
        ValidationResult combining all validation errors

    Example:
        >>> result = validate_graph_integrity(graph)
        >>> if result.valid:
        ...     print("Graph integrity OK!")
        >>> else:
        ...     for error in result.errors:
        ...         print(f"ERROR: {error}")
    """
    all_errors = []

    # Validate node references
    node_result = validate_node_references(graph)
    all_errors.extend(node_result.errors)

    # Validate group references
    group_result = validate_group_references(graph)
    all_errors.extend(group_result.errors)

    # Validate parent-child consistency
    consistency_result = validate_parent_child_consistency(graph)
    all_errors.extend(consistency_result.errors)

    return ValidationResult(valid=len(all_errors) == 0, errors=all_errors)
