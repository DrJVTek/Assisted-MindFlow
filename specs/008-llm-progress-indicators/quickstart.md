# Quick Start Guide: Visual Progress Indicators and Animations for LLM Operations

**Feature**: 008-llm-progress-indicators
**Date**: 2025-11-21
**Target Audience**: Frontend developers implementing progress indicators for MindFlow canvas
**Estimated Reading Time**: 20-30 minutes

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Quick Demo: Before & After](#quick-demo-before--after)
3. [Core Concepts & Architecture](#core-concepts--architecture)
4. [Key Components](#key-components)
5. [5-Minute Walkthrough: Add Progress Indicator to Existing Node](#5-minute-walkthrough-add-progress-indicator-to-existing-node)
6. [Implementation Phases](#implementation-phases)
7. [API Integration Guide](#api-integration-guide)
8. [Testing Checklist](#testing-checklist)
9. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
10. [Performance Tips](#performance-tips)
11. [Accessibility Guidelines](#accessibility-guidelines)

---

## Feature Overview

**What**: Visual feedback system that shows users the progress and status of LLM operations on canvas nodes.

**Why**: Users need immediate, clear feedback on whether the system is working. Without indicators, users assume the system is frozen.

**Key Stats**:
- **100ms**: Indicator appears after operation starts
- **60fps**: All animations run at 60 frames per second
- **200ms**: Streaming content updates appear in UI
- **<500ms**: Dashboard aggregates updates in real-time

### Problem Statement

Before this feature:
```
User clicks "Ask LLM" on a node
→ Nothing happens visually
→ User waits, unsure if system is working
→ User clicks again (creating duplicate requests)
→ Frustration ensues
```

After this feature:
```
User clicks "Ask LLM" on a node
→ Spinner appears immediately (visual feedback)
→ As tokens arrive, content appears progressively
→ User reads partial response while LLM still working
→ Checkmark appears when complete
→ System feels fast and responsive
```

---

## Quick Demo: Before & After

### Before: Plain Node (No Indicators)

```
┌─────────────────────────────────┐
│                                 │
│  What is machine learning?      │
│                                 │
│  [Ask LLM]                      │
└─────────────────────────────────┘

User clicks [Ask LLM]...
(No visual feedback)
(User waits...)
(User checks browser console for errors)
(5 seconds later, content suddenly appears)
```

### After: Node with Progress Indicator

```
State: Idle (no operation)
┌─────────────────────────────────┐
│                                 │
│  What is machine learning?      │
│                                 │
│  [Ask LLM]                      │
└─────────────────────────────────┘

User clicks [Ask LLM]...

State: Processing (waiting for first token)
┌─────────────────────────────────┐
│ ⟳ Processing...                 │  ← Spinner indicator
│                                 │
│  What is machine learning?      │
│                                 │
└─────────────────────────────────┘

State: Streaming (receiving tokens)
┌─────────────────────────────────┐
│ → Streaming (47 words...)       │  ← Progress indicator
│                                 │
│  What is machine learning?      │
│  Machine learning is a subset   │  ← Content appearing
│  of artificial intelligence...  │     progressively
│                                 │
└─────────────────────────────────┘

State: Completed
┌─────────────────────────────────┐
│ ✓ Completed                     │  ← Checkmark
│                                 │
│  What is machine learning?      │
│  Machine learning is a subset   │
│  of artificial intelligence... │  ← Complete content
│                                 │
└─────────────────────────────────┘
```

---

## Core Concepts & Architecture

### State Machine

Every LLM operation follows this state flow:

```
IDLE → PROCESSING → STREAMING → COMPLETED
                ↓         ↓
              FAILED   PAUSED → STREAMING → COMPLETED
                ↓
              (show error, offer retry)

QUEUED (if concurrency limit) → PROCESSING
CANCELLED (user stops operation)
```

### Data Flow

```
┌──────────────────────────────────────────────────┐
│ User clicks "Ask LLM" on node                    │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │ Operation starts        │
         │ (Backend: LLM API call) │
         └────────────┬────────────┘
                      │
                      ▼
        ┌──────────────────────────────┐
        │ Event stream from backend    │
        │ - operation_initiated        │
        │ - token_received (batched)   │
        │ - final_token_received       │
        └────────────┬─────────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │ Zustand Store updates        │
        │ indicators[operation_id]     │
        │ aggregateStatus             │
        └────────────┬─────────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │ React components re-render   │
        │ - NodeIndicator             │
        │ - StreamingNode             │
        │ - AggregatePanel            │
        └────────────┬─────────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │ CSS animations + transitions │
        │ - Smooth state changes      │
        │ - 60fps performance         │
        └──────────────────────────────┘
```

### Key Data Structures

**ProgressIndicator** (tracks single operation):
```typescript
{
  operation_id: "op-123",
  node_id: "node-456",
  status: "streaming",
  progress_value: 47,
  progress_type: "word_count",
  animation_state: "flowing",
  started_at: "2025-11-21T10:30:45Z",
  updated_at: "2025-11-21T10:30:50Z"
}
```

**AggregateStatus** (dashboard view):
```typescript
{
  total_operations: 8,
  processing_count: 2,
  streaming_count: 4,
  completed_count: 2,
  failed_count: 0,
  operations: [
    { operation_id, node_title, status, progress_value, elapsed_time_seconds }
    // ... 8 operations
  ]
}
```

---

## Key Components

### 1. NodeIndicator

**Purpose**: Display progress indicator on a single node

**Shows**:
- Status icon (spinner, checkmark, X, etc.)
- Progress text ("47 words...", "5.2s elapsed")
- Error tooltip on failed
- Animated state transitions

**Location**: Top-right corner of node (customizable)

**Example Usage**:
```typescript
import { NodeIndicator } from '@/components/indicators/NodeIndicator';
import { useProgressStore } from '@/features/progress/store';

function MyNode({ nodeId, operationId }) {
  const indicator = useProgressStore(
    state => state.indicators[operationId]
  );

  if (!indicator) return null; // No operation

  return (
    <div className="node">
      <NodeIndicator
        operationId={operationId}
        indicator={indicator}
        position="top-right"
        onRetry={() => handleRetry(operationId)}
        onCancel={() => handleCancel(operationId)}
      />
      <div className="node-content">
        {/* node content */}
      </div>
    </div>
  );
}
```

### 2. StreamingNode

**Purpose**: Enhanced node display with progressive text appearance

**Shows**:
- Real-time content updates as tokens arrive
- Smooth node expansion animation
- Blinking cursor while streaming
- Progress indicator integrated

**Example Usage**:
```typescript
import { StreamingNode } from '@/components/StreamingNode';

function CanvasNode({ nodeId, isStreaming, indicator }) {
  const [content, setContent] = useState('');

  // Listen to store updates
  useEffect(() => {
    const unsub = useProgressStore.subscribe(
      state => state.indicators[indicator?.operation_id],
      (indicator) => {
        if (indicator?.status === 'streaming') {
          setContent(indicator.progress_value); // Update content
        }
      }
    );
    return unsub;
  }, [indicator?.operation_id]);

  return (
    <StreamingNode
      nodeId={nodeId}
      nodeType="question"
      nodeTitle="What is AI?"
      content={content}
      indicator={indicator}
      isStreaming={isStreaming}
      showStreamingCursor={true}
      showProgressIndicator={true}
    />
  );
}
```

### 3. AggregatePanel (Dashboard)

**Purpose**: Show all active operations at a glance

**Shows**:
- List of all operations with status
- Real-time updates
- Summary statistics
- Click to navigate to node
- Bulk actions (retry all, cancel all)

**Location**: Floating panel (bottom-right), sidebar, or top bar

**Example Usage**:
```typescript
import { AggregatePanel } from '@/components/indicators/AggregatePanel';
import { useProgressStore } from '@/features/progress/store';

function Dashboard() {
  const aggregateStatus = useProgressStore(state => state.aggregateStatus);
  const dashboardOpen = useProgressStore(state => state.dashboardOpen);

  return (
    <AggregatePanel
      status={aggregateStatus}
      isOpen={dashboardOpen}
      onToggle={() => useProgressStore.setState(state => ({
        dashboardOpen: !state.dashboardOpen
      }))}
      onOperationClick={(opId, nodeId) => {
        // Pan canvas to node
        navigateToNode(nodeId);
      }}
      onRetryAll={() => {
        // Retry all failed operations
        retryAllFailed();
      }}
    />
  );
}
```

### 4. useProgressIndicator Hook

**Purpose**: Subscribe to a single operation's progress

**Returns**: Current ProgressIndicator or undefined

**Example Usage**:
```typescript
import { useProgressIndicator } from '@/features/progress/hooks';

function MyComponent({ operationId }) {
  const indicator = useProgressIndicator(operationId, {
    onStatusChange: (status) => {
      console.log('Status changed to:', status);
    },
    onComplete: (finalIndicator) => {
      console.log('Operation complete:', finalIndicator);
      // Save response, create follow-up, etc.
    },
    onError: (error) => {
      console.error('Operation failed:', error);
      // Show error message to user
    }
  });

  if (!indicator) return null;

  return (
    <div>
      <p>Status: {indicator.status}</p>
      <p>Progress: {indicator.progress_value}</p>
    </div>
  );
}
```

### 5. useAggregateStatus Hook

**Purpose**: Subscribe to aggregate operations status

**Example Usage**:
```typescript
import { useAggregateStatus } from '@/features/progress/hooks';

function StatusBar() {
  const aggregateStatus = useAggregateStatus({
    onUpdate: (status) => {
      console.log(`${status.streaming_count} operations streaming`);
    }
  });

  return (
    <div className="status-bar">
      <span>Active: {aggregateStatus.processing_count + aggregateStatus.streaming_count}</span>
      <span>Completed: {aggregateStatus.completed_count}</span>
      <span>Failed: {aggregateStatus.failed_count}</span>
    </div>
  );
}
```

### 6. ProgressProvider (Context)

**Purpose**: Initialize store and provide to all child components

**Example Usage**:
```typescript
import { ProgressProvider } from '@/features/progress/context';

function App() {
  return (
    <ProgressProvider
      animationConfig={{
        animation_fps_target: 60,
        transition_duration_ms: 300,
      }}
      theme={customTheme}
    >
      <Canvas />
      <AggregatePanel />
    </ProgressProvider>
  );
}
```

---

## 5-Minute Walkthrough: Add Progress Indicator to Existing Node

### Step 1: Import Components and Hooks

```typescript
// MyNode.tsx
import { useProgressStore } from '@/features/progress/store';
import { useProgressIndicator } from '@/features/progress/hooks';
import { NodeIndicator } from '@/components/indicators/NodeIndicator';
```

### Step 2: Get Indicator from Store

```typescript
function MyNode({ nodeId, operationId }: MyNodeProps) {
  // Get current indicator for this operation
  const indicator = useProgressStore(
    state => state.indicators[operationId]
  );

  // If no operation running, don't show anything
  if (!indicator) {
    return <PlainNode nodeId={nodeId} />;
  }

  // ... render with indicator
}
```

### Step 3: Add NodeIndicator Component

```typescript
function MyNode({ nodeId, operationId }: MyNodeProps) {
  const indicator = useProgressStore(
    state => state.indicators[operationId]
  );

  return (
    <div className="node-wrapper">
      {/* Add indicator in top-right */}
      {indicator && (
        <NodeIndicator
          operationId={operationId}
          indicator={indicator}
          position="top-right"
          onRetry={() => handleRetry(operationId)}
          onCancel={() => handleCancel(operationId)}
        />
      )}

      <div className="node-content">
        {/* Your existing node content */}
      </div>
    </div>
  );
}
```

### Step 4: Handle Status Changes (Optional)

```typescript
import { useEffect } from 'react';

function MyNode({ nodeId, operationId }: MyNodeProps) {
  const indicator = useProgressStore(
    state => state.indicators[operationId]
  );

  // Handle completion
  useEffect(() => {
    if (indicator?.status === 'completed') {
      console.log('Operation complete!');
      // Auto-close node details, save response, etc.
    }
  }, [indicator?.status]);

  // Handle errors
  useEffect(() => {
    if (indicator?.status === 'failed') {
      console.error('Operation failed:', indicator.error_message);
      // Show error toast, enable retry button, etc.
    }
  }, [indicator?.status, indicator?.error_message]);

  return (
    <div className="node-wrapper">
      {indicator && (
        <NodeIndicator
          operationId={operationId}
          indicator={indicator}
          position="top-right"
          onRetry={() => handleRetry(operationId)}
          onCancel={() => handleCancel(operationId)}
        />
      )}
      <div className="node-content">{/* content */}</div>
    </div>
  );
}
```

### Step 5: Test in Browser

```
1. Open app in browser DevTools
2. Click "Ask LLM" on a node
3. Watch progress indicator appear
4. See content stream in real-time
5. Verify animations are smooth (60fps in Performance tab)
6. Check accessibility (keyboard navigation, screen reader)
```

**Result**: Your node now has professional progress indicators! 🎉

---

## Implementation Phases

### Phase 1: Basic State Indicators (Week 1)

**Goal**: Show visual states for all operations

**Deliverables**:
- NodeIndicator component (static indicators, no animations)
- ProgressIndicator data type
- Zustand store with basic state management
- Integration with existing LLM operations

**Key Implementation**:
```typescript
// contracts/store-interface.ts defines:
interface ProgressIndicator {
  operation_id: UUID;
  node_id: UUID;
  status: 'idle' | 'processing' | 'streaming' | 'completed' | 'failed' | 'queued';
  progress_value: number;
  progress_type: 'word_count' | 'percentage' | 'elapsed_time';
  // ... more fields
}
```

**Testing**:
- [ ] NodeIndicator displays for each status
- [ ] Status changes update display correctly
- [ ] No animations (CSS static only)
- [ ] Accessibility: ARIA live regions announce status changes

**Performance Target**: <100ms from backend status change to UI update

---

### Phase 2: Streaming Animations (Week 2)

**Goal**: Add smooth CSS animations and real-time streaming

**Deliverables**:
- CSS keyframe animations (spin, pulse, flow, bounce)
- AnimationConfig data type with accessibility support
- StreamingNode component with progressive text display
- Batched token updates (50-100ms intervals)

**Key Implementation**:
```css
/* Animations for each state */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

@keyframes flow {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

**Streaming Node Implementation**:
```typescript
// Real-time content updates with smooth animation
function StreamingNode({ content, isStreaming }) {
  return (
    <div className={isStreaming ? 'node-streaming' : 'node'}>
      <div className="node-content">
        {content}
        {isStreaming && <span className="cursor">▌</span>}
      </div>
    </div>
  );
}
```

**Testing**:
- [ ] Animations run at 60fps (verify DevTools Performance)
- [ ] Respect prefers-reduced-motion setting
- [ ] Token updates batched every 50-100ms
- [ ] 10 concurrent animated indicators, no lag

**Performance Target**: 60fps with 10+ concurrent animations

---

### Phase 3: Aggregate Dashboard (Week 3)

**Goal**: Show all operations at once in dashboard/panel

**Deliverables**:
- AggregatePanel component (floating/sidebar)
- AggregateStatus data type with summary statistics
- Real-time updates (<500ms latency)
- Click to navigate, bulk actions

**Key Implementation**:
```typescript
interface AggregateStatus {
  total_operations: number;
  processing_count: number;
  streaming_count: number;
  completed_count: number;
  failed_count: number;
  operations: OperationSummary[];
}
```

**Dashboard Features**:
```
┌─ Active Operations ─────────────────────┐
│ 8 total | 2 processing | 4 streaming     │
├─────────────────────────────────────────┤
│ ⟳ Define machine learning (3s)          │
│   → Explain AI concepts (47 words)      │
│   → Summarize history (12s)             │
│   ✓ What is deep learning? (Complete)  │
│   ✗ Error: Timeout on query 5          │
│   ⏱ Queued: Query 6 (Position 2 of 3)  │
├─────────────────────────────────────────┤
│ [Retry All Failed] [Cancel All]         │
└─────────────────────────────────────────┘
```

**Testing**:
- [ ] Dashboard lists all active operations
- [ ] Updates in <500ms when operations change
- [ ] Click operation → navigate to node
- [ ] Bulk actions (retry all, cancel all) work
- [ ] Virtual scrolling for 50+ operations
- [ ] Pagination works smoothly

**Performance Target**: <500ms update latency with 50+ operations

---

### Phase 4: Polish and Accessibility (Week 4)

**Goal**: Production-ready, accessible, performant

**Deliverables**:
- Visual theme system (light/dark, high contrast)
- Full accessibility support (ARIA, keyboard nav, screen reader)
- Performance monitoring (FPS tracking)
- Error handling and edge cases
- Documentation and testing

**Key Implementation**:
```typescript
// Respect accessibility preferences
const detectReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const detectHighContrast = () =>
  window.matchMedia('(prefers-contrast: more)').matches;
```

**Accessibility Checklist**:
- [ ] Screen reader announcements for status changes
- [ ] Keyboard navigation (Tab, Enter, Esc)
- [ ] High contrast mode support
- [ ] Reduced motion support (no animations)
- [ ] Focus indicators visible
- [ ] Color not only indicator of state

**Testing**:
- [ ] Screen reader testing (NVDA, JAWS, VoiceOver)
- [ ] Keyboard navigation (Tab, Tab+Shift, Enter)
- [ ] Color contrast (WCAG AA/AAA)
- [ ] Animations disabled with prefers-reduced-motion
- [ ] Performance profiling (CPU, memory, FPS)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

---

## API Integration Guide

### Receiving Progress Events from Backend

**WebSocket Connection** (Recommended):

```typescript
// useProgressWebSocket.ts
import { useEffect } from 'react';
import { useProgressStore } from './store';

export function useProgressWebSocket(url: string) {
  useEffect(() => {
    const ws = new WebSocket(url);

    ws.addEventListener('message', (event) => {
      const progressEvent = JSON.parse(event.data);
      handleProgressEvent(progressEvent);
    });

    return () => ws.close();
  }, []);
}

function handleProgressEvent(event: ProgressEvent) {
  const store = useProgressStore.getState();

  switch (event.type) {
    case 'operation_initiated':
      store.addIndicator({
        operation_id: event.operation_id,
        node_id: event.node_id,
        status: 'processing',
        progress_value: 0,
        progress_type: 'indeterminate',
        animation_state: 'spinning',
        started_at: event.timestamp,
        updated_at: event.timestamp,
        retry_count: 0,
        respects_reduced_motion: false,
      });
      break;

    case 'first_token_received':
      store.setStatus(event.operation_id, 'streaming');
      store.setAnimationState(event.operation_id, 'flowing');
      break;

    case 'token_received':
      store.setProgress(
        event.operation_id,
        event.word_count,
        'word_count'
      );
      break;

    case 'final_token_received':
      store.setStatus(event.operation_id, 'completed');
      store.setAnimationState(event.operation_id, 'static');
      store.updateIndicator(event.operation_id, {
        completed_at: event.timestamp,
      });
      break;

    case 'operation_failed':
      store.setStatus(event.operation_id, 'failed');
      store.updateIndicator(event.operation_id, {
        error_message: event.error_message,
        completed_at: event.timestamp,
      });
      break;
  }
}
```

### Event Format (from Backend)

See `contracts/progress-events.yaml` for complete specification.

**Example Events**:

```json
// Operation started
{
  "type": "operation_initiated",
  "operation_id": "op-123",
  "node_id": "node-456",
  "timestamp": "2025-11-21T10:30:45.123Z"
}

// Token batch received
{
  "type": "token_received",
  "operation_id": "op-123",
  "batch_content": "Machine learning is a",
  "word_count": 5,
  "token_count": 8,
  "elapsed_seconds": 0.25,
  "timestamp": "2025-11-21T10:30:50.150Z"
}

// Operation complete
{
  "type": "final_token_received",
  "operation_id": "op-123",
  "total_words": 127,
  "total_tokens": 156,
  "elapsed_seconds": 5.2,
  "timestamp": "2025-11-21T10:30:55.500Z"
}
```

### Fallback: REST API (if WebSocket unavailable)

```typescript
// Polling fallback for progress
async function pollProgress(operationId: UUID) {
  const response = await fetch(`/api/operations/${operationId}`);
  const indicator = await response.json();
  useProgressStore.getState().updateIndicator(operationId, indicator);
}

// Poll every 500ms
setInterval(() => {
  const activeOps = useProgressStore.getState().indicators;
  Object.keys(activeOps).forEach(opId => pollProgress(opId));
}, 500);
```

---

## Testing Checklist

### Unit Tests

```typescript
// tests/progress/store.test.ts
describe('ProgressStore', () => {
  it('should add indicator', () => {
    const store = useProgressStore.getState();
    store.addIndicator(mockIndicator);
    expect(store.indicators[mockIndicator.operation_id]).toBeDefined();
  });

  it('should update indicator status', () => {
    store.setStatus(operationId, 'streaming');
    const indicator = store.indicators[operationId];
    expect(indicator.status).toBe('streaming');
    expect(indicator.animation_state).toBe('flowing');
  });

  it('should batch update indicators', () => {
    store.batchUpdateIndicators([
      { id: op1, updates: { status: 'completed' } },
      { id: op2, updates: { status: 'completed' } },
    ]);
    expect(store.indicators[op1].status).toBe('completed');
    expect(store.indicators[op2].status).toBe('completed');
  });
});
```

### Component Tests

```typescript
// tests/components/NodeIndicator.test.tsx
describe('NodeIndicator', () => {
  it('should render spinner for processing status', () => {
    const indicator = { status: 'processing', animation_state: 'spinning' };
    render(<NodeIndicator operationId="op-1" indicator={indicator} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('should render checkmark for completed status', () => {
    const indicator = { status: 'completed', animation_state: 'static' };
    render(<NodeIndicator operationId="op-1" indicator={indicator} />);
    expect(screen.getByTestId('checkmark')).toBeInTheDocument();
  });

  it('should call onRetry when retry button clicked', () => {
    const onRetry = jest.fn();
    const indicator = { status: 'failed', error_message: 'Timeout' };
    render(
      <NodeIndicator
        operationId="op-1"
        indicator={indicator}
        onRetry={onRetry}
      />
    );
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('should respect prefers-reduced-motion', () => {
    matchMedia.useMediaQuery('(prefers-reduced-motion: reduce)', true);
    const indicator = { status: 'processing', animation_state: 'static' };
    render(<NodeIndicator operationId="op-1" indicator={indicator} />);
    // Should render, but without animation
    expect(screen.getByTestId('indicator')).toHaveClass('no-animation');
  });
});
```

### Integration Tests

```typescript
// tests/integration/progress-flow.test.tsx
describe('Full Progress Flow', () => {
  it('should handle complete operation lifecycle', async () => {
    // 1. User clicks "Ask LLM"
    const { getByText } = render(<Canvas />);
    fireEvent.click(getByText('Ask LLM'));

    // 2. Indicator appears immediately
    await waitFor(() => {
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    // 3. WebSocket sends token events
    simulateWebSocketMessage({
      type: 'token_received',
      word_count: 47,
    });

    // 4. Content appears progressively
    await waitFor(() => {
      expect(screen.getByText(/machine learning/i)).toBeInTheDocument();
    });

    // 5. Final token arrives
    simulateWebSocketMessage({
      type: 'final_token_received',
      total_words: 127,
    });

    // 6. Checkmark appears
    await waitFor(() => {
      expect(screen.getByTestId('checkmark')).toBeInTheDocument();
    });
  });
});
```

### Performance Tests

```typescript
// tests/performance/animations.test.ts
describe('Animation Performance', () => {
  it('should maintain 60fps with 10 concurrent indicators', () => {
    const fps = measureFPS(() => {
      // Create 10 indicators
      for (let i = 0; i < 10; i++) {
        store.addIndicator({
          ...mockIndicator,
          operation_id: `op-${i}`,
          animation_state: 'spinning',
        });
      }

      // Animate for 5 seconds
      requestAnimationFrame(() => {
        // Check frame rate
      });
    });

    expect(fps).toBeGreaterThanOrEqual(55); // Allow 5fps variance
  });

  it('should not exceed 100MB memory with 1000 completed operations', () => {
    const initialMemory = performance.memory.usedJSHeapSize;

    for (let i = 0; i < 1000; i++) {
      store.addIndicator({
        ...mockIndicator,
        operation_id: `op-${i}`,
        status: 'completed',
      });
    }

    const finalMemory = performance.memory.usedJSHeapSize;
    const increase = finalMemory - initialMemory;
    expect(increase).toBeLessThan(100 * 1024 * 1024); // 100MB
  });
});
```

### Accessibility Tests

```typescript
// tests/accessibility/indicators.test.tsx
describe('Accessibility', () => {
  it('should announce status changes to screen readers', async () => {
    const { getByRole } = render(
      <NodeIndicator operationId="op-1" indicator={mockIndicator} />
    );

    // Status announced via ARIA live region
    const liveRegion = getByRole('status');
    expect(liveRegion).toHaveTextContent('Processing...');
  });

  it('should be keyboard navigable', () => {
    render(
      <AggregatePanel
        status={mockAggregateStatus}
        onRetryAll={jest.fn()}
      />
    );

    // Tab to retry button
    userEvent.tab();
    expect(screen.getByText('Retry All')).toHaveFocus();

    // Press Enter to activate
    userEvent.keyboard('{Enter}');
    // Should trigger retry
  });

  it('should have sufficient color contrast', () => {
    const { container } = render(
      <NodeIndicator operationId="op-1" indicator={mockIndicator} />
    );

    const colorContrast = axe.run(container);
    expect(colorContrast.violations).toHaveLength(0);
  });
});
```

---

## Common Issues & Troubleshooting

### Issue 1: Indicator Not Appearing

**Symptom**: Click "Ask LLM" but no spinner appears

**Causes**:
1. Store not initialized
2. WebSocket connection failed
3. Component not subscribed to store changes
4. CSS display:none hiding indicator

**Solutions**:

```typescript
// Check 1: Is store initialized?
const store = useProgressStore.getState();
console.log('Store:', store.indicators);

// Check 2: Is indicator in store?
const indicator = store.indicators[operationId];
console.log('Indicator:', indicator);

// Check 3: Is component subscribed?
const indicator = useProgressStore(
  state => state.indicators[operationId],
  // Ensure shallow equality check
  (prev, next) => prev === next
);

// Check 4: Is CSS visible?
// DevTools → Inspect → Check computed styles
// Should NOT have display:none or visibility:hidden
```

### Issue 2: Animations Not Smooth (Jank)

**Symptom**: Spinner stutters, animations lag

**Causes**:
1. Main thread blocked (heavy computation)
2. Too many concurrent animations
3. Non-GPU-accelerated CSS
4. Large DOM updates

**Solutions**:

```typescript
// Use GPU-accelerated properties only
// ✓ GOOD: GPU-accelerated
transform: rotate(360deg); // Fast
opacity: 0.5; // Fast

// ✗ BAD: Non-GPU-accelerated
left: 100px; // Slow (reflow)
width: 200px; // Slow (reflow)
margin: 10px; // Slow (reflow)

// Monitor FPS
const fpsMonitor = setInterval(() => {
  const fps = Math.round(1000 / deltaTime);
  if (fps < 30) {
    console.warn('Low FPS:', fps);
    store.setAnimationConfig({
      max_concurrent_animations: 5, // Reduce
    });
  }
}, 1000);

// Batch DOM updates
store.batchUpdateIndicators([
  { id: op1, updates: { status: 'completed' } },
  { id: op2, updates: { status: 'completed' } },
  // ... instead of individual updates
]);
```

### Issue 3: Memory Leaks

**Symptom**: App slows down over time, memory keeps growing

**Causes**:
1. Completed operations never removed
2. Event listeners not cleaned up
3. Zustand subscriptions not unsubscribed

**Solutions**:

```typescript
// Clean up WebSocket listeners
useEffect(() => {
  const ws = new WebSocket('...');
  ws.addEventListener('message', handleMessage);

  return () => {
    ws.removeEventListener('message', handleMessage);
    ws.close();
  };
}, []);

// Unsubscribe from store
useEffect(() => {
  const unsub = useProgressStore.subscribe(
    state => state.indicators,
    (indicators) => {
      console.log('Indicators changed');
    }
  );

  return unsub; // IMPORTANT: cleanup
}, []);

// Archive old completed operations
useEffect(() => {
  const interval = setInterval(() => {
    const store = useProgressStore.getState();
    const now = Date.now();
    const completed = Object.entries(store.indicators)
      .filter(([_, indicator]) => {
        const completedAge = now - new Date(indicator.completed_at).getTime();
        return completedAge > 5 * 60 * 1000; // Older than 5 minutes
      })
      .map(([id]) => id);

    completed.forEach(id => store.removeIndicator(id));
  }, 60000); // Check every 60 seconds

  return () => clearInterval(interval);
}, []);
```

### Issue 4: Reduced Motion Not Respected

**Symptom**: Animations run even when user has accessibility setting enabled

**Causes**:
1. Config not checking prefers-reduced-motion on load
2. Component ignoring config setting
3. CSS animations running without `@media (prefers-reduced-motion)`

**Solutions**:

```typescript
// On app startup, check accessibility preferences
function initializeProgressStore() {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  useProgressStore.setState({
    animationConfig: {
      ...DEFAULT_ANIMATION_CONFIG,
      enable_animations: !prefersReducedMotion,
    },
  });

  // Listen for changes
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    useProgressStore.setState({
      animationConfig: {
        ...DEFAULT_ANIMATION_CONFIG,
        enable_animations: !e.matches,
      },
    });
  });
}

// In CSS, wrap animations
@media (prefers-reduced-motion: no-preference) {
  .indicator-spinning {
    animation: spin 1s linear infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .indicator-spinning {
    animation: none;
  }
}
```

### Issue 5: Dashboard Updates Lag

**Symptom**: Dashboard doesn't update in <500ms, feels sluggish

**Causes**:
1. All operations in one update (not batched)
2. Dashboard re-rendering entire list on each change
3. Virtual scrolling not implemented
4. WebSocket messages not batched

**Solutions**:

```typescript
// Batch backend updates
socket.on('progress_update', (events: ProgressEvent[]) => {
  // Batch 10-50 events together
  const updates = events.map(event => ({
    id: event.operation_id,
    updates: transformEvent(event),
  }));
  store.batchUpdateIndicators(updates);
});

// Use selectors for sub-components to prevent re-renders
function OperationListItem({ operationId }) {
  // Only re-render when THIS operation changes
  const operation = useProgressStore(
    state => state.aggregateStatus.operations.find(o => o.operation_id === operationId),
    // Equality function: only update if operation properties changed
    (prev, next) => prev === next
  );

  return <div>{operation.status}</div>;
}

// Virtual scrolling for 50+ items
import { FixedSizeList } from 'react-window';

function AggregatePanel({ status }) {
  return (
    <FixedSizeList
      height={500}
      itemCount={status.operations.length}
      itemSize={50}
      width="100%"
    >
      {({ index, style }) => (
        <OperationListItem
          operation={status.operations[index]}
          style={style}
        />
      )}
    </FixedSizeList>
  );
}
```

---

## Performance Tips

### 1. Selector Memoization

```typescript
// ✓ GOOD: Selector memoized, prevents unnecessary re-renders
const indicator = useProgressStore(
  state => state.indicators[operationId],
  (prev, next) => prev === next
);

// ✗ BAD: New object created every render, causes re-render
const indicator = useProgressStore(state => ({
  status: state.indicators[operationId]?.status,
}));
```

### 2. Batch Updates During Streaming

```typescript
// ✓ GOOD: Batch 50 tokens, update once
const tokens: string[] = [];
const timer = setInterval(() => {
  if (tokens.length > 0) {
    const wordCount = calculateWordCount(tokens.join(''));
    store.batchUpdateIndicators([{
      id: operationId,
      updates: { progress_value: wordCount }
    }]);
    tokens.length = 0;
  }
}, 50); // 50ms batch interval

// ✗ BAD: Update for every single token
socket.on('token', (token) => {
  store.updateIndicator(operationId, {
    progress_value: currentWordCount + 1
  }); // 100+ updates/sec → jank
});
```

### 3. Off-Screen Optimization

```typescript
// Don't render animations for nodes off-screen
function NodeIndicator({ visible = true, indicator }) {
  if (!visible) {
    // Still update state, but don't render animation
    return null;
  }

  return (
    <div className={`indicator ${indicator.animation_state}`}>
      {/* Only rendered when visible */}
    </div>
  );
}

// Track visibility with Intersection Observer
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    setNodeVisible(entry.target.id, entry.isIntersecting);
  });
});
nodeElements.forEach(el => observer.observe(el));
```

### 4. CSS Over JavaScript

```typescript
// ✓ GOOD: Pure CSS animation (GPU-accelerated)
// indicator.css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.indicator-spinning {
  animation: spin 1s linear infinite;
}

// ✗ BAD: JavaScript animation (CPU-bound)
useEffect(() => {
  let angle = 0;
  const interval = setInterval(() => {
    angle = (angle + 6) % 360;
    elementRef.current.style.transform = `rotate(${angle}deg)`;
  }, 16);
  return () => clearInterval(interval);
}, []);
```

### 5. Selective Store Subscriptions

```typescript
// ✓ GOOD: Only subscribe to data you need
const streamingCount = useProgressStore(state =>
  Object.values(state.indicators).filter(i => i.status === 'streaming').length
);

// ✗ BAD: Subscribe to entire aggregate status
const fullStatus = useProgressStore(state => state.aggregateStatus);
// Updates when ANY operation changes, even if not streaming
```

---

## Accessibility Guidelines

### Screen Reader Support

```typescript
// Announce status changes
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {indicator.status === 'processing' && 'Processing your request...'}
  {indicator.status === 'streaming' && `Streaming response, ${indicator.progress_value} words received`}
  {indicator.status === 'completed' && 'Response complete'}
  {indicator.status === 'failed' && `Error: ${indicator.error_message}`}
</div>

// Label indicators
<div
  className="indicator"
  aria-label={`Operation status: ${indicator.status}`}
>
  {/* indicator content */}
</div>
```

### Keyboard Navigation

```typescript
// Focusable elements should be in tab order
<button
  onClick={() => handleRetry(operationId)}
  className="retry-button"
  aria-label="Retry operation"
  // Automatically in tab order
>
  Retry
</button>

// Focus ring visible
.retry-button:focus {
  outline: 2px solid #2196F3;
  outline-offset: 2px;
}
```

### Color Contrast

```css
/* WCAG AA: 4.5:1 contrast for text */
.indicator {
  color: #1565C0;           /* Blue text */
  background: #E3F2FD;      /* Light blue background */
  /* Contrast: 8.2:1 ✓ */
}

.indicator-failed {
  color: #C62828;           /* Dark red text */
  background: #FFEBEE;      /* Light red background */
  /* Contrast: 7.1:1 ✓ */
}
```

### Reduced Motion Support

```css
/* Only animate if user hasn't disabled motion */
@media (prefers-reduced-motion: no-preference) {
  .indicator-streaming {
    animation: flow 1.5s ease-in-out infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  /* Static indicator, no animation */
  .indicator-streaming {
    animation: none;
  }
}
```

### ARIA Labels and Descriptions

```typescript
<div
  className="indicator"
  role="img"
  aria-label="Processing"
  title="LLM is processing your request"
>
  <svg className="spinner">...</svg>
</div>

<div
  className="progress-bar"
  role="progressbar"
  aria-label="Response progress"
  aria-valuenow={47}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuetext="47 words received"
>
  {/* progress bar */}
</div>
```

---

## Next Steps

1. **Read Full Documentation**:
   - `spec.md` - Complete feature specification
   - `data-model.md` - Data structure definitions
   - `contracts/` - API contracts and interfaces

2. **Review Example Components**:
   - Check existing UI library for patterns
   - Look at animation examples in other features
   - Study Zustand store patterns in codebase

3. **Start with Phase 1**:
   - Implement basic state indicators (no animations)
   - Write unit tests
   - Get PR review before moving to Phase 2

4. **Incrementally Add Features**:
   - Phase 2: Smooth CSS animations
   - Phase 3: Aggregate dashboard
   - Phase 4: Polish and accessibility

5. **Test Early and Often**:
   - Run tests before each commit
   - Manual testing in browser
   - Performance profiling (DevTools)
   - Accessibility testing (screen reader, keyboard)

---

## Resources

- **TypeScript Contracts**: `contracts/store-interface.ts`
- **Component Props**: `contracts/component-props.ts`
- **Event Specification**: `contracts/progress-events.yaml`
- **Data Model**: `data-model.md`
- **Full Spec**: `spec.md`

---

## Summary

This feature transforms LLM operations from invisible (user: "Is it working?") to transparent (user: "I can see the progress!").

**Key Achievements**:
- ✓ Visual feedback within 100ms
- ✓ 60fps smooth animations
- ✓ Real-time streaming progress
- ✓ Aggregate dashboard for situational awareness
- ✓ Full accessibility support
- ✓ Production-ready performance

**Timeline**: 4 weeks (1 week per phase)

**Team**: 1-2 frontend developers

**Impact**: Dramatically improves perceived performance and user confidence.

Good luck! 🚀
