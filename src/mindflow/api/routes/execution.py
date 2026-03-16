"""Graph execution and validation API routes.

Provides:
- POST /api/graphs/{graph_id}/validate — validate graph structure
- POST /api/graphs/{graph_id}/execute/{node_id} — execute node with dependencies
- DELETE /api/graphs/{graph_id}/execute/{execution_id} — cancel execution

Uses the Orchestrator engine which reconstructs context from the node tree
at each execution — the graph IS the memory, not the LLM's conversation history.
"""

import json
import logging
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from mindflow.api.routes.graphs import get_graph_from_storage, _persist_graph
from mindflow.api.routes.node_types import get_plugin_registry
from mindflow.engine.executor import CycleDetectedError
from mindflow.engine.orchestrator import Orchestrator
from mindflow.engine.validator import validate_graph

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/graphs", tags=["execution"])

# Track active executions for cancellation
_active_executions: dict[str, Orchestrator] = {}


def _resolve_provider(provider_id: str):
    """Resolve a provider_id to a live provider instance."""
    from mindflow.api.routes.providers import _get_registry
    registry = _get_registry()
    return registry.get_provider_instance(provider_id)


class ExecuteRequest(BaseModel):
    stream: bool = True
    force_rerun: bool = False


@router.post("/{graph_id}/validate")
async def validate_graph_endpoint(graph_id: str) -> dict:
    """Validate graph for cycles and type compatibility."""
    try:
        gid = UUID(graph_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid graph ID: {graph_id}")

    graph = get_graph_from_storage(gid)
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")

    registry = get_plugin_registry()
    return validate_graph(graph, registry)


@router.post("/{graph_id}/execute/{node_id}")
async def execute_node(
    graph_id: str,
    node_id: str,
    request: Optional[ExecuteRequest] = None,
):
    """Execute a node and all its ancestors via the Orchestrator.

    The orchestrator:
    1. Topologically sorts ancestors of the target node
    2. Executes each in order, passing parent outputs to child inputs
    3. Reconstructs context from the tree (no accumulated LLM state)
    4. The terminal node streams if stream=true and the node supports it

    If stream=true (default), returns an SSE stream.
    If stream=false, returns a JSON result after all nodes complete.
    """
    req = request or ExecuteRequest()

    try:
        gid = UUID(graph_id)
        nid = UUID(node_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid graph or node ID")

    graph = get_graph_from_storage(gid)
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")

    if nid not in graph.nodes:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found in graph")

    registry = get_plugin_registry()

    # Create orchestrator with provider resolution
    orchestrator = Orchestrator(
        graph=graph,
        registry=registry,
        provider_resolver=_resolve_provider,
    )

    execution_id = str(uuid4())
    _active_executions[execution_id] = orchestrator

    if req.stream:
        async def event_stream():
            try:
                async for event in orchestrator.stream_execute(target=nid):
                    event_type = event["event"]
                    event_data = event["data"]

                    # Inject execution_id into execution_start for frontend tracking
                    if event_type == "execution_start":
                        event_data["execution_id"] = execution_id

                    data = json.dumps(event_data)
                    yield f"event: {event_type}\ndata: {data}\n\n"
            finally:
                _active_executions.pop(execution_id, None)
                # Persist graph after execution (node outputs may update content)
                _persist_graph(graph_id)

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Execution-Id": execution_id,
            },
        )
    else:
        try:
            result = await orchestrator.execute(target=nid)
            # Persist graph after execution
            _persist_graph(graph_id)
            return {
                "execution_id": execution_id,
                "target_node_id": node_id,
                "results": {str(k): v for k, v in result.items()},
            }
        except CycleDetectedError as e:
            raise HTTPException(
                status_code=422,
                detail=f"Graph contains cycles: {e}",
            )
        finally:
            _active_executions.pop(execution_id, None)


@router.post("/{graph_id}/nodes/{node_id}/mark-dirty")
async def mark_node_dirty(graph_id: str, node_id: str) -> dict:
    """Explicitly invalidate a node and all its descendants.

    Used when the user edits node content/inputs to trigger re-execution.

    Returns list of all nodes that were marked dirty.
    """
    try:
        gid = UUID(graph_id)
        nid = UUID(node_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid graph or node ID")

    graph = get_graph_from_storage(gid)
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")

    if nid not in graph.nodes:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found in graph")

    # Build adjacency from graph
    from mindflow.engine.executor import GraphExecutor

    adjacency: dict[UUID, dict[str, list[UUID]]] = {}
    for n in graph.nodes.values():
        adjacency[n.id] = {
            "parents": list(n.parents),
            "children": list(n.children),
        }

    executor = GraphExecutor(adjacency)
    # All nodes start dirty — clear to simulate existing clean state
    executor._dirty_nodes.clear()
    dirty_list = executor.mark_dirty(nid)

    return {
        "dirty_nodes": [str(n) for n in dirty_list],
    }


@router.delete("/{graph_id}/execute/{execution_id}")
async def cancel_execution(graph_id: str, execution_id: str) -> dict:
    """Cancel a running execution."""
    orchestrator = _active_executions.get(execution_id)
    if orchestrator is None:
        raise HTTPException(
            status_code=404,
            detail=f"Execution {execution_id} not found or already completed",
        )

    orchestrator.cancelled = True
    return {
        "execution_id": execution_id,
        "status": "cancelled",
    }
