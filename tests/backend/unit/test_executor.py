"""Tests for GraphExecutor execution logic.

Tests verify:
- Linear chain executes in order
- Diamond graph executes A once, then B||C, then D
- Cycle detection raises error
"""

import pytest
from uuid import uuid4

from mindflow.engine.executor import GraphExecutor, CycleDetectedError


class TestLinearExecution:
    """Test linear chain execution order."""

    def test_topological_sort_linear(self):
        a, b, c = uuid4(), uuid4(), uuid4()
        adj = {
            a: {"parents": [], "children": [b]},
            b: {"parents": [a], "children": [c]},
            c: {"parents": [b], "children": []},
        }
        executor = GraphExecutor(adj)
        order = executor.topological_sort(c)
        assert order == [a, b, c]

    @pytest.mark.asyncio
    async def test_linear_chain_executes_in_order(self):
        a, b, c = uuid4(), uuid4(), uuid4()
        adj = {
            a: {"parents": [], "children": [b]},
            b: {"parents": [a], "children": [c]},
            c: {"parents": [b], "children": []},
        }
        executor = GraphExecutor(adj)
        execution_log = []

        async def make_exec(name):
            async def exec_fn():
                execution_log.append(name)
                return {"node": name}
            return exec_fn

        executor.set_node_executor(a, await make_exec("a"))
        executor.set_node_executor(b, await make_exec("b"))
        executor.set_node_executor(c, await make_exec("c"))

        results = await executor.execute(c)
        assert execution_log == ["a", "b", "c"]
        assert all(r["status"] == "completed" for r in results.values())


class TestDiamondExecution:
    """Test diamond DAG: A → B, A → C, B → D, C → D."""

    def test_topological_sort_diamond(self):
        a, b, c, d = uuid4(), uuid4(), uuid4(), uuid4()
        adj = {
            a: {"parents": [], "children": [b, c]},
            b: {"parents": [a], "children": [d]},
            c: {"parents": [a], "children": [d]},
            d: {"parents": [b, c], "children": []},
        }
        executor = GraphExecutor(adj)
        order = executor.topological_sort(d)

        # A must come first, D must come last
        assert order[0] == a
        assert order[-1] == d
        # B and C must come after A and before D
        assert set(order[1:3]) == {b, c}

    @pytest.mark.asyncio
    async def test_diamond_executes_a_once(self):
        a, b, c, d = uuid4(), uuid4(), uuid4(), uuid4()
        adj = {
            a: {"parents": [], "children": [b, c]},
            b: {"parents": [a], "children": [d]},
            c: {"parents": [a], "children": [d]},
            d: {"parents": [b, c], "children": []},
        }
        executor = GraphExecutor(adj)

        call_count = {"a": 0}

        async def exec_a():
            call_count["a"] += 1
            return {"v": 1}

        async def noop():
            return {}

        executor.set_node_executor(a, exec_a)
        executor.set_node_executor(b, noop)
        executor.set_node_executor(c, noop)
        executor.set_node_executor(d, noop)

        await executor.execute(d)
        assert call_count["a"] == 1  # A executes exactly once


class TestCycleDetection:
    """Test cycle detection during topological sort."""

    def test_direct_cycle_raises(self):
        a, b = uuid4(), uuid4()
        adj = {
            a: {"parents": [b], "children": [b]},
            b: {"parents": [a], "children": [a]},
        }
        executor = GraphExecutor(adj)
        with pytest.raises(CycleDetectedError):
            executor.topological_sort(a)

    def test_self_loop_raises(self):
        a = uuid4()
        adj = {
            a: {"parents": [a], "children": [a]},
        }
        executor = GraphExecutor(adj)
        with pytest.raises(CycleDetectedError):
            executor.topological_sort(a)

    def test_indirect_cycle_raises(self):
        a, b, c = uuid4(), uuid4(), uuid4()
        adj = {
            a: {"parents": [c], "children": [b]},
            b: {"parents": [a], "children": [c]},
            c: {"parents": [b], "children": [a]},
        }
        executor = GraphExecutor(adj)
        with pytest.raises(CycleDetectedError):
            executor.topological_sort(a)


class TestFailurePropagation:
    """Test that parent failure cascades to downstream nodes."""

    @pytest.mark.asyncio
    async def test_parent_failure_cancels_child(self):
        a, b = uuid4(), uuid4()
        adj = {
            a: {"parents": [], "children": [b]},
            b: {"parents": [a], "children": []},
        }
        executor = GraphExecutor(adj)

        async def fail_exec():
            raise RuntimeError("boom")

        async def child_exec():
            return {"v": 1}

        executor.set_node_executor(a, fail_exec)
        executor.set_node_executor(b, child_exec)

        results = await executor.execute(b)
        assert results[a]["status"] == "failed"
        assert results[b]["status"] == "cancelled"


class TestStreamExecute:
    """Test SSE event streaming with dirty/clean."""

    @pytest.mark.asyncio
    async def test_stream_emits_node_skip_for_clean(self):
        a, b = uuid4(), uuid4()
        adj = {
            a: {"parents": [], "children": [b]},
            b: {"parents": [a], "children": []},
        }
        executor = GraphExecutor(adj)

        async def exec_a():
            return {"v": 1}

        async def exec_b():
            return {"v": 2}

        executor.set_node_executor(a, exec_a)
        executor.set_node_executor(b, exec_b)

        # First execution — all dirty
        events1 = []
        async for event in executor.stream_execute(b):
            events1.append(event)

        event_types1 = [e["event"] for e in events1]
        assert "node_start" in event_types1
        assert "node_skip" not in event_types1

        # Second execution — all clean
        events2 = []
        async for event in executor.stream_execute(b):
            events2.append(event)

        event_types2 = [e["event"] for e in events2]
        assert "node_skip" in event_types2
        # Count skips — should be 2 (a and b)
        skip_count = sum(1 for e in events2 if e["event"] == "node_skip")
        assert skip_count == 2
