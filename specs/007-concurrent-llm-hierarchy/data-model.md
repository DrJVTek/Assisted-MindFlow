# Data Model: Concurrent LLM Operations with Hierarchical Node Creation

**Feature**: Concurrent LLM Operations with Hierarchical Node Creation
**Branch**: `007-concurrent-llm-hierarchy`
**Date**: 2025-11-21

## Overview

This document defines the data models and relationships required to support concurrent LLM streaming operations with real-time hierarchical node creation. The models handle operation state management, node relationships, and streaming content delivery.

---

## Core Entities

### 1. NodeState (Frontend & Backend)

Represents the current state of a node in the graph, tracking its lifecycle and LLM operation status.

#### TypeScript Schema (Frontend)

```typescript
export interface NodeState {
    // Core identification
    node_id: string;               // UUID of the node
    graph_id: string;              // UUID of the parent graph

    // State management
    state: NodeStateEnum;          // Current node state
    llm_operation_id?: string;     // UUID of active LLM operation (if any)
    progress: number;              // 0-100, for streaming progress

    // Error handling
    error_message?: string | null; // Error description if state is 'failed'

    // Timestamps
    created_at: Date;
    updated_at: Date;
}

export enum NodeStateEnum {
    IDLE = 'idle',                 // No LLM operation active
    PROCESSING = 'processing',     // LLM request sent, awaiting response
    STREAMING = 'streaming',       // LLM response streaming
    COMPLETED = 'completed',       // LLM operation finished successfully
    FAILED = 'failed',             // LLM operation failed
    CANCELLED = 'cancelled'        // User cancelled operation
}
```

#### Python Schema (Backend)

```python
from enum import Enum
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

class NodeStateEnum(str, Enum):
    IDLE = "idle"
    PROCESSING = "processing"
    STREAMING = "streaming"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class NodeState(BaseModel):
    # Core identification
    node_id: UUID
    graph_id: UUID

    # State management
    state: NodeStateEnum
    llm_operation_id: UUID | None = None
    progress: int = Field(default=0, ge=0, le=100)

    # Error handling
    error_message: str | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime
```

#### State Transitions

```
IDLE → PROCESSING → STREAMING → COMPLETED
                              ↘ FAILED
                              ↘ CANCELLED
```

**Validation Rules:**
- `progress` must be between 0 and 100
- `llm_operation_id` required when state is PROCESSING, STREAMING
- `error_message` required when state is FAILED
- State transitions must follow defined flow (e.g., cannot go directly from IDLE to COMPLETED)

---

### 2. LLMOperation (Backend)

Represents a concurrent LLM request with full lifecycle tracking.

#### Python Schema

```python
from typing import Dict, Any

class OperationStatus(str, Enum):
    QUEUED = "queued"              # Waiting in queue
    PROCESSING = "processing"      # Request sent to LLM
    STREAMING = "streaming"        # Response streaming
    COMPLETED = "completed"        # Finished successfully
    FAILED = "failed"              # Error occurred
    CANCELLED = "cancelled"        # User cancelled

class LLMOperation(BaseModel):
    # Core identification
    id: UUID = Field(default_factory=uuid4)
    node_id: UUID                  # Target node receiving content
    graph_id: UUID                 # Parent graph
    user_id: str                   # User who initiated operation

    # Operation status
    status: OperationStatus
    progress: int = Field(default=0, ge=0, le=100)
    queue_position: int | None = None  # Position in queue if queued

    # LLM configuration
    provider: str                  # 'openai', 'anthropic', 'ollama'
    model: str                     # Model name (e.g., 'gpt-4-turbo')
    prompt: str                    # User prompt
    system_prompt: str | None = None

    # Content (accumulated during streaming)
    content: str = ""              # Streamed content so far
    content_length: int = 0        # Character count

    # Timing
    queued_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: datetime | None = None
    completed_at: datetime | None = None

    # Resource tracking
    tokens_used: int | None = None
    cost: float | None = None      # USD cost if applicable

    # Error handling
    error_message: str | None = None
    retry_count: int = 0

    # Metadata (provider-specific)
    metadata: Dict[str, Any] = Field(default_factory=dict)
```

#### Database Schema (PostgreSQL)

```sql
CREATE TABLE llm_operations (
    -- Core identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,

    -- Operation status
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('queued', 'processing', 'streaming', 'completed', 'failed', 'cancelled')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    queue_position INTEGER,

    -- LLM configuration
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    prompt TEXT NOT NULL,
    system_prompt TEXT,

    -- Content (accumulated during streaming)
    content TEXT NOT NULL DEFAULT '',
    content_length INTEGER NOT NULL DEFAULT 0,

    -- Timing
    queued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Resource tracking
    tokens_used INTEGER,
    cost DECIMAL(10, 6),  -- USD cost with 6 decimal precision

    -- Error handling
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,

    -- Metadata (provider-specific data as JSON)
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Indexes for performance
    CONSTRAINT check_duration CHECK (
        started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at
    )
);

-- Indexes for common queries
CREATE INDEX idx_operations_status ON llm_operations(status);
CREATE INDEX idx_operations_user_id ON llm_operations(user_id);
CREATE INDEX idx_operations_node_id ON llm_operations(node_id);
CREATE INDEX idx_operations_graph_id ON llm_operations(graph_id);
CREATE INDEX idx_operations_queued_at ON llm_operations(queued_at DESC);
CREATE INDEX idx_operations_status_queued ON llm_operations(status, queued_at)
    WHERE status = 'queued';
```

**Validation Rules:**
- `provider` must be one of: 'openai', 'anthropic', 'ollama'
- `status` transitions must follow defined flow
- `started_at` must be after `queued_at`
- `completed_at` must be after `started_at`
- `progress` must be 0-100
- `retry_count` cannot be negative

---

### 3. ConcurrencyManager (Backend Service)

Manages concurrent LLM operation limits and queuing logic.

#### Python Schema

```python
from asyncio import Semaphore, Queue, Task
from typing import Set, Dict

class ConcurrencyManager:
    """Manages concurrent LLM operation limits."""

    def __init__(self, max_concurrent: int = 10):
        # Concurrency control
        self.max_concurrent = max_concurrent
        self.semaphore = Semaphore(max_concurrent)

        # Operation tracking
        self.active_operations: Set[UUID] = set()
        self.operation_tasks: Dict[UUID, Task] = {}

        # Queue management
        self.queue: Queue[LLMOperation] = Queue()
        self.queue_size = 0

        # Adaptive rate limiting
        self.error_count = 0
        self.success_count = 0
        self.current_limit = max_concurrent

    # Methods defined in implementation
```

**State Tracking:**
```python
@dataclass
class ConcurrencyState:
    """Snapshot of concurrency manager state."""
    active_count: int          # Number of operations currently running
    queued_count: int          # Number of operations waiting in queue
    max_concurrent: int        # Current concurrency limit
    current_limit: int         # Adaptive limit (may be < max_concurrent)
    total_processed: int       # Lifetime operations count
    error_rate: float          # Recent error rate (0.0 to 1.0)
```

---

### 4. HierarchyLock (Backend)

Prevents race conditions during node hierarchy modifications.

#### Python Schema

```python
from enum import Enum
from datetime import datetime, timezone

class LockType(str, Enum):
    CREATING_CHILD = "creating_child"
    DELETING = "deleting"
    UPDATING = "updating"

class HierarchyLock(BaseModel):
    node_id: UUID
    lock_type: LockType
    locked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    locked_by: str             # user_id or 'system'
    expires_at: datetime       # Auto-release after timeout
```

#### Redis Schema

Locks stored in Redis for fast access and automatic expiration:

```python
# Redis key format
LOCK_KEY = "hierarchy:lock:{node_id}"

# Example Redis data
{
    "lock_type": "creating_child",
    "locked_by": "user-123",
    "locked_at": "2025-11-21T10:30:00Z",
    "expires_at": "2025-11-21T10:30:30Z"  # 30-second timeout
}

# TTL set automatically via Redis EXPIRE command
```

**Lock Acquisition Pattern:**
```python
async def acquire_lock(node_id: UUID, lock_type: LockType, user_id: str) -> bool:
    """Atomically acquire lock on node."""
    lock_key = f"hierarchy:lock:{node_id}"

    # Attempt to set lock (NX = only if not exists)
    success = await redis.set(
        lock_key,
        json.dumps({
            "lock_type": lock_type.value,
            "locked_by": user_id,
            "locked_at": datetime.now(timezone.utc).isoformat()
        }),
        nx=True,      # Only set if key doesn't exist
        ex=30         # Expire after 30 seconds
    )

    return success is not None
```

---

### 5. StreamingContentBuffer (Frontend Service)

Accumulates streaming chunks before flushing to Zustand state.

#### TypeScript Schema

```typescript
export interface StreamingContentBuffer {
    // Buffer state
    operation_id: string;
    buffer: string[];           // Accumulated chunks
    total_length: number;       // Total characters buffered

    // Timing control
    flush_interval: number;     // milliseconds (default 100ms)
    last_flush_at: number;      // timestamp of last flush

    // Debouncing
    flush_timer: NodeJS.Timeout | null;
}

export class ContentBufferManager {
    private buffers: Map<string, StreamingContentBuffer>;
    private default_flush_interval: number = 100;  // 100ms

    constructor(flushInterval: number = 100) {
        this.buffers = new Map();
        this.default_flush_interval = flushInterval;
    }

    appendChunk(operationId: string, chunk: string): void {
        // Implementation appends chunk and schedules flush
    }

    flush(operationId: string): string {
        // Returns accumulated content and clears buffer
    }

    forceFlushAll(): void {
        // Flush all buffers immediately (on completion)
    }
}
```

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────┐
│    Graph    │
└──────┬──────┘
       │ 1:N
       │
       ↓
┌─────────────┐      1:1      ┌────────────────┐
│    Node     │ ←──────────── │   NodeState    │
└──────┬──────┘                └────────────────┘
       │ 1:N                            ↓ 0..1
       │                         ┌────────────────┐
       ↓                         │  LLMOperation  │
┌─────────────┐                 └────────────────┘
│  ChildNode  │                          │
└─────────────┘                          │ N:1
       ↑                                 ↓
       │                         ┌──────────────────┐
       │                         │ ConcurrencyMgr   │
       └─────────────────────────┤  (Service)       │
                                 └──────────────────┘
                                          │
                                          ↓
                                 ┌──────────────────┐
                                 │ HierarchyLock    │
                                 │  (per node)      │
                                 └──────────────────┘
```

### Relationship Details

**Node → NodeState (1:1)**
- Every node has exactly one NodeState
- NodeState deleted when node is deleted (CASCADE)

**NodeState → LLMOperation (0..1)**
- NodeState can have at most one active LLMOperation
- Reference stored in `llm_operation_id` field
- Multiple historical operations can exist (completed/failed)

**Graph → LLMOperation (1:N)**
- One graph can have many concurrent LLM operations
- Used for analytics and quota tracking

**Node → ChildNode (1:N)**
- Node can have multiple children (branching reasoning)
- Children can be created while parent LLM is streaming
- Hierarchy stored in separate `edges` table (existing)

**ConcurrencyManager → LLMOperation (N:1)**
- Manager tracks multiple active operations
- Operations queued when limit exceeded

**Node → HierarchyLock (1:1)**
- Each node can have at most one active lock
- Locks prevent simultaneous conflicting operations

---

## State Synchronization

### Frontend (Zustand) ↔ Backend (FastAPI + SSE)

**Zustand Store Structure:**
```typescript
export interface LLMOperationsStore {
    // Operation state
    operations: Record<string, LLMOperation>;  // operationId -> operation
    activeCount: number;

    // Actions
    startOperation: (nodeId: string) => string;
    updateOperation: (operationId: string, update: Partial<LLMOperation>) => void;
    completeOperation: (operationId: string) => void;
    cancelOperation: (operationId: string) => void;
    removeOperation: (operationId: string) => void;
}

// Separate store for high-frequency streaming content
export interface StreamingContentStore {
    content: Record<string, string>;  // operationId -> accumulated content
    updateContent: (operationId: string, chunk: string) => void;
    clearContent: (operationId: string) => void;
}
```

**SSE Event Types:**
```typescript
export type SSEEvent =
    | { type: 'content'; operation_id: string; content: string; }
    | { type: 'progress'; operation_id: string; progress: number; }
    | { type: 'complete'; operation_id: string; final_content: string; node: Node; }
    | { type: 'error'; operation_id: string; error: string; }
    | { type: 'queued'; operation_id: string; queue_position: number; };
```

**Synchronization Flow:**
1. Frontend creates operation → POST `/api/llm-operations`
2. Backend returns `operation_id` → Frontend connects to SSE stream
3. Backend streams events → Frontend updates Zustand state
4. On completion → Backend sends final node data → Frontend reconciles

---

## Data Persistence

### Storage Layers

**PostgreSQL (Durable State):**
- `llm_operations` table (all operations, full history)
- Query patterns: status filtering, user history, analytics
- Retention: All operations kept for audit trail

**Redis (Hot Cache):**
- Active streaming operations (TTL: 1 hour)
- Hierarchy locks (TTL: 30 seconds)
- Queue state (ephemeral)
- Pattern: Write-through cache

**Frontend (Transient State):**
- Zustand (in-memory state for current session)
- No persistence across browser refresh (reload from backend)

### Data Flow

```
User Action
    ↓
Frontend (Zustand)
    ↓
    ├─→ POST /api/llm-operations  → PostgreSQL (durable)
    │                                    ↓
    │                               Redis (cache)
    ↓
EventSource /api/stream/{op_id}
    ↓
SSE Events → Zustand updates
    ↓
Final state → PostgreSQL (committed)
```

---

## Validation Rules Summary

### Cross-Entity Validations

1. **Operation → Node consistency:**
   - `LLMOperation.node_id` must reference existing node
   - Node deletion cascades to operations

2. **Queue position consistency:**
   - `queue_position` must be sequential (1, 2, 3, ...)
   - Gap-free queue maintained by ConcurrencyManager

3. **State transition validation:**
   - Cannot skip states (e.g., IDLE → STREAMING invalid)
   - Timestamps must be chronological

4. **Concurrency limits:**
   - `active_count` ≤ `max_concurrent` (enforced by semaphore)
   - Queue size soft limit: 100 operations (prevent memory exhaustion)

5. **Lock expiration:**
   - Locks auto-released after 30 seconds
   - Stale lock detection in background task

---

## Performance Considerations

### Index Strategy

**PostgreSQL Indexes:**
- `idx_operations_status`: Fast filtering by status (queued, streaming, etc.)
- `idx_operations_user_id`: User-specific operation history
- `idx_operations_queued_at`: Time-based queries for analytics
- Composite index on `(status, queued_at)` for queue processing

**Redis Key Patterns:**
- `llm:stream:{operation_id}` - Active stream data
- `llm:queue:{user_id}` - Per-user queues (future enhancement)
- `hierarchy:lock:{node_id}` - Node locks

### Memory Estimates

**Per LLMOperation (Backend):**
- Python object: ~1KB
- Content field: ~10KB (average)
- Redis cached data: ~5KB
- **Total per operation:** ~16KB

**10 concurrent operations:** 10 × 16KB = **160KB** (negligible)

**Per Operation (Frontend):**
- Zustand state: ~5KB
- EventSource connection: ~50KB (browser managed)
- **Total per operation:** ~55KB

**10 concurrent operations:** 10 × 55KB = **550KB** (acceptable)

---

## Migration Strategy

### Schema Evolution

**Version 1.0 (Initial):**
- Basic operation tracking
- Simple FIFO queue
- No adaptive rate limiting

**Version 1.1 (Future):**
- Add `priority` field to `llm_operations`
- Add `user_quota` table for per-user limits
- Add `operation_metrics` table for analytics

**Migration Path:**
```sql
-- Example migration (Version 1.0 → 1.1)
ALTER TABLE llm_operations
ADD COLUMN priority INTEGER DEFAULT 1 CHECK (priority >= 0 AND priority <= 5);

CREATE INDEX idx_operations_priority ON llm_operations(priority DESC, queued_at ASC);
```

---

## Security Considerations

### Data Sanitization

**Sensitive Fields:**
- `LLMOperation.prompt` may contain user-sensitive data
- `LLMOperation.content` contains LLM responses (potentially sensitive)
- `metadata` may contain API keys (must NOT be logged)

**Logging Rules:**
- Truncate prompts to 100 characters in logs
- Never log `metadata` field
- Sanitize error messages before displaying to users

**Access Control:**
- Users can only query their own operations (`user_id` filter)
- Admin role required for cross-user queries
- Graph-level permissions apply to operations

---

## API Data Transfer Objects (DTOs)

### CreateOperationRequest

```typescript
export interface CreateOperationRequest {
    node_id: string;
    graph_id: string;
    provider: 'openai' | 'anthropic' | 'ollama';
    model: string;
    prompt: string;
    system_prompt?: string;
}
```

### OperationStatusResponse

```typescript
export interface OperationStatusResponse {
    operation_id: string;
    status: OperationStatus;
    progress: number;
    queue_position?: number;
    estimated_wait_seconds?: number;
    error_message?: string;
}
```

### StreamingChunk (SSE Event)

```typescript
export interface StreamingChunk {
    type: 'content' | 'progress' | 'complete' | 'error' | 'queued';
    operation_id: string;
    data: {
        content?: string;        // For 'content' type
        progress?: number;       // For 'progress' type
        queue_position?: number; // For 'queued' type
        error?: string;          // For 'error' type
        node?: Node;             // For 'complete' type
    };
}
```

---

## Conclusion

This data model supports:
- ✅ 10+ concurrent LLM streaming operations
- ✅ Real-time state synchronization (SSE)
- ✅ Durable operation history (PostgreSQL)
- ✅ Fast access to active streams (Redis)
- ✅ Race condition prevention (locks)
- ✅ Hierarchical node creation during streaming
- ✅ Queue management with position tracking

All entities designed for scalability, performance, and maintainability.
