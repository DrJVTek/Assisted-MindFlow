/**
 * Provider Settings Panel
 *
 * Manages the provider registry: list, add, edit, delete providers.
 * Each provider has a name, type, auth method, color, credentials, and connection status.
 *
 * Auth methods:
 * - api_key: API key input (OpenAI, Claude, Gemini, Mistral, Groq)
 * - oauth: Browser-based OAuth login (ChatGPT, future providers)
 * - endpoint: Local endpoint URL (Ollama, LM Studio, vLLM)
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Check, AlertCircle, Loader2, Pencil, X, ChevronDown, ChevronUp, LogIn, LogOut, Key, Globe, Shield } from 'lucide-react';
import { useProviderStore } from '../stores/providerStore';
import { logEvent } from '../stores/logStore';
import type {
  ProviderType,
  AuthMethod,
  ProviderConfig,
  CreateProviderRequest,
  UpdateProviderRequest,
} from '../types/provider';
import {
  PROVIDER_DEFAULT_COLORS,
  PROVIDER_TYPE_LABELS,
  PROVIDER_AUTH_METHODS,
  PROVIDER_DEFAULT_AUTH,
} from '../types/provider';

const PROVIDER_TYPES: ProviderType[] = ['openai', 'anthropic', 'gemini', 'local', 'chatgpt_web'];

const AUTH_METHOD_LABELS: Record<AuthMethod, string> = {
  api_key: 'API Key',
  oauth: 'OAuth Login',
  endpoint: 'Local Endpoint',
};

const AUTH_METHOD_ICONS: Record<AuthMethod, typeof Key> = {
  api_key: Key,
  oauth: Shield,
  endpoint: Globe,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid var(--panel-border)',
  backgroundColor: 'var(--panel-bg-secondary)',
  color: 'var(--node-text)',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--node-text-secondary)',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

// ── Inline OAuth Control ──────────────────────────────────────────

function ProviderOAuthControl({ provider }: { provider: ProviderConfig }) {
  const { oauthLogin, oauthLogout, oauthFetchStatus, oauthStartDeviceCode, oauthLoading, oauthError, deviceCodes } =
    useProviderStore();

  const isLoading = oauthLoading[provider.id] || false;
  const error = oauthError[provider.id] || null;
  const deviceCode = deviceCodes[provider.id] || null;
  const oauthStatus = provider.oauth_status || 'not_connected';

  useEffect(() => {
    if (provider.auth_method === 'oauth') {
      oauthFetchStatus(provider.id);
    }
  }, [provider.id, provider.auth_method]);

  // Polling when connected
  useEffect(() => {
    if (oauthStatus !== 'connected') return;
    const interval = setInterval(() => oauthFetchStatus(provider.id), 60000);
    return () => clearInterval(interval);
  }, [oauthStatus, provider.id]);

  if (isLoading && deviceCode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Awaiting authorization...</span>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded text-center">
          <div className="text-xs text-gray-500 mb-1">Enter this code at</div>
          <a href={deviceCode.verificationUri} target="_blank" rel="noreferrer"
            className="text-blue-600 underline text-sm">{deviceCode.verificationUri}</a>
          <div className="text-2xl font-mono font-bold mt-2 tracking-widest">{deviceCode.userCode}</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (oauthStatus === 'connected') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm">
          <Check className="w-4 h-4 text-green-600" />
          <div className="flex-1">
            <span className="text-green-700 dark:text-green-400 font-medium">Connected</span>
            {provider.oauth_email && (
              <span className="text-gray-500 ml-2 text-xs">{provider.oauth_email}</span>
            )}
          </div>
          <button
            onClick={() => oauthLogout(provider.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          >
            <LogOut className="w-3 h-3" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  if (oauthStatus === 'session_expired') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          <span className="text-yellow-700 dark:text-yellow-400">Session expired</span>
        </div>
        <button
          onClick={() => oauthLogin(provider.id)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <LogIn className="w-4 h-4" /> Sign in again
        </button>
      </div>
    );
  }

  // Not connected
  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600">
          <AlertCircle className="w-3 h-3" /> {error}
        </div>
      )}
      <button
        onClick={() => oauthLogin(provider.id)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white rounded hover:opacity-90"
        style={{ backgroundColor: provider.color }}
      >
        <LogIn className="w-4 h-4" /> Sign in with {PROVIDER_TYPE_LABELS[provider.type]}
      </button>
      <button
        onClick={() => oauthStartDeviceCode(provider.id)}
        className="w-full text-center text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
      >
        Use device code (headless)
      </button>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────

export function ProviderSettingsPanel() {
  const { providers, loading, fetchProviders, addProvider, updateProvider, deleteProvider, validateProvider } =
    useProviderStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add form state
  const [addType, setAddType] = useState<ProviderType>('openai');
  const [addAuthMethod, setAddAuthMethod] = useState<AuthMethod>('api_key');
  const [addName, setAddName] = useState('');
  const [addColor, setAddColor] = useState(PROVIDER_DEFAULT_COLORS.openai);
  const [addApiKey, setAddApiKey] = useState('');
  const [addEndpointUrl, setAddEndpointUrl] = useState('http://localhost:11434');
  const [addModel, setAddModel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editEndpointUrl, setEditEndpointUrl] = useState('');
  const [editModel, setEditModel] = useState('');
  const [saving, setSaving] = useState(false);

  // Validation
  const [validatingId, setValidatingId] = useState<string | null>(null);
  // Per-provider validation error messages, keyed by provider id.
  // Cleared when the user edits the provider or re-validates successfully.
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Confirm delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleTypeChange = (type: ProviderType) => {
    setAddType(type);
    setAddColor(PROVIDER_DEFAULT_COLORS[type]);
    setAddName(PROVIDER_TYPE_LABELS[type]);
    const defaultAuth = PROVIDER_DEFAULT_AUTH[type];
    setAddAuthMethod(defaultAuth);
    if (type === 'local') {
      setAddEndpointUrl('http://localhost:11434');
    }
  };

  const handleAdd = async () => {
    if (!addName.trim()) return;
    setSubmitting(true);
    try {
      const request: CreateProviderRequest = {
        name: addName,
        type: addType,
        auth_method: addAuthMethod,
        color: addColor,
        selected_model: addModel || undefined,
      };

      if (addAuthMethod === 'api_key') {
        request.api_key = addApiKey;
      } else if (addAuthMethod === 'endpoint') {
        request.endpoint_url = addEndpointUrl;
      }
      // OAuth: no credentials at creation time

      await addProvider(request);
      logEvent('provider', 'success', `Added provider "${addName}" (${addType})`);
      setShowAddForm(false);
      setAddApiKey('');
      setAddName('');
      setAddModel('');
    } catch (err) {
      console.error('Failed to add provider:', err);
      logEvent('provider', 'error', `Failed to add provider "${addName}"`, (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (provider: ProviderConfig) => {
    setEditingId(provider.id);
    setExpandedId(provider.id);
    setEditName(provider.name);
    setEditColor(provider.color);
    setEditApiKey('');
    setEditEndpointUrl(provider.endpoint_url || '');
    setEditModel(provider.selected_model || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (provider: ProviderConfig) => {
    setSaving(true);
    try {
      const request: UpdateProviderRequest = {};
      if (editName !== provider.name) request.name = editName;
      if (editColor !== provider.color) request.color = editColor;
      if (editModel !== (provider.selected_model || '')) request.selected_model = editModel;
      if (editApiKey) request.api_key = editApiKey;
      if (provider.auth_method === 'endpoint' && editEndpointUrl !== (provider.endpoint_url || '')) {
        request.endpoint_url = editEndpointUrl;
      }

      if (Object.keys(request).length > 0) {
        await updateProvider(provider.id, request);
        logEvent('provider', 'success', `Updated provider "${provider.name}"`);
      }
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update provider:', err);
      logEvent('provider', 'error', `Failed to update provider "${provider.name}"`, (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    const name = providers.find((p) => p.id === id)?.name ?? id.slice(0, 8);
    try {
      await deleteProvider(id);
      logEvent('provider', 'success', `Deleted provider "${name}"`);
      setConfirmDeleteId(null);
      if (editingId === id) setEditingId(null);
    } catch (err) {
      console.error('Failed to delete provider:', err);
      logEvent('provider', 'error', `Failed to delete provider "${name}"`, (err as Error).message);
    }
  };

  const handleValidate = async (id: string) => {
    const name = providers.find((p) => p.id === id)?.name ?? id.slice(0, 8);
    setValidatingId(id);
    // Clear any previous error for this provider
    setValidationErrors((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    try {
      await validateProvider(id);
      const refreshed = useProviderStore.getState().providers.find((p) => p.id === id);
      const modelCount = refreshed?.available_models?.length ?? 0;
      logEvent('provider', 'success', `Validated "${name}" — ${modelCount} model${modelCount !== 1 ? 's' : ''} available`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      setValidationErrors((prev) => ({ ...prev, [id]: message }));
      logEvent('provider', 'error', `Validation failed for "${name}"`, message);
    } finally {
      setValidatingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'rate_limited':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-400" />;
    }
  };

  const isEditing = (id: string) => editingId === id;

  const availableAuthMethods = PROVIDER_AUTH_METHODS[addType] || ['api_key'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">LLM Providers</h3>
        <button
          onClick={() => {
            handleTypeChange('openai');
            setShowAddForm(true);
          }}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {loading && <div className="text-gray-500 text-sm">Loading providers...</div>}

      {/* Provider list */}
      <div className="space-y-2">
        {providers.map(provider => (
          <div
            key={provider.id}
            className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden"
            style={{ borderLeftColor: provider.color, borderLeftWidth: '4px' }}
          >
            {/* Provider header row */}
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
              onClick={() => toggleExpand(provider.id)}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: provider.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{provider.name}</div>
                <div className="text-xs text-gray-500">
                  {PROVIDER_TYPE_LABELS[provider.type]}
                  {' · '}
                  {AUTH_METHOD_LABELS[provider.auth_method]}
                  {provider.selected_model && ` · ${provider.selected_model}`}
                </div>
              </div>
              {statusIcon(provider.status)}
              <button
                onClick={(e) => { e.stopPropagation(); handleValidate(provider.id); }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Test connection"
              >
                {validatingId === provider.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(provider); }}
                className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                title="Edit provider"
              >
                <Pencil className="w-4 h-4 text-blue-400" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(provider.id); }}
                className={`p-1 rounded ${
                  confirmDeleteId === provider.id
                    ? 'bg-red-100 dark:bg-red-900/40'
                    : 'hover:bg-red-50 dark:hover:bg-red-900/20'
                }`}
                title={confirmDeleteId === provider.id ? 'Click again to confirm' : 'Delete provider'}
              >
                <Trash2 className={`w-4 h-4 ${confirmDeleteId === provider.id ? 'text-red-600' : 'text-red-400'}`} />
              </button>
              {expandedId === provider.id ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>

            {/* Inline validation error — always visible when present, so
                the user doesn't have to expand or open the dev console to
                know why the status icon turned red. */}
            {validationErrors[provider.id] && (
              <div
                className="px-3 pb-2 text-xs text-red-600 dark:text-red-400 flex items-start gap-2"
                style={{ lineHeight: 1.4 }}
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{validationErrors[provider.id]}</span>
              </div>
            )}

            {/* Expanded detail / edit form */}
            {expandedId === provider.id && (
              <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700">
                {isEditing(provider.id) ? (
                  /* Edit mode */
                  <div className="space-y-3 pt-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label style={labelStyle}>Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Color</label>
                        <input
                          type="color"
                          value={editColor}
                          onChange={e => setEditColor(e.target.value)}
                          className="w-10 h-[34px] border rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Model */}
                    <div>
                      <label style={labelStyle}>Model</label>
                      {provider.available_models.length > 0 ? (
                        <select
                          value={editModel}
                          onChange={e => setEditModel(e.target.value)}
                          style={{ ...inputStyle, cursor: 'pointer' }}
                        >
                          <option value="">Default</option>
                          {provider.available_models.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={editModel}
                          onChange={e => setEditModel(e.target.value)}
                          placeholder="e.g. gpt-4, claude-3-opus..."
                          style={inputStyle}
                        />
                      )}
                    </div>

                    {/* Credentials based on auth method */}
                    {provider.auth_method === 'endpoint' && (
                      <div>
                        <label style={labelStyle}>Endpoint URL</label>
                        <input
                          type="text"
                          value={editEndpointUrl}
                          onChange={e => setEditEndpointUrl(e.target.value)}
                          placeholder="http://localhost:11434"
                          style={inputStyle}
                        />
                      </div>
                    )}
                    {provider.auth_method === 'api_key' && (
                      <div>
                        <label style={labelStyle}>API Key (leave empty to keep current)</label>
                        <input
                          type="password"
                          value={editApiKey}
                          onChange={e => setEditApiKey(e.target.value)}
                          placeholder="••••••••"
                          style={inputStyle}
                        />
                      </div>
                    )}
                    {provider.auth_method === 'oauth' && (
                      <div>
                        <label style={labelStyle}>OAuth Connection</label>
                        <ProviderOAuthControl provider={provider} />
                      </div>
                    )}

                    {/* Save / Cancel */}
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(provider)}
                        disabled={saving || !editName.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Read-only detail view */
                  <div className="space-y-2 pt-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type</span>
                      <span>{PROVIDER_TYPE_LABELS[provider.type]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Auth</span>
                      <span>{AUTH_METHOD_LABELS[provider.auth_method]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Model</span>
                      <span>{provider.selected_model || 'Default'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <span className={
                        provider.status === 'connected' ? 'text-green-600' :
                        provider.status === 'error' ? 'text-red-600' :
                        'text-gray-500'
                      }>
                        {provider.status}
                      </span>
                    </div>
                    {provider.endpoint_url && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Endpoint</span>
                        <span className="truncate ml-4">{provider.endpoint_url}</span>
                      </div>
                    )}
                    {provider.auth_method === 'oauth' && (
                      <div className="pt-1">
                        <ProviderOAuthControl provider={provider} />
                      </div>
                    )}
                    {provider.available_models.length > 0 && (
                      <div>
                        <span className="text-gray-500">Available models</span>
                        <div className="text-xs text-gray-400 mt-1">
                          {provider.available_models.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {providers.length === 0 && !loading && (
          <div className="text-gray-500 text-sm text-center py-8">
            No providers registered. Click "Add" to get started.
          </div>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border space-y-3">
          <h4 className="font-medium text-sm">Add New Provider</h4>

          <div>
            <label style={labelStyle}>Type</label>
            <select
              value={addType}
              onChange={e => handleTypeChange(e.target.value as ProviderType)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {PROVIDER_TYPES.map(t => (
                <option key={t} value={t}>
                  {PROVIDER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Auth method selector (only show if multiple options) */}
          {availableAuthMethods.length > 1 && (
            <div>
              <label style={labelStyle}>Authentication</label>
              <div className="flex gap-2">
                {availableAuthMethods.map(method => {
                  const Icon = AUTH_METHOD_ICONS[method];
                  return (
                    <button
                      key={method}
                      onClick={() => setAddAuthMethod(method)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded border ${
                        addAuthMethod === method
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {AUTH_METHOD_LABELS[method]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1">
              <label style={labelStyle}>Name</label>
              <input
                type="text"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                style={inputStyle}
                placeholder="My Provider"
              />
            </div>
            <div>
              <label style={labelStyle}>Color</label>
              <input
                type="color"
                value={addColor}
                onChange={e => setAddColor(e.target.value)}
                className="w-10 h-8 border rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Credentials input based on auth method */}
          {addAuthMethod === 'endpoint' && (
            <div>
              <label style={labelStyle}>Endpoint URL</label>
              <input
                type="text"
                value={addEndpointUrl}
                onChange={e => setAddEndpointUrl(e.target.value)}
                style={inputStyle}
                placeholder="http://localhost:11434 or http://localhost:1234/v1"
              />
            </div>
          )}
          {addAuthMethod === 'api_key' && (
            <div>
              <label style={labelStyle}>API Key</label>
              <input
                type="password"
                value={addApiKey}
                onChange={e => setAddApiKey(e.target.value)}
                style={inputStyle}
                placeholder="sk-..."
              />
            </div>
          )}
          {addAuthMethod === 'oauth' && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded text-sm text-blue-700 dark:text-blue-400">
              OAuth login will be available after creating the provider. Click "Add" first, then sign in.
            </div>
          )}

          <div>
            <label style={labelStyle}>Model (optional)</label>
            <input
              type="text"
              value={addModel}
              onChange={e => setAddModel(e.target.value)}
              style={inputStyle}
              placeholder="e.g. gpt-4, claude-3-opus..."
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={submitting || !addName.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
