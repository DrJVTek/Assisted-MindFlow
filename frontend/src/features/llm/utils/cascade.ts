/**
 * Cascade regeneration utilities for frontend
 */

import type { Graph, UUID } from '../../../types/graph';

/**
 * Get all descendants of a node (children, grandchildren, etc.)
 */
export function getDescendants(graph: Graph, nodeId: UUID): Set<UUID> {
  const visited = new Set<UUID>();
  const queue: UUID[] = [nodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    // Get children of current node
    const node = graph.nodes[currentId];
    if (node) {
      for (const childId of node.children) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }
  }

  // Remove the starting node itself from descendants
  visited.delete(nodeId);
  return visited;
}

/**
 * Get all affected nodes when a node is modified
 */
export function getAffectedNodes(graph: Graph, modifiedNodeId: UUID): UUID[] {
  const descendants = getDescendants(graph, modifiedNodeId);
  return Array.from(descendants);
}

/**
 * Get display information for affected nodes
 */
export function getAffectedNodesInfo(
  graph: Graph,
  affectedNodeIds: UUID[]
): Array<{ id: UUID; type: string; contentPreview: string }> {
  return affectedNodeIds.map((nodeId) => {
    const node = graph.nodes[nodeId];
    if (!node) {
      return { id: nodeId, type: 'unknown', contentPreview: '' };
    }

    const contentPreview =
      node.content.length > 50
        ? node.content.substring(0, 50) + '...'
        : node.content;

    return {
      id: nodeId,
      type: node.type,
      contentPreview,
    };
  });
}
