"""Debate API routes (Feature 011 - US2).

Provides endpoints for managing inter-LLM debates:
- POST   /api/debates              — Start a new debate
- GET    /api/debates/{debate_id}  — Get debate status
- POST   /api/debates/{debate_id}/continue — Continue debate
- DELETE /api/debates/{debate_id}  — Stop a running debate
- GET    /api/debates              — List debates (filtered by graph_id)
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from mindflow.models.debate import (
    ContinueDebateRequest,
    DebateStatus,
    StartDebateRequest,
)
from mindflow.services import debate_engine
from mindflow.api.routes.graphs import get_graph_from_storage
from mindflow.api.routes.providers import _get_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/debates", tags=["debates"])


# ── Response Models ────────────────────────────────────────────


class DebateResponse(BaseModel):
    id: str
    graph_id: str
    start_node_id: str
    node_ids: list[str]
    round_count: int
    max_rounds: int
    status: str
    error_message: Optional[str] = None
    created_at: str
    updated_at: str


class DebateListResponse(BaseModel):
    debates: list[DebateResponse]


class StopDebateResponse(BaseModel):
    message: str
    rounds_completed: int


def _to_response(debate) -> DebateResponse:
    return DebateResponse(
        id=str(debate.id),
        graph_id=str(debate.graph_id),
        start_node_id=str(debate.start_node_id),
        node_ids=[str(nid) for nid in debate.node_ids],
        round_count=debate.round_count,
        max_rounds=debate.max_rounds,
        status=debate.status.value,
        error_message=debate.error_message,
        created_at=debate.created_at.isoformat(),
        updated_at=debate.updated_at.isoformat(),
    )


# ── Endpoints ──────────────────────────────────────────────────


@router.post("", response_model=DebateResponse, status_code=201)
async def start_debate(request: StartDebateRequest):
    """Start a new debate chain between connected LLM nodes."""
    graph = get_graph_from_storage(request.graph_id)
    if graph is None:
        raise HTTPException(status_code=404, detail="Graph not found")

    registry = _get_registry()

    try:
        debate = await debate_engine.start_debate(
            graph=graph,
            start_node_id=request.start_node_id,
            max_rounds=request.max_rounds,
            registry=registry,
        )
        return _to_response(debate)
    except ValueError as exc:
        # Determine appropriate status code
        msg = str(exc)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        if "already running" in msg.lower():
            raise HTTPException(status_code=409, detail=msg)
        if "missing provider" in msg.lower():
            raise HTTPException(status_code=422, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


@router.get("/{debate_id}", response_model=DebateResponse)
async def get_debate(debate_id: str):
    """Get debate status and results."""
    debate = debate_engine.get_debate(debate_id)
    if debate is None:
        raise HTTPException(status_code=404, detail="Debate not found")
    return _to_response(debate)


@router.post("/{debate_id}/continue", response_model=DebateResponse)
async def continue_debate(debate_id: str, request: ContinueDebateRequest):
    """Continue an existing debate for additional rounds."""
    debate = debate_engine.get_debate(debate_id)
    if debate is None:
        raise HTTPException(status_code=404, detail="Debate not found")

    # Get the graph
    graph = get_graph_from_storage(debate.graph_id)
    if graph is None:
        raise HTTPException(status_code=404, detail="Graph not found")

    registry = _get_registry()

    try:
        updated = await debate_engine.continue_debate(
            debate_id=debate_id,
            additional_rounds=request.additional_rounds,
            graph=graph,
            registry=registry,
        )
        return _to_response(updated)
    except ValueError as exc:
        msg = str(exc)
        if "still running" in msg.lower():
            raise HTTPException(status_code=409, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


@router.delete("/{debate_id}", response_model=StopDebateResponse)
async def stop_debate(debate_id: str):
    """Stop/cancel a running debate."""
    debate = debate_engine.stop_debate(debate_id)
    if debate is None:
        raise HTTPException(status_code=404, detail="Debate not found")
    return StopDebateResponse(
        message="Debate stopped",
        rounds_completed=debate.round_count,
    )


@router.get("", response_model=DebateListResponse)
async def list_debates(graph_id: Optional[str] = Query(None)):
    """List debates, optionally filtered by graph_id."""
    debates = debate_engine.list_debates(graph_id=graph_id)
    return DebateListResponse(
        debates=[_to_response(d) for d in debates]
    )
