"""Redis key structure documentation for MindFlow concurrent LLM operations.

This module defines and documents the Redis key patterns used for:
1. LLM streaming operations (active stream state)
2. Hierarchy locks (prevent race conditions during concurrent node creation)
3. Operation queue management
4. Hot cache for performance optimization

Redis is used as ephemeral storage with TTLs for:
- Active stream caching (while LLM is streaming)
- Temporary locks during concurrent operations
- Hot data that can be reconstructed from PostgreSQL if lost

All persistent state is stored in PostgreSQL.
Redis is performance optimization only.
"""

from typing import Optional
from uuid import UUID


class RedisKeys:
    """Redis key patterns for concurrent LLM operations.

    Key Naming Convention:
        mindflow:{feature}:{entity}:{id}[:{subkey}]

    TTL Guidelines:
        - Stream data: 1 hour (expire after streaming completes)
        - Hierarchy locks: 30 seconds (short-lived, prevent deadlocks)
        - Hot cache: 5 minutes (frequently accessed data)
        - Queue metadata: No TTL (managed explicitly)

    Examples:
        >>> keys = RedisKeys()
        >>> stream_key = keys.llm_stream("123e4567-e89b-12d3-a456-426614174000")
        >>> # Returns: "mindflow:llm:stream:123e4567-e89b-12d3-a456-426614174000"
    """

    PREFIX = "mindflow"

    # LLM Streaming Operations
    @staticmethod
    def llm_stream(operation_id: UUID | str) -> str:
        """Key for active LLM stream data.

        Stores:
            - Accumulated content (updated as tokens arrive)
            - Partial response before database commit
            - Streaming metadata (provider, model, token count)

        Structure (Hash):
            {
                "content": "<accumulated_text>",
                "tokens": 42,
                "provider": "openai",
                "model": "gpt-4",
                "started_at": "2025-11-21T12:00:00Z"
            }

        TTL: 1 hour (auto-expire after streaming completes)

        Args:
            operation_id: UUID of the LLM operation

        Returns:
            Redis key string for stream data

        Example:
            >>> key = RedisKeys.llm_stream("a1b2c3d4-...")
            >>> # redis.hset(key, "content", "Hello")
            >>> # redis.expire(key, 3600)  # 1 hour TTL
        """
        return f"{RedisKeys.PREFIX}:llm:stream:{operation_id}"

    # Hierarchy Locks (Prevent Race Conditions)
    @staticmethod
    def hierarchy_lock(node_id: UUID | str) -> str:
        """Key for node hierarchy modification lock.

        Prevents race conditions when:
        - Creating child nodes on completed parents
        - Modifying parent-child relationships during concurrent LLMs
        - Multiple operations trying to update same node hierarchy

        Structure (String):
            Value: operation_id (who holds the lock)

        TTL: 30 seconds (short-lived to prevent deadlocks)

        Lock Acquisition Pattern:
            SET key operation_id NX EX 30
            (NX = only if not exists, EX 30 = expire in 30s)

        Args:
            node_id: UUID of the node being locked

        Returns:
            Redis key string for hierarchy lock

        Example:
            >>> key = RedisKeys.hierarchy_lock("node123")
            >>> # redis.set(key, operation_id, nx=True, ex=30)
            >>> # if success: lock acquired
            >>> # if fail: another operation holds lock
        """
        return f"{RedisKeys.PREFIX}:lock:hierarchy:{node_id}"

    # Operation Queue Management
    @staticmethod
    def operation_queue() -> str:
        """Key for FIFO operation queue.

        Stores queued LLM operations when concurrency limit reached.

        Structure (List):
            ["operation_id_1", "operation_id_2", ...]

        Operations:
            - RPUSH: Add to queue (append to tail)
            - LPOP: Remove from queue (pop from head)
            - LLEN: Get queue size
            - LPOS: Get position in queue

        No TTL: Managed explicitly when operations complete

        Returns:
            Redis key string for operation queue

        Example:
            >>> key = RedisKeys.operation_queue()
            >>> # redis.rpush(key, operation_id)  # Enqueue
            >>> # redis.lpop(key)  # Dequeue
        """
        return f"{RedisKeys.PREFIX}:queue:operations"

    # Active Operations Set
    @staticmethod
    def active_operations() -> str:
        """Key for set of currently active (processing/streaming) operation IDs.

        Used to quickly check active operation count without database query.

        Structure (Set):
            {"op_id_1", "op_id_2", ...}

        Operations:
            - SADD: Add operation when it starts
            - SREM: Remove operation when it completes
            - SCARD: Get count of active operations
            - SMEMBERS: Get all active operation IDs

        No TTL: Managed explicitly

        Returns:
            Redis key string for active operations set

        Example:
            >>> key = RedisKeys.active_operations()
            >>> # redis.sadd(key, operation_id)
            >>> # count = redis.scard(key)  # Check if < MAX_CONCURRENT
        """
        return f"{RedisKeys.PREFIX}:active:operations"

    # Hot Cache for Performance
    @staticmethod
    def node_state_cache(node_id: UUID | str) -> str:
        """Key for cached node state (performance optimization).

        Stores frequently accessed node state to avoid database queries.

        Structure (Hash):
            {
                "state": "streaming",
                "operation_id": "...",
                "updated_at": "2025-11-21T12:00:00Z"
            }

        TTL: 5 minutes (refresh on access)

        Args:
            node_id: UUID of the node

        Returns:
            Redis key string for node state cache

        Example:
            >>> key = RedisKeys.node_state_cache("node456")
            >>> # redis.hset(key, "state", "streaming")
            >>> # redis.expire(key, 300)  # 5 minutes
        """
        return f"{RedisKeys.PREFIX}:cache:node_state:{node_id}"

    # Streaming Buffer (Token Batching)
    @staticmethod
    def stream_buffer(operation_id: UUID | str) -> str:
        """Key for streaming token buffer (batching optimization).

        Buffers tokens before flushing to UI (50-100ms batches).

        Structure (List):
            ["token1", "token2", ...]

        Pattern:
            - RPUSH tokens as they arrive
            - Every 100ms: LRANGE 0 -1 + DEL (flush buffer)

        TTL: 10 seconds (auto-cleanup if flush fails)

        Args:
            operation_id: UUID of the LLM operation

        Returns:
            Redis key string for token buffer

        Example:
            >>> key = RedisKeys.stream_buffer("op789")
            >>> # redis.rpush(key, token)
            >>> # tokens = redis.lrange(key, 0, -1); redis.delete(key)
        """
        return f"{RedisKeys.PREFIX}:buffer:stream:{operation_id}"

    # SSE Connection Tracking
    @staticmethod
    def sse_connection(connection_id: str) -> str:
        """Key for SSE connection metadata.

        Tracks active SSE connections for reconnection and cleanup.

        Structure (Hash):
            {
                "operation_id": "...",
                "user_id": "...",
                "last_event_id": "42",
                "connected_at": "2025-11-21T12:00:00Z"
            }

        TTL: 2 hours (connection timeout)

        Args:
            connection_id: Unique identifier for SSE connection

        Returns:
            Redis key string for SSE connection

        Example:
            >>> key = RedisKeys.sse_connection("conn_abc123")
            >>> # redis.hset(key, "operation_id", op_id)
            >>> # redis.expire(key, 7200)  # 2 hours
        """
        return f"{RedisKeys.PREFIX}:sse:connection:{connection_id}"

    # Utility Methods
    @staticmethod
    def pattern_all_streams() -> str:
        """Pattern to match all stream keys (for cleanup/monitoring).

        Returns:
            Redis pattern string

        Example:
            >>> pattern = RedisKeys.pattern_all_streams()
            >>> # keys = redis.keys(pattern)  # Get all active streams
        """
        return f"{RedisKeys.PREFIX}:llm:stream:*"

    @staticmethod
    def pattern_all_locks() -> str:
        """Pattern to match all hierarchy lock keys (for debugging).

        Returns:
            Redis pattern string

        Example:
            >>> pattern = RedisKeys.pattern_all_locks()
            >>> # locks = redis.keys(pattern)  # Debug stuck locks
        """
        return f"{RedisKeys.PREFIX}:lock:hierarchy:*"


# Module-level convenience instances
redis_keys = RedisKeys()

__all__ = ["RedisKeys", "redis_keys"]
