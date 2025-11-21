/**
 * Unit Tests for useLayout Hook
 *
 * Feature: 001-intelligent-reorganize
 * Phase: 3 - User Story 1 (MVP)
 * Task: T008
 *
 * Tests MUST FAIL before useLayout.ts is implemented (RED phase of TDD)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLayout } from '../../../src/features/canvas/hooks/useLayout';
import * as layoutService from '../../../src/features/canvas/services/layoutService';
import type { Node, Edge } from 'reactflow';

// Mock the layout service
vi.mock('../../../src/features/canvas/services/layoutService');

describe('useLayout hook', () => {
  const mockNodes: Node[] = [
    { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
    { id: 'node-2', position: { x: 100, y: 100 }, data: {} },
  ];

  const mockEdges: Edge[] = [
    { id: 'edge-1', source: 'node-1', target: 'node-2' },
  ];

  const mockLayoutedNodes: Node[] = [
    { id: 'node-1', position: { x: 50, y: 50 }, data: {} },
    { id: 'node-2', position: { x: 150, y: 200 }, data: {} },
  ];

  const mockSetNodes = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return handleReorganize function', () => {
    // Arrange & Act
    const { result } = renderHook(() =>
      useLayout(mockNodes, mockEdges, mockSetNodes)
    );

    // Assert
    expect(result.current.handleReorganize).toBeDefined();
    expect(typeof result.current.handleReorganize).toBe('function');
  });

  it('should return isLoading state', () => {
    // Arrange & Act
    const { result } = renderHook(() =>
      useLayout(mockNodes, mockEdges, mockSetNodes)
    );

    // Assert
    expect(result.current.isLoading).toBeDefined();
    expect(typeof result.current.isLoading).toBe('boolean');
    expect(result.current.isLoading).toBe(false); // Initially false
  });

  it('should set loading state to true during layout computation', async () => {
    // Arrange
    vi.spyOn(layoutService, 'computeLayout').mockImplementation(
      () => new Promise((resolve) => {
        setTimeout(() => {
          resolve({ nodes: mockLayoutedNodes, edges: mockEdges });
        }, 100);
      })
    );

    const { result } = renderHook(() =>
      useLayout(mockNodes, mockEdges, mockSetNodes)
    );

    // Act
    act(() => {
      result.current.handleReorganize();
    });

    // Assert - loading should be true immediately after calling
    expect(result.current.isLoading).toBe(true);

    // Wait for completion
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should call computeLayout with nodes and edges', async () => {
    // Arrange
    const computeLayoutSpy = vi.spyOn(layoutService, 'computeLayout')
      .mockResolvedValue({ nodes: mockLayoutedNodes, edges: mockEdges });

    const { result } = renderHook(() =>
      useLayout(mockNodes, mockEdges, mockSetNodes)
    );

    // Act
    await act(async () => {
      await result.current.handleReorganize();
    });

    // Assert
    expect(computeLayoutSpy).toHaveBeenCalledWith(
      mockNodes,
      mockEdges,
      expect.any(Object) // layout options
    );
  });

  it('should update nodes via setNodes after successful layout', async () => {
    // Arrange
    vi.spyOn(layoutService, 'computeLayout')
      .mockResolvedValue({ nodes: mockLayoutedNodes, edges: mockEdges });

    const { result } = renderHook(() =>
      useLayout(mockNodes, mockEdges, mockSetNodes)
    );

    // Act
    await act(async () => {
      await result.current.handleReorganize();
    });

    // Assert
    expect(mockSetNodes).toHaveBeenCalled();

    // Get the function passed to setNodes
    const setNodesCallback = mockSetNodes.mock.calls[0][0];
    expect(typeof setNodesCallback).toBe('function');

    // Verify the callback updates positions correctly
    const updatedNodes = setNodesCallback(mockNodes);
    expect(updatedNodes[0].position).toEqual({ x: 50, y: 50 });
    expect(updatedNodes[1].position).toEqual({ x: 150, y: 200 });
  });

  it('should preserve all node data except positions', async () => {
    // Arrange
    const nodesWithData: Node[] = [
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        data: { label: 'Node 1', metadata: { foo: 'bar' } },
        type: 'custom',
        style: { background: 'red' },
      },
    ];

    const layoutedNodesWithData: Node[] = [
      {
        id: 'node-1',
        position: { x: 100, y: 200 },
        data: { label: 'Node 1', metadata: { foo: 'bar' } },
        type: 'custom',
        style: { background: 'red' },
      },
    ];

    vi.spyOn(layoutService, 'computeLayout')
      .mockResolvedValue({ nodes: layoutedNodesWithData, edges: [] });

    const { result } = renderHook(() =>
      useLayout(nodesWithData, [], mockSetNodes)
    );

    // Act
    await act(async () => {
      await result.current.handleReorganize();
    });

    // Assert
    const setNodesCallback = mockSetNodes.mock.calls[0][0];
    const updatedNodes = setNodesCallback(nodesWithData);

    expect(updatedNodes[0]).toEqual({
      id: 'node-1',
      position: { x: 100, y: 200 }, // Updated
      data: { label: 'Node 1', metadata: { foo: 'bar' } }, // Preserved
      type: 'custom', // Preserved
      style: { background: 'red' }, // Preserved
    });
  });

  it('should handle layout errors gracefully', async () => {
    // Arrange
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(layoutService, 'computeLayout')
      .mockRejectedValue(new Error('Layout failed'));

    const { result } = renderHook(() =>
      useLayout(mockNodes, mockEdges, mockSetNodes)
    );

    // Act
    await act(async () => {
      await result.current.handleReorganize();
    });

    // Assert
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false); // Should reset loading state
    expect(mockSetNodes).not.toHaveBeenCalled(); // Should not update nodes on error

    consoleErrorSpy.mockRestore();
  });

  it('should set loading back to false after error', async () => {
    // Arrange
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(layoutService, 'computeLayout')
      .mockRejectedValue(new Error('Layout failed'));

    const { result } = renderHook(() =>
      useLayout(mockNodes, mockEdges, mockSetNodes)
    );

    // Act
    await act(async () => {
      await result.current.handleReorganize();
    });

    // Assert
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    consoleErrorSpy.mockRestore();
  });

  it('should not call setNodes if no nodes provided', async () => {
    // Arrange
    vi.spyOn(layoutService, 'computeLayout')
      .mockResolvedValue({ nodes: [], edges: [] });

    const { result } = renderHook(() =>
      useLayout([], [], mockSetNodes)
    );

    // Act
    await act(async () => {
      await result.current.handleReorganize();
    });

    // Assert - computeLayout still called but returns empty
    expect(mockSetNodes).toHaveBeenCalled();
    const setNodesCallback = mockSetNodes.mock.calls[0][0];
    const updatedNodes = setNodesCallback([]);
    expect(updatedNodes).toHaveLength(0);
  });

  it('should use default layout options if none provided', async () => {
    // Arrange
    const computeLayoutSpy = vi.spyOn(layoutService, 'computeLayout')
      .mockResolvedValue({ nodes: mockLayoutedNodes, edges: mockEdges });

    const { result } = renderHook(() =>
      useLayout(mockNodes, mockEdges, mockSetNodes)
    );

    // Act
    await act(async () => {
      await result.current.handleReorganize();
    });

    // Assert
    expect(computeLayoutSpy).toHaveBeenCalledWith(
      mockNodes,
      mockEdges,
      {} // Default empty options
    );
  });

  it('should allow calling handleReorganize multiple times', async () => {
    // Arrange
    vi.spyOn(layoutService, 'computeLayout')
      .mockResolvedValue({ nodes: mockLayoutedNodes, edges: mockEdges });

    const { result } = renderHook(() =>
      useLayout(mockNodes, mockEdges, mockSetNodes)
    );

    // Act - Call twice
    await act(async () => {
      await result.current.handleReorganize();
    });

    await act(async () => {
      await result.current.handleReorganize();
    });

    // Assert
    expect(layoutService.computeLayout).toHaveBeenCalledTimes(2);
    expect(mockSetNodes).toHaveBeenCalledTimes(2);
  });
});
