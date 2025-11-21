"""Token buffering for LLM streaming.

Buffers tokens from LLM streams before flushing to UI to prevent
excessive re-renders and improve performance.

Batching Strategy:
    - Buffer tokens for 100ms intervals
    - Flush on buffer full (configurable threshold)
    - Flush on stream end
    - Flush on explicit flush() call

Performance:
    - Reduces UI updates from 100+ per second to ~10 per second
    - Prevents React re-render storms during fast streaming
    - Maintains perceived streaming UX (100ms is imperceptible)

Example:
    >>> buffer = TokenBuffer(flush_interval_ms=100, max_buffer_size=50)
    >>>
    >>> async def on_flush(content: str):
    ...     print(f"Flushing: {content}")
    >>>
    >>> buffer.set_flush_callback(on_flush)
    >>>
    >>> # Add tokens as they arrive
    >>> await buffer.add("Hello")
    >>> await buffer.add(" world")
    >>> # ... after 100ms, on_flush called with "Hello world"
"""

import asyncio
from typing import Optional, Callable, Awaitable, List
from datetime import datetime, timedelta


class TokenBuffer:
    """Buffer for batching LLM stream tokens.

    Accumulates tokens and flushes them in batches at regular intervals
    or when buffer reaches capacity. Prevents excessive UI updates during
    fast streaming.

    Attributes:
        flush_interval_ms: Milliseconds between flushes (default: 100)
        max_buffer_size: Maximum tokens before auto-flush (default: 50)

    Example:
        >>> buffer = TokenBuffer(flush_interval_ms=100)
        >>>
        >>> async def handle_flush(content: str):
        ...     await update_ui(content)
        >>>
        >>> buffer.set_flush_callback(handle_flush)
        >>>
        >>> # Tokens accumulate for 100ms
        >>> await buffer.add("Hello")
        >>> await buffer.add(" ")
        >>> await buffer.add("world")
        >>> # After 100ms: handle_flush("Hello world") called
        >>>
        >>> await buffer.close()  # Flush remaining tokens
    """

    def __init__(
        self,
        flush_interval_ms: int = 100,
        max_buffer_size: int = 50
    ):
        """Initialize token buffer.

        Args:
            flush_interval_ms: Milliseconds between flushes (default: 100)
            max_buffer_size: Maximum tokens before auto-flush (default: 50)
        """
        self.flush_interval_ms = flush_interval_ms
        self.max_buffer_size = max_buffer_size

        self._buffer: List[str] = []
        self._flush_callback: Optional[Callable[[str], Awaitable[None]]] = None
        self._flush_task: Optional[asyncio.Task] = None
        self._last_flush_time = datetime.now()
        self._closed = False

    def set_flush_callback(self, callback: Callable[[str], Awaitable[None]]) -> None:
        """Set the async callback to invoke on flush.

        Args:
            callback: Async function that receives batched content

        Example:
            >>> async def on_flush(content: str):
            ...     await websocket.send(content)
            >>>
            >>> buffer.set_flush_callback(on_flush)
        """
        self._flush_callback = callback

    async def add(self, token: str) -> None:
        """Add a token to the buffer.

        Tokens are buffered and flushed at regular intervals or when
        buffer reaches capacity.

        Args:
            token: Single token from LLM stream

        Raises:
            RuntimeError: If buffer is closed

        Example:
            >>> await buffer.add("Hello")
            >>> await buffer.add(" ")
            >>> await buffer.add("world")
        """
        if self._closed:
            raise RuntimeError("Cannot add to closed buffer")

        # Add token to buffer
        self._buffer.append(token)

        # Start flush timer if not running
        if self._flush_task is None:
            self._flush_task = asyncio.create_task(self._auto_flush_loop())

        # Immediate flush if buffer full
        if len(self._buffer) >= self.max_buffer_size:
            await self.flush()

    async def flush(self) -> None:
        """Flush buffered tokens immediately.

        Calls the flush callback with accumulated content and clears buffer.

        Example:
            >>> await buffer.add("Hello")
            >>> await buffer.flush()  # Immediate flush
        """
        if not self._buffer:
            return

        # Combine buffered tokens
        content = "".join(self._buffer)
        self._buffer.clear()
        self._last_flush_time = datetime.now()

        # Invoke callback if set
        if self._flush_callback:
            await self._flush_callback(content)

    async def _auto_flush_loop(self) -> None:
        """Background task that flushes buffer at regular intervals."""
        try:
            while not self._closed:
                # Wait for flush interval
                await asyncio.sleep(self.flush_interval_ms / 1000.0)

                # Flush if buffer has content
                if self._buffer:
                    await self.flush()

        except asyncio.CancelledError:
            # Flush remaining tokens on cancellation
            if self._buffer:
                await self.flush()

    async def close(self) -> None:
        """Close the buffer and flush remaining tokens.

        Ensures all buffered tokens are flushed before closing.

        Example:
            >>> await buffer.add("Final")
            >>> await buffer.close()  # Flushes "Final"
        """
        if self._closed:
            return

        self._closed = True

        # Cancel flush task
        if self._flush_task and not self._flush_task.done():
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass

        # Final flush
        if self._buffer:
            await self.flush()

    def __len__(self) -> int:
        """Get number of buffered tokens.

        Returns:
            Number of tokens in buffer

        Example:
            >>> await buffer.add("Hello")
            >>> len(buffer)
            1
        """
        return len(self._buffer)

    @property
    def is_empty(self) -> bool:
        """Check if buffer is empty.

        Returns:
            True if no tokens buffered

        Example:
            >>> buffer.is_empty
            True
            >>> await buffer.add("X")
            >>> buffer.is_empty
            False
        """
        return len(self._buffer) == 0

    @property
    def buffered_content(self) -> str:
        """Get current buffered content without flushing.

        Returns:
            Concatenated buffer contents

        Example:
            >>> await buffer.add("Hello")
            >>> await buffer.add(" world")
            >>> buffer.buffered_content
            'Hello world'
        """
        return "".join(self._buffer)

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - ensures flush."""
        await self.close()


__all__ = ["TokenBuffer"]
