/**
 * useViewport Hook
 *
 * Manages viewport state (zoom, pan) with persistence to localStorage
 */

import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import {
  clampZoom,
  saveViewportToLocalStorage,
  loadViewportFromLocalStorage,
} from '../utils/viewport';
import type { CanvasViewport } from '../../../types/canvas';

// Viewport type (React Flow's internal type)
type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

/**
 * Hook for managing viewport state with localStorage persistence
 *
 * @param graphId - UUID of the current graph (for localStorage key)
 */
export function useViewport(graphId: string | null | undefined) {
  const reactFlowInstance = useReactFlow();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved viewport on mount
  useEffect(() => {
    if (!graphId) return;

    const savedViewport = loadViewportFromLocalStorage(graphId);
    if (savedViewport) {
      reactFlowInstance.setViewport({
        x: savedViewport.x,
        y: savedViewport.y,
        zoom: savedViewport.zoom,
      });
    }
  }, [graphId, reactFlowInstance]);

  // Save viewport to localStorage with debounce
  const saveViewport = useCallback(
    (viewport: Viewport) => {
      if (!graphId) return;

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce save to avoid excessive writes (100ms)
      debounceTimerRef.current = setTimeout(() => {
        const canvasViewport: CanvasViewport = {
          zoom: viewport.zoom,
          x: viewport.x,
          y: viewport.y,
          width: window.innerWidth,
          height: window.innerHeight,
        };
        saveViewportToLocalStorage(graphId, canvasViewport);
      }, 100);
    },
    [graphId]
  );

  // Zoom in
  const zoomIn = useCallback(() => {
    const currentZoom = reactFlowInstance.getZoom();
    const newZoom = clampZoom(currentZoom * 1.1);
    reactFlowInstance.zoomTo(newZoom, { duration: 200 });
  }, [reactFlowInstance]);

  // Zoom out
  const zoomOut = useCallback(() => {
    const currentZoom = reactFlowInstance.getZoom();
    const newZoom = clampZoom(currentZoom / 1.1);
    reactFlowInstance.zoomTo(newZoom, { duration: 200 });
  }, [reactFlowInstance]);

  // Reset zoom to 100%
  const resetZoom = useCallback(() => {
    reactFlowInstance.zoomTo(1.0, { duration: 200 });
  }, [reactFlowInstance]);

  // Fit view to see all nodes
  const fitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2, duration: 200 });
  }, [reactFlowInstance]);

  // Get current zoom level
  const getCurrentZoom = useCallback(() => {
    return reactFlowInstance.getZoom();
  }, [reactFlowInstance]);

  return {
    saveViewport,
    zoomIn,
    zoomOut,
    resetZoom,
    fitView,
    getCurrentZoom,
  };
}
