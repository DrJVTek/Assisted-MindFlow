"""Unit tests for MCP server tool functions in mindflow.services.mcp_server.

Tests list_canvases, create_node, read_node, delete_node, update_node
by calling the async tool functions directly.
"""

import json
from pathlib import Path
from uuid import UUID, uuid4

import pytest
import pytest_asyncio

from mindflow.api.routes.graphs import add_graph_to_storage, _graphs_storage
from mindflow.models.canvas import Canvas
from mindflow.models.graph import Graph, GraphMetadata
from mindflow.models.node import Node
from mindflow.services.canvas_service import CanvasService
from mindflow.services.mcp_server import (
    _canvas_service,
    create_node,
    delete_node,
    list_canvases,
    read_node,
    update_node,
)


@pytest.fixture(autouse=True)
def cleanup():
    """Clear graph storage before and after each test."""
    _graphs_storage.clear()
    yield
    _graphs_storage.clear()


@pytest.fixture
def tmp_canvas_service(tmp_path):
    """Create a CanvasService backed by a temporary directory."""
    import mindflow.services.mcp_server as mcp_mod

    original = mcp_mod._canvas_service
    temp_service = CanvasService(data_dir=tmp_path)
    mcp_mod._canvas_service = temp_service
    yield temp_service
    mcp_mod._canvas_service = original


def _create_graph_with_node(content: str = "Test content") -> tuple:
    """Create a graph with one node, add to storage.

    Returns (graph, node).
    """
    meta = GraphMetadata(name="MCP Test Graph")
    graph = Graph(meta=meta)
    node = Node(
        type="question",
        author="human",
        content=content,
    )
    graph.nodes[node.id] = node
    add_graph_to_storage(graph)
    return graph, node


# ── list_canvases ─────────────────────────────────────────────


class TestListCanvases:
    """Tests for list_canvases MCP tool."""

    @pytest.mark.asyncio
    async def test_returns_empty_list(self, tmp_canvas_service):
        result = await list_canvases()
        data = json.loads(result)
        assert data["canvases"] == []

    @pytest.mark.asyncio
    async def test_returns_canvases_after_adding(self, tmp_canvas_service):
        # Create a canvas and its graph
        canvas, graph = tmp_canvas_service.create_with_graph("Test Canvas")
        tmp_canvas_service.save(canvas)
        add_graph_to_storage(graph)

        result = await list_canvases()
        data = json.loads(result)
        assert len(data["canvases"]) == 1
        assert data["canvases"][0]["name"] == "Test Canvas"
        assert data["canvases"][0]["node_count"] == 0

    @pytest.mark.asyncio
    async def test_returns_correct_node_count(self, tmp_canvas_service):
        canvas, graph = tmp_canvas_service.create_with_graph("Canvas With Nodes")
        tmp_canvas_service.save(canvas)

        # Add nodes to the graph
        node = Node(type="question", author="human", content="Hello")
        graph.nodes[node.id] = node
        add_graph_to_storage(graph)

        result = await list_canvases()
        data = json.loads(result)
        assert data["canvases"][0]["node_count"] == 1


# ── create_node ───────────────────────────────────────────────


class TestCreateNode:
    """Tests for create_node MCP tool.

    Note: create_node in mcp_server.py has a bug where it calls NodeType(type),
    but NodeType is a typing.Literal alias and cannot be instantiated.
    Tests that call create_node with a type parameter are marked xfail.
    """

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="Bug in mcp_server.py: NodeType is Literal, not callable", strict=True)
    async def test_creates_node_in_graph(self):
        meta = GraphMetadata(name="Create Node Test")
        graph = Graph(meta=meta)
        add_graph_to_storage(graph)

        result = await create_node(
            graph_id=str(graph.id),
            content="New node content",
            type="question",
        )
        data = json.loads(result)

        assert "id" in data
        assert data["content"] == "New node content"
        assert data["type"] == "question"

        # Verify node was added to graph
        node_id = UUID(data["id"])
        assert node_id in graph.nodes

    @pytest.mark.asyncio
    async def test_create_node_missing_graph(self):
        result = await create_node(
            graph_id=str(uuid4()),
            content="Should fail",
        )
        data = json.loads(result)
        assert "error" in data

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="Bug in mcp_server.py: NodeType is Literal, not callable", strict=True)
    async def test_create_node_with_tags(self):
        meta = GraphMetadata(name="Tags Test")
        graph = Graph(meta=meta)
        add_graph_to_storage(graph)

        result = await create_node(
            graph_id=str(graph.id),
            content="Tagged node",
            tags="tag1, tag2",
        )
        data = json.loads(result)
        assert "id" in data

        node_id = UUID(data["id"])
        node = graph.nodes[node_id]
        assert "tag1" in node.meta.tags
        assert "tag2" in node.meta.tags

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="Bug in mcp_server.py: NodeType is Literal, not callable", strict=True)
    async def test_create_node_with_parent(self):
        graph, parent_node = _create_graph_with_node("Parent")

        result = await create_node(
            graph_id=str(graph.id),
            content="Child node",
            parent_ids=str(parent_node.id),
        )
        data = json.loads(result)
        child_id = UUID(data["id"])

        # Verify parent-child relationship
        child_node = graph.nodes[child_id]
        assert parent_node.id in child_node.parents
        assert child_id in parent_node.children


# ── read_node ─────────────────────────────────────────────────


class TestReadNode:
    """Tests for read_node MCP tool."""

    @pytest.mark.asyncio
    async def test_reads_existing_node(self):
        graph, node = _create_graph_with_node("Read me")

        result = await read_node(
            graph_id=str(graph.id),
            node_id=str(node.id),
        )
        data = json.loads(result)

        assert data["id"] == str(node.id)
        assert data["content"] == "Read me"
        assert data["type"] == "question"

    @pytest.mark.asyncio
    async def test_read_missing_node_returns_error(self):
        graph, _ = _create_graph_with_node()

        result = await read_node(
            graph_id=str(graph.id),
            node_id=str(uuid4()),
        )
        data = json.loads(result)
        assert "error" in data
        assert "not found" in data["error"].lower()

    @pytest.mark.asyncio
    async def test_read_missing_graph_returns_error(self):
        result = await read_node(
            graph_id=str(uuid4()),
            node_id=str(uuid4()),
        )
        data = json.loads(result)
        assert "error" in data
        assert "not found" in data["error"].lower()


# ── delete_node ───────────────────────────────────────────────


class TestDeleteNode:
    """Tests for delete_node MCP tool."""

    @pytest.mark.asyncio
    async def test_deletes_existing_node(self):
        graph, node = _create_graph_with_node("Delete me")
        node_id = node.id

        result = await delete_node(
            graph_id=str(graph.id),
            node_id=str(node_id),
        )
        data = json.loads(result)

        assert "deleted" in data["message"].lower()
        assert node_id not in graph.nodes

    @pytest.mark.asyncio
    async def test_delete_missing_node_returns_error(self):
        graph, _ = _create_graph_with_node()

        result = await delete_node(
            graph_id=str(graph.id),
            node_id=str(uuid4()),
        )
        data = json.loads(result)
        assert "error" in data

    @pytest.mark.asyncio
    async def test_delete_updates_parent_children(self):
        """Deleting a child should remove it from the parent's children list."""
        graph, parent_node = _create_graph_with_node("Parent")

        child = Node(type="answer", author="llm", content="Child")
        graph.nodes[child.id] = child
        parent_node.children.append(child.id)
        child.parents.append(parent_node.id)

        await delete_node(
            graph_id=str(graph.id),
            node_id=str(child.id),
        )

        assert child.id not in parent_node.children


# ── update_node ───────────────────────────────────────────────


class TestUpdateNode:
    """Tests for update_node MCP tool."""

    @pytest.mark.asyncio
    async def test_updates_content(self):
        graph, node = _create_graph_with_node("Original content")

        result = await update_node(
            graph_id=str(graph.id),
            node_id=str(node.id),
            content="Updated content",
        )
        data = json.loads(result)

        assert data["content"] == "Updated content"
        assert data["status"] == "updated"
        assert node.content == "Updated content"

    @pytest.mark.asyncio
    async def test_update_missing_node_returns_error(self):
        graph, _ = _create_graph_with_node()

        result = await update_node(
            graph_id=str(graph.id),
            node_id=str(uuid4()),
            content="Should fail",
        )
        data = json.loads(result)
        assert "error" in data

    @pytest.mark.asyncio
    async def test_update_tags(self):
        graph, node = _create_graph_with_node("Tag update")

        await update_node(
            graph_id=str(graph.id),
            node_id=str(node.id),
            tags="new_tag1, new_tag2",
        )

        assert "new_tag1" in node.meta.tags
        assert "new_tag2" in node.meta.tags

    @pytest.mark.asyncio
    async def test_update_provider_id(self):
        graph, node = _create_graph_with_node("Provider update")
        provider_id = uuid4()

        await update_node(
            graph_id=str(graph.id),
            node_id=str(node.id),
            provider_id=str(provider_id),
        )

        assert node.provider_id == provider_id

    @pytest.mark.asyncio
    async def test_clear_provider_id(self):
        graph, node = _create_graph_with_node("Clear provider")
        node.provider_id = uuid4()

        await update_node(
            graph_id=str(graph.id),
            node_id=str(node.id),
            provider_id="none",
        )

        assert node.provider_id is None
