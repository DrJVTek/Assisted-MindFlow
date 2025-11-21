"""Canvas model for MindFlow multi-canvas workspace.

A Canvas is a named container that holds a single Graph instance,
enabling users to organize and manage multiple separate graphs.
"""

from datetime import UTC, datetime
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class Canvas(BaseModel):
    """A Canvas representing a named workspace containing a graph.

    Attributes:
        id: Unique identifier for this canvas
        name: Human-readable name (1-200 chars, must be unique per user)
        description: Optional longer description (max 1000 chars)
        graph_id: Reference to the Graph contained in this canvas
        created_at: Timestamp when canvas was created
        updated_at: Timestamp when canvas was last modified
        last_opened: Timestamp when canvas was last opened by user
        thumbnail: Optional base64-encoded thumbnail image for preview
        is_subgraph: Whether this canvas is a reusable sub-graph template
        owner_id: Optional user identifier for multi-user support

    Validation Rules:
        - name must be 1-200 characters
        - name must be unique per owner_id
        - graph_id must reference an existing Graph
        - description max 1000 characters

    Persistence:
        - Stored as JSON file in data/canvases/{canvas_id}.json
        - Each canvas has exactly one associated graph

    Example:
        >>> canvas = Canvas(
        ...     name="Project Alpha",
        ...     description="Main reasoning graph for alpha project",
        ...     graph_id=some_graph.id,
        ...     owner_id="user123"
        ... )
        >>> print(canvas.name)  # "Project Alpha"
    """

    id: UUID = Field(default_factory=uuid4)
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    graph_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_opened: datetime = Field(default_factory=lambda: datetime.now(UTC))
    thumbnail: Optional[str] = None
    is_subgraph: bool = False
    owner_id: Optional[str] = None

    def to_json(self) -> str:
        """Serialize canvas to JSON string.

        Returns:
            JSON string with 2-space indentation
        """
        return self.model_dump_json(indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> "Canvas":
        """Deserialize canvas from JSON string.

        Args:
            json_str: JSON string containing serialized canvas

        Returns:
            Canvas instance reconstructed from JSON

        Raises:
            ValidationError: If JSON is invalid or doesn't match schema
        """
        return cls.model_validate_json(json_str)
