"""Graph API endpoints.

Graphs are persisted as self-contained JSON files in data/graphs/.
Each JSON file contains the complete workflow (nodes, connections, groups,
comments) and can be exported, imported, or copy-pasted — ComfyUI style.

In-memory cache (_graphs_storage) provides fast access; disk is the
source of truth. Every mutation auto-saves to disk.
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from uuid import UUID, uuid4
from typing import Dict, List
from pydantic import BaseModel, Field

from mindflow.models.graph import Graph, GraphMetadata
from mindflow.models.node import Node, NodeType, NodeAuthor, NodeStatus, NodeMetadata, Position
from mindflow.models.group import Group, GroupKind, GroupMetadata
from mindflow.models.comment import Comment, CommentTarget
from mindflow.models.node_version import NodeVersion, TriggerReason
from mindflow.utils.cascade import get_affected_nodes
from mindflow.api.routes.providers import _get_registry
from mindflow.services.version_storage import get_version_storage
from mindflow.services.graph_service import GraphService

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/graphs", tags=["graphs"])

# Graph persistence service (disk)
_graph_service = GraphService()

# In-memory cache for fast access (synced with disk)
_graphs_storage: Dict[str, Graph] = {}


# Helper functions for canvas integration
def add_graph_to_storage(graph: Graph) -> None:
    """Add a graph to in-memory cache AND persist to disk."""
    _graphs_storage[str(graph.id)] = graph
    _graph_service.save(graph)
    logger.info(f"Added graph {graph.id} to storage (memory + disk)")


def get_graph_from_storage(graph_id: UUID) -> Graph | None:
    """Get a graph from memory cache, falling back to disk.

    If found on disk but not in memory, loads into cache.
    """
    graph_id_str = str(graph_id)

    # Try memory first
    if graph_id_str in _graphs_storage:
        return _graphs_storage[graph_id_str]

    # Fall back to disk
    graph = _graph_service.load(graph_id)
    if graph is not None:
        _graphs_storage[graph_id_str] = graph
        logger.info(f"Loaded graph {graph_id} from disk into memory cache")
        return graph

    return None


def delete_graph_from_storage(graph_id: UUID) -> bool:
    """Delete a graph from memory AND disk."""
    graph_id_str = str(graph_id)
    deleted_memory = graph_id_str in _graphs_storage
    if deleted_memory:
        del _graphs_storage[graph_id_str]

    deleted_disk = _graph_service.delete(graph_id)

    if deleted_memory or deleted_disk:
        logger.info(f"Deleted graph {graph_id} (memory={deleted_memory}, disk={deleted_disk})")
        return True
    return False


def _ensure_graph_loaded(graph_id: str) -> None:
    """Ensure graph is in memory cache, loading from disk if needed.

    Call at the start of any endpoint that accesses _graphs_storage directly.
    """
    if graph_id not in _graphs_storage:
        graph = _graph_service.load(UUID(graph_id))
        if graph is not None:
            _graphs_storage[graph_id] = graph


def _persist_graph(graph_id: str) -> None:
    """Persist current in-memory graph state to disk.

    Called after every mutation (create/update/delete node, group, comment).
    """
    graph = _graphs_storage.get(graph_id)
    if graph is not None:
        _graph_service.save(graph)


# Request/Response Models
class CreateNodeRequest(BaseModel):
    """Request body for creating a new node."""
    type: NodeType
    content: str = Field(default="", min_length=0, max_length=10000)
    author: NodeAuthor = "human"
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    tags: list[str] = Field(default_factory=list)
    status: NodeStatus = "draft"
    parent_ids: list[str] = Field(default_factory=list)
    position: Position | None = None
    # Feature 011: Provider assignment
    provider_id: str | None = None


class ConnectionSpec(BaseModel):
    """A named port connection from a source node's output to this node's input."""
    input_name: str
    source_node_id: str
    output_name: str


class UpdateNodeRequest(BaseModel):
    """Request body for updating an existing node."""
    content: str | None = Field(None, min_length=0, max_length=10000)
    importance: float | None = Field(None, ge=0.0, le=1.0)
    tags: list[str] | None = None
    status: NodeStatus | None = None
    position: Position | None = None

    # Parent/child relationship (set when creating edges)
    parent_id: str | None = None

    # Named port connection (ComfyUI-style: input_name → source_node.output_name)
    connection: ConnectionSpec | None = None

    # Feature 009: Inline LLM Response Display
    llm_response: str | None = Field(None, max_length=100000)

    # Inline LLM Workflow fields
    llm_status: str | None = None
    llm_error: str | None = None
    prompt_height: int | None = Field(None, ge=100, le=600)
    response_height: int | None = Field(None, ge=100, le=800)
    note_top: str | None = Field(None, max_length=5000)
    note_bottom: str | None = Field(None, max_length=5000)
    collapsed: bool | None = None
    summary: str | None = Field(None, max_length=100)
    llm_operation_id: UUID | None = None
    font_size: int | None = Field(None, ge=10, le=24)
    node_width: int | None = Field(None, ge=280, le=800)
    node_height: int | None = Field(None, ge=200, le=1200)
    # Feature 011: Provider assignment & MCP tools
    provider_id: str | None = None
    mcp_tools: list[str] | None = None


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

    graph = get_graph_from_storage(UUID(graph_id))
    if graph is None:
        # Auto-create empty graph when referenced by a canvas but never persisted
        # (migration path: canvases created before disk-backed graph storage)
        logger.info(f"Graph {graph_id} not found — creating empty graph (migration)")
        graph = Graph(
            id=UUID(graph_id),
            meta=GraphMetadata(name="Migrated Graph"),
        )
        add_graph_to_storage(graph)

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
    _ensure_graph_loaded(graph_id)
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

    _ensure_graph_loaded(graph_id)
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
        provider_id=UUID(node_req.provider_id) if node_req.provider_id else None,
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

    # Persist graph to disk
    _persist_graph(graph_id)

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

    _ensure_graph_loaded(graph_id)
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

    # Feature 009: Update LLM response fields if provided
    if update_req.llm_response is not None:
        node.llm_response = update_req.llm_response
    if update_req.llm_operation_id is not None:
        node.llm_operation_id = update_req.llm_operation_id
    if update_req.font_size is not None:
        node.font_size = update_req.font_size
    if update_req.node_width is not None:
        node.node_width = update_req.node_width
    if update_req.node_height is not None:
        node.node_height = update_req.node_height

    # Inline LLM Workflow fields
    if update_req.llm_status is not None:
        node.llm_status = update_req.llm_status
    if update_req.llm_error is not None:
        node.llm_error = update_req.llm_error
    if update_req.prompt_height is not None:
        node.prompt_height = update_req.prompt_height
    if update_req.response_height is not None:
        node.response_height = update_req.response_height
    if update_req.note_top is not None:
        node.note_top = update_req.note_top
    if update_req.note_bottom is not None:
        node.note_bottom = update_req.note_bottom
    if update_req.collapsed is not None:
        node.collapsed = update_req.collapsed
    if update_req.summary is not None:
        node.summary = update_req.summary

    # Feature 011: Provider and MCP tools
    if update_req.provider_id is not None:
        node.provider_id = UUID(update_req.provider_id) if update_req.provider_id else None
    if update_req.mcp_tools is not None:
        node.mcp_tools = update_req.mcp_tools

    # Add parent relationship (edge creation via onConnect)
    if update_req.parent_id is not None:
        try:
            parent_uuid = UUID(update_req.parent_id)
            if parent_uuid in graph.nodes:
                if parent_uuid not in node.parents:
                    node.parents.append(parent_uuid)
                parent_node = graph.nodes[parent_uuid]
                if node_uuid not in parent_node.children:
                    parent_node.children.append(node_uuid)
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Parent node {update_req.parent_id} not found in graph",
                )
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"Invalid parent_id UUID: {update_req.parent_id}"
            )

    # Named port connection (ComfyUI-style)
    if update_req.connection is not None:
        conn = update_req.connection
        if not hasattr(node, "connections") or node.connections is None:
            node.connections = {}
        node.connections[conn.input_name] = {
            "source_node_id": conn.source_node_id,
            "output_name": conn.output_name,
        }

    # Update timestamp
    node.update_timestamp()
    graph.meta.updated_at = node.meta.updated_at

    # Persist graph to disk
    _persist_graph(graph_id)

    logger.info(f"Updated node {node_id}")

    # Create version after successful update
    version_storage = get_version_storage()
    version_storage.create_version(
        node_id=node_uuid,
        content=node.content,
        trigger_reason="manual_edit",
        llm_metadata=None,
    )

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

    _ensure_graph_loaded(graph_id)
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

    # Persist graph to disk
    _persist_graph(graph_id)

    logger.info(f"Deleted node {node_id} from graph {graph_id}")

    # Mark versions as deleted (soft delete - keep for recovery)
    version_storage = get_version_storage()
    version_storage.delete_node_versions(node_uuid)

    return None


# ============================================================================
# VERSION HISTORY ENDPOINTS
# ============================================================================


@router.get("/{graph_id}/nodes/{node_id}/versions")
async def get_node_versions(graph_id: str, node_id: str) -> List[NodeVersion]:
    """Get all versions for a node.

    Args:
        graph_id: UUID of the graph
        node_id: UUID of the node

    Returns:
        List of NodeVersion objects sorted by version_number (newest first)

    Raises:
        HTTPException: 404 if graph or node not found
    """
    logger.info(f"GET /api/graphs/{graph_id}/nodes/{node_id}/versions")

    _ensure_graph_loaded(graph_id)
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

    # Get versions from storage
    version_storage = get_version_storage()
    versions = version_storage.get_versions(node_uuid)

    # Return newest first
    versions.reverse()

    logger.info(f"Retrieved {len(versions)} versions for node {node_id}")
    return versions


class RestoreVersionRequest(BaseModel):
    """Request body for restoring a previous version."""
    pass  # No additional parameters needed


@router.post("/{graph_id}/nodes/{node_id}/versions/{version_id}/restore")
async def restore_node_version(
    graph_id: str, node_id: str, version_id: str, request: RestoreVersionRequest = RestoreVersionRequest()
) -> Node:
    """Restore a previous version of a node.

    This creates a NEW version with the content from the specified version.
    It does not delete or modify existing versions.

    Args:
        graph_id: UUID of the graph
        node_id: UUID of the node
        version_id: UUID of the version to restore
        request: Restore request (empty body)

    Returns:
        Updated Node object with restored content

    Raises:
        HTTPException: 404 if graph, node, or version not found
    """
    logger.info(
        f"POST /api/graphs/{graph_id}/nodes/{node_id}/versions/{version_id}/restore"
    )

    _ensure_graph_loaded(graph_id)
    if graph_id not in _graphs_storage:
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]

    try:
        node_uuid = UUID(node_id)
        version_uuid = UUID(version_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid UUID format"
        )

    if node_uuid not in graph.nodes:
        raise HTTPException(
            status_code=404, detail=f"Node with ID {node_id} not found in graph"
        )

    # Get the version to restore
    version_storage = get_version_storage()
    version_to_restore = version_storage.get_version_by_id(version_uuid)

    if version_to_restore is None:
        raise HTTPException(
            status_code=404, detail=f"Version with ID {version_id} not found"
        )

    if version_to_restore.node_id != node_uuid:
        raise HTTPException(
            status_code=400,
            detail=f"Version {version_id} does not belong to node {node_id}",
        )

    # Update node content with restored version
    node = graph.nodes[node_uuid]
    node.content = version_to_restore.content
    node.update_timestamp()
    graph.meta.updated_at = node.meta.updated_at

    # Create a new version to record the rollback
    version_storage.create_version(
        node_id=node_uuid,
        content=node.content,
        trigger_reason="rollback",
        llm_metadata={
            "restored_from_version": version_to_restore.version_number,
            "restored_version_id": str(version_to_restore.version_id),
        },
    )

    logger.info(
        f"Restored node {node_id} to version {version_to_restore.version_number}"
    )
    return node


class RegenerateCascadeRequest(BaseModel):
    """Request body for cascade regeneration."""
    modified_node_id: str = Field(description="UUID of the node that was modified")
    llm_provider: str = Field(description="LLM provider type (openai, anthropic, ollama, chatgpt_web, gemini)")
    llm_model: str = Field(description="LLM model identifier")


class RegenerateCascadeResponse(BaseModel):
    """Response for cascade regeneration."""
    success: bool
    affected_nodes: List[str]
    regenerated_count: int
    errors: List[Dict[str, str]] = Field(default_factory=list)
    message: str


# Group Request/Response Models
class CreateGroupRequest(BaseModel):
    """Request body for creating a new group."""
    label: str = Field(min_length=1, max_length=100)
    kind: GroupKind = "cluster"
    color: str | None = None
    pinned_nodes: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    parent_group: str | None = None


class UpdateGroupRequest(BaseModel):
    """Request body for updating a group."""
    label: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = None
    pinned_nodes: list[str] | None = None
    tags: list[str] | None = None


# Comment Request/Response Models
class CreateCommentRequest(BaseModel):
    """Request body for creating a new comment."""
    content: str = Field(min_length=1, max_length=5000)
    author: NodeAuthor = "human"
    node_id: str | None = None
    edge: tuple[str, str] | None = None
    position: Position | None = None


class UpdateCommentRequest(BaseModel):
    """Request body for updating a comment."""
    content: str = Field(min_length=1, max_length=5000)


@router.post("/{graph_id}/regenerate-cascade")
async def regenerate_cascade(
    graph_id: str, request: RegenerateCascadeRequest
) -> RegenerateCascadeResponse:
    """Regenerate all nodes downstream from a modified node.

    This endpoint implements the cascade regeneration algorithm:
    1. Find all descendants of the modified node
    2. Sort them topologically (parents before children)
    3. For each node, regenerate content using LLM based on parent nodes
    4. Update node content and timestamp

    Args:
        graph_id: UUID of the graph
        request: Cascade regeneration request with modified_node_id and LLM config

    Returns:
        Response with success status, affected nodes, and any errors

    Raises:
        HTTPException: 404 if graph or node not found, 400 for validation errors
    """
    logger.info(f"POST /api/graphs/{graph_id}/regenerate-cascade - node={request.modified_node_id}")

    _ensure_graph_loaded(graph_id)
    if graph_id not in _graphs_storage:
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]

    # Validate modified node ID
    try:
        modified_node_uuid = UUID(request.modified_node_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid UUID format: {request.modified_node_id}"
        )

    if modified_node_uuid not in graph.nodes:
        raise HTTPException(
            status_code=404,
            detail=f"Modified node {request.modified_node_id} not found in graph",
        )

    # Get affected nodes in topological order
    try:
        affected_node_ids = get_affected_nodes(graph, modified_node_uuid)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Error computing cascade: {str(e)}")

    if not affected_node_ids:
        logger.info(f"No descendants found for node {request.modified_node_id}")
        return RegenerateCascadeResponse(
            success=True,
            affected_nodes=[],
            regenerated_count=0,
            message="No downstream nodes to regenerate",
        )

    logger.info(
        f"Found {len(affected_node_ids)} nodes to regenerate in cascade order"
    )

    # Resolve provider from registry
    registry = _get_registry()
    provider = None
    for p_config in registry.list_providers():
        if p_config.type.value == request.llm_provider:
            provider = registry.get_provider_instance(str(p_config.id))
            if provider:
                break
    if provider is None:
        raise HTTPException(
            status_code=400,
            detail=f"Provider '{request.llm_provider}' not configured. Add it in Provider Settings.",
        )

    # Regenerate each node in order
    regenerated_count = 0
    errors = []

    for node_uuid in affected_node_ids:
        try:
            node = graph.nodes[node_uuid]

            # Get parent nodes for context
            parent_nodes = [
                graph.nodes[parent_uuid]
                for parent_uuid in node.parents
                if parent_uuid in graph.nodes
            ]

            # Store previous content
            previous_content = node.content

            # Build context from parents and generate
            context_parts = []
            for i, parent in enumerate(parent_nodes, 1):
                context_parts.append(f"Parent Node {i} ({parent.type}):\n{parent.content}\n")
            context_text = "\n".join(context_parts)
            prompt = f"Context:\n{context_text}\n\n"
            if previous_content:
                prompt += f"Previous Content:\n{previous_content}\n\n"
            prompt += f"Generate content for a {node.type} node based on the context."

            response = await provider.generate(
                prompt=prompt,
                model=request.llm_model,
            )
            new_content = response.content

            # Update node
            node.content = new_content
            node.update_timestamp()

            # Create version for cascade regeneration
            version_storage = get_version_storage()
            version_storage.create_version(
                node_id=node_uuid,
                content=new_content,
                trigger_reason="parent_cascade",
                llm_metadata={
                    "provider": request.llm_provider,
                    "model": request.llm_model,
                    "previous_content": previous_content,
                },
            )

            regenerated_count += 1
            logger.info(f"Regenerated node {node_uuid} ({node.type})")

        except Exception as e:
            error_msg = f"Error regenerating node {node_uuid}: {str(e)}"
            logger.error(error_msg)
            errors.append({"node_id": str(node_uuid), "error": str(e)})

    # Update graph timestamp
    from datetime import UTC, datetime
    graph.meta.updated_at = datetime.now(UTC)
    _persist_graph(graph_id)

    success = regenerated_count > 0 and len(errors) == 0
    message = (
        f"Successfully regenerated {regenerated_count} nodes"
        if success
        else f"Regenerated {regenerated_count} nodes with {len(errors)} errors"
    )

    logger.info(
        f"Cascade regeneration complete: {regenerated_count} nodes, {len(errors)} errors"
    )

    return RegenerateCascadeResponse(
        success=success,
        affected_nodes=[str(nid) for nid in affected_node_ids],
        regenerated_count=regenerated_count,
        errors=errors,
        message=message,
    )


# ============================================================================
# GROUP ENDPOINTS
# ============================================================================

@router.post("/{graph_id}/groups", status_code=201)
async def create_group(graph_id: str, group_req: CreateGroupRequest) -> Group:
    """Create a new group in the graph.

    Args:
        graph_id: UUID of the graph
        group_req: Group creation request body

    Returns:
        Created Group object

    Raises:
        HTTPException: 404 if graph not found, 400 if validation fails
    """
    logger.info(f"POST /api/graphs/{graph_id}/groups - label={group_req.label}")

    _ensure_graph_loaded(graph_id)
    if graph_id not in _graphs_storage:
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]

    # Validate parent group if specified
    parent_group_uuid = None
    if group_req.parent_group:
        try:
            parent_group_uuid = UUID(group_req.parent_group)
            if parent_group_uuid not in graph.groups:
                raise HTTPException(
                    status_code=400,
                    detail=f"Parent group {group_req.parent_group} not found in graph",
                )
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"Invalid UUID format: {group_req.parent_group}"
            )

    # Validate pinned nodes
    pinned_node_uuids = []
    for node_id_str in group_req.pinned_nodes:
        try:
            node_uuid = UUID(node_id_str)
            if node_uuid not in graph.nodes:
                raise HTTPException(
                    status_code=400,
                    detail=f"Pinned node {node_id_str} not found in graph",
                )
            pinned_node_uuids.append(node_uuid)
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"Invalid UUID format: {node_id_str}"
            )

    # Create group metadata
    metadata = GroupMetadata(
        color=group_req.color,
        pinned_nodes=pinned_node_uuids,
        tags=group_req.tags,
    )

    # Create the group
    new_group = Group(
        label=group_req.label,
        kind=group_req.kind,
        parent_group=parent_group_uuid,
        meta=metadata,
    )

    # Add group to graph
    graph.groups[new_group.id] = new_group

    # Update graph timestamp
    from datetime import UTC, datetime
    graph.meta.updated_at = datetime.now(UTC)
    _persist_graph(graph_id)

    logger.info(f"Created group {new_group.id} with label '{new_group.label}'")
    return new_group


@router.put("/{graph_id}/groups/{group_id}")
async def update_group(
    graph_id: str, group_id: str, update_req: UpdateGroupRequest
) -> Group:
    """Update an existing group.

    Args:
        graph_id: UUID of the graph
        group_id: UUID of the group to update
        update_req: Group update request body

    Returns:
        Updated Group object

    Raises:
        HTTPException: 404 if graph or group not found
    """
    logger.info(f"PUT /api/graphs/{graph_id}/groups/{group_id}")

    _ensure_graph_loaded(graph_id)
    if graph_id not in _graphs_storage:
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]

    try:
        group_uuid = UUID(group_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: {group_id}")

    if group_uuid not in graph.groups:
        raise HTTPException(
            status_code=404, detail=f"Group with ID {group_id} not found in graph"
        )

    group = graph.groups[group_uuid]

    # Update fields if provided
    if update_req.label is not None:
        group.label = update_req.label
    if update_req.color is not None:
        group.meta.color = update_req.color
    if update_req.pinned_nodes is not None:
        # Validate pinned nodes
        pinned_node_uuids = []
        for node_id_str in update_req.pinned_nodes:
            try:
                node_uuid = UUID(node_id_str)
                if node_uuid not in graph.nodes:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Pinned node {node_id_str} not found in graph",
                    )
                pinned_node_uuids.append(node_uuid)
            except ValueError:
                raise HTTPException(
                    status_code=400, detail=f"Invalid UUID format: {node_id_str}"
                )
        group.meta.pinned_nodes = pinned_node_uuids
    if update_req.tags is not None:
        group.meta.tags = update_req.tags

    # Update graph timestamp
    from datetime import UTC, datetime
    graph.meta.updated_at = datetime.now(UTC)
    _persist_graph(graph_id)

    logger.info(f"Updated group {group_id}")
    return group


@router.delete("/{graph_id}/groups/{group_id}", status_code=204)
async def delete_group(graph_id: str, group_id: str) -> None:
    """Delete a group from the graph.

    Args:
        graph_id: UUID of the graph
        group_id: UUID of the group to delete

    Raises:
        HTTPException: 404 if graph or group not found
    """
    logger.info(f"DELETE /api/graphs/{graph_id}/groups/{group_id}")

    _ensure_graph_loaded(graph_id)
    if graph_id not in _graphs_storage:
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]

    try:
        group_uuid = UUID(group_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: {group_id}")

    if group_uuid not in graph.groups:
        raise HTTPException(
            status_code=404, detail=f"Group with ID {group_id} not found in graph"
        )

    # Remove group from nodes' groups lists
    for node in graph.nodes.values():
        if group_uuid in node.groups:
            node.groups.remove(group_uuid)

    # Remove group from graph
    del graph.groups[group_uuid]

    # Update graph timestamp
    from datetime import UTC, datetime
    graph.meta.updated_at = datetime.now(UTC)
    _persist_graph(graph_id)

    logger.info(f"Deleted group {group_id} from graph {graph_id}")
    return None


# ============================================================================
# COMMENT ENDPOINTS
# ============================================================================

@router.post("/{graph_id}/comments", status_code=201)
async def create_comment(graph_id: str, comment_req: CreateCommentRequest) -> Comment:
    """Create a new comment in the graph.

    Args:
        graph_id: UUID of the graph
        comment_req: Comment creation request body

    Returns:
        Created Comment object

    Raises:
        HTTPException: 404 if graph not found, 400 if validation fails
    """
    logger.info(f"POST /api/graphs/{graph_id}/comments - author={comment_req.author}")

    _ensure_graph_loaded(graph_id)
    if graph_id not in _graphs_storage:
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]

    # Validate that either node_id or edge is provided (not both)
    if comment_req.node_id and comment_req.edge:
        raise HTTPException(
            status_code=400,
            detail="Comment cannot be attached to both a node and an edge",
        )

    if not comment_req.node_id and not comment_req.edge and not comment_req.position:
        raise HTTPException(
            status_code=400,
            detail="Comment must be attached to a node, edge, or have a position (for floating comments)",
        )

    # Build attached_to based on request
    attached_to: CommentTarget = {}

    if comment_req.node_id:
        try:
            node_uuid = UUID(comment_req.node_id)
            if node_uuid not in graph.nodes:
                raise HTTPException(
                    status_code=400,
                    detail=f"Node {comment_req.node_id} not found in graph",
                )
            attached_to["node"] = node_uuid
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"Invalid UUID format: {comment_req.node_id}"
            )

    if comment_req.edge:
        try:
            parent_uuid = UUID(comment_req.edge[0])
            child_uuid = UUID(comment_req.edge[1])
            if parent_uuid not in graph.nodes or child_uuid not in graph.nodes:
                raise HTTPException(
                    status_code=400,
                    detail=f"Edge nodes not found in graph",
                )
            attached_to["edge"] = (parent_uuid, child_uuid)
        except (ValueError, IndexError):
            raise HTTPException(
                status_code=400, detail=f"Invalid edge format: {comment_req.edge}"
            )

    # Create the comment
    new_comment = Comment(
        author=comment_req.author,
        content=comment_req.content,
        attached_to=attached_to,
    )

    # Add comment to graph
    graph.comments[new_comment.id] = new_comment

    # Update graph timestamp
    from datetime import UTC, datetime
    graph.meta.updated_at = datetime.now(UTC)
    _persist_graph(graph_id)

    logger.info(f"Created comment {new_comment.id}")
    return new_comment


@router.put("/{graph_id}/comments/{comment_id}")
async def update_comment(
    graph_id: str, comment_id: str, update_req: UpdateCommentRequest
) -> Comment:
    """Update an existing comment.

    Args:
        graph_id: UUID of the graph
        comment_id: UUID of the comment to update
        update_req: Comment update request body

    Returns:
        Updated Comment object

    Raises:
        HTTPException: 404 if graph or comment not found
    """
    logger.info(f"PUT /api/graphs/{graph_id}/comments/{comment_id}")

    _ensure_graph_loaded(graph_id)
    if graph_id not in _graphs_storage:
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]

    try:
        comment_uuid = UUID(comment_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid UUID format: {comment_id}"
        )

    if comment_uuid not in graph.comments:
        raise HTTPException(
            status_code=404, detail=f"Comment with ID {comment_id} not found in graph"
        )

    comment = graph.comments[comment_uuid]

    # Update content
    comment.content = update_req.content

    # Update graph timestamp
    from datetime import UTC, datetime
    graph.meta.updated_at = datetime.now(UTC)
    _persist_graph(graph_id)

    logger.info(f"Updated comment {comment_id}")
    return comment


@router.delete("/{graph_id}/comments/{comment_id}", status_code=204)
async def delete_comment(graph_id: str, comment_id: str) -> None:
    """Delete a comment from the graph.

    Args:
        graph_id: UUID of the graph
        comment_id: UUID of the comment to delete

    Raises:
        HTTPException: 404 if graph or comment not found
    """
    logger.info(f"DELETE /api/graphs/{graph_id}/comments/{comment_id}")

    _ensure_graph_loaded(graph_id)
    if graph_id not in _graphs_storage:
        raise HTTPException(
            status_code=404, detail=f"Graph with ID {graph_id} not found"
        )

    graph = _graphs_storage[graph_id]

    try:
        comment_uuid = UUID(comment_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid UUID format: {comment_id}"
        )

    if comment_uuid not in graph.comments:
        raise HTTPException(
            status_code=404, detail=f"Comment with ID {comment_id} not found in graph"
        )

    # Remove comment from graph
    del graph.comments[comment_uuid]

    # Update graph timestamp
    from datetime import UTC, datetime
    graph.meta.updated_at = datetime.now(UTC)
    _persist_graph(graph_id)

    logger.info(f"Deleted comment {comment_id} from graph {graph_id}")
    return None


# ============================================================================
# SUMMARIZE GROUP (Feature 011 - US2)
# ============================================================================


class SummarizeGroupRequest(BaseModel):
    """Request to summarize a group of nodes."""
    node_ids: List[str]
    provider_id: str
    position: dict = Field(default_factory=lambda: {"x": 0, "y": 0})


class SummarizeGroupResponse(BaseModel):
    summary_node_id: str
    content: str
    message: str


@router.post("/{graph_id}/nodes/summarize-group", response_model=SummarizeGroupResponse, status_code=201)
async def summarize_group(graph_id: str, request: SummarizeGroupRequest):
    """Generate a summary node from a group of nodes using a provider.

    Collects content from all specified nodes, sends to the designated
    provider with a summarization prompt, creates a new node with the summary.
    """
    graph = get_graph_from_storage(UUID(graph_id))
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")

    # Collect content from nodes
    contents = []
    for nid_str in request.node_ids:
        nid = UUID(nid_str)
        node = graph.nodes.get(nid)
        if node is None:
            raise HTTPException(status_code=404, detail=f"Node {nid_str} not found")
        text = node.content or ""
        if node.llm_response:
            text += f"\n\n[Response]: {node.llm_response}"
        contents.append(f"[Node {nid_str[:8]}]: {text}")

    combined = "\n\n---\n\n".join(contents)

    # Get provider and generate summary
    from mindflow.api.routes.providers import _get_registry
    registry = _get_registry()
    provider_instance = registry.get_provider_instance(request.provider_id)
    if provider_instance is None:
        raise HTTPException(status_code=422, detail=f"Provider {request.provider_id} not available")

    provider_config = registry.get_provider(request.provider_id)
    model = provider_config.selected_model if provider_config else "default"

    try:
        summary = await provider_instance.generate(
            prompt=f"Summarize the following conversation/discussion between multiple nodes:\n\n{combined}",
            model=model or "default",
            system_prompt="You are a summarizer. Provide a concise, clear summary of the key points, agreements, disagreements, and conclusions from the discussion.",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Summary generation failed: {exc}")

    # Create summary node
    pos = request.position
    summary_node = Node(
        type=NodeType.SUMMARY,
        author=NodeAuthor.LLM,
        content=f"Summary of {len(request.node_ids)} nodes",
        parents=[UUID(nid) for nid in request.node_ids],
        children=[],
        meta=NodeMetadata(
            status=NodeStatus.FINAL,
            importance=0.8,
            position=Position(x=pos.get("x", 0), y=pos.get("y", 0)),
        ),
        provider_id=UUID(request.provider_id),
        llm_response=summary,
        llm_status="complete",
    )

    graph.nodes[summary_node.id] = summary_node

    # Add as child of source nodes
    for nid_str in request.node_ids:
        parent = graph.nodes.get(UUID(nid_str))
        if parent and summary_node.id not in parent.children:
            parent.children.append(summary_node.id)

    # Persist graph to disk
    _persist_graph(graph_id)

    return SummarizeGroupResponse(
        summary_node_id=str(summary_node.id),
        content=summary,
        message=f"Summary generated from {len(request.node_ids)} nodes",
    )


# ============================================================================
# EXPORT / IMPORT (ComfyUI-style JSON workflows)
# ============================================================================


@router.get("/{graph_id}/export")
async def export_graph(graph_id: str):
    """Export graph as self-contained JSON (copy-paste ready).

    Returns the complete graph JSON that can be shared, imported,
    or pasted into another MindFlow instance.
    """
    graph = get_graph_from_storage(UUID(graph_id))
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")

    from fastapi.responses import JSONResponse
    import json

    return JSONResponse(
        content=json.loads(graph.to_json()),
        headers={"Content-Disposition": f'attachment; filename="graph-{graph_id[:8]}.json"'},
    )


class ImportGraphRequest(BaseModel):
    """Request body for importing a graph from JSON."""
    graph_json: dict = Field(description="Complete graph JSON object")
    new_name: str | None = Field(None, description="Optional new name for the imported graph")


@router.post("/import", status_code=201)
async def import_graph(request: ImportGraphRequest):
    """Import a graph from JSON (pasted or uploaded).

    Creates a new graph from the provided JSON. The graph keeps its
    internal structure (node IDs, connections) but gets stored as-is.

    Use this for:
    - Pasting a shared workflow
    - Importing a saved graph backup
    - Loading an "arbre mort" (dead tree) to extend
    """
    import json

    try:
        json_str = json.dumps(request.graph_json)
        graph = Graph.from_json(json_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid graph JSON: {e}")

    # Optionally rename
    if request.new_name:
        graph.meta.name = request.new_name

    # Store in memory and disk
    add_graph_to_storage(graph)

    logger.info(f"Imported graph {graph.id} with {len(graph.nodes)} nodes")
    return {
        "graph_id": str(graph.id),
        "name": graph.meta.name,
        "node_count": len(graph.nodes),
        "message": f"Imported graph with {len(graph.nodes)} nodes",
    }
