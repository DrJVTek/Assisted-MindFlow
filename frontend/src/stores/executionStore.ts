/**
 * Zustand store for graph execution state.
 *
 * Hosts the state that used to live inside useGraphExecution's useState
 * so multiple components (DetailPanel, Canvas, etc.) can read the same
 * nodeResults — e.g. Canvas needs nodeResults to show edge-hover tooltips
 * with the actual text flowing through each connection.
 *
 * The useGraphExecution hook is now a thin wrapper that exposes executeNode
 * and cancelExecution while reading state from this store.
 */

import { create } from 'zustand';

export interface NodeResult {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  outputs?: Record<string, unknown>;
  error?: string;
  tokens?: string;
}

interface ExecutionStore {
  executionId: string | null;
  isExecuting: boolean;
  executionOrder: string[];
  nodeResults: Record<string, NodeResult>;
  error: string | null;

  /** Reset state at the start of a new execution. */
  startExecution: () => void;

  /** Apply one SSE event to the current state. */
  applyEvent: (eventType: string, data: Record<string, unknown>) => void;

  /** Mark the current execution as finished (stream ended). */
  endExecution: () => void;

  /** Record a top-level execution failure. */
  failExecution: (error: string) => void;
}

export const useExecutionStore = create<ExecutionStore>((set) => ({
  executionId: null,
  isExecuting: false,
  executionOrder: [],
  nodeResults: {},
  error: null,

  startExecution: () =>
    set({
      executionId: null,
      isExecuting: true,
      executionOrder: [],
      nodeResults: {},
      error: null,
    }),

  applyEvent: (eventType, data) => {
    switch (eventType) {
      case 'execution_start':
        set({
          executionId: data.execution_id as string,
          executionOrder: (data.execution_order as string[]) || [],
        });
        break;

      case 'node_start':
        set((prev) => ({
          nodeResults: {
            ...prev.nodeResults,
            [data.node_id as string]: { status: 'running' },
          },
        }));
        break;

      case 'node_progress':
        // No-op — progress granularity not tracked in state
        break;

      case 'token':
        set((prev) => {
          const nodeId = data.node_id as string;
          const existing = prev.nodeResults[nodeId] || { status: 'running' as const };
          return {
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
        set((prev) => {
          const nodeId = data.node_id as string;
          const existing = prev.nodeResults[nodeId] || { status: 'completed' as const };
          return {
            nodeResults: {
              ...prev.nodeResults,
              [nodeId]: {
                ...existing, // preserve tokens streamed so far
                status: 'completed',
                outputs: data.outputs as Record<string, unknown>,
              },
            },
          };
        });
        break;

      case 'node_error':
        set((prev) => {
          const nodeId = data.node_id as string;
          const existing = prev.nodeResults[nodeId] || { status: 'failed' as const };
          return {
            nodeResults: {
              ...prev.nodeResults,
              [nodeId]: {
                ...existing,
                status: 'failed',
                error: data.error as string,
              },
            },
          };
        });
        break;

      case 'execution_complete':
        set({ isExecuting: false });
        break;

      case 'execution_error':
        set({ isExecuting: false, error: data.error as string });
        break;
    }
  },

  endExecution: () => set({ isExecuting: false }),

  failExecution: (error) => set({ isExecuting: false, error }),
}));
