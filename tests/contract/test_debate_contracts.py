"""Contract tests for debate API endpoints.

Tests the HTTP contract of /api/debates endpoints using FastAPI TestClient.
"""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from mindflow.api.server import app
from mindflow.api.routes.graphs import add_graph_to_storage, _graphs_storage
from mindflow.models.graph import Graph, GraphMetadata
from mindflow.models.node import Node
from mindflow.services import debate_engine


@pytest.fixture(autouse=True)
def cleanup():
    """Clear shared state before and after each test."""
    debate_engine._debates.clear()
    _graphs_storage.clear()
    yield
    debate_engine._debates.clear()
    _graphs_storage.clear()


@pytest.fixture
def client():
    """Create a FastAPI TestClient."""
    return TestClient(app)


def _create_test_graph_with_chain() -> tuple:
    """Create a graph with a 2-node linear chain (A -> B), both with provider_ids.

    Returns (graph, node_a_id, node_b_id).
    """
    meta = GraphMetadata(name="Contract Test Graph")
    graph = Graph(meta=meta)

    node_a = Node(
        type="question",
        author="human",
        content="Question A",
        provider_id=uuid4(),
    )
    node_b = Node(
        type="answer",
        author="llm",
        content="Answer B",
        provider_id=uuid4(),
    )

    node_a.children = [node_b.id]
    node_b.parents = [node_a.id]

    graph.nodes[node_a.id] = node_a
    graph.nodes[node_b.id] = node_b

    add_graph_to_storage(graph)

    return graph, node_a.id, node_b.id


# ── GET /api/debates ──────────────────────────────────────────


class TestListDebates:
    """Tests for GET /api/debates."""

    def test_list_empty(self, client):
        resp = client.get("/api/debates")
        assert resp.status_code == 200
        data = resp.json()
        assert data["debates"] == []

    def test_list_with_graph_id_filter_no_match(self, client):
        resp = client.get(f"/api/debates?graph_id={uuid4()}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["debates"] == []

    def test_list_with_graph_id_filter_match(self, client):
        from mindflow.models.debate import DebateChain, DebateStatus

        graph_id = uuid4()
        debate = DebateChain(
            graph_id=graph_id,
            start_node_id=uuid4(),
            status=DebateStatus.COMPLETED,
        )
        debate_engine._debates[str(debate.id)] = debate

        resp = client.get(f"/api/debates?graph_id={graph_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["debates"]) == 1
        assert data["debates"][0]["graph_id"] == str(graph_id)


# ── GET /api/debates/{id} ────────────────────────────────────


class TestGetDebate:
    """Tests for GET /api/debates/{debate_id}."""

    def test_get_missing_returns_404(self, client):
        resp = client.get(f"/api/debates/{uuid4()}")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_get_existing_debate(self, client):
        from mindflow.models.debate import DebateChain, DebateStatus

        debate = DebateChain(
            graph_id=uuid4(),
            start_node_id=uuid4(),
            status=DebateStatus.RUNNING,
        )
        debate_engine._debates[str(debate.id)] = debate

        resp = client.get(f"/api/debates/{debate.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(debate.id)
        assert data["status"] == "running"
        assert data["round_count"] == 0


# ── DELETE /api/debates/{id} ─────────────────────────────────


class TestStopDebate:
    """Tests for DELETE /api/debates/{debate_id}."""

    def test_stop_missing_returns_404(self, client):
        resp = client.delete(f"/api/debates/{uuid4()}")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_stop_running_debate(self, client):
        from mindflow.models.debate import DebateChain, DebateStatus

        debate = DebateChain(
            graph_id=uuid4(),
            start_node_id=uuid4(),
            status=DebateStatus.RUNNING,
        )
        debate_engine._debates[str(debate.id)] = debate

        resp = client.delete(f"/api/debates/{debate.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Debate stopped"
        assert data["rounds_completed"] == 0

        # Verify status changed
        stopped = debate_engine.get_debate(str(debate.id))
        assert stopped.status == DebateStatus.STOPPED


# ── POST /api/debates ────────────────────────────────────────


class TestStartDebate:
    """Tests for POST /api/debates."""

    def test_start_with_missing_graph_returns_404(self, client):
        resp = client.post(
            "/api/debates",
            json={
                "graph_id": str(uuid4()),
                "start_node_id": str(uuid4()),
                "max_rounds": 3,
            },
        )
        assert resp.status_code == 404
        assert "graph not found" in resp.json()["detail"].lower()

    def test_start_with_missing_start_node_returns_error(self, client):
        """Graph exists but start_node_id not in graph."""
        graph, _, _ = _create_test_graph_with_chain()

        resp = client.post(
            "/api/debates",
            json={
                "graph_id": str(graph.id),
                "start_node_id": str(uuid4()),  # not in graph
                "max_rounds": 3,
            },
        )
        # Should return 404 because "not found" is in the error
        assert resp.status_code == 404

    def test_start_with_single_node_returns_error(self, client):
        """Graph has only one node — chain requires at least 2."""
        meta = GraphMetadata(name="Single Node Graph")
        graph = Graph(meta=meta)
        node = Node(
            type="question",
            author="human",
            content="Alone",
            provider_id=uuid4(),
        )
        graph.nodes[node.id] = node
        add_graph_to_storage(graph)

        resp = client.post(
            "/api/debates",
            json={
                "graph_id": str(graph.id),
                "start_node_id": str(node.id),
                "max_rounds": 3,
            },
        )
        assert resp.status_code == 400
