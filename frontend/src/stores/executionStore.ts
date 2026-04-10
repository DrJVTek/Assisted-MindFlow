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
  /** Which node is currently executing (used by Node.tsx run button). */
  runningNodeId: string | null;
  executionOrder: string[];
  nodeResults: Record<string, NodeResult>;
  error: string | null;

  /** Reset state at the start of a new execution. */
  startExecution: (targetNodeId?: string) => void;

  /** Apply one SSE event to the current state. */
  applyEvent: (eventType: string, data: Record<string, unknown>) => void;

  /** Mark the current execution as finished (stream ended). */
  endExecution: () => void;

  /** Record a top-level execution failure. */
  failExecution: (error: string) => void;

  /**
   * Kick off an execution for a node. This is the single source of
   * truth for "run a node" — called both from the DetailPanel Generate
   * button and from the per-node Run button on the canvas.
   */
  executeNode: (graphId: string, nodeId: string, stream?: boolean) => Promise<void>;

  /** Cancel the current execution via the backend DELETE endpoint. */
  cancelExecution: (graphId: string) => Promise<void>;
}

export const useExecutionStore = create<ExecutionStore>((set, get) => ({
  executionId: null,
  isExecuting: false,
  runningNodeId: null,
  executionOrder: [],
  nodeResults: {},
  error: null,

  startExecution: (targetNodeId) =>
    set({
      executionId: null,
      isExecuting: true,
      runningNodeId: targetNodeId ?? null,
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

  endExecution: () => set({ isExecuting: false, runningNodeId: null }),

  failExecution: (error) => set({ isExecuting: false, runningNodeId: null, error }),

  executeNode: async (graphId, nodeId, stream = true) => {
    const store = get();
    store.startExecution(nodeId);

    if (!stream) {
      try {
        const res = await fetch(`/api/graphs/${graphId}/execute/${nodeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stream: false }),
        });
        if (!res.ok) throw new Error(`Execution failed: ${res.statusText}`);
        const data = await res.json();
        // Simulate events so the reducer logic stays centralised in applyEvent
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
      } catch (err) {
        store.failExecution((err as Error).message);
      }
      return;
    }

    // Streaming path: POST + read SSE via ReadableStream (fetch lets us POST,
    // EventSource doesn't)
    try {
      const res = await fetch(`/api/graphs/${graphId}/execute/${nodeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream: true }),
      });
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
            get().applyEvent(eventType, data);
            eventType = '';
          }
        }
      }

      get().endExecution();
    } catch (err) {
      get().failExecution((err as Error).message);
    }
  },

  cancelExecution: async (graphId) => {
    const id = get().executionId;
    if (id) {
      try {
        await fetch(`/api/graphs/${graphId}/execute/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to cancel execution:', err);
      }
    }
    get().endExecution();
  },
}));
