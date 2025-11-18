/**
 * Custom Node Component
 *
 * Visual representation of reasoning nodes with:
 * - Type-based colors and icons
 * - Content preview (truncated to 100 chars)
 * - Status indicators
 * - Importance-based styling (border thickness, opacity)
 * - Author indicators (human/llm/tool)
 */

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import {
  MessageCircleQuestion,
  MessageCircleReply,
  FileText,
  Lightbulb,
  CheckCircle,
  FileType,
  Target,
  Users,
  MessageSquare,
  StopCircle,
  Bot,
  User,
  Wrench,
} from 'lucide-react';
import type { NodeType, NodeAuthor, NodeStatus } from '../types/graph';

/**
 * Node data interface (received from React Flow)
 */
interface NodeData {
  nodeId: string;
  preview: string;
  type: NodeType;
  author: NodeAuthor;
  status: NodeStatus;
  importance: number;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
  currentZoom?: number; // Optional: for zoom-based rendering
}

/**
 * Custom node props (React Flow's NodeProps type is not exported)
 */
interface CustomNodeProps {
  data: NodeData;
  selected?: boolean;
}

/**
 * Get icon component for node type
 */
function getTypeIcon(type: NodeType): React.ReactElement {
  const iconProps = { size: 18, strokeWidth: 2 };

  switch (type) {
    case 'question':
      return <MessageCircleQuestion {...iconProps} />;
    case 'answer':
      return <MessageCircleReply {...iconProps} />;
    case 'note':
      return <FileText {...iconProps} />;
    case 'hypothesis':
      return <Lightbulb {...iconProps} />;
    case 'evaluation':
      return <CheckCircle {...iconProps} />;
    case 'summary':
      return <FileType {...iconProps} />;
    case 'plan':
      return <Target {...iconProps} />;
    case 'group_meta':
      return <Users {...iconProps} />;
    case 'comment':
      return <MessageSquare {...iconProps} />;
    case 'stop':
      return <StopCircle {...iconProps} />;
    default:
      return <FileText {...iconProps} />;
  }
}

/**
 * Get icon component for author
 */
function getAuthorIcon(author: NodeAuthor): React.ReactElement {
  const iconProps = { size: 14, strokeWidth: 2 };

  switch (author) {
    case 'human':
      return <User {...iconProps} />;
    case 'llm':
      return <Bot {...iconProps} />;
    case 'tool':
      return <Wrench {...iconProps} />;
    default:
      return <User {...iconProps} />;
  }
}

/**
 * Get status badge color
 */
function getStatusColor(status: NodeStatus): string {
  switch (status) {
    case 'draft':
      return '#9E9E9E'; // Grey
    case 'valid':
      return '#4CAF50'; // Green
    case 'invalid':
      return '#F44336'; // Red
    case 'final':
      return '#2196F3'; // Blue
    case 'experimental':
      return '#FF9800'; // Orange
    default:
      return '#9E9E9E';
  }
}

/**
 * Custom Node Component (memoized for performance)
 */
export const CustomNode = memo(({ data, selected }: CustomNodeProps) => {
  const {
    preview,
    type,
    author,
    status,
    importance,
    backgroundColor,
    borderColor,
    borderWidth,
    opacity,
    currentZoom = 1.0,
  } = data;

  const statusColor = getStatusColor(status);
  const isZoomedOut = currentZoom < 0.5; // Simplify rendering below 50% zoom

  return (
    <div
      style={{
        backgroundColor,
        borderColor: selected ? '#1976D2' : borderColor,
        borderWidth: selected ? borderWidth + 2 : borderWidth,
        borderStyle: 'solid',
        borderRadius: '8px',
        padding: '12px',
        width: '280px',
        minHeight: '120px',
        maxHeight: '400px',
        opacity,
        boxShadow: selected
          ? '0 8px 16px rgba(0, 0, 0, 0.15)'
          : importance > 7
          ? '0 4px 8px rgba(0, 0, 0, 0.1)'
          : '0 2px 4px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#90A4AE',
          width: 8,
          height: 8,
          border: '2px solid white',
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#90A4AE',
          width: 8,
          height: 8,
          border: '2px solid white',
        }}
      />

      {/* Simplified rendering at low zoom (<50%) */}
      {isZoomedOut ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '6px',
        }}>
          <div style={{ color: '#546E7A', display: 'flex' }}>
            {getTypeIcon(type)}
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#546E7A',
              textTransform: 'capitalize',
            }}
          >
            {type.replace('_', ' ')}
          </span>
        </div>
      ) : (
        <>
          {/* Header: Type icon + Status badge + Author */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            {/* Type icon + label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ color: '#546E7A', display: 'flex' }}>
                {getTypeIcon(type)}
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#546E7A',
                  textTransform: 'capitalize',
                }}
              >
                {type.replace('_', ' ')}
              </span>
            </div>

            {/* Status badge + Author icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Status badge */}
              <div
                style={{
                  backgroundColor: statusColor,
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {status}
              </div>

              {/* Author icon */}
              <div
                style={{ color: '#78909C', display: 'flex' }}
                title={`Author: ${author}`}
              >
                {getAuthorIcon(author)}
              </div>
            </div>
          </div>

          {/* Content preview */}
          <div
            style={{
              fontSize: '14px',
              lineHeight: '1.5',
              color: '#37474F',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {preview}
          </div>

          {/* Importance indicator (bottom border) */}
          {importance > 7 && (
            <div
              style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: `2px solid ${borderColor}`,
                fontSize: '10px',
                color: '#78909C',
                fontWeight: 600,
                textAlign: 'right',
              }}
            >
              High Priority
            </div>
          )}
        </>
      )}
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
