"""Comment model for MindFlow Engine.

A Comment is a non-invasive annotation that can be attached to nodes or edges.
Comments allow users and AI to provide feedback without modifying the graph structure.
"""

from datetime import UTC, datetime
from typing import Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from mindflow.models.node import NodeAuthor


# Type alias for comment attachment target
CommentTarget = dict[str, Union[UUID, tuple[UUID, UUID]]]
# Examples:
# - Node attachment: {"node_id": UUID("...")}
# - Edge attachment: {"edge": (parent_uuid, child_uuid)}


class Comment(BaseModel):
    """A Comment attached to a node or edge.

    Comments are non-invasive annotations that don't modify the graph structure.
    They can be created by humans, LLMs, or tools to provide feedback, suggestions,
    or collaborative notes.

    Attributes:
        id: Unique identifier (UUID)
        author: Who created this comment (human, llm, or tool)
        content: The comment text (1-5000 characters)
        attached_to: Target of attachment - either a node_id or edge tuple
        created_at: Timestamp when comment was created

    Attachment Formats:
        - Node: {"node_id": UUID("...")}
        - Edge: {"edge": (parent_uuid, child_uuid)}

    Use Cases:
        - User feedback on node content
        - AI-generated suggestions for improvements
        - Collaborative annotations (future feature)
        - Review comments and discussions

    Example:
        >>> # Comment on a node
        >>> comment = Comment(
        ...     author="human",
        ...     content="Great insight! We should explore this further.",
        ...     attached_to={"node_id": some_node_id}
        ... )
        >>>
        >>> # Comment on an edge
        >>> comment = Comment(
        ...     author="llm",
        ...     content="This logical connection needs more evidence.",
        ...     attached_to={"edge": (parent_id, child_id)}
        ... )
    """

    id: UUID = Field(default_factory=uuid4)
    author: NodeAuthor
    content: str = Field(min_length=1, max_length=5000)
    attached_to: CommentTarget
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
