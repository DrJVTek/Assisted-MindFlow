/**
 * Plugin Manager Panel
 *
 * Lists all loaded plugins from GET /api/plugins, grouped by source
 * (core / community), with per-plugin actions:
 *   - Reload registry (global)
 *   - Upload new plugin (.zip → community/)
 *   - Delete plugin (community only)
 *   - Check update (stub)
 *
 * Core plugins are shown for visibility but cannot be deleted from the
 * UI — the backend returns 403 on those. The refresh button re-fetches
 * the list and asks the backend to rescan the plugin directories.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Trash2, Upload, AlertCircle, CheckCircle2, Loader2, Package, Info } from 'lucide-react';
import { useNodeTypesStore } from '../stores/nodeTypesStore';

interface PluginListItem {
  name: string;
  version: string;
  author: string | null;
  description: string | null;
  category: string | null;
  path: string;
  source: 'core' | 'community' | 'unknown';
  node_ids: string[];
  load_error: string | null;
}

interface PluginListResponse {
  plugins: PluginListItem[];
  total: number;
  core_count: number;
  community_count: number;
}

interface UpdateCheckResponse {
  plugin_name: string;
  current_version: string;
  latest_version: string;
  update_available: boolean;
  message: string;
}

type Banner = { kind: 'success' | 'error' | 'info'; text: string } | null;

export function PluginManagerPanel() {
  const [plugins, setPlugins] = useState<PluginListItem[]>([]);
  const [counts, setCounts] = useState<{ total: number; core: number; community: number }>({
    total: 0,
    core: 0,
    community: 0,
  });
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [busyFor, setBusyFor] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<Record<string, UpdateCheckResponse>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // After any registry change, refresh the nodeTypesStore so the canvas
  // node picker immediately reflects the new set of available nodes.
  const refetchNodeTypes = useNodeTypesStore((s) => s.fetchNodeTypes);
  const forceRefreshNodeTypes = useCallback(() => {
    // Bypass the isLoaded cache — after a plugin reload we NEED fresh data
    useNodeTypesStore.setState({ isLoaded: false });
    refetchNodeTypes();
  }, [refetchNodeTypes]);

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch('/api/plugins');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: PluginListResponse = await res.json();
      setPlugins(data.plugins);
      setCounts({
        total: data.total,
        core: data.core_count,
        community: data.community_count,
      });
    } catch (err) {
      setBanner({
        kind: 'error',
        text: `Failed to load plugins: ${(err as Error).message}`,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const handleReload = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch('/api/plugins/reload', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setBanner({ kind: 'success', text: data.message });
      forceRefreshNodeTypes();
      await fetchPlugins();
    } catch (err) {
      setBanner({ kind: 'error', text: `Reload failed: ${(err as Error).message}` });
      setLoading(false);
    }
  }, [fetchPlugins, forceRefreshNodeTypes]);

  const handleDelete = useCallback(
    async (pluginName: string) => {
      if (!confirm(`Delete community plugin "${pluginName}"? This removes it from disk.`)) {
        return;
      }
      setBusyFor(pluginName);
      setBanner(null);
      try {
        const res = await fetch(`/api/plugins/${encodeURIComponent(pluginName)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setBanner({ kind: 'success', text: data.message });
        forceRefreshNodeTypes();
        await fetchPlugins();
      } catch (err) {
        setBanner({ kind: 'error', text: `Delete failed: ${(err as Error).message}` });
      } finally {
        setBusyFor(null);
      }
    },
    [fetchPlugins, forceRefreshNodeTypes]
  );

  const handleCheckUpdate = useCallback(async (pluginName: string) => {
    setBusyFor(pluginName);
    setBanner(null);
    try {
      const res = await fetch(`/api/plugins/${encodeURIComponent(pluginName)}/update`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      const data: UpdateCheckResponse = await res.json();
      setUpdateInfo((prev) => ({ ...prev, [pluginName]: data }));
      setBanner({
        kind: data.update_available ? 'info' : 'success',
        text: data.message,
      });
    } catch (err) {
      setBanner({ kind: 'error', text: `Update check failed: ${(err as Error).message}` });
    } finally {
      setBusyFor(null);
    }
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = ''; // allow re-upload of the same file name

      if (!file.name.toLowerCase().endsWith('.zip')) {
        setBanner({ kind: 'error', text: 'Plugin upload must be a .zip file' });
        return;
      }

      setLoading(true);
      setBanner(null);
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/plugins/upload', {
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setBanner({ kind: 'success', text: data.message });
        forceRefreshNodeTypes();
        await fetchPlugins();
      } catch (err) {
        setBanner({ kind: 'error', text: `Upload failed: ${(err as Error).message}` });
        setLoading(false);
      }
    },
    [fetchPlugins, forceRefreshNodeTypes]
  );

  const corePlugins = plugins.filter((p) => p.source === 'core');
  const communityPlugins = plugins.filter((p) => p.source === 'community');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header with counts and actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--node-text)' }}>
            Installed plugins: <span style={{ color: 'var(--primary-color)' }}>{counts.total}</span>
            <span style={{ fontSize: '11px', color: 'var(--node-text-muted)', marginLeft: '8px' }}>
              ({counts.core} core · {counts.community} community)
            </span>
          </div>
        </div>
        <button
          onClick={handleReload}
          disabled={loading}
          style={actionButtonStyle('primary', loading)}
          title="Rescan plugin directories and reload the registry"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Reload
        </button>
        <button
          onClick={handleUploadClick}
          disabled={loading}
          style={actionButtonStyle('secondary', loading)}
          title="Upload a .zip containing a plugin directory"
        >
          <Upload size={14} />
          Upload .zip
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* Banner (success/error/info) */}
      {banner && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            backgroundColor:
              banner.kind === 'success'
                ? 'rgba(34, 197, 94, 0.12)'
                : banner.kind === 'error'
                ? 'rgba(239, 68, 68, 0.12)'
                : 'rgba(59, 130, 246, 0.12)',
            border: `1px solid ${
              banner.kind === 'success'
                ? 'rgba(34, 197, 94, 0.4)'
                : banner.kind === 'error'
                ? 'rgba(239, 68, 68, 0.4)'
                : 'rgba(59, 130, 246, 0.4)'
            }`,
            color:
              banner.kind === 'success'
                ? '#22c55e'
                : banner.kind === 'error'
                ? '#ef4444'
                : '#3b82f6',
          }}
        >
          {banner.kind === 'success' ? (
            <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          ) : banner.kind === 'error' ? (
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          ) : (
            <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Core plugins */}
      {corePlugins.length > 0 && (
        <PluginGroup
          title="Core plugins"
          description="Bundled with MindFlow. Always loaded, cannot be deleted from the UI."
          plugins={corePlugins}
          busyFor={busyFor}
          updateInfo={updateInfo}
          onDelete={null}
          onCheckUpdate={handleCheckUpdate}
        />
      )}

      {/* Community plugins */}
      <PluginGroup
        title="Community plugins"
        description="User-installed plugins in plugins/community/. Full trust, can be removed from the UI."
        plugins={communityPlugins}
        busyFor={busyFor}
        updateInfo={updateInfo}
        onDelete={handleDelete}
        onCheckUpdate={handleCheckUpdate}
        emptyMessage="No community plugins installed yet. Upload a .zip to add one."
      />
    </div>
  );
}


// ─── Subcomponents ──────────────────────────────────────────────────

function PluginGroup({
  title,
  description,
  plugins,
  busyFor,
  updateInfo,
  onDelete,
  onCheckUpdate,
  emptyMessage,
}: {
  title: string;
  description: string;
  plugins: PluginListItem[];
  busyFor: string | null;
  updateInfo: Record<string, UpdateCheckResponse>;
  onDelete: ((name: string) => void) | null;
  onCheckUpdate: (name: string) => void;
  emptyMessage?: string;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--node-text-secondary)',
        }}>
          {title}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--node-text-muted)' }}>
          {description}
        </div>
      </div>

      {plugins.length === 0 && emptyMessage && (
        <div style={{
          padding: '16px',
          borderRadius: '6px',
          border: '1px dashed var(--panel-border)',
          fontSize: '12px',
          color: 'var(--node-text-muted)',
          textAlign: 'center',
        }}>
          {emptyMessage}
        </div>
      )}

      {plugins.map((p) => (
        <PluginCard
          key={p.name}
          plugin={p}
          busy={busyFor === p.name}
          updateInfo={updateInfo[p.name]}
          onDelete={onDelete}
          onCheckUpdate={onCheckUpdate}
        />
      ))}
    </section>
  );
}

function PluginCard({
  plugin,
  busy,
  updateInfo,
  onDelete,
  onCheckUpdate,
}: {
  plugin: PluginListItem;
  busy: boolean;
  updateInfo?: UpdateCheckResponse;
  onDelete: ((name: string) => void) | null;
  onCheckUpdate: (name: string) => void;
}) {
  const hasError = Boolean(plugin.load_error);

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: '6px',
        border: hasError
          ? '1px solid rgba(239, 68, 68, 0.5)'
          : '1px solid var(--panel-border)',
        backgroundColor: 'var(--panel-bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Package size={16} style={{ color: 'var(--node-text-secondary)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--node-text)' }}>
              {plugin.name}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--node-text-muted)' }}>
              v{plugin.version}
            </span>
            {plugin.author && (
              <span style={{ fontSize: '11px', color: 'var(--node-text-muted)' }}>
                · by {plugin.author}
              </span>
            )}
          </div>
          {plugin.description && (
            <div style={{ fontSize: '11px', color: 'var(--node-text-muted)', marginTop: '2px' }}>
              {plugin.description}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={() => onCheckUpdate(plugin.name)}
            disabled={busy}
            style={actionButtonStyle('secondary', busy)}
            title="Check for updates (stub)"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Update
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(plugin.name)}
              disabled={busy}
              style={{ ...actionButtonStyle('danger', busy) }}
              title="Delete plugin from disk"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Node IDs exposed by this plugin */}
      {plugin.node_ids.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
          {plugin.node_ids.map((nid) => (
            <span
              key={nid}
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'var(--panel-bg)',
                color: 'var(--node-text-secondary)',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {nid}
            </span>
          ))}
        </div>
      )}

      {/* Load error */}
      {plugin.load_error && (
        <div style={{
          fontSize: '11px',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
          marginTop: '4px',
        }}>
          <AlertCircle size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{plugin.load_error}</span>
        </div>
      )}

      {/* Update check result */}
      {updateInfo && (
        <div style={{
          fontSize: '11px',
          color: updateInfo.update_available ? '#3b82f6' : 'var(--node-text-muted)',
          marginTop: '2px',
        }}>
          {updateInfo.update_available
            ? `Update available: v${updateInfo.latest_version}`
            : `Up to date (v${updateInfo.current_version})`}
        </div>
      )}
    </div>
  );
}


// ─── Style helpers ──────────────────────────────────────────────────

function actionButtonStyle(
  variant: 'primary' | 'secondary' | 'danger',
  disabled: boolean
): React.CSSProperties {
  const baseColors = {
    primary: { bg: 'var(--primary-color)', color: 'white', border: 'var(--primary-color)' },
    secondary: { bg: 'transparent', color: 'var(--node-text)', border: 'var(--panel-border)' },
    danger: { bg: 'transparent', color: '#ef4444', border: 'rgba(239, 68, 68, 0.4)' },
  };
  const c = baseColors[variant];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 500,
    borderRadius: '5px',
    border: `1px solid ${c.border}`,
    backgroundColor: c.bg,
    color: c.color,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'opacity 0.15s',
  };
}
