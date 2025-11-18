/**
 * Node Editor Modal
 *
 * Allows users to edit existing nodes:
 * - Content textarea (up to 10,000 characters)
 * - Importance slider (0-100%)
 * - Tags input (comma-separated)
 * - Status dropdown
 *
 * Note: Node type and parent relationships are immutable after creation
 */

import React, { useState, useCallback, useEffect } from 'react';
import { X, AlertCircle, Save } from 'lucide-react';
import type { Node as GraphNode } from '../types/graph';

export type NodeStatus = 'draft' | 'valid' | 'invalid' | 'final' | 'experimental';

interface NodeEditorProps {
  node: GraphNode;
  onClose: () => void;
  onSave: (nodeId: string, updates: {
    content: string;
    importance: number;
    tags: string[];
    status: NodeStatus;
  }) => void;
}

export function NodeEditor({ node, onClose, onSave }: NodeEditorProps) {
  const [content, setContent] = useState(node.content);
  const [importance, setImportance] = useState(Math.round(node.meta.importance * 100));
  const [tags, setTags] = useState(node.meta.tags.join(', '));
  const [status, setStatus] = useState<NodeStatus>(node.meta.status);
  const [errors, setErrors] = useState<{ content?: string }>({});

  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const contentChanged = content !== node.content;
    const importanceChanged = importance !== Math.round(node.meta.importance * 100);
    const tagsChanged = tags !== node.meta.tags.join(', ');
    const statusChanged = status !== node.meta.status;
    setHasChanges(contentChanged || importanceChanged || tagsChanged || statusChanged);
  }, [content, importance, tags, status, node]);

  const validate = useCallback(() => {
    const newErrors: { content?: string } = {};

    if (content.trim().length === 0) {
      newErrors.content = 'Content is required';
    } else if (content.length > 10000) {
      newErrors.content = 'Content must be 10,000 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [content]);

  const handleSave = useCallback(() => {
    if (!validate()) {
      return;
    }

    const tagsArray = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    onSave(node.id, {
      content: content.trim(),
      importance: importance / 100, // Convert 0-100 to 0.0-1.0
      tags: tagsArray,
      status,
    });

    onClose();
  }, [node.id, content, importance, tags, status, onSave, onClose, validate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to save
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSave, onClose]
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          backgroundColor: 'var(--panel-bg)',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--spacing-lg)',
            borderBottom: '1px solid var(--panel-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 600,
                color: 'var(--node-text)',
              }}
            >
              Edit Node
            </h2>
            <div
              style={{
                marginTop: '4px',
                fontSize: '13px',
                color: 'var(--node-text-secondary)',
              }}
            >
              Type: <strong>{node.type}</strong> • ID: {node.id.substring(0, 8)}...
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--node-text-secondary)',
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 'var(--spacing-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-lg)',
          }}
        >
          {/* Content */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--node-text)',
                marginBottom: 'var(--spacing-sm)',
              }}
            >
              Content * ({content.length}/10,000)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter node content here..."
              style={{
                width: '100%',
                minHeight: '200px',
                padding: 'var(--spacing-md)',
                fontSize: '14px',
                borderRadius: '6px',
                border: `1px solid ${errors.content ? '#d32f2f' : 'var(--panel-border)'}`,
                backgroundColor: 'var(--panel-bg)',
                color: 'var(--node-text)',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            {errors.content && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  marginTop: 'var(--spacing-sm)',
                  color: '#d32f2f',
                  fontSize: '13px',
                }}
              >
                <AlertCircle size={14} />
                <span>{errors.content}</span>
              </div>
            )}
          </div>

          {/* Importance Slider */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--node-text)',
                marginBottom: 'var(--spacing-sm)',
              }}
            >
              Importance: {importance}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'var(--primary-color)',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--node-text-secondary)',
                marginTop: 'var(--spacing-xs)',
              }}
            >
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--node-text)',
                marginBottom: 'var(--spacing-sm)',
              }}
            >
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., research, hypothesis, important"
              style={{
                width: '100%',
                padding: 'var(--spacing-md)',
                fontSize: '14px',
                borderRadius: '6px',
                border: '1px solid var(--panel-border)',
                backgroundColor: 'var(--panel-bg)',
                color: 'var(--node-text)',
              }}
            />
          </div>

          {/* Status */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--node-text)',
                marginBottom: 'var(--spacing-sm)',
              }}
            >
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as NodeStatus)}
              style={{
                width: '100%',
                padding: 'var(--spacing-md)',
                fontSize: '14px',
                borderRadius: '6px',
                border: '1px solid var(--panel-border)',
                backgroundColor: 'var(--panel-bg)',
                color: 'var(--node-text)',
              }}
            >
              <option value="draft">Draft</option>
              <option value="valid">Valid</option>
              <option value="invalid">Invalid</option>
              <option value="final">Final</option>
              <option value="experimental">Experimental</option>
            </select>
          </div>

          {/* Metadata Display */}
          <div
            style={{
              padding: 'var(--spacing-md)',
              backgroundColor: 'rgba(0, 0, 0, 0.03)',
              borderRadius: '6px',
              fontSize: '12px',
              color: 'var(--node-text-secondary)',
            }}
          >
            <div><strong>Created:</strong> {new Date(node.meta.created_at).toLocaleString()}</div>
            <div><strong>Updated:</strong> {new Date(node.meta.updated_at).toLocaleString()}</div>
            <div><strong>Author:</strong> {node.author}</div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: 'var(--spacing-lg)',
            borderTop: '1px solid var(--panel-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              color: 'var(--node-text-secondary)',
            }}
          >
            {hasChanges && '• Unsaved changes'}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 'var(--spacing-md)',
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px solid var(--panel-border)',
                backgroundColor: 'transparent',
                color: 'var(--node-text)',
                cursor: 'pointer',
                transition: 'background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: hasChanges ? 'var(--primary-color)' : '#ccc',
                color: 'white',
                cursor: hasChanges ? 'pointer' : 'not-allowed',
                transition: 'background-color var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
              }}
              onMouseEnter={(e) => {
                if (hasChanges) {
                  e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (hasChanges) {
                  e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                }
              }}
            >
              <Save size={16} />
              Save Changes (Ctrl+Enter)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
