/**
 * Zustand store for managing inter-LLM debates (Feature 011 - US2)
 */

import { create } from 'zustand';
import type { DebateChain } from '../types/debate';
import { api } from '../services/api';

interface DebateState {
  debates: DebateChain[];
  loading: boolean;
  error: string | null;

  // Actions
  startDebate: (graphId: string, startNodeId: string, maxRounds?: number) => Promise<DebateChain>;
  continueDebate: (debateId: string, additionalRounds?: number) => Promise<DebateChain>;
  stopDebate: (debateId: string) => Promise<void>;
  fetchDebate: (debateId: string) => Promise<DebateChain>;
  fetchDebates: (graphId: string) => Promise<void>;

  // Queries
  getDebate: (debateId: string) => DebateChain | undefined;
  getActiveDebates: () => DebateChain[];
}

export const useDebateStore = create<DebateState>((set, get) => ({
  debates: [],
  loading: false,
  error: null,

  startDebate: async (graphId, startNodeId, maxRounds = 5) => {
    const debate = await api.startDebate({ graph_id: graphId, start_node_id: startNodeId, max_rounds: maxRounds });
    set(state => ({
      debates: [...state.debates.filter(d => d.id !== debate.id), debate],
    }));
    return debate;
  },

  continueDebate: async (debateId, additionalRounds = 1) => {
    const debate = await api.continueDebate(debateId, { additional_rounds: additionalRounds });
    set(state => ({
      debates: state.debates.map(d => d.id === debateId ? debate : d),
    }));
    return debate;
  },

  stopDebate: async (debateId) => {
    await api.stopDebate(debateId);
    set(state => ({
      debates: state.debates.map(d =>
        d.id === debateId ? { ...d, status: 'stopped' as const } : d
      ),
    }));
  },

  fetchDebate: async (debateId) => {
    const debate = await api.getDebate(debateId);
    set(state => ({
      debates: [...state.debates.filter(d => d.id !== debateId), debate],
    }));
    return debate;
  },

  fetchDebates: async (graphId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.listDebates(graphId);
      set({ debates: response.debates, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  getDebate: (debateId) => {
    return get().debates.find(d => d.id === debateId);
  },

  getActiveDebates: () => {
    return get().debates.filter(d => d.status === 'running' || d.status === 'pending');
  },
}));
