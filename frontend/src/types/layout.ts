/**
 * Layout Type Definitions for Intelligent Canvas Reorganize
 *
 * Feature: 001-intelligent-reorganize
 * Purpose: Type definitions for elkjs layout integration and configuration
 */

import type { Node } from 'reactflow';

/**
 * Layout Configuration
 *
 * User preferences for layout behavior per canvas.
 * Controls how the elkjs algorithm organizes nodes.
 */
export interface LayoutConfig {
  /** Layout flow direction - maps to elkjs 'elk.direction' option */
  direction: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';

  /** Spacing configuration */
  spacing: {
    /** Minimum space between adjacent nodes in pixels (40-200) */
    node: number;
    /** Space between hierarchy levels in pixels (60-300) */
    rank: number;
  };

  /** ELK algorithm type - MVP uses 'layered' only */
  algorithm: 'layered' | 'force';
}

/**
 * ELK Node
 *
 * Node representation in elkjs format.
 * Converted from ReactFlow nodes for layout computation.
 */
export interface ELKNode {
  /** Node identifier (must match ReactFlow node.id) */
  id: string;

  /** Node width in pixels */
  width: number;

  /** Node height in pixels */
  height: number;

  /** Nested nodes for groups (not used in MVP - groups processed separately) */
  children?: ELKNode[];

  /** Output: Computed X position from elkjs */
  x?: number;

  /** Output: Computed Y position from elkjs */
  y?: number;
}

/**
 * ELK Edge
 *
 * Edge representation in elkjs format.
 * Converted from ReactFlow edges for layout computation.
 */
export interface ELKEdge {
  /** Edge identifier (matches ReactFlow edge.id) */
  id: string;

  /** Source node IDs (single-element array for standard edges) */
  sources: string[];

  /** Target node IDs (single-element array for standard edges) */
  targets: string[];
}

/**
 * ELK Graph
 *
 * Root graph structure for elkjs layout engine.
 * Transient format - created from ReactFlow graph, processed by elkjs, then converted back.
 */
export interface ELKGraph {
  /** Root graph identifier (always 'root') */
  id: string;

  /** Top-level nodes to layout */
  children: ELKNode[];

  /** All edges between nodes */
  edges: ELKEdge[];

  /** elkjs configuration options (direction, spacing, algorithm) */
  layoutOptions?: Record<string, string>;
}

/**
 * Group Layout Result
 *
 * Computed layout for a group and its member nodes.
 * Used during group preservation logic (User Story 2, P2 priority).
 */
export interface GroupLayoutResult {
  /** Group node ID */
  groupId: string;

  /** Top-left position of group container on canvas */
  groupPosition: { x: number; y: number };

  /** Group container size */
  groupDimensions: { width: number; height: number };

  /** Member nodes with updated positions (relative to group) */
  memberNodes: Node[];
}

/**
 * Layout Options
 *
 * Options passed to layout computation functions.
 */
export interface LayoutOptions {
  /** Layout direction */
  direction?: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';

  /** Node spacing in pixels */
  spacing?: number;

  /** Layer/rank spacing in pixels */
  layerSpacing?: number;

  /** Algorithm type */
  algorithm?: 'layered' | 'force';
}
