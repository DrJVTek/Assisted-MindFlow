/**
 * Store Interface Contract for Progress Indicators
 * Zustand store interface specification for LLM progress tracking
 * Feature: 008-llm-progress-indicators
 * Date: 2025-11-21
 *
 * This file defines the TypeScript interfaces that the Zustand store must implement.
 * It serves as a contract between different parts of the application.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * UUID type alias for type safety
 */
export type UUID = string & { readonly __brand: 'UUID' };

/**
 * Operation status enumeration
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
 * Easing functions for smooth animations
 */
export type EasingCurve =
  | 'linear'        // Linear progression
  | 'ease-in'       // Slow start, fast end
  | 'ease-out'      // Fast start, slow end (DEFAULT)
  | 'ease-in-out'   // Smooth both ends
  | 'cubic-bezier'; // Custom bezier

/**
 * Node type identifier
 */
export type NodeType =
  | 'question'
  | 'answer'
  | 'note'
  | 'group'
  | 'comment';

// ============================================================================
// CORE DATA MODELS
// ============================================================================

/**
 * Represents the progress state of an LLM operation on a node
 *
 * @property operation_id - Unique ID for this operation instance
 * @property node_id - Which node this indicator belongs to
 * @property status - Current operation state
 * @property error_message - Error details if status='failed'
 * @property queue_position - Position in queue if status='queued'
 * @property progress_value - 0.0-1.0 (percentage), or word count, or elapsed seconds
 * @property progress_type - How to interpret progress_value
 * @property total_words - Total word count if known
 * @property animation_state - Current animation
 * @property animation_start_time - When animation started (ms since epoch)
 * @property animation_duration_ms - How long animation should run
 * @property started_at - ISO 8601 when operation started
 * @property updated_at - ISO 8601 when last updated
 * @property completed_at - ISO 8601 when operation finished
 * @property respects_reduced_motion - Whether prefers-reduced-motion is enabled
 * @property retry_count - Number of retries attempted
 * @property estimated_completion_ms - Optional ETA (not reliable, best-effort)
 */
export interface ProgressIndicator {
  operation_id: UUID;
  node_id: UUID;

  status: OperationStatus;
  error_message?: string;
  queue_position?: number;

  progress_value: number;
  progress_type: ProgressType;
  total_words?: number;

  animation_state: AnimationState;
  animation_start_time?: number;
  animation_duration_ms?: number;

  started_at: string;
  updated_at: string;
  completed_at?: string;

  respects_reduced_motion: boolean;
  retry_count: number;
  estimated_completion_ms?: number;
}

/**
 * Global configuration for animation behavior, performance, and accessibility
 *
 * @property animation_fps_target - Target 60 (typical) or 30 (low-end devices)
 * @property frame_time_budget_ms - 16ms for 60fps, 33ms for 30fps
 * @property transition_duration_ms - How long state transitions take (200-500ms)
 * @property spinner_rotation_speed_rpm - Rotation speed: 30-90 RPM typical
 * @property pulse_frequency_hz - Pulsing: 1-2 Hz typical
 * @property content_update_batch_ms - Batch UI updates: 50-100ms
 * @property easing_curve - Curve for transitions
 * @property enable_animations - Globally enable/disable (respects prefers-reduced-motion)
 * @property enable_gpu_acceleration - Use CSS transforms instead of JS
 * @property enable_streaming_animation - Show flowing/progress animation during streaming
 * @property enable_completion_bounce - Show bounce animation on completion
 * @property respects_prefers_reduced_motion - Check prefers-reduced-motion on load
 * @property respects_prefers_color_contrast - Enhanced colors for low vision
 * @property respects_prefers_dark_color_scheme - Use dark theme colors
 * @property simplify_when_fps_below - Simplify animations if FPS < 30
 * @property disable_non_critical_when_fps_below - Disable pulsing/flowing if FPS < 20
 * @property max_concurrent_animations - Limit simultaneous animations
 * @property disable_off_screen_animations - Don't render animations for off-screen nodes
 * @property visibility_check_interval_ms - How often to check visibility
 */
export interface AnimationConfig {
  animation_fps_target: number;
  frame_time_budget_ms: number;

  transition_duration_ms: number;
  spinner_rotation_speed_rpm: number;
  pulse_frequency_hz: number;
  content_update_batch_ms: number;

  easing_curve: EasingCurve;

  enable_animations: boolean;
  enable_gpu_acceleration: boolean;
  enable_streaming_animation: boolean;
  enable_completion_bounce: boolean;

  respects_prefers_reduced_motion: boolean;
  respects_prefers_color_contrast: boolean;
  respects_prefers_dark_color_scheme: boolean;

  simplify_when_fps_below: number;
  disable_non_critical_when_fps_below: number;
  max_concurrent_animations: number;

  disable_off_screen_animations: boolean;
  visibility_check_interval_ms: number;
}

/**
 * Style definition for a single state
 *
 * @property background_color - Node background (CSS color)
 * @property border_color - Node border (CSS color)
 * @property border_width - Border thickness (1-4px)
 * @property border_style - Border style (solid, dashed, dotted)
 * @property text_color - Text color
 * @property accent_color - Secondary accent (for badges, icons)
 * @property shadow_color - Drop shadow color
 * @property icon - Icon/emoji name or path
 * @property icon_color - Icon color
 * @property badge_text - Optional badge text
 * @property badge_background - Badge background color
 * @property animation_name - CSS animation name
 * @property animation_duration_ms - Duration of animation loop
 * @property animation_enabled - Whether animation plays for this state
 * @property hover_animation - Additional animation on hover
 * @property pulse_opacity_min - Min opacity for pulsing
 * @property pulse_opacity_max - Max opacity for pulsing
 * @property glow_enabled - Whether to show glow effect
 * @property glow_blur_radius_px - Glow blur (0-10px)
 */
export interface StateStyle {
  background_color?: string;
  border_color: string;
  border_width: number;
  border_style: 'solid' | 'dashed' | 'dotted';
  text_color: string;
  accent_color: string;
  shadow_color?: string;

  icon: string;
  icon_color: string;
  badge_text?: string;
  badge_background?: string;

  animation_name: string;
  animation_duration_ms: number;
  animation_enabled: boolean;
  hover_animation?: string;

  pulse_opacity_min: number;
  pulse_opacity_max: number;
  glow_enabled: boolean;
  glow_blur_radius_px: number;
}

/**
 * Complete visual theme for all states
 *
 * @property dark_mode - Whether dark theme is active
 * @property idle_style - Styling for idle state
 * @property queued_style - Styling for queued state
 * @property processing_style - Styling for processing state
 * @property streaming_style - Styling for streaming state
 * @property completed_style - Styling for completed state
 * @property failed_style - Styling for failed state
 * @property cancelled_style - Styling for cancelled state
 * @property paused_style - Styling for paused state
 * @property high_contrast_mode - Enhanced contrast for accessibility
 * @property reduced_motion_mode - Disable animations
 * @property hover_opacity_increase - How much to increase opacity on hover
 * @property focus_ring_color - Focus ring for keyboard navigation
 * @property focus_ring_width - Focus ring thickness
 */
export interface VisualTheme {
  dark_mode: boolean;

  idle_style: StateStyle;
  queued_style: StateStyle;
  processing_style: StateStyle;
  streaming_style: StateStyle;
  completed_style: StateStyle;
  failed_style: StateStyle;
  cancelled_style: StateStyle;
  paused_style: StateStyle;

  high_contrast_mode: boolean;
  reduced_motion_mode: boolean;

  hover_opacity_increase: number;
  focus_ring_color: string;
  focus_ring_width: number;
}

/**
 * Summary of individual operation for dashboard display
 *
 * @property operation_id - Link to ProgressIndicator
 * @property node_id - Link to Node
 * @property node_title - Short title for node
 * @property node_type - Type of node
 * @property node_preview - Preview of node content
 * @property status - Current status
 * @property progress_value - Current progress
 * @property progress_type - How to interpret progress_value
 * @property progress_percentage - Always 0.0-1.0
 * @property progress_display_text - Human-readable progress
 * @property elapsed_time_seconds - How long operation running
 * @property started_at - ISO 8601 when started
 * @property completed_at - ISO 8601 when finished
 * @property estimated_remaining_seconds - Rough estimate
 * @property queue_position - Position in queue if queued
 * @property queue_size - Total queued operations
 * @property error_message - User-facing error message
 * @property error_type - Error category
 * @property retry_count - Number of retries
 * @property can_retry - Whether retry is possible
 * @property icon - Icon name/emoji for status
 * @property color_class - CSS class for styling
 * @property animation_class - CSS class for animation
 */
export interface OperationSummary {
  operation_id: UUID;
  node_id: UUID;

  node_title: string;
  node_type: NodeType;
  node_preview: string;

  status: OperationStatus;

  progress_value: number;
  progress_type: ProgressType;
  progress_percentage?: number;
  progress_display_text: string;

  elapsed_time_seconds: number;
  started_at: string;
  completed_at?: string;
  estimated_remaining_seconds?: number;

  queue_position?: number;
  queue_size?: number;

  error_message?: string;
  error_type?: string;
  retry_count: number;
  can_retry: boolean;

  icon: string;
  color_class: string;
  animation_class: string;
}

/**
 * Aggregate status of all active LLM operations
 *
 * @property total_operations - Total active + completed + failed
 * @property idle_count - Nodes with no operation
 * @property queued_count - Waiting due to concurrency limit
 * @property processing_count - Sent request, waiting for tokens
 * @property streaming_count - Actively receiving tokens
 * @property completed_count - Finished successfully
 * @property failed_count - Error occurred
 * @property cancelled_count - User cancelled
 * @property paused_count - Interrupted
 * @property operations - Array of individual operations
 * @property total_elapsed_time_seconds - Sum of elapsed times
 * @property oldest_operation_started_at - ISO 8601 of oldest active operation
 * @property newest_operation_started_at - ISO 8601 of newest active operation
 * @property last_updated - ISO 8601 timestamp of last update
 * @property update_count - How many times aggregate updated
 * @property page_size - For pagination
 * @property total_pages - Total pages if paginated
 * @property current_page - Current page index
 */
export interface AggregateStatus {
  total_operations: number;
  idle_count: number;
  queued_count: number;
  processing_count: number;
  streaming_count: number;
  completed_count: number;
  failed_count: number;
  cancelled_count: number;
  paused_count: number;

  operations: OperationSummary[];

  total_elapsed_time_seconds: number;
  oldest_operation_started_at?: string;
  newest_operation_started_at?: string;

  last_updated: string;
  update_count: number;

  page_size: number;
  total_pages: number;
  current_page: number;
}

// ============================================================================
// ZUSTAND STORE INTERFACE
// ============================================================================

/**
 * State portion of the Progress Store
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
  selectedOperationId?: UUID;
  highlightedNodeId?: UUID;

  // Performance monitoring
  currentFps: number;
  activeAnimationCount: number;
}

/**
 * Actions portion of the Progress Store
 */
export interface ProgressStoreActions {
  // Indicator management
  /**
   * Add a new progress indicator
   */
  addIndicator(indicator: ProgressIndicator): void;

  /**
   * Update an existing indicator with partial updates
   */
  updateIndicator(operationId: UUID, updates: Partial<ProgressIndicator>): void;

  /**
   * Remove an indicator from store
   */
  removeIndicator(operationId: UUID): void;

  /**
   * Batch update multiple indicators (for streaming tokens)
   */
  batchUpdateIndicators(
    updates: Array<{ id: UUID; updates: Partial<ProgressIndicator> }>
  ): void;

  // Status transitions
  /**
   * Set operation status
   */
  setStatus(operationId: UUID, status: OperationStatus): void;

  /**
   * Set progress value and type
   */
  setProgress(operationId: UUID, value: number, type: ProgressType): void;

  /**
   * Set animation state
   */
  setAnimationState(operationId: UUID, animation: AnimationState): void;

  // Configuration
  /**
   * Update animation configuration
   */
  setAnimationConfig(config: Partial<AnimationConfig>): void;

  /**
   * Set visual theme
   */
  setVisualTheme(theme: VisualTheme): void;

  // Dashboard
  /**
   * Toggle dashboard open/closed
   */
  toggleDashboard(): void;

  /**
   * Set current dashboard page
   */
  setDashboardPage(page: number): void;

  /**
   * Select an operation in dashboard
   */
  selectOperation(operationId: UUID): void;

  /**
   * Clear operation selection
   */
  clearSelection(): void;

  // Aggregate state
  /**
   * Update aggregate status (usually from backend)
   */
  updateAggregateStatus(status: AggregateStatus): void;

  // Performance
  /**
   * Set measured FPS
   */
  setCurrentFps(fps: number): void;

  /**
   * Set number of active animations
   */
  setActiveAnimationCount(count: number): void;
}

/**
 * Complete Progress Store type combining state and actions
 */
export type ProgressStore = ProgressStoreState & ProgressStoreActions;

// ============================================================================
// SELECTOR FUNCTIONS (For Optimized Re-renders)
// ============================================================================

/**
 * Optimized selectors to prevent unnecessary re-renders
 * These should be used with useProgressStore like:
 *
 * const indicator = useProgressStore(progressSelectors.selectIndicator(opId));
 */
export const progressSelectors = {
  /**
   * Select single indicator by operation ID
   */
  selectIndicator: (operationId: UUID) =>
    (state: ProgressStore) => state.indicators[operationId],

  /**
   * Select all indicators for a specific node
   */
  selectNodeIndicators: (nodeId: UUID) =>
    (state: ProgressStore) =>
      Object.values(state.indicators).filter((i) => i.node_id === nodeId),

  /**
   * Select only active indicators (not completed/failed/cancelled)
   */
  selectActiveIndicators: () =>
    (state: ProgressStore) =>
      Object.values(state.indicators).filter(
        (i) => !['idle', 'completed', 'failed', 'cancelled'].includes(i.status)
      ),

  /**
   * Select streaming indicators only
   */
  selectStreamingIndicators: () =>
    (state: ProgressStore) =>
      Object.values(state.indicators).filter((i) => i.status === 'streaming'),

  /**
   * Select failed indicators only
   */
  selectFailedIndicators: () =>
    (state: ProgressStore) =>
      Object.values(state.indicators).filter((i) => i.status === 'failed'),

  /**
   * Select queued indicators only
   */
  selectQueuedIndicators: () =>
    (state: ProgressStore) =>
      Object.values(state.indicators).filter((i) => i.status === 'queued'),

  /**
   * Get count of active operations
   */
  selectActiveCount: () =>
    (state: ProgressStore) =>
      Object.values(state.indicators).filter(
        (i) => !['idle', 'completed', 'failed', 'cancelled'].includes(i.status)
      ).length,

  /**
   * Select operations for dashboard display
   */
  selectDashboardOperations: () =>
    (state: ProgressStore) => state.aggregateStatus.operations,

  /**
   * Select animation configuration
   */
  selectAnimationConfig: () =>
    (state: ProgressStore) => state.animationConfig,

  /**
   * Select visual theme
   */
  selectVisualTheme: () =>
    (state: ProgressStore) => state.visualTheme,

  /**
   * Select dashboard open state
   */
  selectDashboardOpen: () =>
    (state: ProgressStore) => state.dashboardOpen,

  /**
   * Select aggregate status
   */
  selectAggregateStatus: () =>
    (state: ProgressStore) => state.aggregateStatus,

  /**
   * Select performance metrics
   */
  selectPerformanceMetrics: () =>
    (state: ProgressStore) => ({
      currentFps: state.currentFps,
      activeAnimationCount: state.activeAnimationCount,
    }),
};

// ============================================================================
// STORE FACTORY
// ============================================================================

/**
 * Factory function to create the Zustand store
 * Should be implemented by store file, not here
 *
 * Usage example:
 * ```typescript
 * export const useProgressStore = createProgressStore();
 * ```
 */
export type CreateProgressStore = () => (
  selector?: (state: ProgressStore) => any,
  equalityFn?: (a: any, b: any) => boolean
) => any;

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Default animation configuration
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
 * Reduced-motion configuration (no animations)
 */
export const REDUCED_MOTION_CONFIG: AnimationConfig = {
  ...DEFAULT_ANIMATION_CONFIG,
  enable_animations: false,
  enable_streaming_animation: false,
  enable_completion_bounce: false,
  transition_duration_ms: 0,
};

/**
 * Low-performance configuration (simplified animations)
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
 * Initial aggregate status
 */
export const INITIAL_AGGREGATE_STATUS: AggregateStatus = {
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
};

/**
 * Initial store state
 */
export const INITIAL_STORE_STATE: ProgressStoreState = {
  animationConfig: DEFAULT_ANIMATION_CONFIG,
  visualTheme: {} as VisualTheme, // Will be imported from theme module
  indicators: {},
  aggregateStatus: INITIAL_AGGREGATE_STATUS,
  dashboardOpen: false,
  dashboardCurrentPage: 0,
  currentFps: 60,
  activeAnimationCount: 0,
};

// ============================================================================
// HELPER TYPES & UTILITIES
// ============================================================================

/**
 * Options for creating/configuring the store
 */
export interface ProgressStoreOptions {
  enableAnimations?: boolean;
  theme?: VisualTheme;
  animationConfig?: Partial<AnimationConfig>;
}

/**
 * Event handler for progress updates (from WebSocket/SSE)
 */
export type ProgressEventHandler = (
  event: any, // Progress event from backend
  store: ProgressStore
) => void;

/**
 * Batch update operation
 */
export interface BatchUpdateOperation {
  id: UUID;
  updates: Partial<ProgressIndicator>;
}

/**
 * Performance snapshot for monitoring
 */
export interface PerformanceSnapshot {
  timestamp: number;
  fps: number;
  activeAnimations: number;
  indicatorCount: number;
  memoryUsageMB?: number;
}
