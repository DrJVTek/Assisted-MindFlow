"""Unit tests for cycle detection utility.

Tests cover:
- Simple cycles (A -> B -> A)
- Complex cycles (multiple nodes in cycle)
- DAG validation (no cycles)
- Self-loops detection
- Multiple independent cycles
- Transitive cycles
"""

import pytest
from uuid import uuid4

from mindflow.utils.cycles import (
    has_cycle,
    find_cycles,
    is_dag,
    would_create_cycle,
)


class TestSimpleCycles:
    """Tests for simple cycle detection."""

    def test_no_cycle_empty_graph(self) -> None:
        """Test empty graph has no cycles."""
        edges = []
        assert not has_cycle(edges)
        assert is_dag(edges)

    def test_no_cycle_single_node(self) -> None:
        """Test single node with no edges has no cycles."""
        edges = []
        assert not has_cycle(edges)

    def test_no_cycle_linear_chain(self) -> None:
        """Test linear chain A -> B -> C has no cycles."""
        a, b, c = uuid4(), uuid4(), uuid4()
        edges = [(a, b), (b, c)]

        assert not has_cycle(edges)
        assert is_dag(edges)

    def test_simple_cycle_two_nodes(self) -> None:
        """Test cycle A -> B -> A is detected."""
        a, b = uuid4(), uuid4()
        edges = [(a, b), (b, a)]

        assert has_cycle(edges)
        assert not is_dag(edges)

    def test_self_loop(self) -> None:
        """Test self-loop A -> A is detected as cycle."""
        a = uuid4()
        edges = [(a, a)]

        assert has_cycle(edges)
        assert not is_dag(edges)

    def test_simple_cycle_three_nodes(self) -> None:
        """Test cycle A -> B -> C -> A is detected."""
        a, b, c = uuid4(), uuid4(), uuid4()
        edges = [(a, b), (b, c), (c, a)]

        assert has_cycle(edges)
        assert not is_dag(edges)


class TestComplexCycles:
    """Tests for complex cycle scenarios."""

    def test_cycle_in_larger_graph(self) -> None:
        """Test cycle detection in graph with multiple branches."""
        a, b, c, d, e = uuid4(), uuid4(), uuid4(), uuid4(), uuid4()
        edges = [
            (a, b),
            (b, c),
            (c, d),
            (d, b),  # Cycle: b -> c -> d -> b
            (a, e),
        ]

        assert has_cycle(edges)
        assert not is_dag(edges)

    def test_multiple_independent_cycles(self) -> None:
        """Test detection when multiple separate cycles exist."""
        a, b, c, d = uuid4(), uuid4(), uuid4(), uuid4()
        edges = [
            # Cycle 1: a -> b -> a
            (a, b),
            (b, a),
            # Cycle 2: c -> d -> c
            (c, d),
            (d, c),
        ]

        assert has_cycle(edges)
        assert not is_dag(edges)

    def test_diamond_pattern_no_cycle(self) -> None:
        """Test diamond pattern (A -> B,C -> D) has no cycles."""
        a, b, c, d = uuid4(), uuid4(), uuid4(), uuid4()
        edges = [(a, b), (a, c), (b, d), (c, d)]

        assert not has_cycle(edges)
        assert is_dag(edges)

    def test_transitive_connections_no_cycle(self) -> None:
        """Test graph with transitive edges but no cycles."""
        a, b, c = uuid4(), uuid4(), uuid4()
        edges = [
            (a, b),
            (b, c),
            (a, c),  # Transitive edge, but no cycle
        ]

        assert not has_cycle(edges)
        assert is_dag(edges)

    def test_long_cycle(self) -> None:
        """Test cycle with many nodes A -> B -> C -> D -> E -> A."""
        nodes = [uuid4() for _ in range(5)]
        edges = [(nodes[i], nodes[i + 1]) for i in range(4)]
        edges.append((nodes[4], nodes[0]))  # Close the cycle

        assert has_cycle(edges)
        assert not is_dag(edges)


class TestFindCycles:
    """Tests for finding all cycles in a graph."""

    def test_find_no_cycles(self) -> None:
        """Test find_cycles returns empty list for DAG."""
        a, b, c = uuid4(), uuid4(), uuid4()
        edges = [(a, b), (b, c)]

        cycles = find_cycles(edges)
        assert cycles == []

    def test_find_simple_cycle(self) -> None:
        """Test find_cycles detects simple cycle."""
        a, b = uuid4(), uuid4()
        edges = [(a, b), (b, a)]

        cycles = find_cycles(edges)
        assert len(cycles) > 0
        assert any(a in cycle and b in cycle for cycle in cycles)

    def test_find_self_loop(self) -> None:
        """Test find_cycles detects self-loop."""
        a = uuid4()
        edges = [(a, a)]

        cycles = find_cycles(edges)
        assert len(cycles) > 0
        assert any(a in cycle for cycle in cycles)

    def test_find_cycle_in_complex_graph(self) -> None:
        """Test find_cycles in graph with cycle and branches."""
        a, b, c, d = uuid4(), uuid4(), uuid4(), uuid4()
        edges = [
            (a, b),
            (b, c),
            (c, a),  # Cycle
            (b, d),  # Branch (no cycle)
        ]

        cycles = find_cycles(edges)
        assert len(cycles) > 0


class TestWouldCreateCycle:
    """Tests for checking if adding an edge would create a cycle."""

    def test_would_not_create_cycle_empty_graph(self) -> None:
        """Test adding first edge to empty graph creates no cycle."""
        a, b = uuid4(), uuid4()
        edges = []

        assert not would_create_cycle(edges, a, b)

    def test_would_not_create_cycle_extending_chain(self) -> None:
        """Test extending chain A -> B with B -> C creates no cycle."""
        a, b, c = uuid4(), uuid4(), uuid4()
        edges = [(a, b)]

        assert not would_create_cycle(edges, b, c)

    def test_would_create_cycle_closing_loop(self) -> None:
        """Test adding edge to close loop creates cycle."""
        a, b, c = uuid4(), uuid4(), uuid4()
        edges = [(a, b), (b, c)]

        # Adding c -> a would create cycle
        assert would_create_cycle(edges, c, a)

    def test_would_create_cycle_self_loop(self) -> None:
        """Test adding self-loop would create cycle."""
        a = uuid4()
        edges = []

        assert would_create_cycle(edges, a, a)

    def test_would_create_cycle_reversing_edge(self) -> None:
        """Test reversing existing edge creates cycle."""
        a, b = uuid4(), uuid4()
        edges = [(a, b)]

        # Adding b -> a would create cycle
        assert would_create_cycle(edges, b, a)

    def test_would_not_create_cycle_diamond(self) -> None:
        """Test completing diamond pattern creates no cycle."""
        a, b, c, d = uuid4(), uuid4(), uuid4(), uuid4()
        edges = [(a, b), (a, c), (b, d)]

        # Adding c -> d completes diamond, no cycle
        assert not would_create_cycle(edges, c, d)

    def test_would_create_cycle_long_path(self) -> None:
        """Test adding edge that closes long path creates cycle."""
        nodes = [uuid4() for _ in range(5)]
        edges = [(nodes[i], nodes[i + 1]) for i in range(4)]

        # Adding nodes[4] -> nodes[0] would close cycle
        assert would_create_cycle(edges, nodes[4], nodes[0])


class TestDAGValidation:
    """Tests for DAG validation."""

    def test_is_dag_empty(self) -> None:
        """Test empty graph is a DAG."""
        assert is_dag([])

    def test_is_dag_tree(self) -> None:
        """Test tree structure is a DAG."""
        a, b, c, d = uuid4(), uuid4(), uuid4(), uuid4()
        edges = [(a, b), (a, c), (b, d)]

        assert is_dag(edges)

    def test_not_dag_with_cycle(self) -> None:
        """Test graph with cycle is not a DAG."""
        a, b = uuid4(), uuid4()
        edges = [(a, b), (b, a)]

        assert not is_dag(edges)

    def test_is_dag_complex_valid(self) -> None:
        """Test complex graph without cycles is a DAG."""
        nodes = [uuid4() for _ in range(6)]
        edges = [
            (nodes[0], nodes[1]),
            (nodes[0], nodes[2]),
            (nodes[1], nodes[3]),
            (nodes[2], nodes[3]),
            (nodes[3], nodes[4]),
            (nodes[2], nodes[5]),
        ]

        assert is_dag(edges)

    def test_not_dag_complex_with_cycle(self) -> None:
        """Test complex graph with hidden cycle is not a DAG."""
        nodes = [uuid4() for _ in range(6)]
        edges = [
            (nodes[0], nodes[1]),
            (nodes[1], nodes[2]),
            (nodes[2], nodes[3]),
            (nodes[3], nodes[4]),
            (nodes[4], nodes[1]),  # Cycle back to node 1
            (nodes[0], nodes[5]),
        ]

        assert not is_dag(edges)


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_disconnected_components(self) -> None:
        """Test graph with disconnected components, all DAGs."""
        a, b, c, d = uuid4(), uuid4(), uuid4(), uuid4()
        edges = [
            # Component 1
            (a, b),
            # Component 2 (separate)
            (c, d),
        ]

        assert is_dag(edges)
        assert not has_cycle(edges)

    def test_single_edge(self) -> None:
        """Test graph with single edge is a DAG."""
        a, b = uuid4(), uuid4()
        edges = [(a, b)]

        assert is_dag(edges)
        assert not has_cycle(edges)

    def test_multiple_edges_same_direction(self) -> None:
        """Test multiple edges from A to different nodes."""
        a = uuid4()
        targets = [uuid4() for _ in range(5)]
        edges = [(a, t) for t in targets]

        assert is_dag(edges)
        assert not has_cycle(edges)
