/**
 * Types for the multi-provider LLM registry.
 *
 * ProviderType determines which API implementation is used.
 * AuthMethod determines how credentials are obtained (API key, OAuth, or local endpoint).
 */

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'local' | 'chatgpt_web';

export type AuthMethod = 'api_key' | 'oauth' | 'endpoint';

export type ProviderStatus = 'disconnected' | 'connected' | 'error' | 'rate_limited';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  auth_method: AuthMethod;
  color: string;
  status: ProviderStatus;
  selected_model: string | null;
  available_models: string[];
  endpoint_url: string | null;
  oauth_status: string | null;
  oauth_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderRequest {
  name: string;
  type: ProviderType;
  auth_method: AuthMethod;
  color: string;
  api_key?: string;
  oauth_token?: string;
  endpoint_url?: string;
  selected_model?: string;
}

export interface UpdateProviderRequest {
  name?: string;
  color?: string;
  auth_method?: AuthMethod;
  selected_model?: string;
  api_key?: string;
  oauth_token?: string;
  endpoint_url?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  available: boolean;
}

/** Supported auth methods per provider type */
export const PROVIDER_AUTH_METHODS: Record<ProviderType, AuthMethod[]> = {
  openai: ['api_key', 'oauth'],
  anthropic: ['api_key'],
  gemini: ['api_key'],
  local: ['endpoint'],
  chatgpt_web: ['oauth'],
};

/** Default auth method per provider type */
export const PROVIDER_DEFAULT_AUTH: Record<ProviderType, AuthMethod> = {
  openai: 'api_key',
  anthropic: 'api_key',
  gemini: 'api_key',
  local: 'endpoint',
  chatgpt_web: 'oauth',
};

/** Default colors per provider type */
export const PROVIDER_DEFAULT_COLORS: Record<ProviderType, string> = {
  openai: '#10A37F',
  anthropic: '#6B4FBB',
  gemini: '#4285F4',
  local: '#6B7280',
  chatgpt_web: '#1A7F64',
};

/** Display names per provider type */
export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  openai: 'OpenAI API',
  anthropic: 'Anthropic Claude',
  gemini: 'Google Gemini',
  local: 'Local (Ollama / LM Studio)',
  chatgpt_web: 'ChatGPT Web',
};
