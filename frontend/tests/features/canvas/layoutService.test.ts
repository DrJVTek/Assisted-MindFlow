/**
 * Unit Tests for layoutService
 *
 * Feature: 001-intelligent-reorganize
 * Phase: 2 - Foundational (TDD)
 * Task: T005
 *
 * Tests MUST FAIL before layoutService.ts is implemented (RED phase of TDD)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeLayout } from '../../../src/features/canvas/services/layoutService';
import type { Node, Edge } from 'reactflow';
import type { LayoutOptions } from '../../../src/types/layout';

describe('layoutService - computeLayout', () => {
  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();
  });

  it('should produce valid positions for basic layout', async () => {
    // Arrange
    const nodes: Node[] = [
      { id: 'node-1', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'node-2', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'node-3', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
    ];

    const edges: Edge[] = [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
      { id: 'edge-2', source: 'node-1', target: 'node-3' },
    ];

    const options: LayoutOptions = {};

    // Act
    const result = await computeLayout(nodes, edges, options);

    // Assert
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toEqual(edges); // Edges unchanged

    // All nodes should have updated positions
    result.nodes.forEach(node => {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeGreaterThanOrEqual(0);
    });

    // Node-1 (root) should be at top (lowest y value)
    const node1 = result.nodes.find(n => n.id === 'node-1')!;
    const node2 = result.nodes.find(n => n.id === 'node-2')!;
    const node3 = result.nodes.find(n => n.id === 'node-3')!;

    expect(node1.position.y).toBeLessThan(node2.position.y);
    expect(node1.position.y).toBeLessThan(node3.position.y);
  });

  it('should apply DOWN direction layout (default)', async () => {
    // Arrange
    const nodes: Node[] = [
      { id: 'root', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'child', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
    ];

    const edges: Edge[] = [
      { id: 'edge-1', source: 'root', target: 'child' },
    ];

    const options: LayoutOptions = {
      direction: 'DOWN',
    };

    // Act
    const result = await computeLayout(nodes, edges, options);

    // Assert
    const rootNode = result.nodes.find(n => n.id === 'root')!;
    const childNode = result.nodes.find(n => n.id === 'child')!;

    // For DOWN direction, root should be above child (smaller y)
    expect(rootNode.position.y).toBeLessThan(childNode.position.y);
  });

  it('should apply UP direction layout', async () => {
    // Arrange
    const nodes: Node[] = [
      { id: 'root', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'child', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
    ];

    const edges: Edge[] = [
      { id: 'edge-1', source: 'root', target: 'child' },
    ];

    const options: LayoutOptions = {
      direction: 'UP',
    };

    // Act
    const result = await computeLayout(nodes, edges, options);

    // Assert
    const rootNode = result.nodes.find(n => n.id === 'root')!;
    const childNode = result.nodes.find(n => n.id === 'child')!;

    // For UP direction, root should be below child (larger y)
    expect(rootNode.position.y).toBeGreaterThan(childNode.position.y);
  });

  it('should apply LEFT direction layout', async () => {
    // Arrange
    const nodes: Node[] = [
      { id: 'root', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'child', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
    ];

    const edges: Edge[] = [
      { id: 'edge-1', source: 'root', target: 'child' },
    ];

    const options: LayoutOptions = {
      direction: 'LEFT',
    };

    // Act
    const result = await computeLayout(nodes, edges, options);

    // Assert
    const rootNode = result.nodes.find(n => n.id === 'root')!;
    const childNode = result.nodes.find(n => n.id === 'child')!;

    // For LEFT direction, root should be right of child (larger x)
    expect(rootNode.position.x).toBeGreaterThan(childNode.position.x);
  });

  it('should apply RIGHT direction layout', async () => {
    // Arrange
    const nodes: Node[] = [
      { id: 'root', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'child', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
    ];

    const edges: Edge[] = [
      { id: 'edge-1', source: 'root', target: 'child' },
    ];

    const options: LayoutOptions = {
      direction: 'RIGHT',
    };

    // Act
    const result = await computeLayout(nodes, edges, options);

    // Assert
    const rootNode = result.nodes.find(n => n.id === 'root')!;
    const childNode = result.nodes.find(n => n.id === 'child')!;

    // For RIGHT direction, root should be left of child (smaller x)
    expect(rootNode.position.x).toBeLessThan(childNode.position.x);
  });

  it('should handle disconnected graphs', async () => {
    // Arrange
    const nodes: Node[] = [
      // Subgraph 1
      { id: 'A', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'B', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      // Subgraph 2 (disconnected)
      { id: 'X', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'Y', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
    ];

    const edges: Edge[] = [
      { id: 'edge-1', source: 'A', target: 'B' },
      { id: 'edge-2', source: 'X', target: 'Y' },
      // No edges between A-B and X-Y (disconnected)
    ];

    const options: LayoutOptions = {};

    // Act
    const result = await computeLayout(nodes, edges, options);

    // Assert
    expect(result.nodes).toHaveLength(4);

    // Both subgraphs should be laid out (all nodes have valid positions)
    result.nodes.forEach(node => {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeGreaterThanOrEqual(0);
    });
  });

  it('should handle circular edges without crashing', async () => {
    // Arrange - Create a cycle: A → B → C → A
    const nodes: Node[] = [
      { id: 'A', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'B', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'C', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
    ];

    const edges: Edge[] = [
      { id: 'edge-1', source: 'A', target: 'B' },
      { id: 'edge-2', source: 'B', target: 'C' },
      { id: 'edge-3', source: 'C', target: 'A' }, // Creates cycle
    ];

    const options: LayoutOptions = {};

    // Act - Should not throw
    const result = await computeLayout(nodes, edges, options);

    // Assert
    expect(result.nodes).toHaveLength(3);

    // elkjs handles cycles gracefully - all nodes should have valid positions
    result.nodes.forEach(node => {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(isNaN(node.position.x)).toBe(false);
      expect(isNaN(node.position.y)).toBe(false);
    });
  });

  it('should use default layout options when none provided', async () => {
    // Arrange
    const nodes: Node[] = [
      { id: 'node-1', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'node-2', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
    ];

    const edges: Edge[] = [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
    ];

    // Act - No options provided
    const result = await computeLayout(nodes, edges, {});

    // Assert
    expect(result.nodes).toHaveLength(2);

    // Default direction is DOWN (top-to-bottom)
    const node1 = result.nodes.find(n => n.id === 'node-1')!;
    const node2 = result.nodes.find(n => n.id === 'node-2')!;
    expect(node1.position.y).toBeLessThan(node2.position.y);

    // Nodes should have reasonable spacing (>= 80px default)
    const verticalSpacing = node2.position.y - (node1.position.y + 120);
    expect(verticalSpacing).toBeGreaterThanOrEqual(80);
  });

  it('should preserve all node data except positions', async () => {
    // Arrange
    const nodes: Node[] = [
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        data: { label: 'Test Node', metadata: { foo: 'bar' } },
        type: 'custom',
        style: { background: 'red' },
        measured: { width: 280, height: 120 },
      },
    ];

    const edges: Edge[] = [];
    const options: LayoutOptions = {};

    // Act
    const result = await computeLayout(nodes, edges, options);

    // Assert
    const updatedNode = result.nodes[0];
    expect(updatedNode.id).toBe('node-1');
    expect(updatedNode.data).toEqual({ label: 'Test Node', metadata: { foo: 'bar' } });
    expect(updatedNode.type).toBe('custom');
    expect(updatedNode.style).toEqual({ background: 'red' });
    // Position should be updated
    expect(updatedNode.position).not.toEqual({ x: 0, y: 0 });
  });

  it('should handle empty graph gracefully', async () => {
    // Arrange
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const options: LayoutOptions = {};

    // Act
    const result = await computeLayout(nodes, edges, options);

    // Assert
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('should handle single node graph', async () => {
    // Arrange
    const nodes: Node[] = [
      { id: 'only-node', position: { x: 50, y: 50 }, data: {}, measured: { width: 280, height: 120 } },
    ];

    const edges: Edge[] = [];
    const options: LayoutOptions = {};

    // Act
    const result = await computeLayout(nodes, edges, options);

    // Assert
    expect(result.nodes).toHaveLength(1);

    // Single node should have valid position
    expect(result.nodes[0].position).toBeDefined();
    expect(typeof result.nodes[0].position.x).toBe('number');
    expect(typeof result.nodes[0].position.y).toBe('number');
  });

  it('should apply custom spacing options', async () => {
    // Arrange
    const nodes: Node[] = [
      { id: 'node-1', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
      { id: 'node-2', position: { x: 0, y: 0 }, data: {}, measured: { width: 280, height: 120 } },
    ];

    const edges: Edge[] = [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
    ];

    const options: LayoutOptions = {
      spacing: 150, // Large spacing
      layerSpacing: 200,
    };

    // Act
    const result = await computeLayout(nodes, edges, options);

    // Assert
    const node1 = result.nodes.find(n => n.id === 'node-1')!;
    const node2 = result.nodes.find(n => n.id === 'node-2')!;

    // With larger spacing, nodes should be farther apart
    const verticalSpacing = node2.position.y - (node1.position.y + 120);
    expect(verticalSpacing).toBeGreaterThanOrEqual(150);
  });
});
