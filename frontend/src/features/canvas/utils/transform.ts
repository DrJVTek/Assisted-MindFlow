/**
 * Graph-to-VisualNode transformation utilities
 * Converts backend Graph data to frontend canvas representation
 */

import type { Graph, Node } from '../../../types/graph';
import type { VisualNode, ConnectionLine } from '../../../types/canvas';
import { getNodeStyle } from './styling';

/**
 * Fixed node dimensions (from data-model.md)
 */
export const NODE_WIDTH = 280;
export const NODE_MIN_HEIGHT = 120;
export const NODE_MAX_HEIGHT = 400;

/**
 * Truncate content for preview (100 characters)
 */
export function truncateContent(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength) + '...';
}

/**
 * Calculate node height based on content length
 */
export function calculateNodeHeight(content: string): number {
  // Rough estimation: ~40 chars per line, 20px per line, + padding
  const lines = Math.ceil(truncateContent(content).length / 40);
  const height = 80 + lines * 20; // Base height + line height

  return Math.max(NODE_MIN_HEIGHT, Math.min(NODE_MAX_HEIGHT, height));
}

/**
 * Transform a single Node to VisualNode
 */
export function transformNode(node: Node): VisualNode {
  const position = node.meta.position || { x: 0, y: 0 };
  const preview = truncateContent(node.content);
  const style = getNodeStyle(node.type, node.meta.status, node.meta.importance);

  return {
    nodeId: node.id,
    position,
    dimensions: {
      width: NODE_WIDTH,
      height: calculateNodeHeight(node.content),
    },
    style,
    preview,
    type: node.type,
    author: node.author,
    status: node.meta.status,
    importance: node.meta.importance,
  };
}

/**
 * Transform Graph nodes to VisualNodes array
 */
export function transformNodesToVisual(
  nodes: Graph['nodes']
): VisualNode[] {
  return Object.values(nodes).map(transformNode);
}

/**
 * Generate ConnectionLine from parent-child relationship
 */
export function createConnectionLine(
  parentId: string,
  childId: string
): ConnectionLine {
  return {
    id: `${parentId}-${childId}`,
    source: parentId,
    target: childId,
    path: '', // React Flow auto-generates path
    style: {
      stroke: '#90A4AE', // Default grey
      strokeWidth: 2,
      opacity: 0.6,
      animated: false,
    },
    markerEnd: 'url(#arrow)',
  };
}

/**
 * Generate all ConnectionLines from Graph nodes
 */
export function transformNodesToConnections(
  nodes: Graph['nodes']
): ConnectionLine[] {
  const connections: ConnectionLine[] = [];

  Object.values(nodes).forEach(node => {
    node.children.forEach(childId => {
      connections.push(createConnectionLine(node.id, childId));
    });
  });

  return connections;
}

/**
 * Transform complete Graph to canvas representation
 */
export function transformGraphToCanvas(graph: Graph): {
  nodes: VisualNode[];
  edges: ConnectionLine[];
} {
  return {
    nodes: transformNodesToVisual(graph.nodes),
    edges: transformNodesToConnections(graph.nodes),
  };
}

/**
 * Get emphasized edge style for selected node
 */
export function getEmphasizedEdgeStyle(baseEdge: ConnectionLine): ConnectionLine {
  return {
    ...baseEdge,
    style: {
      ...baseEdge.style,
      strokeWidth: 3,
      opacity: 1.0,
      stroke: '#1976D2', // Bright blue
    },
  };
}

/**
 * Find all edges connected to a node (parent or child)
 */
export function findConnectedEdges(
  nodeId: string,
  edges: ConnectionLine[]
): ConnectionLine[] {
  return edges.filter(
    edge => edge.source === nodeId || edge.target === nodeId
  );
}

/**
 * Convert VisualNode to React Flow Node format
 */
export function visualNodeToReactFlowNode(visualNode: VisualNode): any {
  return {
    id: visualNode.nodeId,
    type: 'custom', // Use custom node component
    position: visualNode.position,
    data: {
      nodeId: visualNode.nodeId,
      preview: visualNode.preview,
      type: visualNode.type,
      author: visualNode.author,
      status: visualNode.status,
      importance: visualNode.importance,
      backgroundColor: visualNode.style.backgroundColor,
      borderColor: visualNode.style.borderColor,
      borderWidth: visualNode.style.borderWidth,
      opacity: visualNode.style.opacity,
    },
  };
}

/**
 * Convert ConnectionLine to React Flow Edge format
 */
export function connectionLineToReactFlowEdge(connection: ConnectionLine): any {
  return {
    id: connection.id,
    source: connection.source,
    target: connection.target,
    type: 'smoothstep', // Bezier-like smooth edges
    style: {
      stroke: connection.style.stroke,
      strokeWidth: connection.style.strokeWidth,
      opacity: connection.style.opacity,
    },
    animated: connection.style.animated,
    markerEnd: {
      type: 'arrowclosed',
      color: connection.style.stroke,
    },
    zIndex: -1, // Render behind nodes
  };
}

/**
 * Transform complete Graph to React Flow format
 */
export function transformGraphToReactFlow(graph: Graph): {
  nodes: any[];
  edges: any[];
} {
  const { nodes: visualNodes, edges: connectionLines } = transformGraphToCanvas(graph);

  return {
    nodes: visualNodes.map(visualNodeToReactFlowNode),
    edges: connectionLines.map(connectionLineToReactFlowEdge),
  };
}
