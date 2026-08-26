/**
 * GroupNode Component - Visual container for grouping related nodes
 *
 * Features:
 * - Colored background rectangle containing child nodes
 * - Double-click header to edit title
 * - Context menu: Ungroup, Edit Title, Change Color
 * - Dragging group moves all contained nodes
 * - Resizable bounds
 */

import React, { useState, useCallback, memo } from 'react';
import { type NodeProps } from 'reactflow';
import { Layers } from 'lucide-react';

interface GroupNodeData {
  label: string;
  kind: string;
  color?: string | null;
  pinned_nodes: string[];
  tags: string[];
  onEdit?: (groupId: string) => void;
  onUngroup?: (groupId: string) => void;
  onChangeColor?: (groupId: string, color: string) => void;
}

// Predefined color palette for groups
const GROUP_COLORS = [
  { name: 'Blue', value: '#E3F2FD' },
  { name: 'Green', value: '#E8F5E9' },
  { name: 'Yellow', value: '#FFF9C4' },
  { name: 'Orange', value: '#FFE0B2' },
  { name: 'Red', value: '#FFEBEE' },
  { name: 'Purple', value: '#F3E5F5' },
  { name: 'Gray', value: '#F5F5F5' },
];

/**
 * GroupNode - A container component for grouping nodes
 */
export const GroupNode = memo(({ id, data, selected }: NodeProps<GroupNodeData>) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Get background color (default to light gray)
  const backgroundColor = data.color || '#F5F5F5';

  // Determine border color based on background
  const borderColor = selected ? '#1976D2' : '#BDBDBD';

  // Handle double-click on header to edit title
  const handleHeaderDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
    setEditLabel(data.label);
  }, [data.label]);

  // Handle save title
  const handleSaveTitle = useCallback(() => {
    if (data.onEdit && editLabel.trim()) {
      data.onEdit(id);
    }
    setIsEditingTitle(false);
  }, [id, editLabel, data]);

  // Handle cancel title edit
  const handleCancelTitle = useCallback(() => {
    setIsEditingTitle(false);
    setEditLabel(data.label);
  }, [data.label]);

  // Handle color change
  const handleColorChange = useCallback((color: string) => {
    if (data.onChangeColor) {
      data.onChangeColor(id, color);
    }
    setShowColorPicker(false);
  }, [id, data]);

  return (
    <div
      style={{
        minWidth: '300px',
        minHeight: '200px',
        width: '100%',
        height: '100%',
        backgroundColor,
        border: `2px ${selected ? 'solid' : 'dashed'} ${borderColor}`,
        borderRadius: '12px',
        padding: '0',
        position: 'relative',
        boxShadow: selected
          ? '0 4px 12px rgba(25, 118, 210, 0.3)'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'box-shadow 0.2s, border 0.2s',
      }}
    >
      {/* Header */}
      <div
        onDoubleClick={handleHeaderDoubleClick}
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${borderColor}`,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          borderTopLeftRadius: '10px',
          borderTopRightRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        <Layers size={18} color="#616161" />

        {isEditingTitle ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              autoFocus
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#424242',
                backgroundColor: '#FFFFFF',
                border: '1px solid #1976D2',
                borderRadius: '4px',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancelTitle();
                } else if (e.key === 'Enter') {
                  handleSaveTitle();
                }
              }}
              onBlur={handleSaveTitle}
            />
          </div>
        ) : (
          <>
            <span
              style={{
                flex: 1,
                fontSize: '14px',
                fontWeight: 600,
                color: '#424242',
              }}
            >
              {data.label}
            </span>

            {/* Group kind badge */}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: '#757575',
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              {data.kind}
            </span>

            {/* Color picker button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
              }}
              style={{
                width: '24px',
                height: '24px',
                backgroundColor,
                border: '2px solid #BDBDBD',
                borderRadius: '50%',
                cursor: 'pointer',
                padding: 0,
              }}
              title="Change color"
            />
          </>
        )}
      </div>

      {/* Color picker dropdown */}
      {showColorPicker && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E0E0E0',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            padding: '12px',
            zIndex: 1000,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
          }}
        >
          {GROUP_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => handleColorChange(color.value)}
              title={color.name}
              style={{
                width: '32px',
                height: '32px',
                backgroundColor: color.value,
                border: data.color === color.value ? '2px solid #1976D2' : '1px solid #BDBDBD',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Content area (nodes will be rendered inside by ReactFlow) */}
      <div
        style={{
          padding: '16px',
          minHeight: '140px',
        }}
      >
        {/* This area is managed by ReactFlow - child nodes are positioned here */}
      </div>

      {/* Footer info */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '16px',
          fontSize: '11px',
          color: '#9E9E9E',
        }}
      >
        {data.pinned_nodes.length > 0 && (
          <span>{data.pinned_nodes.length} node{data.pinned_nodes.length !== 1 ? 's' : ''}</span>
        )}
        {data.tags.length > 0 && (
          <span style={{ marginLeft: '12px' }}>
            {data.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  padding: '2px 6px',
                  borderRadius: '8px',
                  marginRight: '4px',
                }}
              >
                {tag}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
});

GroupNode.displayName = 'GroupNode';
