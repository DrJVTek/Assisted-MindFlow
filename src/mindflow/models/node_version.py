"""Node Version model for MindFlow Engine.

A NodeVersion represents a snapshot of a node's content at a specific point in time.
Versions are created on every edit, regeneration, or rollback operation.
"""

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


TriggerReason = Literal["manual_edit", "parent_cascade", "user_regen", "rollback"]


class NodeVersion(BaseModel):
    """A version snapshot of a Node's content.

    Versions are immutable records of node state changes. They enable:
    - History tracking: See all changes to a node over time
    - Comparison: Diff between versions
    - Rollback: Restore previous content

    Attributes:
        version_id: Unique identifier for this version
        node_id: Parent node UUID this version belongs to
        version_number: Sequential version number (1, 2, 3...)
        content: Content snapshot from this version
        created_at: Timestamp when this version was created
        trigger_reason: Why this version was created
        llm_metadata: Optional metadata about LLM generation (model, tokens, etc.)

    Storage:
        - Stored in JSON files per node: data/versions/{node_id}/versions.json
        - Each node has a list of versions sorted by version_number
        - Limit: 10 versions per node (configurable)
        - Older versions are archived/deleted when limit exceeded

    Example:
        >>> version = NodeVersion(
        ...     node_id=node.id,
        ...     version_number=1,
        ...     content="Original content",
        ...     trigger_reason="manual_edit"
        ... )
    """

    version_id: UUID = Field(default_factory=uuid4)
    node_id: UUID
    version_number: int = Field(ge=1)  # Must be >= 1
    content: str = Field(min_length=1, max_length=10000)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    trigger_reason: TriggerReason
    llm_metadata: dict | None = None  # Optional: {model, tokens, provider, etc.}
