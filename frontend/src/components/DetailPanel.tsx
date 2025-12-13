/**
 * DetailPanel Component - Displays and edits node details
 *
 * Features:
 * - Shows complete node content
 * - Editable metadata (Type, Status, Importance, Tags)
 * - Shows creation and update timestamps
 * - Lists parent and child connections
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Save, Edit2 } from 'lucide-react';
import type { Node, NodeType, NodeStatus } from '../types/graph';

interface DetailPanelProps {
  node: Node;
  onClose: () => void;
  onUpdate?: (nodeId: string, updates: any) => void;
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

export function DetailPanel({ node, onClose, onUpdate }: DetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState({
    type: node.type,
    status: node.meta.status,
    importance: node.meta.importance,
    tags: node.meta.tags.join(', '),
    content: node.content,
  });

  // Reset state when node changes
  useEffect(() => {
    setEditState({
      type: node.type,
      status: node.meta.status,
      importance: node.meta.importance,
      tags: node.meta.tags.join(', '),
      content: node.content,
    });
    setIsEditing(false);
  }, [node]);

  const handleSave = useCallback(() => {
    if (!onUpdate) return;

    const updates = {
      type: editState.type,
      status: editState.status,
      importance: Number(editState.importance),
      tags: editState.tags.split(',').map(t => t.trim()).filter(Boolean),
      content: editState.content,
    };

    onUpdate(node.id, updates);
    setIsEditing(false);
  }, [node.id, editState, onUpdate]);

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
        backgroundColor: 'var(--panel-bg, white)',
        boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: '1px solid var(--panel-border, #e0e0e0)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--panel-border, #e0e0e0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--panel-header-bg, #f8f9fa)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary, #37474F)',
            }}
          >
            Node Properties
          </h2>
          {!isEditing && onUpdate && (
            <button
              onClick={() => setIsEditing(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--primary-color, #1976D2)',
                padding: '4px',
              }}
              title="Edit Properties"
            >
              <Edit2 size={16} />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isEditing && (
            <button
              onClick={handleSave}
              style={{
                background: 'var(--primary-color, #1976D2)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'white',
                padding: '4px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <Save size={14} /> Save
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-secondary, #78909C)',
            }}
            aria-label="Close detail panel"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
        }}
      >
        {/* Properties Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Type & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #546E7A)' }}>Type</label>
              {isEditing ? (
                <select
                  value={editState.type}
                  onChange={(e) => setEditState({ ...editState, type: e.target.value as NodeType })}
                  style={{
                    padding: '6px',
                    borderRadius: '4px',
                    border: '1px solid var(--input-border, #ccc)',
                    fontSize: '14px',
                  }}
                >
                  {NODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <div style={{
                  padding: '6px 8px',
                  backgroundColor: 'var(--bg-secondary, #f5f5f5)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  textTransform: 'capitalize'
                }}>
                  {node.type}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #546E7A)' }}>Status</label>
              {isEditing ? (
                <select
                  value={editState.status}
                  onChange={(e) => setEditState({ ...editState, status: e.target.value as NodeStatus })}
                  style={{
                    padding: '6px',
                    borderRadius: '4px',
                    border: '1px solid var(--input-border, #ccc)',
                    fontSize: '14px',
                  }}
                >
                  {NODE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <div style={{
                  padding: '6px 8px',
                  backgroundColor: 'var(--bg-secondary, #f5f5f5)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  textTransform: 'capitalize'
                }}>
                  {node.meta.status}
                </div>
              )}
            </div>
          </div>

          {/* Importance & Tags */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #546E7A)' }}>Importance ({Math.round(isEditing ? editState.importance * 100 : node.meta.importance * 100)}%)</label>
            {isEditing ? (
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={editState.importance}
                onChange={(e) => setEditState({ ...editState, importance: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
            ) : (
              <div style={{
                height: '6px',
                width: '100%',
                backgroundColor: '#e0e0e0',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${node.meta.importance * 100}%`,
                  backgroundColor: 'var(--primary-color, #1976D2)'
                }} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #546E7A)' }}>Tags (comma separated)</label>
            {isEditing ? (
              <input
                type="text"
                value={editState.tags}
                onChange={(e) => setEditState({ ...editState, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
                style={{
                  padding: '6px',
                  borderRadius: '4px',
                  border: '1px solid var(--input-border, #ccc)',
                  fontSize: '14px',
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {node.meta.tags.length > 0 ? (
                  node.meta.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: '12px',
                      padding: '2px 8px',
                      backgroundColor: 'var(--tag-bg, #E3F2FD)',
                      color: 'var(--tag-text, #1565C0)',
                      borderRadius: '12px',
                    }}>
                      {tag}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted, #90A4AE)', fontStyle: 'italic' }}>No tags</span>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #546E7A)' }}>Content</label>
            {isEditing ? (
              <textarea
                value={editState.content}
                onChange={(e) => setEditState({ ...editState, content: e.target.value })}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid var(--input-border, #ccc)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  minHeight: '200px',
                  resize: 'vertical',
                }}
              />
            ) : (
              <div style={{
                padding: '12px',
                backgroundColor: 'var(--bg-secondary, #f5f5f5)',
                borderRadius: '4px',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                minHeight: '100px',
              }}>
                {node.content}
              </div>
            )}
          </div>

          {/* Metadata Read-only */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--panel-border, #e0e0e0)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary, #546E7A)', marginBottom: '12px' }}>System Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetadataRow label="ID" value={node.id} monospace />
              <MetadataRow label="Created" value={formatTimestamp(node.meta.created_at)} />
              <MetadataRow label="Updated" value={formatTimestamp(node.meta.updated_at)} />
              <MetadataRow label="Author" value={node.author} />
              <MetadataRow label="Parents" value={`${node.parents.length}`} />
              <MetadataRow label="Children" value={`${node.children.length}`} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function MetadataRow({ label, value, monospace }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted, #78909C)' }}>{label}:</span>
      <span style={{
        fontSize: '12px',
        color: 'var(--text-primary, #37474F)',
        fontFamily: monospace ? 'monospace' : 'inherit',
        backgroundColor: monospace ? 'var(--bg-secondary, #f5f5f5)' : 'transparent',
        padding: monospace ? '2px 4px' : '0',
        borderRadius: monospace ? '2px' : '0',
      }}>
        {value}
      </span>
    </div>
  );
}
