/**
 * Unit tests for providerStore (T066)
 *
 * Feature 011: Multi-provider LLM registry
 *
 * Tests:
 * - Initial state
 * - fetchProviders success and error
 * - addProvider adds to list
 * - updateProvider replaces in list
 * - deleteProvider removes from list
 * - validateProvider updates status
 * - getProvider / getProvidersByType queries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProviderStore } from '../../src/stores/providerStore';
import type { ProviderConfig } from '../../src/types/provider';

// Mock the API module
vi.mock('../../src/services/api', () => ({
  api: {
    listProviders: vi.fn(),
    createProvider: vi.fn(),
    updateProvider: vi.fn(),
    deleteProvider: vi.fn(),
    validateProvider: vi.fn(),
    getProviderModels: vi.fn(),
  },
}));

import { api } from '../../src/services/api';

const mockApi = api as {
  listProviders: ReturnType<typeof vi.fn>;
  createProvider: ReturnType<typeof vi.fn>;
  updateProvider: ReturnType<typeof vi.fn>;
  deleteProvider: ReturnType<typeof vi.fn>;
  validateProvider: ReturnType<typeof vi.fn>;
  getProviderModels: ReturnType<typeof vi.fn>;
};

const mockProvider: ProviderConfig = {
  id: 'prov-1',
  name: 'My OpenAI',
  type: 'openai',
  color: '#10A37F',
  status: 'disconnected',
  selected_model: null,
  available_models: [],
  endpoint_url: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockProvider2: ProviderConfig = {
  id: 'prov-2',
  name: 'My Claude',
  type: 'anthropic',
  color: '#6B4FBB',
  status: 'disconnected',
  selected_model: null,
  available_models: [],
  endpoint_url: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('providerStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useProviderStore.setState({
      providers: [],
      loading: false,
      error: null,
    });
  });

  describe('initial state', () => {
    it('starts with empty providers, not loading, no error', () => {
      const state = useProviderStore.getState();
      expect(state.providers).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchProviders', () => {
    it('sets loading true then populates providers on success', async () => {
      mockApi.listProviders.mockResolvedValue({ providers: [mockProvider] });

      await useProviderStore.getState().fetchProviders();

      const state = useProviderStore.getState();
      expect(state.providers).toHaveLength(1);
      expect(state.providers[0].id).toBe('prov-1');
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      mockApi.listProviders.mockRejectedValue(new Error('Network error'));

      await useProviderStore.getState().fetchProviders();

      const state = useProviderStore.getState();
      expect(state.providers).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Network error');
    });
  });

  describe('addProvider', () => {
    it('appends new provider to the list', async () => {
      mockApi.createProvider.mockResolvedValue(mockProvider);

      const result = await useProviderStore.getState().addProvider({
        name: 'My OpenAI',
        type: 'openai',
        color: '#10A37F',
        api_key: 'sk-test',
      });

      expect(result.id).toBe('prov-1');
      expect(useProviderStore.getState().providers).toHaveLength(1);
    });
  });

  describe('updateProvider', () => {
    it('replaces provider in list', async () => {
      useProviderStore.setState({ providers: [mockProvider] });

      const updated = { ...mockProvider, name: 'Renamed' };
      mockApi.updateProvider.mockResolvedValue(updated);

      await useProviderStore.getState().updateProvider('prov-1', { name: 'Renamed' });

      const state = useProviderStore.getState();
      expect(state.providers).toHaveLength(1);
      expect(state.providers[0].name).toBe('Renamed');
    });
  });

  describe('deleteProvider', () => {
    it('removes provider from list', async () => {
      useProviderStore.setState({ providers: [mockProvider, mockProvider2] });
      mockApi.deleteProvider.mockResolvedValue({ message: 'deleted', affected_nodes: 0 });

      await useProviderStore.getState().deleteProvider('prov-1');

      const state = useProviderStore.getState();
      expect(state.providers).toHaveLength(1);
      expect(state.providers[0].id).toBe('prov-2');
    });
  });

  describe('validateProvider', () => {
    it('updates provider status and available_models', async () => {
      useProviderStore.setState({ providers: [mockProvider] });
      mockApi.validateProvider.mockResolvedValue({
        status: 'connected',
        available_models: ['gpt-4', 'gpt-3.5-turbo'],
      });

      await useProviderStore.getState().validateProvider('prov-1');

      const state = useProviderStore.getState();
      expect(state.providers[0].status).toBe('connected');
      expect(state.providers[0].available_models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
    });
  });

  describe('getProviderModels', () => {
    it('returns models from API', async () => {
      mockApi.getProviderModels.mockResolvedValue({
        models: [{ id: 'gpt-4', name: 'GPT-4', available: true }],
      });

      const models = await useProviderStore.getState().getProviderModels('prov-1');
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('gpt-4');
    });
  });

  describe('getProvider', () => {
    it('returns provider by id', () => {
      useProviderStore.setState({ providers: [mockProvider, mockProvider2] });

      const result = useProviderStore.getState().getProvider('prov-2');
      expect(result).toBeDefined();
      expect(result!.name).toBe('My Claude');
    });

    it('returns undefined for unknown id', () => {
      useProviderStore.setState({ providers: [mockProvider] });
      expect(useProviderStore.getState().getProvider('unknown')).toBeUndefined();
    });
  });

  describe('getProvidersByType', () => {
    it('returns only providers of the given type', () => {
      useProviderStore.setState({ providers: [mockProvider, mockProvider2] });

      const openai = useProviderStore.getState().getProvidersByType('openai');
      expect(openai).toHaveLength(1);
      expect(openai[0].id).toBe('prov-1');

      const anthropic = useProviderStore.getState().getProvidersByType('anthropic');
      expect(anthropic).toHaveLength(1);
      expect(anthropic[0].id).toBe('prov-2');
    });

    it('returns empty array for type with no providers', () => {
      useProviderStore.setState({ providers: [mockProvider] });
      const result = useProviderStore.getState().getProvidersByType('gemini');
      expect(result).toEqual([]);
    });
  });
});
