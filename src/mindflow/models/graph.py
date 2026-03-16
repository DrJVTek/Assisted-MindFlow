"""Graph model for MindFlow Engine.

The Graph is the top-level container holding all nodes, groups, comments,
and metadata for a reasoning graph.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Dict, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from mindflow.models.node import Node
from mindflow.models.group import Group
from mindflow.models.comment import Comment


class NodeState(str, Enum):
    """State of a node's LLM operation.

    Represents the lifecycle of an LLM operation on a node:
    - idle: No LLM operation in progress
    - queued: LLM operation queued, waiting for available slot
    - processing: LLM request sent, waiting for first token
    - streaming: LLM tokens arriving, content being accumulated
    - completed: LLM operation finished successfully
    - failed: LLM operation failed (timeout, error, rate limit)
    - cancelled: LLM operation cancelled by user

    State Transitions:
        idle → queued → processing → streaming → completed
                                                ↓
                                              failed
                                                ↓
                                            cancelled (from any state)
    """

    IDLE = "idle"
    QUEUED = "queued"
    PROCESSING = "processing"
    STREAMING = "streaming"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class NodeExecutionState(str, Enum):
    """Execution caching state for dirty/clean tracking.

    Orthogonal to NodeState (which tracks LLM streaming lifecycle).
    This enum tracks whether a node's cached output is still valid.

    State Transitions:
        DIRTY → EXECUTING → CLEAN
                    ↓
                 FAILED → DIRTY (retry via mark_dirty)

    Dirty Propagation:
        - User edits node content/inputs → mark DIRTY
        - Node marked DIRTY → all descendants become DIRTY
        - Node execution completes → mark CLEAN, store output in cache
        - Node execution fails → mark FAILED, skip downstream
    """

    DIRTY = "dirty"
    CLEAN = "clean"
    EXECUTING = "executing"
    FAILED = "failed"


class GraphMetadata(BaseModel):
    """Metadata for a Graph.

    Attributes:
        name: Human-readable name for the graph
        description: Optional longer description
        created_at: Timestamp when graph was created
        updated_at: Timestamp when graph was last modified
        schema_version: Version of the data model schema
    """

    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    schema_version: str = "1.0.0"


class Graph(BaseModel):
    """A Graph containing nodes, groups, and comments.

    The Graph is the main container for a reasoning graph. It holds all entities
    (nodes, groups, comments) in dictionaries keyed by UUID for fast lookup.

    Attributes:
        id: Unique identifier for this graph
        meta: Metadata including name, description, timestamps
        nodes: Dictionary of all nodes (UUID -> Node)
        groups: Dictionary of all groups (UUID -> Group)
        comments: Dictionary of all comments (UUID -> Comment)

    Validation Rules:
        - All node parent/child references must point to existing nodes
        - All group parent references must point to existing groups
        - All comment attachments must reference existing nodes/edges
        - No orphaned references after node/group deletion

    Persistence:
        - Single JSON file per graph
        - Human-readable format (pretty-printed)
        - Use to_json() for serialization
        - Use from_json() for deserialization

    Example:
        >>> # Create a new graph
        >>> meta = GraphMetadata(name="My Research")
        >>> graph = Graph(meta=meta)
        >>>
        >>> # Add nodes
        >>> question = Node(type="question", author="human", content="Why?")
        >>> graph.nodes[question.id] = question
        >>>
        >>> # Save to file
        >>> json_str = graph.to_json()
        >>> with open("graph.json", "w") as f:
        ...     f.write(json_str)
        >>>
        >>> # Load from file
        >>> with open("graph.json", "r") as f:
        ...     graph = Graph.from_json(f.read())
    """

    id: UUID = Field(default_factory=uuid4)
    version: str = Field(default="2.0.0")  # Graph format version
    meta: GraphMetadata
    nodes: Dict[UUID, Node] = Field(default_factory=dict)
    groups: Dict[UUID, Group] = Field(default_factory=dict)
    comments: Dict[UUID, Comment] = Field(default_factory=dict)

    # Multi-canvas feature additions
    subgraph_instances: Dict[UUID, dict] = Field(default_factory=dict)  # UUID -> SubGraphInstance
    composite_definitions: Dict[str, dict] = Field(default_factory=dict)  # Composite node defs
    complexity_score: int = Field(default=0, ge=0)

    def to_json(self) -> str:
        """Serialize graph to JSON string.

        Returns human-readable, pretty-printed JSON suitable for file storage.

        Returns:
            JSON string with 2-space indentation

        Example:
            >>> graph = Graph(meta=GraphMetadata(name="Test"))
            >>> json_str = graph.to_json()
            >>> print(json_str)  # Pretty-printed JSON
        """
        return self.model_dump_json(indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> "Graph":
        """Deserialize graph from JSON string.

        Args:
            json_str: JSON string containing serialized graph

        Returns:
            Graph instance reconstructed from JSON

        Raises:
            ValidationError: If JSON is invalid or doesn't match schema

        Example:
            >>> json_str = '{"id": "...", "meta": {...}, ...}'
            >>> graph = Graph.from_json(json_str)
        """
        return cls.model_validate_json(json_str)
