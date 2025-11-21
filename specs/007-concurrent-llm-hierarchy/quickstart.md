# Quickstart: Concurrent LLM Operations with Hierarchical Node Creation

**Feature Branch**: `007-concurrent-llm-hierarchy`
**Last Updated**: 2025-11-21
**Status**: Implementation Guide

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Demo](#quick-demo)
3. [Key Components](#key-components)
4. [Implementation Phases](#implementation-phases)
5. [Testing Checklist](#testing-checklist)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [Performance Benchmarks](#performance-benchmarks)
8. [API Reference](#api-reference)

---

## Overview

This feature transforms MindFlow from a sequential chat interface into a **true parallel reasoning system** by enabling:

1. **Hierarchical Node Creation**: Create child nodes from any completed parent node (even while parent's LLM is still streaming)
2. **Concurrent LLM Operations**: Launch 10+ LLM requests simultaneously without blocking each other
3. **Multi-Dimensional Analysis**: Explore multiple reasoning branches in parallel (e.g., "Performance analysis", "Cost analysis", "Scalability analysis" all at once)
4. **Real-Time State Visualization**: Each node displays its state (idle, processing, streaming, completed, failed) with live updates via SSE

**Why this matters**: Instead of waiting for one LLM response before asking the next question, users can create a tree of 20+ nodes and launch LLM operations on all of them simultaneously while continuing to explore and create new branches.

---

## Quick Demo

### Before (Sequential Chat)
```
User: "What is the best database?"
LLM 1 responds... (20 seconds)
User: "Compare PostgreSQL and MySQL"
LLM 2 responds... (20 seconds)
User: "Analyze cost implications"
LLM 3 responds... (20 seconds)
Total time: ~60 seconds
```

### After (Concurrent Multi-Dimensional)
```
User creates:
├── Question 1: "What is the best database?"
├── Question 2: "Performance analysis?"
└── Question 3: "Cost comparison?"

All 3 LLM requests launch simultaneously
├── LLM 1 streaming... (0-20s)
├── LLM 2 streaming... (0-15s)
└── LLM 3 streaming... (0-25s)

Meanwhile user creates child nodes:
├── Under Q1 → "PostgreSQL pros/cons"
├── Under Q2 → "Benchmark query 1"
└── Under Q3 → "TCO calculation"

Launch 3 more LLMs while first 3 still streaming
Total time: ~25 seconds (with 6 concurrent LLM operations)
```

---

## Key Components

### 1. Backend: LLMOperationManager (FastAPI)

**Location**: `src/mindflow/services/llm_operation_manager.py` (new)

Manages the concurrency limit, queuing, and streaming of LLM operations.

```python
# Backend: Concurrency management with asyncio.Semaphore
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio
from uuid import uuid4

class LLMOperationManager:
    """Manages concurrent LLM operations with max 10 simultaneous."""

    def __init__(self, max_concurrent: int = 10):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.active_operations = {}
        self.queue = asyncio.Queue()

    async def execute_with_limit(self, operation_id: str, llm_task):
        """Execute LLM task with concurrency limit."""
        async with self.semaphore:
            self.active_operations[operation_id] = {
                'status': 'processing',
                'content': '',
                'started_at': datetime.utcnow()
            }
            try:
                async for chunk in llm_task:
                    self.active_operations[operation_id]['content'] += chunk
                    yield f"data: {json.dumps({'type': 'content', 'chunk': chunk})}\n\n"

                # Mark as complete
                self.active_operations[operation_id]['status'] = 'completed'
                yield f"data: {json.dumps({'type': 'complete'})}\n\n"
            except Exception as e:
                self.active_operations[operation_id]['status'] = 'failed'
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            finally:
                del self.active_operations[operation_id]

# Usage in FastAPI route
llm_manager = LLMOperationManager(max_concurrent=10)

@app.post("/api/llm-operations")
async def create_llm_operation(request: CreateOperationRequest):
    """Create new LLM operation and return operation_id."""
    operation_id = str(uuid4())
    node = await db.get_node(request.node_id)

    # Store operation in database (PostgreSQL)
    await db.create_operation({
        'id': operation_id,
        'node_id': request.node_id,
        'status': 'queued',
        'provider': request.provider,
        'model': request.model,
        'prompt': request.prompt
    })

    # Return operation_id to client
    return {'operation_id': operation_id, 'status': 'queued'}

@app.get("/api/stream/{operation_id}")
async def stream_operation(operation_id: str):
    """SSE endpoint for streaming operation."""
    llm_task = create_llm_streaming_task(operation_id)
    return StreamingResponse(
        llm_manager.execute_with_limit(operation_id, llm_task),
        media_type="text/event-stream"
    )
```

**Key Points**:
- `asyncio.Semaphore(10)` enforces concurrency limit
- Each operation runs in its own async context
- No operation blocks others (true parallelism)
- Operations are tracked in memory AND persisted to PostgreSQL

---

### 2. Backend: Hierarchical Node Creation

**Location**: `src/mindflow/api/routes/nodes.py` (extend)

Allow creating child nodes at any time, even while parent's LLM is streaming.

```python
from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.post("/api/graphs/{graph_id}/nodes/{parent_id}/children")
async def create_child_node(
    graph_id: str,
    parent_id: str,
    request: CreateNodeRequest
):
    """Create child node below any parent (regardless of parent's LLM state)."""

    # Validate parent exists
    parent = await db.get_node(parent_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent node not found")

    # Check for circular dependencies
    if await has_circular_dependency(parent_id, request.content):
        raise HTTPException(
            status_code=400,
            detail="Circular dependency detected"
        )

    # Create child node (ALWAYS allowed, even if parent LLM is streaming)
    child_node = {
        'id': str(uuid4()),
        'graph_id': graph_id,
        'content': request.content,
        'type': request.type,
        'parent_id': parent_id,
        'state': 'idle',
        'created_at': datetime.utcnow()
    }

    # Persist immediately (no queuing)
    await db.create_node(child_node)
    await db.create_edge(parent_id, child_node['id'])

    return child_node

async def has_circular_dependency(parent_id: str, target_id: str) -> bool:
    """Detect if creating edge would form cycle."""
    visited = set()

    async def dfs(node_id: str) -> bool:
        if node_id == target_id:
            return True
        if node_id in visited:
            return False
        visited.add(node_id)

        children = await db.get_children(node_id)
        for child in children:
            if await dfs(child.id):
                return True
        return False

    return await dfs(target_id)
```

**Key Points**:
- Child creation is **never blocked** by parent's LLM state
- Circular dependency detection runs **before** creation
- Node persisted **immediately** to PostgreSQL
- Parent-child relationship stored in `edges` table

---

### 3. Frontend: Zustand Store for Operations

**Location**: `frontend/src/stores/llmOperationsStore.ts` (new)

Lightweight state management for tracking LLM operation states.

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface LLMOperation {
  operation_id: string;
  node_id: string;
  status: 'queued' | 'processing' | 'streaming' | 'completed' | 'failed' | 'cancelled';
  content: string;
  progress: number;          // 0-100
  error_message?: string;
  queue_position?: number;
  started_at?: Date;
  completed_at?: Date;
}

export interface LLMOperationsStore {
  // State
  operations: Map<string, LLMOperation>;
  activeCount: number;

  // Actions
  addOperation: (op: LLMOperation) => void;
  updateOperation: (operationId: string, update: Partial<LLMOperation>) => void;
  appendContent: (operationId: string, chunk: string) => void;
  completeOperation: (operationId: string) => void;
  failOperation: (operationId: string, error: string) => void;
  removeOperation: (operationId: string) => void;

  // Selectors
  getOperation: (operationId: string) => LLMOperation | undefined;
  getNodeOperation: (nodeId: string) => LLMOperation | undefined;
}

export const useLLMOperationsStore = create<LLMOperationsStore>()(
  subscribeWithSelector((set, get) => ({
    operations: new Map(),
    activeCount: 0,

    addOperation: (op) => set((state) => {
      const newOps = new Map(state.operations);
      newOps.set(op.operation_id, op);
      return {
        operations: newOps,
        activeCount: state.activeCount + 1
      };
    }),

    updateOperation: (operationId, update) => set((state) => {
      const op = state.operations.get(operationId);
      if (!op) return state;

      const newOps = new Map(state.operations);
      newOps.set(operationId, { ...op, ...update });
      return { operations: newOps };
    }),

    appendContent: (operationId, chunk) => set((state) => {
      const op = state.operations.get(operationId);
      if (!op) return state;

      const newOps = new Map(state.operations);
      newOps.set(operationId, {
        ...op,
        content: op.content + chunk,
        status: 'streaming'
      });
      return { operations: newOps };
    }),

    completeOperation: (operationId) => set((state) => {
      const newOps = new Map(state.operations);
      const op = newOps.get(operationId);
      if (op) {
        newOps.set(operationId, {
          ...op,
          status: 'completed',
          completed_at: new Date()
        });
      }
      return {
        operations: newOps,
        activeCount: Math.max(0, state.activeCount - 1)
      };
    }),

    failOperation: (operationId, error) => set((state) => {
      const newOps = new Map(state.operations);
      newOps.set(operationId, {
        ...(state.operations.get(operationId) as LLMOperation),
        status: 'failed',
        error_message: error
      });
      return {
        operations: newOps,
        activeCount: Math.max(0, state.activeCount - 1)
      };
    }),

    removeOperation: (operationId) => set((state) => {
      const newOps = new Map(state.operations);
      newOps.delete(operationId);
      return { operations: newOps };
    }),

    getOperation: (operationId) => get().operations.get(operationId),

    getNodeOperation: (nodeId) => {
      for (const op of get().operations.values()) {
        if (op.node_id === nodeId &&
            (op.status === 'processing' || op.status === 'streaming')) {
          return op;
        }
      }
      return undefined;
    }
  }))
);
```

**Key Points**:
- Uses `subscribeWithSelector` for efficient subscriptions
- `Map` structure for O(1) operation lookup
- Minimal state = minimal re-renders
- Only tracks **active** operations (completed ones removed after display)

---

### 4. Frontend: SSE Streaming Manager

**Location**: `frontend/src/services/sseManager.ts` (new)

Handles EventSource connections and streaming updates.

```typescript
import { useLLMOperationsStore } from '../stores/llmOperationsStore';

class SSEManager {
  private eventSources: Map<string, EventSource> = new Map();
  private buffers: Map<string, string[]> = new Map();
  private flushInterval: number = 100; // ms
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();

  async startStream(operationId: string, nodeId: string): Promise<void> {
    const store = useLLMOperationsStore.getState();

    // Create EventSource
    const eventSource = new EventSource(
      `/api/stream/${operationId}?last-event-id=${operationId}`
    );

    // Initialize buffer for this operation
    this.buffers.set(operationId, []);

    // Handle content chunks (100ms buffer)
    eventSource.addEventListener('content', (event) => {
      const data = JSON.parse(event.data);
      const buffer = this.buffers.get(operationId) || [];
      buffer.push(data.chunk);
      this.buffers.set(operationId, buffer);

      // Schedule flush if not already scheduled
      if (!this.flushTimers.has(operationId)) {
        const timer = setTimeout(() => {
          this.flushBuffer(operationId);
        }, this.flushInterval);
        this.flushTimers.set(operationId, timer);
      }
    });

    // Handle completion
    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);

      // Final flush
      this.flushBuffer(operationId);

      // Mark complete
      store.completeOperation(operationId);

      // Update node with final content
      store.updateOperation(operationId, {
        content: data.final_content,
        status: 'completed'
      });

      this.closeStream(operationId);
    });

    // Handle errors
    eventSource.addEventListener('error', (event) => {
      const data = JSON.parse(event.data);
      store.failOperation(operationId, data.error);
      this.closeStream(operationId);
    });

    this.eventSources.set(operationId, eventSource);
  }

  private flushBuffer(operationId: string): void {
    const buffer = this.buffers.get(operationId);
    if (!buffer || buffer.length === 0) return;

    const content = buffer.join('');
    const store = useLLMOperationsStore.getState();
    store.appendContent(operationId, content);

    // Clear buffer and timer
    this.buffers.set(operationId, []);
    const timer = this.flushTimers.get(operationId);
    if (timer) clearTimeout(timer);
    this.flushTimers.delete(operationId);
  }

  closeStream(operationId: string): void {
    // Flush any remaining content
    this.flushBuffer(operationId);

    // Close EventSource
    const eventSource = this.eventSources.get(operationId);
    if (eventSource) {
      eventSource.close();
      this.eventSources.delete(operationId);
    }

    // Clean up buffers
    this.buffers.delete(operationId);
  }

  isStreaming(operationId: string): boolean {
    return this.eventSources.has(operationId);
  }
}

export const sseManager = new SSEManager();
```

**Key Points**:
- 100ms buffer prevents excessive re-renders
- Single EventSource per operation
- Automatic cleanup on completion/error
- Last-Event-ID for reconnection support

---

### 5. Frontend: Node Component with State Indicators

**Location**: `frontend/src/components/Node.tsx` (extend)

Display visual indicators for node state during concurrent LLM operations.

```typescript
import React from 'react';
import { Loader, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useLLMOperationsStore } from '../stores/llmOperationsStore';

interface NodeProps {
  id: string;
  data: {
    label: string;
    content: string;
  };
}

export function CustomNode({ id, data }: NodeProps) {
  // Subscribe to this node's operation
  const nodeOperation = useLLMOperationsStore(
    (state) => state.getNodeOperation(id)
  );

  const getStateIndicator = () => {
    if (!nodeOperation) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }

    switch (nodeOperation.status) {
      case 'queued':
        return (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />
            <span className="text-xs text-yellow-600">
              Queue pos: {nodeOperation.queue_position}
            </span>
          </div>
        );
      case 'processing':
        return (
          <div className="flex items-center gap-2">
            <Loader className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-xs text-blue-600">Processing...</span>
          </div>
        );
      case 'streaming':
        return (
          <div className="flex items-center gap-2">
            <Loader className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-xs text-blue-600">
              {nodeOperation.progress}%
            </span>
          </div>
        );
      case 'completed':
        return (
          <CheckCircle className="w-4 h-4 text-green-500" />
        );
      case 'failed':
        return (
          <AlertCircle className="w-4 h-4 text-red-500 cursor-help"
            title={nodeOperation.error_message} />
        );
      default:
        return null;
    }
  };

  const getBorderClass = () => {
    if (!nodeOperation) return 'border-gray-300';

    switch (nodeOperation.status) {
      case 'queued': return 'border-yellow-300 bg-yellow-50';
      case 'processing': return 'border-blue-400 bg-blue-50';
      case 'streaming': return 'border-blue-500 bg-blue-50 animate-pulse';
      case 'failed': return 'border-red-400 bg-red-50';
      default: return 'border-gray-300';
    }
  };

  return (
    <div className={`p-4 rounded border-2 ${getBorderClass()}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{data.label}</h3>
        {getStateIndicator()}
      </div>

      <div className="text-sm text-gray-700">
        {nodeOperation?.status === 'streaming'
          ? nodeOperation.content
          : data.content}
      </div>

      {nodeOperation?.status === 'failed' && (
        <button
          className="mt-2 px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
          onClick={() => {/* Retry logic */}}
        >
          Retry
        </button>
      )}
    </div>
  );
}
```

**Key Points**:
- Selective subscription: only re-render when **this node's** operation changes
- Visual feedback: spinning loader, progress %, status colors
- Real-time content updates as streaming happens
- Retry button for failed operations

---

## Implementation Phases

### Phase 1: Foundation (Days 1-2)

**Goal**: Basic infrastructure for concurrent operations

1. **Create backend models**
   - `LLMOperation` Pydantic model
   - `NodeState` tracking
   - Database migrations for `llm_operations` table

2. **Implement ConcurrencyManager**
   - `asyncio.Semaphore(10)` setup
   - Active operations tracking
   - Basic queue management

3. **Setup SSE endpoint**
   - FastAPI StreamingResponse
   - Event serialization
   - Basic error handling

**Test**: Single LLM operation with SSE streaming

---

### Phase 2: Concurrency Control (Days 2-3)

**Goal**: Support 10 simultaneous LLM operations

1. **Implement queue management**
   - Queue position tracking
   - FIFO processing
   - Queue state UI feedback

2. **Add state transitions**
   - idle → queued → processing → streaming → completed
   - Error states and retries
   - State persistence to database

3. **Implement Last-Event-ID**
   - Browser reconnection support
   - Operation resume after page reload

**Test**: 10 concurrent operations without blocking, queue feedback

---

### Phase 3: Hierarchical Node Creation (Days 3-4)

**Goal**: Allow child node creation during concurrent LLM operations

1. **Extend node creation endpoint**
   - Allow creation from any parent
   - Circular dependency detection
   - Immediate persistence

2. **Update Canvas component**
   - Real-time node addition
   - Live edge rendering
   - Multi-level hierarchy support

3. **Add hierarchy locks** (Redis)
   - Prevent race conditions during creation
   - 30-second timeout auto-release

**Test**: Create children while parent's LLM is streaming, build multi-level tree

---

### Phase 4: State Management & UI (Days 4-5)

**Goal**: Real-time visualization of 10+ concurrent operations

1. **Zustand store setup**
   - Operation state tracking
   - Selective subscriptions
   - Content buffering

2. **Node component enhancements**
   - State indicators (spinner, progress, error)
   - Real-time content updates
   - Visual state transitions

3. **Canvas responsiveness**
   - Keep UI responsive during 10+ streaming
   - Implement 100ms token buffering
   - Optimize re-renders with subscriptions

**Test**: 10 concurrent streaming operations visible on canvas, <100ms UI response

---

### Phase 5: Performance & Polish (Days 5-6)

**Goal**: Optimize for scale and user experience

1. **Performance optimization**
   - Profile streaming updates
   - Optimize buffer flush timing
   - Monitor memory usage

2. **Error handling & recovery**
   - Exponential backoff for retries
   - Graceful degradation
   - Clear error messages

3. **Documentation & testing**
   - Integration tests for 10 concurrent ops
   - Performance benchmarks
   - Developer documentation

**Test**: 20 nodes, 10 concurrent LLMs, performance within targets

---

## Testing Checklist

### Unit Tests

```python
# Backend tests: tests/unit/test_llm_operations.py

def test_semaphore_limits_to_10_concurrent():
    """Verify only 10 operations run simultaneously."""
    # Create 15 operations, verify max 10 active

def test_circular_dependency_detection():
    """Verify cycles are detected and prevented."""
    # Create A → B → C → A, verify rejected

def test_state_transitions_valid():
    """Verify only valid state transitions."""
    # Try idle → completed (invalid), should fail

def test_content_accumulation():
    """Verify streaming content accumulates correctly."""
    # Send 10 chunks, verify joined correctly
```

```typescript
// Frontend tests: frontend/src/__tests__/llmOperationsStore.test.ts

test('appendContent accumulates chunks', () => {
  // Add operation, append chunks, verify content
});

test('completeOperation reduces activeCount', () => {
  // Add 3 operations, complete 1, verify activeCount = 2
});

test('selective subscription only updates on change', () => {
  // Verify listener called only for this node's operation
});
```

### Integration Tests

```python
# tests/integration/test_concurrent_llm_operations.py

async def test_10_concurrent_operations_complete_successfully():
    """Launch 10 LLMs simultaneously, verify all complete."""

async def test_create_children_during_parent_llm_streaming():
    """Create child node while parent's LLM is streaming."""

async def test_multi_dimensional_analysis():
    """Create 3-level hierarchy with 15 nodes, run 10 concurrent LLMs."""
```

### Manual Testing

1. **Single LLM Operation**
   - [ ] Create node, ask LLM
   - [ ] Verify content streams in real-time
   - [ ] Verify status transitions (processing → streaming → completed)
   - [ ] Verify node shows checkmark on completion

2. **Concurrent Operations (3 nodes)**
   - [ ] Create 3 nodes simultaneously
   - [ ] Select all 3, click "Ask LLM"
   - [ ] Verify all 3 show spinning loader
   - [ ] Verify all 3 stream content simultaneously
   - [ ] Verify none blocks the others

3. **Hierarchical Node Creation**
   - [ ] Create question node, ask LLM
   - [ ] While LLM is streaming, right-click parent → "Add Child"
   - [ ] Verify child node created immediately
   - [ ] Verify parent continues streaming
   - [ ] Repeat to create 3 children from same parent

4. **Multi-Dimensional Analysis**
   - [ ] Create root question node, ask LLM (starts streaming)
   - [ ] While streaming, create 3 child nodes below
   - [ ] Ask all 3 children simultaneously (total 4 concurrent)
   - [ ] While those 4 stream, create 2 grandchildren
   - [ ] Ask grandchildren (total 6 concurrent)
   - [ ] Verify all 6 continue streaming without interference
   - [ ] Observe canvas with 9+ nodes at different states

5. **Queue Management (10+ operations)**
   - [ ] Disable concurrency limit temporarily (set to 2)
   - [ ] Create 5 nodes, ask all simultaneously
   - [ ] Verify first 2 show "processing", rest show "Queued (position 3)" etc.
   - [ ] As operations complete, verify queued ones start
   - [ ] Re-enable normal limit (10)

6. **Error Handling**
   - [ ] Start LLM operation, simulate network failure
   - [ ] Verify node shows error state with message
   - [ ] Click "Retry" button
   - [ ] Verify operation restarts

7. **Performance**
   - [ ] Create 20 nodes with 10 concurrent LLMs
   - [ ] Measure: UI response time, streaming latency, memory usage
   - [ ] Verify performance meets targets (see below)

---

## Common Issues & Solutions

### Issue: LLM operations block each other

**Symptom**: Second operation waits for first to complete

**Solution**: Verify `asyncio.Semaphore` is shared across all operations
```python
# WRONG: Creates new semaphore per operation (blocks nothing)
async def stream_operation(operation_id: str):
    semaphore = asyncio.Semaphore(10)  # ❌ Local semaphore
    async with semaphore:
        ...

# RIGHT: Single shared semaphore
llm_manager = LLMOperationManager()  # Has semaphore

@app.get("/api/stream/{operation_id}")
async def stream_operation(operation_id: str):
    return StreamingResponse(
        llm_manager.execute_with_limit(operation_id, task),
        media_type="text/event-stream"
    )
```

---

### Issue: SSE stops after first message

**Symptom**: Browser receives first chunk then EventSource closes

**Solution**: Ensure proper SSE format with newlines
```python
# WRONG: Missing newlines
yield f"data: {json.dumps({'chunk': 'hello'})}"

# RIGHT: Double newline after each event
yield f"data: {json.dumps({'chunk': 'hello'})}\n\n"
```

---

### Issue: UI updates lag during streaming

**Symptom**: Nodes not updating in real-time, buffer accumulates

**Solution**: Tune buffer flush interval
```typescript
// Too frequent (updates every chunk):
const flushInterval = 10;  // Re-renders every 10ms ❌

// Optimal (updates every 100ms):
const flushInterval = 100; // Re-renders 10x/sec ✓

// Too infrequent (batches too much):
const flushInterval = 500; // Re-renders 2x/sec ❌
```

---

### Issue: Circular dependency detection is slow

**Symptom**: Creating child node takes >500ms

**Solution**: Use memoization and depth limit
```python
async def has_circular_dependency(parent_id: str, target_id: str) -> bool:
    """DFS with cycle detection, memoized."""
    visited = set()
    MAX_DEPTH = 100  # Prevent deep recursion

    async def dfs(node_id: str, depth: int) -> bool:
        if depth > MAX_DEPTH:
            return False  # Assume no cycle if too deep
        if node_id == target_id:
            return True
        if node_id in visited:
            return False
        visited.add(node_id)

        # Get from cache (Redis) for speed
        children = await redis.smembers(f"node_children:{node_id}")
        for child_id in children:
            if await dfs(child_id, depth + 1):
                return True
        return False

    return await dfs(target_id, 0)
```

---

### Issue: Memory grows unbounded during long streams

**Symptom**: Chrome DevTools shows increasing memory, eventually crashes

**Solution**: Limit operation retention
```typescript
// Remove completed operations after they're displayed
const completeOperation = (operationId: string) => set((state) => {
  const newOps = new Map(state.operations);

  // Keep for 5 seconds for user to see result
  setTimeout(() => {
    const finalOps = new Map(state.operations);
    finalOps.delete(operationId);
    store.setState({ operations: finalOps });
  }, 5000);

  return {
    operations: newOps,
    activeCount: Math.max(0, state.activeCount - 1)
  };
});
```

---

### Issue: Browser refresh loses operation state

**Symptom**: User refreshes page, all streaming operations lost

**Solution**: Implement Last-Event-ID recovery
```typescript
// Client side: Save Last-Event-ID to localStorage
const lastEventId = localStorage.getItem(`llm_op_${operationId}`);

const eventSource = new EventSource(
  `/api/stream/${operationId}?last-event-id=${lastEventId}`
);

eventSource.addEventListener('content', (event) => {
  // Update Last-Event-ID
  localStorage.setItem(`llm_op_${operationId}`, event.lastEventId);
  // ... process chunk
});
```

```python
# Server side: Resume from last position
@app.get("/api/stream/{operation_id}")
async def stream_operation(
    operation_id: str,
    last_event_id: str = Query(None)
):
    operation = await db.get_operation(operation_id)

    if last_event_id:
        # Resume from checkpoint
        start_index = int(last_event_id)
        content_so_far = operation.content[:start_index]
        yield f"data: {json.dumps({'type': 'resume', 'content': content_so_far})}\n\n"

    # Continue streaming...
```

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Node creation latency** | <500ms | Create child while 10 LLMs streaming |
| **LLM streaming latency** | <200ms | Time from backend token receive to UI update |
| **UI responsiveness** | <100ms | Interaction time (click, scroll) during 10 concurrent ops |
| **Memory per operation** | <20KB (backend), <60KB (frontend) | Profiler during 10 concurrent ops |
| **SSE throughput** | 100+ tokens/sec | Measure from LLM provider to client |

### Baseline Results (Example)

```
Test: 10 concurrent LLM operations

Backend Metrics:
  - Semaphore enforcement: ✓ (10 active, rest queued)
  - Memory: ~160KB (10 ops × 16KB)
  - CPU: 5-15% (asyncio overhead)
  - Database writes: 10 ops/sec

Frontend Metrics:
  - Zustand updates: 10/sec (100ms buffer flush)
  - Re-renders per node: 1-2 total (selective subscription)
  - Memory: ~550KB (10 ops × 55KB)
  - Canvas FPS: 58-60fps (smooth)

Network Metrics:
  - SSE events/sec: ~100 (1 per 10ms from LLM)
  - Buffer flush: ~10/sec (100ms intervals)
  - Bandwidth: ~50KB/sec (10 concurrent text streams)

Latency Measurements:
  - Node creation (10 concurrent): 250-400ms ✓
  - Streaming update: 50-150ms ✓
  - UI interaction: 30-80ms ✓

Timeline Example:
  t=0ms:    User selects 10 nodes, clicks "Ask LLM"
  t=50ms:   POST /api/llm-operations × 10 completed
  t=100ms:  All 10 EventSources connected
  t=150ms:  First content chunks arriving
  t=200ms:  All 10 nodes showing spinner + partial content
  t=500ms:  User can create child nodes (<100ms latency)
  t=15s:    First 3 operations complete, others still streaming
  t=30s:    All 10 complete
```

---

## API Reference

### Create LLM Operation

```http
POST /api/llm-operations
Content-Type: application/json

{
  "node_id": "550e8400-e29b-41d4-a716-446655440000",
  "graph_id": "660e8400-e29b-41d4-a716-446655440000",
  "provider": "openai",
  "model": "gpt-4-turbo",
  "prompt": "What is the best database for this use case?",
  "system_prompt": "You are a database architecture expert"
}

Response (201):
{
  "operation_id": "770e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "queue_position": 1
}
```

### Stream Operation

```http
GET /api/stream/{operation_id}
Last-Event-ID: 770e8400-e29b-41d4-a716-446655440000

Response (SSE):
data: {"type":"progress","progress":10}

data: {"type":"content","chunk":"PostgreSQL is a great choice"}

data: {"type":"content","chunk":" because..."}

data: {"type":"progress","progress":50}

data: {"type":"complete","final_content":"...full response..."}
```

### Create Child Node

```http
POST /api/graphs/{graph_id}/nodes/{parent_id}/children
Content-Type: application/json

{
  "content": "How does PostgreSQL compare to MySQL?",
  "type": "question"
}

Response (201):
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "graph_id": "660e8400-e29b-41d4-a716-446655440000",
  "parent_id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "How does PostgreSQL compare to MySQL?",
  "state": "idle",
  "created_at": "2025-11-21T10:30:00Z"
}
```

### Get Operation Status

```http
GET /api/llm-operations/{operation_id}

Response (200):
{
  "operation_id": "770e8400-e29b-41d4-a716-446655440000",
  "node_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "streaming",
  "progress": 45,
  "content": "PostgreSQL is a great choice because...",
  "queue_position": null,
  "started_at": "2025-11-21T10:30:05Z",
  "tokens_used": 142
}
```

### Get Node State

```http
GET /api/nodes/{node_id}/state

Response (200):
{
  "node_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "streaming",
  "llm_operation_id": "770e8400-e29b-41d4-a716-446655440000",
  "progress": 45,
  "updated_at": "2025-11-21T10:30:10Z"
}
```

---

## Next Steps

1. **Start with Phase 1**: Set up basic infrastructure (models, database, semaphore)
2. **Test single operation**: Verify SSE streaming works end-to-end
3. **Implement Phase 2**: Add queuing and multiple simultaneous operations
4. **Manual testing**: Create 10 concurrent operations, verify performance
5. **Polish & optimize**: Buffer tuning, error handling, documentation

**Target completion**: 6 days (Phase 1-5)

---

## Additional Resources

- **Data Model**: See `specs/007-concurrent-llm-hierarchy/data-model.md` for detailed schema
- **Feature Spec**: See `specs/007-concurrent-llm-hierarchy/spec.md` for requirements
- **Implementation Plan**: See `specs/007-concurrent-llm-hierarchy/plan.md` for detailed tasks

---

**Questions?** Check the Common Issues section or review the spec for detailed requirements.
