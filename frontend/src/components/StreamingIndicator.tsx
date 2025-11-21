/**
 * StreamingIndicator - Visual indicator for LLM streaming status
 *
 * Shows animated spinner and status text during LLM operations.
 * Displays different states: queued, processing, streaming, completed, failed.
 *
 * Example:
 * ```tsx
 * <StreamingIndicator
 *   status="streaming"
 *   progress={75}
 *   compact={false}
 * />
 * ```
 */

import React from 'react';
import type { OperationStatus } from '../stores/llmOperationsStore';

export interface StreamingIndicatorProps {
  /**
   * Current operation status
   */
  status: OperationStatus;

  /**
   * Progress percentage (0-100)
   */
  progress?: number;

  /**
   * Compact mode (smaller, icon only)
   */
  compact?: boolean;

  /**
   * Additional CSS class
   */
  className?: string;
}

/**
 * Streaming indicator component
 */
export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({
  status,
  progress = 0,
  compact = false,
  className = ''
}) => {
  // Status colors
  const getStatusColor = (): string => {
    switch (status) {
      case 'queued':
        return 'text-yellow-500';
      case 'processing':
      case 'streaming':
        return 'text-blue-500';
      case 'completed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'cancelled':
        return 'text-gray-500';
      default:
        return 'text-gray-400';
    }
  };

  // Status text
  const getStatusText = (): string => {
    switch (status) {
      case 'queued':
        return 'Queued';
      case 'processing':
        return 'Processing';
      case 'streaming':
        return 'Streaming';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Idle';
    }
  };

  // Show spinner for active states
  const isActive = ['queued', 'processing', 'streaming'].includes(status);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Spinner */}
      {isActive && (
        <div className={`animate-spin ${compact ? 'w-3 h-3' : 'w-4 h-4'}`}>
          <svg
            className={getStatusColor()}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}

      {/* Status icon (for non-active states) */}
      {!isActive && status === 'completed' && (
        <svg
          className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} ${getStatusColor()}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}

      {!isActive && status === 'failed' && (
        <svg
          className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} ${getStatusColor()}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      )}

      {/* Status text (not in compact mode) */}
      {!compact && (
        <div className="flex flex-col gap-0.5">
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>

          {/* Progress bar (for streaming) */}
          {status === 'streaming' && (
            <div className="w-24 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Progress percentage (compact mode with streaming) */}
      {compact && status === 'streaming' && (
        <span className={`text-xs ${getStatusColor()}`}>
          {progress}%
        </span>
      )}
    </div>
  );
};
