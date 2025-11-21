"""Canvas API routes for multi-canvas workspace management.

Provides CRUD operations for Canvas entities.
"""

import logging
from datetime import UTC, datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from mindflow.models.canvas import Canvas
from mindflow.models.graph import Graph, GraphMetadata
from mindflow.services.canvas_service import CanvasService
from mindflow.api.routes import graphs

# Configure logging
logger = logging.getLogger(__name__)

# Create router for canvas endpoints
router = APIRouter(prefix="/canvases", tags=["canvases"])

# Initialize canvas service
canvas_service = CanvasService()


# Request/Response Models
class CreateCanvasRequest(BaseModel):
    """Request body for creating a new canvas."""
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    owner_id: Optional[str] = None


class UpdateCanvasRequest(BaseModel):
    """Request body for updating an existing canvas."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)


class CanvasListResponse(BaseModel):
    """Response model for canvas list."""
    canvases: list[Canvas]
    total: int
    limit: int
    offset: int


# T011: GET /api/canvases - List all canvases with pagination
@router.get("", response_model=CanvasListResponse)
async def list_canvases(
    owner_id: Optional[str] = Query(None, description="Filter by owner ID"),
    search: Optional[str] = Query(None, description="Search in canvas names"),
    limit: int = Query(default=100, ge=1, le=1000, description="Max canvases to return"),
    offset: int = Query(default=0, ge=0, description="Number of canvases to skip"),
) -> CanvasListResponse:
    """List all canvases with optional filtering and pagination.

    Args:
        owner_id: Optional owner ID filter
        search: Optional search term for canvas names (case-insensitive)
        limit: Maximum number of canvases to return (1-1000)
        offset: Number of canvases to skip for pagination

    Returns:
        CanvasListResponse with canvases, total count, limit, and offset
    """
    logger.info(f"GET /api/canvases (owner_id={owner_id}, search={search}, limit={limit}, offset={offset})")

    # Get all canvases (filtered by owner if specified)
    all_canvases = canvas_service.list_all(owner_id=owner_id)

    # Apply search filter if provided
    if search:
        search_lower = search.lower()
        all_canvases = [
            c for c in all_canvases if search_lower in c.name.lower()
        ]

    total = len(all_canvases)

    # Apply pagination
    paginated_canvases = all_canvases[offset : offset + limit]

    logger.info(f"Returning {len(paginated_canvases)} canvases out of {total} total")
    return CanvasListResponse(
        canvases=paginated_canvases,
        total=total,
        limit=limit,
        offset=offset,
    )


# T012: POST /api/canvases - Create new canvas
@router.post("", response_model=Canvas, status_code=201)
async def create_canvas(request: CreateCanvasRequest) -> Canvas:
    """Create a new canvas with an associated empty graph.

    Args:
        request: Canvas creation request with name, description, owner_id

    Returns:
        Newly created Canvas instance

    Raises:
        HTTPException: 400 if name validation fails or 409 if name already exists
    """
    logger.info(f"POST /api/canvases (name={request.name}, owner_id={request.owner_id})")

    # Validate name uniqueness
    if canvas_service.name_exists(request.name, owner_id=request.owner_id):
        logger.warning(f"Canvas name already exists: {request.name}")
        raise HTTPException(
            status_code=409,
            detail=f"Canvas with name '{request.name}' already exists for this user",
        )

    try:
        # Create canvas with new graph
        canvas, graph = canvas_service.create_with_graph(
            name=request.name,
            description=request.description,
            owner_id=request.owner_id,
        )

        # Save canvas
        canvas_service.save(canvas)

        # Store graph in graphs storage
        graphs.add_graph_to_storage(graph)

        logger.info(f"Created canvas {canvas.id} with graph {graph.id}")
        return canvas

    except Exception as e:
        logger.error(f"Error creating canvas: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# T013: GET /api/canvases/{canvas_id} - Get single canvas
@router.get("/{canvas_id}", response_model=Canvas)
async def get_canvas(canvas_id: UUID) -> Canvas:
    """Get a single canvas by ID.

    Args:
        canvas_id: UUID of the canvas to retrieve

    Returns:
        Canvas instance

    Raises:
        HTTPException: 404 if canvas not found
    """
    logger.info(f"GET /api/canvases/{canvas_id}")

    canvas = canvas_service.load(canvas_id)
    if canvas is None:
        logger.warning(f"Canvas not found: {canvas_id}")
        raise HTTPException(
            status_code=404,
            detail=f"Canvas with ID {canvas_id} not found",
        )

    # Update last_opened timestamp
    canvas.last_opened = datetime.now(UTC)
    canvas_service.save(canvas)

    logger.info(f"Retrieved canvas {canvas_id}: {canvas.name}")
    return canvas


# T014: PUT /api/canvases/{canvas_id} - Update canvas
@router.put("/{canvas_id}", response_model=Canvas)
async def update_canvas(canvas_id: UUID, request: UpdateCanvasRequest) -> Canvas:
    """Update an existing canvas's metadata.

    Args:
        canvas_id: UUID of the canvas to update
        request: Update request with optional name and description

    Returns:
        Updated Canvas instance

    Raises:
        HTTPException: 404 if canvas not found, 409 if name conflict
    """
    logger.info(f"PUT /api/canvases/{canvas_id}")

    # Load existing canvas
    canvas = canvas_service.load(canvas_id)
    if canvas is None:
        logger.warning(f"Canvas not found: {canvas_id}")
        raise HTTPException(
            status_code=404,
            detail=f"Canvas with ID {canvas_id} not found",
        )

    # Update name if provided
    if request.name is not None:
        # Check name uniqueness (excluding this canvas)
        if canvas_service.name_exists(
            request.name, owner_id=canvas.owner_id, exclude_id=canvas_id
        ):
            logger.warning(f"Canvas name already exists: {request.name}")
            raise HTTPException(
                status_code=409,
                detail=f"Canvas with name '{request.name}' already exists",
            )
        canvas.name = request.name

    # Update description if provided
    if request.description is not None:
        canvas.description = request.description

    # Update timestamp
    canvas.updated_at = datetime.now(UTC)

    # Save updated canvas
    canvas_service.save(canvas)

    logger.info(f"Updated canvas {canvas_id}: {canvas.name}")
    return canvas


# T015: DELETE /api/canvases/{canvas_id} - Delete canvas
@router.delete("/{canvas_id}", status_code=204)
async def delete_canvas(canvas_id: UUID) -> None:
    """Delete a canvas and its associated graph.

    Args:
        canvas_id: UUID of the canvas to delete

    Raises:
        HTTPException: 404 if canvas not found
    """
    logger.info(f"DELETE /api/canvases/{canvas_id}")

    # Load canvas to get graph_id
    canvas = canvas_service.load(canvas_id)
    if canvas is None:
        logger.warning(f"Canvas not found: {canvas_id}")
        raise HTTPException(
            status_code=404,
            detail=f"Canvas with ID {canvas_id} not found",
        )

    # Delete associated graph from storage
    graphs.delete_graph_from_storage(canvas.graph_id)

    # Delete canvas file
    canvas_service.delete(canvas_id)

    logger.info(f"Deleted canvas {canvas_id} and its graph {canvas.graph_id}")


# T016: POST /api/canvases/{canvas_id}/duplicate - Duplicate canvas
@router.post("/{canvas_id}/duplicate", response_model=Canvas, status_code=201)
async def duplicate_canvas(
    canvas_id: UUID,
    new_name: Optional[str] = Query(None, description="Name for duplicated canvas"),
) -> Canvas:
    """Duplicate an existing canvas with its graph.

    Args:
        canvas_id: UUID of the canvas to duplicate
        new_name: Optional new name for the duplicate (defaults to "Copy of {original_name}")

    Returns:
        Newly created duplicate Canvas instance

    Raises:
        HTTPException: 404 if canvas not found, 409 if name conflict
    """
    logger.info(f"POST /api/canvases/{canvas_id}/duplicate (new_name={new_name})")

    # Load original canvas
    original_canvas = canvas_service.load(canvas_id)
    if original_canvas is None:
        logger.warning(f"Canvas not found: {canvas_id}")
        raise HTTPException(
            status_code=404,
            detail=f"Canvas with ID {canvas_id} not found",
        )

    # Generate new name
    if new_name is None:
        new_name = f"Copy of {original_canvas.name}"

    # Check name uniqueness
    if canvas_service.name_exists(new_name, owner_id=original_canvas.owner_id):
        # Add number suffix to make unique
        counter = 2
        while canvas_service.name_exists(
            f"{new_name} ({counter})", owner_id=original_canvas.owner_id
        ):
            counter += 1
        new_name = f"{new_name} ({counter})"

    # Load original graph
    original_graph = graphs.get_graph_from_storage(original_canvas.graph_id)
    if original_graph is None:
        logger.error(f"Graph not found: {original_canvas.graph_id}")
        raise HTTPException(
            status_code=500,
            detail="Associated graph not found",
        )

    # Create new graph as copy (new ID)
    graph_meta = GraphMetadata(
        name=new_name,
        description=original_graph.meta.description,
    )
    new_graph = Graph(
        meta=graph_meta,
        nodes=original_graph.nodes.copy(),
        groups=original_graph.groups.copy(),
        comments=original_graph.comments.copy(),
        subgraph_instances=original_graph.subgraph_instances.copy(),
        complexity_score=original_graph.complexity_score,
    )

    # Create new canvas
    new_canvas = Canvas(
        name=new_name,
        description=original_canvas.description,
        graph_id=new_graph.id,
        is_subgraph=original_canvas.is_subgraph,
        owner_id=original_canvas.owner_id,
    )

    # Save canvas and graph
    canvas_service.save(new_canvas)
    graphs.add_graph_to_storage(new_graph)

    logger.info(f"Duplicated canvas {canvas_id} to {new_canvas.id}: {new_name}")
    return new_canvas
