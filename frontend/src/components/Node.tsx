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

import React, { memo, useState } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
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
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { NodeType, NodeAuthor, NodeStatus } from '../types/graph';
import { useAutoLaunchLLM } from '../hooks/useAutoLaunchLLM';
import { LLMNodeContent } from './LLMNodeContent';
import { api } from '../services/api';

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

  // Feature 009: Auto-launch fields
  isNewNode?: boolean; // Flag for auto-launch trigger
  content?: string; // Full content (question text)
  graphId?: string; // Required for LLM operations
  id?: string; // Node UUID (alternative to nodeId)

  // Feature 009: Display fields
  llm_response?: string | null; // LLM response (markdown)
  llm_operation_id?: string | null; // Active operation ID
  font_size?: number; // Font size (10-24px range)
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
    // Feature 009 fields
    isNewNode = false,
    content = '',
    graphId = '',
    id,
    nodeId,
    llm_response,
    llm_operation_id,
    font_size: initialFontSize,
  } = data;

  // Feature 009 T028-T029: Local font size state
  const [fontSize, setFontSize] = useState(initialFontSize || 14);

  // Feature 009: Auto-launch LLM on node creation
  useAutoLaunchLLM({
    nodeId: id || nodeId,
    graphId,
    isNewNode,
    content,
  });

  // Feature 009 T028-T031: Font size handlers
  const increaseFontSize = () => {
    const newSize = Math.min(fontSize + 2, 24); // Max 24px
    setFontSize(newSize);
    // Persist to backend
    if (graphId && (id || nodeId)) {
      api.updateNode(graphId, id || nodeId, { font_size: newSize }).catch(err =>
        console.error('Failed to persist font size:', err)
      );
    }
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(fontSize - 2, 10); // Min 10px
    setFontSize(newSize);
    // Persist to backend
    if (graphId && (id || nodeId)) {
      api.updateNode(graphId, id || nodeId, { font_size: newSize }).catch(err =>
        console.error('Failed to persist font size:', err)
      );
    }
  };

  const statusColor = getStatusColor(status);
  const isZoomedOut = currentZoom < 0.5; // Simplify rendering below 50% zoom

  return (
    <div
      className="mindflow-node"
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
        transition: 'all 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
        cursor: 'move',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Feature 009 T027: NodeResizer - only show when selected */}
      {selected && (
        <NodeResizer
          minWidth={200}
          minHeight={100}
          maxWidth={600}
          maxHeight={800}
        />
      )}

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
          {/* Header: Type icon + Status badge + Author + Font controls */}
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

            {/* Status badge + Author icon + Font controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Feature 009 T028: Font size controls - only show when LLM content present */}
              {(llm_response || llm_operation_id) && selected && (
                <>
                  <button
                    onClick={decreaseFontSize}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#546E7A',
                    }}
                    title="Decrease font size"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span style={{ fontSize: '10px', color: '#78909C', minWidth: '28px', textAlign: 'center' }}>
                    {fontSize}px
                  </span>
                  <button
                    onClick={increaseFontSize}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#546E7A',
                    }}
                    title="Increase font size"
                  >
                    <ZoomIn size={14} />
                  </button>
                </>
              )}

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

          {/* Content: LLMNodeContent or preview */}
          {(llm_response || llm_operation_id) ? (
            <LLMNodeContent
              question={content}
              response={llm_response}
              llmOperationId={llm_operation_id}
              fontSize={fontSize}
            />
          ) : (
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
          )}

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
