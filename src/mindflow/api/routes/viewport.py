"""Viewport API endpoints."""

from fastapi import APIRouter, HTTPException
from typing import Dict
from pydantic import BaseModel

from mindflow.api.schemas.viewport import CanvasViewport

router = APIRouter(prefix="/graphs", tags=["viewport"])


# Response model for viewport save
class ViewportSaveResponse(BaseModel):
    """Response model for viewport save operation."""

    success: bool
    message: str


# Temporary in-memory storage for viewport state
# TODO: Replace with actual database/file storage or session storage
_viewport_storage: Dict[str, CanvasViewport] = {}


@router.post("/{graph_id}/viewport")
async def save_viewport(graph_id: str, viewport: CanvasViewport) -> ViewportSaveResponse:
    """Save viewport state for a graph.

    Args:
        graph_id: UUID of the graph
        viewport: CanvasViewport state to save

    Returns:
        Success response with message
    """
    _viewport_storage[graph_id] = viewport

    return ViewportSaveResponse(success=True, message="Viewport state saved")


@router.get("/{graph_id}/viewport")
async def get_viewport(graph_id: str) -> CanvasViewport:
    """Get saved viewport state for a graph.

    Args:
        graph_id: UUID of the graph

    Returns:
        CanvasViewport state (default if not found)
    """
    # Return saved viewport or default
    if graph_id in _viewport_storage:
        return _viewport_storage[graph_id]

    # Return default viewport (fit-to-view)
    return CanvasViewport(zoom=1.0, x=0.0, y=0.0, width=1920, height=1080)
