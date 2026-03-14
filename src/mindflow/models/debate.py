"""Debate chain models (Feature 011 - US2).

Represents a sequential LLM debate between connected nodes,
where each node's provider generates a response given the full
conversation history from prior nodes in the chain.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class DebateStatus(str, Enum):
    """Lifecycle status of a debate chain."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    STOPPED = "stopped"
    ERROR = "error"


class DebateChain(BaseModel):
    """A debate chain linking multiple provider-assigned nodes."""

    id: UUID = Field(default_factory=uuid4)
    graph_id: UUID
    start_node_id: UUID
    node_ids: list[UUID] = Field(default_factory=list)
    round_count: int = 0
    max_rounds: int = 5
    status: DebateStatus = DebateStatus.PENDING
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def is_terminal(self) -> bool:
        """Check if the debate is in a terminal state."""
        return self.status in (
            DebateStatus.COMPLETED,
            DebateStatus.STOPPED,
            DebateStatus.ERROR,
        )

    def touch(self) -> None:
        """Update the timestamp."""
        self.updated_at = datetime.now(timezone.utc)


class StartDebateRequest(BaseModel):
    """Request to start a new debate chain."""

    graph_id: UUID
    start_node_id: UUID
    max_rounds: int = Field(default=5, ge=1, le=50)


class ContinueDebateRequest(BaseModel):
    """Request to continue a debate for more rounds."""

    additional_rounds: int = Field(default=1, ge=1, le=50)
