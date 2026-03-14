"""Node model for MindFlow Engine.

A Node represents a discrete unit of thought/reasoning in the graph.
Nodes can be questions, answers, hypotheses, evaluations, summaries, etc.
"""

from datetime import UTC, datetime
from typing import Literal, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


# Type definitions
NodeType = Literal[
    "question",
    "answer",
    "note",
    "hypothesis",
    "evaluation",
    "summary",
    "plan",
    "group_meta",
    "comment",
    "stop",
]

NodeAuthor = Literal["human", "llm", "tool"]

NodeStatus = Literal["draft", "valid", "invalid", "final", "experimental"]


class Position(BaseModel):
    """2D position for canvas rendering.

    Attributes:
        x: X coordinate on canvas
        y: Y coordinate on canvas
    """

    x: float
    y: float


class NodeMetadata(BaseModel):
    """Metadata for a Node.

    Attributes:
        created_at: Timestamp when node was created
        updated_at: Timestamp when node was last updated
        importance: Importance score (0.0 to 1.0) for context selection
        tags: User-defined tags for categorization
        status: Current status of the node
        stop: If True, marks node as exit/output point (end of reasoning path)
        position: 2D canvas position (optional)
    """

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    tags: list[str] = Field(default_factory=list)
    status: NodeStatus = "draft"
    stop: bool = False
    position: Position | None = None


class Node(BaseModel):
    """A Node in the reasoning graph.

    Nodes represent discrete units of thought with typed content and relationships.
    They form a directed acyclic graph (DAG) through parent-child links.

    Attributes:
        id: Unique identifier (UUID)
        type: Type of node (question, answer, hypothesis, etc.)
        author: Who created this node (human, llm, or tool)
        content: The actual content (1-10000 characters)
        parents: List of parent node IDs
        children: List of child node IDs
        groups: List of group IDs this node belongs to
        meta: Metadata including timestamps, importance, tags, status

    Invariants:
        - If node A is in node B's parents, then B must be in A's children
        - No node can be its own ancestor (enforced by graph operations)
        - Stop nodes typically have no children

    Example:
        >>> node = Node(
        ...     type="question",
        ...     author="human",
        ...     content="What is the best approach for this problem?"
        ... )
        >>> node.meta.importance = 0.8
        >>> node.update_timestamp()
    """

    id: UUID = Field(default_factory=uuid4)
    type: NodeType
    author: NodeAuthor
    content: str = Field(default="", min_length=1, max_length=10000)
    parents: list[UUID] = Field(default_factory=list)
    children: list[UUID] = Field(default_factory=list)
    groups: list[UUID] = Field(default_factory=list)
    meta: NodeMetadata = Field(default_factory=NodeMetadata)

    # Feature 011: Multi-provider LLM support
    provider_id: Optional[UUID] = None  # Reference to ProviderConfig; null = default provider
    mcp_tools: list[str] = Field(default_factory=list)  # MCP tool names attached to this node

    # Feature 009: Inline LLM Response Display
    llm_response: Optional[str] = Field(None, max_length=100000)
    llm_operation_id: Optional[UUID] = None
    
    # Inline LLM Workflow: Dual-zone interface
    prompt_height: int = Field(150, ge=100, le=600)  # Prompt zone height (px)
    response_height: int = Field(250, ge=100, le=800)  # Response zone height (px)
    llm_status: str = Field("idle")  # idle, queued, streaming, complete, error
    llm_error: Optional[str] = None
    note_top: Optional[str] = Field(None, max_length=5000)  # Note above prompt
    note_bottom: Optional[str] = Field(None, max_length=5000)  # Note below response
    
    # Node collapse/expand
    collapsed: bool = Field(False)  # If true, show only summary/title
    summary: Optional[str] = Field(None, max_length=100)  # Title when collapsed
    
    # Node sizing (legacy, kept for backward compatibility)
    font_size: int = Field(14, ge=10, le=24)
    node_width: int = Field(400, ge=280, le=800)
    node_height: int = Field(400, ge=200, le=1200)

    def update_timestamp(self) -> None:
        """Update the modified timestamp.

        Should be called whenever the node's content or metadata is modified.
        Does not modify created_at timestamp.
        """
        self.meta.updated_at = datetime.now(UTC)
