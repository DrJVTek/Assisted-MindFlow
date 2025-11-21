"""LLM Operations API endpoints.

Provides REST API and SSE streaming for concurrent LLM operations:
- Create operations
- Stream tokens via Server-Sent Events
- Query operation status
- Cancel operations
- List operations with filters

Example Usage:
    # Create operation
    POST /api/graphs/{graph_id}/llm-operations
    {
        "node_id": "...",
        "provider": "ollama",
        "model": "llama2",
        "prompt": "Explain AI"
    }

    # Stream tokens (SSE)
    GET /api/llm-operations/{operation_id}/stream
    (EventSource connection, receives token events)

    # Check status
    GET /api/llm-operations/{operation_id}/status
    {"status": "streaming", "progress": 45, "queue_position": null}

    # Cancel
    DELETE /api/llm-operations/{operation_id}
"""

import asyncio
import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from mindflow.models.llm_operation import LLMOperation
from mindflow.models.graph import NodeState


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/llm-operations", tags=["llm-operations"])


# ============================================================================
# Request/Response Models
# ============================================================================

class CreateOperationRequest(BaseModel):
    """Request to create a new LLM operation."""
    node_id: UUID
    provider: str = Field(pattern="^(openai|anthropic|ollama)$")
    model: str
    prompt: str
    system_prompt: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class OperationStatusResponse(BaseModel):
    """Operation status response."""
    id: UUID
    node_id: UUID
    status: str
    progress: int
    queue_position: Optional[int] = None
    content_length: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class OperationListResponse(BaseModel):
    """List of operations."""
    operations: List[OperationStatusResponse]
    total: int


# ============================================================================
# In-Memory Storage (Development Mode)
# ============================================================================
# TODO: Replace with PostgreSQL + Redis via OperationStateManager

_operations: Dict[str, LLMOperation] = {}
_operation_streams: Dict[str, asyncio.Queue] = {}


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/graphs/{graph_id}/operations", response_model=OperationStatusResponse)
async def create_operation(
    graph_id: UUID,
    request: CreateOperationRequest,
    user_id: str = Query("default_user", description="User identifier")
):
    """Create a new LLM operation.

    The operation is created in QUEUED state. Use the /stream endpoint
    to start streaming tokens.

    Args:
        graph_id: Parent graph UUID
        request: Operation creation parameters
        user_id: User identifier (from auth in production)

    Returns:
        Created operation status

    Example:
        ```
        POST /api/llm-operations/graphs/123e4567.../operations
        {
            "node_id": "550e8400-...",
            "provider": "ollama",
            "model": "llama2",
            "prompt": "What is AI?"
        }
        ```
    """
    try:
        # Create operation
        operation = LLMOperation(
            node_id=request.node_id,
            graph_id=graph_id,
            user_id=user_id,
            provider=request.provider,
            model=request.model,
            prompt=request.prompt,
            system_prompt=request.system_prompt,
            metadata=request.metadata,
            status=NodeState.QUEUED
        )

        # Store in memory (dev mode)
        _operations[str(operation.id)] = operation

        # Create stream queue
        _operation_streams[str(operation.id)] = asyncio.Queue()

        logger.info(
            f"Created operation {operation.id} "
            f"({operation.provider}/{operation.model})"
        )

        return OperationStatusResponse(
            id=operation.id,
            node_id=operation.node_id,
            status=operation.status.value,
            progress=operation.progress,
            queue_position=operation.queue_position,
            content_length=operation.content_length,
            started_at=operation.started_at,
            completed_at=operation.completed_at,
            error_message=operation.error_message
        )

    except Exception as e:
        logger.exception(f"Error creating operation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{operation_id}/stream")
async def stream_operation(operation_id: UUID):
    """Stream LLM tokens via Server-Sent Events.

    Connects to the LLM provider and streams tokens in real-time.
    Client should use EventSource API to consume events.

    Args:
        operation_id: Operation UUID

    Returns:
        SSE stream of token events

    Event Format:
        ```
        event: token
        data: {"content": "Hello"}

        event: status
        data: {"status": "streaming", "progress": 50}

        event: complete
        data: {"tokens_used": 150}

        event: error
        data: {"error": "Rate limit exceeded"}
        ```

    Example (JavaScript):
        ```javascript
        const source = new EventSource(
            '/api/llm-operations/${operationId}/stream'
        );

        source.addEventListener('token', (e) => {
            const data = JSON.parse(e.data);
            console.log(data.content);
        });

        source.addEventListener('complete', (e) => {
            source.close();
        });
        ```
    """
    op_id_str = str(operation_id)

    # Check operation exists
    if op_id_str not in _operations:
        raise HTTPException(status_code=404, detail="Operation not found")

    operation = _operations[op_id_str]

    # Check not already completed
    if operation.is_terminal():
        raise HTTPException(
            status_code=400,
            detail=f"Operation already {operation.status.value}"
        )

    async def event_generator():
        """Generate SSE events."""
        try:
            # Import provider (lazy to avoid circular imports)
            from mindflow.utils.ollama_provider import OllamaProvider
            from mindflow.utils.openai_provider import OpenAIProvider
            from mindflow.utils.anthropic_provider import AnthropicProvider

            # Get provider instance
            provider_map = {
                "ollama": OllamaProvider(),
                # OpenAI and Anthropic require API keys from env
                # "openai": OpenAIProvider(api_key=os.getenv("OPENAI_API_KEY")),
                # "anthropic": AnthropicProvider(api_key=os.getenv("ANTHROPIC_API_KEY")),
            }

            provider = provider_map.get(operation.provider)
            if not provider:
                # Send error event
                yield f"event: error\n"
                yield f"data: {{\"error\": \"Provider {operation.provider} not configured\"}}\n\n"
                return

            # Update status to processing
            operation.start_processing()
            yield f"event: status\n"
            yield f"data: {{\"status\": \"processing\"}}\n\n"

            # Stream from provider
            token_count = 0
            first_token = True

            async for token in provider.stream_completion(
                model=operation.model,
                prompt=operation.prompt,
                system_prompt=operation.system_prompt,
                metadata=operation.metadata
            ):
                # Mark as streaming on first token
                if first_token:
                    operation.start_streaming()
                    yield f"event: status\n"
                    yield f"data: {{\"status\": \"streaming\"}}\n\n"
                    first_token = False

                # Append to operation content
                operation.append_content(token)
                token_count += 1

                # Send token event (escape JSON)
                token_escaped = token.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
                yield f"event: token\n"
                yield f"data: {{\"content\": \"{token_escaped}\"}}\n\n"

                # Update progress every 10 tokens
                if token_count % 10 == 0:
                    progress = min(90, token_count // 2)  # Rough estimate
                    operation.progress = progress
                    yield f"event: progress\n"
                    yield f"data: {{\"progress\": {progress}}}\n\n"

                # Small delay to prevent overwhelming client
                await asyncio.sleep(0.01)

            # Mark complete
            operation.complete(tokens_used=token_count)
            yield f"event: complete\n"
            yield f"data: {{\"tokens_used\": {token_count}}}\n\n"

            logger.info(f"Completed streaming operation {operation_id} ({token_count} tokens)")

        except Exception as e:
            # Send error event
            logger.exception(f"Error streaming operation {operation_id}")
            operation.fail(str(e))
            error_escaped = str(e).replace('\\', '\\\\').replace('"', '\\"')
            yield f"event: error\n"
            yield f"data: {{\"error\": \"{error_escaped}\"}}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@router.get("/{operation_id}/status", response_model=OperationStatusResponse)
async def get_operation_status(operation_id: UUID):
    """Get current operation status.

    Returns current state, progress, queue position, and timing info.

    Args:
        operation_id: Operation UUID

    Returns:
        Operation status

    Example:
        ```
        GET /api/llm-operations/550e8400-.../status
        {
            "id": "550e8400-...",
            "status": "streaming",
            "progress": 75,
            "queue_position": null,
            "content_length": 450
        }
        ```
    """
    op_id_str = str(operation_id)

    if op_id_str not in _operations:
        raise HTTPException(status_code=404, detail="Operation not found")

    operation = _operations[op_id_str]

    return OperationStatusResponse(
        id=operation.id,
        node_id=operation.node_id,
        status=operation.status.value,
        progress=operation.progress,
        queue_position=operation.queue_position,
        content_length=operation.content_length,
        started_at=operation.started_at,
        completed_at=operation.completed_at,
        error_message=operation.error_message
    )


@router.delete("/{operation_id}")
async def cancel_operation(operation_id: UUID):
    """Cancel a queued or active operation.

    Transitions operation to CANCELLED state and stops streaming.

    Args:
        operation_id: Operation UUID

    Returns:
        Success message

    Example:
        ```
        DELETE /api/llm-operations/550e8400-...
        {"message": "Operation cancelled"}
        ```
    """
    op_id_str = str(operation_id)

    if op_id_str not in _operations:
        raise HTTPException(status_code=404, detail="Operation not found")

    operation = _operations[op_id_str]

    # Cancel only if not already terminal
    if operation.is_terminal():
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel {operation.status.value} operation"
        )

    operation.cancel()

    logger.info(f"Cancelled operation {operation_id}")

    return {"message": "Operation cancelled"}


@router.get("", response_model=OperationListResponse)
async def list_operations(
    graph_id: Optional[UUID] = Query(None, description="Filter by graph"),
    node_id: Optional[UUID] = Query(None, description="Filter by node"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum results")
):
    """List operations with optional filters.

    Args:
        graph_id: Filter by graph UUID
        node_id: Filter by node UUID
        status: Filter by status (queued, processing, streaming, completed, failed, cancelled)
        limit: Maximum results (1-1000)

    Returns:
        List of operations matching filters

    Example:
        ```
        GET /api/llm-operations?status=streaming&limit=10
        {
            "operations": [...],
            "total": 3
        }
        ```
    """
    filtered = list(_operations.values())

    # Apply filters
    if graph_id:
        filtered = [op for op in filtered if op.graph_id == graph_id]

    if node_id:
        filtered = [op for op in filtered if op.node_id == node_id]

    if status:
        try:
            status_enum = NodeState(status)
            filtered = [op for op in filtered if op.status == status_enum]
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status}"
            )

    # Sort by queued_at (newest first)
    filtered.sort(key=lambda op: op.queued_at, reverse=True)

    # Limit results
    filtered = filtered[:limit]

    # Convert to response
    operations = [
        OperationStatusResponse(
            id=op.id,
            node_id=op.node_id,
            status=op.status.value,
            progress=op.progress,
            queue_position=op.queue_position,
            content_length=op.content_length,
            started_at=op.started_at,
            completed_at=op.completed_at,
            error_message=op.error_message
        )
        for op in filtered
    ]

    return OperationListResponse(
        operations=operations,
        total=len(operations)
    )


__all__ = ["router"]
