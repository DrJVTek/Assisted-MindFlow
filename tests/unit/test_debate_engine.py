"""Unit tests for mindflow.services.debate_engine module.

Tests discover_chain, check_chain_cycles, validate_providers,
get_debate, list_debates, stop_debate, and _format_history.
"""

from uuid import uuid4

import pytest

from mindflow.models.debate import DebateChain, DebateStatus
from mindflow.models.graph import Graph, GraphMetadata
from mindflow.models.node import Node
from mindflow.services import debate_engine
from mindflow.services.debate_engine import (
    _format_history,
    check_chain_cycles,
    discover_chain,
    get_debate,
    list_debates,
    stop_debate,
    validate_providers,
)


# ── Helpers ───────────────────────────────────────────────────


def _make_graph_with_chain(node_count: int = 3) -> tuple:
    """Create a graph with a linear chain of nodes (A -> B -> C ...).

    Returns (graph, list_of_node_ids_in_order).
    """
    meta = GraphMetadata(name="Test Graph")
    graph = Graph(meta=meta)

    node_ids = []
    for i in range(node_count):
        node = Node(
            type="question",
            author="human",
            content=f"Node {i}",
            provider_id=uuid4(),
        )
        node_ids.append(node.id)
        graph.nodes[node.id] = node

    # Wire up linear chain: 0->1->2->...
    for i in range(len(node_ids) - 1):
        parent = graph.nodes[node_ids[i]]
        child = graph.nodes[node_ids[i + 1]]
        parent.children.append(child.id)
        child.parents.append(parent.id)

    return graph, node_ids


def _make_branching_graph() -> tuple:
    """Create a graph with branching: A -> B, A -> C.

    Returns (graph, node_a_id, node_b_id, node_c_id).
    """
    meta = GraphMetadata(name="Branching Graph")
    graph = Graph(meta=meta)

    node_a = Node(type="question", author="human", content="A", provider_id=uuid4())
    node_b = Node(type="answer", author="llm", content="B", provider_id=uuid4())
    node_c = Node(type="answer", author="llm", content="C", provider_id=uuid4())

    graph.nodes[node_a.id] = node_a
    graph.nodes[node_b.id] = node_b
    graph.nodes[node_c.id] = node_c

    node_a.children = [node_b.id, node_c.id]
    node_b.parents = [node_a.id]
    node_c.parents = [node_a.id]

    return graph, node_a.id, node_b.id, node_c.id


# ── discover_chain ────────────────────────────────────────────


class TestDiscoverChain:
    """Tests for discover_chain function."""

    def test_linear_chain(self):
        graph, node_ids = _make_graph_with_chain(3)
        chain = discover_chain(graph, node_ids[0])

        assert len(chain) == 3
        assert chain[0] == node_ids[0]
        # All nodes should be present
        assert set(chain) == set(node_ids)

    def test_single_node_raises_value_error(self):
        meta = GraphMetadata(name="Single Node")
        graph = Graph(meta=meta)
        node = Node(type="question", author="human", content="Alone", provider_id=uuid4())
        graph.nodes[node.id] = node

        with pytest.raises(ValueError, match="fewer than 2 nodes"):
            discover_chain(graph, node.id)

    def test_start_node_not_found_raises(self):
        graph, _ = _make_graph_with_chain(2)
        fake_id = uuid4()

        with pytest.raises(ValueError, match="not found in graph"):
            discover_chain(graph, fake_id)

    def test_branching_chain(self):
        graph, a_id, b_id, c_id = _make_branching_graph()
        chain = discover_chain(graph, a_id)

        assert len(chain) == 3
        assert chain[0] == a_id
        assert set(chain) == {a_id, b_id, c_id}

    def test_two_node_chain(self):
        graph, node_ids = _make_graph_with_chain(2)
        chain = discover_chain(graph, node_ids[0])

        assert len(chain) == 2
        assert chain[0] == node_ids[0]
        assert chain[1] == node_ids[1]

    def test_long_chain(self):
        graph, node_ids = _make_graph_with_chain(10)
        chain = discover_chain(graph, node_ids[0])

        assert len(chain) == 10
        assert chain[0] == node_ids[0]


# ── check_chain_cycles ───────────────────────────────────────


class TestCheckChainCycles:
    """Tests for check_chain_cycles function."""

    def test_no_cycles_in_linear_chain(self):
        graph, node_ids = _make_graph_with_chain(3)
        assert check_chain_cycles(graph, node_ids) is False

    def test_cycle_detected(self):
        """Create A -> B -> C -> A (cycle)."""
        meta = GraphMetadata(name="Cyclic Graph")
        graph = Graph(meta=meta)

        node_a = Node(type="question", author="human", content="A", provider_id=uuid4())
        node_b = Node(type="answer", author="llm", content="B", provider_id=uuid4())
        node_c = Node(type="answer", author="llm", content="C", provider_id=uuid4())

        graph.nodes[node_a.id] = node_a
        graph.nodes[node_b.id] = node_b
        graph.nodes[node_c.id] = node_c

        node_a.children = [node_b.id]
        node_b.children = [node_c.id]
        node_c.children = [node_a.id]  # cycle back

        node_b.parents = [node_a.id]
        node_c.parents = [node_b.id]
        node_a.parents = [node_c.id]

        chain = [node_a.id, node_b.id, node_c.id]
        assert check_chain_cycles(graph, chain) is True

    def test_no_cycles_empty_chain(self):
        graph = Graph(meta=GraphMetadata(name="Empty"))
        assert check_chain_cycles(graph, []) is False


# ── validate_providers ────────────────────────────────────────


class TestValidateProviders:
    """Tests for validate_providers function."""

    def test_all_have_provider_id(self):
        graph, node_ids = _make_graph_with_chain(3)
        # All nodes already have provider_id set by _make_graph_with_chain
        missing = validate_providers(graph, node_ids)
        assert missing == []

    def test_some_missing_provider_id(self):
        meta = GraphMetadata(name="Missing Providers")
        graph = Graph(meta=meta)

        node_a = Node(type="question", author="human", content="A", provider_id=uuid4())
        node_b = Node(type="answer", author="llm", content="B")  # No provider_id

        graph.nodes[node_a.id] = node_a
        graph.nodes[node_b.id] = node_b

        missing = validate_providers(graph, [node_a.id, node_b.id])
        assert missing == [node_b.id]

    def test_node_not_in_graph(self):
        graph = Graph(meta=GraphMetadata(name="Test"))
        fake_id = uuid4()
        missing = validate_providers(graph, [fake_id])
        assert missing == [fake_id]

    def test_all_missing_provider_id(self):
        meta = GraphMetadata(name="No Providers")
        graph = Graph(meta=meta)

        node_a = Node(type="question", author="human", content="A")
        node_b = Node(type="answer", author="llm", content="B")

        graph.nodes[node_a.id] = node_a
        graph.nodes[node_b.id] = node_b

        missing = validate_providers(graph, [node_a.id, node_b.id])
        assert len(missing) == 2


# ── get_debate / list_debates / stop_debate ───────────────────


class TestDebateStorage:
    """Tests for debate storage functions."""

    @pytest.fixture(autouse=True)
    def clear_debates(self):
        """Clear the in-memory debate storage before each test."""
        debate_engine._debates.clear()
        yield
        debate_engine._debates.clear()

    def test_get_debate_returns_none_for_missing(self):
        assert get_debate("nonexistent-id") is None

    def test_get_debate_returns_stored_debate(self):
        graph_id = uuid4()
        debate = DebateChain(graph_id=graph_id, start_node_id=uuid4())
        debate_engine._debates[str(debate.id)] = debate

        result = get_debate(str(debate.id))
        assert result is not None
        assert result.id == debate.id

    def test_list_debates_empty(self):
        result = list_debates()
        assert result == []

    def test_list_debates_returns_all(self):
        d1 = DebateChain(graph_id=uuid4(), start_node_id=uuid4())
        d2 = DebateChain(graph_id=uuid4(), start_node_id=uuid4())
        debate_engine._debates[str(d1.id)] = d1
        debate_engine._debates[str(d2.id)] = d2

        result = list_debates()
        assert len(result) == 2

    def test_list_debates_filtered_by_graph_id(self):
        graph_id = uuid4()
        d1 = DebateChain(graph_id=graph_id, start_node_id=uuid4())
        d2 = DebateChain(graph_id=uuid4(), start_node_id=uuid4())
        debate_engine._debates[str(d1.id)] = d1
        debate_engine._debates[str(d2.id)] = d2

        result = list_debates(graph_id=str(graph_id))
        assert len(result) == 1
        assert result[0].graph_id == graph_id

    def test_stop_debate_changes_status(self):
        debate = DebateChain(
            graph_id=uuid4(),
            start_node_id=uuid4(),
            status=DebateStatus.RUNNING,
        )
        debate_engine._debates[str(debate.id)] = debate

        result = stop_debate(str(debate.id))
        assert result is not None
        assert result.status == DebateStatus.STOPPED

    def test_stop_debate_returns_none_for_missing(self):
        result = stop_debate("nonexistent-id")
        assert result is None

    def test_stop_debate_does_not_change_terminal_status(self):
        debate = DebateChain(
            graph_id=uuid4(),
            start_node_id=uuid4(),
            status=DebateStatus.COMPLETED,
        )
        debate_engine._debates[str(debate.id)] = debate

        result = stop_debate(str(debate.id))
        assert result is not None
        assert result.status == DebateStatus.COMPLETED  # unchanged


# ── _format_history ───────────────────────────────────────────


class TestFormatHistory:
    """Tests for _format_history helper."""

    def test_empty_history(self):
        assert _format_history([]) == ""

    def test_single_entry(self):
        history = [{"role": "Claude", "content": "Hello world"}]
        result = _format_history(history)
        assert result == "[Claude]: Hello world"

    def test_multiple_entries(self):
        history = [
            {"role": "Claude", "content": "First response"},
            {"role": "GPT", "content": "Second response"},
        ]
        result = _format_history(history)
        assert "[Claude]: First response" in result
        assert "[GPT]: Second response" in result
        assert "\n\n" in result

    def test_missing_role_defaults_to_unknown(self):
        history = [{"content": "No role here"}]
        result = _format_history(history)
        assert "[Unknown]: No role here" in result

    def test_missing_content_defaults_to_empty(self):
        history = [{"role": "Test"}]
        result = _format_history(history)
        assert "[Test]: " in result
