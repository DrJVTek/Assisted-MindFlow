/**
 * Provider Settings Panel (Feature 011)
 *
 * Manages the provider registry: list, add, edit, delete providers.
 * Each provider has a name, type, color, API key, endpoint, and connection status.
 * Includes shared LLM defaults (temperature, max tokens).
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Check, AlertCircle, Loader2, Pencil, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useProviderStore } from '../stores/providerStore';
import type {
  ProviderType,
  ProviderConfig,
  CreateProviderRequest,
  UpdateProviderRequest,
} from '../types/provider';
import {
  PROVIDER_DEFAULT_COLORS,
  PROVIDER_TYPE_LABELS,
} from '../types/provider';

const PROVIDER_TYPES: ProviderType[] = ['openai', 'anthropic', 'gemini', 'local', 'chatgpt_web'];

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

export function ProviderSettingsPanel() {
  const { providers, loading, fetchProviders, addProvider, updateProvider, deleteProvider, validateProvider } =
    useProviderStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add form state
  const [addType, setAddType] = useState<ProviderType>('openai');
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

  // Confirm delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleTypeChange = (type: ProviderType) => {
    setAddType(type);
    setAddColor(PROVIDER_DEFAULT_COLORS[type]);
    setAddName(PROVIDER_TYPE_LABELS[type]);
  };

  const handleAdd = async () => {
    if (!addName.trim()) return;
    setSubmitting(true);
    try {
      const request: CreateProviderRequest = {
        name: addName,
        type: addType,
        color: addColor,
        selected_model: addModel || undefined,
        ...(addType === 'local'
          ? { endpoint_url: addEndpointUrl }
          : { api_key: addApiKey }),
      };
      await addProvider(request);
      setShowAddForm(false);
      setAddApiKey('');
      setAddName('');
      setAddModel('');
    } catch (err) {
      console.error('Failed to add provider:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (provider: ProviderConfig) => {
    setEditingId(provider.id);
    setExpandedId(provider.id);
    setEditName(provider.name);
    setEditColor(provider.color);
    setEditApiKey(''); // Don't pre-fill credentials
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
      if (editApiKey) request.api_key = editApiKey; // Only send if changed
      if (provider.type === 'local' && editEndpointUrl !== (provider.endpoint_url || '')) {
        request.endpoint_url = editEndpointUrl;
      }

      // Only call API if something changed
      if (Object.keys(request).length > 0) {
        await updateProvider(provider.id, request);
      }
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update provider:', err);
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
    try {
      await deleteProvider(id);
      setConfirmDeleteId(null);
      if (editingId === id) setEditingId(null);
    } catch (err) {
      console.error('Failed to delete provider:', err);
    }
  };

  const handleValidate = async (id: string) => {
    setValidatingId(id);
    try {
      await validateProvider(id);
    } catch (err) {
      console.error('Validation failed:', err);
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

                    {/* Credentials */}
                    {provider.type === 'local' ? (
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
                    ) : provider.type !== 'chatgpt_web' ? (
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
                    ) : null}

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

          {addType === 'local' ? (
            <div>
              <label style={labelStyle}>Endpoint URL</label>
              <input
                type="text"
                value={addEndpointUrl}
                onChange={e => setAddEndpointUrl(e.target.value)}
                style={inputStyle}
                placeholder="http://localhost:11434"
              />
            </div>
          ) : addType !== 'chatgpt_web' ? (
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
          ) : null}

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
