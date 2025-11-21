/**
 * useUndoRedo Hook
 *
 * Feature: 001-intelligent-reorganize
 * Phase: 3 - User Story 1 (MVP)
 * Task: T012
 *
 * Generic undo/redo functionality for canvas operations.
 * Maintains undo and redo stacks with configurable size limits.
 */

import { useState, useCallback } from 'react';

/**
 * Operation that can be undone/redone
 */
export interface UndoableOperation {
  name: string;
  undo: () => void;
  redo: () => void;
}

/**
 * Hook options
 */
export interface UseUndoRedoOptions {
  maxStackSize?: number;
}

/**
 * Hook for managing undo/redo operations
 *
 * @param options - Configuration options (maxStackSize)
 * @returns Object with undo, redo, registerOperation functions and state flags
 */
export function useUndoRedo(options: UseUndoRedoOptions = {}) {
  const { maxStackSize = 50 } = options;

  const [undoStack, setUndoStack] = useState<UndoableOperation[]>([]);
  const [redoStack, setRedoStack] = useState<UndoableOperation[]>([]);

  /**
   * Register a new undoable operation
   * Clears the redo stack when a new operation is registered
   */
  const registerOperation = useCallback(
    (operation: UndoableOperation) => {
      setUndoStack((prev) => {
        const newStack = [...prev, operation];
        // Enforce max stack size by removing oldest items
        if (newStack.length > maxStackSize) {
          return newStack.slice(newStack.length - maxStackSize);
        }
        return newStack;
      });
      // Clear redo stack when new operation is registered
      setRedoStack([]);
    },
    [maxStackSize]
  );

  /**
   * Undo the last operation
   */
  const undo = useCallback(() => {
    setUndoStack((prevUndoStack) => {
      if (prevUndoStack.length === 0) {
        return prevUndoStack;
      }

      const operation = prevUndoStack[prevUndoStack.length - 1];

      try {
        operation.undo();

        // Move operation from undo stack to redo stack
        setRedoStack((prev) => [...prev, operation]);

        // Return new undo stack without the last item
        return prevUndoStack.slice(0, -1);
      } catch (error) {
        console.error('Error executing undo:', error);
        // Still remove from stack even if undo fails
        return prevUndoStack.slice(0, -1);
      }
    });
  }, []);

  /**
   * Redo the last undone operation
   */
  const redo = useCallback(() => {
    setRedoStack((prevRedoStack) => {
      if (prevRedoStack.length === 0) {
        return prevRedoStack;
      }

      const operation = prevRedoStack[prevRedoStack.length - 1];

      try {
        operation.redo();

        // Move operation from redo stack to undo stack
        setUndoStack((prev) => [...prev, operation]);

        // Return new redo stack without the last item
        return prevRedoStack.slice(0, -1);
      } catch (error) {
        console.error('Error executing redo:', error);
        // Still remove from stack even if redo fails
        return prevRedoStack.slice(0, -1);
      }
    });
  }, []);

  return {
    undo,
    redo,
    registerOperation,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
