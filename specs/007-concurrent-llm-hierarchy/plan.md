# Implementation Plan: Concurrent LLM Operations with Hierarchical Node Creation

**Branch**: `007-concurrent-llm-hierarchy` | **Date**: 2025-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-concurrent-llm-hierarchy/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

MindFlow enables users to perform true multi-dimensional analysis by supporting concurrent LLM operations (10+ simultaneous requests) with real-time hierarchical node creation. Users can create child nodes from completed parents while LLMs are streaming responses on other branches, enabling parallel exploration of complex reasoning spaces without sequential blocking.

**Technical Approach**: Server-Sent Events (SSE) for streaming with FastAPI asyncio-based concurrency control (asyncio.Semaphore + FIFO queue), PostgreSQL + Redis hybrid state persistence, and Zustand-based React state management with debounced updates (100ms). Provider-agnostic streaming through unified adapter pattern supporting OpenAI, Anthropic, and Ollama with exponential backoff retry logic.

## Technical Context

**Language/Version**: Python 3.11 + TypeScript 5.9.3

**Primary Dependencies**:
- Backend: FastAPI, asyncpg, redis, openai, anthropic, aiohttp, pydantic
- Frontend: React 19, Zustand, ReactFlow, TypeScript
- DevOps: PostgreSQL 15+, Redis 7+

**Storage**: PostgreSQL (durable operation state, node hierarchy, metadata) + Redis (active stream cache, hot data, performance)

**Testing**: pytest (backend unit/integration), vitest (frontend unit), @testing-library/react (React components)

**Target Platform**: Web application (multiplatform: Windows/Linux backend, all modern browsers frontend)

**Project Type**: web (frontend + backend microservices)

**Performance Goals**:
- Node creation: <500ms (even with 10 concurrent LLMs streaming)
- Streaming latency: <200ms (backend token receive to UI update)
- UI responsiveness: <100ms (all interactions: click, scroll, drag)
- Concurrent LLM operations: 10+ without degradation
- Token buffering: 50-100ms chunks (balance between real-time feel and efficiency)

**Constraints**:
- Default concurrency limit: 10 concurrent operations (configurable via `MAX_CONCURRENT_LLM_OPERATIONS` env var)
- Token buffering: 100ms flush interval
- LLM operation timeout: 3 seconds (configurable)
- Maximum queue size: 1000 pending operations
- HTTP/2 multiplexing required for 10+ SSE concurrent connections

**Scale/Scope**:
- 10+ concurrent LLM operations per user
- 20+ nodes in reasoning tree
- 5 API endpoints (create_node, stream_response, list_operations, cancel_operation, get_status)
- Single-server concurrency only (no distributed processing)
- Single-user focus (no multi-user collaboration in MVP)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**I. Graph Integrity** ✅ PASS
- Metadata-only updates during streaming (content accumulated in separate operation table, not in node)
- Hierarchy preserved (parent-child relationships stored atomically before LLM starts)
- No node structure modification during concurrent operations

**II. LLM Provider Agnostic** ✅ PASS
- Unified adapter pattern with `LLMStreamProvider` abstract base class
- Supports OpenAI, Anthropic, Ollama, extensible for new providers
- Consistent interface: `async def stream_completion(prompt, system_prompt) -> AsyncIterator[str]`

**III. Explicit Operations** ✅ PASS
- All LLM launches user-initiated (explicit "Ask LLM" button/action)
- State transitions visible in UI (queued → processing → streaming → completed/failed)
- No automatic, background, or hidden LLM operations

**IV. Test-First** ✅ PASS
- Comprehensive test plan in quickstart.md (5 phases)
- Unit tests for concurrency manager, streaming buffer, state transitions
- Integration tests for SSE streaming, queue management, error handling
- Load tests for 10+ concurrent operations

**V. Context Transparency** ✅ PASS
- Minimal context: prompt + optional system prompt only
- No graph serialization sent to LLM providers
- No implicit context injection

**VI. Multiplatform** ✅ PASS
- Python 3.11 backend compatible with Windows/Linux
- React frontend runs on all modern browsers
- Cross-platform tested (Windows/Linux before merge)

**VII. No Simulation** ✅ PASS
- Real LLM streaming with actual providers (OpenAI, Anthropic, Ollama)
- Real PostgreSQL + Redis persistence
- No mock/stub operations (all functional)

**VIII. Data Persistence** ✅ PASS
- PostgreSQL: operation state, node hierarchy, metadata (durable)
- Redis: active streams, hot cache (ephemeral, TTL-based)
- Survives browser refresh with Last-Event-ID + database recovery

**IX. Security/Privacy** ✅ PASS
- Uses existing LLM configuration manager (API keys, provider selection)
- No plaintext credential storage
- Rate-limiting prevents abuse (exponential backoff, concurrency limits)

**X. Performance** ✅ PASS
- <500ms node creation with 10 concurrent LLMs
- <200ms streaming latency (token buffering optimization)
- <100ms UI responsiveness (debounced updates, memoization)
- 100ms token flushing prevents excessive re-renders

**XI. Development Workflow** ✅ PASS
- Follows project standards (no hardcoded values, proper error handling)
- Modular design (separated concerns: streaming, state management, queuing)
- Comprehensive documentation (research.md, data-model.md, quickstart.md)

## Project Structure

### Documentation (this feature)

```text
specs/007-concurrent-llm-hierarchy/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (complete)
├── research.md          # Phase 0 output (complete - technical decisions)
├── data-model.md        # Phase 1 output (complete - entity schemas)
├── quickstart.md        # Phase 1 output (complete - developer guide)
├── contracts/
│   └── api-llm-operations.yaml  # Phase 1 output (complete - OpenAPI spec)
└── tasks.md             # Phase 2 output (to be generated by /speckit.tasks)
```

### Source Code (repository root)

#### Option 2: Web Application

**Backend Structure:**
```text
src/mindflow/
├── api/
│   ├── routes/
│   │   ├── llm_operations.py          # NEW: POST /graphs/{id}/llm-operations
│   │   ├── graphs.py                  # MODIFIED: add node state endpoints
│   │   ├── canvases.py                # Existing canvas routes
│   │   └── subgraphs.py               # Existing subgraph routes
│   └── server.py                      # MODIFIED: add LLM operation startup tasks
│
├── services/
│   ├── llm_concurrency.py             # NEW: ConcurrentLLMManager, OperationQueue
│   ├── llm_service.py                 # MODIFIED: streaming interface
│   ├── canvas_service.py              # Existing canvas operations
│   └── version_storage.py             # Existing version management
│
├── models/
│   ├── graph.py                       # MODIFIED: add NodeState entity
│   ├── node_version.py                # Existing node versioning
│   └── canvas.py                      # Existing canvas model
│
└── utils/
    ├── llm_providers.py               # NEW: OpenAI/Anthropic/Ollama adapters
    ├── token_buffer.py                # NEW: Token buffering (100ms flush)
    └── cascade.py                     # Existing cascade utilities

tests/
├── unit/
│   ├── test_llm_concurrency.py        # NEW: Concurrency manager tests
│   ├── test_token_buffer.py           # NEW: Token buffering tests
│   ├── test_llm_providers.py          # NEW: Provider adapter tests
│   ├── test_node_state.py             # NEW: Node state transitions
│   └── test_operation_queue.py        # NEW: Queue management tests
│
├── integration/
│   ├── test_llm_streaming.py          # NEW: SSE streaming end-to-end
│   ├── test_concurrent_operations.py  # NEW: 10+ concurrent ops
│   ├── test_hierarchical_creation.py  # NEW: Parent-child creation
│   └── test_error_recovery.py         # NEW: Failure + retry scenarios
│
└── load/
    └── test_load_10_concurrent.py     # NEW: Performance benchmarks

Database (migrations):
└── migrations/
    └── 2025-11-21_add_llm_operations_table.sql  # NEW: PostgreSQL schema
```

**Frontend Structure:**
```text
frontend/src/
├── stores/
│   └── llmOperationsStore.ts          # NEW: Zustand store for concurrent ops
│
├── hooks/
│   ├── useStreamingContent.ts         # NEW: Hook for streaming content updates
│   ├── useLLMOperation.ts             # NEW: Hook for operation management
│   └── useEventSource.ts              # NEW: EventSource lifecycle management
│
├── components/
│   ├── Node.tsx                       # MODIFIED: add NodeState indicators
│   ├── StreamingNode.tsx              # NEW: Node with real-time content
│   ├── OperationStatus.tsx            # NEW: Queue position, progress
│   └── ErrorBoundary.tsx              # Existing error handling
│
└── features/
    └── llm/
        ├── utils/
        │   ├── eventSourceManager.ts  # NEW: EventSource pooling
        │   ├── contentBuffer.ts       # NEW: Client-side token buffering
        │   └── stateReconciliation.ts # NEW: SSE state sync
        │
        └── services/
            └── llmService.ts          # NEW: LLM operation API client

frontend/tests/
├── unit/
│   ├── llmOperationsStore.test.ts     # NEW: Zustand store tests
│   ├── contentBuffer.test.ts          # NEW: Token buffering
│   └── eventSourceManager.test.ts     # NEW: EventSource lifecycle
│
└── integration/
    ├── streaming.test.tsx             # NEW: React + SSE integration
    └── concurrentOps.test.tsx         # NEW: Multiple concurrent ops
```

**Structure Decision**: Option 2 (Web Application) selected. Backend Python (FastAPI, asyncio) handles concurrent LLM operations with PostgreSQL + Redis persistence. Frontend React/TypeScript manages UI state with Zustand store and real-time updates via SSE. Clear separation of concerns: backend handles concurrency control + streaming protocol, frontend handles visualization + state sync.

## Complexity Tracking

> **Note**: All architectural requirements satisfied. No constitutional violations requiring justification.

(No violations - all design choices align with project principles)

## Phase 0 Artifacts

**Status**: ✅ COMPLETE

- ✅ **research.md**: Comprehensive technical research (2000+ lines)
  - Task 1: SSE vs WebSocket decision (SSE selected for simplicity + HTTP/2)
  - Task 2: FastAPI concurrency with asyncio.create_task() + Semaphore
  - Task 3: React state management with Zustand + selective subscriptions
  - Task 4: LLM provider streaming APIs (OpenAI, Anthropic, Ollama)
  - Task 5: Concurrency limits (10 default) + FIFO queue + exponential backoff
  - Task 6: State persistence (PostgreSQL + Redis hybrid)
  - Task 7: Performance optimization (100ms debouncing, memoization, lazy rendering)
  - Implementation roadmap (5 phases over 5 weeks)

## Phase 1 Artifacts

**Status**: ✅ COMPLETE

- ✅ **data-model.md**: Entity definitions
  - NodeState (6 states: idle, processing, streaming, completed, failed, cancelled)
  - LLMOperation (queued, started_at, completed_at, content, error_message)
  - ConcurrencyManager (max_concurrent, active_operations, queued_operations)
  - HierarchyLock (prevent race conditions during node creation)
  - PostgreSQL schema with indexes, Redis key structure
  - State transition validation rules

- ✅ **contracts/api-llm-operations.yaml**: OpenAPI specification
  - POST /graphs/{graph_id}/llm-operations: Create operation
  - GET /graphs/{graph_id}/llm-operations/{operation_id}/stream: SSE streaming
  - GET /graphs/{graph_id}/llm-operations: List operations
  - DELETE /graphs/{graph_id}/llm-operations/{operation_id}: Cancel operation
  - GET /graphs/{graph_id}/llm-operations/{operation_id}/status: Get status
  - Request/response schemas with examples

- ✅ **quickstart.md**: Developer onboarding guide
  - Quick demo (sequential vs concurrent workflow)
  - Key components (LLMManager, OperationQueue, StreamingNode)
  - 5 implementation phases with deliverables
  - Testing checklist (unit, integration, load tests)
  - Common issues and solutions
  - Performance benchmarks and metrics

## Next Steps

**Action**: Run `/speckit.tasks` to generate task breakdown (`tasks.md`) with:
- Specific actionable tasks in dependency order
- Estimated complexity and effort
- Assigned owners (if applicable)
- Testing acceptance criteria
- Git commit message templates

**Acceptance Gate**: tasks.md must decompose all requirements into <4-hour implementation tasks, each with clear completion criteria and test coverage targets.

---

## Reference Information

**Key Metrics from Research**:
- Default concurrency: 10 operations (Anthropic rate-limited to 50 RPM ≈ 0.83 RPS)
- Token buffering: 100ms flush interval
- Memory per operation: ~5MB (50MB total for 10 concurrent)
- ReactFlow optimization: memoization + onlyRenderVisibleElements
- Error recovery: 5 exponential backoff retries, max 60s delay

**Critical Implementation Requirements**:
1. Parent-child relationships stored immediately (before LLM starts)
2. Each operation runs in separate asyncio task
3. State updates must be atomic (prevent race conditions)
4. SSE reconnection with Last-Event-ID for browser refresh recovery
5. Zustand selective subscriptions to prevent re-render storms

**Testing Coverage Target**: 80%+ code coverage
- 15+ new test files (unit + integration + load)
- Concurrent operation scenarios (simultaneous starts, failures, retries)
- State persistence (browser refresh, connection loss, server crash)
- Performance (10+ concurrent operations, <100ms UI response)

**Estimated Implementation Effort**: 5-6 weeks
- Phase 1: Foundation (SSE + LLM providers) - Week 1
- Phase 2: Concurrency control (queue, semaphore) - Week 2
- Phase 3: State management (Zustand, persistence) - Week 3
- Phase 4: Performance optimization (memoization, debouncing) - Week 4
- Phase 5: Polish (error handling, monitoring, docs) - Week 5
- Testing & integration: Weeks 4-6 (parallel with implementation)
