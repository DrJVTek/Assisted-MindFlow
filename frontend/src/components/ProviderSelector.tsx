/**
 * Provider Selector Component (Feature 011)
 *
 * Dropdown to pick a provider (and optionally a model) when creating or editing a node.
 * Shows provider color dot, name, and type label.
 */

import { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useProviderStore } from '../stores/providerStore';
import type { ModelInfo } from '../types/provider';
import { PROVIDER_TYPE_LABELS } from '../types/provider';

interface ProviderSelectorProps {
  /** Currently selected provider ID (null = no provider / default) */
  selectedProviderId: string | null;
  /** Called when the user picks a provider */
  onProviderChange: (providerId: string | null) => void;
  /** Currently selected model (optional) */
  selectedModel?: string | null;
  /** Called when the user picks a model */
  onModelChange?: (model: string | null) => void;
  /** Show model selector alongside provider */
  showModelSelector?: boolean;
  /** Compact mode for inline use */
  compact?: boolean;
}

export function ProviderSelector({
  selectedProviderId,
  onProviderChange,
  selectedModel,
  onModelChange,
  showModelSelector = false,
  compact = false,
}: ProviderSelectorProps) {
  const { providers, fetchProviders, getProviderModels } = useProviderStore();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (providers.length === 0) {
      fetchProviders();
    }
  }, [providers.length, fetchProviders]);

  // Fetch models when provider changes
  useEffect(() => {
    if (!selectedProviderId || !showModelSelector) {
      setModels([]);
      return;
    }

    let cancelled = false;
    setLoadingModels(true);

    getProviderModels(selectedProviderId)
      .then((fetchedModels) => {
        if (!cancelled) {
          setModels(fetchedModels);
          // Auto-select first model if none selected
          if (onModelChange && fetchedModels.length > 0 && !selectedModel) {
            const firstAvailable = fetchedModels.find((m) => m.available);
            if (firstAvailable) {
              onModelChange(firstAvailable.id);
            }
          }
        }
      })
      .catch((err) => {
        console.error('Failed to fetch models:', err);
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProviderId, showModelSelector, getProviderModels]);

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  const padding = compact ? '6px 8px' : '8px 12px';
  const fontSize = compact ? '12px' : '13px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Provider dropdown */}
      <div style={{ position: 'relative' }}>
        <select
          value={selectedProviderId || ''}
          onChange={(e) => {
            const value = e.target.value || null;
            onProviderChange(value);
            // Reset model when provider changes
            if (onModelChange) {
              onModelChange(null);
            }
          }}
          style={{
            width: '100%',
            padding,
            fontSize,
            borderRadius: '6px',
            border: '1px solid var(--panel-border)',
            backgroundColor: 'var(--panel-bg)',
            color: 'var(--node-text)',
            cursor: 'pointer',
            appearance: 'none',
            paddingRight: '28px',
          }}
        >
          <option value="">No provider (use default)</option>
          {providers
            .filter((p) => p.status === 'connected' || p.status === 'disconnected')
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({PROVIDER_TYPE_LABELS[p.type]})
              </option>
            ))}
        </select>
        <ChevronDown
          size={14}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--node-text-muted)',
          }}
        />
      </div>

      {/* Provider color indicator */}
      {selectedProvider && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--node-text-muted)',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: selectedProvider.color,
              flexShrink: 0,
            }}
          />
          <span>
            {selectedProvider.status === 'connected' ? 'Connected' : selectedProvider.status}
          </span>
          {selectedProvider.selected_model && (
            <span style={{ marginLeft: '4px' }}>
              · {selectedProvider.selected_model}
            </span>
          )}
        </div>
      )}

      {/* Model dropdown (optional) */}
      {showModelSelector && selectedProviderId && (
        <div style={{ position: 'relative' }}>
          {loadingModels ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding,
                fontSize: '12px',
                color: 'var(--node-text-muted)',
              }}
            >
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              Loading models...
            </div>
          ) : (
            <select
              value={selectedModel || ''}
              onChange={(e) => onModelChange?.(e.target.value || null)}
              style={{
                width: '100%',
                padding,
                fontSize,
                borderRadius: '6px',
                border: '1px solid var(--panel-border)',
                backgroundColor: 'var(--panel-bg)',
                color: 'var(--node-text)',
                cursor: 'pointer',
                appearance: 'none',
                paddingRight: '28px',
              }}
            >
              <option value="">Select model...</option>
              {models.map((m) => (
                <option key={m.id} value={m.id} disabled={!m.available}>
                  {m.name}{!m.available ? ' (unavailable)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
