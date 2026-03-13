/**
 * Authentication Store (Zustand)
 *
 * Manages OAuth session state for ChatGPT authentication.
 * Tracks auth method, connection status, subscription info, and detected models.
 */

import { create } from 'zustand';
import { api } from '../services/api';

export type AuthMethod = 'api_key' | 'chatgpt_oauth';
export type AuthStatus =
  | 'not_connected'
  | 'connecting'
  | 'connected'
  | 'session_expired'
  | 'auth_error';

interface DeviceCodeInfo {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

interface AuthState {
  authMethod: AuthMethod;
  status: AuthStatus;
  subscriptionTier: string | null;
  userEmail: string | null;
  expiresAt: string | null;
  needsReauth: boolean;
  isLoggingIn: boolean;
  error: string | null;
  deviceCode: DeviceCodeInfo | null;
}

interface AuthActions {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  setAuthMethod: (method: AuthMethod) => void;
  clearError: () => void;
  startDeviceCode: () => Promise<void>;
}

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  authMethod: 'api_key',
  status: 'not_connected',
  subscriptionTier: null,
  userEmail: null,
  expiresAt: null,
  needsReauth: false,
  isLoggingIn: false,
  error: null,
  deviceCode: null,

  login: async () => {
    set({ isLoggingIn: true, status: 'connecting', error: null });
    try {
      const result = await api.authLogin();
      set({
        status: 'connected',
        subscriptionTier: result.subscription_tier ?? null,
        userEmail: result.user_email ?? null,
        authMethod: 'chatgpt_oauth',
        isLoggingIn: false,
      });
    } catch (err) {
      set({
        status: 'auth_error',
        error: err instanceof Error ? err.message : 'Login failed',
        isLoggingIn: false,
      });
    }
  },

  logout: async () => {
    try {
      await api.authLogout();
      set({
        status: 'not_connected',
        subscriptionTier: null,
        userEmail: null,
        expiresAt: null,
        needsReauth: false,
        error: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Logout failed',
      });
    }
  },

  fetchStatus: async () => {
    try {
      const result = await api.authGetStatus();
      set({
        status: result.status as AuthStatus,
        subscriptionTier: result.subscription_tier ?? null,
        userEmail: result.user_email ?? null,
        expiresAt: result.expires_at ?? null,
        needsReauth: result.needs_reauth ?? false,
      });
    } catch {
      // Silent fail on status polling
    }
  },

  setAuthMethod: (method: AuthMethod) => {
    set({ authMethod: method });
  },

  clearError: () => {
    set({ error: null });
  },

  startDeviceCode: async () => {
    set({ isLoggingIn: true, status: 'connecting', error: null, deviceCode: null });
    try {
      const result = await api.authDeviceCode();
      set({
        deviceCode: {
          userCode: result.user_code,
          verificationUri: result.verification_uri,
          expiresIn: result.expires_in,
        },
      });
      // Poll for completion — backend polls OpenAI, we poll backend status
      const pollInterval = setInterval(async () => {
        const status = await api.authGetStatus();
        if (status.status === 'connected') {
          clearInterval(pollInterval);
          set({
            status: 'connected',
            subscriptionTier: status.subscription_tier ?? null,
            userEmail: status.user_email ?? null,
            authMethod: 'chatgpt_oauth',
            isLoggingIn: false,
            deviceCode: null,
          });
        }
      }, (result.interval || 5) * 1000);
    } catch (err) {
      set({
        status: 'auth_error',
        error: err instanceof Error ? err.message : 'Device code flow failed',
        isLoggingIn: false,
      });
    }
  },
}));
