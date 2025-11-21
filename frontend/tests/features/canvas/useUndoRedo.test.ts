/**
 * Unit Tests for useUndoRedo Hook
 *
 * Feature: 001-intelligent-reorganize
 * Phase: 3 - User Story 1 (MVP)
 * Task: T012
 *
 * Tests for undo/redo functionality for canvas operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../../../src/features/canvas/hooks/useUndoRedo';

describe('useUndoRedo hook', () => {
  it('should return undo, redo, registerOperation, canUndo, and canRedo functions', () => {
    // Arrange & Act
    const { result } = renderHook(() => useUndoRedo());

    // Assert
    expect(result.current.undo).toBeDefined();
    expect(typeof result.current.undo).toBe('function');
    expect(result.current.redo).toBeDefined();
    expect(typeof result.current.redo).toBe('function');
    expect(result.current.registerOperation).toBeDefined();
    expect(typeof result.current.registerOperation).toBe('function');
    expect(typeof result.current.canUndo).toBe('boolean');
    expect(typeof result.current.canRedo).toBe('boolean');
  });

  it('should have canUndo and canRedo initially false', () => {
    // Arrange & Act
    const { result } = renderHook(() => useUndoRedo());

    // Assert
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should allow registering an operation', () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());
    const mockUndo = vitest.fn();
    const mockRedo = vitest.fn();

    // Act
    act(() => {
      result.current.registerOperation({
        name: 'test-operation',
        undo: mockUndo,
        redo: mockRedo,
      });
    });

    // Assert
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should call undo function when undo is called', () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());
    const mockUndo = vitest.fn();
    const mockRedo = vitest.fn();

    act(() => {
      result.current.registerOperation({
        name: 'test-operation',
        undo: mockUndo,
        redo: mockRedo,
      });
    });

    // Act
    act(() => {
      result.current.undo();
    });

    // Assert
    expect(mockUndo).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('should call redo function when redo is called', () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());
    const mockUndo = vitest.fn();
    const mockRedo = vitest.fn();

    act(() => {
      result.current.registerOperation({
        name: 'test-operation',
        undo: mockUndo,
        redo: mockRedo,
      });
    });

    // Undo first
    act(() => {
      result.current.undo();
    });

    // Act - Redo
    act(() => {
      result.current.redo();
    });

    // Assert
    expect(mockRedo).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should support multiple undo operations', () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());
    const mockUndo1 = vitest.fn();
    const mockRedo1 = vitest.fn();
    const mockUndo2 = vitest.fn();
    const mockRedo2 = vitest.fn();

    act(() => {
      result.current.registerOperation({
        name: 'operation-1',
        undo: mockUndo1,
        redo: mockRedo1,
      });
      result.current.registerOperation({
        name: 'operation-2',
        undo: mockUndo2,
        redo: mockRedo2,
      });
    });

    // Act - Undo twice
    act(() => {
      result.current.undo(); // Should undo operation-2
      result.current.undo(); // Should undo operation-1
    });

    // Assert
    expect(mockUndo2).toHaveBeenCalledTimes(1);
    expect(mockUndo1).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('should clear redo stack when new operation is registered', () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());
    const mockUndo1 = vitest.fn();
    const mockRedo1 = vitest.fn();
    const mockUndo2 = vitest.fn();
    const mockRedo2 = vitest.fn();

    act(() => {
      result.current.registerOperation({
        name: 'operation-1',
        undo: mockUndo1,
        redo: mockRedo1,
      });
    });

    // Undo operation-1
    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    // Act - Register new operation (should clear redo stack)
    act(() => {
      result.current.registerOperation({
        name: 'operation-2',
        undo: mockUndo2,
        redo: mockRedo2,
      });
    });

    // Assert
    expect(result.current.canRedo).toBe(false); // Redo stack should be cleared
    expect(result.current.canUndo).toBe(true);
  });

  it('should not call undo when undo stack is empty', () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());

    // Act
    act(() => {
      result.current.undo(); // Should do nothing
    });

    // Assert
    expect(result.current.canUndo).toBe(false);
  });

  it('should not call redo when redo stack is empty', () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());

    // Act
    act(() => {
      result.current.redo(); // Should do nothing
    });

    // Assert
    expect(result.current.canRedo).toBe(false);
  });

  it('should handle errors in undo function gracefully', () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());
    const mockUndo = vitest.fn(() => {
      throw new Error('Undo failed');
    });
    const mockRedo = vitest.fn();
    const consoleErrorSpy = vitest.spyOn(console, 'error').mockImplementation(() => {});

    act(() => {
      result.current.registerOperation({
        name: 'test-operation',
        undo: mockUndo,
        redo: mockRedo,
      });
    });

    // Act
    act(() => {
      result.current.undo();
    });

    // Assert
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(result.current.canUndo).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it('should support stack limit (prevent memory overflow)', () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo({ maxStackSize: 3 }));

    // Act - Register 5 operations (exceeds limit of 3)
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.registerOperation({
          name: `operation-${i}`,
          undo: vitest.fn(),
          redo: vitest.fn(),
        });
      }
    });

    // Assert - Only last 3 operations should be in stack
    // Undo 3 times should work
    act(() => {
      result.current.undo();
      result.current.undo();
      result.current.undo();
    });

    expect(result.current.canUndo).toBe(false); // All 3 undone

    // Undo again should do nothing
    act(() => {
      result.current.undo();
    });

    expect(result.current.canUndo).toBe(false);
  });
});
