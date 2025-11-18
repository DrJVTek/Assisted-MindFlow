"""Group model for MindFlow Engine.

A Group is a hierarchical container for organizing related nodes.
Groups can be projects, clusters, subgroups, or auto-generated.
"""

from datetime import UTC, datetime
from typing import Literal, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


# Type definitions
GroupKind = Literal["project", "cluster", "subgroup", "generated", "auto"]


class GroupMetadata(BaseModel):
    """Metadata for a Group.

    Attributes:
        color: Hex color code for UI visualization (e.g., "#FF5733")
        pinned_nodes: List of node IDs that should be prominently displayed
        created_at: Timestamp when group was created
        tags: User-defined tags for categorization
    """

    color: Optional[str] = None
    pinned_nodes: list[UUID] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    tags: list[str] = Field(default_factory=list)


class Group(BaseModel):
    """A Group for organizing nodes hierarchically.

    Groups form a tree structure where each group can have at most one parent.
    They organize nodes thematically and support project reusability.

    Attributes:
        id: Unique identifier (UUID)
        label: Human-readable name (1-100 characters)
        kind: Type of group (project, cluster, subgroup, generated, auto)
        parent_group: Optional parent group ID for hierarchy
        meta: Metadata including color, pinned nodes, timestamps, tags

    Invariants:
        - Group hierarchy must be acyclic (no group can be its own ancestor)
        - Projects (kind="project") should be root-level (parent_group=None)
        - Auto-generated groups (kind="generated"/"auto") created by orchestration only

    Special Group Types:
        - **project**: Root container, reusable as subgraph in other projects
        - **cluster**: User-defined thematic grouping
        - **subgroup**: Child group within a parent group
        - **generated**: Automatically created by orchestration
        - **auto**: Automatically created and maintained

    Example:
        >>> project = Group(label="Research Project", kind="project")
        >>> subgroup = Group(
        ...     label="Literature Review",
        ...     kind="subgroup",
        ...     parent_group=project.id
        ... )
    """

    id: UUID = Field(default_factory=uuid4)
    label: str = Field(min_length=1, max_length=100)
    kind: GroupKind
    parent_group: Optional[UUID] = None
    meta: GroupMetadata = Field(default_factory=GroupMetadata)
