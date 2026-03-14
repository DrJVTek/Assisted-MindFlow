/**
 * Zustand store for managing LLM provider registrations (Feature 011)
 */

import { create } from 'zustand';
import type {
  ProviderConfig,
  CreateProviderRequest,
  UpdateProviderRequest,
  ModelInfo,
} from '../types/provider';
import { api } from '../services/api';

interface ProviderState {
  providers: ProviderConfig[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchProviders: () => Promise<void>;
  addProvider: (request: CreateProviderRequest) => Promise<ProviderConfig>;
  updateProvider: (id: string, request: UpdateProviderRequest) => Promise<ProviderConfig>;
  deleteProvider: (id: string) => Promise<void>;
  validateProvider: (id: string) => Promise<void>;
  getProviderModels: (id: string) => Promise<ModelInfo[]>;

  // Queries
  getProvider: (id: string) => ProviderConfig | undefined;
  getProvidersByType: (type: string) => ProviderConfig[];
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: [],
  loading: false,
  error: null,

  fetchProviders: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.listProviders();
      set({ providers: response.providers, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  addProvider: async (request: CreateProviderRequest) => {
    const provider = await api.createProvider(request);
    set(state => ({
      providers: [...state.providers, provider],
    }));
    return provider;
  },

  updateProvider: async (id: string, request: UpdateProviderRequest) => {
    const updated = await api.updateProvider(id, request);
    set(state => ({
      providers: state.providers.map(p => (p.id === id ? updated : p)),
    }));
    return updated;
  },

  deleteProvider: async (id: string) => {
    await api.deleteProvider(id);
    set(state => ({
      providers: state.providers.filter(p => p.id !== id),
    }));
  },

  validateProvider: async (id: string) => {
    const result = await api.validateProvider(id);
    set(state => ({
      providers: state.providers.map(p =>
        p.id === id
          ? { ...p, status: result.status, available_models: result.available_models }
          : p
      ),
    }));
  },

  getProviderModels: async (id: string) => {
    const response = await api.getProviderModels(id);
    return response.models;
  },

  getProvider: (id: string) => {
    return get().providers.find(p => p.id === id);
  },

  getProvidersByType: (type: string) => {
    return get().providers.filter(p => p.type === type);
  },
}));
