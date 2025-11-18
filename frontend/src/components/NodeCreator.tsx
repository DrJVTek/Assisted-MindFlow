/**
 * Node Creator Modal
 *
 * Allows users to create new nodes with:
 * - Type selection (question, answer, hypothesis, etc.)
 * - Content textarea (up to 10,000 characters)
 * - Importance slider (0-100%)
 * - Tags input (comma-separated)
 * - Status dropdown
 */

import React, { useState, useCallback } from 'react';
import { X, AlertCircle } from 'lucide-react';

export type NodeType =
  | 'question'
  | 'answer'
  | 'note'
  | 'hypothesis'
  | 'evaluation'
  | 'summary'
  | 'plan'
  | 'group_meta'
  | 'comment'
  | 'stop';

export type NodeStatus = 'draft' | 'valid' | 'invalid' | 'final' | 'experimental';

interface NodeCreatorProps {
  onClose: () => void;
  onSave: (nodeData: {
    type: NodeType;
    content: string;
    importance: number;
    tags: string[];
    status: NodeStatus;
    parentId?: string;
  }) => void;
  parentId?: string; // If creating a child node
}

export function NodeCreator({ onClose, onSave, parentId }: NodeCreatorProps) {
  const [type, setType] = useState<NodeType>('question');
  const [content, setContent] = useState('');
  const [importance, setImportance] = useState(50);
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<NodeStatus>('draft');
  const [errors, setErrors] = useState<{ content?: string }>({});

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

    onSave({
      type,
      content: content.trim(),
      importance: importance / 100, // Convert 0-100 to 0.0-1.0
      tags: tagsArray,
      status,
      parentId,
    });

    onClose();
  }, [type, content, importance, tags, status, parentId, onSave, onClose, validate]);

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
          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--node-text)',
            }}
          >
            {parentId ? 'Create Child Node' : 'Create New Node'}
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
          {/* Node Type */}
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
              Node Type *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as NodeType)}
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
              <option value="question">Question</option>
              <option value="answer">Answer</option>
              <option value="note">Note</option>
              <option value="hypothesis">Hypothesis</option>
              <option value="evaluation">Evaluation</option>
              <option value="summary">Summary</option>
              <option value="plan">Plan</option>
            </select>
          </div>

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
              placeholder="Enter node content here... (you can paste LLM prompts or responses)"
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
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: 'var(--spacing-lg)',
            borderTop: '1px solid var(--panel-border)',
            display: 'flex',
            justifyContent: 'flex-end',
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
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              cursor: 'pointer',
              transition: 'background-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-color)';
            }}
          >
            Create Node (Ctrl+Enter)
          </button>
        </div>
      </div>
    </div>
  );
}
