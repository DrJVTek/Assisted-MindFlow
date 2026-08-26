/**
 * useGraphExecution — thin wrapper around executionStore.
 *
 * The actual fetch + SSE logic lives in the store so any component
 * (DetailPanel, Canvas Node run button, etc.) can trigger execution
 * directly via useExecutionStore.getState().executeNode(graphId, nodeId).
 *
 * This hook exists for the (common) case where a component also wants
 * to observe live state — it subscribes to nodeResults / isExecuting /
 * error and returns bound versions of executeNode / cancelExecution
 * that pre-fill graphId from the caller.
 */

import { useCallback } from 'react';
import { useExecutionStore, type NodeResult } from '../stores/executionStore';

export type { NodeResult };

export function useGraphExecution(graphId: string) {
  const executionId = useExecutionStore((s) => s.executionId);
  const isExecuting = useExecutionStore((s) => s.isExecuting);
  const runningNodeId = useExecutionStore((s) => s.runningNodeId);
  const executionOrder = useExecutionStore((s) => s.executionOrder);
  const nodeResults = useExecutionStore((s) => s.nodeResults);
  const error = useExecutionStore((s) => s.error);

  const executeNode = useCallback(
    (nodeId: string, stream = true) => {
      return useExecutionStore.getState().executeNode(graphId, nodeId, stream);
    },
    [graphId]
  );

  const cancelExecution = useCallback(() => {
    return useExecutionStore.getState().cancelExecution(graphId);
  }, [graphId]);

  return {
    executionId,
    isExecuting,
    runningNodeId,
    executionOrder,
    nodeResults,
    error,
    executeNode,
    cancelExecution,
  };
}
