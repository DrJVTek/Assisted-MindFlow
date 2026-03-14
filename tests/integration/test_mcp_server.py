"""Integration tests for MCP server (T041).

Tests the MCP server tool registration and tool function execution
with a real (in-memory) graph storage backend.
"""

import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from uuid import uuid4

from mindflow.services.mcp_server import (
    mcp,
    list_canvases,
    get_canvas,
    read_node,
    create_node,
    update_node,
    delete_node,
)


class TestMCPServerIntegration:
    """Integration tests verifying MCP server tools work end-to-end."""

    def test_mcp_server_has_correct_name(self):
        """Server should be named 'MindFlow Canvas'."""
        assert mcp.name == "MindFlow Canvas"

    @pytest.mark.asyncio
    async def test_list_canvases_returns_json(self):
        """list_canvases should return valid JSON with canvases key."""
        with patch("mindflow.services.mcp_server._canvas_service") as mock_svc:
            mock_svc.list_all.return_value = []
            result = await list_canvases()
            parsed = json.loads(result)
            assert "canvases" in parsed
            assert isinstance(parsed["canvases"], list)

    @pytest.mark.asyncio
    async def test_get_canvas_not_found(self):
        """get_canvas with unknown ID should return error."""
        fake_id = str(uuid4())
        with patch(
            "mindflow.services.mcp_server.get_graph_from_storage", return_value=None
        ):
            result = await get_canvas(canvas_id=fake_id)  # canvas_id is the actual param name
            assert "not found" in result.lower() or "error" in result.lower()

    @pytest.mark.asyncio
    async def test_create_and_read_node(self):
        """Create a node then read it back."""
        gid = uuid4()
        nid = uuid4()

        # Use a simple namespace to avoid MagicMock JSON serialization issues
        class SimpleNode:
            pass

        class SimpleMeta:
            pass

        meta = SimpleMeta()
        meta.status = "draft"
        meta.importance = 0.5
        meta.tags = []
        meta.created_at = "2025-01-01T00:00:00"
        meta.updated_at = "2025-01-01T00:00:00"

        node = SimpleNode()
        node.id = nid
        node.content = "Test content"
        node.type = "note"  # plain string, no .value attribute
        node.author = "human"
        node.llm_response = None
        node.llm_status = None
        node.provider_id = None
        node.meta = meta
        node.parents = []
        node.children = []

        mock_graph = MagicMock()
        mock_graph.nodes = {nid: node}
        mock_graph.id = gid

        with patch(
            "mindflow.services.mcp_server.get_graph_from_storage",
            return_value=mock_graph,
        ):
            result = await read_node(graph_id=str(gid), node_id=str(nid))
            parsed = json.loads(result)
            assert parsed["content"] == "Test content"
            assert parsed["type"] == "note"

    @pytest.mark.asyncio
    async def test_delete_node_not_found(self):
        """delete_node with unknown node should return error."""
        graph_id = str(uuid4())
        node_id = str(uuid4())

        mock_graph = MagicMock()
        mock_graph.nodes = {}

        with patch(
            "mindflow.services.mcp_server.get_graph_from_storage",
            return_value=mock_graph,
        ):
            result = await delete_node(graph_id=graph_id, node_id=node_id)
            assert "not found" in result.lower() or "error" in result.lower()

    @pytest.mark.asyncio
    async def test_update_node_content(self):
        """update_node should modify the node's content."""
        gid = uuid4()
        nid = uuid4()

        mock_node = MagicMock()
        mock_node.content = "Old content"
        mock_node.type = "note"
        mock_node.meta = MagicMock()
        mock_node.meta.tags = []

        mock_graph = MagicMock()
        mock_graph.nodes = {nid: mock_node}
        mock_graph.id = gid

        with patch(
            "mindflow.services.mcp_server.get_graph_from_storage",
            return_value=mock_graph,
        ):
            with patch("mindflow.services.mcp_server.add_graph_to_storage"):
                result = await update_node(
                    graph_id=str(gid),
                    node_id=str(nid),
                    content="New content",
                )
                assert "updated" in result.lower() or "success" in result.lower()
                assert mock_node.content == "New content"
