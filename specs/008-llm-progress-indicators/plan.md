# Implementation Plan: Visual Progress Indicators and Animations for LLM Operations

**Branch**: `008-llm-progress-indicators` | **Date**: 2025-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-llm-progress-indicators/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

MindFlow users need visual feedback on LLM operation progress to understand system state during concurrent multi-dimensional analysis. This feature adds animated progress indicators (spinners, pulsing borders, progress bars) to nodes in all states (idle, processing, streaming, completed, failed, queued), real-time streaming content visualization, and an aggregate dashboard showing all active operations. Users gain confidence the system is working, can read partial responses while streaming, and track 10+ concurrent operations without confusion.

**Technical Approach**: Plain CSS animations with GPU acceleration (60fps, minimal bundle size) + React Transition Group for mount/unmount transitions. Zustand store with selective subscriptions for state management (prevents re-render storms with 10+ animated nodes). Token batching (50-100ms) to maintain UI performance during streaming. WebSocket/SSE event integration with Feature 007 backend. Accessibility-first design with `prefers-reduced-motion` support and ARIA live regions for screen readers.

## Technical Context

**Language/Version**: TypeScript 5.9.3, React 19.2.0

**Primary Dependencies**:
- Frontend: React 19.2.0, Zustand 5.0.8, ReactFlow 11.11.4, react-transition-group 4.4.5, Lucide React (icons)
- Testing: Vitest, @testing-library/react, @testing-library/user-event

**Storage**: Zustand store (in-memory frontend state), ephemeral (no persistence needed for progress indicators)

**Testing**: Vitest (unit tests), @testing-library/react (component tests), Chrome DevTools Performance (60fps validation)

**Target Platform**: Web (modern browsers: Chrome 90+, Firefox 88+, Safari 14+)

**Project Type**: web (frontend-focused feature, minimal backend changes)

**Performance Goals**:
- Indicator appearance: <100ms from state change
- Animation frame rate: 60fps (16ms/frame) with 10+ concurrent indicators
- State transition duration: 200-500ms (smooth but not slow)
- Streaming UI update latency: <200ms from backend token to UI render
- Dashboard update latency: <500ms from operation state change
- UI responsiveness: <100ms for all interactions (click, hover, scroll)

**Constraints**:
- Must support `prefers-reduced-motion` accessibility setting (static indicators when motion disabled)
- Animation performance must not degrade with 10+ concurrent operations
- Bundle size impact: <10KB (prefer plain CSS over heavy animation libraries)
- No JavaScript-driven animations (use CSS for GPU acceleration)
- Must work with existing ReactFlow canvas without modification

**Scale/Scope**:
- 10+ concurrent animated indicators (typical power user scenario)
- 50+ operations in aggregate dashboard (edge case, requires virtual scrolling)
- 7 distinct node states (idle, queued, processing, streaming, completed, failed, cancelled)
- 5 core components (NodeIndicator, StreamingNode, AggregatePanel, ProgressBar, StatusBadge)
- 11 event types for WebSocket/SSE integration
- 4 implementation phases over 4 weeks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**I. Graph Integrity** ✅ PASS
- Progress indicators are ephemeral UI state only (no graph modifications)
- No changes to node data or relationships
- Visual feedback only, no persistence required

**II. LLM Provider Agnostic** ✅ PASS
- Progress indicators work with all LLM providers (OpenAI, Anthropic, Ollama)
- Depends on Feature 007's provider-agnostic streaming interface
- No provider-specific code in progress visualization

**III. Explicit Operations, No Magic** ✅ PASS
- All state changes triggered by explicit user actions (clicking "Ask LLM")
- State transitions visible through indicators (queued → processing → streaming → completed)
- No automatic or hidden operations

**IV. Test-First for Graph Operations** ✅ PASS
- Comprehensive testing checklist (100+ test cases)
- Unit tests for state transitions, animations, and store
- Component tests with @testing-library/react
- Performance tests for 60fps validation
- Accessibility tests for reduced motion and screen readers

**V. Context Transparency** ✅ PASS
- Progress indicators provide transparency about LLM processing state
- Error messages displayed clearly on failure
- Queue position visible when operations are queued

**VI. Multiplatform Support** ✅ PASS
- Web-based (runs on Windows/Linux/Mac via browser)
- No platform-specific code
- CSS animations work on all modern browsers

**VII. No Simulation or Hardcoded Data** ✅ PASS
- Real state updates from Feature 007 WebSocket/SSE events
- No mock data or placeholder implementations
- AnimationConfig allows configuration without hardcoded values

**VIII. Data Persistence** ✅ PASS
- Progress indicators are ephemeral (no persistence needed)
- State syncs from backend on page reload via Feature 007 recovery

**IX. Security/Privacy** ✅ PASS
- No security implications (UI-only feature)
- No data transmission (displays existing operation state)

**X. Performance** ✅ PASS
- <100ms indicator appearance (immediate feedback)
- 60fps animations (smooth, professional)
- <200ms streaming latency (real-time feel)
- <500ms dashboard updates (responsive aggregate view)

**XI. Development Workflow** ✅ PASS
- Follows project standards (no hardcoded values, proper testing)
- Modular component design (NodeIndicator, AggregatePanel reusable)
- Comprehensive documentation (research.md, data-model.md, quickstart.md, contracts/)

## Project Structure

### Documentation (this feature)

```text
specs/008-llm-progress-indicators/
├── plan.md                      # This file (/speckit.plan command output)
├── spec.md                      # Feature specification (complete)
├── research.md                  # Phase 0 output (complete - 2,089 lines)
├── data-model.md                # Phase 1 output (complete - 1,582 lines)
├── quickstart.md                # Phase 1 output (complete - 1,573 lines)
├── contracts/
│   ├── progress-events.yaml     # Phase 1 output (complete - WebSocket/SSE events)
│   ├── store-interface.ts       # Phase 1 output (complete - Zustand store contract)
│   └── component-props.ts       # Phase 1 output (complete - Component interfaces)
└── tasks.md                     # Phase 2 output (to be generated by /speckit.tasks)
```

### Source Code (repository root)

**Frontend Structure:**
```text
frontend/src/
├── stores/
│   └── progressStore.ts               # NEW: Zustand store for progress indicators
│
├── hooks/
│   ├── useProgressIndicator.ts        # NEW: Hook for individual node progress
│   ├── useAggregateStatus.ts          # NEW: Hook for dashboard aggregate status
│   ├── useStreamingAnimation.ts       # NEW: Hook for streaming text animation
│   └── useReducedMotion.ts            # NEW: Hook for prefers-reduced-motion detection
│
├── components/
│   ├── Node.tsx                       # MODIFIED: Add progress indicator integration
│   ├── NodeIndicator.tsx              # NEW: Visual state indicator component
│   ├── StreamingNode.tsx              # NEW: Node with real-time streaming content
│   ├── ProgressBar.tsx                # NEW: Progress bar component
│   ├── StatusBadge.tsx                # NEW: State badge (queued, completed, etc.)
│   ├── ErrorDisplay.tsx               # NEW: Error message display with retry
│   ├── AggregatePanel.tsx             # NEW: Dashboard panel for all operations
│   ├── OperationList.tsx              # NEW: Virtual scrolling list of operations
│   └── OperationDetails.tsx           # NEW: Expanded operation details view
│
├── features/
│   └── progress/
│       ├── components/
│       │   ├── AnimatedSpinner.tsx    # NEW: GPU-accelerated spinner
│       │   ├── PulsingBorder.tsx      # NEW: Pulsing border animation
│       │   └── FlowingProgress.tsx    # NEW: Flowing progress indicator
│       │
│       ├── utils/
│       │   ├── progressCalculations.ts # NEW: Progress % calculations
│       │   ├── tokenBatcher.ts         # NEW: Batch tokens for UI updates
│       │   ├── animationDetector.ts    # NEW: Detect frame rate, adaptive quality
│       │   └── stateTransitions.ts     # NEW: Validate state transitions
│       │
│       └── styles/
│           ├── animations.css          # NEW: CSS keyframes for all animations
│           ├── indicators.css          # NEW: Indicator styling for all states
│           ├── dashboard.css           # NEW: Aggregate panel styling
│           └── reduced-motion.css      # NEW: Static fallbacks for accessibility
│
└── types/
    └── progress.ts                     # NEW: TypeScript types (from contracts/)

frontend/tests/
├── unit/
│   ├── progressStore.test.ts           # NEW: Zustand store unit tests
│   ├── tokenBatcher.test.ts            # NEW: Token batching unit tests
│   ├── stateTransitions.test.ts        # NEW: State machine unit tests
│   └── animationDetector.test.ts       # NEW: Animation detection unit tests
│
├── components/
│   ├── NodeIndicator.test.tsx          # NEW: NodeIndicator component tests
│   ├── StreamingNode.test.tsx          # NEW: StreamingNode component tests
│   ├── AggregatePanel.test.tsx         # NEW: AggregatePanel component tests
│   └── ProgressBar.test.tsx            # NEW: ProgressBar component tests
│
├── integration/
│   ├── progressLifecycle.test.tsx      # NEW: Full operation lifecycle test
│   ├── concurrentAnimations.test.tsx   # NEW: 10+ concurrent indicators test
│   └── accessibility.test.tsx          # NEW: Reduced motion + ARIA tests
│
└── performance/
    └── animationPerformance.test.tsx   # NEW: 60fps validation test
```

**Structure Decision**: Option 2 (Web Application) selected. This is a frontend-focused feature adding visual progress feedback to existing LLM operations. All implementation is in the React frontend (components, hooks, Zustand store, CSS animations). Backend changes are minimal (already provided by Feature 007's WebSocket/SSE streaming). Clear separation: backend streams operation state, frontend visualizes it with animations and aggregate dashboard.

## Complexity Tracking

> **Note**: All architectural requirements satisfied. No constitutional violations requiring justification.

(No violations - all design choices align with project principles)

## Phase 0 Artifacts

**Status**: ✅ COMPLETE

- ✅ **research.md**: Comprehensive technical research (2,089 lines)
  - Task 1: CSS animations vs JS animations (CSS selected for GPU acceleration, 60fps)
  - Task 2: React animation libraries comparison (Plain CSS + React Transition Group for minimal bundle impact)
  - Task 3: State indicator design patterns (multi-channel: color + icon + animation + text)
  - Task 4: Progress visualization techniques (word count + elapsed time, not percentage)
  - Task 5: Aggregate dashboard patterns (floating panel with virtual scrolling)
  - Task 6: Accessibility research (prefers-reduced-motion + ARIA live regions)
  - Task 7: Performance optimization (Zustand selective subscriptions + debouncing + React.memo)
  - Task 8: Testing animations (Vitest + React Testing Library, focus on state not animation frames)

## Phase 1 Artifacts

**Status**: ✅ COMPLETE

- ✅ **data-model.md**: Entity definitions (1,582 lines)
  - ProgressIndicator (8 states: idle, queued, processing, streaming, completed, failed, cancelled, paused)
  - AnimationConfig (timing, performance, accessibility, feature flags)
  - AggregateStatus (counts by state, operations list, computed properties)
  - OperationSummary (individual operation for dashboard with UI hints)
  - VisualTheme (3 themes: light, dark, high-contrast with per-state styling)
  - ProgressStore (Zustand): state structure + actions + optimized selectors
  - State machine with validation and event handlers

- ✅ **contracts/progress-events.yaml**: WebSocket/SSE event specifications (450+ lines)
  - 11 event types: operation_initiated, token_received, final_token_received, operation_failed, operation_queued, operation_paused, operation_cancelled, connection_lost, connection_restored, batch_update, metrics_update
  - Complete message schemas with examples
  - Delivery guarantees (ordering, batching 50-100ms, deduplication)
  - Transport specifications (WebSocket primary, SSE fallback, REST polling)
  - Error handling and recovery procedures

- ✅ **contracts/store-interface.ts**: TypeScript store contract (900+ lines)
  - 50+ TypeScript interfaces for all data types
  - Zustand store interface (state + 20+ actions)
  - 20+ optimized selectors for preventing re-renders
  - Default configurations (normal, reduced-motion, low-performance)
  - Validation rules and type guards

- ✅ **contracts/component-props.ts**: Component prop interfaces (750+ lines)
  - 7 major components: NodeIndicator, StreamingNode, AggregatePanel, ProgressBar, StatusBadge, ErrorDisplay, OperationDetails
  - 11 supporting components and utilities
  - Hook parameter types (useProgressIndicator, useAggregateStatus, useStreamingNode)
  - Event handler type definitions
  - Complete prop documentation with usage examples

- ✅ **quickstart.md**: Developer onboarding guide (1,573 lines)
  - Feature overview with before/after demonstrations
  - Core concepts and architecture (data flow diagrams)
  - Key components documentation with code examples
  - 5-minute walkthrough: Add progress indicator to existing node
  - 4-phase implementation plan (4 weeks):
    - Phase 1: Basic state indicators (Week 1)
    - Phase 2: Streaming animations (Week 2)
    - Phase 3: Aggregate dashboard (Week 3)
    - Phase 4: Polish and accessibility (Week 4)
  - API integration guide (WebSocket connection, event handling)
  - Comprehensive testing checklist (100+ test cases)
  - Troubleshooting for 5 common issues
  - 10 performance optimization techniques
  - 8 accessibility guidelines
  - 50+ code examples in TypeScript, React, CSS, testing

## Next Steps

**Action**: Run `/speckit.tasks` to generate task breakdown (`tasks.md`) with:
- Specific actionable tasks in dependency order
- Organized by 4 implementation phases
- Estimated complexity and effort (4 weeks total)
- Testing acceptance criteria for each task
- Git commit message templates

**Acceptance Gate**: tasks.md must decompose all requirements into <4-hour implementation tasks, each with clear completion criteria and test coverage targets.

---

## Reference Information

**Key Metrics from Research**:
- Animation frame rate: 60fps (16ms/frame) with 10+ concurrent indicators
- Indicator appearance latency: <100ms from state change
- State transition duration: 200-500ms (smooth but not slow)
- Streaming update latency: <200ms from backend token to UI render
- Dashboard update latency: <500ms from operation state change
- Bundle size impact: <10KB (plain CSS, no heavy libraries)
- Token batching: 50-100ms intervals (balance real-time feel with performance)

**Critical Implementation Requirements**:
1. Use CSS animations with GPU acceleration (transform, opacity) for 60fps
2. Zustand selective subscriptions to prevent re-render storms with 10+ indicators
3. Token batching (50-100ms) to maintain UI performance during streaming
4. Respect `prefers-reduced-motion` accessibility setting (static indicators when disabled)
5. ARIA live regions for screen reader state announcements
6. Virtual scrolling in dashboard for 50+ operations (render only visible)
7. State transition validation (prevent invalid transitions)
8. Off-screen animation disabling (performance optimization)

**Testing Coverage Target**: 80%+ code coverage
- 15+ new test files (unit + component + integration + performance)
- State transition scenarios (all valid and invalid transitions)
- Animation performance (60fps validation with 10+ concurrent)
- Accessibility (reduced motion, screen reader announcements, keyboard nav)
- Edge cases (rapid transitions, off-screen streaming, background tabs)

**Estimated Implementation Effort**: 4 weeks
- Phase 1: Basic state indicators (no animations) - Week 1
  - NodeIndicator component with static state display
  - ProgressStore (Zustand) setup
  - Integration with existing Node component
- Phase 2: Streaming animations - Week 2
  - CSS keyframes for spin, pulse, flow animations
  - StreamingNode with real-time content
  - Token batching for performance
- Phase 3: Aggregate dashboard - Week 3
  - AggregatePanel component with virtual scrolling
  - Dashboard real-time updates
  - Bulk actions (Retry All Failed, Cancel All)
- Phase 4: Polish and accessibility - Week 4
  - prefers-reduced-motion support
  - ARIA live regions for screen readers
  - Performance optimization (memoization, off-screen disabling)
  - Comprehensive testing (100+ test cases)

**Dependencies**:
- Feature 007 (Concurrent LLM Operations): Provides WebSocket/SSE streaming and operation state
- ReactFlow 11.11.4: Canvas rendering system (must support animated node updates)
- Zustand 5.0.8: State management for progress indicators

**Performance Benchmarks**:
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Indicator appearance | <100ms | Timestamp when state changes to when animation starts |
| Animation frame rate | 60fps (16ms/frame) | Chrome DevTools Performance timeline |
| State transition | 200-500ms | CSS animation duration |
| Streaming UI update | <200ms | Backend timestamp to UI render timestamp |
| Dashboard update | <500ms | State change to dashboard reflecting change |
| 10 concurrent indicators | 60fps maintained | Performance profiling with all indicators active |
| Memory usage | <5MB | Chrome DevTools Memory profiler |
| Bundle size impact | <10KB | Webpack bundle analyzer |
