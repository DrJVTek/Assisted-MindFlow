/**
 * Unit Tests for elkjsAdapter
 *
 * Feature: 001-intelligent-reorganize
 * Phase: 2 - Foundational (TDD)
 * Task: T004
 *
 * Tests MUST FAIL before elkjsAdapter.ts is implemented (RED phase of TDD)
 */

import { describe, it, expect } from 'vitest';
import { toELKGraph, fromELKGraph } from '../../../src/features/canvas/utils/elkjsAdapter';
import type { Node, Edge } from 'reactflow';
import type { ELKGraph } from '../../../src/types/layout';

describe('elkjsAdapter - toELKGraph', () => {
  it('should convert ReactFlow nodes to ELK format', () => {
    // Arrange
    const reactFlowNodes: Node[] = [
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        data: {},
        measured: { width: 280, height: 120 },
      },
      {
        id: 'node-2',
        position: { x: 100, y: 100 },
        data: {},
        measured: { width: 280, height: 120 },
      },
    ];

    const reactFlowEdges: Edge[] = [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
      },
    ];

    const layoutOptions = {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
    };

    // Act
    const elkGraph = toELKGraph(reactFlowNodes, reactFlowEdges, layoutOptions);

    // Assert
    expect(elkGraph.id).toBe('root');
    expect(elkGraph.children).toHaveLength(2);
    expect(elkGraph.edges).toHaveLength(1);
    expect(elkGraph.layoutOptions).toEqual(layoutOptions);

    // Check node conversion
    expect(elkGraph.children[0]).toEqual({
      id: 'node-1',
      width: 280,
      height: 120,
    });

    expect(elkGraph.children[1]).toEqual({
      id: 'node-2',
      width: 280,
      height: 120,
    });

    // Check edge conversion
    expect(elkGraph.edges[0]).toEqual({
      id: 'edge-1',
      sources: ['node-1'],
      targets: ['node-2'],
    });
  });

  it('should handle missing node dimensions by using defaults', () => {
    // Arrange
    const reactFlowNodes: Node[] = [
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        data: {},
        // No measured dimensions
      },
    ];

    const reactFlowEdges: Edge[] = [];
    const layoutOptions = {};

    // Act
    const elkGraph = toELKGraph(reactFlowNodes, reactFlowEdges, layoutOptions);

    // Assert
    expect(elkGraph.children[0]).toEqual({
      id: 'node-1',
      width: 280, // Default width
      height: 120, // Default height
    });
  });

  it('should handle empty graph', () => {
    // Arrange
    const reactFlowNodes: Node[] = [];
    const reactFlowEdges: Edge[] = [];
    const layoutOptions = {};

    // Act
    const elkGraph = toELKGraph(reactFlowNodes, reactFlowEdges, layoutOptions);

    // Assert
    expect(elkGraph.id).toBe('root');
    expect(elkGraph.children).toHaveLength(0);
    expect(elkGraph.edges).toHaveLength(0);
  });

  it('should convert multiple edges correctly', () => {
    // Arrange
    const reactFlowNodes: Node[] = [
      { id: 'node-1', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'node-2', position: { x: 100, y: 100 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'node-3', position: { x: 200, y: 200 }, data: {}, measured: { width: 280, height: 120 } },
    ];

    const reactFlowEdges: Edge[] = [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
      { id: 'edge-2', source: 'node-1', target: 'node-3' },
      { id: 'edge-3', source: 'node-2', target: 'node-3' },
    ];

    const layoutOptions = {};

    // Act
    const elkGraph = toELKGraph(reactFlowNodes, reactFlowEdges, layoutOptions);

    // Assert
    expect(elkGraph.edges).toHaveLength(3);
    expect(elkGraph.edges).toEqual([
      { id: 'edge-1', sources: ['node-1'], targets: ['node-2'] },
      { id: 'edge-2', sources: ['node-1'], targets: ['node-3'] },
      { id: 'edge-3', sources: ['node-2'], targets: ['node-3'] },
    ]);
  });
});

describe('elkjsAdapter - fromELKGraph', () => {
  it('should convert ELK graph back to ReactFlow format with updated positions', () => {
    // Arrange
    const originalNodes: Node[] = [
      {
        id: 'node-1',
        position: { x: 0, y: 0 }, // Original position
        data: { label: 'Node 1' },
      },
      {
        id: 'node-2',
        position: { x: 100, y: 100 }, // Original position
        data: { label: 'Node 2' },
      },
    ];

    const elkGraph: ELKGraph = {
      id: 'root',
      children: [
        { id: 'node-1', width: 280, height: 120, x: 50, y: 50 }, // New position from elkjs
        { id: 'node-2', width: 280, height: 120, x: 150, y: 200 }, // New position from elkjs
      ],
      edges: [],
    };

    // Act
    const updatedNodes = fromELKGraph(elkGraph, originalNodes);

    // Assert
    expect(updatedNodes).toHaveLength(2);

    // Check first node
    expect(updatedNodes[0].id).toBe('node-1');
    expect(updatedNodes[0].position).toEqual({ x: 50, y: 50 }); // Updated position
    expect(updatedNodes[0].data).toEqual({ label: 'Node 1' }); // Data preserved

    // Check second node
    expect(updatedNodes[1].id).toBe('node-2');
    expect(updatedNodes[1].position).toEqual({ x: 150, y: 200 }); // Updated position
    expect(updatedNodes[1].data).toEqual({ label: 'Node 2' }); // Data preserved
  });

  it('should preserve all node data except positions', () => {
    // Arrange
    const originalNodes: Node[] = [
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        data: { label: 'Node 1', metadata: { foo: 'bar' } },
        type: 'custom',
        style: { background: 'red' },
      },
    ];

    const elkGraph: ELKGraph = {
      id: 'root',
      children: [
        { id: 'node-1', width: 280, height: 120, x: 100, y: 200 },
      ],
      edges: [],
    };

    // Act
    const updatedNodes = fromELKGraph(elkGraph, originalNodes);

    // Assert
    expect(updatedNodes[0]).toEqual({
      id: 'node-1',
      position: { x: 100, y: 200 }, // Updated
      data: { label: 'Node 1', metadata: { foo: 'bar' } }, // Preserved
      type: 'custom', // Preserved
      style: { background: 'red' }, // Preserved
    });
  });

  it('should handle empty graph', () => {
    // Arrange
    const originalNodes: Node[] = [];
    const elkGraph: ELKGraph = {
      id: 'root',
      children: [],
      edges: [],
    };

    // Act
    const updatedNodes = fromELKGraph(elkGraph, originalNodes);

    // Assert
    expect(updatedNodes).toHaveLength(0);
  });

  it('should maintain node order based on ELK graph', () => {
    // Arrange
    const originalNodes: Node[] = [
      { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
      { id: 'node-2', position: { x: 100, y: 100 }, data: {} },
      { id: 'node-3', position: { x: 200, y: 200 }, data: {} },
    ];

    const elkGraph: ELKGraph = {
      id: 'root',
      children: [
        { id: 'node-3', width: 280, height: 120, x: 50, y: 50 },
        { id: 'node-1', width: 280, height: 120, x: 150, y: 150 },
        { id: 'node-2', width: 280, height: 120, x: 250, y: 250 },
      ],
      edges: [],
    };

    // Act
    const updatedNodes = fromELKGraph(elkGraph, originalNodes);

    // Assert
    expect(updatedNodes[0].id).toBe('node-3');
    expect(updatedNodes[1].id).toBe('node-1');
    expect(updatedNodes[2].id).toBe('node-2');
  });
});
