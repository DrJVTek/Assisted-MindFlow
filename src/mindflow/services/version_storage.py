"""Version storage service for managing node version history.

This service handles:
- Creating new versions when nodes are modified
- Loading version history for a node
- Archiving old versions (keeping only the last N versions)
- Restoring previous versions
"""

import json
import logging
from pathlib import Path
from typing import List
from uuid import UUID

from mindflow.models.node_version import NodeVersion, TriggerReason
from mindflow.utils.paths import get_data_dir

logger = logging.getLogger(__name__)

# Configuration
MAX_VERSIONS_PER_NODE = 10  # Keep only the last 10 versions


class VersionStorage:
    """Service for managing node version storage.

    Versions are stored in JSON files organized by node ID:
        data/versions/{node_id}/versions.json

    Each file contains a list of NodeVersion objects for that node.
    """

    def __init__(self, data_dir: Path | None = None):
        """Initialize version storage.

        Args:
            data_dir: Root data directory (defaults to get_data_dir())
        """
        self.data_dir = data_dir or get_data_dir()
        self.versions_dir = self.data_dir / "versions"
        self.versions_dir.mkdir(parents=True, exist_ok=True)

    def _get_node_versions_file(self, node_id: UUID) -> Path:
        """Get the path to a node's versions file.

        Args:
            node_id: Node UUID

        Returns:
            Path to versions.json for this node
        """
        node_dir = self.versions_dir / str(node_id)
        node_dir.mkdir(parents=True, exist_ok=True)
        return node_dir / "versions.json"

    def create_version(
        self,
        node_id: UUID,
        content: str,
        trigger_reason: TriggerReason,
        llm_metadata: dict | None = None,
    ) -> NodeVersion:
        """Create a new version for a node.

        Args:
            node_id: Node UUID
            content: Content snapshot
            trigger_reason: Why this version was created
            llm_metadata: Optional LLM metadata (model, tokens, etc.)

        Returns:
            Created NodeVersion object

        Side Effects:
            - Saves version to disk
            - Archives old versions if limit exceeded
        """
        # Load existing versions
        existing_versions = self.get_versions(node_id)

        # Determine next version number
        if existing_versions:
            version_number = max(v.version_number for v in existing_versions) + 1
        else:
            version_number = 1

        # Create new version
        new_version = NodeVersion(
            node_id=node_id,
            version_number=version_number,
            content=content,
            trigger_reason=trigger_reason,
            llm_metadata=llm_metadata,
        )

        # Add to list
        existing_versions.append(new_version)

        # Archive old versions if limit exceeded
        if len(existing_versions) > MAX_VERSIONS_PER_NODE:
            # Keep only the last MAX_VERSIONS_PER_NODE versions
            existing_versions = existing_versions[-MAX_VERSIONS_PER_NODE:]
            logger.info(
                f"Archived old versions for node {node_id}, "
                f"keeping last {MAX_VERSIONS_PER_NODE}"
            )

        # Save to disk
        self._save_versions(node_id, existing_versions)

        logger.info(
            f"Created version {version_number} for node {node_id} "
            f"(reason: {trigger_reason})"
        )

        return new_version

    def get_versions(self, node_id: UUID) -> List[NodeVersion]:
        """Get all versions for a node.

        Args:
            node_id: Node UUID

        Returns:
            List of NodeVersion objects sorted by version_number (oldest first)
        """
        versions_file = self._get_node_versions_file(node_id)

        if not versions_file.exists():
            return []

        try:
            with open(versions_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            versions = [NodeVersion.model_validate(v) for v in data]
            # Sort by version number
            versions.sort(key=lambda v: v.version_number)
            return versions

        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Error loading versions for node {node_id}: {e}")
            return []

    def get_version(self, node_id: UUID, version_number: int) -> NodeVersion | None:
        """Get a specific version for a node.

        Args:
            node_id: Node UUID
            version_number: Version number to retrieve

        Returns:
            NodeVersion object if found, None otherwise
        """
        versions = self.get_versions(node_id)
        for version in versions:
            if version.version_number == version_number:
                return version
        return None

    def get_version_by_id(self, version_id: UUID) -> NodeVersion | None:
        """Get a version by its version_id.

        Note: This requires searching all version files, so it's slower.
        Prefer get_version() if you know the node_id and version_number.

        Args:
            version_id: Version UUID

        Returns:
            NodeVersion object if found, None otherwise
        """
        # Search all node version directories
        for node_dir in self.versions_dir.iterdir():
            if not node_dir.is_dir():
                continue

            try:
                node_id = UUID(node_dir.name)
                versions = self.get_versions(node_id)
                for version in versions:
                    if version.version_id == version_id:
                        return version
            except ValueError:
                # Invalid UUID directory name, skip
                continue

        return None

    def _save_versions(self, node_id: UUID, versions: List[NodeVersion]) -> None:
        """Save versions list to disk.

        Args:
            node_id: Node UUID
            versions: List of NodeVersion objects to save
        """
        versions_file = self._get_node_versions_file(node_id)

        # Convert to JSON
        data = [v.model_dump(mode="json") for v in versions]

        # Save with pretty printing
        with open(versions_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def delete_node_versions(self, node_id: UUID) -> None:
        """Delete all versions for a node (soft delete support).

        This is called when a node is deleted, but we keep the versions
        for potential recovery or audit purposes.

        Note: This does NOT actually delete the files, just logs the operation.
        Versions remain on disk for recovery.

        Args:
            node_id: Node UUID
        """
        versions_file = self._get_node_versions_file(node_id)
        if versions_file.exists():
            logger.info(
                f"Node {node_id} deleted - versions preserved at {versions_file}"
            )
        # Don't actually delete - keep for recovery/audit


# Singleton instance
_version_storage: VersionStorage | None = None


def get_version_storage() -> VersionStorage:
    """Get the global VersionStorage instance.

    Returns:
        VersionStorage singleton instance
    """
    global _version_storage
    if _version_storage is None:
        _version_storage = VersionStorage()
    return _version_storage
