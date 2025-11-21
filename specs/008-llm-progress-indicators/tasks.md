# Tasks: Visual Progress Indicators and Animations for LLM Operations

**Feature**: 008-llm-progress-indicators
**Date**: 2025-11-21
**Status**: Ready for Implementation
**Estimated Effort**: 4 weeks (60-80 hours)

---

## Phase 1: Setup (Week 1 - Days 1-2)

### Project Initialization

- [ ] T001 [P] Create feature branch `008-llm-progress-indicators` from main
- [ ] T002 [P] Install react-transition-group dependency in frontend/package.json (v4.4.5)
- [ ] T003 [P] Install lucide-react for icons in frontend/package.json (if not already present)
- [ ] T004 Create frontend directory structure per plan.md (features/progress/, hooks/, stores/, types/)
- [ ] T005 [P] Create placeholder CSS files (animations.css, indicators.css, dashboard.css, reduced-motion.css)
- [ ] T006 [P] Set up Vitest test directory structure (unit/, components/, integration/, performance/)

**Commit Message Template**:
```
chore: Initialize Feature 008 progress indicators foundation

- Create feature branch and directory structure
- Install dependencies (react-transition-group, lucide-react)
- Set up test scaffolding
- Create placeholder CSS files

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Phase 2: Foundational (Week 1 - Days 3-5)

### Shared Types and Contracts

- [ ] T007 [P] Create ProgressIndicator TypeScript types in frontend/src/types/progress.ts (from contracts/store-interface.ts)
- [ ] T008 [P] Create OperationStatus, ProgressType, AnimationState enums in frontend/src/types/progress.ts
- [ ] T009 [P] Create AnimationConfig interface and defaults in frontend/src/types/progress.ts
- [ ] T010 [P] Create AggregateStatus and OperationSummary interfaces in frontend/src/types/progress.ts
- [ ] T011 [P] Create VisualTheme interface and default themes (LIGHT_THEME, DARK_THEME) in frontend/src/types/progress.ts

### CSS Animations Foundation

- [ ] T012 [P] Define CSS keyframes for 'spin' animation in frontend/src/features/progress/styles/animations.css
- [ ] T013 [P] Define CSS keyframes for 'pulse' animation in frontend/src/features/progress/styles/animations.css
- [ ] T014 [P] Define CSS keyframes for 'flow' animation in frontend/src/features/progress/styles/animations.css
- [ ] T015 [P] Define CSS keyframes for 'bounce-complete' animation in frontend/src/features/progress/styles/animations.css
- [ ] T016 [P] Create GPU-accelerated animation utilities (transform, opacity) in frontend/src/features/progress/styles/animations.css
- [ ] T017 Create reduced-motion CSS fallbacks in frontend/src/features/progress/styles/reduced-motion.css

### Zustand Store Scaffold

- [ ] T018 Create progressStore state structure in frontend/src/stores/progressStore.ts
- [ ] T019 Implement addIndicator action in frontend/src/stores/progressStore.ts
- [ ] T020 Implement updateIndicator action in frontend/src/stores/progressStore.ts
- [ ] T021 Implement removeIndicator action in frontend/src/stores/progressStore.ts
- [ ] T022 Implement batchUpdateIndicators action in frontend/src/stores/progressStore.ts
- [ ] T023 [P] Create optimized selectors (selectIndicator, selectActiveIndicators) in frontend/src/stores/progressStore.ts
- [ ] T024 [P] Write unit tests for progressStore actions in frontend/tests/unit/progressStore.test.ts

### State Transition Validation

- [ ] T025 [P] Create isValidStateTransition guard function in frontend/src/features/progress/utils/stateTransitions.ts
- [ ] T026 [P] Create isValidAnimationForStatus guard function in frontend/src/features/progress/utils/stateTransitions.ts
- [ ] T027 [P] Write unit tests for state transition validation in frontend/tests/unit/stateTransitions.test.ts

**Commit Message Template**:
```
feat: Add foundational types, CSS animations, and Zustand store

- Define TypeScript types (ProgressIndicator, AnimationConfig, AggregateStatus)
- Implement CSS keyframes (spin, pulse, flow, bounce)
- Create progressStore with CRUD actions and selectors
- Add state transition validation guards
- Write unit tests for store and state transitions

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Phase 3: User Story 1 - Individual Node Progress Indicators (Week 1-2)

**Goal**: Users see visual state indicators on nodes (idle, processing, streaming, completed, failed, queued)

**Independent Test**: Launch LLM on node → see processing indicator → see streaming → see completed checkmark

### Core Components

- [ ] T028 [P] [US1] Create NodeIndicator component in frontend/src/components/NodeIndicator.tsx (display state, icon, animation)
- [ ] T029 [P] [US1] Create StatusBadge component in frontend/src/components/StatusBadge.tsx (queued, failed, completed badges)
- [ ] T030 [P] [US1] Create ErrorDisplay component in frontend/src/components/ErrorDisplay.tsx (error message with retry button)

### Hooks

- [ ] T031 [P] [US1] Create useProgressIndicator hook in frontend/src/hooks/useProgressIndicator.ts (subscribe to single indicator)
- [ ] T032 [P] [US1] Create useReducedMotion hook in frontend/src/hooks/useReducedMotion.ts (detect prefers-reduced-motion)

### Styling

- [ ] T033 [P] [US1] Create indicator CSS for all 8 states (idle, queued, processing, streaming, completed, failed, cancelled, paused) in frontend/src/features/progress/styles/indicators.css
- [ ] T034 [US1] Create reduced-motion static fallbacks for indicators in frontend/src/features/progress/styles/reduced-motion.css

### Integration

- [ ] T035 [US1] Integrate NodeIndicator with existing Node component in frontend/src/components/Node.tsx
- [ ] T036 [US1] Add ARIA live region support for screen reader announcements in frontend/src/components/NodeIndicator.tsx
- [ ] T037 [US1] Test indicator appearance latency (<100ms from state change)

### Testing

- [ ] T038 [P] [US1] Write NodeIndicator component tests in frontend/tests/components/NodeIndicator.test.tsx
- [ ] T039 [P] [US1] Write StatusBadge component tests in frontend/tests/components/StatusBadge.test.tsx
- [ ] T040 [P] [US1] Write useProgressIndicator hook tests in frontend/tests/unit/useProgressIndicator.test.ts
- [ ] T041 [US1] Write integration test for full indicator lifecycle (idle → processing → streaming → completed) in frontend/tests/integration/progressLifecycle.test.tsx

**Commit Message Template**:
```
feat: [US1] Add individual node progress indicators

- Implement NodeIndicator, StatusBadge, ErrorDisplay components
- Create useProgressIndicator and useReducedMotion hooks
- Add CSS styling for all 8 operation states
- Integrate indicators with existing Node component
- Add ARIA live regions for screen reader support
- Write component and integration tests

User Story 1: Users can see visual state indicators on nodes showing
idle, processing, streaming, completed, failed, and queued states.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Phase 4: User Story 2 - Real-Time Streaming Progress (Week 2)

**Goal**: Users see content appearing progressively as LLM streams, with progress metrics

**Independent Test**: LLM streams response → content appears progressively → word count updates → smooth expansion

### Core Components

- [ ] T042 [P] [US2] Create StreamingNode component in frontend/src/components/StreamingNode.tsx (progressive content display)
- [ ] T043 [P] [US2] Create ProgressBar component in frontend/src/components/ProgressBar.tsx (visual progress bar)

### Utilities

- [ ] T044 [P] [US2] Create token batching utility (ProgressUpdateBatcher class) in frontend/src/features/progress/utils/tokenBatcher.ts
- [ ] T045 [P] [US2] Create progress calculations utility (formatProgressText, getStatusIcon) in frontend/src/features/progress/utils/progressCalculations.ts

### Hooks

- [ ] T046 [P] [US2] Create useStreamingAnimation hook in frontend/src/hooks/useStreamingAnimation.ts (handle token batching)

### Styling

- [ ] T047 [P] [US2] Create CSS for flowing progress animation in frontend/src/features/progress/styles/animations.css
- [ ] T048 [P] [US2] Create CSS for smooth content expansion (ease-out) in frontend/src/features/progress/styles/indicators.css

### WebSocket/SSE Integration

- [ ] T049 [US2] Integrate WebSocket/SSE event handler for token_received events in frontend/src/services/api.ts
- [ ] T050 [US2] Connect token events to progressStore.batchUpdateIndicators in frontend/src/hooks/useStreamingAnimation.ts
- [ ] T051 [US2] Implement debouncing for UI updates (50-100ms batch) in frontend/src/features/progress/utils/tokenBatcher.ts

### Testing

- [ ] T052 [P] [US2] Write StreamingNode component tests in frontend/tests/components/StreamingNode.test.tsx
- [ ] T053 [P] [US2] Write ProgressBar component tests in frontend/tests/components/ProgressBar.test.tsx
- [ ] T054 [P] [US2] Write tokenBatcher unit tests in frontend/tests/unit/tokenBatcher.test.ts
- [ ] T055 [US2] Write streaming latency test (<200ms from backend token to UI) in frontend/tests/integration/streamingLatency.test.tsx

**Commit Message Template**:
```
feat: [US2] Add real-time streaming progress visualization

- Implement StreamingNode with progressive content display
- Create ProgressBar component for visual feedback
- Add token batching utility (50-100ms intervals)
- Implement useStreamingAnimation hook
- Create flowing progress CSS animations
- Integrate WebSocket/SSE token events with progressStore
- Write component and latency tests

User Story 2: Users see content appearing in real-time as LLM streams
with progress metrics (word count, elapsed time) updating continuously.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Phase 5: User Story 3 - Aggregate Multi-Operation Dashboard (Week 3)

**Goal**: Users see dashboard with all active operations, can click to navigate to nodes

**Independent Test**: Launch 8 concurrent LLMs → open dashboard → see all 8 with status → click one → canvas pans to node

### Core Components

- [ ] T056 [P] [US3] Create AggregatePanel component in frontend/src/components/AggregatePanel.tsx (dashboard container)
- [ ] T057 [P] [US3] Create OperationList component in frontend/src/components/OperationList.tsx (virtual scrolling list)
- [ ] T058 [P] [US3] Create OperationDetails component in frontend/src/components/OperationDetails.tsx (expanded operation view)

### Virtual Scrolling

- [ ] T059 [US3] Implement virtual scrolling for 50+ operations in frontend/src/components/OperationList.tsx (render only visible items)

### Hooks

- [ ] T060 [P] [US3] Create useAggregateStatus hook in frontend/src/hooks/useAggregateStatus.ts (subscribe to all operations)

### Dashboard State Management

- [ ] T061 [US3] Add dashboard state actions to progressStore (toggleDashboard, selectOperation) in frontend/src/stores/progressStore.ts
- [ ] T062 [US3] Implement real-time dashboard updates from progressStore in frontend/src/components/AggregatePanel.tsx

### Bulk Actions

- [ ] T063 [US3] Implement "Retry All Failed" bulk action in frontend/src/components/AggregatePanel.tsx
- [ ] T064 [US3] Implement "Cancel All" bulk action in frontend/src/components/AggregatePanel.tsx
- [ ] T065 [US3] Implement "Clear Completed" bulk action in frontend/src/components/AggregatePanel.tsx

### Canvas Navigation

- [ ] T066 [US3] Implement canvas pan to node on operation click in frontend/src/components/OperationList.tsx
- [ ] T067 [US3] Add temporary node highlight animation (2s pulse) on pan in frontend/src/components/Canvas.tsx

### Styling

- [ ] T068 [P] [US3] Create dashboard CSS layout (floating panel, bottom-right) in frontend/src/features/progress/styles/dashboard.css
- [ ] T069 [P] [US3] Create operation list CSS (summary rows, status icons) in frontend/src/features/progress/styles/dashboard.css

### Testing

- [ ] T070 [P] [US3] Write AggregatePanel component tests in frontend/tests/components/AggregatePanel.test.tsx
- [ ] T071 [P] [US3] Write OperationList component tests in frontend/tests/components/OperationList.test.tsx
- [ ] T072 [US3] Write virtual scrolling performance test (50+ operations) in frontend/tests/performance/virtualScrolling.test.tsx
- [ ] T073 [US3] Write dashboard update latency test (<500ms) in frontend/tests/integration/dashboardLatency.test.tsx

**Commit Message Template**:
```
feat: [US3] Add aggregate multi-operation dashboard

- Implement AggregatePanel, OperationList, OperationDetails components
- Add virtual scrolling for 50+ operations
- Create useAggregateStatus hook
- Implement bulk actions (Retry All, Cancel All, Clear Completed)
- Add canvas pan and node highlight on operation click
- Create dashboard CSS (floating panel layout)
- Write component, performance, and latency tests

User Story 3: Users see dashboard showing all active operations with
status, can click to navigate to nodes on canvas.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Phase 6: User Story 4 - Smooth Animations and Transitions (Week 3-4)

**Goal**: State transitions are smooth (60fps) and professional

**Independent Test**: Launch LLM → watch transitions → verify 60fps → test with 10 concurrent

### Animation Components

- [ ] T074 [P] [US4] Create AnimatedSpinner component in frontend/src/features/progress/components/AnimatedSpinner.tsx (GPU-accelerated spinner)
- [ ] T075 [P] [US4] Create PulsingBorder component in frontend/src/features/progress/components/PulsingBorder.tsx (opacity fade animation)
- [ ] T076 [P] [US4] Create FlowingProgress component in frontend/src/features/progress/components/FlowingProgress.tsx (gradient flow)

### Performance Monitoring

- [ ] T077 [P] [US4] Create animation performance detector in frontend/src/features/progress/utils/animationDetector.ts (measure FPS)
- [ ] T078 [US4] Implement adaptive animation quality based on FPS in frontend/src/features/progress/utils/animationDetector.ts

### GPU Acceleration

- [ ] T079 [US4] Optimize all animations to use CSS transform/opacity only in frontend/src/features/progress/styles/animations.css
- [ ] T080 [US4] Add will-change CSS hints for animation performance in frontend/src/features/progress/styles/animations.css

### Smooth Easing

- [ ] T081 [P] [US4] Define easing curves (ease-out for transitions) in frontend/src/features/progress/styles/animations.css
- [ ] T082 [US4] Apply easing to state transition animations (200-500ms duration) in frontend/src/features/progress/styles/indicators.css

### Hover Interactions

- [ ] T083 [US4] Implement hover effects without conflicting with processing animations in frontend/src/components/NodeIndicator.tsx
- [ ] T084 [US4] Add focus ring for keyboard navigation in frontend/src/features/progress/styles/indicators.css

### Off-Screen Optimization

- [ ] T085 [US4] Implement off-screen animation disabling (performance) in frontend/src/hooks/useProgressIndicator.ts
- [ ] T086 [US4] Add visibility check with IntersectionObserver in frontend/src/hooks/useProgressIndicator.ts

### Testing

- [ ] T087 [P] [US4] Write AnimatedSpinner component tests in frontend/tests/components/AnimatedSpinner.test.tsx
- [ ] T088 [P] [US4] Write animationDetector unit tests in frontend/tests/unit/animationDetector.test.ts
- [ ] T089 [US4] Write 60fps performance test with 10 concurrent indicators in frontend/tests/performance/animationPerformance.test.tsx
- [ ] T090 [US4] Write smooth transition test (200-500ms duration) in frontend/tests/components/NodeIndicator.test.tsx

**Commit Message Template**:
```
feat: [US4] Add smooth animations and transitions (60fps)

- Implement AnimatedSpinner, PulsingBorder, FlowingProgress components
- Create animation performance detector (FPS monitoring)
- Optimize all animations for GPU acceleration (transform/opacity)
- Add smooth easing curves (ease-out) for transitions
- Implement hover interactions without animation conflicts
- Add off-screen animation disabling for performance
- Write performance tests (60fps with 10 concurrent operations)

User Story 4: State transitions are smooth (60fps) and professional,
maintaining performance with 10+ concurrent animated indicators.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Phase 7: Polish & Cross-Cutting Concerns (Week 4)

### Error Handling

- [ ] T091 [P] Enhance ErrorDisplay component with retry logic in frontend/src/components/ErrorDisplay.tsx
- [ ] T092 [P] Add error message tooltip on hover for failed nodes in frontend/src/components/NodeIndicator.tsx

### Memory Management

- [ ] T093 Implement archiveCompleted action in progressStore in frontend/src/stores/progressStore.ts (retain 5 minutes)
- [ ] T094 Add automatic cleanup of archived indicators in frontend/src/stores/progressStore.ts
- [ ] T095 Write memory usage test (ensure <5MB overhead) in frontend/tests/performance/memoryUsage.test.tsx

### Performance Profiling

- [ ] T096 Profile animation performance with 10 concurrent operations in browser DevTools
- [ ] T097 Validate 60fps target with Chrome Performance timeline
- [ ] T098 Test frame time budget (16ms for 60fps) under load
- [ ] T099 Optimize any detected bottlenecks (memoization, batching)

### Accessibility Audit

- [ ] T100 Test prefers-reduced-motion support (static indicators)
- [ ] T101 Validate ARIA live region announcements with screen reader (NVDA/JAWS)
- [ ] T102 Test keyboard navigation (focus rings, tab order)
- [ ] T103 Validate color contrast ratios (WCAG AAA compliance)
- [ ] T104 Write accessibility integration tests in frontend/tests/integration/accessibility.test.tsx

### Bundle Size Optimization

- [ ] T105 Analyze bundle size impact (<10KB target) with webpack-bundle-analyzer
- [ ] T106 Tree-shake unused animation variants
- [ ] T107 Lazy-load dashboard components (code splitting)

### Browser Compatibility

- [ ] T108 Test on Chrome 90+ (primary target)
- [ ] T109 Test on Firefox 88+ (secondary target)
- [ ] T110 Test on Safari 14+ (tertiary target)
- [ ] T111 Add CSS autoprefixer for vendor prefixes

### Integration Testing with Feature 007

- [ ] T112 Test WebSocket connection and event handling with backend
- [ ] T113 Test SSE fallback when WebSocket unavailable
- [ ] T114 Test operation recovery on page reload (sync with backend state)
- [ ] T115 Test concurrent operation limits (queuing behavior)

### Documentation

- [ ] T116 [P] Update quickstart.md with final code examples
- [ ] T117 [P] Document all component props in JSDoc comments
- [ ] T118 [P] Create troubleshooting guide for common issues

**Commit Message Template**:
```
feat: Polish progress indicators - performance, accessibility, integration

- Enhance error handling with retry logic
- Implement memory management (auto-cleanup archived indicators)
- Profile and optimize animation performance (60fps validated)
- Complete accessibility audit (WCAG AAA, screen reader support)
- Optimize bundle size (<10KB, lazy-load dashboard)
- Test browser compatibility (Chrome, Firefox, Safari)
- Integrate with Feature 007 backend (WebSocket/SSE events)
- Update documentation with final examples

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Dependencies and Story Relationships

### Story Dependency Graph

```
Phase 1 (Setup) → Phase 2 (Foundation) → Phase 3-6 (User Stories in parallel) → Phase 7 (Polish)

User Story Dependencies:
- US1 (Individual Indicators) - MUST complete first (foundation for all others)
- US2 (Streaming Progress) - DEPENDS ON US1 (uses NodeIndicator)
- US3 (Aggregate Dashboard) - DEPENDS ON US1 (displays indicators)
- US4 (Smooth Animations) - DEPENDS ON US1, US2, US3 (enhances all)

Parallelization:
- After US1 completes: US2 and US3 can be done in parallel (different files)
- US4 can start after US1 (works on animation layer, not component logic)
```

### MVP Scope Recommendation

**Minimum Viable Product (MVP)**: US1 + US2

- **US1 (Individual Node Progress Indicators)**: Basic visual feedback on node state (idle, processing, streaming, completed, failed)
- **US2 (Real-Time Streaming Progress)**: Progressive content display and progress metrics

**Rationale**: US1 + US2 provide core value (immediate visual feedback and real-time streaming). US3 (dashboard) is valuable for power users but not essential for basic use. US4 (polish) is important for professionalism but can be iteratively improved.

**Post-MVP**: US3 + US4 can be added in subsequent iterations for enhanced UX and power user features.

### Parallel Execution Examples

**Phase 3 (US1) - Parallel Tasks**:
- T028 (NodeIndicator), T029 (StatusBadge), T030 (ErrorDisplay) - Different components, can be done in parallel
- T031 (useProgressIndicator hook), T032 (useReducedMotion hook) - Independent hooks
- T033 (indicator CSS), T034 (reduced-motion CSS) - Different CSS files

**Phase 4 (US2) - Parallel Tasks**:
- T042 (StreamingNode), T043 (ProgressBar) - Different components
- T044 (tokenBatcher), T045 (progressCalculations) - Different utility files
- T047 (flowing animation CSS), T048 (expansion CSS) - Different CSS sections

**Phase 5 (US3) - Parallel Tasks**:
- T056 (AggregatePanel), T057 (OperationList), T058 (OperationDetails) - Different components
- T068 (dashboard CSS), T069 (operation list CSS) - Different CSS sections

**Phase 6 (US4) - Parallel Tasks**:
- T074 (AnimatedSpinner), T075 (PulsingBorder), T076 (FlowingProgress) - Different animation components
- T077 (animationDetector), T081 (easing curves) - Independent utilities

---

## Task Summary

**Total Tasks**: 118
- **Phase 1 (Setup)**: 6 tasks (1-2 days)
- **Phase 2 (Foundation)**: 21 tasks (3-4 days)
- **Phase 3 (US1)**: 14 tasks (4-5 days)
- **Phase 4 (US2)**: 14 tasks (4-5 days)
- **Phase 5 (US3)**: 18 tasks (5-6 days)
- **Phase 6 (US4)**: 17 tasks (4-5 days)
- **Phase 7 (Polish)**: 28 tasks (5-6 days)

**Parallelizable Tasks**: 52 tasks marked with [P]

**Estimated Effort**: 4 weeks (60-80 hours)

**Critical Path**: Phase 1 → Phase 2 → US1 (Phase 3) → US2/US3 (Phases 4-5, parallel) → US4 (Phase 6) → Phase 7

---

## Testing Coverage Target

**80%+ Code Coverage** across:
- Unit tests: progressStore, tokenBatcher, stateTransitions, animationDetector
- Component tests: NodeIndicator, StreamingNode, AggregatePanel, ProgressBar, StatusBadge
- Integration tests: progressLifecycle, streamingLatency, dashboardLatency, accessibility
- Performance tests: animationPerformance (60fps), virtualScrolling (50+ ops), memoryUsage

**Accessibility Testing**:
- prefers-reduced-motion support (static indicators)
- ARIA live regions (screen reader announcements)
- Keyboard navigation (focus rings, tab order)
- Color contrast (WCAG AAA)

**Performance Benchmarks**:
- Indicator appearance: <100ms from state change
- Animation frame rate: 60fps with 10+ concurrent indicators
- Streaming UI update: <200ms from backend token to UI render
- Dashboard update: <500ms from operation state change
- Memory usage: <5MB overhead
- Bundle size: <10KB impact

---

## Git Workflow

**Branch Naming**: `008-llm-progress-indicators`

**Commit Frequency**: After each phase completion (6 major commits)

**Commit Message Format**: See templates above for each phase

**Pull Request**: Create PR after Phase 7 completion with full testing coverage

---

## Notes

- **File Paths**: All paths are absolute from repository root (E:\Projects\github\Assisted MindFlow)
- **Task Granularity**: Each task is <4 hours of work
- **Parallelization**: Tasks marked [P] can be done in parallel with other [P] tasks in same phase
- **Story Labels**: [US1], [US2], [US3], [US4] indicate which user story the task belongs to
- **Testing Philosophy**: Focus on state transitions and functionality, not animation frame inspection
- **Accessibility First**: prefers-reduced-motion and ARIA support are non-negotiable requirements

---

**Ready for Implementation**: Run `/speckit.implement` to begin execution, or manually start with Phase 1 tasks.
