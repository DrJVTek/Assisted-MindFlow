"""Cycle detection utilities for MindFlow Engine.

This module provides functions to detect cycles in directed graphs,
which is essential for maintaining the DAG (Directed Acyclic Graph) invariant.
"""

from typing import List, Tuple
from uuid import UUID

import networkx as nx


def has_cycle(edges: List[Tuple[UUID, UUID]]) -> bool:
    """Check if a graph has any cycles.

    Args:
        edges: List of directed edges as (parent_id, child_id) tuples

    Returns:
        True if graph contains at least one cycle, False otherwise

    Example:
        >>> a, b, c = uuid4(), uuid4(), uuid4()
        >>> has_cycle([(a, b), (b, c)])  # Linear chain
        False
        >>> has_cycle([(a, b), (b, a)])  # Cycle
        True
    """
    if not edges:
        return False

    graph = nx.DiGraph()
    graph.add_edges_from(edges)

    try:
        # find_cycle raises NetworkXNoCycle if no cycle exists
        nx.find_cycle(graph)
        return True
    except nx.NetworkXNoCycle:
        return False


def find_cycles(edges: List[Tuple[UUID, UUID]]) -> List[List[UUID]]:
    """Find all cycles in a graph.

    Args:
        edges: List of directed edges as (parent_id, child_id) tuples

    Returns:
        List of cycles, where each cycle is a list of node UUIDs forming the cycle

    Note:
        The returned cycles may overlap or share nodes. This returns all
        simple cycles found in the graph.

    Example:
        >>> a, b, c = uuid4(), uuid4(), uuid4()
        >>> find_cycles([(a, b), (b, c), (c, a)])
        [[a, b, c]]
    """
    if not edges:
        return []

    graph = nx.DiGraph()
    graph.add_edges_from(edges)

    try:
        # simple_cycles returns generator of cycles as node lists
        cycles = list(nx.simple_cycles(graph))
        return cycles
    except Exception:
        return []


def is_dag(edges: List[Tuple[UUID, UUID]]) -> bool:
    """Check if a graph is a Directed Acyclic Graph (DAG).

    A DAG has no cycles - it's a fundamental invariant for reasoning graphs.

    Args:
        edges: List of directed edges as (parent_id, child_id) tuples

    Returns:
        True if graph is a DAG (no cycles), False if cycles exist

    Example:
        >>> a, b, c = uuid4(), uuid4(), uuid4()
        >>> is_dag([(a, b), (b, c)])  # Tree structure
        True
        >>> is_dag([(a, b), (b, a)])  # Has cycle
        False
    """
    if not edges:
        return True

    graph = nx.DiGraph()
    graph.add_edges_from(edges)

    return nx.is_directed_acyclic_graph(graph)


def would_create_cycle(
    existing_edges: List[Tuple[UUID, UUID]], parent_id: UUID, child_id: UUID
) -> bool:
    """Check if adding a new edge would create a cycle.

    This is used to validate graph operations before executing them,
    ensuring the DAG invariant is maintained.

    Args:
        existing_edges: Current edges in the graph
        parent_id: Parent node UUID for proposed new edge
        child_id: Child node UUID for proposed new edge

    Returns:
        True if adding (parent_id -> child_id) would create a cycle,
        False if the graph would remain a DAG

    Example:
        >>> a, b, c = uuid4(), uuid4(), uuid4()
        >>> edges = [(a, b), (b, c)]
        >>> would_create_cycle(edges, c, a)  # Would close cycle
        True
        >>> would_create_cycle(edges, a, c)  # Transitive edge, no cycle
        False
    """
    # Self-loops always create cycles
    if parent_id == child_id:
        return True

    # Check if adding this edge would create a cycle
    test_edges = existing_edges + [(parent_id, child_id)]
    return has_cycle(test_edges)
