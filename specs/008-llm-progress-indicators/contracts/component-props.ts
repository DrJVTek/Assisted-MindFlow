/**
 * Component Props Interface Contract
 * Type definitions for all progress indicator components
 * Feature: 008-llm-progress-indicators
 * Date: 2025-11-21
 *
 * This file defines the prop interfaces that components must implement.
 * Used by developers to understand component APIs and by TypeScript for type checking.
 */

import {
  ProgressIndicator,
  OperationSummary,
  AnimationConfig,
  VisualTheme,
  AggregateStatus,
  OperationStatus,
  AnimationState,
  ProgressType,
  UUID,
  NodeType,
} from './store-interface';

// ============================================================================
// NODE INDICATOR COMPONENT
// ============================================================================

/**
 * Props for NodeIndicator component
 * Displays progress indicator for a single node undergoing LLM processing
 *
 * Shows:
 * - Status icon (spinner for processing, checkmark for completed, X for failed, etc.)
 * - Progress text (word count, elapsed time, percentage, etc.)
 * - Error tooltip on hover if failed
 * - Respects reduced-motion accessibility setting
 *
 * @example
 * ```tsx
 * <NodeIndicator
 *   operationId="op-123"
 *   indicator={progressIndicator}
 *   position="top-right"
 *   onRetry={() => handleRetry()}
 *   onCancel={() => handleCancel()}
 * />
 * ```
 */
export interface NodeIndicatorProps {
  /**
   * Unique operation ID being displayed
   */
  operationId: UUID;

  /**
   * Progress indicator data
   */
  indicator: ProgressIndicator;

  /**
   * Position on node where indicator should appear
   * @default "top-right"
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

  /**
   * Size of indicator
   * @default "medium"
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Show detailed progress text (e.g., "147 words...")
   * @default true
   */
  showProgressText?: boolean;

  /**
   * Callback when user clicks retry button (if failed)
   */
  onRetry?: (operationId: UUID) => void;

  /**
   * Callback when user clicks cancel button
   */
  onCancel?: (operationId: UUID) => void;

  /**
   * Callback when user clicks the indicator itself
   */
  onClick?: (operationId: UUID, indicator: ProgressIndicator) => void;

  /**
   * CSS class for custom styling
   */
  className?: string;

  /**
   * Whether to show tooltip on hover
   * @default true
   */
  showTooltip?: boolean;

  /**
   * Custom tooltip text (overrides default)
   */
  tooltipText?: string;

  /**
   * Animation config (can override global config)
   */
  animationConfig?: Partial<AnimationConfig>;

  /**
   * Theme styles (can override global theme)
   */
  theme?: Partial<VisualTheme>;

  /**
   * Whether component is visible (optimization for off-screen nodes)
   * @default true
   */
  visible?: boolean;

  /**
   * Test ID for end-to-end testing
   */
  testId?: string;
}

// ============================================================================
// STREAMING NODE COMPONENT
// ============================================================================

/**
 * Props for StreamingNode component
 * Enhanced node display that shows streaming progress in real-time
 *
 * Shows:
 * - Node content with progressive text appearance
 * - Smooth content expansion animation as text grows
 * - Real-time progress indicator updating as tokens arrive
 * - Cursor/blinking effect while streaming
 *
 * @example
 * ```tsx
 * <StreamingNode
 *   nodeId="node-123"
 *   content={currentContent}
 *   indicator={progressIndicator}
 *   isStreaming={true}
 * />
 * ```
 */
export interface StreamingNodeProps {
  /**
   * Node ID being displayed
   */
  nodeId: UUID;

  /**
   * Node type for styling
   */
  nodeType: NodeType;

  /**
   * Node title/name
   */
  nodeTitle: string;

  /**
   * Current content (may be partial if streaming)
   */
  content: string;

  /**
   * Progress indicator for this node's LLM operation
   */
  indicator?: ProgressIndicator;

  /**
   * Whether content is actively streaming
   * @default false
   */
  isStreaming?: boolean;

  /**
   * Show blinking cursor while streaming
   * @default true
   */
  showStreamingCursor?: boolean;

  /**
   * Streaming cursor character
   * @default "▌" (block cursor)
   */
  streamingCursorChar?: string;

  /**
   * Enable smooth content expansion animation
   * @default true
   */
  enableContentAnimation?: boolean;

  /**
   * Animation duration for content expansion (ms)
   * @default 300
   */
  contentAnimationDurationMs?: number;

  /**
   * Show progress indicator
   * @default true
   */
  showProgressIndicator?: boolean;

  /**
   * Whether node is read-only (disable editing during streaming)
   * @default true (automatically set when streaming)
   */
  isReadOnly?: boolean;

  /**
   * Callback when streaming starts
   */
  onStreamStart?: (nodeId: UUID) => void;

  /**
   * Callback when streaming completes
   */
  onStreamComplete?: (nodeId: UUID, finalContent: string) => void;

  /**
   * Callback when user cancels streaming
   */
  onCancel?: (nodeId: UUID) => void;

  /**
   * CSS class for custom styling
   */
  className?: string;

  /**
   * Theme styles
   */
  theme?: Partial<VisualTheme>;

  /**
   * Test ID for testing
   */
  testId?: string;
}

// ============================================================================
// AGGREGATE PANEL / DASHBOARD COMPONENT
// ============================================================================

/**
 * Props for AggregatePanel component
 * Dashboard showing all active LLM operations
 *
 * Shows:
 * - List/table of all active operations with status
 * - Summary statistics (X completed, Y failed, Z in progress)
 * - Real-time updates as operations change state
 * - Click to navigate to node on canvas
 * - Bulk actions (retry all failed, cancel all, etc.)
 *
 * @example
 * ```tsx
 * <AggregatePanel
 *   status={aggregateStatus}
 *   onOperationClick={(opId) => navigateToNode(opId)}
 *   isOpen={dashboardOpen}
 *   onToggle={() => toggleDashboard()}
 * />
 * ```
 */
export interface AggregatePanelProps {
  /**
   * Aggregate status data for all operations
   */
  status: AggregateStatus;

  /**
   * Whether panel is open/visible
   * @default true
   */
  isOpen?: boolean;

  /**
   * Callback to toggle panel open/closed
   */
  onToggle?: () => void;

  /**
   * Callback when user clicks an operation in the list
   * Should navigate canvas to that node
   */
  onOperationClick?: (operationId: UUID, nodeId: UUID) => void;

  /**
   * Callback to retry a failed operation
   */
  onRetry?: (operationId: UUID) => void;

  /**
   * Callback to retry all failed operations
   */
  onRetryAll?: () => void;

  /**
   * Callback to cancel an operation
   */
  onCancel?: (operationId: UUID) => void;

  /**
   * Callback to cancel all operations
   */
  onCancelAll?: () => void;

  /**
   * Callback to clear completed operations
   */
  onClearCompleted?: () => void;

  /**
   * Panel position on screen
   * @default "bottom-right"
   */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'sidebar';

  /**
   * Panel display mode
   * @default "floating"
   */
  mode?: 'floating' | 'sidebar' | 'topbar';

  /**
   * Allow panel to be dragged
   * @default true
   */
  draggable?: boolean;

  /**
   * Allow panel to be resized
   * @default true
   */
  resizable?: boolean;

  /**
   * Initial panel width (pixels)
   * @default 400
   */
  width?: number;

  /**
   * Initial panel height (pixels)
   * @default 500
   */
  height?: number;

  /**
   * Show operation details view
   * @default "summary"
   */
  detailLevel?: 'summary' | 'detailed';

  /**
   * Items per page for pagination
   * @default 20
   */
  pageSize?: number;

  /**
   * Current page for pagination
   */
  currentPage?: number;

  /**
   * Callback when page changes
   */
  onPageChange?: (page: number) => void;

  /**
   * Filter operations by status
   * @default [] (show all)
   */
  filterByStatus?: OperationStatus[];

  /**
   * Filter operations by node type
   * @default [] (show all)
   */
  filterByNodeType?: NodeType[];

  /**
   * Enable auto-scroll to new operations
   * @default true
   */
  autoScroll?: boolean;

  /**
   * Collapse/expand panel
   * @default true
   */
  collapsible?: boolean;

  /**
   * Whether panel is collapsed
   * @default false
   */
  isCollapsed?: boolean;

  /**
   * Callback when collapse state changes
   */
  onCollapsedChange?: (collapsed: boolean) => void;

  /**
   * Show summary statistics at top
   * @default true
   */
  showSummary?: boolean;

  /**
   * Show bulk actions buttons
   * @default true
   */
  showBulkActions?: boolean;

  /**
   * CSS class for custom styling
   */
  className?: string;

  /**
   * Theme styles
   */
  theme?: Partial<VisualTheme>;

  /**
   * Test ID for testing
   */
  testId?: string;
}

// ============================================================================
// PROGRESS BAR COMPONENT
// ============================================================================

/**
 * Props for ProgressBar component
 * Visual progress indicator (bar, arc, circular, etc.)
 *
 * @example
 * ```tsx
 * <ProgressBar
 *   value={127}
 *   type="word_count"
 *   variant="bar"
 *   animated={true}
 * />
 * ```
 */
export interface ProgressBarProps {
  /**
   * Progress value (0-100 for percentage, or absolute value for word count)
   */
  value: number;

  /**
   * Total value for percentage calculation (optional)
   */
  maxValue?: number;

  /**
   * Type of progress tracking
   */
  type: ProgressType;

  /**
   * Display variant
   * @default "bar"
   */
  variant?: 'bar' | 'circular' | 'arc' | 'dots' | 'line';

  /**
   * Size of progress bar
   * @default "medium"
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Animate progress changes
   * @default true
   */
  animated?: boolean;

  /**
   * Animation duration (ms)
   * @default 300
   */
  animationDurationMs?: number;

  /**
   * Display text label
   * @default true
   */
  showLabel?: boolean;

  /**
   * Custom label text
   */
  labelText?: string;

  /**
   * Color (uses theme if not specified)
   */
  color?: string;

  /**
   * Background color
   */
  backgroundColor?: string;

  /**
   * CSS class
   */
  className?: string;

  /**
   * Test ID
   */
  testId?: string;
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

/**
 * Props for StatusBadge component
 * Small badge showing operation status
 *
 * @example
 * ```tsx
 * <StatusBadge
 *   status="streaming"
 *   animated={true}
 *   showIcon={true}
 * />
 * ```
 */
export interface StatusBadgeProps {
  /**
   * Operation status
   */
  status: OperationStatus;

  /**
   * Show icon for status
   * @default true
   */
  showIcon?: boolean;

  /**
   * Show status text
   * @default true
   */
  showText?: boolean;

  /**
   * Animate the badge
   * @default true
   */
  animated?: boolean;

  /**
   * Size
   * @default "small"
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Queue position (if status is "queued")
   */
  queuePosition?: number;

  /**
   * Queue size (if status is "queued")
   */
  queueSize?: number;

  /**
   * Theme styles
   */
  theme?: Partial<VisualTheme>;

  /**
   * CSS class
   */
  className?: string;

  /**
   * Test ID
   */
  testId?: string;
}

// ============================================================================
// ERROR DISPLAY COMPONENT
// ============================================================================

/**
 * Props for ErrorDisplay component
 * Shows error message with retry option
 *
 * @example
 * ```tsx
 * <ErrorDisplay
 *   errorMessage="Request timeout"
 *   errorType="timeout"
 *   onRetry={() => handleRetry()}
 *   canRetry={true}
 * />
 * ```
 */
export interface ErrorDisplayProps {
  /**
   * Error message to display
   */
  errorMessage: string;

  /**
   * Error type/category
   */
  errorType?: string;

  /**
   * Whether retry is possible
   * @default true
   */
  canRetry?: boolean;

  /**
   * Callback to retry
   */
  onRetry?: () => void;

  /**
   * Callback to dismiss
   */
  onDismiss?: () => void;

  /**
   * Show retry button
   * @default true
   */
  showRetryButton?: boolean;

  /**
   * Show dismiss button
   * @default true
   */
  showDismissButton?: boolean;

  /**
   * Display variant
   * @default "alert"
   */
  variant?: 'alert' | 'toast' | 'inline' | 'modal';

  /**
   * CSS class
   */
  className?: string;

  /**
   * Test ID
   */
  testId?: string;
}

// ============================================================================
// STREAMING INDICATOR COMPONENT
// ============================================================================

/**
 * Props for StreamingIndicator component
 * Animation showing active streaming
 *
 * @example
 * ```tsx
 * <StreamingIndicator
 *   isActive={true}
 *   variant="dots"
 *   speed="normal"
 * />
 * ```
 */
export interface StreamingIndicatorProps {
  /**
   * Whether animation is active
   * @default true
   */
  isActive?: boolean;

  /**
   * Animation variant
   * @default "dots"
   */
  variant?: 'dots' | 'wave' | 'bar' | 'pulse' | 'spinner';

  /**
   * Animation speed
   * @default "normal"
   */
  speed?: 'slow' | 'normal' | 'fast';

  /**
   * Color
   */
  color?: string;

  /**
   * Size
   * @default "medium"
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Respect reduced motion
   * @default true
   */
  respectReducedMotion?: boolean;

  /**
   * CSS class
   */
  className?: string;

  /**
   * Test ID
   */
  testId?: string;
}

// ============================================================================
// OPERATION DETAILS COMPONENT
// ============================================================================

/**
 * Props for OperationDetails component
 * Detailed view of a single operation
 *
 * @example
 * ```tsx
 * <OperationDetails
 *   operation={operationSummary}
 *   onClose={() => handleClose()}
 * />
 * ```
 */
export interface OperationDetailsProps {
  /**
   * Operation summary to display
   */
  operation: OperationSummary;

  /**
   * Callback to close details view
   */
  onClose?: () => void;

  /**
   * Callback to navigate to node
   */
  onNavigateToNode?: (nodeId: UUID) => void;

  /**
   * Callback to retry operation
   */
  onRetry?: (operationId: UUID) => void;

  /**
   * Callback to cancel operation
   */
  onCancel?: (operationId: UUID) => void;

  /**
   * Show detailed timing information
   * @default true
   */
  showTimings?: boolean;

  /**
   * Show error details if failed
   * @default true
   */
  showErrorDetails?: boolean;

  /**
   * Theme styles
   */
  theme?: Partial<VisualTheme>;

  /**
   * CSS class
   */
  className?: string;

  /**
   * Test ID
   */
  testId?: string;
}

// ============================================================================
// PROGRESS PROVIDER (CONTEXT) COMPONENT
// ============================================================================

/**
 * Props for ProgressProvider component
 * Context provider that makes store available to child components
 *
 * @example
 * ```tsx
 * <ProgressProvider initialState={state} animationConfig={config}>
 *   <App />
 * </ProgressProvider>
 * ```
 */
export interface ProgressProviderProps {
  /**
   * Child components
   */
  children: React.ReactNode;

  /**
   * Initial animation configuration
   */
  animationConfig?: Partial<AnimationConfig>;

  /**
   * Initial visual theme
   */
  theme?: Partial<VisualTheme>;

  /**
   * Enable accessibility features
   * @default true
   */
  enableAccessibility?: boolean;

  /**
   * Callback when store is initialized
   */
  onStoreInitialized?: () => void;
}

// ============================================================================
// CUSTOM HOOKS PARAMETER TYPES
// ============================================================================

/**
 * Options for useProgressIndicator hook
 *
 * @example
 * ```tsx
 * const indicator = useProgressIndicator(operationId, {
 *   onStatusChange: (status) => console.log(status),
 *   selectiveUpdates: true
 * });
 * ```
 */
export interface UseProgressIndicatorOptions {
  /**
   * Callback when indicator status changes
   */
  onStatusChange?: (status: OperationStatus) => void;

  /**
   * Callback when operation completes
   */
  onComplete?: (finalIndicator: ProgressIndicator) => void;

  /**
   * Callback when operation fails
   */
  onError?: (error: string) => void;

  /**
   * Only re-render when indicator changes (optimization)
   * @default true
   */
  selectiveUpdates?: boolean;

  /**
   * Equality function for memoization
   */
  equalityFn?: (a: ProgressIndicator, b: ProgressIndicator) => boolean;
}

/**
 * Options for useAggregateStatus hook
 */
export interface UseAggregateStatusOptions {
  /**
   * Callback when aggregate status updates
   */
  onUpdate?: (status: AggregateStatus) => void;

  /**
   * Filter by status types
   */
  filterByStatus?: OperationStatus[];

  /**
   * Selective updates optimization
   * @default true
   */
  selectiveUpdates?: boolean;
}

/**
 * Options for useStreamingNode hook
 */
export interface UseStreamingNodeOptions {
  /**
   * Callback when new content arrives
   */
  onContentUpdate?: (content: string, wordCount: number) => void;

  /**
   * Callback when streaming completes
   */
  onStreamComplete?: (finalContent: string) => void;

  /**
   * Batch updates every N milliseconds
   * @default 50
   */
  batchIntervalMs?: number;

  /**
   * Max batch size (tokens)
   * @default 50
   */
  maxBatchSize?: number;
}

// ============================================================================
// LAYOUT & POSITIONING TYPES
// ============================================================================

/**
 * Position on canvas
 */
export type CanvasPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

/**
 * Panel layout options
 */
export interface PanelLayoutOptions {
  position: CanvasPosition;
  width?: number;
  height?: number;
  offset?: { x: number; y: number };
  zIndex?: number;
}

// ============================================================================
// EVENT HANDLER TYPES
// ============================================================================

/**
 * Event handler for operation state changes
 */
export type OperationEventHandler = (
  operationId: UUID,
  oldStatus: OperationStatus,
  newStatus: OperationStatus,
  indicator: ProgressIndicator
) => void;

/**
 * Event handler for progress updates
 */
export type ProgressEventHandler = (
  operationId: UUID,
  progress: number,
  progressType: ProgressType
) => void;

/**
 * Event handler for errors
 */
export type ErrorEventHandler = (
  operationId: UUID,
  error: string,
  errorType?: string
) => void;
