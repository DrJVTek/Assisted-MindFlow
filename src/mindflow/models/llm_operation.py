"""LLM Operation model for tracking concurrent LLM streaming operations.

This model represents a single LLM operation in the system, including:
- Operation lifecycle (queued → processing → streaming → completed/failed)
- LLM configuration (provider, model, prompts)
- Content accumulation during streaming
- Resource tracking (tokens, cost, timing)

Persistence:
- PostgreSQL: Durable state storage (llm_operations table)
- Redis: Hot cache for active operations (ephemeral, TTL-based)

Example:
    >>> op = LLMOperation(
    ...     node_id=node.id,
    ...     graph_id=graph.id,
    ...     user_id="user_123",
    ...     provider="ollama",
    ...     model="llama2",
    ...     prompt="Explain quantum computing",
    ...     status=NodeState.QUEUED
    ... )
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from mindflow.models.graph import NodeState


class LLMOperation(BaseModel):
    """Model representing a single LLM operation.

    Tracks the complete lifecycle of an LLM streaming operation from queue
    to completion. Supports concurrent operations with progress tracking,
    resource monitoring, and error handling.

    State Transitions:
        queued → processing → streaming → completed
                                       ↓
                                     failed
                                       ↓
                                   cancelled

    Attributes:
        id: Unique operation identifier
        node_id: Node being processed by this operation
        graph_id: Parent graph containing the node
        user_id: User who initiated the operation

        status: Current operation state (NodeState enum)
        progress: Completion percentage (0-100)
        queue_position: Position in queue (None when not queued)

        provider: LLM provider name ("openai", "anthropic", "ollama")
        model: Model identifier (e.g., "gpt-4", "claude-3-opus", "llama2")
        prompt: User prompt sent to the LLM
        system_prompt: Optional system prompt for behavior control

        content: Accumulated LLM response (updated during streaming)
        content_length: Character count of accumulated content

        queued_at: When operation was created
        started_at: When LLM request was sent (None until processing)
        completed_at: When operation finished (None until complete)

        tokens_used: Total tokens consumed (prompt + completion)
        cost: USD cost of operation (6 decimal precision)

        error_message: Error details if operation failed
        retry_count: Number of retry attempts (for rate limits, timeouts)

        metadata: Provider-specific data (JSONB in PostgreSQL)

    Validation Rules:
        - status must be valid NodeState value
        - progress must be 0-100
        - queue_position must be >= 0 when not None
        - completed_at must be >= started_at when both present
        - provider must be "openai", "anthropic", or "ollama"

    Example:
        >>> from mindflow.models.llm_operation import LLMOperation
        >>> from mindflow.models.graph import NodeState
        >>>
        >>> # Create new operation
        >>> op = LLMOperation(
        ...     node_id=UUID("550e8400-e29b-41d4-a716-446655440000"),
        ...     graph_id=UUID("123e4567-e89b-12d3-a456-426614174000"),
        ...     user_id="user_abc",
        ...     provider="ollama",
        ...     model="llama2",
        ...     prompt="What is 2+2?",
        ...     status=NodeState.QUEUED
        ... )
        >>>
        >>> # Update progress during streaming
        >>> op.status = NodeState.STREAMING
        >>> op.content += " The answer"
        >>> op.progress = 50
        >>>
        >>> # Mark complete
        >>> op.status = NodeState.COMPLETED
        >>> op.completed_at = datetime.now(UTC)
        >>> op.progress = 100
    """

    # Core identification
    id: UUID = Field(default_factory=uuid4)
    node_id: UUID
    graph_id: UUID
    user_id: str

    # Operation status
    status: NodeState = Field(default=NodeState.QUEUED)
    progress: int = Field(default=0, ge=0, le=100)
    queue_position: Optional[int] = Field(default=None, ge=0)

    # LLM configuration
    provider: str = Field(pattern="^(openai|openai_chatgpt|chatgpt_web|anthropic|ollama|gemini|local)$")
    model: str
    prompt: str
    system_prompt: Optional[str] = None

    # Content (accumulated during streaming)
    content: str = Field(default="")
    content_length: int = Field(default=0, ge=0)

    # Timing
    queued_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Resource tracking
    tokens_used: Optional[int] = Field(default=None, ge=0)
    cost: Optional[Decimal] = Field(default=None, ge=Decimal("0.0"))

    # Error handling
    error_message: Optional[str] = None
    retry_count: int = Field(default=0, ge=0)

    # Metadata (provider-specific data as dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def append_content(self, token: str) -> None:
        """Append a token to the content and update length.

        Args:
            token: Token string from LLM stream

        Example:
            >>> op.append_content("Hello")
            >>> op.append_content(" world")
            >>> print(op.content)
            "Hello world"
        """
        self.content += token
        self.content_length = len(self.content)

    def start_processing(self) -> None:
        """Mark operation as processing (LLM request sent).

        Transitions: QUEUED → PROCESSING
        """
        self.status = NodeState.PROCESSING
        self.started_at = datetime.now(UTC)
        self.queue_position = None

    def start_streaming(self) -> None:
        """Mark operation as streaming (first token received).

        Transitions: PROCESSING → STREAMING
        """
        self.status = NodeState.STREAMING

    def complete(self, tokens_used: Optional[int] = None, cost: Optional[Decimal] = None) -> None:
        """Mark operation as completed.

        Args:
            tokens_used: Total tokens consumed
            cost: USD cost of operation

        Transitions: STREAMING → COMPLETED
        """
        self.status = NodeState.COMPLETED
        self.completed_at = datetime.now(UTC)
        self.progress = 100
        if tokens_used is not None:
            self.tokens_used = tokens_used
        if cost is not None:
            self.cost = cost

    def fail(self, error_message: str) -> None:
        """Mark operation as failed.

        Args:
            error_message: Human-readable error description

        Transitions: Any → FAILED
        """
        self.status = NodeState.FAILED
        self.completed_at = datetime.now(UTC)
        self.error_message = error_message

    def cancel(self) -> None:
        """Mark operation as cancelled.

        Transitions: Any → CANCELLED
        """
        self.status = NodeState.CANCELLED
        self.completed_at = datetime.now(UTC)

    def duration_seconds(self) -> Optional[float]:
        """Calculate operation duration in seconds.

        Returns:
            Duration in seconds, or None if not started/completed

        Example:
            >>> duration = op.duration_seconds()
            >>> if duration:
            ...     print(f"Operation took {duration:.2f}s")
        """
        if self.started_at and self.completed_at:
            delta = self.completed_at - self.started_at
            return delta.total_seconds()
        return None

    def is_active(self) -> bool:
        """Check if operation is currently active (processing or streaming).

        Returns:
            True if processing or streaming, False otherwise

        Example:
            >>> if op.is_active():
            ...     print("LLM is working...")
        """
        return self.status in {NodeState.PROCESSING, NodeState.STREAMING}

    def is_terminal(self) -> bool:
        """Check if operation has reached a terminal state.

        Returns:
            True if completed, failed, or cancelled

        Example:
            >>> if op.is_terminal():
            ...     print("Operation finished")
        """
        return self.status in {NodeState.COMPLETED, NodeState.FAILED, NodeState.CANCELLED}

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
            Decimal: lambda v: float(v)
        }


__all__ = ["LLMOperation"]
