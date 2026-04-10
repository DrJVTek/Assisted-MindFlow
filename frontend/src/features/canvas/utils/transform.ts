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

  // Edges are derived exclusively from the `connections` dict (ComfyUI-style
  // named ports). The legacy parents/children fallback has been removed —
  // an edge without a named connection cannot exist in the UI anymore,
  // because otherwise deleting it would leave a phantom that reappears on
  // every page refresh.
  Object.values(nodes).forEach(node => {
    if (!node.connections) return;
    for (const [inputName, connSpec] of Object.entries(node.connections)) {
      if (connSpec && connSpec.source_node_id) {
        const conn = createConnectionLine(connSpec.source_node_id, node.id);
        conn.id = `${connSpec.source_node_id}:${connSpec.output_name}-${node.id}:${inputName}`;
        (conn as any).sourceHandle = connSpec.output_name;
        (conn as any).targetHandle = inputName;
        connections.push(conn);
      }
    }
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
 *
 * @param visualNode - Visual representation from transformNode
 * @param originalNode - Original Graph node (for Feature 009 LLM fields)
 * @param graphId - Graph ID (for Feature 009 LLM operations)
 */
export function visualNodeToReactFlowNode(
  visualNode: VisualNode,
  originalNode: Node,
  graphId: string
): any {
  return {
    id: visualNode.nodeId,
    type: 'custom', // Use custom node component
    position: visualNode.position,
    draggable: true, // Enable node dragging with left mouse button
    data: {
      nodeId: visualNode.nodeId,
      preview: visualNode.preview,
      type: visualNode.type,
      class_type: (originalNode as any).class_type || null,
      author: visualNode.author,
      status: visualNode.status,
      importance: visualNode.importance,
      backgroundColor: visualNode.style.backgroundColor,
      borderColor: visualNode.style.borderColor,
      borderWidth: visualNode.style.borderWidth,
      opacity: visualNode.style.opacity,

      // Feature 009: Pass through LLM fields for auto-launch and inline display
      graphId: graphId,
      content: originalNode.content,
      llm_response: originalNode.llm_response,
      llm_status: originalNode.llm_status || 'idle',
      llm_operation_id: originalNode.llm_operation_id,
      font_size: originalNode.font_size,
      node_width: originalNode.node_width,
      node_height: originalNode.node_height,

      // Feature 011: Provider assignment
      provider_id: (originalNode as any).provider_id || null,

      // isNewNode flag will be set separately when creating new nodes in Canvas.tsx
      isNewNode: false,
    },
  };
}

/**
 * Convert ConnectionLine to React Flow Edge format
 */
export function connectionLineToReactFlowEdge(connection: ConnectionLine): any {
  const edge: any = {
    id: connection.id,
    source: connection.source,
    target: connection.target,
    type: 'smoothstep',
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
    zIndex: -1,
  };

  // Named port handles (ComfyUI-style connections)
  if ((connection as any).sourceHandle) {
    edge.sourceHandle = (connection as any).sourceHandle;
  }
  if ((connection as any).targetHandle) {
    edge.targetHandle = (connection as any).targetHandle;
  }

  return edge;
}

/**
 * Transform a Group to React Flow node format
 */
export function groupToReactFlowNode(group: any, index: number): any {
  // Position groups in a staggered layout if no position is set
  const defaultPosition = {
    x: 100 + (index * 400),
    y: 100 + (index * 300),
  };

  return {
    id: group.id,
    type: 'group',
    position: defaultPosition,
    data: {
      label: group.label,
      kind: group.kind,
      color: group.meta?.color,
      pinned_nodes: group.meta?.pinned_nodes || [],
      tags: group.meta?.tags || [],
    },
    style: {
      width: 400,
      height: 300,
      zIndex: -1, // Render behind regular nodes
    },
  };
}

/**
 * Transform a Comment to React Flow node format
 */
export function commentToReactFlowNode(comment: any, index: number): any {
  // Position comments in a staggered layout if no position is set
  const defaultPosition = {
    x: 500 + (index * 280),
    y: 500 + (index * 200),
  };

  return {
    id: comment.id,
    type: 'comment',
    position: defaultPosition,
    data: {
      content: comment.content,
      author: comment.author,
      created_at: comment.created_at,
      attached_to: comment.attached_to,
    },
    draggable: true,
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

  // Transform regular nodes
  // Pass both visual node AND original node data for Feature 009 fields
  const regularNodes = visualNodes.map(visualNode => {
    const originalNode = graph.nodes[visualNode.nodeId];
    return visualNodeToReactFlowNode(visualNode, originalNode, graph.id);
  });

  // Transform groups
  const groupNodes = Object.values(graph.groups || {}).map((group, index) =>
    groupToReactFlowNode(group, index)
  );

  // Transform comments
  const commentNodes = Object.values(graph.comments || {}).map((comment, index) =>
    commentToReactFlowNode(comment, index)
  );

  return {
    nodes: [...groupNodes, ...regularNodes, ...commentNodes], // Groups render behind, comments on top
    edges: connectionLines.map(connectionLineToReactFlowEdge),
  };
}
