/**
 * Simplified Node Editor Modal
 *
 * Minimal editor for:
 * - Node type (dropdown)
 * - Node status (dropdown)
 * - Collapse toggle with title/summary
 */

import React, { useState, useCallback } from 'react';
import { Save } from 'lucide-react';
import type { Node as GraphNode, NodeType, NodeStatus } from '../types/graph';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';

interface NodeEditorProps {
  node: GraphNode;
  onClose: () => void;
  onSave: (nodeId: string, updates: {
    type?: NodeType;
    status?: NodeStatus;
    collapsed?: boolean;
    summary?: string;
  }) => void;
}

const NODE_TYPES: NodeType[] = [
  'question',
  'answer',
  'note',
  'hypothesis',
  'evaluation',
  'summary',
  'plan',
  'comment',
  'stop',
];

const NODE_STATUSES: NodeStatus[] = [
  'draft',
  'valid',
  'invalid',
  'final',
  'experimental',
];

export function NodeEditor({ node, onClose, onSave }: NodeEditorProps) {
  const [type, setType] = useState<NodeType>(node.type);
  const [status, setStatus] = useState<NodeStatus>(node.meta.status);
  const [collapsed, setCollapsed] = useState(node.collapsed ?? false);
  const [summary, setSummary] = useState(node.summary ?? '');

  const handleSave = useCallback(() => {
    onSave(node.id, {
      type,
      status,
      collapsed,
      summary: summary.trim() || undefined,
    });
    onClose();
  }, [node.id, type, status, collapsed, summary, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSave, onClose]
  );

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title="Edit Node"
      footer={
        <>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={handleKeyDown}>
        {/* Node Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as NodeType)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Node Status */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as NodeStatus)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {NODE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Collapse Toggle */}
        <div>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={collapsed}
              onChange={(e) => setCollapsed(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Collapse node (show only title)
            </span>
          </label>
        </div>

        {/* Summary/Title (shown when collapsed) */}
        {collapsed && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Title / Summary
              <span className="text-xs text-slate-500 ml-2">(shown when collapsed)</span>
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g. Main question about AI ethics"
              maxLength={100}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              {summary.length}/100 characters
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
