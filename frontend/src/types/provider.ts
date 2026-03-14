/**
 * Types for the multi-provider LLM registry (Feature 011)
 */

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'local' | 'chatgpt_web';

export type ProviderStatus = 'disconnected' | 'connected' | 'error' | 'rate_limited';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  color: string;
  status: ProviderStatus;
  selected_model: string | null;
  available_models: string[];
  endpoint_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderRequest {
  name: string;
  type: ProviderType;
  color: string;
  api_key?: string;
  oauth_token?: string;
  endpoint_url?: string;
  selected_model?: string;
}

export interface UpdateProviderRequest {
  name?: string;
  color?: string;
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
  local: 'Local (Ollama)',
  chatgpt_web: 'ChatGPT Web',
};
