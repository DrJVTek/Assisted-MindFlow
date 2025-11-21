# Feature Specification: Concurrent LLM Operations with Hierarchical Node Creation

**Feature Branch**: `007-concurrent-llm-hierarchy`
**Created**: 2025-11-21
**Status**: Draft
**Input**: User description: "il faut valider qu'il soit possible de crée de nouveau nodes en hiearchie sur des nodes déja fini et lancer des LLM en même temps que le LLM répond sur un node ce qui permet d'aller plus vite sur de l'annalyse 'multi-dimenssionnel' en fait c'est ca qui change tout au niveau UX dans ce system"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Child Nodes on Completed Nodes (Priority: P0 - Critical MVP)

Users need to continue their reasoning by creating new child nodes from completed parent nodes, even when the parent node is in a "finished" state. This enables branching thought processes and exploring multiple hypotheses from a single conclusion.

**Why this priority**: **Core UX paradigm** - Without this, users are blocked from multi-branch reasoning. This is foundational to the entire MindFlow concept of non-linear thinking.

**Independent Test**: User views a completed answer node → clicks "Add Child" → creates new question node below it → verifies parent remains completed and new child node is created with correct parent-child relationship → repeats to create multiple children from same parent.

**Acceptance Scenarios**:

1. **Given** user has a completed answer node with no children, **When** they right-click and select "Add Child Node", **Then** a new node creation dialog appears with parent relationship pre-set
2. **Given** user creates a child node below a completed parent, **When** the child node is created, **Then** the parent node remains in "completed" state (not reopened or modified)
3. **Given** user has a completed evaluation node, **When** they create two child hypothesis nodes, **Then** both children are created with correct parent-child relationships and displayed in the canvas
4. **Given** user creates a child node from a completed node, **When** they view the graph, **Then** the edge connecting parent to child is visible and correctly oriented (parent → child)
5. **Given** completed node has metadata (author, timestamp, tags), **When** user creates child, **Then** child node inherits context but not content from parent
6. **Given** user attempts to create child from a node currently being processed by LLM, **When** they click "Add Child", **Then** system allows creation (does not block) and queues child for creation

---

### User Story 2 - Launch Multiple LLM Operations Concurrently (Priority: P0 - Critical MVP)

Users need to launch LLM reasoning on multiple nodes simultaneously without waiting for each LLM response to complete. This enables parallel multi-dimensional analysis where different reasoning paths are explored concurrently.

**Why this priority**: **Critical UX differentiator** - This transforms MindFlow from a sequential chat into a parallel reasoning system. Without this, users lose the core "multi-dimensional analysis" benefit.

**Independent Test**: User creates 3 question nodes → selects all 3 → clicks "Ask LLM" → observes all 3 LLM requests starting simultaneously → while LLMs are responding (streaming), user creates 2 more question nodes and launches LLMs on them → verifies 5 LLM responses are streaming concurrently without blocking each other.

**Acceptance Scenarios**:

1. **Given** user has 3 question nodes, **When** they multi-select and click "Ask LLM", **Then** all 3 LLM requests are initiated simultaneously (not sequentially)
2. **Given** 2 LLM responses are currently streaming, **When** user creates a new question and clicks "Ask LLM", **Then** the new LLM request starts without waiting for the others to complete
3. **Given** 5 LLM operations are running concurrently, **When** user views the canvas, **Then** all 5 nodes show streaming indicators (e.g., animated spinner, partial content appearing)
4. **Given** LLM A completes before LLM B, **When** LLM A finishes, **Then** LLM B continues streaming without interruption or delay
5. **Given** user has 10 concurrent LLM operations, **When** one LLM fails (timeout, error), **Then** other 9 LLMs continue processing and only the failed node shows error state
6. **Given** concurrent LLMs are responding, **When** user creates child nodes below responding nodes, **Then** child node creation does not interrupt or cancel parent LLM operations

---

### User Story 3 - Multi-Dimensional Analysis Workflow (Priority: P1 - Core Value)

Users need to perform multi-dimensional analysis by creating hierarchical reasoning trees while LLMs process different branches concurrently. This enables exploring multiple perspectives, hypotheses, or evaluation criteria simultaneously.

**Why this priority**: Delivers the core UX promise of MindFlow - parallel exploration of complex reasoning spaces. This is what differentiates MindFlow from linear chat interfaces.

**Independent Test**: User creates root question "What is the best database for our app?" → launches LLM → while LLM responds, user creates 3 child nodes "Performance analysis", "Cost analysis", "Scalability analysis" → launches LLMs on all 3 → while those 3 LLMs respond, user creates grandchildren nodes under each (e.g., "PostgreSQL perf", "MySQL perf") → launches more LLMs → verifies entire tree is being processed with 7+ concurrent LLM operations.

**Acceptance Scenarios**:

1. **Given** user starts with 1 root question, **When** they create multi-level hierarchy with 10 nodes and launch LLMs on all, **Then** system supports 10 concurrent LLM operations without degradation
2. **Given** user is performing multi-dimensional analysis, **When** they create nodes at different tree levels (root, level 1, level 2), **Then** hierarchy relationships are preserved and visualized correctly
3. **Given** 7 LLM operations are running across 3 tree levels, **When** user navigates canvas, **Then** UI remains responsive (<100ms interactions) and doesn't freeze
4. **Given** user has 5 parallel reasoning branches, **When** 3 branches complete and 2 are still processing, **Then** user can start new branches from completed nodes without waiting
5. **Given** multi-dimensional analysis has 15 nodes, **When** user exports the graph, **Then** all concurrent LLM states (completed, processing, failed) are captured correctly
6. **Given** user launches 20 concurrent LLMs, **When** system reaches resource limits, **Then** system queues excess requests (e.g., max 10 concurrent) and provides clear feedback on queue status

---

### User Story 4 - Real-Time State Management and Visualization (Priority: P1 - Essential UX)

Users need clear visual feedback on the state of each node (idle, processing, streaming, completed, failed) across the entire graph while concurrent LLM operations are running. This prevents confusion about which nodes are active and enables users to make informed decisions about where to expand the reasoning tree.

**Why this priority**: Without clear state visualization, users will be lost in complex multi-dimensional analysis with 10+ concurrent operations. This is essential for usability.

**Independent Test**: User launches 8 concurrent LLM operations → observes each node shows distinct visual state (animated spinner for streaming, progress bar, partial content) → clicks on streaming node to view real-time content → creates child node below streaming parent → verifies parent continues streaming while child is created → one LLM fails due to timeout → verifies failed node shows error state with retry option.

**Acceptance Scenarios**:

1. **Given** node is processing LLM request, **When** user views node, **Then** node displays "processing" state with animated indicator (spinner, pulsing border)
2. **Given** LLM is streaming response, **When** content arrives, **Then** node updates in real-time with partial content visible (not waiting for full response)
3. **Given** 10 nodes are in various states (3 processing, 4 completed, 2 streaming, 1 failed), **When** user views canvas, **Then** each node shows distinct visual state and user can identify state at a glance
4. **Given** LLM operation fails, **When** failure occurs, **Then** node shows error state with clear error message and "Retry" button
5. **Given** user creates child node below streaming parent, **When** child is created, **Then** parent streaming indicator remains active and child shows "idle" state
6. **Given** 5 LLM operations complete, **When** user reviews completed nodes, **Then** completed nodes show checkmark/completion indicator and timestamp

---

### Edge Cases

- **What happens when user creates circular dependency (node A → child B → child A)?**
  - System should detect cycle during node creation and prevent it, showing error message "Circular dependency detected: Cannot create node that would form a cycle"

- **How does system handle 50+ concurrent LLM requests?**
  - System should implement queue with configurable concurrency limit (default: 10 concurrent). Requests beyond limit are queued and processed as slots become available. UI shows queue position.

- **What happens if user deletes a node while its child nodes have active LLM operations?**
  - System should prompt user with warning "This node has N children with active LLM operations. Delete anyway?" If confirmed, cancel all child LLM operations gracefully.

- **How does system handle browser refresh/tab close during concurrent LLM operations?**
  - System should persist LLM operation state to backend. On page reload, resume streaming for incomplete operations or show "Interrupted" state with resume option.

- **What happens when LLM provider rate limit is hit during concurrent operations?**
  - System should handle 429 errors gracefully, automatically retry with exponential backoff, and show user clear message: "Provider rate limit reached. Retrying in X seconds..."

- **How does system handle node creation below a node that's being deleted?**
  - System should lock nodes during deletion. If user attempts to create child, show message: "Cannot create child: parent node is being deleted"

- **What happens when two concurrent LLM responses complete at the exact same millisecond?**
  - System uses event queue to serialize state updates, ensuring each node update is atomic and no race conditions occur.

## Requirements *(mandatory)*

### Functional Requirements

#### Hierarchical Node Creation

- **FR-001**: System MUST allow users to create child nodes below any completed node, regardless of the parent node's "finished" state
- **FR-002**: System MUST allow users to create child nodes below nodes that are currently processing LLM requests (non-blocking)
- **FR-003**: System MUST preserve parent-child relationships in graph data structure when creating children from completed nodes
- **FR-004**: System MUST update canvas visualization immediately when new child nodes are created (no refresh required)
- **FR-005**: Creating a child node MUST NOT modify or reopen the parent node's state or content
- **FR-006**: System MUST support creating multiple children from a single parent node (1-to-many relationship)
- **FR-007**: System MUST prevent creation of circular dependencies (node A → child B → child A) and display clear error message

#### Concurrent LLM Operations

- **FR-008**: System MUST support launching multiple LLM requests simultaneously (at least 10 concurrent operations)
- **FR-009**: System MUST process LLM requests in parallel, not sequentially (true concurrency)
- **FR-010**: Starting a new LLM request MUST NOT block or delay other in-progress LLM operations
- **FR-011**: System MUST stream LLM responses in real-time for all concurrent operations (no waiting for full response)
- **FR-012**: Completion of one LLM operation MUST NOT interrupt or delay other concurrent operations
- **FR-013**: System MUST handle LLM failures (timeout, error, rate limit) for individual nodes without affecting other concurrent operations
- **FR-014**: System MUST implement concurrency limit (default 10) and queue excess requests with clear UI feedback on queue status

#### Multi-Dimensional Analysis

- **FR-015**: System MUST support hierarchical node creation across multiple tree levels while LLMs process nodes at different levels
- **FR-016**: System MUST maintain correct parent-child relationships when nodes are created during concurrent LLM operations
- **FR-017**: System MUST allow users to create new branches from completed nodes while sibling branches are still processing
- **FR-018**: System MUST support at least 20 nodes in a reasoning tree with 10+ concurrent LLM operations active simultaneously
- **FR-019**: System MUST preserve hierarchy and relationships when exporting graphs with concurrent LLM operations in progress

#### State Management

- **FR-020**: System MUST track state for each node individually: idle, processing, streaming, completed, failed, cancelled
- **FR-021**: System MUST update node state in real-time as LLM operations progress (no polling, use WebSocket or SSE)
- **FR-022**: System MUST persist LLM operation state to backend to survive browser refresh or tab close
- **FR-023**: System MUST handle state transitions atomically to prevent race conditions when multiple LLM operations complete simultaneously
- **FR-024**: System MUST maintain consistent state across frontend and backend (state sync)

#### UI Visualization

- **FR-025**: System MUST display distinct visual indicators for each node state (idle, processing, streaming, completed, failed)
- **FR-026**: Streaming nodes MUST show real-time content updates as LLM response arrives (progressive rendering)
- **FR-027**: System MUST show progress indicators (spinner, pulsing border) for nodes with active LLM operations
- **FR-028**: Failed nodes MUST display error message and "Retry" button
- **FR-029**: System MUST display queue status when concurrency limit is reached (e.g., "3 requests queued")
- **FR-030**: System MUST remain responsive (<100ms UI interactions) during 10+ concurrent LLM operations

#### Error Handling & Recovery

- **FR-031**: System MUST handle LLM provider rate limits (HTTP 429) with automatic exponential backoff retry
- **FR-032**: System MUST handle LLM timeouts by marking node as failed and allowing user to retry
- **FR-033**: System MUST handle network disconnection by pausing operations and resuming when connection is restored
- **FR-034**: Deleting a node with active child LLM operations MUST prompt user for confirmation and cancel child operations if confirmed
- **FR-035**: System MUST log all concurrent LLM operations for debugging (timestamps, durations, errors)

#### Performance & Scalability

- **FR-036**: System MUST complete node creation in <500ms even when 10 LLMs are processing concurrently
- **FR-037**: System MUST handle 10 concurrent LLM streaming responses without UI lag or dropped frames (<60fps canvas rendering)
- **FR-038**: System MUST use WebSocket or Server-Sent Events (SSE) for real-time streaming (not HTTP polling)
- **FR-039**: System MUST optimize memory usage to support 20+ nodes with active LLM operations (no memory leaks)

### Key Entities

- **NodeState**: Represents the current state of a node
  - node_id (unique identifier)
  - state (enum: idle, processing, streaming, completed, failed, cancelled)
  - llm_operation_id (optional, if LLM operation active)
  - progress (0.0 to 1.0, for streaming progress)
  - error_message (optional, if state is failed)
  - created_at, updated_at

- **LLMOperation**: Represents a concurrent LLM request
  - operation_id (unique identifier)
  - node_id (which node is being processed)
  - provider (OpenAI, Claude, Ollama, etc.)
  - model (gpt-4, claude-3, llama3, etc.)
  - status (enum: queued, processing, streaming, completed, failed, cancelled)
  - started_at, completed_at
  - tokens_used, cost
  - queue_position (if queued)

- **ConcurrencyManager**: Manages concurrent LLM operation limits
  - max_concurrent (default 10)
  - active_operations (list of current operation IDs)
  - queued_operations (priority queue of pending operations)
  - operation_states (map of operation_id → LLMOperation)

- **HierarchyLock**: Prevents race conditions during hierarchy modifications
  - node_id
  - lock_type (enum: creating_child, deleting, updating)
  - locked_at, locked_by (user/system)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create child nodes from completed parents in <3 clicks (right-click → "Add Child" → create)
- **SC-002**: System successfully processes 10 concurrent LLM operations without failures or performance degradation
- **SC-003**: Node creation completes in <500ms even when 10 LLMs are streaming concurrently
- **SC-004**: UI remains responsive (<100ms interactions) during 10+ concurrent LLM operations
- **SC-005**: 95% of LLM operations complete successfully without race conditions or state inconsistencies
- **SC-006**: Users can perform multi-dimensional analysis with 3 levels of hierarchy and 15 nodes with 10 concurrent LLMs
- **SC-007**: Real-time streaming updates appear in UI within <200ms of backend receiving token from LLM
- **SC-008**: Failed LLM operations are retried successfully 90% of the time with exponential backoff
- **SC-009**: System recovers gracefully from browser refresh with 100% of concurrent LLM operation state preserved
- **SC-010**: Users can identify node states at a glance with 95% accuracy (visual indicators are clear and distinct)

### Qualitative Outcomes

- Users feel empowered to explore multiple reasoning paths simultaneously without waiting
- The system feels responsive and never "stuck" during concurrent operations
- Multi-dimensional analysis feels intuitive and natural, not confusing or overwhelming
- Users trust that concurrent operations won't interfere with each other
- The UX feels fundamentally different from linear chat interfaces (transformative)

## Assumptions *(optional)*

- Users have stable internet connection for concurrent LLM operations (minimum 5 Mbps recommended)
- LLM providers support concurrent API requests from same account (most do)
- Most users will run 3-5 concurrent LLMs, with power users running 10-15
- Backend has sufficient resources to manage 10+ concurrent SSE/WebSocket connections per user
- Browser supports WebSocket or Server-Sent Events (all modern browsers do)
- Users understand the concept of parallel reasoning and won't be confused by multiple active operations
- Graph visualization library (ReactFlow) can handle real-time updates for 20+ nodes without performance issues

## Dependencies *(optional)*

- **External Dependencies**:
  - WebSocket or Server-Sent Events (SSE) support in frontend/backend
  - LLM provider APIs supporting streaming responses (OpenAI, Anthropic, Ollama)
  - ReactFlow library for dynamic graph updates
  - Backend async framework (FastAPI with asyncio) for concurrent request handling

- **Internal Dependencies**:
  - Existing LLMManager for provider abstraction
  - Graph data structure with parent-child relationship tracking
  - Node state management system (Zustand store on frontend)
  - Canvas rendering system (ReactFlow) capable of real-time updates
  - Backend concurrency control (asyncio semaphores, queues)

## Out of Scope *(optional)*

- Cross-user concurrent operations (multi-user collaboration in same graph)
- Distributed LLM processing across multiple backend servers (single-server concurrency only)
- Advanced queue prioritization (FIFO queue is sufficient, no priority levels)
- LLM operation cancellation by user (only system cancellation on delete)
- Undo/redo for concurrent operations (too complex for MVP)
- Real-time collaborative editing (single-user focus for now)
- LLM response caching/deduplication (always fresh requests)
- Automatic retry limits configuration (hardcoded to 3 retries is sufficient)

## Notes *(optional)*

### Technical Context

**This is the core UX differentiator for MindFlow**. Without concurrent LLM operations and hierarchical node creation on completed nodes, MindFlow is just another chat interface. This feature transforms the system into a true multi-dimensional reasoning tool.

**Architecture Considerations**:
- Backend: Use FastAPI with `asyncio` for true concurrent request handling
- Frontend: Use Server-Sent Events (SSE) for LLM streaming (simpler than WebSocket, one-way communication sufficient)
- State management: Use Zustand with subscriptions for real-time node state updates
- Concurrency control: Use `asyncio.Semaphore` on backend to limit concurrent LLM requests (default 10)

**Critical Implementation Details**:
1. **Parent-child relationship persistence**: Must be stored immediately, not queued
2. **LLM operation independence**: Each operation must run in its own asyncio task
3. **State atomicity**: Use locks to prevent race conditions when updating node states
4. **Streaming buffer**: Buffer LLM tokens and flush to frontend every 50ms (balance between real-time feel and network overhead)

### UX Considerations

- **Visual clarity is critical**: Users must instantly understand which nodes are active, completed, or failed
- **Progressive disclosure**: Don't overwhelm users with technical details (queue positions, retry counts) unless operations are delayed
- **Optimistic UI**: Create nodes immediately in frontend, sync to backend asynchronously
- **Error recovery should be automatic**: Retry 429 errors automatically, only prompt user if all retries fail

### Performance Targets

| Operation | Target | Rationale |
|-----------|--------|-----------|
| Node creation | <500ms | Even with 10 concurrent LLMs |
| LLM streaming latency | <200ms | From backend token receive to UI update |
| UI responsiveness | <100ms | All interactions (click, scroll, drag) |
| Concurrent LLM limit | 10 default | Balance between parallelism and resource usage |
| Queue processing | <1s | Time to start queued operation when slot opens |

### Future Enhancements (Not in Initial Scope)

- Auto-generate child hypotheses when parent completes (AI-suggested branches)
- Collaborative multi-user concurrent operations
- Advanced queue prioritization (user-defined priority)
- LLM operation cancellation by user (stop button)
- Distributed backend processing for 50+ concurrent operations
- Smart retry with fallback providers (if OpenAI fails, try Claude)
- Cost tracking and budgets for concurrent operations
