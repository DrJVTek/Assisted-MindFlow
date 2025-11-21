/**
 * CommentNode Component - Resizable comment/annotation for the canvas
 *
 * Features:
 * - Yellow sticky-note appearance
 * - Resizable by dragging corners
 * - Double-click to edit content
 * - Context menu for Edit/Delete
 * - Can be attached to nodes or float freely
 */

import React, { useState, useCallback, memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';

interface CommentNodeData {
  content: string;
  author: string;
  created_at: string;
  attached_to?: {
    node?: string;
    edge?: [string, string];
  };
  onEdit?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
}

/**
 * CommentNode - A resizable comment box component
 */
export const CommentNode = memo(({ id, data, selected }: NodeProps<CommentNodeData>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(data.content);
  const [width, setWidth] = useState(240);
  const [height, setHeight] = useState(180);
  const [isResizing, setIsResizing] = useState(false);

  // Handle double-click to edit
  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
    setEditContent(data.content);
  }, [data.content]);

  // Handle save edit
  const handleSaveEdit = useCallback(() => {
    if (data.onEdit && editContent.trim()) {
      data.onEdit(id);
    }
    setIsEditing(false);
  }, [id, editContent, data]);

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(data.content);
  }, [data.content]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = width;
    const startHeight = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      setWidth(Math.max(180, startWidth + deltaX));
      setHeight(Math.max(120, startHeight + deltaY));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width, height]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
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
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: '#FFF9C4',
        border: selected ? '2px solid #FBC02D' : '1px solid #F9A825',
        borderRadius: '8px',
        boxShadow: selected
          ? '0 4px 12px rgba(251, 192, 45, 0.3)'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        cursor: isResizing ? 'nwse-resize' : 'default',
        transition: isResizing ? 'none' : 'box-shadow 0.2s, border 0.2s',
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          borderBottom: '1px solid #F9A825',
          paddingBottom: '8px',
        }}
      >
        <MessageSquare size={16} color="#F57F17" />
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#F57F17',
          }}
        >
          Comment
        </span>
        <span
          style={{
            fontSize: '10px',
            color: '#9E9E9E',
            marginLeft: 'auto',
          }}
        >
          {data.author}
        </span>
      </div>

      {/* Content */}
      {isEditing ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              width: '100%',
              padding: '8px',
              fontSize: '13px',
              lineHeight: '1.5',
              color: '#424242',
              backgroundColor: '#FFFFFF',
              border: '1px solid #F9A825',
              borderRadius: '4px',
              resize: 'none',
              fontFamily: 'inherit',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleCancelEdit();
              } else if (e.key === 'Enter' && e.ctrlKey) {
                handleSaveEdit();
              }
            }}
          />
          <div
            style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={handleCancelEdit}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                backgroundColor: '#E0E0E0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                backgroundColor: '#FBC02D',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            fontSize: '13px',
            lineHeight: '1.5',
            color: '#424242',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        >
          {data.content}
        </div>
      )}

      {/* Timestamp */}
      <div
        style={{
          marginTop: '8px',
          fontSize: '10px',
          color: '#9E9E9E',
          textAlign: 'right',
        }}
      >
        {formatTime(data.created_at)}
      </div>

      {/* Resize handle (bottom-right corner) */}
      {!isEditing && (
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: '20px',
            height: '20px',
            cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 50%, #F9A825 50%)',
            borderBottomRightRadius: '8px',
          }}
        />
      )}

      {/* Connection handle (if attached to a node) */}
      {data.attached_to?.node && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: '#F9A825',
            width: '8px',
            height: '8px',
          }}
        />
      )}
    </div>
  );
});

CommentNode.displayName = 'CommentNode';
