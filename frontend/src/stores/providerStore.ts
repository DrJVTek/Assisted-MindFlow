/**
 * Zustand store for managing LLM provider registrations.
 *
 * Handles both CRUD and per-provider OAuth lifecycle.
 */

import { create } from 'zustand';
import type {
  ProviderConfig,
  CreateProviderRequest,
  UpdateProviderRequest,
  ModelInfo,
} from '../types/provider';
import { api } from '../services/api';

interface DeviceCodeInfo {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

interface ProviderState {
  providers: ProviderConfig[];
  loading: boolean;
  error: string | null;

  // Per-provider OAuth state
  oauthLoading: Record<string, boolean>;
  oauthError: Record<string, string | null>;
  deviceCodes: Record<string, DeviceCodeInfo | null>;

  // CRUD Actions
  fetchProviders: () => Promise<void>;
  addProvider: (request: CreateProviderRequest) => Promise<ProviderConfig>;
  updateProvider: (id: string, request: UpdateProviderRequest) => Promise<ProviderConfig>;
  deleteProvider: (id: string) => Promise<void>;
  validateProvider: (id: string) => Promise<void>;
  getProviderModels: (id: string) => Promise<ModelInfo[]>;

  // OAuth Actions
  oauthLogin: (providerId: string) => Promise<void>;
  oauthLogout: (providerId: string) => Promise<void>;
  oauthFetchStatus: (providerId: string) => Promise<void>;
  oauthStartDeviceCode: (providerId: string) => Promise<void>;

  // Queries
  getProvider: (id: string) => ProviderConfig | undefined;
  getProvidersByType: (type: string) => ProviderConfig[];
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: [],
  loading: false,
  error: null,
  oauthLoading: {},
  oauthError: {},
  deviceCodes: {},

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

  // ── OAuth Actions ─────────────────────────────────────────────

  oauthLogin: async (providerId: string) => {
    set(state => ({
      oauthLoading: { ...state.oauthLoading, [providerId]: true },
      oauthError: { ...state.oauthError, [providerId]: null },
    }));

    try {
      const result = await api.providerOAuthLogin(providerId);

      if (result.status === 'connected') {
        // Re-fetch to get updated provider state
        const response = await api.listProviders();
        set(state => ({
          providers: response.providers,
          oauthLoading: { ...state.oauthLoading, [providerId]: false },
        }));
      } else {
        set(state => ({
          oauthLoading: { ...state.oauthLoading, [providerId]: false },
          oauthError: { ...state.oauthError, [providerId]: result.message || 'Login failed' },
        }));
      }
    } catch (err) {
      set(state => ({
        oauthLoading: { ...state.oauthLoading, [providerId]: false },
        oauthError: { ...state.oauthError, [providerId]: (err as Error).message },
      }));
    }
  },

  oauthLogout: async (providerId: string) => {
    try {
      await api.providerOAuthLogout(providerId);
      // Re-fetch to get updated provider state
      const response = await api.listProviders();
      set({ providers: response.providers });
    } catch (err) {
      set(state => ({
        oauthError: { ...state.oauthError, [providerId]: (err as Error).message },
      }));
    }
  },

  oauthFetchStatus: async (providerId: string) => {
    try {
      const result = await api.providerOAuthStatus(providerId);
      set(state => ({
        providers: state.providers.map(p =>
          p.id === providerId
            ? {
                ...p,
                oauth_status: result.status,
                oauth_email: result.user_email || null,
                status: result.status === 'connected' ? 'connected' as const : p.status,
              }
            : p
        ),
      }));
    } catch {
      // Silent fail for status polling
    }
  },

  oauthStartDeviceCode: async (providerId: string) => {
    set(state => ({
      oauthLoading: { ...state.oauthLoading, [providerId]: true },
      oauthError: { ...state.oauthError, [providerId]: null },
    }));

    try {
      const result = await api.providerOAuthDeviceCode(providerId);
      set(state => ({
        deviceCodes: {
          ...state.deviceCodes,
          [providerId]: {
            userCode: result.user_code,
            verificationUri: result.verification_uri,
            expiresIn: result.expires_in,
          },
        },
      }));

      // Poll status until connected
      const pollInterval = setInterval(async () => {
        try {
          const status = await api.providerOAuthStatus(providerId);
          if (status.status === 'connected') {
            clearInterval(pollInterval);
            const response = await api.listProviders();
            set(state => ({
              providers: response.providers,
              oauthLoading: { ...state.oauthLoading, [providerId]: false },
              deviceCodes: { ...state.deviceCodes, [providerId]: null },
            }));
          }
        } catch {
          // Continue polling
        }
      }, 5000);

      // Stop polling after expiry
      setTimeout(() => {
        clearInterval(pollInterval);
        set(state => ({
          oauthLoading: { ...state.oauthLoading, [providerId]: false },
          deviceCodes: { ...state.deviceCodes, [providerId]: null },
        }));
      }, result.expires_in * 1000);
    } catch (err) {
      set(state => ({
        oauthLoading: { ...state.oauthLoading, [providerId]: false },
        oauthError: { ...state.oauthError, [providerId]: (err as Error).message },
      }));
    }
  },

  // ── Queries ───────────────────────────────────────────────────

  getProvider: (id: string) => {
    return get().providers.find(p => p.id === id);
  },

  getProvidersByType: (type: string) => {
    return get().providers.filter(p => p.type === type);
  },
}));
