/**
 * ModelSelector Component
 *
 * Dropdown populated from detected models via OAuth or API key.
 * Shows selected model, triggers model change on selection.
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';

export interface ModelInfo {
  id: string;
  name: string;
  available: boolean;
}

interface ModelSelectorProps {
  models: ModelInfo[];
  selectedModel: string | null;
  loading?: boolean;
  onSelect: (modelId: string) => void;
  onRefresh?: () => void;
}

export function ModelSelector({
  models,
  selectedModel,
  loading = false,
  onSelect,
  onRefresh,
}: ModelSelectorProps) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-sm)',
        }}
      >
        <label
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--node-text)',
          }}
        >
          Detected Models
          {loading && (
            <span style={{ color: 'var(--node-text-secondary)', fontSize: '12px', marginLeft: '8px' }}>
              (Loading...)
            </span>
          )}
        </label>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid var(--panel-border)',
              backgroundColor: 'transparent',
              color: 'var(--primary-color)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        )}
      </div>
      <select
        value={selectedModel || ''}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading || models.length === 0}
        style={{
          width: '100%',
          padding: 'var(--spacing-md)',
          fontSize: '14px',
          borderRadius: '6px',
          border: '1px solid var(--panel-border)',
          backgroundColor: 'var(--panel-bg)',
          color: 'var(--node-text)',
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {models.length === 0 ? (
          <option value="">No models detected</option>
        ) : (
          models.map((model) => (
            <option key={model.id} value={model.id} disabled={!model.available}>
              {model.name}{!model.available ? ' (unavailable)' : ''}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
