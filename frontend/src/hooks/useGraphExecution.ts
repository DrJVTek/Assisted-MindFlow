/**
 * useGraphExecution — thin wrapper around executionStore that handles
 * the actual HTTP + SSE transport for graph execution.
 *
 * Public API unchanged — callers still get
 * { executeNode, cancelExecution, nodeResults, isExecuting, error, ... }
 * — but the state now lives in the shared executionStore so Canvas can
 * also subscribe (needed for edge-hover tooltips that show the value
 * flowing through each connection).
 */

import { useRef, useCallback } from 'react';
import { useExecutionStore, type NodeResult } from '../stores/executionStore';

export type { NodeResult };

export function useGraphExecution(graphId: string) {
  const executionId = useExecutionStore((s) => s.executionId);
  const isExecuting = useExecutionStore((s) => s.isExecuting);
  const executionOrder = useExecutionStore((s) => s.executionOrder);
  const nodeResults = useExecutionStore((s) => s.nodeResults);
  const error = useExecutionStore((s) => s.error);

  const eventSourceRef = useRef<EventSource | null>(null);

  const executeNode = useCallback(
    (nodeId: string, stream = true) => {
      const store = useExecutionStore.getState();

      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      store.startExecution();

      if (!stream) {
        // Non-streaming: POST and get JSON result
        fetch(`/api/graphs/${graphId}/execute/${nodeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stream: false }),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`Execution failed: ${res.statusText}`);
            return res.json();
          })
          .then((data) => {
            // Simulate events so the reducer logic is shared
            store.applyEvent('execution_start', {
              execution_id: data.execution_id,
              execution_order: data.execution_order,
            });
            for (const [id, r] of Object.entries(data.results || {})) {
              const result = r as NodeResult;
              store.applyEvent('node_complete', {
                node_id: id,
                outputs: result.outputs || {},
              });
            }
            store.endExecution();
          })
          .catch((err) => {
            store.failExecution(err.message);
          });
        return;
      }

      // Streaming: use fetch + ReadableStream so we can POST
      fetch(`/api/graphs/${graphId}/execute/${nodeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream: true }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Execution failed: ${res.statusText}`);
          if (!res.body) throw new Error('No response body for SSE stream');

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          const liveStore = useExecutionStore.getState();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let eventType = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ') && eventType) {
                const data = JSON.parse(line.slice(6));
                liveStore.applyEvent(eventType, data);
                eventType = '';
              }
            }
          }

          liveStore.endExecution();
        })
        .catch((err) => {
          useExecutionStore.getState().failExecution(err.message);
        });
    },
    [graphId]
  );

  const cancelExecution = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    const currentId = useExecutionStore.getState().executionId;
    if (currentId) {
      fetch(`/api/graphs/${graphId}/execute/${currentId}`, {
        method: 'DELETE',
      }).catch((err) => console.error('Failed to cancel execution:', err));
    }
    useExecutionStore.getState().endExecution();
  }, [graphId]);

  return {
    executionId,
    isExecuting,
    executionOrder,
    nodeResults,
    error,
    executeNode,
    cancelExecution,
  };
}
