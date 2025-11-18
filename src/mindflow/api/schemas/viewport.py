"""Pydantic schemas for canvas viewport state."""

from pydantic import BaseModel, Field


class CanvasViewport(BaseModel):
    """Canvas viewport state.

    Represents the current view state of the infinite canvas including
    zoom level, pan offset, and viewport dimensions.
    """

    zoom: float = Field(
        default=1.0, ge=0.25, le=4.0, description="Zoom level (0.25 = 25%, 4.0 = 400%)"
    )
    x: float = Field(default=0.0, description="X-axis pan offset in canvas coordinates")
    y: float = Field(default=0.0, description="Y-axis pan offset in canvas coordinates")
    width: int = Field(gt=0, description="Viewport width in pixels")
    height: int = Field(gt=0, description="Viewport height in pixels")

    model_config = {"json_schema_extra": {"example": {"zoom": 1.0, "x": 0, "y": 0, "width": 1920, "height": 1080}}}
