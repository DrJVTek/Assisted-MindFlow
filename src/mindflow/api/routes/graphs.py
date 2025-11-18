"""Graph API endpoints."""

import logging
from fastapi import APIRouter, HTTPException, Query
from uuid import UUID, uuid4
from typing import Dict
from pydantic import BaseModel, Field

from mindflow.models.graph import Graph
from mindflow.models.node import Node, NodeType, NodeAuthor, NodeStatus, NodeMetadata, Position

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/graphs", tags=["graphs"])


# Temporary in-memory storage for development
_graphs_storage: Dict[str, Graph] = {}


# Request/Response Models
class CreateNodeRequest(BaseModel):
    """Request body for creating a new node."""
    type: NodeType
    content: str = Field(min_length=1, max_length=10000)
    author: NodeAuthor = "human"
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    tags: list[str] = Field(default_factory=list)
    status: NodeStatus = "draft"
    parent_ids: list[str] = Field(default_factory=list)
    position: Position | None = None


class UpdateNodeRequest(BaseModel):
    """Request body for updating an existing node."""
    content: str | None = Field(None, min_length=1, max_length=10000)
    importance: float | None = Field(None, ge=0.0, le=1.0)
    tags: list[str] | None = None
    status: NodeStatus | None = None
    position: Position | None = None


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


@router.post("/{graph_id}/nodes", status_code=201)
async def create_node(graph_id: str, node_req: CreateNodeRequest) -> Node:
    """Create a new node in the graph.

    Args:
        graph_id: UUID of the graph
        node_req: Node creation request body

    Returns:
        Created Node object

    Raises:
        HTTPException: 404 if graph not found, 400 if parent nodes don't exist
    """
    logger.info(f"POST /api/graphs/{graph_id}/nodes - type={node_req.type}")

    if graph_id not in _graphs_storage:
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]

    # Validate parent nodes exist
    parent_uuids = []
    for parent_id_str in node_req.parent_ids:
        try:
            parent_uuid = UUID(parent_id_str)
            if parent_uuid not in graph.nodes:
                raise HTTPException(
                    status_code=400,
                    detail=f"Parent node {parent_id_str} not found in graph",
                )
            parent_uuids.append(parent_uuid)
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"Invalid UUID format: {parent_id_str}"
            )

    # Create node metadata
    metadata = NodeMetadata(
        importance=node_req.importance,
        tags=node_req.tags,
        status=node_req.status,
        position=node_req.position,
    )

    # Create the node
    new_node = Node(
        type=node_req.type,
        author=node_req.author,
        content=node_req.content,
        parents=parent_uuids,
        children=[],
        meta=metadata,
    )

    # Add node to graph
    graph.nodes[new_node.id] = new_node

    # Update parent nodes' children lists
    for parent_uuid in parent_uuids:
        parent_node = graph.nodes[parent_uuid]
        if new_node.id not in parent_node.children:
            parent_node.children.append(new_node.id)
            parent_node.update_timestamp()

    # Update graph timestamp
    graph.meta.updated_at = new_node.meta.created_at

    logger.info(f"Created node {new_node.id} of type {new_node.type}")
    return new_node


@router.put("/{graph_id}/nodes/{node_id}")
async def update_node(
    graph_id: str, node_id: str, update_req: UpdateNodeRequest
) -> Node:
    """Update an existing node.

    Args:
        graph_id: UUID of the graph
        node_id: UUID of the node to update
        update_req: Node update request body

    Returns:
        Updated Node object

    Raises:
        HTTPException: 404 if graph or node not found
    """
    logger.info(f"PUT /api/graphs/{graph_id}/nodes/{node_id}")

    if graph_id not in _graphs_storage:
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]

    try:
        node_uuid = UUID(node_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: {node_id}")

    if node_uuid not in graph.nodes:
        raise HTTPException(
            status_code=404, detail=f"Node with ID {node_id} not found in graph"
        )

    node = graph.nodes[node_uuid]

    # Update fields if provided
    if update_req.content is not None:
        node.content = update_req.content
    if update_req.importance is not None:
        node.meta.importance = update_req.importance
    if update_req.tags is not None:
        node.meta.tags = update_req.tags
    if update_req.status is not None:
        node.meta.status = update_req.status
    if update_req.position is not None:
        node.meta.position = update_req.position

    # Update timestamp
    node.update_timestamp()
    graph.meta.updated_at = node.meta.updated_at

    logger.info(f"Updated node {node_id}")
    return node


@router.delete("/{graph_id}/nodes/{node_id}", status_code=204)
async def delete_node(graph_id: str, node_id: str) -> None:
    """Delete a node from the graph (soft delete - removes from graph but preserves data).

    Args:
        graph_id: UUID of the graph
        node_id: UUID of the node to delete

    Raises:
        HTTPException: 404 if graph or node not found
    """
    logger.info(f"DELETE /api/graphs/{graph_id}/nodes/{node_id}")

    if graph_id not in _graphs_storage:
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]

    try:
        node_uuid = UUID(node_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: {node_id}")

    if node_uuid not in graph.nodes:
        raise HTTPException(
            status_code=404, detail=f"Node with ID {node_id} not found in graph"
        )

    node = graph.nodes[node_uuid]

    # Remove node from parent nodes' children lists
    for parent_uuid in node.parents:
        if parent_uuid in graph.nodes:
            parent_node = graph.nodes[parent_uuid]
            if node_uuid in parent_node.children:
                parent_node.children.remove(node_uuid)
                parent_node.update_timestamp()

    # Remove node from children nodes' parent lists
    for child_uuid in node.children:
        if child_uuid in graph.nodes:
            child_node = graph.nodes[child_uuid]
            if node_uuid in child_node.parents:
                child_node.parents.remove(node_uuid)
                child_node.update_timestamp()

    # Remove node from graph
    del graph.nodes[node_uuid]

    # Update graph timestamp
    from datetime import UTC, datetime

    graph.meta.updated_at = datetime.now(UTC)

    logger.info(f"Deleted node {node_id} from graph {graph_id}")
    return None
