/**
 * elkjs Adapter
 *
 * Feature: 001-intelligent-reorganize
 * Phase: 2 - Foundational
 * Task: T006
 *
 * Converts between ReactFlow and ELK graph formats.
 * This adapter handles the coordinate system conversion and data mapping.
 */

import type { Node, Edge } from 'reactflow';
import type { ELKGraph, ELKNode, ELKEdge } from '../../../types/layout';

/**
 * Default node dimensions
 * Used when ReactFlow node doesn't have measured dimensions
 */
const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 120;

/**
 * Convert ReactFlow graph to ELK format
 *
 * @param nodes - ReactFlow nodes
 * @param edges - ReactFlow edges
 * @param layoutOptions - ELK layout configuration options
 * @returns ELK graph structure ready for layout computation
 */
export function toELKGraph(
  nodes: Node[],
  edges: Edge[],
  layoutOptions: Record<string, string>
): ELKGraph {
  // Convert ReactFlow nodes to ELK nodes
  const elkNodes: ELKNode[] = nodes.map((node) => ({
    id: node.id,
    width: (node as any).measured?.width || DEFAULT_NODE_WIDTH,
    height: (node as any).measured?.height || DEFAULT_NODE_HEIGHT,
  }));

  // Convert ReactFlow edges to ELK edges
  const elkEdges: ELKEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  return {
    id: 'root',
    children: elkNodes,
    edges: elkEdges,
    layoutOptions,
  };
}

/**
 * Convert ELK graph back to ReactFlow format with updated positions
 *
 * @param elkGraph - ELK graph with computed positions
 * @param originalNodes - Original ReactFlow nodes (for preserving data)
 * @returns ReactFlow nodes with updated positions, all other data preserved
 */
export function fromELKGraph(
  elkGraph: ELKGraph,
  originalNodes: Node[]
): Node[] {
  // Map ELK nodes back to ReactFlow format
  return elkGraph.children.map((elkNode) => {
    // Find the original node to preserve its data
    const original = originalNodes.find(n => n.id === elkNode.id);

    if (!original) {
      throw new Error(`Node ${elkNode.id} not found in original nodes`);
    }

    // Return node with updated position, all other data preserved
    return {
      ...original,
      position: {
        x: elkNode.x!,
        y: elkNode.y!,
      },
    };
  });
}
