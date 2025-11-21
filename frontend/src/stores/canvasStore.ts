/**
 * Zustand store for canvas state management
 */

import { create } from 'zustand';
import type { Graph } from '../types/graph';
import type { Canvas, UIPreferences } from '../types/canvas';
import { defaultPreferences } from '../types/canvas';
import * as canvasService from '../features/canvas/services/canvasService';

interface ViewportState {
  zoom: number;
  x: number;
  y: number;
}

interface CanvasStore {
  // Multi-canvas management
  canvases: Canvas[];
  activeCanvasId: string | null;
  viewportStates: Record<string, ViewportState>; // canvasId -> viewport

  // Graph data (for active canvas)
  graphData: Graph | null;
  isLoading: boolean;
  error: string | null;

  // Selection
  selectedNodeId: string | null;
  detailPanelOpen: boolean;

  // UI preferences
  preferences: UIPreferences;

  // Canvas management actions
  fetchCanvases: (params?: { owner_id?: string; search?: string }) => Promise<void>;
  createCanvas: (name: string, description?: string) => Promise<Canvas>;
  setActiveCanvas: (canvasId: string) => Promise<void>;
  renameCanvas: (canvasId: string, newName: string) => Promise<void>;
  deleteCanvas: (canvasId: string) => Promise<void>;
  duplicateCanvas: (canvasId: string, newName?: string) => Promise<Canvas>;
  saveViewportState: (canvasId: string, viewport: ViewportState) => void;
  getViewportState: (canvasId: string) => ViewportState | null;

  // Existing actions
  setGraphData: (graph: Graph | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  toggleDetailPanel: () => void;
  setDetailPanelOpen: (open: boolean) => void;
  updatePreferences: (prefs: Partial<UIPreferences>) => void;
  clearError: () => void;
  reset: () => void;
}

const DEFAULT_VIEWPORT: ViewportState = {
  zoom: 1,
  x: 0,
  y: 0,
};

const initialState = {
  canvases: [],
  activeCanvasId: null,
  viewportStates: {},
  graphData: null,
  isLoading: false,
  error: null,
  selectedNodeId: null,
  detailPanelOpen: false,
  preferences: defaultPreferences,
};

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  ...initialState,

  // Fetch all canvases from API
  fetchCanvases: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await canvasService.fetchCanvases(params);
      set({
        canvases: response.canvases,
        isLoading: false,
      });

      // Set first canvas as active if none selected
      const { activeCanvasId } = get();
      if (!activeCanvasId && response.canvases.length > 0) {
        set({ activeCanvasId: response.canvases[0].id });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch canvases',
        isLoading: false,
      });
    }
  },

  // Create a new canvas
  createCanvas: async (name, description) => {
    set({ isLoading: true, error: null });
    try {
      const newCanvas = await canvasService.createCanvas({
        name,
        description,
      });

      set((state) => ({
        canvases: [newCanvas, ...state.canvases],
        activeCanvasId: newCanvas.id,
        isLoading: false,
      }));

      return newCanvas;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create canvas',
        isLoading: false,
      });
      throw error;
    }
  },

  // Set active canvas
  setActiveCanvas: async (canvasId) => {
    const { canvases } = get();
    const canvas = canvases.find((c) => c.id === canvasId);

    if (!canvas) {
      set({ error: 'Canvas not found' });
      return;
    }

    set({ activeCanvasId: canvasId, error: null });

    // Update last_opened timestamp on server
    try {
      await canvasService.getCanvas(canvasId);
    } catch (error) {
      console.error('Failed to update last_opened:', error);
    }
  },

  // Rename a canvas
  renameCanvas: async (canvasId, newName) => {
    set({ isLoading: true, error: null });
    try {
      const updatedCanvas = await canvasService.updateCanvas(canvasId, {
        name: newName,
      });

      set((state) => ({
        canvases: state.canvases.map((c) =>
          c.id === canvasId ? updatedCanvas : c
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to rename canvas',
        isLoading: false,
      });
      throw error;
    }
  },

  // Delete a canvas
  deleteCanvas: async (canvasId) => {
    set({ isLoading: true, error: null });
    try {
      await canvasService.deleteCanvas(canvasId);

      set((state) => {
        const newCanvases = state.canvases.filter((c) => c.id !== canvasId);
        let newActiveId = state.activeCanvasId;

        // If deleted canvas was active, switch to first available
        if (state.activeCanvasId === canvasId) {
          newActiveId = newCanvases.length > 0 ? newCanvases[0].id : null;
        }

        // Remove viewport state
        const newViewportStates = { ...state.viewportStates };
        delete newViewportStates[canvasId];

        return {
          canvases: newCanvases,
          activeCanvasId: newActiveId,
          viewportStates: newViewportStates,
          isLoading: false,
        };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete canvas',
        isLoading: false,
      });
      throw error;
    }
  },

  // Duplicate a canvas
  duplicateCanvas: async (canvasId, newName) => {
    set({ isLoading: true, error: null });
    try {
      const duplicatedCanvas = await canvasService.duplicateCanvas(
        canvasId,
        newName
      );

      set((state) => ({
        canvases: [duplicatedCanvas, ...state.canvases],
        activeCanvasId: duplicatedCanvas.id,
        isLoading: false,
      }));

      return duplicatedCanvas;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to duplicate canvas',
        isLoading: false,
      });
      throw error;
    }
  },

  // Save viewport state for a canvas
  saveViewportState: (canvasId, viewport) => {
    set((state) => ({
      viewportStates: {
        ...state.viewportStates,
        [canvasId]: viewport,
      },
    }));
  },

  // Get viewport state for a canvas
  getViewportState: (canvasId) => {
    const { viewportStates } = get();
    return viewportStates[canvasId] || DEFAULT_VIEWPORT;
  },

  setGraphData: (graph) =>
    set({
      graphData: graph,
      isLoading: false,
      error: null,
    }),

  setLoading: (loading) =>
    set({
      isLoading: loading,
      error: loading ? null : undefined,
    }),

  setError: (error) =>
    set({
      error,
      isLoading: false,
    }),

  selectNode: (nodeId) =>
    set({
      selectedNodeId: nodeId,
      detailPanelOpen: nodeId !== null,
    }),

  toggleDetailPanel: () =>
    set((state) => ({
      detailPanelOpen: !state.detailPanelOpen,
      selectedNodeId: !state.detailPanelOpen ? state.selectedNodeId : null,
    })),

  setDetailPanelOpen: (open) =>
    set({
      detailPanelOpen: open,
      selectedNodeId: open ? undefined : null,
    }),

  updatePreferences: (prefs) =>
    set((state) => ({
      preferences: { ...state.preferences, ...prefs },
    })),

  clearError: () => {
    set({ error: null });
  },

  reset: () => set(initialState),
}));
