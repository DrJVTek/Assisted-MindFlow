/**
 * MCP Connections Panel (Feature 011 - US5)
 *
 * Manages outbound MCP client connections:
 * - List connected MCP servers with status
 * - Add new connections (stdio/SSE/streamable_http)
 * - Remove connections
 * - Refresh tools
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Check, AlertCircle, Loader2, Plug, Terminal, Globe } from 'lucide-react';
import { useMCPStore } from '../stores/mcpStore';
import type { TransportType, CreateMCPConnectionRequest } from '../types/mcp';

const TRANSPORT_LABELS: Record<TransportType, string> = {
  stdio: 'Stdio (Local)',
  sse: 'SSE (HTTP)',
  streamable_http: 'Streamable HTTP',
};

const TRANSPORT_ICONS: Record<TransportType, typeof Terminal> = {
  stdio: Terminal,
  sse: Globe,
  streamable_http: Plug,
};

export function MCPConnectionsPanel() {
  const { connections, loading, fetchConnections, addConnection, removeConnection, refreshConnection } =
    useMCPStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addTransport, setAddTransport] = useState<TransportType>('stdio');
  const [addCommand, setAddCommand] = useState('');
  const [addArgs, setAddArgs] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleAdd = async () => {
    if (!addName.trim()) return;
    setSubmitting(true);
    try {
      const config: Record<string, any> =
        addTransport === 'stdio'
          ? { command: addCommand, args: addArgs.split(' ').filter(Boolean) }
          : { url: addUrl };

      const request: CreateMCPConnectionRequest = {
        name: addName,
        transport_type: addTransport,
        config,
      };
      await addConnection(request);
      setShowAddForm(false);
      setAddName('');
      setAddCommand('');
      setAddArgs('');
      setAddUrl('');
    } catch (err) {
      console.error('Failed to add MCP connection:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      await refreshConnection(id);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshingId(null);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'connecting':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">MCP Connections</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Server
        </button>
      </div>

      {loading && <div className="text-gray-500 text-sm">Loading connections...</div>}

      {/* Connection list */}
      <div className="space-y-2">
        {connections.map(conn => {
          const TransportIcon = TRANSPORT_ICONS[conn.transport_type as TransportType] || Plug;
          return (
            <div
              key={conn.id}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border"
            >
              <TransportIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{conn.name}</div>
                <div className="text-xs text-gray-500">
                  {TRANSPORT_LABELS[conn.transport_type as TransportType]}
                  {' · '}
                  {conn.tool_count} tools
                </div>
              </div>
              {statusIcon(conn.status)}
              <button
                onClick={() => handleRefresh(conn.id)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Refresh tools"
              >
                {refreshingId === conn.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <button
                onClick={() => removeConnection(conn.id)}
                className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                title="Remove connection"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          );
        })}
        {connections.length === 0 && !loading && (
          <div className="text-gray-500 text-sm text-center py-8">
            No MCP servers connected. Click "Add Server" to connect to an external MCP server.
          </div>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border space-y-3">
          <h4 className="font-medium text-sm">Add MCP Server</h4>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              className="w-full px-2 py-1.5 border rounded text-sm"
              placeholder="My MCP Server"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Transport</label>
            <select
              value={addTransport}
              onChange={e => setAddTransport(e.target.value as TransportType)}
              className="w-full px-2 py-1.5 border rounded text-sm bg-white dark:bg-gray-800"
            >
              <option value="stdio">Stdio (Local command)</option>
              <option value="sse">SSE (HTTP endpoint)</option>
              <option value="streamable_http">Streamable HTTP</option>
            </select>
          </div>

          {addTransport === 'stdio' ? (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Command</label>
                <input
                  type="text"
                  value={addCommand}
                  onChange={e => setAddCommand(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded text-sm"
                  placeholder="npx"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Arguments (space-separated)</label>
                <input
                  type="text"
                  value={addArgs}
                  onChange={e => setAddArgs(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded text-sm"
                  placeholder="-y @modelcontextprotocol/server-filesystem /path"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs text-gray-500 mb-1">URL</label>
              <input
                type="text"
                value={addUrl}
                onChange={e => setAddUrl(e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm"
                placeholder={addTransport === 'sse' ? 'http://localhost:3001/sse' : 'http://localhost:3002/mcp'}
              />
            </div>
          )}

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
              {submitting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
