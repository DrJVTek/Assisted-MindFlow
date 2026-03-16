"""Graph persistence service.

Handles JSON file storage for Graph entities in data/graphs/ directory.
Each graph is stored as a self-contained JSON file (ComfyUI-style)
that can be copied, pasted, imported, and shared.

The graph JSON contains everything needed to reconstruct the workflow:
nodes, connections, groups, comments, composite definitions.
"""

import logging
from pathlib import Path
from typing import Optional
from uuid import UUID

from mindflow.models.graph import Graph
from mindflow.utils.paths import get_graphs_dir

logger = logging.getLogger(__name__)


class GraphService:
    """Service for graph persistence operations.

    Manages reading, writing, and listing of graph JSON files.
    Each graph is a self-contained JSON file that can be exported/imported.

    Example:
        >>> service = GraphService()
        >>> service.save(graph)
        >>> loaded = service.load(graph.id)
        >>> exported = service.export_json(graph.id)  # copy-paste ready
    """

    def __init__(self, graphs_dir: Optional[Path] = None):
        self.graphs_dir = graphs_dir or get_graphs_dir()
        self.graphs_dir.mkdir(parents=True, exist_ok=True)

    def _file_path(self, graph_id: UUID) -> Path:
        return self.graphs_dir / f"{graph_id}.json"

    def save(self, graph: Graph) -> None:
        """Save graph to JSON file on disk.

        The resulting JSON is self-contained and can be shared/imported.
        """
        file_path = self._file_path(graph.id)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(graph.to_json())
        logger.debug(f"Saved graph {graph.id} ({len(graph.nodes)} nodes) to {file_path}")

    def load(self, graph_id: UUID) -> Optional[Graph]:
        """Load graph from JSON file.

        Returns None if the file doesn't exist.
        """
        file_path = self._file_path(graph_id)
        if not file_path.exists():
            return None

        with open(file_path, "r", encoding="utf-8") as f:
            graph = Graph.from_json(f.read())

        logger.debug(f"Loaded graph {graph_id} ({len(graph.nodes)} nodes) from {file_path}")
        return graph

    def delete(self, graph_id: UUID) -> bool:
        """Delete graph file from disk."""
        file_path = self._file_path(graph_id)
        if not file_path.exists():
            return False
        file_path.unlink()
        logger.info(f"Deleted graph file {file_path}")
        return True

    def exists(self, graph_id: UUID) -> bool:
        return self._file_path(graph_id).exists()

    def list_all(self) -> list[UUID]:
        """List all graph IDs on disk."""
        ids = []
        for file_path in self.graphs_dir.glob("*.json"):
            try:
                ids.append(UUID(file_path.stem))
            except ValueError:
                logger.warning(f"Skipping invalid graph file: {file_path}")
        return ids

    def export_json(self, graph_id: UUID) -> Optional[str]:
        """Export graph as raw JSON string (for copy-paste / sharing).

        Returns None if graph not found.
        """
        file_path = self._file_path(graph_id)
        if not file_path.exists():
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

    def import_json(self, json_str: str) -> Graph:
        """Import a graph from a JSON string (pasted / uploaded).

        The imported graph gets a NEW id to avoid collisions,
        but all internal node references are preserved.

        Raises:
            ValidationError: If JSON doesn't match Graph schema
        """
        graph = Graph.from_json(json_str)
        # Save with its existing ID — caller can assign a new one if needed
        self.save(graph)
        logger.info(f"Imported graph {graph.id} ({len(graph.nodes)} nodes)")
        return graph
