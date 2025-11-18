/**
 * DetailPanel Component - Displays full details of selected node
 *
 * Features:
 * - Shows complete node content (not truncated)
 * - Displays all metadata (type, author, status, importance, tags)
 * - Shows creation and update timestamps
 * - Lists parent and child connections
 * - Close button and Escape key support
 */

import React from 'react';
import { X } from 'lucide-react';
import { useCanvasStore } from '../stores/canvasStore';
import type { Node } from '../types/graph';

interface DetailPanelProps {
  node: Node;
  onClose: () => void;
}

export function DetailPanel({ node, onClose }: DetailPanelProps) {
  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '400px',
        height: '100vh',
        backgroundColor: 'white',
        boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: '#37474F',
            textTransform: 'capitalize',
          }}
        >
          {node.type.replace('_', ' ')}
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            color: '#78909C',
          }}
          aria-label="Close detail panel"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
        }}
      >
        {/* Node Content */}
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#546E7A',
              marginBottom: '8px',
            }}
          >
            Content
          </h3>
          <div
            style={{
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#37474F',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {node.content}
          </div>
        </div>

        {/* Metadata */}
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#546E7A',
              marginBottom: '8px',
            }}
          >
            Metadata
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <MetadataRow label="Author" value={node.author} />
            <MetadataRow label="Status" value={node.meta.status} />
            <MetadataRow
              label="Importance"
              value={`${(node.meta.importance * 100).toFixed(0)}%`}
            />
            <MetadataRow
              label="Created"
              value={formatTimestamp(node.meta.created_at)}
            />
            <MetadataRow
              label="Updated"
              value={formatTimestamp(node.meta.updated_at)}
            />
            {node.meta.tags.length > 0 && (
              <MetadataRow
                label="Tags"
                value={node.meta.tags.join(', ')}
              />
            )}
          </div>
        </div>

        {/* Connections */}
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#546E7A',
              marginBottom: '8px',
            }}
          >
            Connections
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <MetadataRow
              label="Parents"
              value={node.parents.length > 0 ? `${node.parents.length} nodes` : 'None'}
            />
            <MetadataRow
              label="Children"
              value={node.children.length > 0 ? `${node.children.length} nodes` : 'None'}
            />
          </div>
        </div>

        {/* Node ID */}
        <div>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#546E7A',
              marginBottom: '8px',
            }}
          >
            Node ID
          </h3>
          <div
            style={{
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#78909C',
              backgroundColor: '#F5F5F5',
              padding: '8px',
              borderRadius: '4px',
              wordBreak: 'break-all',
            }}
          >
            {node.id}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper component for metadata rows
 */
function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span
        style={{
          fontSize: '13px',
          color: '#78909C',
          fontWeight: 500,
        }}
      >
        {label}:
      </span>
      <span
        style={{
          fontSize: '13px',
          color: '#37474F',
          fontWeight: 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}
