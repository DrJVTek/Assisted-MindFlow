/**
 * Node styling utilities
 * Maps node properties to visual styles
 */

import type { NodeType, NodeStatus } from '../../../types/graph';
import type { NodeStyle } from '../../../types/canvas';

/**
 * Type-to-color mapping (from data-model.md)
 */
export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  question: '#E3F2FD', // Light blue
  answer: '#E8F5E9', // Light green
  note: '#FFF9C4', // Light yellow
  hypothesis: '#F3E5F5', // Light purple
  evaluation: '#FFE0B2', // Light orange
  summary: '#E0F2F1', // Light teal
  plan: '#FCE4EC', // Light pink
  group_meta: '#ECEFF1', // Light grey
  comment: '#FFF3E0', // Light amber
  stop: '#FFCDD2', // Light red
};

/**
 * Status-to-border-color mapping
 */
export const NODE_STATUS_COLORS: Record<NodeStatus, string> = {
  draft: '#9E9E9E', // Grey
  valid: '#4CAF50', // Green
  invalid: '#F44336', // Red
  final: '#2196F3', // Blue
  experimental: '#FF9800', // Orange
};

/**
 * Calculate border width based on importance (0.0-1.0 → 1-4px)
 */
export function calculateBorderWidth(importance: number): number {
  // Clamp importance to [0, 1]
  const clamped = Math.max(0, Math.min(1, importance));

  // Map to 1-4px range
  return Math.round(1 + clamped * 3);
}

/**
 * Calculate opacity based on importance (0.0-1.0 → 0.5-1.0)
 */
export function calculateOpacity(importance: number): number {
  // Clamp importance to [0, 1]
  const clamped = Math.max(0, Math.min(1, importance));

  // Map to 0.5-1.0 range
  return 0.5 + clamped * 0.5;
}

/**
 * Generate box shadow for node elevation
 */
export function getNodeShadow(importance: number): string {
  // Higher importance = more prominent shadow
  const shadowIntensity = Math.max(0.1, importance * 0.2);
  return `0 2px 8px rgba(0, 0, 0, ${shadowIntensity})`;
}

/**
 * Get complete node style based on node properties
 */
export function getNodeStyle(
  type: NodeType,
  status: NodeStatus,
  importance: number
): NodeStyle {
  return {
    backgroundColor: NODE_TYPE_COLORS[type],
    borderColor: NODE_STATUS_COLORS[status],
    borderWidth: calculateBorderWidth(importance),
    opacity: calculateOpacity(importance),
    shadow: getNodeShadow(importance),
  };
}

/**
 * Get hover style (lighter border, more shadow)
 */
export function getNodeHoverStyle(baseStyle: NodeStyle): Partial<NodeStyle> {
  return {
    borderWidth: baseStyle.borderWidth + 1,
    shadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
  };
}

/**
 * Get selected style (thicker border, elevated)
 */
export function getNodeSelectedStyle(baseStyle: NodeStyle): Partial<NodeStyle> {
  return {
    borderWidth: baseStyle.borderWidth + 2,
    shadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
  };
}
