/**
 * Zustand store for canvas state management
 */

import { create } from 'zustand';
import type { Graph } from '../types/graph';
import type { UIPreferences } from '../types/canvas';
import { defaultPreferences } from '../types/canvas';

interface CanvasStore {
  // Graph data
  graphData: Graph | null;
  isLoading: boolean;
  error: string | null;

  // Selection
  selectedNodeId: string | null;
  detailPanelOpen: boolean;

  // UI preferences
  preferences: UIPreferences;

  // Actions
  setGraphData: (graph: Graph | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  toggleDetailPanel: () => void;
  setDetailPanelOpen: (open: boolean) => void;
  updatePreferences: (prefs: Partial<UIPreferences>) => void;
  reset: () => void;
}

const initialState = {
  graphData: null,
  isLoading: false,
  error: null,
  selectedNodeId: null,
  detailPanelOpen: false,
  preferences: defaultPreferences,
};

export const useCanvasStore = create<CanvasStore>((set) => ({
  ...initialState,

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

  reset: () => set(initialState),
}));
