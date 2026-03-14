"""Generic conversation model for import providers.

Provides a provider-agnostic representation of a conversation tree.
Any import source (ChatGPT, Claude, shared link, MCP) converts
to this model before being mapped to MindFlow nodes.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ConversationMessage(BaseModel):
    """A single message in a conversation tree."""

    id: str
    role: str  # "user", "assistant", "system", "tool"
    content: str
    parent_id: Optional[str] = None
    children_ids: list[str] = Field(default_factory=list)
    timestamp: Optional[datetime] = None


class ProjectSummary(BaseModel):
    """Lightweight summary for listing ChatGPT projects (folders)."""

    id: str
    name: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    conversation_count: Optional[int] = None


class ConversationSummary(BaseModel):
    """Lightweight summary for listing conversations."""

    id: str
    title: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    message_count: Optional[int] = None
    source: str  # "chatgpt", "claude", "shared_link", "mcp", ...


class Conversation(BaseModel):
    """A full conversation with its message tree.

    The messages dict is keyed by message ID.
    root_id points to the root of the tree (usually system message).
    current_node_id points to the latest message in the active branch.
    """

    id: str
    title: str
    source: str
    messages: dict[str, ConversationMessage]
    root_id: Optional[str] = None
    current_node_id: Optional[str] = None
    created_at: Optional[datetime] = None

    def linearize(self) -> list[ConversationMessage]:
        """Get the active branch as a linear list (root → current).

        Walks from current_node back to root via parent_id, then reverses.
        Skips system messages.
        """
        if not self.current_node_id or not self.messages:
            return []

        chain: list[ConversationMessage] = []
        node_id: Optional[str] = self.current_node_id

        while node_id and node_id in self.messages:
            msg = self.messages[node_id]
            if msg.role != "system":
                chain.append(msg)
            node_id = msg.parent_id

        chain.reverse()
        return chain

    def get_full_tree(self) -> list[ConversationMessage]:
        """Get all non-system messages preserving tree structure."""
        return [m for m in self.messages.values() if m.role != "system"]
