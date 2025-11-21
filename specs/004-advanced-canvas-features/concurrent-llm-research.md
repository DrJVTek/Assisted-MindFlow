# Research: Concurrent LLM Operations with Hierarchical Node Creation

**Feature**: Concurrent LLM Streaming Operations
**Date**: 2025-11-21
**Status**: Research Complete

## Purpose

This document captures technical research and decision rationale for implementing concurrent LLM streaming operations supporting 10+ simultaneous requests with real-time hierarchical node creation in the MindFlow Canvas application.

---

## Executive Summary

**Target Capabilities:**
- Support 10+ concurrent LLM streaming responses
- Enable creating child nodes while parent LLMs are streaming
- Use real-time streaming (SSE or WebSocket)
- Handle rate limits, timeouts, and failures gracefully
- Maintain UI responsiveness (<100ms) with concurrent operations

**Key Decisions:**
1. **Streaming Technology**: Server-Sent Events (SSE) over WebSocket
2. **Backend Concurrency**: asyncio.create_task() with asyncio.Semaphore
3. **State Management**: Zustand with operation-specific subscriptions
4. **LLM Interface**: Unified streaming interface with provider-specific adapters
5. **Concurrency Limit**: 10 concurrent operations with FIFO queue
6. **State Persistence**: PostgreSQL operation table with Redis for active streams
7. **Performance**: Token buffering (50-100ms chunks), ReactFlow memoization

---

## Task 1: Streaming Technology Choice (WebSocket vs SSE)

### Research Question
Should we use WebSocket or Server-Sent Events (SSE) for LLM streaming?

### Options Evaluated

#### Option A: Server-Sent Events (SSE)
**Advantages:**
- Simpler implementation - Built-in with FastAPI's StreamingResponse
- One-way communication sufficient (backend → frontend)
- Automatic reconnection with event IDs (resilience)
- Standard HTTP/2 multiplexing support
- No additional library needed (sse-starlette optional)
- Browser support: All modern browsers
- Lower server resource overhead

**Disadvantages:**
- Browser limit: 6 concurrent connections per domain (manageable with HTTP/2)
- No bidirectional communication (not needed for LLM streaming)
- Requires HTTP/2 or connection pooling for many concurrent streams

#### Option B: WebSocket
**Advantages:**
- Full duplex communication
- No theoretical connection limit
- Lower protocol overhead per message

**Disadvantages:**
- More complex connection lifecycle management
- Requires explicit reconnection handling
- State management across distributed servers challenging
- Overkill for unidirectional LLM responses
- Requires `websockets` library (already in requirements.txt)

### Decision: **Server-Sent Events (SSE)**

**Rationale:**
1. **LLM streaming is unidirectional** - User sends request, LLM streams response. No need for client → server messages during streaming.
2. **Automatic reconnection** - SSE provides built-in reconnection with Last-Event-ID, critical for long-running LLM operations
3. **Simpler implementation** - FastAPI's StreamingResponse directly supports SSE with minimal code
4. **HTTP/2 multiplexing** - Modern browsers use HTTP/2 by default, allowing 100+ concurrent streams per connection (far exceeds 10 concurrent operations requirement)
5. **Industry standard** - OpenAI, Anthropic, and most LLM providers use SSE for streaming

**Connection Limit Mitigation:**
- HTTP/2 multiplexing handles 10+ concurrent SSE streams on single connection
- If HTTP/1.1 fallback occurs, queue operations client-side (max 5 concurrent, queue remainder)

**Implementation Pattern:**
```python
# FastAPI SSE endpoint
from fastapi.responses import StreamingResponse

@router.post("/graphs/{graph_id}/generate-node")
async def generate_node_streaming(graph_id: str, request: GenerateNodeRequest):
    async def event_stream():
        async for chunk in llm_service.generate_streaming(request):
            yield f"data: {json.dumps(chunk)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

**Client-side (EventSource API):**
```typescript
const eventSource = new EventSource(`/api/graphs/${graphId}/generate-node`);
eventSource.onmessage = (event) => {
    const chunk = JSON.parse(event.data);
    updateNodeContent(chunk);
};
```

**Alternatives Considered:**
- Polling: High latency, poor user experience (rejected)
- Long polling: Better than polling but still higher overhead than SSE (rejected)

**Risks/Tradeoffs:**
- HTTP/1.1 browser connection limit (6 per domain) - mitigated by HTTP/2
- SSE reconnection may briefly interrupt stream - acceptable for 1-2 second gaps
- No native SSE support in older browsers (IE11) - acceptable (project targets modern browsers)

---

## Task 2: FastAPI Concurrency Implementation

### Research Question
How to implement true concurrent LLM requests in FastAPI with proper resource management?

### Implementation Strategy

#### Core Pattern: asyncio.create_task() for Parallel Execution

**Approach:**
```python
import asyncio
from typing import Dict, Set
from uuid import UUID

class ConcurrentLLMManager:
    def __init__(self, max_concurrent: int = 10):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.active_tasks: Dict[UUID, asyncio.Task] = {}
        self.task_queues: Dict[str, asyncio.Queue] = {}  # user_id -> queue

    async def generate_node_concurrent(
        self,
        operation_id: UUID,
        node_request: NodeGenerationRequest,
        llm_service: LLMService
    ):
        """Execute LLM generation with concurrency control."""
        async with self.semaphore:  # Limit concurrent operations
            try:
                # Create streaming generator
                async for chunk in llm_service.generate_streaming(node_request):
                    # Stream to SSE client
                    yield chunk
            except asyncio.CancelledError:
                # Handle cancellation gracefully
                logger.info(f"Operation {operation_id} cancelled")
                raise
            finally:
                # Cleanup
                self.active_tasks.pop(operation_id, None)
```

#### Concurrency Control: asyncio.Semaphore

**Purpose:** Limit concurrent LLM API requests to prevent:
- Rate limit errors (429) from LLM providers
- Memory exhaustion with too many active streams
- Backend server overload

**Configuration:**
```python
# Default: 10 concurrent operations
# Configurable via environment variable
MAX_CONCURRENT_LLM = int(os.getenv("MAX_CONCURRENT_LLM", "10"))
```

**Rationale for 10 concurrent:**
- OpenAI tier 1: 3,500 RPM (requests per minute) ≈ 58 RPS
- Anthropic tier 1: 50 requests per minute
- 10 concurrent streaming requests with avg 20s duration = ~30 requests/minute (safe margin)
- Allows multiple users to operate simultaneously

#### Request Queuing: asyncio.Queue

**Pattern:**
```python
class OperationQueue:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.processing = False

    async def enqueue(self, operation: Operation):
        """Add operation to queue, start processing if not already."""
        await self.queue.put(operation)
        if not self.processing:
            asyncio.create_task(self._process_queue())

    async def _process_queue(self):
        """Process queued operations FIFO."""
        self.processing = True
        while not self.queue.empty():
            operation = await self.queue.get()
            try:
                await self._execute_operation(operation)
            except Exception as e:
                logger.error(f"Operation {operation.id} failed: {e}")
            finally:
                self.queue.task_done()
        self.processing = False
```

#### Streaming to Multiple SSE Clients

**Challenge:** Multiple clients may connect to same operation (e.g., after refresh)

**Solution:** Broadcast pattern with asyncio.Queue per client

```python
class StreamBroadcaster:
    def __init__(self):
        self.listeners: Dict[UUID, List[asyncio.Queue]] = {}

    def subscribe(self, operation_id: UUID) -> asyncio.Queue:
        """Subscribe to operation stream."""
        queue = asyncio.Queue(maxsize=100)
        if operation_id not in self.listeners:
            self.listeners[operation_id] = []
        self.listeners[operation_id].append(queue)
        return queue

    async def broadcast(self, operation_id: UUID, chunk: dict):
        """Broadcast chunk to all subscribers."""
        if operation_id not in self.listeners:
            return

        dead_queues = []
        for queue in self.listeners[operation_id]:
            try:
                await asyncio.wait_for(queue.put(chunk), timeout=0.1)
            except asyncio.TimeoutError:
                # Client disconnected or slow
                dead_queues.append(queue)

        # Cleanup dead queues
        for queue in dead_queues:
            self.listeners[operation_id].remove(queue)
```

#### Error Handling in Concurrent Tasks

**Best Practices:**
1. **Graceful Degradation:** If one LLM operation fails, others continue
2. **Error Broadcasting:** Send error events via SSE to client
3. **Automatic Retry:** Exponential backoff for transient failures (see Task 5)
4. **Resource Cleanup:** Always cleanup in `finally` blocks

**Pattern:**
```python
try:
    async with self.semaphore:
        async for chunk in llm_service.generate_streaming(request):
            await broadcaster.broadcast(operation_id, chunk)
except RateLimitError as e:
    # Retry with exponential backoff
    await asyncio.sleep(e.retry_after)
    # Requeue operation
except LLMProviderError as e:
    # Send error to client
    await broadcaster.broadcast(operation_id, {
        "type": "error",
        "error": str(e),
        "operation_id": str(operation_id)
    })
finally:
    # Cleanup
    broadcaster.cleanup(operation_id)
```

### Decision: **asyncio.create_task() + Semaphore + Queue**

**Rationale:**
- **asyncio.create_task()**: True parallelism for I/O-bound LLM requests
- **Semaphore**: Simple, effective concurrency limiting
- **Queue**: FIFO fairness, prevents request starvation
- **FastAPI native**: No external dependencies (built-in asyncio)

**Alternatives Considered:**
- **Threading:** Python GIL makes asyncio superior for I/O-bound tasks (rejected)
- **Multiprocessing:** Overkill for I/O-bound LLM calls, high memory overhead (rejected)
- **Celery task queue:** Too heavyweight for real-time streaming (rejected)

**Implementation Hints:**
- Use `asyncio.create_task()` for fire-and-forget background work
- Use `await` directly when result is immediately needed
- Store task references to enable cancellation
- Use `asyncio.shield()` for critical cleanup that shouldn't be cancelled

**Risks/Tradeoffs:**
- **Memory:** Each streaming operation holds state in memory (mitigated by semaphore limit)
- **Cancellation:** Need explicit cancellation handling when user closes tab
- **Error propagation:** Must manually broadcast errors to SSE clients

---

## Task 3: React State Management for Concurrent Operations

### Research Question
How to manage state for 10+ concurrent streaming operations with real-time updates without performance degradation?

### State Management Architecture

#### Zustand Store Structure

**Operation State Schema:**
```typescript
interface LLMOperation {
    id: string;  // Operation UUID
    nodeId: string;  // Target node receiving content
    status: 'queued' | 'streaming' | 'completed' | 'error';
    progress: number;  // 0-100
    content: string;  // Accumulated content
    error?: string;
    startedAt: Date;
    completedAt?: Date;
}

interface LLMOperationsStore {
    operations: Record<string, LLMOperation>;  // operationId -> operation
    activeCount: number;

    // Actions
    startOperation: (nodeId: string) => string;  // Returns operationId
    updateOperation: (operationId: string, update: Partial<LLMOperation>) => void;
    completeOperation: (operationId: string) => void;
    cancelOperation: (operationId: string) => void;
}
```

#### Selective Subscriptions (Critical for Performance)

**Problem:** Zustand's default behavior triggers re-render for ANY state change

**Solution:** Selective subscriptions using shallow comparison

**Anti-pattern (causes excessive re-renders):**
```typescript
// BAD: Re-renders on EVERY operation update
const operations = useLLMStore((state) => state.operations);
```

**Best practice:**
```typescript
// GOOD: Only re-render when THIS operation changes
const operation = useLLMStore(
    (state) => state.operations[operationId],
    shallow  // Only re-render if operation object reference changes
);

// EVEN BETTER: Subscribe to specific field
const operationContent = useLLMStore(
    (state) => state.operations[operationId]?.content
);
```

#### Optimistic Updates vs Server-Driven State

**Strategy: Hybrid Approach**

**Optimistic:**
- Create node immediately with placeholder content
- Show "Generating..." status
- Update content as chunks arrive

**Server-driven:**
- Wait for server confirmation before marking complete
- Reconcile state on reconnection
- Final content from server is source of truth

**Implementation:**
```typescript
// Optimistic node creation
const createNodeWithLLM = async (parentId: string, prompt: string) => {
    // 1. Optimistic: Create placeholder node immediately
    const tempNodeId = `temp-${Date.now()}`;
    addNode({
        id: tempNodeId,
        content: "Generating...",
        isGenerating: true
    });

    // 2. Start LLM operation
    const operationId = startOperation(tempNodeId);

    // 3. Connect to SSE stream
    const eventSource = new EventSource(`/api/generate?operation_id=${operationId}`);

    eventSource.onmessage = (event) => {
        const chunk = JSON.parse(event.data);

        if (chunk.type === 'content') {
            // Update content incrementally
            updateOperation(operationId, {
                content: chunk.content
            });
        } else if (chunk.type === 'complete') {
            // Replace temp ID with server-assigned ID
            replaceNode(tempNodeId, chunk.node);
            completeOperation(operationId);
        }
    };
};
```

#### Handling Partial Content Updates (Streaming)

**Challenge:** LLM sends content in small chunks (10-50 tokens), updating too frequently causes jank

**Solution: Debounced Updates**

```typescript
import { debounce } from 'lodash-es';

// Accumulate chunks in memory, flush to Zustand every 100ms
class StreamingContentBuffer {
    private buffers: Map<string, string> = new Map();
    private flushDebounced = debounce(() => this.flush(), 100);

    appendChunk(operationId: string, chunk: string) {
        const current = this.buffers.get(operationId) || '';
        this.buffers.set(operationId, current + chunk);
        this.flushDebounced();
    }

    flush() {
        this.buffers.forEach((content, operationId) => {
            updateOperation(operationId, { content });
        });
        this.buffers.clear();
    }
}
```

**Alternative: requestAnimationFrame batching**
```typescript
let scheduled = false;
let pendingUpdates: Map<string, string> = new Map();

function scheduleUpdate(operationId: string, content: string) {
    pendingUpdates.set(operationId, content);

    if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(() => {
            // Batch all updates into single Zustand update
            pendingUpdates.forEach((content, id) => {
                updateOperation(id, { content });
            });
            pendingUpdates.clear();
            scheduled = false;
        });
    }
}
```

#### Avoiding Re-renders During Rapid Updates

**Key Techniques:**

1. **React.memo on Node Components**
```typescript
export const StreamingNode = React.memo(({ operationId }) => {
    const content = useLLMStore(state => state.operations[operationId]?.content);
    return <div>{content}</div>;
}, (prev, next) => {
    // Custom comparison: only re-render if content length changes by >10 chars
    return Math.abs(prev.content.length - next.content.length) < 10;
});
```

2. **Separate Stores for Different Concerns**
```typescript
// Separate store for LLM operations (high update frequency)
const useLLMStore = create<LLMOperationsStore>(...);

// Separate store for graph structure (low update frequency)
const useGraphStore = create<GraphStore>(...);
```

3. **Transient Updates (Outside Zustand)**
```typescript
// For very rapid updates, use React.useRef instead of Zustand
const contentRef = useRef('');

eventSource.onmessage = (event) => {
    contentRef.current += event.data;
    // Update DOM directly for smooth streaming
    divRef.current.textContent = contentRef.current;
};

// Commit to Zustand only on completion
eventSource.addEventListener('complete', () => {
    updateOperation(operationId, {
        content: contentRef.current,
        status: 'completed'
    });
});
```

#### State Reconciliation on Completion

**Pattern:**
```typescript
const reconcileOperation = (operationId: string, serverNode: Node) => {
    const operation = useLLMStore.getState().operations[operationId];

    if (!operation) return;  // Already cleaned up

    // Replace temporary node with server node
    const graphStore = useGraphStore.getState();
    graphStore.replaceNode(operation.nodeId, serverNode);

    // Clean up operation state
    completeOperation(operationId);

    // Optional: Remove operation after 5 seconds
    setTimeout(() => {
        removeOperation(operationId);
    }, 5000);
};
```

### Decision: **Zustand with Selective Subscriptions + Debounced Updates**

**Rationale:**
1. **Zustand's shallow comparison** prevents unnecessary re-renders (critical for performance)
2. **Debouncing (100ms)** balances real-time feel with performance (10 updates/sec)
3. **Separate stores** isolate high-frequency updates (operations) from stable state (graph structure)
4. **Hybrid optimistic/server-driven** provides immediate feedback while maintaining consistency

**Alternatives Considered:**
- **Redux Toolkit:** Too much boilerplate, no performance advantage (rejected)
- **Jotai:** Atomic state great for fine-grained control, but more complex mental model (rejected for consistency with existing Zustand usage)
- **Direct DOM updates:** Faster but loses React benefits, hard to maintain (rejected except for extreme cases)

**Implementation Hints:**
- Use `shallow` comparison from `zustand/shallow` for object subscriptions
- Keep operation state flat (avoid nested objects)
- Use `immer` middleware for immutable updates
- Profile with React DevTools to identify re-render hotspots

**Risks/Tradeoffs:**
- **Memory:** Keeping all operation history in store (mitigated by cleanup after completion)
- **Complexity:** Managing two state systems (Zustand + SSE) requires careful synchronization
- **Race conditions:** Multiple updates to same node must be serialized

---

## Task 4: LLM Provider Streaming APIs

### Research Question
How do streaming APIs differ across OpenAI, Anthropic, and Ollama? How to create a unified interface?

### Provider Comparison

#### OpenAI Streaming API

**Protocol:** SSE (Server-Sent Events)

**Request Format:**
```python
import openai

response = openai.chat.completions.create(
    model="gpt-4-turbo",
    messages=[{"role": "user", "content": "Generate a node"}],
    stream=True  # Enable streaming
)

for chunk in response:
    delta = chunk.choices[0].delta
    if delta.content:
        print(delta.content, end='')
```

**Chunk Format:**
```json
{
    "id": "chatcmpl-abc123",
    "object": "chat.completion.chunk",
    "created": 1677652288,
    "model": "gpt-4-turbo",
    "choices": [
        {
            "index": 0,
            "delta": {
                "content": "Hello"
            },
            "finish_reason": null
        }
    ]
}
```

**Key Characteristics:**
- **Delta format:** Only sends new tokens, not full content
- **Finish reason:** `null` during streaming, `"stop"` on completion
- **Rate limits:** 3,500 RPM (tier 1), 10,000 RPM (tier 2)

#### Anthropic Claude Streaming API

**Protocol:** SSE

**Request Format:**
```python
import anthropic

client = anthropic.Anthropic(api_key="...")

with client.messages.stream(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Generate a node"}]
) as stream:
    for text in stream.text_stream:
        print(text, end='')
```

**Chunk Format:**
```json
{
    "type": "content_block_delta",
    "index": 0,
    "delta": {
        "type": "text_delta",
        "text": "Hello"
    }
}
```

**Key Characteristics:**
- **Event types:** `message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_stop`
- **System prompts:** Sent separately in `system` parameter (not in messages array)
- **Rate limits:** 50 requests/minute (tier 1)

#### Ollama Local Streaming API

**Protocol:** HTTP streaming (newline-delimited JSON)

**Request Format:**
```python
import requests

response = requests.post(
    "http://localhost:11434/api/generate",
    json={
        "model": "llama3.2",
        "prompt": "Generate a node",
        "stream": True
    },
    stream=True
)

for line in response.iter_lines():
    if line:
        chunk = json.loads(line)
        print(chunk['response'], end='')
```

**Chunk Format:**
```json
{
    "model": "llama3.2",
    "created_at": "2024-11-21T10:30:00Z",
    "response": "Hello",
    "done": false
}
```

**Key Characteristics:**
- **Newline-delimited JSON:** Each line is complete JSON object
- **`done` flag:** `false` during streaming, `true` on completion
- **Local inference:** No rate limits, limited by hardware

### Unified Streaming Interface

**Design: Provider Adapter Pattern**

```python
from abc import ABC, abstractmethod
from typing import AsyncIterator, Dict, Any

class LLMStreamProvider(ABC):
    """Abstract base class for LLM streaming providers."""

    @abstractmethod
    async def stream_completion(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream text completion.

        Yields:
            str: Text chunk (delta content only)
        """
        pass

    @abstractmethod
    def get_rate_limit_info(self) -> Dict[str, Any]:
        """Return rate limit information for this provider."""
        pass


class OpenAIStreamProvider(LLMStreamProvider):
    def __init__(self, api_key: str, model: str = "gpt-4-turbo"):
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = model

    async def stream_completion(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs
    ) -> AsyncIterator[str]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True,
            **kwargs
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content

    def get_rate_limit_info(self) -> Dict[str, Any]:
        return {
            "rpm": 3500,  # Tier 1
            "tpm": 90000,  # Tokens per minute
            "provider": "openai"
        }


class AnthropicStreamProvider(LLMStreamProvider):
    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022"):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model

    async def stream_completion(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs
    ) -> AsyncIterator[str]:
        async with self.client.messages.stream(
            model=self.model,
            max_tokens=kwargs.get('max_tokens', 1024),
            system=system_prompt or "",
            messages=[{"role": "user", "content": prompt}]
        ) as stream:
            async for text in stream.text_stream:
                yield text

    def get_rate_limit_info(self) -> Dict[str, Any]:
        return {
            "rpm": 50,
            "provider": "anthropic"
        }


class OllamaStreamProvider(LLMStreamProvider):
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2"):
        self.base_url = base_url
        self.model = model

    async def stream_completion(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs
    ) -> AsyncIterator[str]:
        import aiohttp

        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": full_prompt,
                    "stream": True
                }
            ) as response:
                async for line in response.content:
                    if line:
                        chunk = json.loads(line)
                        if not chunk.get('done'):
                            yield chunk['response']

    def get_rate_limit_info(self) -> Dict[str, Any]:
        return {
            "rpm": None,  # No rate limit (local)
            "provider": "ollama"
        }


# Factory function
def create_llm_provider(
    provider: str,
    api_key: str | None = None,
    **kwargs
) -> LLMStreamProvider:
    """Create LLM provider based on configuration."""
    if provider == "openai":
        return OpenAIStreamProvider(api_key=api_key, **kwargs)
    elif provider == "anthropic":
        return AnthropicStreamProvider(api_key=api_key, **kwargs)
    elif provider == "ollama":
        return OllamaStreamProvider(**kwargs)
    else:
        raise ValueError(f"Unknown provider: {provider}")
```

### Token Buffering Strategy

**Challenge:** Balance real-time feel vs network overhead

**Research Findings:**
- **Individual tokens:** Too frequent (100+ updates/sec), high overhead
- **Large buffers:** Laggy feel (>500ms delays perceived)
- **Optimal:** 50-100ms chunks (10-20 updates/sec)

**Implementation:**
```python
import asyncio
from collections import deque

class TokenBuffer:
    def __init__(self, flush_interval: float = 0.1):  # 100ms
        self.buffer = deque()
        self.flush_interval = flush_interval
        self.last_flush = asyncio.get_event_loop().time()

    async def add_token(self, token: str) -> str | None:
        """Add token to buffer, return chunk if ready to flush."""
        self.buffer.append(token)

        now = asyncio.get_event_loop().time()
        if now - self.last_flush >= self.flush_interval:
            return self.flush()
        return None

    def flush(self) -> str:
        """Flush buffer and return accumulated tokens."""
        chunk = ''.join(self.buffer)
        self.buffer.clear()
        self.last_flush = asyncio.get_event_loop().time()
        return chunk


# Usage in streaming endpoint
async def stream_with_buffering(provider: LLMStreamProvider, prompt: str):
    buffer = TokenBuffer(flush_interval=0.1)

    async for token in provider.stream_completion(prompt):
        chunk = await buffer.add_token(token)
        if chunk:
            yield {"type": "content", "content": chunk}

    # Flush remaining tokens
    final_chunk = buffer.flush()
    if final_chunk:
        yield {"type": "content", "content": final_chunk}

    yield {"type": "complete"}
```

### Decision: **Provider Adapter Pattern + 100ms Token Buffering**

**Rationale:**
1. **Adapter pattern** provides clean abstraction, easy to add new providers
2. **100ms buffering** balances real-time feel (perceived as instant) with efficiency
3. **Async iterators** match Python's async streaming paradigm
4. **Rate limit info** exposed for intelligent queuing

**Alternatives Considered:**
- **LiteLLM library:** Unified interface exists, but adds dependency and learning curve (deferred for future)
- **Per-token streaming:** Maximum real-time but wasteful (rejected)
- **Fixed chunk sizes (N tokens):** Variable timing feels less responsive (rejected)

**Implementation Hints:**
- Use `aiohttp` for Ollama (better async support than `requests`)
- Handle connection errors with exponential backoff (see Task 5)
- Log provider-specific errors for debugging

**Risks/Tradeoffs:**
- **Provider changes:** APIs may change, require adapter updates
- **Feature parity:** Not all providers support same features (tool use, vision)
- **Buffering:** 100ms delay vs real-time (acceptable for UX)

---

## Task 5: Concurrency Limits and Queue Management

### Research Question
What concurrency limits and queue patterns ensure fair resource allocation and graceful degradation?

### Concurrency Limit Analysis

#### Recommended Default: **10 Concurrent Operations**

**Rationale:**
1. **Provider Rate Limits:**
   - OpenAI Tier 1: 3,500 RPM ≈ 58 RPS
   - Anthropic Tier 1: 50 RPM ≈ 0.83 RPS
   - 10 concurrent operations with avg 20s duration = ~30 requests/minute
   - Safely under Anthropic limit (most restrictive)

2. **Memory Considerations:**
   - Each streaming operation: ~10MB memory (KV cache, connection buffers)
   - 10 operations × 10MB = 100MB (acceptable on modern servers)

3. **User Experience:**
   - 10 concurrent = support 2-3 active users simultaneously
   - Queue wait times: <30s under normal load

**Configuration:**
```python
# Environment variable with sensible default
MAX_CONCURRENT_LLM = int(os.getenv("MAX_CONCURRENT_LLM_OPERATIONS", "10"))
```

#### Queue Data Structure: **asyncio.Queue (FIFO)**

**Implementation:**
```python
from dataclasses import dataclass
from enum import Enum
from uuid import UUID
import asyncio

class OperationPriority(Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2

@dataclass
class QueuedOperation:
    id: UUID
    user_id: str
    node_id: str
    prompt: str
    priority: OperationPriority = OperationPriority.NORMAL
    enqueued_at: datetime

class LLMOperationQueue:
    def __init__(self, max_concurrent: int = 10):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.queue = asyncio.PriorityQueue()  # For future priority support
        self.active_operations: Set[UUID] = set()

    async def enqueue(self, operation: QueuedOperation) -> int:
        """Enqueue operation, return queue position."""
        await self.queue.put((
            -operation.priority.value,  # Negative for high priority first
            operation.enqueued_at.timestamp(),
            operation
        ))
        return self.queue.qsize()

    async def process_queue(self):
        """Background task to process queue."""
        while True:
            # Wait for available slot
            async with self.semaphore:
                # Get next operation
                priority, timestamp, operation = await self.queue.get()

                try:
                    # Execute operation
                    self.active_operations.add(operation.id)
                    await self._execute_operation(operation)
                finally:
                    self.active_operations.remove(operation.id)
                    self.queue.task_done()
```

#### User Feedback on Queue Status

**Real-time Queue Position Updates:**
```python
# SSE endpoint for queue status
@router.get("/llm-operations/{operation_id}/status")
async def get_operation_status(operation_id: UUID):
    async def event_stream():
        while True:
            status = get_operation_status(operation_id)
            yield f"data: {json.dumps(status)}\n\n"

            if status['state'] in ['completed', 'error']:
                break

            await asyncio.sleep(1)  # Update every second

    return StreamingResponse(event_stream(), media_type="text/event-stream")

def get_operation_status(operation_id: UUID) -> dict:
    if operation_id in active_operations:
        return {
            "state": "processing",
            "queue_position": 0,
            "active_count": len(active_operations)
        }

    # Find position in queue
    position = find_position_in_queue(operation_id)
    if position >= 0:
        return {
            "state": "queued",
            "queue_position": position,
            "estimated_wait": position * 20  # Rough estimate: 20s per operation
        }

    # Check if completed
    operation = get_completed_operation(operation_id)
    if operation:
        return {"state": "completed"}

    return {"state": "not_found"}
```

**Client-side UI:**
```typescript
// Display queue status
const QueueStatus = ({ operationId }: { operationId: string }) => {
    const [status, setStatus] = useState(null);

    useEffect(() => {
        const eventSource = new EventSource(`/api/llm-operations/${operationId}/status`);
        eventSource.onmessage = (event) => {
            setStatus(JSON.parse(event.data));
        };
        return () => eventSource.close();
    }, [operationId]);

    if (!status) return <Spinner />;

    if (status.state === 'queued') {
        return (
            <div>
                <span>Queued (position {status.queue_position})</span>
                <span>~{status.estimated_wait}s wait</span>
            </div>
        );
    }

    if (status.state === 'processing') {
        return <span>Processing... ({status.active_count} active)</span>;
    }

    return null;
};
```

#### Graceful Degradation Under Load

**Strategy: Adaptive Rate Limiting**

```python
class AdaptiveConcurrencyManager:
    def __init__(self, base_limit: int = 10):
        self.base_limit = base_limit
        self.current_limit = base_limit
        self.error_count = 0
        self.success_count = 0

    def on_rate_limit_error(self):
        """Reduce concurrency when rate limited."""
        self.error_count += 1
        if self.error_count > 5:
            self.current_limit = max(1, self.current_limit - 2)
            logger.warning(f"Reduced concurrency to {self.current_limit}")

    def on_success(self):
        """Gradually increase concurrency on success."""
        self.success_count += 1
        if self.success_count > 20 and self.current_limit < self.base_limit:
            self.current_limit += 1
            self.success_count = 0
            logger.info(f"Increased concurrency to {self.current_limit}")
```

#### Rate Limit Handling with Exponential Backoff

**Pattern:**
```python
import random

async def execute_with_backoff(
    func,
    max_retries: int = 5,
    base_delay: float = 1.0,
    max_delay: float = 60.0
):
    """Execute function with exponential backoff on rate limits."""
    for attempt in range(max_retries):
        try:
            return await func()
        except RateLimitError as e:
            if attempt == max_retries - 1:
                raise  # Final attempt failed

            # Exponential backoff with jitter
            delay = min(base_delay * (2 ** attempt), max_delay)
            jitter = random.uniform(0, delay * 0.1)  # ±10% jitter
            total_delay = delay + jitter

            # Honor Retry-After header if present
            if e.retry_after:
                total_delay = float(e.retry_after)

            logger.warning(f"Rate limited, retrying in {total_delay:.1f}s (attempt {attempt + 1})")
            await asyncio.sleep(total_delay)
        except Exception as e:
            # Non-retryable error
            logger.error(f"Non-retryable error: {e}")
            raise
```

**Retry-After Header Handling:**
```python
def parse_retry_after(headers: dict) -> float | None:
    """Parse Retry-After header (seconds or HTTP date)."""
    retry_after = headers.get('Retry-After')
    if not retry_after:
        return None

    try:
        # Try parsing as integer (seconds)
        return float(retry_after)
    except ValueError:
        # Try parsing as HTTP date
        from email.utils import parsedate_to_datetime
        retry_date = parsedate_to_datetime(retry_after)
        return (retry_date - datetime.now(timezone.utc)).total_seconds()
```

### Decision: **10 Concurrent + FIFO Queue + Exponential Backoff**

**Rationale:**
1. **10 concurrent** balances throughput with provider limits
2. **FIFO queue** ensures fairness (first come, first served)
3. **Exponential backoff** handles transient failures gracefully
4. **Adaptive rate limiting** automatically adjusts to load

**Alternatives Considered:**
- **Priority queue:** Adds complexity, users expect fairness (deferred for future)
- **Per-user limits:** Prevents single user hogging resources (future enhancement)
- **Fixed delays:** Less efficient than exponential backoff (rejected)

**Implementation Hints:**
- Start queue processing in `startup` event: `asyncio.create_task(queue.process_queue())`
- Persist queue to Redis for crash recovery (optional enhancement)
- Monitor queue length with Prometheus/Grafana

**Risks/Tradeoffs:**
- **Starvation:** Low priority users may wait indefinitely (mitigated by FIFO)
- **Thundering herd:** Many operations finish simultaneously (mitigated by jitter)
- **Queue growth:** Unbounded queue may consume memory (add max queue size)

---

## Task 6: State Persistence During Concurrent Operations

### Research Question
How to persist LLM operation state to enable resumption after browser refresh or connection interruption?

### Database Schema Design

#### PostgreSQL Schema

**Table: `llm_operations`**
```sql
CREATE TABLE llm_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,

    -- Operation state
    status VARCHAR(20) NOT NULL CHECK (status IN ('queued', 'streaming', 'completed', 'error', 'cancelled')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

    -- Content (accumulated during streaming)
    content TEXT NOT NULL DEFAULT '',
    content_length INTEGER NOT NULL DEFAULT 0,

    -- LLM configuration
    provider VARCHAR(50) NOT NULL,  -- 'openai', 'anthropic', 'ollama'
    model VARCHAR(100) NOT NULL,
    prompt TEXT NOT NULL,
    system_prompt TEXT,

    -- Timing
    queued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    metadata JSONB,  -- Provider-specific data, token counts, etc.

    -- Indexes for common queries
    INDEX idx_operations_status (status),
    INDEX idx_operations_user_id (user_id),
    INDEX idx_operations_node_id (node_id),
    INDEX idx_operations_created_at (queued_at DESC)
);
```

**State Transitions:**
```
queued → streaming → completed
                  ↘ error
                  ↘ cancelled
```

#### Redis for Active Streams

**Use Case:** Fast access to actively streaming operations

**Schema:**
```python
# Redis keys
ACTIVE_STREAM_KEY = "llm:stream:{operation_id}"
STREAM_SUBSCRIBERS_KEY = "llm:stream:{operation_id}:subscribers"

# Example data
{
    "operation_id": "uuid",
    "current_content": "Accumulated text so far...",
    "last_chunk_at": 1700000000.123,
    "subscriber_count": 2
}
```

**Implementation:**
```python
import redis.asyncio as redis

class OperationStateManager:
    def __init__(self, pg_pool, redis_client):
        self.pg = pg_pool
        self.redis = redis_client

    async def create_operation(
        self,
        node_id: UUID,
        graph_id: UUID,
        user_id: str,
        provider: str,
        model: str,
        prompt: str
    ) -> UUID:
        """Create new operation in database."""
        async with self.pg.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO llm_operations
                (node_id, graph_id, user_id, provider, model, prompt, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'queued')
                RETURNING id
            """, node_id, graph_id, user_id, provider, model, prompt)
            return row['id']

    async def start_streaming(self, operation_id: UUID):
        """Mark operation as streaming and cache in Redis."""
        # Update database
        async with self.pg.acquire() as conn:
            await conn.execute("""
                UPDATE llm_operations
                SET status = 'streaming', started_at = NOW()
                WHERE id = $1
            """, operation_id)

        # Create Redis entry for fast access
        await self.redis.hset(
            f"llm:stream:{operation_id}",
            mapping={
                "current_content": "",
                "last_chunk_at": time.time(),
                "subscriber_count": 0
            }
        )
        # Expire after 1 hour (safety cleanup)
        await self.redis.expire(f"llm:stream:{operation_id}", 3600)

    async def append_content(self, operation_id: UUID, chunk: str):
        """Append content chunk to Redis (hot path - no DB write)."""
        await self.redis.hincrby(f"llm:stream:{operation_id}", "content_length", len(chunk))
        await self.redis.hset(f"llm:stream:{operation_id}", "last_chunk_at", time.time())
        # Content stored in memory/Redis, flushed to DB on completion

    async def complete_operation(self, operation_id: UUID, final_content: str):
        """Mark operation complete and persist final content."""
        async with self.pg.acquire() as conn:
            await conn.execute("""
                UPDATE llm_operations
                SET status = 'completed',
                    content = $2,
                    content_length = $3,
                    completed_at = NOW(),
                    progress = 100
                WHERE id = $1
            """, operation_id, final_content, len(final_content))

        # Keep Redis entry for 5 minutes for late joiners
        await self.redis.expire(f"llm:stream:{operation_id}", 300)
```

### Resume Streaming After Browser Refresh

**Pattern: Last-Event-ID with Redis**

**Server-side:**
```python
@router.get("/llm-operations/{operation_id}/stream")
async def resume_stream(
    operation_id: UUID,
    last_event_id: str | None = Header(None)
):
    """Resume streaming from last received event."""

    # Check Redis for active stream
    stream_data = await redis.hgetall(f"llm:stream:{operation_id}")

    if stream_data:
        # Operation still streaming - send missed content
        current_content = stream_data.get('current_content', '')

        async def event_generator():
            # Send catch-up content if client reconnected mid-stream
            if last_event_id:
                last_position = int(last_event_id)
                missed_content = current_content[last_position:]
                if missed_content:
                    yield {
                        "event": "content",
                        "id": str(len(current_content)),
                        "data": json.dumps({"content": missed_content})
                    }

            # Subscribe to new chunks
            async for chunk in stream_broadcaster.subscribe(operation_id):
                yield {
                    "event": "content",
                    "id": str(len(current_content) + len(chunk)),
                    "data": json.dumps({"content": chunk})
                }

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    # Operation completed or not found - fetch from database
    async with pg_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT status, content, error_message
            FROM llm_operations
            WHERE id = $1
        """, operation_id)

        if not row:
            raise HTTPException(404, "Operation not found")

        # Send final state
        async def final_state():
            if row['status'] == 'completed':
                yield {
                    "event": "content",
                    "data": json.dumps({"content": row['content']})
                }
                yield {
                    "event": "complete",
                    "data": json.dumps({"status": "completed"})
                }
            elif row['status'] == 'error':
                yield {
                    "event": "error",
                    "data": json.dumps({"error": row['error_message']})
                }

        return StreamingResponse(final_state(), media_type="text/event-stream")
```

**Client-side (EventSource with Last-Event-ID):**
```typescript
const connectToStream = (operationId: string) => {
    const eventSource = new EventSource(
        `/api/llm-operations/${operationId}/stream`
    );

    let accumulatedContent = '';

    eventSource.addEventListener('content', (event) => {
        const data = JSON.parse(event.data);
        accumulatedContent += data.content;
        updateNodeContent(operationId, accumulatedContent);
    });

    eventSource.addEventListener('complete', () => {
        eventSource.close();
        markOperationComplete(operationId);
    });

    eventSource.addEventListener('error', (event) => {
        const data = JSON.parse(event.data);
        showError(data.error);
        eventSource.close();
    });

    // Browser automatically sends Last-Event-ID on reconnect
    eventSource.onerror = () => {
        // EventSource automatically reconnects
        console.log('Connection lost, reconnecting...');
    };

    return eventSource;
};
```

### Handle Interrupted Operations

**Cleanup Strategy:**
```python
import asyncio

async def monitor_stale_operations():
    """Background task to detect and clean up stale operations."""
    while True:
        async with pg_pool.acquire() as conn:
            # Find operations streaming for >5 minutes without updates
            stale_ops = await conn.fetch("""
                SELECT id FROM llm_operations
                WHERE status = 'streaming'
                AND started_at < NOW() - INTERVAL '5 minutes'
            """)

            for row in stale_ops:
                operation_id = row['id']
                logger.warning(f"Detected stale operation {operation_id}")

                # Check Redis - if no subscribers, mark as error
                subscribers = await redis.scard(f"llm:stream:{operation_id}:subscribers")
                if subscribers == 0:
                    await conn.execute("""
                        UPDATE llm_operations
                        SET status = 'error',
                            error_message = 'Operation interrupted - no active connections',
                            completed_at = NOW()
                        WHERE id = $1
                    """, operation_id)

        await asyncio.sleep(60)  # Check every minute
```

### Atomic State Transitions (Prevent Race Conditions)

**Pattern: Optimistic Locking**
```python
async def transition_state(
    operation_id: UUID,
    expected_status: str,
    new_status: str
) -> bool:
    """Atomically transition operation state."""
    async with pg_pool.acquire() as conn:
        result = await conn.fetchval("""
            UPDATE llm_operations
            SET status = $3
            WHERE id = $1 AND status = $2
            RETURNING id
        """, operation_id, expected_status, new_status)

        return result is not None  # True if transition succeeded
```

**Usage:**
```python
# Prevent multiple workers from starting same operation
if await transition_state(operation_id, 'queued', 'streaming'):
    # We successfully claimed the operation
    await process_llm_request(operation_id)
else:
    # Another worker claimed it
    logger.warning(f"Operation {operation_id} already claimed")
```

### Decision: **PostgreSQL + Redis Hybrid**

**Rationale:**
1. **PostgreSQL** for durable state, enables recovery after crashes
2. **Redis** for hot data (active streams), low latency access
3. **Last-Event-ID** built into SSE, handles reconnection automatically
4. **Optimistic locking** prevents race conditions between workers

**Alternatives Considered:**
- **PostgreSQL only:** High latency for frequent content updates (rejected)
- **Redis only:** No durability, data loss on Redis restart (rejected)
- **Kafka/Message queue:** Overkill for this use case (rejected)

**Implementation Hints:**
- Use connection pooling (`asyncpg.create_pool`) for PostgreSQL
- Set Redis maxmemory-policy to `allkeys-lru` to auto-evict old streams
- Partition operations by `user_id` for multi-tenant performance

**Risks/Tradeoffs:**
- **Consistency:** Redis and PostgreSQL may temporarily diverge (eventual consistency)
- **Complexity:** Two storage systems to manage
- **Redis memory:** Active streams consume memory (mitigated by expiration)

---

## Task 7: Performance Optimization

### Research Question
What are the critical performance considerations for 10+ concurrent streaming operations?

### Memory Usage Analysis

#### Backend Memory Profile

**Per-operation memory:**
```
LLM API connection:     ~2MB (HTTP connection buffers)
Accumulated content:    ~1MB (average node content)
Redis pub/sub:          ~0.5MB
FastAPI request state:  ~0.5MB
Python overhead:        ~1MB
--------------------------------
Total per operation:    ~5MB
```

**10 concurrent operations:** 10 × 5MB = **50MB** (acceptable)

**Memory Leak Prevention:**
```python
import weakref

class StreamManager:
    def __init__(self):
        # Use weak references to allow garbage collection
        self.active_streams = weakref.WeakValueDictionary()

    def register_stream(self, operation_id: UUID, stream):
        self.active_streams[operation_id] = stream

    async def cleanup_completed_streams(self):
        """Periodic cleanup of completed streams."""
        while True:
            # Weak references automatically removed when objects deleted
            # Manual cleanup for error cases
            for op_id, stream in list(self.active_streams.items()):
                if stream.is_complete():
                    del self.active_streams[op_id]

            await asyncio.sleep(300)  # Clean up every 5 minutes
```

#### Frontend Memory Profile

**React Component Memory:**
```
Per streaming node:
- Component state:     ~10KB
- Zustand state:       ~5KB
- EventSource:         ~50KB (browser managed)
- DOM node:            ~20KB
--------------------------------
Total per node:        ~85KB
```

**10 streaming nodes:** 10 × 85KB = **850KB** (negligible)

**Memory Leak Prevention:**
```typescript
useEffect(() => {
    const eventSource = new EventSource(url);

    // ... event handlers ...

    // CRITICAL: Close EventSource on unmount
    return () => {
        eventSource.close();
    };
}, [url]);
```

### ReactFlow Performance with Real-Time Updates

#### Optimization Strategies

**1. Memoize Node Components**
```typescript
export const StreamingNode = React.memo(({ data, id }) => {
    const content = useStreamingContent(id);

    return (
        <div className="streaming-node">
            <div className="content">{content}</div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Only re-render if node ID changes
    return prevProps.id === nextProps.id;
});
```

**2. Separate Streaming State from Graph State**
```typescript
// BAD: Streaming content in ReactFlow nodes state
const nodes = useReactFlow(state => state.nodes);

// GOOD: Streaming content in separate store
const nodes = useReactFlow(state => state.nodes);  // Static structure
const streamingContent = useStreamingStore(state => state.content);  // Dynamic content
```

**3. Use onlyRenderVisibleElements**
```typescript
<ReactFlow
    nodes={nodes}
    edges={edges}
    onlyRenderVisibleElements={true}  // Only render nodes in viewport
    minZoom={0.1}
    maxZoom={4}
/>
```

**4. Debounce Content Updates**
```typescript
const debouncedUpdate = useMemo(
    () => debounce((content: string) => {
        updateNodeContent(nodeId, content);
    }, 100),  // Update max 10 times per second
    [nodeId]
);

useEffect(() => {
    const eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
        debouncedUpdate(event.data);
    };
    return () => eventSource.close();
}, [url]);
```

**5. Reduce ReactFlow Re-renders**
```typescript
// Use callbacks to avoid re-creating functions
const onNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
}, []);

const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
}, []);
```

### Debouncing/Throttling UI Updates

**Strategy: Adaptive Debouncing**

```typescript
class AdaptiveDebouncer {
    private timers: Map<string, NodeJS.Timeout> = new Map();

    debounce(
        key: string,
        fn: () => void,
        delay: number = 100
    ) {
        // Clear existing timer
        const existing = this.timers.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        // Set new timer
        const timer = setTimeout(() => {
            fn();
            this.timers.delete(key);
        }, delay);

        this.timers.set(key, timer);
    }

    // Immediate execution for important updates
    immediate(key: string, fn: () => void) {
        this.cancel(key);
        fn();
    }

    cancel(key: string) {
        const timer = this.timers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(key);
        }
    }
}

// Usage
const debouncer = new AdaptiveDebouncer();

eventSource.onmessage = (event) => {
    const chunk = JSON.parse(event.data);

    if (chunk.type === 'content') {
        // Debounce content updates
        debouncer.debounce(
            operationId,
            () => updateContent(operationId, chunk.content),
            100
        );
    } else if (chunk.type === 'complete') {
        // Immediate update for completion
        debouncer.immediate(
            operationId,
            () => completeOperation(operationId)
        );
    }
};
```

### Preventing Memory Leaks in Long-Running Streams

**Checklist:**

1. **Close EventSource on unmount**
```typescript
useEffect(() => {
    const eventSource = new EventSource(url);
    return () => eventSource.close();  // CRITICAL
}, [url]);
```

2. **Clear intervals/timeouts**
```typescript
useEffect(() => {
    const interval = setInterval(() => checkStatus(), 1000);
    return () => clearInterval(interval);
}, []);
```

3. **Unsubscribe from Zustand**
```typescript
useEffect(() => {
    const unsubscribe = useStreamingStore.subscribe(
        state => state.operations[operationId],
        (operation) => handleUpdate(operation)
    );
    return unsubscribe;
}, [operationId]);
```

4. **Abort fetch requests**
```typescript
useEffect(() => {
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
        .then(response => handleResponse(response));

    return () => controller.abort();
}, [url]);
```

### Profiling Tools

**Backend:**
```python
# Memory profiling
from memory_profiler import profile

@profile
async def stream_llm_response(operation_id):
    # ... streaming logic ...
    pass

# Performance profiling
import cProfile
cProfile.run('asyncio.run(main())', 'profile.stats')
```

**Frontend:**
```typescript
// React DevTools Profiler
import { Profiler } from 'react';

<Profiler id="StreamingNodes" onRender={onRenderCallback}>
    <StreamingNode />
</Profiler>

function onRenderCallback(
    id, phase, actualDuration, baseDuration, startTime, commitTime
) {
    console.log(`${id} (${phase}) took ${actualDuration}ms`);
}
```

**Chrome DevTools:**
- Performance tab: Record timeline during streaming
- Memory tab: Take heap snapshots before/after streaming
- Network tab: Monitor SSE connection health

### Performance Benchmarks

**Target Metrics:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| UI responsiveness | <100ms | Time from chunk arrival to DOM update |
| Memory per operation | <10MB | Chrome DevTools heap size |
| Concurrent operations | 10+ | Load test with 10 simultaneous streams |
| Stream latency | <200ms | Time from LLM token to client display |
| ReactFlow FPS | >30 FPS | During concurrent streaming |

**Load Testing:**
```python
# Backend load test (pytest + locust)
from locust import HttpUser, task, between

class StreamingUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def start_streaming(self):
        with self.client.get(
            "/api/llm-operations/stream",
            stream=True,
            catch_response=True
        ) as response:
            for line in response.iter_lines():
                if line:
                    # Measure latency
                    pass
```

### Decision: **100ms Debouncing + Memoization + Lazy Rendering**

**Rationale:**
1. **100ms debouncing** balances real-time feel with performance
2. **React.memo** prevents unnecessary re-renders (critical for ReactFlow)
3. **Separate stores** isolate high-frequency updates
4. **onlyRenderVisibleElements** reduces DOM nodes (ReactFlow optimization)

**Alternatives Considered:**
- **No debouncing:** Too many updates, poor performance (rejected)
- **requestAnimationFrame batching:** More complex, similar results to debounce (not needed)
- **Virtual scrolling:** Overkill for <200 nodes (deferred)

**Implementation Hints:**
- Profile early and often (premature optimization is evil, but late optimization is worse)
- Use React DevTools Profiler to identify re-render hotspots
- Monitor memory with Chrome DevTools during development

**Risks/Tradeoffs:**
- **Debouncing delay:** 100ms feels instant to humans but introduces latency
- **Memoization overhead:** Comparison functions add CPU cost (negligible for most cases)
- **Complexity:** Performance optimizations increase code complexity

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
1. Implement SSE streaming endpoint in FastAPI
2. Create unified LLM provider interface
3. Set up PostgreSQL operation state table
4. Implement basic EventSource client

### Phase 2: Concurrency (Week 2)
5. Add asyncio.Semaphore concurrency control
6. Implement operation queue (FIFO)
7. Add exponential backoff retry logic
8. Create Redis caching layer

### Phase 3: State Management (Week 3)
9. Build Zustand streaming operations store
10. Implement debounced content updates
11. Add reconnection handling with Last-Event-ID
12. Create queue status UI

### Phase 4: Performance (Week 4)
13. Optimize ReactFlow rendering
14. Add memory leak prevention
15. Implement adaptive rate limiting
16. Performance testing and profiling

### Phase 5: Polish (Week 5)
17. Error handling and user feedback
18. Monitoring and observability
19. Documentation
20. Load testing

---

## Key Dependencies

**Backend:**
- `fastapi`: SSE streaming support
- `asyncpg`: PostgreSQL async driver
- `redis`: Redis async client
- `openai`: OpenAI streaming API
- `anthropic`: Anthropic streaming API
- `aiohttp`: Ollama HTTP client

**Frontend:**
- `zustand`: State management (existing)
- `reactflow`: Canvas rendering (existing)
- No new dependencies required

**All dependencies are MIT/Apache-2.0 licensed, no licensing concerns.**

---

## Risks and Mitigation Strategies

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Rate limit exhaustion | High | Medium | Adaptive concurrency, exponential backoff |
| Memory leaks in long streams | Medium | Low | Weak references, periodic cleanup |
| SSE connection instability | Medium | Low | Last-Event-ID reconnection, Redis caching |
| ReactFlow performance degradation | High | Medium | Memoization, debouncing, lazy rendering |
| PostgreSQL bottleneck | Medium | Low | Redis caching, connection pooling |
| Race conditions in state updates | Medium | Low | Optimistic locking, atomic transactions |

---

## Open Questions for Implementation

1. **Token counting:** Should we track token usage per operation for cost monitoring?
2. **Cancellation:** How to handle user cancelling operation mid-stream?
3. **Multi-user editing:** What happens if two users edit same node simultaneously while LLM is streaming?
4. **Error recovery:** Should interrupted operations auto-resume or require manual retry?
5. **Monitoring:** What metrics to expose via Prometheus/Grafana?

---

## References

**Academic Papers:**
- TokenFlow (2025): Responsive LLM Token Streaming
- Eloquent (2024): Robust Transmission Scheme for LLM Streaming
- Cognitive Load-Aware Streaming (2025)

**Industry Resources:**
- FastAPI async/await patterns
- OpenAI streaming API documentation
- Anthropic Claude streaming guide
- ReactFlow performance optimization guide
- Zustand best practices

**Stack Overflow & Community:**
- SSE vs WebSocket for LLM streaming (2024-2025 discussions)
- Python asyncio concurrency patterns
- React performance optimization techniques

---

## Conclusion

Technical research complete. All seven tasks addressed with specific recommendations, implementation patterns, and risk assessments. Architecture balances real-time responsiveness, scalability, and maintainability.

**Key Takeaways:**
1. SSE is the right choice for LLM streaming (simpler, industry standard)
2. 10 concurrent operations with FIFO queue provides good balance
3. PostgreSQL + Redis hybrid ensures durability and performance
4. 100ms debouncing optimal for perceived real-time updates
5. Zustand with selective subscriptions prevents React re-render issues

Ready to proceed with implementation.
