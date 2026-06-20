"""Canvas persistence service for managing canvas storage.

Handles JSON file storage for Canvas entities in data/canvases/ directory.
"""

import json
from pathlib import Path
from typing import Optional
from uuid import UUID

from mindflow.models.canvas import Canvas
from mindflow.models.graph import Graph, GraphMetadata
from mindflow.utils.paths import get_data_dir


class CanvasService:
    """Service for canvas persistence operations.

    Manages creation, reading, updating, and deletion of canvas files
    in the data/canvases/ directory. Each canvas is stored as a separate
    JSON file named {canvas_id}.json.

    Example:
        >>> service = CanvasService()
        >>> canvas = Canvas(name="My Canvas", graph_id=some_uuid)
        >>> service.save(canvas)
        >>> loaded = service.load(canvas.id)
        >>> print(loaded.name)  # "My Canvas"
    """

    def __init__(self, data_dir: Optional[Path] = None):
        """Initialize canvas service.

        Args:
            data_dir: Optional custom data directory path.
                     Defaults to project data/ directory.
        """
        self.data_dir = data_dir or get_data_dir()
        self.canvases_dir = self.data_dir / "canvases"
        self.canvases_dir.mkdir(parents=True, exist_ok=True)

    def save(self, canvas: Canvas) -> None:
        """Save canvas to JSON file.

        Args:
            canvas: Canvas instance to save

        Raises:
            IOError: If file cannot be written
        """
        file_path = self.canvases_dir / f"{canvas.id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(canvas.to_json())

    def load(self, canvas_id: UUID) -> Optional[Canvas]:
        """Load canvas from JSON file.

        Args:
            canvas_id: UUID of canvas to load

        Returns:
            Canvas instance if found, None otherwise

        Raises:
            ValidationError: If JSON is invalid
        """
        file_path = self.canvases_dir / f"{canvas_id}.json"
        if not file_path.exists():
            return None

        with open(file_path, "r", encoding="utf-8") as f:
            return Canvas.from_json(f.read())

    def list_all(self, owner_id: Optional[str] = None) -> list[Canvas]:
        """List all canvases, optionally filtered by owner.

        Args:
            owner_id: Optional owner ID to filter by

        Returns:
            List of Canvas instances

        Raises:
            ValidationError: If any JSON file is invalid
        """
        canvases = []
        for file_path in self.canvases_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    canvas = Canvas.from_json(f.read())
                    if owner_id is None or canvas.owner_id == owner_id:
                        canvases.append(canvas)
            except Exception as e:
                # Log error but continue processing other files
                print(f"Warning: Failed to load {file_path}: {e}")
                continue

        # Sort by last_opened descending (most recent first)
        canvases.sort(key=lambda c: c.last_opened, reverse=True)
        return canvases

    def delete(self, canvas_id: UUID) -> bool:
        """Delete canvas file.

        Args:
            canvas_id: UUID of canvas to delete

        Returns:
            True if deleted, False if not found
        """
        file_path = self.canvases_dir / f"{canvas_id}.json"
        if not file_path.exists():
            return False

        file_path.unlink()
        return True

    def exists(self, canvas_id: UUID) -> bool:
        """Check if canvas exists.

        Args:
            canvas_id: UUID of canvas to check

        Returns:
            True if canvas file exists, False otherwise
        """
        file_path = self.canvases_dir / f"{canvas_id}.json"
        return file_path.exists()

    def name_exists(self, name: str, owner_id: Optional[str] = None, exclude_id: Optional[UUID] = None) -> bool:
        """Check if canvas name already exists for this owner.

        Args:
            name: Canvas name to check
            owner_id: Optional owner ID to check within
            exclude_id: Optional canvas ID to exclude from check (for updates)

        Returns:
            True if name exists, False otherwise
        """
        canvases = self.list_all(owner_id=owner_id)
        for canvas in canvases:
            if canvas.name == name and canvas.id != exclude_id:
                return True
        return False

    def create_with_graph(
        self,
        name: str,
        description: Optional[str] = None,
        owner_id: Optional[str] = None,
    ) -> tuple[Canvas, Graph]:
        """Create a new canvas with an associated empty graph.

        Convenience method that creates both a canvas and its graph in one step.

        Args:
            name: Canvas name
            description: Optional canvas description
            owner_id: Optional owner ID

        Returns:
            Tuple of (Canvas, Graph) instances

        Example:
            >>> service = CanvasService()
            >>> canvas, graph = service.create_with_graph("New Project")
            >>> print(canvas.name)  # "New Project"
            >>> print(len(graph.nodes))  # 0
        """
        # Create empty graph
        graph_meta = GraphMetadata(name=name, description=description or "")
        graph = Graph(meta=graph_meta)

        # Create canvas referencing the graph
        canvas = Canvas(
            name=name,
            description=description,
            graph_id=graph.id,
            owner_id=owner_id,
        )

        return canvas, graph
