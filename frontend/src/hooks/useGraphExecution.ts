/**
 * useGraphExecution — React hook for graph execution via SSE.
 *
 * Handles the execution engine's SSE events:
 * - execution_start, node_start, node_progress, token,
 *   node_complete, node_error, execution_complete, execution_error
 *
 * This is separate from useStreamingContent (which handles per-operation SSE
 * from the legacy llm-operations endpoint).
 */

import { useState, useRef, useCallback } from 'react';

export interface NodeResult {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  outputs?: Record<string, unknown>;
  error?: string;
  tokens?: string;
}

export interface ExecutionState {
  executionId: string | null;
  isExecuting: boolean;
  executionOrder: string[];
  nodeResults: Record<string, NodeResult>;
  error: string | null;
}

export function useGraphExecution(graphId: string) {
  const [state, setState] = useState<ExecutionState>({
    executionId: null,
    isExecuting: false,
    executionOrder: [],
    nodeResults: {},
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const executeNode = useCallback(
    (nodeId: string, stream = true) => {
      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setState({
        executionId: null,
        isExecuting: true,
        executionOrder: [],
        nodeResults: {},
        error: null,
      });

      if (!stream) {
        // Non-streaming: POST and get JSON result
        fetch(`/api/graphs/${graphId}/execute/${nodeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stream: false }),
        })
          .then(res => {
            if (!res.ok) throw new Error(`Execution failed: ${res.statusText}`);
            return res.json();
          })
          .then(data => {
            setState({
              executionId: data.execution_id,
              isExecuting: false,
              executionOrder: data.execution_order,
              nodeResults: Object.fromEntries(
                Object.entries(data.results).map(([id, r]) => [
                  id,
                  { status: (r as NodeResult).status, outputs: (r as NodeResult).outputs },
                ])
              ),
              error: null,
            });
          })
          .catch(err => {
            setState(prev => ({
              ...prev,
              isExecuting: false,
              error: err.message,
            }));
          });
        return;
      }

      // Streaming: use EventSource via fetch + ReadableStream
      // We use fetch instead of EventSource because we need POST
      fetch(`/api/graphs/${graphId}/execute/${nodeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream: true }),
      })
        .then(async res => {
          if (!res.ok) throw new Error(`Execution failed: ${res.statusText}`);
          if (!res.body) throw new Error('No response body for SSE stream');

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

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
                handleEvent(eventType, data);
                eventType = '';
              }
            }
          }

          setState(prev => ({ ...prev, isExecuting: false }));
        })
        .catch(err => {
          setState(prev => ({
            ...prev,
            isExecuting: false,
            error: err.message,
          }));
        });
    },
    [graphId]
  );

  function handleEvent(eventType: string, data: Record<string, unknown>) {
    switch (eventType) {
      case 'execution_start':
        setState(prev => ({
          ...prev,
          executionId: data.execution_id as string,
          executionOrder: data.execution_order as string[],
        }));
        break;

      case 'node_start':
        setState(prev => ({
          ...prev,
          nodeResults: {
            ...prev.nodeResults,
            [data.node_id as string]: { status: 'running' },
          },
        }));
        break;

      case 'node_progress':
        // Progress updates — no status change needed
        break;

      case 'token':
        setState(prev => {
          const nodeId = data.node_id as string;
          const existing = prev.nodeResults[nodeId] || { status: 'running' };
          return {
            ...prev,
            nodeResults: {
              ...prev.nodeResults,
              [nodeId]: {
                ...existing,
                tokens: (existing.tokens || '') + (data.token as string),
              },
            },
          };
        });
        break;

      case 'node_complete':
        setState(prev => {
          const nodeId = data.node_id as string;
          const existing = prev.nodeResults[nodeId] || {};
          return {
            ...prev,
            nodeResults: {
              ...prev.nodeResults,
              [nodeId]: {
                ...existing,  // preserve accumulated tokens from streaming
                status: 'completed',
                outputs: data.outputs as Record<string, unknown>,
              },
            },
          };
        });
        break;

      case 'node_error':
        setState(prev => ({
          ...prev,
          nodeResults: {
            ...prev.nodeResults,
            [data.node_id as string]: {
              status: 'failed',
              error: data.error as string,
            },
          },
        }));
        break;

      case 'execution_complete':
        setState(prev => ({
          ...prev,
          isExecuting: false,
        }));
        break;

      case 'execution_error':
        setState(prev => ({
          ...prev,
          isExecuting: false,
          error: data.error as string,
        }));
        break;
    }
  }

  const cancelExecution = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (state.executionId) {
      fetch(`/api/graphs/${graphId}/execute/${state.executionId}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
    setState(prev => ({ ...prev, isExecuting: false }));
  }, [graphId, state.executionId]);

  return {
    ...state,
    executeNode,
    cancelExecution,
  };
}
