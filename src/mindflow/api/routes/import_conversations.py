"""Conversation import API routes.

Provides endpoints for:
- GET  /api/import/chatgpt/projects — List ChatGPT projects (folders)
- GET  /api/import/chatgpt/projects/{id}/conversations — List conversations in a project
- GET  /api/import/chatgpt/conversations — List ChatGPT conversations
- GET  /api/import/chatgpt/conversations/{id} — Preview a conversation
- POST /api/import/chatgpt/import — Import a conversation into a graph
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from mindflow.api.routes.graphs import _graphs_storage
from mindflow.models.conversation import ConversationSummary
from mindflow.services.chatgpt_client import ChatGPTClient
from mindflow.services.conversation_import import ConversationImporter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["import"])

# Singleton client (uses session token, not OAuth)
_chatgpt_client: Optional[ChatGPTClient] = None


def _get_client() -> ChatGPTClient:
    global _chatgpt_client
    if _chatgpt_client is None:
        _chatgpt_client = ChatGPTClient()
    return _chatgpt_client


# ── Response Models ──────────────────────────────────────────────

class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]
    total: int
    offset: int
    limit: int


class ConversationPreview(BaseModel):
    id: str
    title: str
    source: str
    message_count: int
    messages: list[dict]  # [{role, content_preview, has_branches}]


class ImportRequest(BaseModel):
    conversation_id: str
    graph_id: str
    mode: str = Field(
        default="active_branch",
        description="'active_branch' for linear import, 'full_tree' for all branches",
    )
    start_x: float = 0.0
    start_y: float = 0.0


class ImportResponse(BaseModel):
    group_id: str
    node_count: int
    message: str


# ── Token Management Endpoints ──────────────────────────────────

class AccessTokenRequest(BaseModel):
    access_token: str = Field(
        ...,
        description="ChatGPT web access token (from browser console one-liner)",
    )


class TokenStatus(BaseModel):
    has_token: bool
    status: str  # "connected", "no_token", "invalid"
    message: str


@router.post("/chatgpt/access-token", response_model=TokenStatus)
async def set_access_token(req: AccessTokenRequest):
    """Save a ChatGPT web access token for conversation import.

    The user gets this by pasting a one-liner in their chatgpt.com console:
    fetch('/api/auth/session').then(r=>r.json()).then(d=>navigator.clipboard.writeText(d.accessToken))
    """
    client = _get_client()
    client.save_access_token(req.access_token)

    # Validate by trying to list conversations
    try:
        await client.list_conversations(offset=0, limit=1)
        return TokenStatus(
            has_token=True,
            status="connected",
            message="Connected to ChatGPT. You can now browse and import conversations.",
        )
    except Exception as exc:
        client.clear_token()
        return TokenStatus(
            has_token=False,
            status="invalid",
            message=f"Token invalid or expired: {exc}",
        )


@router.get("/chatgpt/token-status", response_model=TokenStatus)
async def get_token_status():
    """Check if a valid ChatGPT access token is configured."""
    client = _get_client()

    if not client.has_token():
        return TokenStatus(
            has_token=False,
            status="no_token",
            message="Not connected to ChatGPT conversation history.",
        )

    return TokenStatus(
        has_token=True,
        status="connected",
        message="ChatGPT access token is configured.",
    )


@router.delete("/chatgpt/access-token", response_model=TokenStatus)
async def delete_access_token():
    """Remove the stored ChatGPT access token."""
    client = _get_client()
    client.clear_token()
    return TokenStatus(
        has_token=False,
        status="no_token",
        message="ChatGPT token removed.",
    )


# ── Conversation Endpoints ──────────────────────────────────────

@router.get("/chatgpt/conversations", response_model=ConversationListResponse)
async def list_chatgpt_conversations(
    offset: int = Query(0, ge=0),
    limit: int = Query(28, ge=1, le=100),
    is_archived: Optional[bool] = Query(None, description="Filter by archived status"),
):
    """List the user's ChatGPT conversations."""
    client = _get_client()

    try:
        summaries, total = await client.list_conversations(
            offset=offset, limit=limit, is_archived=is_archived,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    return ConversationListResponse(
        conversations=summaries,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/chatgpt/conversations/{conversation_id}", response_model=ConversationPreview)
async def preview_chatgpt_conversation(conversation_id: str):
    """Preview a ChatGPT conversation before importing."""
    client = _get_client()

    try:
        conversation = await client.get_conversation(conversation_id)
    except RuntimeError as exc:
        status = 401 if "sign in" in str(exc).lower() else 404
        raise HTTPException(status_code=status, detail=str(exc))

    # Build preview: linearized messages with branch info
    linear = conversation.linearize()
    preview_msgs = []
    for msg in linear:
        has_branches = len(msg.children_ids) > 1
        content_preview = msg.content[:200] + "..." if len(msg.content) > 200 else msg.content
        preview_msgs.append({
            "role": msg.role,
            "content_preview": content_preview,
            "has_branches": has_branches,
        })

    return ConversationPreview(
        id=conversation.id,
        title=conversation.title,
        source=conversation.source,
        message_count=len(linear),
        messages=preview_msgs,
    )


@router.post("/chatgpt/import", response_model=ImportResponse)
async def import_chatgpt_conversation(req: ImportRequest):
    """Import a ChatGPT conversation into a MindFlow graph as a group of nodes."""
    # Validate graph exists
    if req.graph_id not in _graphs_storage:
        raise HTTPException(status_code=404, detail=f"Graph {req.graph_id} not found")

    graph = _graphs_storage[req.graph_id]
    client = _get_client()

    # Fetch conversation
    try:
        conversation = await client.get_conversation(req.conversation_id)
    except RuntimeError as exc:
        status = 401 if "sign in" in str(exc).lower() else 502
        raise HTTPException(status_code=status, detail=str(exc))

    # Import
    importer = ConversationImporter(
        mode=req.mode,
        start_x=req.start_x,
        start_y=req.start_y,
    )
    group, nodes, id_map = importer.import_conversation(conversation)

    if not nodes:
        raise HTTPException(status_code=400, detail="Conversation has no importable messages")

    # Insert group into graph
    graph.groups[group.id] = group

    # Insert nodes into graph
    for node in nodes:
        graph.nodes[node.id] = node

    logger.info(
        f"Imported conversation '{conversation.title}' into graph {req.graph_id}: "
        f"{len(nodes)} nodes, group={group.id}"
    )

    return ImportResponse(
        group_id=str(group.id),
        node_count=len(nodes),
        message=f"Imported '{conversation.title}' ({len(nodes)} messages)",
    )
