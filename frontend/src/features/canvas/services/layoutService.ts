/**
 * Layout Service
 *
 * Feature: 001-intelligent-reorganize
 * Phase: 2 - Foundational
 * Task: T007
 *
 * Core elkjs integration for automatic canvas layout.
 * Computes hierarchical layouts using the ELK (Eclipse Layout Kernel) algorithm.
 */

import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from 'reactflow';
import type { LayoutOptions, ELKGraph } from '../../../types/layout';
import { toELKGraph, fromELKGraph } from '../utils/elkjsAdapter';

// Create ELK instance (synchronous, Promise-based API)
const elk = new ELK();

/**
 * Default layout options per research.md:194-202
 */
const DEFAULT_LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
};

/**
 * Map user-friendly direction names to ELK direction values
 * Per research.md:205-212
 */
const DIRECTION_MAP: Record<string, string> = {
  'DOWN': 'DOWN',   // Top-to-bottom (default)
  'UP': 'UP',       // Bottom-to-top
  'LEFT': 'LEFT',   // Right-to-left
  'RIGHT': 'RIGHT', // Left-to-right
};

/**
 * Compute layout for canvas nodes using elkjs
 *
 * @param nodes - ReactFlow nodes to layout
 * @param edges - ReactFlow edges (connections between nodes)
 * @param options - Layout options (direction, spacing, etc.)
 * @returns Promise with layouted nodes and original edges
 */
export async function computeLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  // Handle empty graph
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Build elkjs layout options
  const layoutOptions: Record<string, string> = {
    ...DEFAULT_LAYOUT_OPTIONS,
    'elk.direction': DIRECTION_MAP[options.direction || 'DOWN'],
  };

  // Apply custom spacing if provided
  if (options.spacing !== undefined) {
    layoutOptions['elk.spacing.nodeNode'] = String(options.spacing);
  }

  if (options.layerSpacing !== undefined) {
    layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers'] = String(options.layerSpacing);
  }

  // Apply custom algorithm if provided
  if (options.algorithm) {
    layoutOptions['elk.algorithm'] = options.algorithm;
  }

  // Convert ReactFlow graph to ELK format
  const elkGraph = toELKGraph(nodes, edges, layoutOptions);

  // Compute layout using elkjs
  // This is synchronous computation but returns a Promise
  const layoutedGraph = (await elk.layout(elkGraph)) as unknown as ELKGraph;

  // Convert back to ReactFlow format with updated positions
  const layoutedNodes = fromELKGraph(layoutedGraph, nodes);

  return {
    nodes: layoutedNodes,
    edges: edges, // Edges are unchanged by layout
  };
}
