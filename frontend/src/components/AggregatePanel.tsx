/**
 * AggregatePanel - Multi-operation dashboard
 *
 * Shows all active LLM operations in a floating panel.
 * Provides bulk actions and navigation to nodes.
 *
 * Features:
 * - Real-time status updates for all operations
 * - Click to navigate to node on canvas
 * - Bulk actions: Retry All Failed, Cancel All, Clear Completed
 * - Collapsible panel (minimize/maximize)
 * - Queue position indicators
 *
 * Example:
 * ```tsx
 * <AggregatePanel graphId={graphId} />
 * ```
 */

import React, { useState, useMemo } from 'react';
import { X, Minimize2, Maximize2, RefreshCw, XCircle, Trash2, ChevronRight } from 'lucide-react';
import { UUID } from '../types/uuid';
import { useLLMOperationsStore } from '../stores/llmOperationsStore';
import { StreamingIndicator } from './StreamingIndicator';

export interface AggregatePanelProps {
  /**
   * Graph ID for filtering operations
   */
  graphId: UUID;

  /**
   * Callback to pan canvas to a node
   */
  onNavigateToNode?: (nodeId: UUID) => void;

  /**
   * Initial panel state (collapsed or expanded)
   */
  initialCollapsed?: boolean;
}

/**
 * Aggregate panel component
 */
export const AggregatePanel: React.FC<AggregatePanelProps> = ({
  graphId,
  onNavigateToNode,
  initialCollapsed = false,
}) => {
  // State
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // Store
  const operations = useLLMOperationsStore(state => state.operations);
  const cancelOperation = useLLMOperationsStore(state => state.cancelOperation);

  // Filter operations for this graph
  const graphOperations = useMemo(() => {
    return Array.from(operations.values()).filter(op => op.graphId === graphId);
  }, [operations, graphId]);

  // Count by status
  const statusCounts = useMemo(() => {
    const counts = {
      idle: 0,
      queued: 0,
      processing: 0,
      streaming: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    graphOperations.forEach(op => {
      counts[op.status]++;
    });

    return counts;
  }, [graphOperations]);

  // Active operations (not completed/failed/cancelled)
  const activeOperations = useMemo(() => {
    return graphOperations.filter(
      op => !['completed', 'failed', 'cancelled'].includes(op.status)
    );
  }, [graphOperations]);

  // Failed operations
  const failedOperations = useMemo(() => {
    return graphOperations.filter(op => op.status === 'failed');
  }, [graphOperations]);

  // Completed operations
  const completedOperations = useMemo(() => {
    return graphOperations.filter(op => op.status === 'completed');
  }, [graphOperations]);

  // Handlers
  const handleNavigate = (nodeId: UUID) => {
    if (onNavigateToNode) {
      onNavigateToNode(nodeId);
    }
  };

  const handleRetryAllFailed = async () => {
    // TODO: Implement retry logic
    console.log('Retry all failed operations:', failedOperations.length);
  };

  const handleCancelAll = async () => {
    for (const op of activeOperations) {
      await cancelOperation(op.id);
    }
  };

  const handleClearCompleted = () => {
    // TODO: Implement clear completed (archive)
    console.log('Clear completed operations:', completedOperations.length);
  };

  // Don't show panel if no operations
  if (graphOperations.length === 0) {
    return null;
  }

  return (
    <div
      className="aggregate-panel fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 transition-all duration-300 ease-out"
      style={{
        width: collapsed ? '280px' : '400px',
        maxHeight: collapsed ? '60px' : '600px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-900">
            Active Operations ({activeOperations.length})
          </h3>
        </div>

        <div className="flex items-center gap-1">
          {/* Collapse/Expand button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Body (hidden when collapsed) */}
      {!collapsed && (
        <>
          {/* Summary stats */}
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="font-semibold text-blue-600">{statusCounts.streaming}</div>
              <div className="text-gray-600">Streaming</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-yellow-600">{statusCounts.queued}</div>
              <div className="text-gray-600">Queued</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-600">{statusCounts.completed}</div>
              <div className="text-gray-600">Completed</div>
            </div>
          </div>

          {/* Operations list */}
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            {graphOperations.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No operations
              </div>
            ) : (
              graphOperations.map(op => (
                <div
                  key={op.id}
                  className="px-3 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleNavigate(op.nodeId)}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Left: Status indicator + info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StreamingIndicator
                          status={op.status}
                          progress={op.progress}
                          compact={true}
                        />
                        <span className="text-xs text-gray-500 truncate">
                          {op.provider}/{op.model}
                        </span>
                      </div>

                      {/* Prompt preview */}
                      <div className="text-xs text-gray-700 truncate">
                        {op.prompt.substring(0, 60)}
                        {op.prompt.length > 60 ? '...' : ''}
                      </div>

                      {/* Queue position (if queued) */}
                      {op.status === 'queued' && op.queuePosition !== null && (
                        <div className="text-xs text-yellow-600 mt-1">
                          Queue position: {op.queuePosition + 1}
                        </div>
                      )}

                      {/* Error message (if failed) */}
                      {op.status === 'failed' && op.errorMessage && (
                        <div className="text-xs text-red-600 mt-1 truncate">
                          Error: {op.errorMessage}
                        </div>
                      )}

                      {/* Progress info */}
                      {op.contentLength > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {op.contentLength} chars
                        </div>
                      )}
                    </div>

                    {/* Right: Navigate icon */}
                    <ChevronRight size={16} className="text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer: Bulk actions */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 rounded-b-lg flex items-center justify-between gap-2">
            {/* Retry All Failed */}
            {failedOperations.length > 0 && (
              <button
                onClick={handleRetryAllFailed}
                className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded transition-colors"
                title="Retry all failed operations"
              >
                <RefreshCw size={12} />
                Retry All ({failedOperations.length})
              </button>
            )}

            {/* Cancel All */}
            {activeOperations.length > 0 && (
              <button
                onClick={handleCancelAll}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Cancel all active operations"
              >
                <XCircle size={12} />
                Cancel All
              </button>
            )}

            {/* Clear Completed */}
            {completedOperations.length > 0 && (
              <button
                onClick={handleClearCompleted}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Clear completed operations"
              >
                <Trash2 size={12} />
                Clear ({completedOperations.length})
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
