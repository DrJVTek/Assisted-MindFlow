"""Conversation → MindFlow graph import service.

Converts a generic Conversation model into MindFlow nodes and a group,
then inserts them into an existing graph. Provider-agnostic:
works with ChatGPT, shared links, or any future MCP source.
"""

import logging
from datetime import UTC, datetime
from typing import Optional
from uuid import UUID, uuid4

from mindflow.models.conversation import Conversation, ConversationMessage
from mindflow.models.group import Group, GroupMetadata
from mindflow.models.node import Node, NodeMetadata, Position

logger = logging.getLogger(__name__)

# Role → (node_type, node_author) mapping
ROLE_MAP = {
    "user": ("question", "human"),
    "assistant": ("answer", "llm"),
    "tool": ("note", "tool"),
}

# Colors per source
SOURCE_COLORS = {
    "chatgpt": "#10a37f",
    "claude": "#cc785c",
    "shared_link": "#6366f1",
}


class ConversationImporter:
    """Converts a Conversation into MindFlow nodes + group."""

    def __init__(
        self,
        mode: str = "active_branch",
        start_x: float = 0.0,
        start_y: float = 0.0,
        spacing_x: float = 350.0,
        spacing_y: float = 200.0,
    ):
        """
        Args:
            mode: "active_branch" (linear) or "full_tree" (all branches)
            start_x: Starting X position for layout
            start_y: Starting Y position for layout
            spacing_x: Horizontal spacing for branches
            spacing_y: Vertical spacing between messages
        """
        self.mode = mode
        self.start_x = start_x
        self.start_y = start_y
        self.spacing_x = spacing_x
        self.spacing_y = spacing_y

    def import_conversation(
        self, conversation: Conversation
    ) -> tuple[Group, list[Node], dict[str, UUID]]:
        """Convert a conversation into a group + nodes.

        Returns:
            Tuple of:
            - Group object for the conversation
            - List of Node objects (with parent/children set)
            - Mapping of original message ID → MindFlow node UUID
        """
        # Create group for this conversation
        group = Group(
            label=conversation.title[:100],
            kind="cluster",
            meta=GroupMetadata(
                color=SOURCE_COLORS.get(conversation.source, "#64748b"),
                tags=[f"import:{conversation.source}", f"conv:{conversation.id[:8]}"],
                created_at=conversation.created_at or datetime.now(UTC),
            ),
        )

        # Select messages based on mode
        if self.mode == "full_tree":
            messages = conversation.get_full_tree()
        else:
            messages = conversation.linearize()

        if not messages:
            return group, [], {}

        # Build ID mapping: original message ID → new UUID
        id_map: dict[str, UUID] = {}
        for msg in messages:
            id_map[msg.id] = uuid4()

        # Create nodes
        nodes: list[Node] = []
        positions = self._compute_layout(messages, id_map, conversation)

        for msg in messages:
            node_uuid = id_map[msg.id]
            node_type, node_author = ROLE_MAP.get(msg.role, ("note", "human"))

            # Resolve parent
            parent_uuids: list[UUID] = []
            if msg.parent_id and msg.parent_id in id_map:
                parent_uuids.append(id_map[msg.parent_id])

            # Resolve children (only those in our import set)
            child_uuids: list[UUID] = []
            for child_id in msg.children_ids:
                if child_id in id_map:
                    child_uuids.append(id_map[child_id])

            pos = positions.get(msg.id)

            node = Node(
                id=node_uuid,
                type=node_type,
                author=node_author,
                content=msg.content[:10000] if msg.content else "",
                parents=parent_uuids,
                children=child_uuids,
                groups=[group.id],
                meta=NodeMetadata(
                    importance=0.5,
                    tags=[f"role:{msg.role}"],
                    status="final",
                    position=Position(x=pos[0], y=pos[1]) if pos else None,
                    created_at=msg.timestamp or datetime.now(UTC),
                    updated_at=msg.timestamp or datetime.now(UTC),
                ),
            )
            nodes.append(node)

        logger.info(
            f"Imported conversation '{conversation.title}': "
            f"{len(nodes)} nodes, group={group.id}"
        )

        return group, nodes, id_map

    def _compute_layout(
        self,
        messages: list[ConversationMessage],
        id_map: dict[str, UUID],
        conversation: Conversation,
    ) -> dict[str, tuple[float, float]]:
        """Compute positions for nodes.

        Linear mode: vertical stack.
        Tree mode: tree layout with branches spreading horizontally.
        """
        positions: dict[str, tuple[float, float]] = {}

        if self.mode == "full_tree":
            self._layout_tree(messages, id_map, conversation, positions)
        else:
            # Simple vertical stack
            for i, msg in enumerate(messages):
                x = self.start_x
                y = self.start_y + i * self.spacing_y
                positions[msg.id] = (x, y)

        return positions

    def _layout_tree(
        self,
        messages: list[ConversationMessage],
        id_map: dict[str, UUID],
        conversation: Conversation,
        positions: dict[str, tuple[float, float]],
    ) -> None:
        """Recursive tree layout: each branch gets its own column."""
        msg_by_id = {m.id: m for m in messages}

        # Find roots (messages whose parent is not in our set)
        roots = [m for m in messages if m.parent_id not in id_map]

        col_counter = [0]  # mutable counter for branch columns

        def layout_subtree(msg: ConversationMessage, depth: int, col: int) -> int:
            """Layout a subtree. Returns the number of columns used."""
            positions[msg.id] = (
                self.start_x + col * self.spacing_x,
                self.start_y + depth * self.spacing_y,
            )

            children_in_set = [
                msg_by_id[cid]
                for cid in msg.children_ids
                if cid in msg_by_id
            ]

            if not children_in_set:
                return 1

            if len(children_in_set) == 1:
                return layout_subtree(children_in_set[0], depth + 1, col)

            # Multiple children: spread horizontally
            total_cols = 0
            for child in children_in_set:
                used = layout_subtree(child, depth + 1, col + total_cols)
                total_cols += used

            return max(total_cols, 1)

        col_offset = 0
        for root in roots:
            used = layout_subtree(root, 0, col_offset)
            col_offset += used
