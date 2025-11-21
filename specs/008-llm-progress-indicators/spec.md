# Feature Specification: Visual Progress Indicators and Animations for LLM Operations

**Feature Branch**: `008-llm-progress-indicators`
**Created**: 2025-11-21
**Status**: Draft
**Input**: User description: "dans la spec LLM multi-dimentionnel, qui change tout au niveau UX, et aussi de facon général sur tous les LLM qui travaille il faudrait avoir un indicateur de travaille, un animation ou une progression ou quelque chose"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Individual Node Progress Indicators (Priority: P1 - Critical MVP)

Users need immediate visual feedback on the processing state of individual nodes when LLM operations are running. Without clear indicators, users cannot tell if a node is idle, processing, streaming content, completed, or failed. This creates confusion and uncertainty, especially when multiple LLM operations are running concurrently.

**Why this priority**: This is foundational UX feedback. Without visual indicators, users are blind to system activity and will assume the system is frozen or broken. This is the minimum viable feedback mechanism.

**Independent Test**: User creates a question node and clicks "Ask LLM" → immediately sees processing indicator (animated spinner/pulse) on the node → as LLM streams response, indicator changes to show streaming state → when response completes, indicator changes to completion state (checkmark) → user launches LLM on failed node, sees error indicator with retry button.

**Acceptance Scenarios**:

1. **Given** user clicks "Ask LLM" on an idle node, **When** the LLM request is initiated, **Then** node displays "processing" indicator within 100ms (animated spinner or pulsing border)
2. **Given** LLM is streaming response tokens, **When** first token arrives, **Then** node indicator transitions to "streaming" state (progress bar or flowing animation) and content begins to appear
3. **Given** LLM completes successfully, **When** final token is received, **Then** node indicator transitions to "completed" state (checkmark icon, solid border) and animation stops
4. **Given** LLM operation fails (timeout, error, rate limit), **When** failure occurs, **Then** node displays "failed" indicator (red border, error icon) with hover tooltip showing error message
5. **Given** node is in "completed" state, **When** user views the canvas, **Then** completed indicator is subtle but visible (does not distract from content)
6. **Given** node is idle (no LLM operation), **When** user views it, **Then** node has neutral appearance with no animated indicators (clear distinction from active states)

---

### User Story 2 - Real-Time Streaming Progress Visualization (Priority: P1 - Core UX)

Users need to see content appearing in real-time as the LLM streams its response, with clear visual indication of streaming progress. This provides confidence that the system is working and allows users to read partial responses before completion, enabling faster decision-making about whether to continue waiting or start new branches.

**Why this priority**: Real-time streaming feedback transforms perceived performance. Users can start reading and making decisions while the LLM is still responding, making the system feel much faster and more responsive.

**Independent Test**: User launches LLM on a question node → sees streaming indicator activate → watches as response text appears progressively (word-by-word or chunk-by-chunk) in the node → sees progress indicator updating (e.g., word count, elapsed time) → user reads partial response and decides to create child node before LLM completes → verifies streaming continues on parent while child is created.

**Acceptance Scenarios**:

1. **Given** LLM is streaming response, **When** tokens arrive from backend, **Then** node content updates progressively within 200ms of backend receiving tokens (no waiting for full response)
2. **Given** LLM is streaming, **When** user views the node, **Then** streaming indicator shows visual progress (e.g., word count "147 words...", elapsed time "3s", or progress bar filling)
3. **Given** streaming response is long (500+ words), **When** content grows, **Then** node expands smoothly to accommodate content with smooth animation (no jarring jumps)
4. **Given** 5 nodes are streaming concurrently, **When** user views canvas, **Then** all 5 nodes show independent streaming indicators updating at their own pace
5. **Given** streaming is interrupted (network issue), **When** connection is lost, **Then** indicator shows "paused" state (paused animation icon) and automatically resumes when connection restores
6. **Given** user scrolls canvas during streaming, **When** streaming node is off-screen, **Then** streaming continues in background and content is visible when user scrolls back (no loss of data)

---

### User Story 3 - Aggregate Multi-Operation Dashboard (Priority: P2 - Enhanced Visibility)

Users need a dashboard or summary view showing the status of all active LLM operations across the entire canvas when running multi-dimensional analysis with 10+ concurrent operations. Without aggregate view, users must manually inspect each node to understand overall progress, which is tedious and inefficient.

**Why this priority**: For power users running 10-15 concurrent LLMs, aggregate view provides essential situational awareness. It's not critical for basic use (single LLM), but essential for the multi-dimensional analysis UX that differentiates MindFlow.

**Independent Test**: User launches 8 concurrent LLM operations across different canvas areas → opens aggregate dashboard (e.g., sidebar, bottom panel, or popup) → sees list/table showing all 8 operations with their status (processing, streaming, completed, failed) → clicks on an operation in the dashboard → canvas pans to that node and highlights it → sees operation complete in dashboard with updated count (7 remaining).

**Acceptance Scenarios**:

1. **Given** 10 LLM operations are active, **When** user opens aggregate dashboard, **Then** dashboard lists all 10 operations with status (idle, processing, streaming, completed, failed) and elapsed time
2. **Given** aggregate dashboard is open, **When** any LLM operation changes state, **Then** dashboard updates in real-time (<500ms) to reflect new state
3. **Given** user clicks on operation in dashboard, **When** click occurs, **Then** canvas pans to that node and temporarily highlights it (pulsing border for 2s)
4. **Given** 3 operations are queued due to concurrency limit, **When** user views dashboard, **Then** queued operations show queue position (e.g., "Queue position: 2 of 3")
5. **Given** all operations complete, **When** last operation finishes, **Then** dashboard shows summary (e.g., "10 completed, 0 failed, total time 45s") with option to dismiss
6. **Given** dashboard shows 2 failed operations, **When** user clicks "Retry All Failed", **Then** all failed operations are retried and dashboard updates to show retry status

---

### User Story 4 - Smooth Animations and Transitions (Priority: P2 - Polish)

Users need smooth, non-jarring animations when nodes change state (idle → processing → streaming → completed) to create a polished, professional experience. Abrupt state changes or laggy animations make the system feel unresponsive or buggy, reducing user confidence.

**Why this priority**: Smooth animations significantly improve perceived quality and professionalism. While not critical for functionality, they are essential for user confidence and satisfaction, especially in a tool targeting knowledge workers.

**Independent Test**: User launches LLM operation → watches state transition animations (idle → processing → streaming → completed) → verifies animations are smooth (60fps), subtle (not distracting), and complete in reasonable time (200-500ms per transition) → launches 10 concurrent operations → verifies animations remain smooth with no dropped frames or lag.

**Acceptance Scenarios**:

1. **Given** node transitions from idle to processing, **When** transition begins, **Then** animation is smooth (60fps) and completes in 300ms (fade-in of spinner, border color transition)
2. **Given** node transitions from processing to streaming, **When** first token arrives, **Then** transition is smooth (spinner morphs to progress indicator) without jarring jumps
3. **Given** node transitions from streaming to completed, **When** final token is received, **Then** completion animation (e.g., checkmark fade-in, border pulse) completes in 500ms
4. **Given** 10 nodes are transitioning states simultaneously, **When** transitions occur, **Then** animations remain smooth with no dropped frames (<16ms frame time for 60fps)
5. **Given** node expands to accommodate streaming content, **When** content is added, **Then** expansion animation is smooth (ease-out curve) and does not cause other nodes to jump abruptly
6. **Given** user hovers over node with active operation, **When** hover occurs, **Then** hover state animation (e.g., border highlight) does not conflict with or stop the processing animation

---

### Edge Cases

- **What happens when LLM streams extremely fast (1000+ tokens/second)?**
  - System should batch UI updates to maintain 60fps (update every 16ms, not every token). Buffer tokens and flush in chunks to prevent UI thrashing.

- **How does system handle animations when user has "reduce motion" accessibility setting enabled?**
  - System should respect `prefers-reduced-motion` media query and use static state indicators (icon changes) instead of animations, while still providing clear state feedback.

- **What happens to progress indicators when node is off-screen during streaming?**
  - Streaming continues in background. When user scrolls node back into view, indicator shows current state (not replaying animation from start). Option to show notification badge on canvas minimap for off-screen activity.

- **How does system handle animations during browser performance issues (low FPS)?**
  - System should use CSS transitions (GPU-accelerated) instead of JavaScript animations. If frame rate drops below 30fps, simplify animations (e.g., disable pulsing, use static icons).

- **What happens when two nodes transition states at the exact same millisecond?**
  - Both animations play independently (not synchronized). Each node manages its own animation state to avoid coupling.

- **How does dashboard handle 50+ concurrent operations (beyond expected use)?**
  - Dashboard uses virtual scrolling to render only visible operations (10-20 at a time). Shows summary count at top (e.g., "50 operations: 30 completed, 15 streaming, 5 failed").

- **What happens to animations when browser tab is in background?**
  - Browser may throttle animations. When tab returns to foreground, indicators should immediately show current state (not replay missed animations). Use `requestAnimationFrame` with visibility check.

## Requirements *(mandatory)*

### Functional Requirements

#### Visual State Indicators

- **FR-001**: System MUST display distinct visual state for each node state: idle, processing, streaming, completed, failed, cancelled, queued
- **FR-002**: Idle nodes MUST have neutral appearance with no animated indicators (clear baseline state)
- **FR-003**: Processing nodes (before first token) MUST show animated indicator (spinner, pulsing border, or pulse animation) visible within 100ms of LLM request start
- **FR-004**: Streaming nodes (receiving tokens) MUST show different indicator from processing state (e.g., progress bar, flowing animation, or growing content indicator)
- **FR-005**: Completed nodes MUST show completion indicator (checkmark icon, solid border, or subtle badge) that is visible but not distracting
- **FR-006**: Failed nodes MUST show error indicator (red border, error icon, or warning badge) with hover tooltip displaying error message
- **FR-007**: Queued nodes (waiting due to concurrency limit) MUST show queue indicator with position (e.g., "Queued: 2 of 5")

#### Real-Time Progress Feedback

- **FR-008**: System MUST update node content progressively as LLM streams tokens (no waiting for complete response)
- **FR-009**: Progressive content updates MUST appear in UI within 200ms of backend receiving tokens from LLM provider
- **FR-010**: Streaming nodes MUST display progress metric: word count (e.g., "127 words..."), elapsed time (e.g., "5s"), or percentage complete (if response length is estimable)
- **FR-011**: System MUST update progress indicators in real-time for all concurrent operations independently (no blocking)
- **FR-012**: System MUST handle streaming token batching to maintain UI performance: update UI every 50-100ms (not every single token)

#### Aggregate Dashboard/Summary View

- **FR-013**: System MUST provide aggregate view showing status of all active LLM operations (dashboard, sidebar, or summary panel)
- **FR-014**: Aggregate view MUST display for each operation: node identifier (title/preview), current state, elapsed time, progress metric
- **FR-015**: Aggregate view MUST update in real-time (<500ms latency) when any operation changes state
- **FR-016**: Clicking operation in aggregate view MUST pan canvas to that node and highlight it temporarily (2-3 second pulse)
- **FR-017**: Aggregate view MUST show queued operations with queue position when concurrency limit is reached
- **FR-018**: Aggregate view MUST provide summary statistics: total operations, completed count, failed count, active count, total elapsed time
- **FR-019**: Aggregate view MUST provide bulk actions: "Retry All Failed", "Cancel All", "Clear Completed"

#### Animation and Transitions

- **FR-020**: State transition animations MUST run at 60fps (frame time <16ms) on typical hardware (4-core CPU, 8GB RAM)
- **FR-021**: State transition animations MUST complete in 200-500ms (not too fast or too slow)
- **FR-022**: Processing indicator animation (spinner/pulse) MUST loop smoothly with no jarring restarts
- **FR-023**: Content expansion animation (as streaming text grows) MUST use smooth easing curve (ease-out) to prevent abrupt jumps
- **FR-024**: Hover interactions MUST NOT interrupt or conflict with processing/streaming animations (both can coexist)
- **FR-025**: System MUST use GPU-accelerated CSS animations/transitions (transform, opacity) instead of JavaScript-driven animations for performance

#### Accessibility and Performance

- **FR-026**: System MUST respect user's `prefers-reduced-motion` accessibility setting and provide static indicators when motion is disabled
- **FR-027**: Progress indicators MUST be accessible to screen readers (announce state changes: "Processing...", "Streaming response...", "Completed")
- **FR-028**: System MUST maintain 60fps canvas rendering even with 10+ concurrent animated indicators
- **FR-029**: Animations MUST degrade gracefully if browser frame rate drops below 30fps (simplify or disable non-critical animations)
- **FR-030**: Off-screen streaming nodes MUST continue processing without rendering animations (performance optimization)

#### Error and Edge Case Handling

- **FR-031**: Failed operations MUST display error message on hover or click with "Retry" button
- **FR-032**: Interrupted streaming (network disconnect) MUST show "paused" indicator and automatically resume when connection restores
- **FR-033**: When user scrolls node into view during streaming, indicator MUST show current state (not replay animation from start)
- **FR-034**: System MUST handle rapid state transitions (e.g., queued → processing → streaming in <1s) without animation conflicts
- **FR-035**: Background tabs MUST update indicators to current state when tab returns to foreground (no stale indicators)

#### Visual Design Specifications (Non-Technical)

- **FR-036**: Processing indicator MUST be clearly visible but not overwhelming (suggested: subtle spinner icon or pulsing border, not full-screen overlay)
- **FR-037**: Streaming indicator MUST differentiate from processing (suggested: progress bar, animated dots, or flowing gradient)
- **FR-038**: Color scheme MUST use intuitive colors: neutral (idle), blue/purple (processing/streaming), green (completed), red (failed), yellow (queued)
- **FR-039**: Animations MUST be smooth and professional, not gimmicky or distracting (avoid bouncing, flashing, or rapid movements)
- **FR-040**: Completed state indicator MUST be subtle enough to not distract from content but visible enough to provide feedback

### Key Entities

- **ProgressIndicator**: Represents visual progress state for a node
  - node_id (which node this indicator belongs to)
  - status (enum: idle, processing, streaming, completed, failed, cancelled, queued)
  - progress_value (0.0 to 1.0, or word count, or elapsed time)
  - progress_type (enum: percentage, word_count, elapsed_time, indeterminate)
  - animation_state (current animation: spinning, pulsing, flowing, static)
  - error_message (optional, if status is failed)
  - queue_position (optional, if status is queued)

- **AnimationConfig**: Configuration for animations and transitions
  - transition_duration_ms (default 300ms)
  - animation_fps_target (default 60fps)
  - enable_animations (boolean, respects prefers-reduced-motion)
  - spinner_speed (rpm for rotating spinners)
  - pulse_frequency (Hz for pulsing animations)
  - easing_curve (enum: linear, ease-in, ease-out, ease-in-out)

- **AggregateStatus**: Summary of all LLM operations for dashboard
  - total_operations (count)
  - idle_count, processing_count, streaming_count, completed_count, failed_count, queued_count
  - operations (list of OperationSummary)
  - total_elapsed_time (aggregate time across all operations)
  - last_updated (timestamp for real-time sync)

- **OperationSummary**: Individual operation data for dashboard display
  - operation_id
  - node_id
  - node_title (short preview for identification)
  - status (enum: processing, streaming, completed, failed, queued)
  - progress (progress_value and progress_type)
  - elapsed_time (seconds since operation started)
  - queue_position (optional)
  - error_message (optional)

- **VisualTheme**: Defines colors and styles for different states
  - idle_style (colors, borders, icons)
  - processing_style (colors, animations, icons)
  - streaming_style (colors, animations, icons)
  - completed_style (colors, borders, icons)
  - failed_style (colors, borders, icons)
  - queued_style (colors, borders, icons)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify node processing state at a glance with 95% accuracy in usability testing (idle vs processing vs streaming vs completed vs failed)
- **SC-002**: Processing/streaming indicators appear within 100ms of LLM operation state change (user perceives immediate feedback)
- **SC-003**: Animations run at 60fps (frame time <16ms) during 10 concurrent LLM operations on typical hardware (verified with browser DevTools Performance tab)
- **SC-004**: Real-time streaming content updates appear in UI within 200ms of backend receiving tokens (measured with timestamps)
- **SC-005**: State transition animations complete in 200-500ms (smooth but not slow, verified with animation timing logs)
- **SC-006**: Aggregate dashboard displays accurate real-time status for all operations with <500ms update latency
- **SC-007**: System maintains UI responsiveness (<100ms interaction latency) even with 10+ animated indicators active
- **SC-008**: Users can read and understand streaming responses 30% faster compared to waiting for complete response (measured in user testing)
- **SC-009**: Failed operations provide clear actionable feedback with 90% of users successfully retrying without confusion
- **SC-010**: Reduced motion mode provides equivalent state feedback without animations for users with accessibility needs (100% feature parity)

### Qualitative Outcomes

- Users feel confident the system is working when LLM operations are processing (no "is it frozen?" confusion)
- Real-time streaming feedback makes the system feel faster and more responsive than competitors
- Smooth animations create a polished, professional impression (not amateurish or jarring)
- Users find it easy to track multiple concurrent operations without feeling overwhelmed
- The aggregate dashboard provides situational awareness without cluttering the main canvas
- Progress indicators are informative but not distracting (balance between feedback and focus)
- Users trust that failed operations will be clearly communicated with actionable recovery options
- Accessibility users (reduced motion) receive equivalent feedback through static indicators

## Assumptions *(optional)*

- Users have modern browsers supporting CSS animations, transforms, and GPU acceleration (Chrome 90+, Firefox 88+, Safari 14+)
- Typical hardware can render 60fps animations (4-core CPU, 8GB RAM, integrated or discrete GPU)
- LLM streaming responses arrive at variable rates (10-100 tokens/second), requiring adaptive UI update batching
- Most users will have 1-5 concurrent operations, with power users running 10-15
- Users understand visual conventions: spinners mean processing, checkmarks mean completed, red means error
- Users with visual impairments rely on screen readers and need equivalent non-visual feedback
- Dashboard/aggregate view will be optional (can be hidden) for users who prefer minimal UI
- Animations will be a net positive for UX (not annoying) if designed subtly and professionally

## Dependencies *(optional)*

- **External Dependencies**:
  - CSS animation support in target browsers (all modern browsers)
  - GPU acceleration for smooth animations (available on all modern devices)
  - Server-Sent Events (SSE) or WebSocket for real-time LLM streaming from backend
  - Screen reader support for accessibility (ARIA live regions)

- **Internal Dependencies**:
  - Feature 007 (Concurrent LLM Operations) provides the backend infrastructure for multiple LLM operations
  - Existing LLMManager and streaming response handling
  - ReactFlow canvas rendering system (must support animated node updates without lag)
  - Zustand store for real-time node state updates and subscription
  - Backend SSE/WebSocket implementation for streaming LLM tokens to frontend

## Out of Scope *(optional)*

- Audio feedback (beeps, chimes) when operations complete (visual only)
- Confetti or elaborate celebration animations on completion (too distracting)
- Customizable animation themes (user preferences for animation styles)
- Progress prediction algorithms (estimating remaining time for LLM responses - too unreliable)
- History/timeline of past operations in aggregate view (only shows current/active operations)
- Per-node animation customization (one consistent animation system for all nodes)
- Mobile-specific animation optimizations (desktop/laptop focus for MVP)
- Advanced animation choreography (synchronized animations across multiple nodes)

## Notes *(optional)*

### Design Philosophy

**Animations should inform, not entertain**. The goal is to provide clear, immediate feedback on system state without distracting users from their cognitive work. Animations should be:
- **Subtle**: Not attention-grabbing unless state requires user action (e.g., error)
- **Smooth**: 60fps is non-negotiable for professionalism
- **Fast**: Transitions complete in <500ms (users should perceive immediate response)
- **Purposeful**: Every animation communicates state, not decorative

### UX Considerations

- **Progressive Disclosure**: Start with minimal indicators (idle state has none), add indicators only when operations are active
- **Visual Hierarchy**: Processing/streaming indicators should be more prominent than completed/failed indicators (active > passive)
- **Consistency**: Use same animation patterns across all nodes (predictable, learnable)
- **Responsiveness**: Indicators appear within 100ms of state change (perceived as instantaneous)
- **Accessibility First**: Static fallbacks for reduced-motion users must provide equivalent information

### Performance Targets

| Operation | Target | Measurement Method |
|-----------|--------|-------------------|
| Indicator appearance | <100ms | Timestamp when state changes to when animation starts |
| Animation frame rate | 60fps (16ms/frame) | Browser DevTools Performance timeline |
| State transition | 200-500ms | Animation duration from start to completion |
| Streaming UI update | <200ms from backend token | Backend timestamp to UI render timestamp |
| Dashboard update | <500ms | State change to dashboard reflecting change |
| 10 concurrent indicators | 60fps maintained | Performance profiling with all indicators active |

### Visual Design Guidelines (Non-Technical)

**Processing State**:
- Animated spinner (rotation) or pulsing border (opacity fade)
- Blue/purple color scheme (neutral, non-alarming)
- Placement: Top-right corner of node (non-intrusive)

**Streaming State**:
- Progress bar filling, animated dots flowing, or growing word count
- Blue/purple color with accent (slightly brighter than processing)
- Content appears progressively (typewriter effect is too slow, chunk-based is better)

**Completed State**:
- Subtle checkmark icon or solid border color change
- Green accent (success color)
- Animation: Brief fade-in or scale pulse on completion, then static

**Failed State**:
- Error icon (exclamation mark) with red border/accent
- Hover shows error message tooltip
- Persistent indicator (does not auto-dismiss) until user retries

**Queued State**:
- Badge showing queue position (e.g., "Queue: 3")
- Yellow/amber color (waiting, not urgent)
- Subtle pulsing to indicate it's in queue, not forgotten

### Aggregate Dashboard Design

**Location Options**:
1. Floating panel (bottom-right corner, collapsible)
2. Sidebar (right edge, slide-out)
3. Top bar (horizontal status strip)

**Recommended**: Floating panel (most flexible, doesn't steal canvas space)

**Content**:
- Header: "Active Operations (5)"
- List: Each operation shows mini node preview, state icon, progress, elapsed time
- Footer: Summary statistics + bulk actions
- Clicking operation pans to node and pulses border for 2s

### Future Enhancements (Not in Initial Scope)

- Audio notifications for completion (opt-in)
- Customizable animation themes (light/dark, minimal/expressive)
- Advanced progress prediction (ML-based estimation of LLM response time)
- Historical operation log in dashboard (past 100 operations)
- Per-node animation intensity controls (power users)
- Mobile gesture-based animation triggers
- Synchronized animation choreography (all nodes pulse together on milestone)
- Canvas minimap with activity heat map (shows where operations are active)
