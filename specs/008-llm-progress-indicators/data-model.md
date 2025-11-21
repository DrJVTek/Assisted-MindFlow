# Data Model: Visual Progress Indicators and Animations for LLM Operations

**Feature**: 008-llm-progress-indicators
**Date**: 2025-11-21
**Status**: Design Phase
**Reference**: spec.md, plan.md

---

## Overview

This document defines the data models for visual progress indicators and animations used to provide real-time feedback on LLM operations across the canvas. These models manage:

1. **ProgressIndicator** - Individual node-level operation state and progress
2. **AnimationConfig** - Global animation configuration and performance tuning
3. **AggregateStatus** - Dashboard-level summary of all active operations
4. **OperationSummary** - Individual operation details for dashboard display
5. **VisualTheme** - Styling and visual definitions for different states
6. **ProgressStore** - Zustand store schema for real-time state management

---

## Core Entities

### 1. ProgressIndicator

Represents the visual progress state and animation status for a single LLM operation on a node.

**Purpose**: Track operation state, progress metrics, and animation state for a node undergoing LLM processing.

**TypeScript Definition**:

```typescript
/**
 * Represents the progress state of an LLM operation on a node
 */
export type OperationStatus =
  | 'idle'       // No operation running
  | 'queued'     // Waiting due to concurrency limit
  | 'processing' // Request sent, waiting for first token
  | 'streaming'  // Receiving tokens from LLM
  | 'completed'  // Successfully finished
  | 'failed'     // Error occurred
  | 'cancelled'  // User cancelled
  | 'paused';    // Interrupted (e.g., network lost)

/**
 * Type of progress tracking for the operation
 */
export type ProgressType =
  | 'indeterminate' // Unknown progress (e.g., processing phase)
  | 'percentage'    // 0.0 to 1.0 (useful if length is estimable)
  | 'word_count'    // Absolute word count
  | 'elapsed_time'  // Seconds elapsed
  | 'token_count';  // Number of tokens received

/**
 * Current animation playback state
 */
export type AnimationState =
  | 'static'    // No animation (idle or reduced-motion)
  | 'spinning'  // Rotating spinner (processing)
  | 'pulsing'   // Opacity fade (pulsing border)
  | 'flowing'   // Animated gradient/dots (streaming)
  | 'bouncing'  // Scale bounce (completion/error)
  | 'paused';   // Suspended animation

/**
 * Core progress indicator for a node's LLM operation
 */
export interface ProgressIndicator {
  // Identity
  operation_id: UUID;          // Unique ID for this operation instance
  node_id: UUID;               // Which node this indicator belongs to

  // State
  status: OperationStatus;     // Current operation state
  error_message?: string;      // Error details if status='failed'
  queue_position?: number;     // Position in queue if status='queued'

  // Progress tracking
  progress_value: number;      // 0.0-1.0 (percentage), or word count, or elapsed seconds
  progress_type: ProgressType; // How to interpret progress_value
  total_words?: number;        // Total word count if known (for percentage calculation)

  // Animation
  animation_state: AnimationState;    // Current animation
  animation_start_time?: number;      // Timestamp when animation started (ms since epoch)
  animation_duration_ms?: number;     // How long this animation should run

  // Timestamps
  started_at: string;          // ISO 8601 when operation started
  updated_at: string;          // ISO 8601 when last updated
  completed_at?: string;       // ISO 8601 when operation finished

  // Metadata
  respects_reduced_motion: boolean;  // Whether prefers-reduced-motion is enabled
  retry_count: number;         // Number of retries attempted
  estimated_completion_ms?: number;  // Optional ETA (not reliable, best-effort)
}

/**
 * Validation Rules for ProgressIndicator:
 *
 * - operation_id: Must be unique UUID (never reuse IDs)
 * - node_id: Must reference existing node in graph
 * - status: Must be one of defined OperationStatus values
 * - queue_position: Only valid if status='queued', must be >= 1
 * - error_message: Only set if status='failed', max 500 characters
 * - progress_value:
 *   - If progress_type='percentage': must be 0.0 to 1.0
 *   - If progress_type='word_count' or 'token_count': must be >= 0
 *   - If progress_type='elapsed_time': must be >= 0 (seconds)
 *   - If progress_type='indeterminate': value is ignored
 * - total_words: Only set if progress_type='word_count', must be > progress_value
 * - animation_state: Must match status:
 *   - status='idle' → animation_state='static'
 *   - status='processing' → animation_state='spinning' or 'pulsing'
 *   - status='streaming' → animation_state='flowing'
 *   - status='completed' → animation_state='bouncing' then 'static'
 *   - status='failed' → animation_state='static' (error state)
 *   - status='queued' → animation_state='pulsing'
 *   - status='paused' → animation_state='paused'
 * - started_at and updated_at: Must be valid ISO 8601 timestamps
 * - started_at <= updated_at <= completed_at
 * - retry_count: Must be >= 0
```

**Relationships**:
- References exactly one Node (via node_id)
- Each operation instance is independent (separate ProgressIndicator per operation)
- Multiple ProgressIndicators can exist for same node if operations are sequential

**State Transition Diagram**:

```
                    ┌─────────────────────────────────────┐
                    │          IDLE (no operation)        │
                    │     animation_state: 'static'        │
                    └────────────────┬────────────────────┘
                                     │ User clicks "Ask LLM"
                                     ▼
                    ┌─────────────────────────────────────┐
                    │  PROCESSING (waiting for 1st token) │
                    │  animation_state: 'spinning'/'pulse'│
                    │        (100ms max latency)           │
                    └──┬─────────────────────────────────┬─┘
                       │                                 │
    Network error ◄────┘                                 └─────► First token received
         or timeout                                             │
            │                                                    ▼
            │                                    ┌────────────────────────────┐
            │                                    │    STREAMING (tokens flow) │
            │                                    │  animation_state: 'flowing'│
            │                                    │  progress: word count      │
            │                                    └──┬─────────────────────────┘
            │                                       │
            │     Interrupt/network loss            │ All tokens received
            │            │                          │ (final token received)
            │            ▼                          ▼
            │      ┌──────────────┐    ┌────────────────────────┐
            │      │    PAUSED    │    │     COMPLETED          │
            │      │  animation:  │    │ animation_state: 'bounce'
            │      │   'paused'   │    │ then 'static'          │
            │      └──┬───────────┘    └──┬─────────────────────┘
            │         │                   │
            │         └────► Resume ──────┘ (transitions to static)
            │              (auto or manual) │
            │                              │ Indicator remains visible
            │                              │ but non-distracting
            └──────────────────────┬───────┘
                                   │
                                   ▼
            ┌─────────────────────────────────────┐
            │  FAILED (error or timeout)          │
            │  animation_state: 'static'          │
            │  error_message: user-facing message │
            │  (shows red border + error icon)    │
            └─────────────────────────────────────┘
                         │ (never auto-dismiss)
                         ▼ (user must retry or close)

            ┌─────────────────────────────────────┐
            │   QUEUED (concurrency limit)        │
            │   animation_state: 'pulsing'        │
            │   queue_position: 2 of 5             │
            └──┬─────────────────────────────────┘
               │
               └────────────► PROCESSING (when slot opens)
                             (immediate transition)

            ┌─────────────────────────────────────┐
            │   CANCELLED (user stops operation)  │
            │   animation_state: 'static'         │
            │   (similar to failed, but not error)│
            └─────────────────────────────────────┘
```

**Invariants**:
1. Each operation must have unique operation_id (never reuse)
2. progress_value must always be <= total_words (if total_words known)
3. Animation state must be consistent with operation status
4. Once status reaches 'completed', 'failed', or 'cancelled', it never changes
5. Timestamps must be non-decreasing: started_at ≤ updated_at ≤ completed_at

---

### 2. AnimationConfig

Global configuration for animation behavior, performance, and accessibility.

**Purpose**: Centralize animation settings for consistent behavior across all indicators. Respects user accessibility preferences and performance constraints.

**TypeScript Definition**:

```typescript
/**
 * Easing functions for smooth animations
 */
export type EasingCurve =
  | 'linear'        // Linear progression
  | 'ease-in'       // Slow start, fast end
  | 'ease-out'      // Fast start, slow end (DEFAULT for state transitions)
  | 'ease-in-out'   // Smooth both ends
  | 'cubic-bezier'; // Custom bezier (would need additional params)

/**
 * Global animation configuration
 */
export interface AnimationConfig {
  // Performance & FPS
  animation_fps_target: number;     // Target 60 (typical) or 30 (low-end devices)
  frame_time_budget_ms: number;     // 16ms for 60fps, 33ms for 30fps

  // Timing (in milliseconds)
  transition_duration_ms: number;   // How long state transitions take (200-500ms)
  spinner_rotation_speed_rpm: number; // Rotation speed: 30-90 RPM typical
  pulse_frequency_hz: number;       // Pulsing: 1-2 Hz typical
  content_update_batch_ms: number;  // Batch UI updates: 50-100ms

  // Easing
  easing_curve: EasingCurve;        // Curve for transitions

  // Feature flags
  enable_animations: boolean;        // Globally enable/disable (respects prefers-reduced-motion)
  enable_gpu_acceleration: boolean;  // Use CSS transforms instead of JS
  enable_streaming_animation: boolean; // Show flowing/progress animation during streaming
  enable_completion_bounce: boolean;  // Show bounce animation on completion

  // Accessibility
  respects_prefers_reduced_motion: boolean; // Check prefers-reduced-motion on load
  respects_prefers_color_contrast: boolean; // Enhanced colors for low vision
  respects_prefers_dark_color_scheme: boolean; // Use dark theme colors

  // Performance optimization
  simplify_when_fps_below: number;   // Simplify animations if FPS < 30
  disable_non_critical_when_fps_below: number; // Disable pulsing/flowing if FPS < 20
  max_concurrent_animations: number; // Limit simultaneous animations (e.g., 20)

  // Off-screen optimization
  disable_off_screen_animations: boolean; // Don't render animations for off-screen nodes
  visibility_check_interval_ms: number;   // How often to check visibility (1000ms)
}

/**
 * Default AnimationConfig for typical hardware
 */
export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  animation_fps_target: 60,
  frame_time_budget_ms: 16,

  transition_duration_ms: 300,
  spinner_rotation_speed_rpm: 60,
  pulse_frequency_hz: 1.5,
  content_update_batch_ms: 50,

  easing_curve: 'ease-out',

  enable_animations: true,
  enable_gpu_acceleration: true,
  enable_streaming_animation: true,
  enable_completion_bounce: true,

  respects_prefers_reduced_motion: true,
  respects_prefers_color_contrast: false,
  respects_prefers_dark_color_scheme: false,

  simplify_when_fps_below: 30,
  disable_non_critical_when_fps_below: 20,
  max_concurrent_animations: 20,

  disable_off_screen_animations: true,
  visibility_check_interval_ms: 1000,
};

/**
 * Reduced-motion config: static indicators only
 */
export const REDUCED_MOTION_CONFIG: AnimationConfig = {
  ...DEFAULT_ANIMATION_CONFIG,
  enable_animations: false,
  enable_streaming_animation: false,
  enable_completion_bounce: false,
  transition_duration_ms: 0,
};

/**
 * Performance-constrained config: simplified animations
 */
export const LOW_PERFORMANCE_CONFIG: AnimationConfig = {
  ...DEFAULT_ANIMATION_CONFIG,
  animation_fps_target: 30,
  frame_time_budget_ms: 33,
  enable_streaming_animation: false,
  enable_completion_bounce: false,
  transition_duration_ms: 200,
  max_concurrent_animations: 10,
  disable_off_screen_animations: true,
};

/**
 * Validation Rules for AnimationConfig:
 *
 * - animation_fps_target: Must be 30, 60, or 120 (realistic values)
 * - frame_time_budget_ms: 1000 / fps (derived)
 * - transition_duration_ms: 100-500ms (too fast feels abrupt, too slow feels unresponsive)
 * - spinner_rotation_speed_rpm: 20-120 (too fast is distracting, too slow seems slow)
 * - pulse_frequency_hz: 0.5-3 (1-2 is standard, <0.5 is too slow, >3 is too fast)
 * - content_update_batch_ms: 16-100 (must not exceed frame budget)
 * - max_concurrent_animations: 1-50 (prevents UI thrashing)
 * - All timing values must be positive integers
```

**Constants & Derived Values**:

```typescript
// Derived calculations
export function getFrameTimeBudgetMs(config: AnimationConfig): number {
  return Math.round(1000 / config.animation_fps_target);
}

export function getSpinnerRotationDegreesPerFrame(config: AnimationConfig): number {
  const rotations_per_second = config.spinner_rotation_speed_rpm / 60;
  const degrees_per_second = rotations_per_second * 360;
  const frame_time_s = config.frame_time_budget_ms / 1000;
  return degrees_per_second * frame_time_s;
}

export function getPulsePeriodMs(config: AnimationConfig): number {
  return Math.round(1000 / config.pulse_frequency_hz);
}

// CSS animation string generation
export function getSpinnerCSSAnimation(config: AnimationConfig): string {
  const duration = (60 / config.spinner_rotation_speed_rpm);
  return `spin ${duration}s linear infinite`;
}

export function getPulseCSSAnimation(config: AnimationConfig): string {
  const period = 1000 / config.pulse_frequency_hz;
  return `pulse ${period}ms ease-in-out infinite`;
}
```

**Initialization**:
- Load on application startup
- Check `prefers-reduced-motion` media query and adjust `enable_animations`
- Measure frame rate and adjust `max_concurrent_animations` if needed
- Watch for performance drops and adapt config

---

### 3. AggregateStatus

Summary view of all active LLM operations across the canvas, used by the progress dashboard.

**Purpose**: Provide real-time aggregate statistics for the dashboard, enabling situational awareness of all concurrent operations.

**TypeScript Definition**:

```typescript
/**
 * Aggregate status of all active LLM operations
 */
export interface AggregateStatus {
  // Counts by state
  total_operations: number;        // Total active + completed + failed
  idle_count: number;              // Nodes with no operation
  queued_count: number;            // Waiting due to concurrency limit
  processing_count: number;        // Sent request, waiting for tokens
  streaming_count: number;         // Actively receiving tokens
  completed_count: number;         // Finished successfully
  failed_count: number;            // Error occurred
  cancelled_count: number;         // User cancelled
  paused_count: number;            // Interrupted (network, etc.)

  // Operations list
  operations: OperationSummary[];  // Array of individual operations (see below)

  // Timing
  total_elapsed_time_seconds: number;  // Sum of elapsed times for all operations
  oldest_operation_started_at?: string; // ISO 8601 of oldest active operation
  newest_operation_started_at?: string; // ISO 8601 of newest active operation

  // State tracking
  last_updated: string;            // ISO 8601 timestamp of last update
  update_count: number;            // How many times this aggregate has been updated

  // Metadata
  page_size: number;               // For pagination (default 20)
  total_pages: number;             // Total pages if paginated
  current_page: number;            // Current page index
}

/**
 * Computed properties/helper functions:
 */
export interface AggregateStatusComputed extends AggregateStatus {
  // Derived properties
  active_count: () => number;           // queued + processing + streaming
  finished_count: () => number;         // completed + failed + cancelled + paused
  success_rate: () => number;           // completed / (completed + failed)
  average_operation_duration: () => number; // total_elapsed_time / finished_count
  longest_operation_duration: () => number; // max elapsed time
}

/**
 * Validation Rules for AggregateStatus:
 *
 * - total_operations: Must equal sum of all counts
 *   total = idle + queued + processing + streaming + completed + failed + cancelled + paused
 * - All counts must be >= 0
 * - operations array length must equal active_count (only active operations listed)
 * - last_updated must be recent (within last 5 seconds in normal operation)
 * - oldest_operation_started_at <= newest_operation_started_at
 * - If no operations: all counts = 0, operations array = empty, all timestamps undefined
 * - page_size: 10-100 (reasonable pagination)
 * - current_page >= 0, current_page < total_pages
```

**Update Strategy**:
- Updated whenever any ProgressIndicator changes state
- Incremental updates (only modified operations sent over WebSocket/EventEmitter)
- Full rebuild every 10 seconds (safety check for consistency)
- Pruned: remove completed operations after 5 minutes (or configurable retention)

**Relationships**:
- Contains list of OperationSummary (see below)
- Aggregates multiple ProgressIndicator states
- Displayed in dashboard/sidebar panel

---

### 4. OperationSummary

Individual operation summary for dashboard display.

**Purpose**: Compact representation of a single operation for dashboard list/table view. Derived from ProgressIndicator, optimized for display.

**TypeScript Definition**:

```typescript
/**
 * Summary of individual operation for dashboard display
 */
export interface OperationSummary {
  // Identity
  operation_id: UUID;              // Link to ProgressIndicator
  node_id: UUID;                   // Link to Node

  // Display info
  node_title: string;              // Short title for node (first 50 chars of content)
  node_type: NodeType;             // Type of node (question, answer, etc.)
  node_preview: string;            // Preview of node content (first 100 chars)

  // State
  status: OperationStatus;         // Current status (from ProgressIndicator)

  // Progress
  progress_value: number;          // Current progress (word count, percentage, etc.)
  progress_type: ProgressType;     // How to interpret progress_value
  progress_percentage?: number;    // Always 0.0-1.0 (computed if needed)
  progress_display_text: string;   // Human-readable (e.g., "147 words", "12s elapsed")

  // Timing
  elapsed_time_seconds: number;    // How long operation has been running
  started_at: string;              // ISO 8601 when started
  completed_at?: string;           // ISO 8601 when finished (if completed)
  estimated_remaining_seconds?: number; // Rough estimate (not reliable)

  // Queue info (if queued)
  queue_position?: number;         // "3 of 5" position
  queue_size?: number;             // Total queued operations

  // Error info (if failed)
  error_message?: string;          // User-facing error message
  error_type?: string;             // Error category (timeout, rate-limit, network, etc.)
  retry_count: number;             // Number of retries
  can_retry: boolean;              // Whether retry is possible

  // UI hints
  icon: string;                    // Icon name/emoji for status
  color_class: string;             // CSS class for styling (e.g., 'status-processing')
  animation_class: string;         // CSS class for animation (e.g., 'animate-spin')
}

/**
 * Helper function to convert ProgressIndicator to OperationSummary:
 */
export function progressIndicatorToSummary(
  indicator: ProgressIndicator,
  nodeData: {title: string, type: NodeType, preview: string},
  config: AnimationConfig
): OperationSummary {
  const elapsed = (Date.now() - new Date(indicator.started_at).getTime()) / 1000;

  return {
    operation_id: indicator.operation_id,
    node_id: indicator.node_id,
    node_title: nodeData.title,
    node_type: nodeData.type,
    node_preview: nodeData.preview,
    status: indicator.status,
    progress_value: indicator.progress_value,
    progress_type: indicator.progress_type,
    progress_percentage: indicator.progress_type === 'percentage'
      ? indicator.progress_value
      : indicator.total_words
        ? indicator.progress_value / indicator.total_words
        : undefined,
    progress_display_text: formatProgressText(indicator),
    elapsed_time_seconds: elapsed,
    started_at: indicator.started_at,
    completed_at: indicator.completed_at,
    queue_position: indicator.queue_position,
    error_message: indicator.error_message,
    retry_count: indicator.retry_count,
    can_retry: indicator.status === 'failed' && indicator.retry_count < 3,
    icon: getStatusIcon(indicator.status),
    color_class: getStatusColorClass(indicator.status),
    animation_class: getAnimationClass(indicator.animation_state),
  };
}

/**
 * Validation Rules for OperationSummary:
 *
 * - operation_id: Must be unique
 * - node_title/node_preview: Max 100 chars
 * - progress_percentage: If set, must be 0.0-1.0
 * - elapsed_time_seconds: Must be >= 0
 * - started_at <= completed_at (if both present)
 * - queue_position: Only if status='queued'
 * - error_message/error_type: Only if status='failed'
 * - estimated_remaining_seconds: Must be > 0 if present (no negative estimates)
 * - retry_count must be >= 0
```

**Display Guidance**:

```typescript
function formatProgressText(indicator: ProgressIndicator): string {
  switch (indicator.progress_type) {
    case 'word_count':
      return `${Math.floor(indicator.progress_value)} words`;
    case 'elapsed_time':
      return `${indicator.progress_value}s elapsed`;
    case 'token_count':
      return `${Math.floor(indicator.progress_value)} tokens`;
    case 'percentage':
      return `${Math.round(indicator.progress_value * 100)}% complete`;
    case 'indeterminate':
    default:
      return 'Processing...';
  }
}

function getStatusIcon(status: OperationStatus): string {
  const icons: Record<OperationStatus, string> = {
    idle: '○',
    queued: '⏱',
    processing: '⟳',
    streaming: '→',
    completed: '✓',
    failed: '✗',
    cancelled: '⊘',
    paused: '⏸',
  };
  return icons[status];
}

function getStatusColorClass(status: OperationStatus): string {
  const colors: Record<OperationStatus, string> = {
    idle: 'status-idle',
    queued: 'status-queued',      // yellow/amber
    processing: 'status-processing', // blue
    streaming: 'status-streaming',   // blue (slightly brighter)
    completed: 'status-completed',   // green
    failed: 'status-failed',         // red
    cancelled: 'status-cancelled',   // gray
    paused: 'status-paused',         // orange/amber
  };
  return colors[status];
}
```

---

### 5. VisualTheme

Styling and visual definitions for different operation states.

**Purpose**: Centralize all visual styling (colors, borders, icons, animations) for each state. Enables consistent theming and easy customization.

**TypeScript Definition**:

```typescript
/**
 * Style definition for a single state
 */
export interface StateStyle {
  // Colors
  background_color?: string;        // Node background (CSS color)
  border_color: string;             // Node border (CSS color)
  border_width: number;             // Border thickness (1-4px)
  border_style: 'solid' | 'dashed' | 'dotted'; // Border style
  text_color: string;               // Text color
  accent_color: string;             // Secondary accent (for badges, icons)
  shadow_color?: string;            // Drop shadow color

  // Icons & indicators
  icon: string;                     // Icon/emoji name or path
  icon_color: string;               // Icon color (may differ from text)
  badge_text?: string;              // Optional badge text (e.g., "Queued", "Failed")
  badge_background?: string;        // Badge background color

  // Animation
  animation_name: string;           // CSS animation name (spin, pulse, flow, etc.)
  animation_duration_ms: number;    // Duration of animation loop
  animation_enabled: boolean;       // Whether animation plays for this state
  hover_animation?: string;         // Additional animation on hover

  // Effects
  pulse_opacity_min: number;        // Min opacity for pulsing (0.0-1.0)
  pulse_opacity_max: number;        // Max opacity for pulsing
  glow_enabled: boolean;            // Whether to show glow effect
  glow_blur_radius_px: number;      // Glow blur (0-10px)
}

/**
 * Complete visual theme for all states
 */
export interface VisualTheme {
  // Color scheme
  dark_mode: boolean;               // Whether dark theme is active

  // States
  idle_style: StateStyle;
  queued_style: StateStyle;
  processing_style: StateStyle;
  streaming_style: StateStyle;
  completed_style: StateStyle;
  failed_style: StateStyle;
  cancelled_style: StateStyle;
  paused_style: StateStyle;

  // Global overrides
  high_contrast_mode: boolean;      // Enhanced contrast for accessibility
  reduced_motion_mode: boolean;     // Disable animations

  // Hover/interaction effects
  hover_opacity_increase: number;   // How much to increase opacity on hover (0.0-0.3)
  focus_ring_color: string;         // Focus ring for keyboard navigation
  focus_ring_width: number;         // Focus ring thickness (1-3px)
}

/**
 * Default light theme
 */
export const LIGHT_THEME: VisualTheme = {
  dark_mode: false,

  idle_style: {
    background_color: '#FFFFFF',
    border_color: '#E0E0E0',
    border_width: 1,
    border_style: 'solid',
    text_color: '#424242',
    accent_color: '#757575',
    icon: '○',
    icon_color: '#9E9E9E',
    animation_name: 'none',
    animation_duration_ms: 0,
    animation_enabled: false,
    pulse_opacity_min: 1.0,
    pulse_opacity_max: 1.0,
    glow_enabled: false,
    glow_blur_radius_px: 0,
  },

  queued_style: {
    background_color: '#FFFCE3',
    border_color: '#FBC02D',
    border_width: 2,
    border_style: 'solid',
    text_color: '#F57F17',
    accent_color: '#FBC02D',
    badge_text: 'Queued',
    badge_background: '#FBC02D',
    icon: '⏱',
    icon_color: '#FBC02D',
    animation_name: 'pulse',
    animation_duration_ms: 2000,
    animation_enabled: true,
    pulse_opacity_min: 0.7,
    pulse_opacity_max: 1.0,
    glow_enabled: true,
    glow_blur_radius_px: 6,
  },

  processing_style: {
    background_color: '#E3F2FD',
    border_color: '#2196F3',
    border_width: 2,
    border_style: 'solid',
    text_color: '#1565C0',
    accent_color: '#2196F3',
    icon: '⟳',
    icon_color: '#2196F3',
    animation_name: 'spin',
    animation_duration_ms: 1000,
    animation_enabled: true,
    pulse_opacity_min: 1.0,
    pulse_opacity_max: 1.0,
    glow_enabled: true,
    glow_blur_radius_px: 4,
  },

  streaming_style: {
    background_color: '#E3F2FD',
    border_color: '#1976D2',
    border_width: 2,
    border_style: 'solid',
    text_color: '#1565C0',
    accent_color: '#42A5F5',
    icon: '→',
    icon_color: '#42A5F5',
    animation_name: 'flow',
    animation_duration_ms: 1500,
    animation_enabled: true,
    pulse_opacity_min: 0.8,
    pulse_opacity_max: 1.0,
    glow_enabled: true,
    glow_blur_radius_px: 5,
  },

  completed_style: {
    background_color: '#E8F5E9',
    border_color: '#4CAF50',
    border_width: 2,
    border_style: 'solid',
    text_color: '#2E7D32',
    accent_color: '#4CAF50',
    icon: '✓',
    icon_color: '#4CAF50',
    animation_name: 'none',
    animation_duration_ms: 0,
    animation_enabled: false,
    pulse_opacity_min: 1.0,
    pulse_opacity_max: 1.0,
    glow_enabled: false,
    glow_blur_radius_px: 0,
  },

  failed_style: {
    background_color: '#FFEBEE',
    border_color: '#F44336',
    border_width: 2,
    border_style: 'solid',
    text_color: '#C62828',
    accent_color: '#F44336',
    badge_text: 'Error',
    badge_background: '#F44336',
    icon: '✗',
    icon_color: '#F44336',
    animation_name: 'none',
    animation_duration_ms: 0,
    animation_enabled: false,
    pulse_opacity_min: 1.0,
    pulse_opacity_max: 1.0,
    glow_enabled: true,
    glow_blur_radius_px: 8,
  },

  cancelled_style: {
    background_color: '#F5F5F5',
    border_color: '#9E9E9E',
    border_width: 1,
    border_style: 'dashed',
    text_color: '#616161',
    accent_color: '#9E9E9E',
    icon: '⊘',
    icon_color: '#9E9E9E',
    animation_name: 'none',
    animation_duration_ms: 0,
    animation_enabled: false,
    pulse_opacity_min: 1.0,
    pulse_opacity_max: 1.0,
    glow_enabled: false,
    glow_blur_radius_px: 0,
  },

  paused_style: {
    background_color: '#FFF3E0',
    border_color: '#FF9800',
    border_width: 2,
    border_style: 'solid',
    text_color: '#E65100',
    accent_color: '#FF9800',
    icon: '⏸',
    icon_color: '#FF9800',
    animation_name: 'pulse',
    animation_duration_ms: 2500,
    animation_enabled: true,
    pulse_opacity_min: 0.6,
    pulse_opacity_max: 1.0,
    glow_enabled: true,
    glow_blur_radius_px: 4,
  },

  high_contrast_mode: false,
  reduced_motion_mode: false,
  hover_opacity_increase: 0.1,
  focus_ring_color: '#2196F3',
  focus_ring_width: 2,
};

/**
 * Dark theme variant
 */
export const DARK_THEME: VisualTheme = {
  ...LIGHT_THEME,
  dark_mode: true,
  // [Inverted colors for each state - similar structure, dark backgrounds]
  // Implementation details omitted for brevity
};

/**
 * High contrast theme for accessibility
 */
export const HIGH_CONTRAST_THEME: VisualTheme = {
  ...LIGHT_THEME,
  high_contrast_mode: true,
  // [All colors shifted to max contrast - strong borders, bold icons]
};

/**
 * Validation Rules for VisualTheme:
 *
 * - All CSS colors must be valid (hex, rgb, hsl, or named colors)
 * - border_width: 1-4px
 * - border_style: one of solid, dashed, dotted
 * - animation_duration_ms: 0-5000 (0 = no animation)
 * - pulse_opacity_min < pulse_opacity_max (both 0.0-1.0)
 * - glow_blur_radius_px: 0-15
 * - hover_opacity_increase: 0.0-0.5
 * - focus_ring_width: 1-4px
 * - Each state must have non-empty icon and valid icon_color
```

**CSS Animation Definitions**:

```css
/* Should be defined in corresponding CSS/Tailwind files */

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: var(--pulse-min); }
  50% { opacity: var(--pulse-max); }
}

@keyframes flow {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes bounce-complete {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
```

---

## Store Schema: Zustand Progress Store

Frontend state management using Zustand for real-time progress tracking.

**Purpose**: Centralized, reactive state management for all progress indicators and operations.

**TypeScript Definition**:

```typescript
/**
 * Zustand store for LLM operation progress tracking
 */
export interface ProgressStoreState {
  // Configuration
  animationConfig: AnimationConfig;
  visualTheme: VisualTheme;

  // Progress indicators (keyed by operation_id)
  indicators: Record<UUID, ProgressIndicator>;

  // Aggregate status
  aggregateStatus: AggregateStatus;

  // Dashboard/UI state
  dashboardOpen: boolean;
  dashboardCurrentPage: number;
  selectedOperationId?: UUID;  // Highlighted operation
  highlightedNodeId?: UUID;    // Node to highlight on canvas

  // Performance monitoring
  currentFps: number;          // Measured FPS
  activeAnimationCount: number; // Number of currently playing animations
}

export interface ProgressStoreActions {
  // Indicator management
  addIndicator(indicator: ProgressIndicator): void;
  updateIndicator(operationId: UUID, updates: Partial<ProgressIndicator>): void;
  removeIndicator(operationId: UUID): void;

  // Batch updates (for streaming multiple tokens)
  batchUpdateIndicators(updates: Array<{id: UUID, updates: Partial<ProgressIndicator>}>): void;

  // Status transitions
  setStatus(operationId: UUID, status: OperationStatus): void;
  setProgress(operationId: UUID, value: number, type: ProgressType): void;
  setAnimationState(operationId: UUID, animation: AnimationState): void;

  // Configuration
  setAnimationConfig(config: Partial<AnimationConfig>): void;
  setVisualTheme(theme: VisualTheme): void;

  // Dashboard
  toggleDashboard(): void;
  setDashboardPage(page: number): void;
  selectOperation(operationId: UUID): void;
  clearSelection(): void;

  // Aggregate state
  updateAggregateStatus(status: AggregateStatus): void;

  // Performance
  setCurrentFps(fps: number): void;
  setActiveAnimationCount(count: number): void;
}

export type ProgressStore = ProgressStoreState & ProgressStoreActions;

/**
 * Zustand store implementation
 */
export const useProgressStore = create<ProgressStore>((set, get) => ({
  // Initial state
  animationConfig: DEFAULT_ANIMATION_CONFIG,
  visualTheme: LIGHT_THEME,
  indicators: {},
  aggregateStatus: {
    total_operations: 0,
    idle_count: 0,
    queued_count: 0,
    processing_count: 0,
    streaming_count: 0,
    completed_count: 0,
    failed_count: 0,
    cancelled_count: 0,
    paused_count: 0,
    operations: [],
    total_elapsed_time_seconds: 0,
    last_updated: new Date().toISOString(),
    update_count: 0,
    page_size: 20,
    total_pages: 0,
    current_page: 0,
  },
  dashboardOpen: false,
  dashboardCurrentPage: 0,
  currentFps: 60,
  activeAnimationCount: 0,

  // Actions
  addIndicator: (indicator) =>
    set((state) => ({
      indicators: {
        ...state.indicators,
        [indicator.operation_id]: indicator,
      },
    })),

  updateIndicator: (operationId, updates) =>
    set((state) => ({
      indicators: {
        ...state.indicators,
        [operationId]: {
          ...state.indicators[operationId],
          ...updates,
          updated_at: new Date().toISOString(),
        },
      },
    })),

  removeIndicator: (operationId) =>
    set((state) => {
      const {[operationId]: _, ...rest} = state.indicators;
      return {indicators: rest};
    }),

  batchUpdateIndicators: (updates) =>
    set((state) => {
      const newIndicators = {...state.indicators};
      const now = new Date().toISOString();

      updates.forEach(({id, updates: upserts}) => {
        if (newIndicators[id]) {
          newIndicators[id] = {
            ...newIndicators[id],
            ...upserts,
            updated_at: now,
          };
        }
      });

      return {indicators: newIndicators};
    }),

  setStatus: (operationId, status) =>
    get().updateIndicator(operationId, {status}),

  setProgress: (operationId, value, type) =>
    get().updateIndicator(operationId, {
      progress_value: value,
      progress_type: type,
    }),

  setAnimationState: (operationId, animation) =>
    get().updateIndicator(operationId, {
      animation_state: animation,
    }),

  setAnimationConfig: (config) =>
    set((state) => ({
      animationConfig: {...state.animationConfig, ...config},
    })),

  setVisualTheme: (theme) => set({visualTheme: theme}),

  toggleDashboard: () =>
    set((state) => ({dashboardOpen: !state.dashboardOpen})),

  setDashboardPage: (page) => set({dashboardCurrentPage: page}),

  selectOperation: (operationId) => set({selectedOperationId: operationId}),

  clearSelection: () => set({selectedOperationId: undefined}),

  updateAggregateStatus: (status) => set({aggregateStatus: status}),

  setCurrentFps: (fps) => set({currentFps: fps}),

  setActiveAnimationCount: (count) => set({activeAnimationCount: count}),
}));

/**
 * Optimized selectors to prevent unnecessary re-renders
 */
export const progressSelectors = {
  // Single indicator
  selectIndicator: (operationId: UUID) =>
    (state: ProgressStore) => state.indicators[operationId],

  // All indicators for a node
  selectNodeIndicators: (nodeId: UUID) =>
    (state: ProgressStore) =>
      Object.values(state.indicators).filter(i => i.node_id === nodeId),

  // Active indicators only (not completed/failed)
  selectActiveIndicators: () =>
    (state: ProgressStore) =>
      Object.values(state.indicators).filter(i =>
        !['idle', 'completed', 'failed', 'cancelled'].includes(i.status)
      ),

  // Dashboard operations
  selectDashboardOperations: () =>
    (state: ProgressStore) => state.aggregateStatus.operations,

  // Animation config
  selectAnimationConfig: () => (state: ProgressStore) => state.animationConfig,

  // Visual theme
  selectVisualTheme: () => (state: ProgressStore) => state.visualTheme,

  // Dashboard state
  selectDashboardOpen: () => (state: ProgressStore) => state.dashboardOpen,
};

/**
 * Usage in React components:
 *
 * const indicator = useProgressStore(progressSelectors.selectIndicator(opId));
 * const activeOps = useProgressStore(progressSelectors.selectActiveIndicators());
 * const theme = useProgressStore(progressSelectors.selectVisualTheme());
```

---

## State Transitions & Valid Sequences

### Valid State Transitions

```
State Flow Rules:
┌────────────────────────────────────────────────────────────┐
│ IDLE (start state)                                         │
│ → PROCESSING (when LLM request initiated)                 │
│ → QUEUED (if concurrency limit reached)                   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ QUEUED                                                     │
│ → PROCESSING (when queue slot opens)                      │
│ → CANCELLED (user cancels while queued)                   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ PROCESSING                                                 │
│ → STREAMING (first token received)                        │
│ → FAILED (error during initial request)                   │
│ → CANCELLED (user cancels during processing)              │
│ → PAUSED (network loss)                                   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ STREAMING                                                  │
│ → COMPLETED (final token received)                        │
│ → FAILED (error during streaming)                         │
│ → CANCELLED (user cancels during streaming)               │
│ → PAUSED (network loss)                                   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ PAUSED                                                     │
│ → STREAMING (connection restored, resume receiving)       │
│ → CANCELLED (user gives up)                               │
│ → FAILED (timeout exceeded)                               │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ COMPLETED (terminal state)                                │
│ (never changes, persists in history)                      │
│ User can: retry (creates NEW operation), archive, delete  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ FAILED (terminal state)                                   │
│ User can: retry (creates NEW operation), dismiss, inspect │
│ error message                                             │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ CANCELLED (terminal state)                                │
│ Can retry, but treated as user-initiated abort           │
└────────────────────────────────────────────────────────────┘
```

### Invalid Transitions (Guard Rules)

```typescript
/**
 * Guard function to validate state transitions
 */
export function isValidStateTransition(
  currentStatus: OperationStatus,
  newStatus: OperationStatus
): boolean {
  const validTransitions: Record<OperationStatus, OperationStatus[]> = {
    'idle': ['processing', 'queued'],
    'queued': ['processing', 'cancelled'],
    'processing': ['streaming', 'failed', 'cancelled', 'paused'],
    'streaming': ['completed', 'failed', 'cancelled', 'paused'],
    'completed': [],  // Terminal
    'failed': [],     // Terminal (user must retry → new operation)
    'cancelled': [],  // Terminal
    'paused': ['streaming', 'cancelled', 'failed'],
  };

  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Guard function for animation state consistency
 */
export function isValidAnimationForStatus(
  status: OperationStatus,
  animation: AnimationState
): boolean {
  const validAnimations: Record<OperationStatus, AnimationState[]> = {
    'idle': ['static'],
    'queued': ['pulsing', 'static'],
    'processing': ['spinning', 'pulsing'],
    'streaming': ['flowing', 'spinning'],
    'completed': ['bouncing', 'static'],
    'failed': ['static'],
    'cancelled': ['static'],
    'paused': ['paused', 'static'],
  };

  return validAnimations[status]?.includes(animation) ?? false;
}
```

### Event Triggers

```typescript
/**
 * Events that trigger state transitions
 */
export type ProgressEvent =
  | {type: 'request_initiated', operation_id: UUID, node_id: UUID}
  | {type: 'request_queued', operation_id: UUID, queue_position: number}
  | {type: 'first_token_received', operation_id: UUID}
  | {type: 'token_received', operation_id: UUID, token_count: number, word_count: number}
  | {type: 'final_token_received', operation_id: UUID, total_words: number}
  | {type: 'operation_failed', operation_id: UUID, error: string}
  | {type: 'operation_cancelled', operation_id: UUID}
  | {type: 'operation_paused', operation_id: UUID}
  | {type: 'operation_resumed', operation_id: UUID}
  | {type: 'operation_retried', operation_id: UUID, retry_count: number}
  | {type: 'connection_lost', affected_operation_ids: UUID[]}
  | {type: 'connection_restored'};

/**
 * Event handler dispatcher (in reducer pattern or saga)
 */
export function handleProgressEvent(
  event: ProgressEvent,
  currentIndicator: ProgressIndicator,
  config: AnimationConfig
): Partial<ProgressIndicator> {
  switch (event.type) {
    case 'request_initiated':
      return {
        status: 'processing',
        animation_state: config.enable_animations ? 'spinning' : 'static',
        animation_start_time: Date.now(),
      };

    case 'first_token_received':
      return {
        status: 'streaming',
        animation_state: config.enable_animations ? 'flowing' : 'static',
        progress_value: 0,
        progress_type: 'word_count',
      };

    case 'token_received':
      return {
        progress_value: event.word_count,
      };

    case 'final_token_received':
      return {
        status: 'completed',
        animation_state: config.enable_animations ? 'bouncing' : 'static',
        progress_value: event.total_words,
        completed_at: new Date().toISOString(),
      };

    case 'operation_failed':
      return {
        status: 'failed',
        animation_state: 'static',
        error_message: event.error,
        completed_at: new Date().toISOString(),
      };

    case 'operation_paused':
      return {
        status: 'paused',
        animation_state: 'paused',
      };

    case 'operation_resumed':
      return {
        status: 'streaming',
        animation_state: config.enable_animations ? 'flowing' : 'static',
      };

    default:
      return {};
  }
}
```

---

## Performance Considerations

### Update Batching Strategy

To maintain 60fps with 10+ concurrent operations:

```typescript
/**
 * Batch token updates to prevent UI thrashing
 */
export class ProgressUpdateBatcher {
  private pendingUpdates: Map<UUID, Partial<ProgressIndicator>> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private flushIntervalMs: number;

  constructor(
    private store: ProgressStore,
    flushIntervalMs: number = 50 // Flush every 50ms
  ) {
    this.flushIntervalMs = flushIntervalMs;
  }

  addUpdate(operationId: UUID, update: Partial<ProgressIndicator>): void {
    if (!this.pendingUpdates.has(operationId)) {
      this.pendingUpdates.set(operationId, {});
    }

    const current = this.pendingUpdates.get(operationId)!;
    this.pendingUpdates.set(operationId, {...current, ...update});

    if (!this.flushTimer) {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
  }

  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.pendingUpdates.size === 0) {
      return;
    }

    const updates = Array.from(this.pendingUpdates.entries()).map(
      ([id, update]) => ({id, updates: update})
    );

    this.store.batchUpdateIndicators(updates);
    this.pendingUpdates.clear();
  }

  destroy(): void {
    this.flush();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
  }
}
```

### Memory Management

```typescript
/**
 * Archive old indicators to prevent memory bloat
 */
export interface ProgressStore {
  // ... existing ...
  archiveCompleted(retentionMs?: number): void;
  clearArchive(): void;
}

// Implementation: Keep completed operations for 5 minutes, then remove
// This prevents unbounded growth while allowing quick reference
```

### Selector Memoization

Use Zustand selectors to prevent unnecessary re-renders:

```typescript
// ✓ Good: Only re-renders when this indicator changes
const indicator = useProgressStore(
  state => state.indicators[operationId],
  (prev, next) => prev === next
);

// ✓ Good: Memoized selector for active indicators
const activeCount = useProgressStore(
  state => Object.values(state.indicators).filter(
    i => !['completed', 'failed', 'cancelled'].includes(i.status)
  ).length
);

// ✗ Avoid: Creates new object every render
const indicators = useProgressStore(state => ({
  active: Object.values(state.indicators).filter(...),
  failed: Object.values(state.indicators).filter(...),
}));
```

---

## Accessibility & Inclusive Design

### Screen Reader Announcements

Each state change should be announced:

```typescript
/**
 * Generate ARIA-live announcements for state changes
 */
export function getAriaLiveAnnouncement(
  status: OperationStatus,
  nodeName: string,
  progress?: string
): string {
  const announcements: Record<OperationStatus, string> = {
    'idle': '',  // No announcement for idle
    'queued': `${nodeName}: Queued for processing`,
    'processing': `${nodeName}: Processing started`,
    'streaming': `${nodeName}: Receiving response, ${progress || 'processing'}`,
    'completed': `${nodeName}: Completed successfully`,
    'failed': `${nodeName}: Failed with error`,
    'cancelled': `${nodeName}: Operation cancelled`,
    'paused': `${nodeName}: Operation paused, attempting to resume`,
  };
  return announcements[status];
}
```

### Reduced Motion Support

```typescript
/**
 * Check for prefers-reduced-motion on load
 */
export function detectReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function setupReducedMotionListener(
  store: ProgressStore
): () => void {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const handleChange = (e: MediaQueryListEvent) => {
    if (e.matches) {
      store.setAnimationConfig(REDUCED_MOTION_CONFIG);
    } else {
      store.setAnimationConfig(DEFAULT_ANIMATION_CONFIG);
    }
  };

  mediaQuery.addEventListener('change', handleChange);

  return () => mediaQuery.removeEventListener('change', handleChange);
}
```

---

## Contracts & API Boundaries

### API Endpoints for Progress

```typescript
/**
 * WebSocket messages from backend for streaming operations
 */
export interface StreamingMessage {
  operation_id: UUID;
  type: 'token' | 'error' | 'complete' | 'heartbeat';

  // For type='token'
  token?: string;
  word_count?: number;

  // For type='error'
  error?: string;

  // For type='complete'
  total_words?: number;

  // Timing
  timestamp: string;  // ISO 8601
}

/**
 * REST endpoints
 * GET /api/operations/{operation_id}  - Get current indicator state
 * GET /api/operations/node/{node_id}  - Get all operations for a node
 * GET /api/operations/active - Get list of active operations
 * POST /api/operations/{operation_id}/retry - Retry failed operation
 * POST /api/operations/{operation_id}/cancel - Cancel operation
 * DELETE /api/operations/{operation_id} - Remove operation
```

---

## Validation & Error Handling

### Data Validation

```typescript
/**
 * Validate ProgressIndicator before storing
 */
export function validateProgressIndicator(
  indicator: ProgressIndicator
): {valid: boolean; errors: string[]} {
  const errors: string[] = [];

  if (!indicator.operation_id) errors.push('operation_id required');
  if (!indicator.node_id) errors.push('node_id required');
  if (!indicator.status) errors.push('status required');

  if (!isValidAnimationForStatus(indicator.status, indicator.animation_state)) {
    errors.push(
      `animation_state '${indicator.animation_state}' invalid for status '${indicator.status}'`
    );
  }

  if (indicator.progress_type === 'percentage' &&
      (indicator.progress_value < 0 || indicator.progress_value > 1)) {
    errors.push('progress_value must be 0.0-1.0 for percentage type');
  }

  if (indicator.status === 'queued' && !indicator.queue_position) {
    errors.push('queue_position required when status=queued');
  }

  if (indicator.status === 'failed' && !indicator.error_message) {
    errors.push('error_message required when status=failed');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## Data Model Complete

This data model provides:

1. **ProgressIndicator** - Individual operation state tracking
2. **AnimationConfig** - Centralized animation configuration with accessibility support
3. **AggregateStatus** - Dashboard-level operation summary
4. **OperationSummary** - Individual operation display data
5. **VisualTheme** - Complete styling definitions for all states
6. **ProgressStore (Zustand)** - Reactive state management with optimized selectors
7. **State Transitions** - Valid state flows and event handling
8. **Performance** - Batching, memoization, and memory management strategies
9. **Accessibility** - ARIA announcements and reduced-motion support
10. **API Contracts** - WebSocket and REST boundaries

Ready for implementation and component development.
