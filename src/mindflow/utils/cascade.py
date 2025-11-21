"""Cascade regeneration utilities for MindFlow graphs.

This module provides utilities for cascading node regeneration when a node is modified.
"""

from uuid import UUID
from typing import List, Set, Dict
from collections import deque

from mindflow.models.graph import Graph


def get_descendants(graph: Graph, node_id: UUID) -> Set[UUID]:
    """Get all descendants (children, grandchildren, etc.) of a node.

    Args:
        graph: The graph containing the nodes
        node_id: UUID of the node to get descendants from

    Returns:
        Set of UUIDs representing all descendant nodes

    Example:
        >>> descendants = get_descendants(graph, node_uuid)
        >>> print(f"Found {len(descendants)} descendants")
    """
    if node_id not in graph.nodes:
        return set()

    visited = set()
    queue = deque([node_id])

    while queue:
        current_id = queue.popleft()

        if current_id in visited:
            continue

        visited.add(current_id)

        # Get children of current node
        if current_id in graph.nodes:
            node = graph.nodes[current_id]
            for child_id in node.children:
                if child_id not in visited:
                    queue.append(child_id)

    # Remove the starting node itself from descendants
    visited.discard(node_id)
    return visited


def topological_sort(graph: Graph, node_ids: Set[UUID]) -> List[UUID]:
    """Perform topological sort on a subset of nodes.

    Returns nodes in an order where parents always appear before their children.
    This ensures that when regenerating nodes, parent nodes are processed first.

    Args:
        graph: The graph containing the nodes
        node_ids: Set of node UUIDs to sort

    Returns:
        List of UUIDs in topological order (parents before children)

    Raises:
        ValueError: If a cycle is detected in the subgraph

    Example:
        >>> descendants = get_descendants(graph, modified_node_id)
        >>> sorted_nodes = topological_sort(graph, descendants)
        >>> # Process nodes in order
        >>> for node_id in sorted_nodes:
        ...     regenerate_node(node_id)
    """
    if not node_ids:
        return []

    # Build in-degree map (count of parents within the subset)
    in_degree: Dict[UUID, int] = {}
    for node_id in node_ids:
        if node_id not in graph.nodes:
            continue
        # Count how many parents are in the subset
        node = graph.nodes[node_id]
        in_degree[node_id] = sum(1 for p in node.parents if p in node_ids)

    # Start with nodes that have no parents in the subset
    queue = deque([node_id for node_id, degree in in_degree.items() if degree == 0])
    result = []

    while queue:
        current_id = queue.popleft()
        result.append(current_id)

        # Reduce in-degree for children
        if current_id in graph.nodes:
            node = graph.nodes[current_id]
            for child_id in node.children:
                if child_id in in_degree:
                    in_degree[child_id] -= 1
                    if in_degree[child_id] == 0:
                        queue.append(child_id)

    # Check for cycles
    if len(result) != len(node_ids):
        raise ValueError(
            f"Cycle detected in subgraph: sorted {len(result)} nodes out of {len(node_ids)}"
        )

    return result


def get_affected_nodes(graph: Graph, modified_node_id: UUID) -> List[UUID]:
    """Get all nodes affected by modifying a node, in regeneration order.

    This is a convenience function that combines get_descendants() and topological_sort()
    to return the nodes that need to be regenerated in the correct order.

    Args:
        graph: The graph containing the nodes
        modified_node_id: UUID of the node that was modified

    Returns:
        List of UUIDs in topological order that need regeneration

    Example:
        >>> # User edits a node
        >>> affected = get_affected_nodes(graph, edited_node_id)
        >>> print(f"{len(affected)} nodes will be regenerated")
        >>> for node_id in affected:
        ...     regenerate_with_llm(node_id)
    """
    descendants = get_descendants(graph, modified_node_id)
    if not descendants:
        return []
    return topological_sort(graph, descendants)
