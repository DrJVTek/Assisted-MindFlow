"""LLM concurrency management with semaphore-based flow control.

This service orchestrates concurrent LLM operations with:
- Semaphore limiting to 10 concurrent operations
- FIFO queue for overflow operations
- Provider-agnostic streaming
- Automatic retry with exponential backoff
- State management via OperationStateManager

Architecture:
    Client Request → Queue Check → Semaphore Acquire → LLM Stream → Complete
                          ↓
                    (if full) Queue → Wait → Dequeue → Retry

Concurrency Limits:
    - Default: 10 concurrent operations
    - Configurable via MAX_CONCURRENT environment variable
    - Queue size: Unlimited (memory-bound)

Example:
    >>> manager = LLMConcurrencyManager(
    ...     state_manager=operation_state,
    ...     max_concurrent=10
    ... )
    >>>
    >>> # Start streaming operation
    >>> async for token in manager.stream_operation(operation_id):
    ...     print(token, end="", flush=True)
"""

import asyncio
import logging
from typing import AsyncIterator, Optional, Dict, Any
from uuid import UUID
from decimal import Decimal

from mindflow.services.operation_state import OperationStateManager
from mindflow.models.graph import NodeState
from mindflow.utils.llm_providers import (
    LLMStreamProvider,
    RateLimitError,
    AuthenticationError,
    ModelNotFoundError
)
from mindflow.utils.ollama_provider import OllamaProvider
from mindflow.utils.openai_provider import OpenAIProvider
from mindflow.utils.anthropic_provider import AnthropicProvider
from mindflow.utils.token_buffer import TokenBuffer


logger = logging.getLogger(__name__)


class LLMConcurrencyManager:
    """Manages concurrent LLM operations with semaphore-based flow control.

    Limits concurrent LLM requests to prevent resource exhaustion and
    rate limit violations. Queues overflow requests and processes them
    as slots become available.

    Key Features:
        - Semaphore-based concurrency limiting (default: 10)
        - FIFO queue for overflow operations
        - Automatic retry with exponential backoff
        - Provider-agnostic operation handling
        - Real-time progress tracking

    State Machine:
        idle → queued → processing → streaming → completed
                                               ↓
                                             failed
                                               ↓
                                           (retry or cancel)

    Example:
        >>> manager = LLMConcurrencyManager(
        ...     state_manager=state_mgr,
        ...     providers={
        ...         "ollama": OllamaProvider(),
        ...         "openai": OpenAIProvider(api_key="..."),
        ...     }
        ... )
        >>>
        >>> # Stream operation
        >>> async for token in manager.stream_operation(op_id):
        ...     await websocket.send(token)
    """

    def __init__(
        self,
        state_manager: OperationStateManager,
        providers: Optional[Dict[str, LLMStreamProvider]] = None,
        max_concurrent: int = 10,
        max_retries: int = 3,
        retry_base_delay: float = 1.0
    ):
        """Initialize concurrency manager.

        Args:
            state_manager: OperationStateManager instance
            providers: Dict of provider name -> provider instance
            max_concurrent: Maximum concurrent operations (default: 10)
            max_retries: Maximum retry attempts for failed operations
            retry_base_delay: Base delay for exponential backoff (seconds)
        """
        self.state = state_manager
        self.providers = providers or {}
        self.max_concurrent = max_concurrent
        self.max_retries = max_retries
        self.retry_base_delay = retry_base_delay

        # Concurrency control
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.queue: asyncio.Queue[UUID] = asyncio.Queue()
        self.active_operations: set[UUID] = set()

        # Queue processor task
        self._queue_processor_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start the queue processor.

        Launches background task that processes queued operations.

        Example:
            >>> await manager.start()
        """
        if self._queue_processor_task is None:
            self._queue_processor_task = asyncio.create_task(
                self._process_queue()
            )
            logger.info("LLM concurrency manager started")

    async def stop(self) -> None:
        """Stop the queue processor and wait for completion.

        Example:
            >>> await manager.stop()
        """
        if self._queue_processor_task:
            self._queue_processor_task.cancel()
            try:
                await self._queue_processor_task
            except asyncio.CancelledError:
                pass
            self._queue_processor_task = None
            logger.info("LLM concurrency manager stopped")

    async def stream_operation(
        self,
        operation_id: UUID,
        buffer_tokens: bool = True,
        buffer_interval_ms: int = 100
    ) -> AsyncIterator[str]:
        """Stream tokens from LLM operation.

        Handles concurrency control, provider routing, and state management.

        Args:
            operation_id: Operation UUID
            buffer_tokens: Whether to buffer tokens (default: True)
            buffer_interval_ms: Buffer flush interval in ms (default: 100)

        Yields:
            Token strings from LLM

        Raises:
            ValueError: If operation not found or already completed
            RuntimeError: If provider not configured

        Example:
            >>> async for token in manager.stream_operation(op_id):
            ...     print(token, end="", flush=True)
        """
        # Get operation
        operation = await self.state.get_operation(operation_id)
        if not operation:
            raise ValueError(f"Operation {operation_id} not found")

        if operation.is_terminal():
            raise ValueError(f"Operation {operation_id} already completed")

        # Get provider
        provider = self.providers.get(operation.provider)
        if not provider:
            raise RuntimeError(
                f"Provider '{operation.provider}' not configured. "
                f"Available: {list(self.providers.keys())}"
            )

        # Acquire semaphore (wait if at capacity)
        async with self.semaphore:
            self.active_operations.add(operation_id)

            try:
                # Update to processing
                await self.state.update_status(
                    operation_id,
                    NodeState.PROCESSING
                )

                logger.info(
                    f"Starting LLM operation {operation_id} "
                    f"({operation.provider}/{operation.model})"
                )

                # Create token buffer if enabled
                token_buffer = None
                if buffer_tokens:
                    token_buffer = TokenBuffer(
                        flush_interval_ms=buffer_interval_ms
                    )

                    async def flush_to_db(content: str):
                        """Flush buffered content to database."""
                        await self.state.append_content(operation_id, content)

                    token_buffer.set_flush_callback(flush_to_db)

                # Stream from provider
                token_count = 0
                first_token = True

                try:
                    async for token in provider.stream_completion(
                        model=operation.model,
                        prompt=operation.prompt,
                        system_prompt=operation.system_prompt,
                        metadata=operation.metadata
                    ):
                        # Mark as streaming on first token
                        if first_token:
                            await self.state.update_status(
                                operation_id,
                                NodeState.STREAMING
                            )
                            first_token = False

                        # Buffer or directly save token
                        if token_buffer:
                            await token_buffer.add(token)
                        else:
                            await self.state.append_content(operation_id, token)

                        token_count += 1

                        # Yield to client
                        yield token

                    # Flush remaining buffered tokens
                    if token_buffer:
                        await token_buffer.close()

                    # Mark complete
                    await self.state.complete_operation(
                        operation_id,
                        tokens_used=token_count
                    )

                    logger.info(
                        f"Completed LLM operation {operation_id} "
                        f"({token_count} tokens)"
                    )

                except RateLimitError as e:
                    # Retry with backoff
                    logger.warning(
                        f"Rate limit for operation {operation_id}, "
                        f"retry attempt {operation.retry_count + 1}"
                    )

                    if operation.retry_count < self.max_retries:
                        # Calculate backoff delay
                        delay = self.retry_base_delay * (2 ** operation.retry_count)
                        await asyncio.sleep(delay)

                        # Re-queue operation
                        await self.state.fail_operation(
                            operation_id,
                            f"Rate limit exceeded, retrying in {delay}s",
                            increment_retry=True
                        )
                        await self.queue.put(operation_id)
                    else:
                        # Max retries exceeded
                        await self.state.fail_operation(
                            operation_id,
                            f"Rate limit exceeded after {self.max_retries} retries"
                        )

                except (AuthenticationError, ModelNotFoundError) as e:
                    # Non-retryable errors
                    logger.error(f"Operation {operation_id} failed: {e}")
                    await self.state.fail_operation(operation_id, str(e))

                except Exception as e:
                    # Unexpected error
                    logger.exception(f"Unexpected error in operation {operation_id}")
                    await self.state.fail_operation(
                        operation_id,
                        f"Unexpected error: {str(e)}"
                    )

            finally:
                self.active_operations.discard(operation_id)

    async def enqueue_operation(self, operation_id: UUID) -> int:
        """Enqueue an operation for processing.

        Args:
            operation_id: Operation UUID

        Returns:
            Queue position (0-indexed)

        Example:
            >>> position = await manager.enqueue_operation(op_id)
            >>> print(f"Queued at position {position}")
        """
        await self.queue.put(operation_id)
        position = self.queue.qsize() - 1

        # Update queue position in database
        operation = await self.state.get_operation(operation_id)
        if operation:
            await self.state.update_status(
                operation_id,
                NodeState.QUEUED,
                progress=0
            )

        logger.info(f"Queued operation {operation_id} at position {position}")
        return position

    async def cancel_operation(self, operation_id: UUID) -> None:
        """Cancel a queued or active operation.

        Args:
            operation_id: Operation UUID

        Example:
            >>> await manager.cancel_operation(op_id)
        """
        # Mark as cancelled in database
        await self.state.cancel_operation(operation_id)

        # Remove from active set
        self.active_operations.discard(operation_id)

        logger.info(f"Cancelled operation {operation_id}")

    def get_active_count(self) -> int:
        """Get number of currently active operations.

        Returns:
            Number of operations currently processing/streaming

        Example:
            >>> count = manager.get_active_count()
            >>> print(f"{count} operations active")
        """
        return len(self.active_operations)

    def get_queue_size(self) -> int:
        """Get number of queued operations waiting to start.

        Returns:
            Queue size

        Example:
            >>> size = manager.get_queue_size()
            >>> print(f"{size} operations queued")
        """
        return self.queue.qsize()

    def has_capacity(self) -> bool:
        """Check if there's capacity for new operations.

        Returns:
            True if under concurrency limit

        Example:
            >>> if manager.has_capacity():
            ...     await manager.stream_operation(op_id)
            ... else:
            ...     await manager.enqueue_operation(op_id)
        """
        return len(self.active_operations) < self.max_concurrent

    async def _process_queue(self) -> None:
        """Background task that processes queued operations.

        Runs continuously, dequeueing and starting operations as
        concurrency slots become available.
        """
        logger.info("Queue processor started")

        try:
            while True:
                # Wait for queued operation
                operation_id = await self.queue.get()

                # Check if operation was cancelled
                operation = await self.state.get_operation(operation_id)
                if not operation or operation.status == NodeState.CANCELLED:
                    self.queue.task_done()
                    continue

                # Stream the operation (will block until complete)
                try:
                    async for _ in self.stream_operation(operation_id):
                        pass  # Tokens handled by stream consumers
                except Exception as e:
                    logger.exception(f"Error processing queued operation {operation_id}")

                # Mark task done
                self.queue.task_done()

        except asyncio.CancelledError:
            logger.info("Queue processor stopped")


__all__ = ["LLMConcurrencyManager"]
