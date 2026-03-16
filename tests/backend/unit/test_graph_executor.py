"""Tests: graph execution engine — topological sort, cycle detection, error propagation."""

import asyncio
from uuid import uuid4

import pytest

from mindflow.engine.executor import GraphExecutor, CycleDetectedError


class TestTopologicalSort:
    """T049: Topological sort returns correct execution order for DAG."""

    def test_linear_chain(self):
        """A→B→C should execute in order [A, B, C]."""
        a, b, c = uuid4(), uuid4(), uuid4()
        adjacency = {
            a: {"children": [b], "parents": []},
            b: {"children": [c], "parents": [a]},
            c: {"children": [], "parents": [b]},
        }
        executor = GraphExecutor(adjacency)
        order = executor.topological_sort(target=c)
        assert order == [a, b, c]

    def test_diamond_dag(self):
        """Diamond: A→B, A→C, B→D, C→D — D's ancestors in valid topo order."""
        a, b, c, d = uuid4(), uuid4(), uuid4(), uuid4()
        adjacency = {
            a: {"children": [b, c], "parents": []},
            b: {"children": [d], "parents": [a]},
            c: {"children": [d], "parents": [a]},
            d: {"children": [], "parents": [b, c]},
        }
        executor = GraphExecutor(adjacency)
        order = executor.topological_sort(target=d)
        # A must be first, D must be last, B and C in any order between
        assert order[0] == a
        assert order[-1] == d
        assert set(order[1:3]) == {b, c}

    def test_single_node(self):
        """Single node with no parents returns just that node."""
        n = uuid4()
        adjacency = {n: {"children": [], "parents": []}}
        executor = GraphExecutor(adjacency)
        order = executor.topological_sort(target=n)
        assert order == [n]

    def test_subgraph_extraction(self):
        """Only ancestors of target are included, not unrelated nodes."""
        a, b, c, x = uuid4(), uuid4(), uuid4(), uuid4()
        adjacency = {
            a: {"children": [b], "parents": []},
            b: {"children": [c], "parents": [a]},
            c: {"children": [], "parents": [b]},
            x: {"children": [], "parents": []},  # unrelated
        }
        executor = GraphExecutor(adjacency)
        order = executor.topological_sort(target=c)
        assert x not in order
        assert order == [a, b, c]


class TestCycleDetection:
    """T050: Cycle detection raises CycleDetectedError before any execution."""

    def test_direct_cycle(self):
        """A→B→A raises CycleDetectedError."""
        a, b = uuid4(), uuid4()
        adjacency = {
            a: {"children": [b], "parents": [b]},
            b: {"children": [a], "parents": [a]},
        }
        executor = GraphExecutor(adjacency)
        with pytest.raises(CycleDetectedError):
            executor.topological_sort(target=a)

    def test_indirect_cycle(self):
        """A→B→C→A raises CycleDetectedError."""
        a, b, c = uuid4(), uuid4(), uuid4()
        adjacency = {
            a: {"children": [b], "parents": [c]},
            b: {"children": [c], "parents": [a]},
            c: {"children": [a], "parents": [b]},
        }
        executor = GraphExecutor(adjacency)
        with pytest.raises(CycleDetectedError):
            executor.topological_sort(target=a)

    def test_self_loop(self):
        """Node pointing to itself raises CycleDetectedError."""
        a = uuid4()
        adjacency = {
            a: {"children": [a], "parents": [a]},
        }
        executor = GraphExecutor(adjacency)
        with pytest.raises(CycleDetectedError):
            executor.topological_sort(target=a)


class TestParentFailurePropagation:
    """T051: Parent failure cancels downstream nodes."""

    @pytest.mark.asyncio
    async def test_parent_failure_cancels_child(self):
        """If parent A fails, child B should be marked cancelled."""
        a, b = uuid4(), uuid4()
        adjacency = {
            a: {"children": [b], "parents": []},
            b: {"children": [], "parents": [a]},
        }

        results = {}

        async def execute_a():
            raise RuntimeError("Provider auth failed")

        async def execute_b():
            results[b] = "completed"

        executor = GraphExecutor(adjacency)
        executor.set_node_executor(a, execute_a)
        executor.set_node_executor(b, execute_b)

        exec_result = await executor.execute(target=b)
        assert exec_result[a]["status"] == "failed"
        assert exec_result[b]["status"] == "cancelled"
        assert b not in results  # B never executed

    @pytest.mark.asyncio
    async def test_successful_chain(self):
        """A→B both succeed — both marked completed."""
        a, b = uuid4(), uuid4()
        adjacency = {
            a: {"children": [b], "parents": []},
            b: {"children": [], "parents": [a]},
        }

        async def succeed():
            return {"text": "ok"}

        executor = GraphExecutor(adjacency)
        executor.set_node_executor(a, succeed)
        executor.set_node_executor(b, succeed)

        exec_result = await executor.execute(target=b)
        assert exec_result[a]["status"] == "completed"
        assert exec_result[b]["status"] == "completed"
