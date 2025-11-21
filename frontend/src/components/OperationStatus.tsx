/**
 * OperationStatus - Detailed operation status display
 *
 * Shows comprehensive information about an LLM operation:
 * - Status badge with color coding
 * - Queue position (when queued)
 * - Progress bar (when streaming)
 * - Elapsed time
 * - Token count
 * - Error messages
 *
 * Example:
 * ```tsx
 * <OperationStatus
 *   operationId={opId}
 *   showDetails={true}
 * />
 * ```
 */

import React, { useEffect, useState } from 'react';
import type { UUID } from '../types/uuid';
import { useLLMOperationsStore } from '../stores/llmOperationsStore';
import { StreamingIndicator } from './StreamingIndicator';

export interface OperationStatusProps {
  /**
   * Operation ID to display
   */
  operationId: UUID;

  /**
   * Show detailed information
   */
  showDetails?: boolean;

  /**
   * Show cancel button
   */
  showCancel?: boolean;

  /**
   * Callback when cancel is clicked
   */
  onCancel?: () => void;

  /**
   * Additional CSS class
   */
  className?: string;
}

/**
 * Operation status component
 */
export const OperationStatus: React.FC<OperationStatusProps> = ({
  operationId,
  showDetails = true,
  showCancel = false,
  onCancel,
  className = ''
}) => {
  // Get operation from store
  const operation = useLLMOperationsStore(state => state.getOperation(operationId));

  // Elapsed time state (updates every second)
  const [elapsedTime, setElapsedTime] = useState<string>('');

  useEffect(() => {
    if (!operation || !operation.startedAt) return;

    const updateElapsed = () => {
      const start = new Date(operation.startedAt!).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);

      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;

      setElapsedTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    // Update immediately
    updateElapsed();

    // Update every second
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [operation?.startedAt]);

  if (!operation) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Operation not found
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Main status indicator */}
      <div className="flex items-center justify-between">
        <StreamingIndicator
          status={operation.status}
          progress={operation.progress}
          compact={!showDetails}
        />

        {/* Cancel button */}
        {showCancel && operation.status !== 'completed' && operation.status !== 'failed' && (
          <button
            onClick={onCancel}
            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Cancel operation"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Detailed information */}
      {showDetails && (
        <div className="text-xs text-gray-600 space-y-1">
          {/* Queue position */}
          {operation.status === 'queued' && operation.queuePosition !== null && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Queue position:</span>
              <span className="text-gray-800">{operation.queuePosition + 1}</span>
            </div>
          )}

          {/* Progress */}
          {operation.status === 'streaming' && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Progress:</span>
              <span className="text-gray-800">{operation.progress}%</span>
            </div>
          )}

          {/* Elapsed time */}
          {operation.startedAt && !operation.completedAt && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Elapsed:</span>
              <span className="text-gray-800 font-mono">{elapsedTime}</span>
            </div>
          )}

          {/* Duration (completed) */}
          {operation.completedAt && operation.startedAt && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Duration:</span>
              <span className="text-gray-800">
                {Math.round(
                  (new Date(operation.completedAt).getTime() -
                    new Date(operation.startedAt).getTime()) / 1000
                )}s
              </span>
            </div>
          )}

          {/* Content length */}
          {operation.contentLength > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Content:</span>
              <span className="text-gray-800">{operation.contentLength} chars</span>
            </div>
          )}

          {/* Provider and model */}
          <div className="flex items-center gap-2">
            <span className="font-medium">Model:</span>
            <span className="text-gray-800">
              {operation.provider}/{operation.model}
            </span>
          </div>

          {/* Error message */}
          {operation.status === 'failed' && operation.errorMessage && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
              <div className="font-medium text-red-800">Error:</div>
              <div className="text-red-700">{operation.errorMessage}</div>
            </div>
          )}

          {/* Retry count */}
          {operation.retryCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Retries:</span>
              <span className="text-gray-800">{operation.retryCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
