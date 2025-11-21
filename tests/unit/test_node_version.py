"""Unit tests for NodeVersion model and version storage.

Tests cover:
- NodeVersion creation with required fields
- Default values (UUID, timestamps)
- Validation rules (content length, version number)
- JSON serialization/deserialization
- Version storage operations (create, get, archive)
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from datetime import UTC, datetime
from uuid import UUID, uuid4
from pydantic import ValidationError

from mindflow.models.node_version import NodeVersion, TriggerReason
from mindflow.services.version_storage import VersionStorage, MAX_VERSIONS_PER_NODE


class TestNodeVersion:
    """Tests for NodeVersion model."""

    def test_version_creation_minimal(self) -> None:
        """Test creating version with required fields."""
        node_id = uuid4()
        version = NodeVersion(
            node_id=node_id,
            version_number=1,
            content="Original content",
            trigger_reason="manual_edit"
        )

        assert isinstance(version.version_id, UUID)
        assert version.node_id == node_id
        assert version.version_number == 1
        assert version.content == "Original content"
        assert version.trigger_reason == "manual_edit"
        assert isinstance(version.created_at, datetime)
        assert version.llm_metadata is None

    def test_version_creation_with_metadata(self) -> None:
        """Test creating version with LLM metadata."""
        node_id = uuid4()
        metadata = {
            "provider": "openai",
            "model": "gpt-4",
            "tokens": 150
        }

        version = NodeVersion(
            node_id=node_id,
            version_number=2,
            content="Regenerated content",
            trigger_reason="parent_cascade",
            llm_metadata=metadata
        )

        assert version.llm_metadata == metadata
        assert version.trigger_reason == "parent_cascade"

    def test_version_unique_id_generation(self) -> None:
        """Test that each version gets a unique UUID by default."""
        node_id = uuid4()
        version1 = NodeVersion(
            node_id=node_id,
            version_number=1,
            content="First",
            trigger_reason="manual_edit"
        )
        version2 = NodeVersion(
            node_id=node_id,
            version_number=2,
            content="Second",
            trigger_reason="manual_edit"
        )

        assert version1.version_id != version2.version_id

    def test_version_number_validation_positive(self) -> None:
        """Test version_number must be >= 1."""
        with pytest.raises(ValidationError):
            NodeVersion(
                node_id=uuid4(),
                version_number=0,
                content="Test",
                trigger_reason="manual_edit"
            )

    def test_version_number_min_value(self) -> None:
        """Test version_number accepts 1."""
        version = NodeVersion(
            node_id=uuid4(),
            version_number=1,
            content="Test",
            trigger_reason="manual_edit"
        )
        assert version.version_number == 1

    def test_trigger_reason_validation(self) -> None:
        """Test trigger_reason accepts only valid literals."""
        valid_reasons: list[TriggerReason] = [
            "manual_edit", "parent_cascade", "user_regen", "rollback"
        ]

        node_id = uuid4()
        for reason in valid_reasons:
            version = NodeVersion(
                node_id=node_id,
                version_number=1,
                content="Test",
                trigger_reason=reason
            )
            assert version.trigger_reason == reason

    def test_invalid_trigger_reason(self) -> None:
        """Test invalid trigger_reason raises ValidationError."""
        with pytest.raises(ValidationError):
            NodeVersion(
                node_id=uuid4(),
                version_number=1,
                content="Test",
                trigger_reason="unknown"  # type: ignore
            )

    def test_content_min_length(self) -> None:
        """Test content must be at least 1 character."""
        with pytest.raises(ValidationError):
            NodeVersion(
                node_id=uuid4(),
                version_number=1,
                content="",
                trigger_reason="manual_edit"
            )

    def test_content_max_length(self) -> None:
        """Test content cannot exceed 10000 characters."""
        long_content = "x" * 10001

        with pytest.raises(ValidationError):
            NodeVersion(
                node_id=uuid4(),
                version_number=1,
                content=long_content,
                trigger_reason="manual_edit"
            )

    def test_json_serialization(self) -> None:
        """Test version can be serialized to JSON."""
        version = NodeVersion(
            node_id=uuid4(),
            version_number=3,
            content="Test content",
            trigger_reason="rollback",
            llm_metadata={"restored_from": 1}
        )

        json_data = version.model_dump()

        assert json_data["version_number"] == 3
        assert json_data["content"] == "Test content"
        assert json_data["trigger_reason"] == "rollback"
        assert json_data["llm_metadata"] == {"restored_from": 1}

    def test_json_round_trip(self) -> None:
        """Test serialization + deserialization preserves data."""
        original = NodeVersion(
            node_id=uuid4(),
            version_number=5,
            content="Original content",
            trigger_reason="parent_cascade",
            llm_metadata={"provider": "anthropic", "model": "claude-3"}
        )

        json_data = original.model_dump()
        restored = NodeVersion.model_validate(json_data)

        assert restored.version_id == original.version_id
        assert restored.node_id == original.node_id
        assert restored.version_number == original.version_number
        assert restored.content == original.content
        assert restored.trigger_reason == original.trigger_reason
        assert restored.llm_metadata == original.llm_metadata


class TestVersionStorage:
    """Tests for VersionStorage service."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for tests."""
        temp = tempfile.mkdtemp()
        yield Path(temp)
        shutil.rmtree(temp)

    @pytest.fixture
    def storage(self, temp_dir):
        """Create a VersionStorage instance with temp directory."""
        return VersionStorage(data_dir=temp_dir)

    def test_create_first_version(self, storage: VersionStorage) -> None:
        """Test creating the first version for a node."""
        node_id = uuid4()

        version = storage.create_version(
            node_id=node_id,
            content="First version",
            trigger_reason="manual_edit"
        )

        assert version.node_id == node_id
        assert version.version_number == 1
        assert version.content == "First version"
        assert version.trigger_reason == "manual_edit"

    def test_create_multiple_versions(self, storage: VersionStorage) -> None:
        """Test creating multiple versions increments version_number."""
        node_id = uuid4()

        v1 = storage.create_version(node_id, "Version 1", "manual_edit")
        v2 = storage.create_version(node_id, "Version 2", "manual_edit")
        v3 = storage.create_version(node_id, "Version 3", "parent_cascade")

        assert v1.version_number == 1
        assert v2.version_number == 2
        assert v3.version_number == 3

    def test_get_versions_empty(self, storage: VersionStorage) -> None:
        """Test getting versions for node with no versions."""
        node_id = uuid4()
        versions = storage.get_versions(node_id)

        assert versions == []

    def test_get_versions_sorted(self, storage: VersionStorage) -> None:
        """Test get_versions returns versions sorted by version_number."""
        node_id = uuid4()

        storage.create_version(node_id, "V1", "manual_edit")
        storage.create_version(node_id, "V2", "manual_edit")
        storage.create_version(node_id, "V3", "manual_edit")

        versions = storage.get_versions(node_id)

        assert len(versions) == 3
        assert versions[0].version_number == 1
        assert versions[1].version_number == 2
        assert versions[2].version_number == 3
        assert versions[0].content == "V1"
        assert versions[1].content == "V2"
        assert versions[2].content == "V3"

    def test_get_specific_version(self, storage: VersionStorage) -> None:
        """Test getting a specific version by version_number."""
        node_id = uuid4()

        storage.create_version(node_id, "V1", "manual_edit")
        storage.create_version(node_id, "V2", "manual_edit")
        v3 = storage.create_version(node_id, "V3", "manual_edit")

        retrieved = storage.get_version(node_id, 3)

        assert retrieved is not None
        assert retrieved.version_id == v3.version_id
        assert retrieved.content == "V3"

    def test_get_version_not_found(self, storage: VersionStorage) -> None:
        """Test getting non-existent version returns None."""
        node_id = uuid4()

        storage.create_version(node_id, "V1", "manual_edit")

        retrieved = storage.get_version(node_id, 99)
        assert retrieved is None

    def test_get_version_by_id(self, storage: VersionStorage) -> None:
        """Test getting version by version_id."""
        node_id = uuid4()

        v1 = storage.create_version(node_id, "V1", "manual_edit")
        v2 = storage.create_version(node_id, "V2", "manual_edit")

        retrieved = storage.get_version_by_id(v2.version_id)

        assert retrieved is not None
        assert retrieved.version_id == v2.version_id
        assert retrieved.content == "V2"

    def test_version_limit_archiving(self, storage: VersionStorage) -> None:
        """Test that old versions are archived when limit exceeded."""
        node_id = uuid4()

        # Create more than MAX_VERSIONS_PER_NODE versions
        for i in range(MAX_VERSIONS_PER_NODE + 5):
            storage.create_version(
                node_id,
                f"Version {i+1}",
                "manual_edit"
            )

        versions = storage.get_versions(node_id)

        # Should only have MAX_VERSIONS_PER_NODE versions
        assert len(versions) == MAX_VERSIONS_PER_NODE

        # Should be the latest versions
        assert versions[0].version_number == 6  # (15 total - 10 kept + 1)
        assert versions[-1].version_number == 15

    def test_version_with_llm_metadata(self, storage: VersionStorage) -> None:
        """Test creating version with LLM metadata."""
        node_id = uuid4()
        metadata = {
            "provider": "openai",
            "model": "gpt-4-turbo",
            "tokens": 200,
            "cost": 0.05
        }

        version = storage.create_version(
            node_id,
            "LLM generated content",
            "user_regen",
            llm_metadata=metadata
        )

        assert version.llm_metadata == metadata

        # Verify it's persisted
        retrieved = storage.get_version(node_id, 1)
        assert retrieved is not None
        assert retrieved.llm_metadata == metadata

    def test_delete_node_versions_preserves_data(self, storage: VersionStorage) -> None:
        """Test delete_node_versions preserves data (soft delete)."""
        node_id = uuid4()

        storage.create_version(node_id, "V1", "manual_edit")
        storage.create_version(node_id, "V2", "manual_edit")

        # Delete (should preserve data)
        storage.delete_node_versions(node_id)

        # Versions should still be accessible
        versions = storage.get_versions(node_id)
        assert len(versions) == 2

    def test_versions_file_persistence(self, storage: VersionStorage) -> None:
        """Test that versions are persisted to disk."""
        node_id = uuid4()

        storage.create_version(node_id, "Persisted V1", "manual_edit")
        storage.create_version(node_id, "Persisted V2", "manual_edit")

        # Create new storage instance pointing to same directory
        storage2 = VersionStorage(data_dir=storage.data_dir)

        # Should be able to load versions
        versions = storage2.get_versions(node_id)
        assert len(versions) == 2
        assert versions[0].content == "Persisted V1"
        assert versions[1].content == "Persisted V2"

    def test_concurrent_nodes(self, storage: VersionStorage) -> None:
        """Test version storage handles multiple nodes independently."""
        node1_id = uuid4()
        node2_id = uuid4()

        storage.create_version(node1_id, "Node1 V1", "manual_edit")
        storage.create_version(node2_id, "Node2 V1", "manual_edit")
        storage.create_version(node1_id, "Node1 V2", "manual_edit")

        v1 = storage.get_versions(node1_id)
        v2 = storage.get_versions(node2_id)

        assert len(v1) == 2
        assert len(v2) == 1
        assert v1[0].content == "Node1 V1"
        assert v2[0].content == "Node2 V1"
