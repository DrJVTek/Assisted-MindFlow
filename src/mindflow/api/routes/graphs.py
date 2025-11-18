"""Graph API endpoints."""

import logging
from fastapi import APIRouter, HTTPException, Query
from uuid import UUID
from typing import Dict

from mindflow.models.graph import Graph
from mindflow.models.node import Node

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/graphs", tags=["graphs"])


# Temporary in-memory storage for development
# TODO: Replace with actual database/file storage
_graphs_storage: Dict[str, Graph] = {}


@router.get("/{graph_id}")
async def get_graph(graph_id: str) -> Graph:
    """Get complete graph data with all nodes, groups, and comments.

    Args:
        graph_id: UUID of the graph to retrieve

    Returns:
        Complete Graph object

    Raises:
        HTTPException: 404 if graph not found
    """
    logger.info(f"GET /api/graphs/{graph_id}")

    if graph_id not in _graphs_storage:
        logger.warning(f"Graph not found: {graph_id}")
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]
    logger.info(f"Retrieved graph {graph_id} with {len(graph.nodes)} nodes")
    return graph


@router.get("/{graph_id}/nodes")
async def get_graph_nodes(
    graph_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> Dict:
    """Get graph nodes only (paginated).

    Args:
        graph_id: UUID of the graph
        limit: Maximum number of nodes to return (1-1000)
        offset: Number of nodes to skip

    Returns:
        Dictionary with nodes, total count, limit, and offset

    Raises:
        HTTPException: 404 if graph not found
    """
    if graph_id not in _graphs_storage:
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]
    all_nodes = list(graph.nodes.values())
    total = len(all_nodes)

    # Paginate
    paginated_nodes = all_nodes[offset : offset + limit]

    # Convert to dict format
    nodes_dict = {node.id: node for node in paginated_nodes}

    return {"nodes": nodes_dict, "total": total, "limit": limit, "offset": offset}


# Helper function to add a graph to storage (for development/testing)
def add_graph_to_storage(graph: Graph) -> None:
    """Add a graph to in-memory storage.

    Args:
        graph: Graph object to store
    """
    _graphs_storage[str(graph.id)] = graph
