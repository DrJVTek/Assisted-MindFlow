"""MCP Server for MindFlow (Feature 011 - US3).

Exposes MindFlow canvas operations as MCP tools that external clients
(Claude Code, Codex, etc.) can connect to and use.

Tools:
- list_canvases: List all available canvases
- get_canvas: Get a canvas with its full graph data
- read_node: Read a single node's content and metadata
- create_node: Create a new node on the canvas
- update_node: Update a node's content or metadata
- delete_node: Delete a node from the graph
- trigger_llm: Trigger LLM generation on a node
- start_debate: Start a debate chain from a node
"""

import json
import logging
from typing import Optional
from uuid import UUID

from mcp.server.fastmcp import FastMCP

from mindflow.services.canvas_service import CanvasService
from mindflow.api.routes.graphs import (
    get_graph_from_storage,
    add_graph_to_storage,
)
from mindflow.api.routes.providers import _get_registry
from mindflow.services import debate_engine

logger = logging.getLogger(__name__)

# Create the MCP server instance
mcp = FastMCP("MindFlow Canvas")

# Shared canvas service
_canvas_service = CanvasService()


# ── Tools ──────────────────────────────────────────────────────


@mcp.tool()
async def list_canvases() -> str:
    """List all available canvases with their IDs, names, and node counts."""
    canvases = _canvas_service.list_all()
    result = []
    for canvas in canvases:
        graph = get_graph_from_storage(canvas.graph_id)
        node_count = len(graph.nodes) if graph else 0
        result.append({
            "id": str(canvas.id),
            "name": canvas.name,
            "description": canvas.description or "",
            "node_count": node_count,
        })
    return json.dumps({"canvases": result}, indent=2)


@mcp.tool()
async def get_canvas(canvas_id: str) -> str:
    """Get a canvas with its full graph data including all nodes, groups, and comments.

    Args:
        canvas_id: UUID of the canvas to retrieve
    """
    canvas = _canvas_service.load(UUID(canvas_id))
    if canvas is None:
        return json.dumps({"error": f"Canvas {canvas_id} not found"})

    graph = get_graph_from_storage(canvas.graph_id)
    if graph is None:
        return json.dumps({"error": f"Graph for canvas {canvas_id} not found"})

    # Serialize graph nodes
    nodes = {}
    for nid, node in graph.nodes.items():
        nodes[str(nid)] = {
            "content": node.content,
            "type": node.type.value if hasattr(node.type, 'value') else str(node.type),
            "provider_id": str(node.provider_id) if node.provider_id else None,
            "llm_response": node.llm_response,
            "llm_status": node.llm_status,
            "tags": [str(t) for t in node.meta.tags] if hasattr(node, 'meta') else [],
            "children": [str(c) for c in node.children],
            "parents": [str(p) for p in node.parents],
        }

    return json.dumps({
        "id": str(canvas.id),
        "name": canvas.name,
        "graph": {
            "id": str(graph.id),
            "nodes": nodes,
            "node_count": len(nodes),
        },
    }, indent=2)


@mcp.tool()
async def read_node(graph_id: str, node_id: str) -> str:
    """Read a single node's content, LLM response, provider info, and metadata.

    Args:
        graph_id: UUID of the graph containing the node
        node_id: UUID of the node to read
    """
    graph = get_graph_from_storage(UUID(graph_id))
    if graph is None:
        return json.dumps({"error": f"Graph {graph_id} not found"})

    nid = UUID(node_id)
    node = graph.nodes.get(nid)
    if node is None:
        return json.dumps({"error": f"Node {node_id} not found"})

    # Look up provider info
    provider_name = None
    provider_type = None
    model = None
    if node.provider_id:
        registry = _get_registry()
        provider = registry.get_provider(str(node.provider_id))
        if provider:
            provider_name = provider.name
            provider_type = provider.type.value
            model = provider.selected_model

    result = {
        "id": str(node.id),
        "content": node.content,
        "type": node.type.value if hasattr(node.type, 'value') else str(node.type),
        "llm_response": node.llm_response,
        "llm_status": node.llm_status,
        "provider_id": str(node.provider_id) if node.provider_id else None,
        "provider_name": provider_name,
        "provider_type": provider_type,
        "model": model,
        "tags": [str(t) for t in node.meta.tags] if hasattr(node, 'meta') else [],
        "children": [str(c) for c in node.children],
        "parents": [str(p) for p in node.parents],
    }

    # Include position if available
    if hasattr(node, 'meta') and hasattr(node.meta, 'position'):
        pos = node.meta.position
        if pos:
            result["position"] = {"x": pos.get("x", 0), "y": pos.get("y", 0)}

    return json.dumps(result, indent=2)


@mcp.tool()
async def create_node(
    graph_id: str,
    content: str,
    type: str = "question",
    provider_id: Optional[str] = None,
    tags: Optional[str] = None,
    parent_ids: Optional[str] = None,
) -> str:
    """Create a new node on the canvas.

    Args:
        graph_id: UUID of the graph to add the node to
        content: Text content/prompt for the node
        type: Node type (question, answer, note, hypothesis, etc.)
        provider_id: UUID of the LLM provider to assign (optional)
        tags: Comma-separated tags (optional)
        parent_ids: Comma-separated parent node UUIDs (optional)
    """
    graph = get_graph_from_storage(UUID(graph_id))
    if graph is None:
        return json.dumps({"error": f"Graph {graph_id} not found"})

    from mindflow.models.node import Node, NodeType, NodeMetadata

    # Parse tags
    tag_list = [t.strip() for t in tags.split(",")] if tags else []

    # Parse parent IDs
    parent_list = [UUID(p.strip()) for p in parent_ids.split(",")] if parent_ids else []

    # Create node
    node = Node(
        type=type,  # Pydantic validates against the Literal type
        content=content,
        parents=parent_list,
        children=[],
        meta=NodeMetadata(tags=tag_list),
        provider_id=UUID(provider_id) if provider_id else None,
    )

    # Add to graph
    graph.nodes[node.id] = node

    # Update parent nodes' children lists
    for pid in parent_list:
        parent_node = graph.nodes.get(pid)
        if parent_node and node.id not in parent_node.children:
            parent_node.children.append(node.id)

    return json.dumps({
        "id": str(node.id),
        "content": node.content,
        "type": type,
        "provider_id": provider_id,
        "status": "idle",
    }, indent=2)


@mcp.tool()
async def update_node(
    graph_id: str,
    node_id: str,
    content: Optional[str] = None,
    tags: Optional[str] = None,
    provider_id: Optional[str] = None,
) -> str:
    """Update a node's content, tags, or provider assignment.

    Args:
        graph_id: UUID of the graph containing the node
        node_id: UUID of the node to update
        content: New text content (optional)
        tags: New comma-separated tags (optional)
        provider_id: New provider UUID (optional, use 'none' to clear)
    """
    graph = get_graph_from_storage(UUID(graph_id))
    if graph is None:
        return json.dumps({"error": f"Graph {graph_id} not found"})

    nid = UUID(node_id)
    node = graph.nodes.get(nid)
    if node is None:
        return json.dumps({"error": f"Node {node_id} not found"})

    if content is not None:
        node.content = content
    if tags is not None:
        node.meta.tags = [t.strip() for t in tags.split(",")]
    if provider_id is not None:
        if provider_id.lower() == "none":
            node.provider_id = None
        else:
            node.provider_id = UUID(provider_id)

    return json.dumps({
        "id": str(node.id),
        "content": node.content,
        "provider_id": str(node.provider_id) if node.provider_id else None,
        "status": "updated",
    }, indent=2)


@mcp.tool()
async def delete_node(graph_id: str, node_id: str) -> str:
    """Delete a node from the graph.

    Args:
        graph_id: UUID of the graph containing the node
        node_id: UUID of the node to delete
    """
    graph = get_graph_from_storage(UUID(graph_id))
    if graph is None:
        return json.dumps({"error": f"Graph {graph_id} not found"})

    nid = UUID(node_id)
    if nid not in graph.nodes:
        return json.dumps({"error": f"Node {node_id} not found"})

    node = graph.nodes[nid]

    # Remove from parent nodes' children lists
    for pid in node.parents:
        parent = graph.nodes.get(pid)
        if parent and nid in parent.children:
            parent.children.remove(nid)

    # Remove from child nodes' parents lists
    for cid in node.children:
        child = graph.nodes.get(cid)
        if child and nid in child.parents:
            child.parents.remove(nid)

    del graph.nodes[nid]

    return json.dumps({"message": f"Node {node_id} deleted"})


@mcp.tool()
async def trigger_llm(
    graph_id: str,
    node_id: str,
    system_prompt: Optional[str] = None,
) -> str:
    """Trigger LLM generation on a node using its assigned provider.

    The node must have a provider_id assigned. The operation runs asynchronously.
    Poll the node's content via read_node to see the completed response.

    Args:
        graph_id: UUID of the graph containing the node
        node_id: UUID of the node to generate on
        system_prompt: Optional system prompt override
    """
    graph = get_graph_from_storage(UUID(graph_id))
    if graph is None:
        return json.dumps({"error": f"Graph {graph_id} not found"})

    nid = UUID(node_id)
    node = graph.nodes.get(nid)
    if node is None:
        return json.dumps({"error": f"Node {node_id} not found"})

    if not node.provider_id:
        return json.dumps({"error": "Node has no provider assigned. Set provider_id first."})

    registry = _get_registry()
    provider_config = registry.get_provider(str(node.provider_id))
    if provider_config is None:
        return json.dumps({"error": f"Provider {node.provider_id} not found in registry"})

    provider_instance = registry.get_provider_instance(str(node.provider_id))
    if provider_instance is None:
        return json.dumps({"error": f"Cannot create provider instance for {provider_config.name}"})

    model = provider_config.selected_model or "default"

    # Run generation
    try:
        node.llm_status = "processing"
        response = await provider_instance.generate(
            prompt=node.content,
            model=model,
            system_prompt=system_prompt,
        )
        node.llm_response = response
        node.llm_status = "complete"

        return json.dumps({
            "status": "completed",
            "provider_name": provider_config.name,
            "model": model,
            "response_length": len(response),
        }, indent=2)
    except Exception as exc:
        node.llm_status = "error"
        node.llm_error = str(exc)
        return json.dumps({
            "error": f"LLM generation failed: {exc}",
            "provider_name": provider_config.name,
            "model": model,
        })


@mcp.tool()
async def start_debate(
    graph_id: str,
    start_node_id: str,
    max_rounds: int = 3,
) -> str:
    """Start a debate chain from a node. Connected nodes will take turns generating responses.

    The start node and all connected child nodes must have provider_id assigned.

    Args:
        graph_id: UUID of the graph
        start_node_id: UUID of the first node in the debate chain
        max_rounds: Maximum number of debate rounds (default: 3)
    """
    graph = get_graph_from_storage(UUID(graph_id))
    if graph is None:
        return json.dumps({"error": f"Graph {graph_id} not found"})

    registry = _get_registry()

    try:
        debate = await debate_engine.start_debate(
            graph=graph,
            start_node_id=UUID(start_node_id),
            max_rounds=max_rounds,
            registry=registry,
        )
        return json.dumps({
            "debate_id": str(debate.id),
            "node_ids": [str(nid) for nid in debate.node_ids],
            "status": debate.status.value,
            "max_rounds": debate.max_rounds,
        }, indent=2)
    except ValueError as exc:
        return json.dumps({"error": str(exc)})
