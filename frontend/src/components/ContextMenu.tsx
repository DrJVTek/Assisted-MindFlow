/**
 * Context Menu Component
 *
 * Shows contextual actions when right-clicking on canvas or nodes:
 * - Canvas: Add Node, Settings
 * - Node: Edit, Delete, Add Child, View History
 */

import React, { useEffect, useRef } from 'react';
import { Plus, Settings, Edit2, Trash2, GitBranch, History } from 'lucide-react';

export type ContextMenuType = 'canvas' | 'node';

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  dividerAfter?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  type: ContextMenuType;
  onClose: () => void;
  onAddNode?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onAddChild?: () => void;
  onViewHistory?: () => void;
  onSettings?: () => void;
}

export function ContextMenu({
  x,
  y,
  type,
  onClose,
  onAddNode,
  onEdit,
  onDelete,
  onAddChild,
  onViewHistory,
  onSettings,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Delay adding listeners to prevent immediate close from the right-click event
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position if menu would go off-screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const adjustedX = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 10 : x;
      const adjustedY = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 10 : y;

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  // Build menu actions based on type
  const actions: ContextMenuAction[] = [];

  if (type === 'canvas' && onAddNode) {
    actions.push({
      id: 'add-node',
      label: 'Add Node',
      icon: <Plus size={16} />,
      onClick: () => {
        onAddNode();
        onClose();
      },
    });
  }

  if (type === 'node') {
    if (onEdit) {
      actions.push({
        id: 'edit',
        label: 'Edit Node',
        icon: <Edit2 size={16} />,
        onClick: () => {
          onEdit();
          onClose();
        },
      });
    }

    if (onAddChild) {
      actions.push({
        id: 'add-child',
        label: 'Add Child Node',
        icon: <GitBranch size={16} />,
        onClick: () => {
          onAddChild();
          onClose();
        },
      });
    }

    if (onViewHistory) {
      actions.push({
        id: 'view-history',
        label: 'View History',
        icon: <History size={16} />,
        onClick: () => {
          onViewHistory();
          onClose();
        },
        dividerAfter: true,
      });
    }

    if (onDelete) {
      actions.push({
        id: 'delete',
        label: 'Delete Node',
        icon: <Trash2 size={16} />,
        onClick: () => {
          onDelete();
          onClose();
        },
      });
    }
  }

  if (type === 'canvas' && onSettings) {
    actions.push({
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={16} />,
      onClick: () => {
        onSettings();
        onClose();
      },
      dividerAfter: false,
    });
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        padding: '4px',
        minWidth: '180px',
        zIndex: 9999,
      }}
      role="menu"
      aria-label="Context menu"
    >
      {actions.map((action) => (
        <React.Fragment key={action.id}>
          <button
            onClick={action.onClick}
            disabled={action.disabled}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              border: 'none',
              background: 'none',
              color: action.disabled ? 'var(--node-text-secondary)' : 'var(--node-text)',
              cursor: action.disabled ? 'not-allowed' : 'pointer',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 500,
              textAlign: 'left',
              transition: 'background-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (!action.disabled) {
                e.currentTarget.style.backgroundColor = 'rgba(25, 118, 210, 0.08)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            role="menuitem"
          >
            <span style={{ display: 'flex', color: 'var(--node-text-secondary)' }}>
              {action.icon}
            </span>
            <span>{action.label}</span>
          </button>
          {action.dividerAfter && (
            <div
              style={{
                height: '1px',
                backgroundColor: 'var(--panel-border)',
                margin: '4px 8px',
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
