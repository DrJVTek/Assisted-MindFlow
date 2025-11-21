/**
 * LLMNodeContent - Node content with LLM streaming support
 *
 * Displays either:
 * - Static node content (normal mode)
 * - Streaming LLM content (when LLM is generating)
 * - Streaming indicator (during LLM operation)
 *
 * Features:
 * - Auto-switches between static and streaming content
 * - Shows streaming indicator badge
 * - Displays progress
 * - Handles errors
 *
 * Example:
 * ```tsx
 * <LLMNodeContent
 *   nodeId={nodeId}
 *   staticContent={node.content}
 *   maxLength={100}
 * />
 * ```
 */

import React, { useMemo } from 'react';
import type { UUID } from '../types/uuid';
import { useLLMOperationsStore } from '../stores/llmOperationsStore';
import { useStreamingContentStore } from '../stores/streamingContentStore';
import { StreamingIndicator } from './StreamingIndicator';

export interface LLMNodeContentProps {
  /**
   * Node ID
   */
  nodeId: UUID;

  /**
   * Static content (from database)
   */
  staticContent: string;

  /**
   * Maximum content length to display
   */
  maxLength?: number;

  /**
   * Show streaming indicator badge
   */
  showIndicator?: boolean;

  /**
   * Additional CSS class
   */
  className?: string;
}

/**
 * Node content with LLM streaming support
 */
export const LLMNodeContent: React.FC<LLMNodeContentProps> = ({
  nodeId,
  staticContent,
  maxLength = 200,
  showIndicator = true,
  className = ''
}) => {
  // Get active operation for this node
  const operations = useLLMOperationsStore(state => state.getOperationsByNode(nodeId));
  const activeOperation = useMemo(
    () => operations.find(op => op.status === 'processing' || op.status === 'streaming'),
    [operations]
  );

  // Get streaming content (selective subscription - only this node)
  const streamingContent = useStreamingContentStore(
    state => state.nodeContent.get(nodeId)
  );

  // Determine which content to show
  const displayContent = useMemo(() => {
    // Show streaming content if available
    if (streamingContent && activeOperation) {
      return streamingContent;
    }

    // Fallback to static content
    return staticContent;
  }, [streamingContent, activeOperation, staticContent]);

  // Truncate if needed
  const truncatedContent = useMemo(() => {
    if (displayContent.length <= maxLength) {
      return displayContent;
    }
    return displayContent.substring(0, maxLength) + '...';
  }, [displayContent, maxLength]);

  return (
    <div className={`llm-node-content ${className}`}>
      {/* Streaming indicator badge */}
      {showIndicator && activeOperation && (
        <div className="mb-2">
          <StreamingIndicator
            status={activeOperation.status}
            progress={activeOperation.progress}
            compact={true}
          />
        </div>
      )}

      {/* Content */}
      <div
        className="whitespace-pre-wrap break-words"
        style={{
          fontSize: '14px',
          lineHeight: '1.5',
          color: '#333',
        }}
      >
        {truncatedContent || <span className="text-gray-400 italic">Empty</span>}
      </div>

      {/* Streaming cursor (blinking) */}
      {activeOperation && activeOperation.status === 'streaming' && (
        <span
          className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse"
          style={{
            animation: 'blink 1s infinite',
          }}
        />
      )}
    </div>
  );
};
