"""Tests for dirty/clean execution caching in GraphExecutor.

Tests verify:
- mark_dirty propagates to descendants
- Clean nodes return cached results
- Dirty nodes re-execute
"""

import pytest
from uuid import uuid4

from mindflow.engine.executor import GraphExecutor


def _make_chain(n: int = 3):
    """Create a linear chain A → B → C with n nodes."""
    ids = [uuid4() for _ in range(n)]
    adjacency = {}
    for i, nid in enumerate(ids):
        parents = [ids[i - 1]] if i > 0 else []
        children = [ids[i + 1]] if i < n - 1 else []
        adjacency[nid] = {"parents": parents, "children": children}
    return ids, adjacency


def _make_diamond():
    """Create diamond: A → B, A → C, B → D, C → D."""
    a, b, c, d = uuid4(), uuid4(), uuid4(), uuid4()
    adjacency = {
        a: {"parents": [], "children": [b, c]},
        b: {"parents": [a], "children": [d]},
        c: {"parents": [a], "children": [d]},
        d: {"parents": [b, c], "children": []},
    }
    return (a, b, c, d), adjacency


class TestDirtyPropagation:
    """Test that marking a node dirty propagates to all descendants."""

    def test_mark_dirty_propagates_to_children(self):
        ids, adj = _make_chain(3)
        a, b, c = ids
        executor = GraphExecutor(adj)

        # Clear all nodes first
        executor._dirty_nodes.clear()
        assert not executor.is_dirty(a)
        assert not executor.is_dirty(b)
        assert not executor.is_dirty(c)

        # Mark A dirty → should propagate to B and C
        dirty_list = executor.mark_dirty(a)
        assert a in dirty_list
        assert b in dirty_list
        assert c in dirty_list

    def test_mark_dirty_does_not_affect_parents(self):
        ids, adj = _make_chain(3)
        a, b, c = ids
        executor = GraphExecutor(adj)

        # Clear all nodes
        executor._dirty_nodes.clear()

        # Mark B dirty → A should NOT be affected, C should be
        dirty_list = executor.mark_dirty(b)
        assert b in dirty_list
        assert c in dirty_list
        assert a not in dirty_list
        assert not executor.is_dirty(a)

    def test_mark_dirty_diamond_propagation(self):
        (a, b, c, d), adj = _make_diamond()
        executor = GraphExecutor(adj)
        executor._dirty_nodes.clear()

        # Mark A dirty → all descendants (B, C, D)
        dirty_list = executor.mark_dirty(a)
        assert executor.is_dirty(a)
        assert executor.is_dirty(b)
        assert executor.is_dirty(c)
        assert executor.is_dirty(d)

    def test_mark_dirty_removes_cache(self):
        ids, adj = _make_chain(2)
        a, b = ids
        executor = GraphExecutor(adj)

        # Simulate cached results
        executor._dirty_nodes.clear()
        executor._execution_cache[a] = {"output": "cached_a"}
        executor._execution_cache[b] = {"output": "cached_b"}

        # Mark A dirty → both caches should be removed
        executor.mark_dirty(a)
        assert a not in executor._execution_cache
        assert b not in executor._execution_cache


class TestCleanCaching:
    """Test that clean nodes return cached results without re-execution."""

    @pytest.mark.asyncio
    async def test_clean_node_returns_cached_result(self):
        ids, adj = _make_chain(2)
        a, b = ids
        executor = GraphExecutor(adj)

        call_count = {"a": 0, "b": 0}

        async def exec_a():
            call_count["a"] += 1
            return {"text": "hello"}

        async def exec_b():
            call_count["b"] += 1
            return {"text": "world"}

        executor.set_node_executor(a, exec_a)
        executor.set_node_executor(b, exec_b)

        # First execution — both dirty
        results1 = await executor.execute(b)
        assert results1[a]["status"] == "completed"
        assert results1[b]["status"] == "completed"
        assert call_count["a"] == 1
        assert call_count["b"] == 1

        # Second execution — both clean now
        results2 = await executor.execute(b)
        assert results2[a]["cached"] is True
        assert results2[b]["cached"] is True
        # Executors should NOT be called again
        assert call_count["a"] == 1
        assert call_count["b"] == 1

    @pytest.mark.asyncio
    async def test_dirty_node_re_executes(self):
        ids, adj = _make_chain(2)
        a, b = ids
        executor = GraphExecutor(adj)

        call_count = {"a": 0, "b": 0}

        async def exec_a():
            call_count["a"] += 1
            return {"text": "hello"}

        async def exec_b():
            call_count["b"] += 1
            return {"text": "world"}

        executor.set_node_executor(a, exec_a)
        executor.set_node_executor(b, exec_b)

        # First execution
        await executor.execute(b)
        assert call_count["a"] == 1
        assert call_count["b"] == 1

        # Mark A dirty → A and B re-execute
        executor.mark_dirty(a)
        results = await executor.execute(b)
        assert results[a]["cached"] is False
        assert results[b]["cached"] is False
        assert call_count["a"] == 2
        assert call_count["b"] == 2


class TestDirtyReExecution:
    """Test partial re-execution: only dirty nodes run."""

    @pytest.mark.asyncio
    async def test_only_dirty_node_re_executes(self):
        ids, adj = _make_chain(3)
        a, b, c = ids
        executor = GraphExecutor(adj)

        call_count = {"a": 0, "b": 0, "c": 0}

        async def exec_a():
            call_count["a"] += 1
            return {"v": 1}

        async def exec_b():
            call_count["b"] += 1
            return {"v": 2}

        async def exec_c():
            call_count["c"] += 1
            return {"v": 3}

        executor.set_node_executor(a, exec_a)
        executor.set_node_executor(b, exec_b)
        executor.set_node_executor(c, exec_c)

        # First run: all execute
        await executor.execute(c)
        assert call_count == {"a": 1, "b": 1, "c": 1}

        # Mark only B dirty → A is cached, B and C re-execute
        executor.mark_dirty(b)
        assert not executor.is_dirty(a)
        assert executor.is_dirty(b)
        assert executor.is_dirty(c)

        results = await executor.execute(c)
        assert results[a]["cached"] is True
        assert results[b]["cached"] is False
        assert results[c]["cached"] is False
        assert call_count == {"a": 1, "b": 2, "c": 2}
