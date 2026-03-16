"""Composite node API routes.

Provides:
- POST /api/graphs/{graph_id}/composites — create composite from selection
- GET /api/graphs/{graph_id}/composites — list composite definitions
"""

import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from mindflow.api.routes.graphs import get_graph_from_storage, add_graph_to_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/graphs", tags=["composites"])


class CreateCompositeRequest(BaseModel):
    name: str
    node_ids: list[str]
    exposed_params: dict = {}


@router.post("/{graph_id}/composites")
async def create_composite(graph_id: str, request: CreateCompositeRequest) -> dict:
    """Create a composite node definition from selected nodes.

    Extracts the selected nodes and their connections into a sub-graph,
    stores it as a composite definition in the graph.
    """
    try:
        gid = UUID(graph_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid graph ID: {graph_id}")

    graph = get_graph_from_storage(gid)
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")

    # Validate all node IDs exist
    selected_ids = set()
    for nid_str in request.node_ids:
        try:
            nid = UUID(nid_str)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid node ID: {nid_str}")
        if nid not in graph.nodes:
            raise HTTPException(status_code=404, detail=f"Node {nid_str} not found")
        selected_ids.add(nid)

    if len(selected_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 nodes for a composite")

    # Build internal graph from selected nodes
    internal_nodes = {}
    for nid in selected_ids:
        node = graph.nodes[nid]
        internal_children = [str(c) for c in node.children if c in selected_ids]
        internal_parents = [str(p) for p in node.parents if p in selected_ids]
        internal_nodes[str(nid)] = {
            "children": internal_children,
            "parents": internal_parents,
            "class_type": node.class_type or "text_input",
            "content": node.content,
        }

    # Detect inputs: nodes with external parents (parents not in selection)
    inputs = {}
    for nid in selected_ids:
        node = graph.nodes[nid]
        external_parents = [p for p in node.parents if p not in selected_ids]
        if external_parents or not node.parents:
            inputs[f"input_{str(nid)[:8]}"] = {
                "type": "STRING",
                "maps_to": {"node": str(nid), "input": "text"},
            }

    # Detect outputs: nodes with no internal children
    outputs = []
    for nid in selected_ids:
        node = graph.nodes[nid]
        internal_children = [c for c in node.children if c in selected_ids]
        if not internal_children:
            outputs.append({
                "type": "STRING",
                "maps_from": {"node": str(nid), "output": 0},
            })

    # Generate composite definition ID
    composite_id = f"{request.name.lower().replace(' ', '_')}_v1"

    definition = {
        "name": request.name,
        "version": "1.0",
        "exposed_params": request.exposed_params,
        "inputs": inputs,
        "outputs": outputs,
        "internal_graph": {"nodes": internal_nodes},
    }

    # Store in graph
    graph.composite_definitions[composite_id] = definition
    add_graph_to_storage(graph)

    return {
        "composite_id": composite_id,
        "definition": definition,
    }


@router.get("/{graph_id}/composites")
async def list_composites(graph_id: str) -> dict:
    """List all composite definitions in this graph."""
    try:
        gid = UUID(graph_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid graph ID: {graph_id}")

    graph = get_graph_from_storage(gid)
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")

    return {
        "composites": graph.composite_definitions,
    }
