/**
 * useLayout Hook
 *
 * Feature: 001-intelligent-reorganize
 * Phase: 3 - User Story 1 (MVP)
 * Task: T010
 *
 * React hook for managing canvas layout reorganization.
 * Provides handleReorganize function and loading state.
 */

import { useState, useCallback } from 'react';
import type { Node, Edge } from 'reactflow';
import { computeLayout } from '../services/layoutService';
import type { LayoutOptions } from '../../../types/layout';
import { useUndoRedo } from './useUndoRedo';
import { api } from '../../../services/api';

/**
 * Hook for managing canvas layout reorganization
 *
 * @param nodes - Current canvas nodes
 * @param edges - Current canvas edges
 * @param setNodes - ReactFlow setNodes function for updating node positions
 * @param graphId - Graph ID for persisting positions (optional)
 * @param options - Optional layout configuration
 * @returns Object with handleReorganize function and isLoading state
 */
export function useLayout(
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void,
  graphId?: string,
  options: LayoutOptions = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const { registerOperation, undo, redo, canUndo, canRedo } = useUndoRedo();

  /**
   * Handle reorganize action
   * Computes new layout and updates node positions with undo/redo support
   */
  const handleReorganize = useCallback(async () => {
    try {
      // Set loading state
      setIsLoading(true);

      // 1. Capture before snapshot (positions only)
      const beforeSnapshot = nodes.map(n => ({
        id: n.id,
        position: { ...n.position }
      }));

      // 2. Compute new layout using elkjs
      const { nodes: layoutedNodes } = await computeLayout(nodes, edges, options);

      // 3. Capture after snapshot
      const afterSnapshot = layoutedNodes.map(n => ({
        id: n.id,
        position: { ...n.position }
      }));

      // 4. Update nodes with new positions
      // Use callback form to ensure we're working with latest state
      setNodes((prevNodes) => {
        return prevNodes.map((node) => {
          // Find the layouted version of this node
          const layoutedNode = layoutedNodes.find(n => n.id === node.id);

          if (!layoutedNode) {
            // Node not in layout (shouldn't happen, but handle gracefully)
            return node;
          }

          // Return node with updated position, preserving all other data
          return {
            ...node,
            position: layoutedNode.position,
          };
        });
      });

      // 5. Register undo operation
      registerOperation({
        name: 'reorganize-layout',
        undo: () => {
          setNodes((prevNodes) => {
            return prevNodes.map((node) => {
              const snapshot = beforeSnapshot.find(s => s.id === node.id);
              if (!snapshot) return node;
              return {
                ...node,
                position: snapshot.position,
              };
            });
          });
        },
        redo: () => {
          setNodes((prevNodes) => {
            return prevNodes.map((node) => {
              const snapshot = afterSnapshot.find(s => s.id === node.id);
              if (!snapshot) return node;
              return {
                ...node,
                position: snapshot.position,
              };
            });
          });
        },
      });

      // 6. Persist positions to backend (don't block UI)
      if (graphId) {
        api.updateNodePositions(
          graphId,
          afterSnapshot.map(snap => ({
            nodeId: snap.id,
            position: snap.position,
          }))
        ).then(result => {
          if (result.success) {
            console.log(`Successfully persisted ${result.updated} node positions`);
          } else {
            console.warn(`Persisted ${result.updated} positions with ${result.errors.length} errors:`, result.errors);
          }
        }).catch(error => {
          console.error('Error persisting node positions:', error);
          // Don't throw - just log the error
        });
      }

    } catch (error) {
      console.error('Failed to reorganize layout:', error);
      // Don't update nodes on error - keep original positions
    } finally {
      // Always reset loading state
      setIsLoading(false);
    }
  }, [nodes, edges, setNodes, graphId, options, registerOperation]);

  return {
    handleReorganize,
    isLoading,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
