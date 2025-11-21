/**
 * LLM Operations Store - Manages state for concurrent LLM operations
 *
 * Tracks all LLM operations across the application with their status,
 * progress, and metadata. Provides actions for creating, updating,
 * and cancelling operations.
 *
 * Example:
 * ```typescript
 * const { operations, createOperation, updateStatus } = useLLMOperationsStore();
 *
 * // Create new operation
 * const opId = await createOperation({
 *   nodeId: '123...',
 *   provider: 'ollama',
 *   model: 'llama2',
 *   prompt: 'Explain AI'
 * });
 *
 * // Update status
 * updateStatus(opId, 'streaming', 50);
 * ```
 */

import { create } from 'zustand';

// UUID type (string alias) - defined locally to avoid import issues
type UUID = string;

/**
 * LLM operation status enum (matches backend NodeState)
 */
export type OperationStatus =
  | 'idle'
  | 'queued'
  | 'processing'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * LLM operation metadata
 */
export interface LLMOperation {
  id: UUID;
  nodeId: UUID;
  graphId: UUID;

  // Status
  status: OperationStatus;
  progress: number; // 0-100
  queuePosition: number | null;

  // Configuration
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  prompt: string;
  systemPrompt?: string;

  // Content
  contentLength: number;

  // Timing
  queuedAt: string; // ISO 8601
  startedAt: string | null;
  completedAt: string | null;

  // Error handling
  errorMessage: string | null;
  retryCount: number;
}

/**
 * Create operation request
 */
export interface CreateOperationRequest {
  nodeId: UUID;
  graphId: UUID;
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  prompt: string;
  systemPrompt?: string;
  metadata?: Record<string, any>;
}

/**
 * LLM Operations store state
 */
interface LLMOperationsState {
  // State
  operations: Map<UUID, LLMOperation>;

  // Actions
  createOperation: (request: CreateOperationRequest) => Promise<UUID>;
  updateStatus: (operationId: UUID, status: OperationStatus, progress?: number) => void;
  updateProgress: (operationId: UUID, progress: number) => void;
  updateContentLength: (operationId: UUID, length: number) => void;
  completeOperation: (operationId: UUID, tokensUsed?: number) => void;
  failOperation: (operationId: UUID, error: string) => void;
  cancelOperation: (operationId: UUID) => Promise<void>;
  removeOperation: (operationId: UUID) => void;

  // Queries
  getOperation: (operationId: UUID) => LLMOperation | undefined;
  getOperationsByNode: (nodeId: UUID) => LLMOperation[];
  getActiveOperations: () => LLMOperation[];
  getOperationCount: () => number;
}

/**
 * LLM Operations Zustand store
 */
export const useLLMOperationsStore = create<LLMOperationsState>((set, get) => ({
  // Initial state
  operations: new Map(),

  // Create new operation via API
  createOperation: async (request) => {
    try {
      const response = await fetch(
        `/api/llm-operations/graphs/${request.graphId}/operations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            node_id: request.nodeId,
            provider: request.provider,
            model: request.model,
            prompt: request.prompt,
            system_prompt: request.systemPrompt,
            metadata: request.metadata || {}
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create operation: ${response.statusText}`);
      }

      const data = await response.json();

      // Create operation object
      const operation: LLMOperation = {
        id: data.id,
        nodeId: request.nodeId,
        graphId: request.graphId,
        status: data.status as OperationStatus,
        progress: data.progress,
        queuePosition: data.queue_position,
        provider: request.provider,
        model: request.model,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        contentLength: data.content_length,
        queuedAt: data.queued_at || new Date().toISOString(),
        startedAt: data.started_at,
        completedAt: data.completed_at,
        errorMessage: data.error_message,
        retryCount: 0
      };

      // Add to store
      set((state) => {
        const newOps = new Map(state.operations);
        newOps.set(operation.id, operation);
        return { operations: newOps };
      });

      return operation.id;

    } catch (error) {
      console.error('Error creating LLM operation:', error);
      throw error;
    }
  },

  // Update operation status
  updateStatus: (operationId, status, progress) => {
    set((state) => {
      const op = state.operations.get(operationId);
      if (!op) return state;

      const newOps = new Map(state.operations);
      newOps.set(operationId, {
        ...op,
        status,
        progress: progress !== undefined ? progress : op.progress,
        startedAt: status === 'processing' && !op.startedAt
          ? new Date().toISOString()
          : op.startedAt,
        completedAt: ['completed', 'failed', 'cancelled'].includes(status) && !op.completedAt
          ? new Date().toISOString()
          : op.completedAt
      });

      return { operations: newOps };
    });
  },

  // Update progress
  updateProgress: (operationId, progress) => {
    set((state) => {
      const op = state.operations.get(operationId);
      if (!op) return state;

      const newOps = new Map(state.operations);
      newOps.set(operationId, { ...op, progress });
      return { operations: newOps };
    });
  },

  // Update content length
  updateContentLength: (operationId, length) => {
    set((state) => {
      const op = state.operations.get(operationId);
      if (!op) return state;

      const newOps = new Map(state.operations);
      newOps.set(operationId, { ...op, contentLength: length });
      return { operations: newOps };
    });
  },

  // Complete operation
  completeOperation: (operationId, tokensUsed) => {
    set((state) => {
      const op = state.operations.get(operationId);
      if (!op) return state;

      const newOps = new Map(state.operations);
      newOps.set(operationId, {
        ...op,
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString()
      });

      return { operations: newOps };
    });
  },

  // Fail operation
  failOperation: (operationId, error) => {
    set((state) => {
      const op = state.operations.get(operationId);
      if (!op) return state;

      const newOps = new Map(state.operations);
      newOps.set(operationId, {
        ...op,
        status: 'failed',
        errorMessage: error,
        completedAt: new Date().toISOString()
      });

      return { operations: newOps };
    });
  },

  // Cancel operation via API
  cancelOperation: async (operationId) => {
    try {
      const response = await fetch(`/api/llm-operations/${operationId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel operation: ${response.statusText}`);
      }

      // Update local state
      set((state) => {
        const op = state.operations.get(operationId);
        if (!op) return state;

        const newOps = new Map(state.operations);
        newOps.set(operationId, {
          ...op,
          status: 'cancelled',
          completedAt: new Date().toISOString()
        });

        return { operations: newOps };
      });

    } catch (error) {
      console.error('Error cancelling operation:', error);
      throw error;
    }
  },

  // Remove operation from store
  removeOperation: (operationId) => {
    set((state) => {
      const newOps = new Map(state.operations);
      newOps.delete(operationId);
      return { operations: newOps };
    });
  },

  // Get single operation
  getOperation: (operationId) => {
    return get().operations.get(operationId);
  },

  // Get operations for a node
  getOperationsByNode: (nodeId) => {
    return Array.from(get().operations.values())
      .filter(op => op.nodeId === nodeId);
  },

  // Get active operations (processing or streaming)
  getActiveOperations: () => {
    return Array.from(get().operations.values())
      .filter(op => op.status === 'processing' || op.status === 'streaming');
  },

  // Get total operation count
  getOperationCount: () => {
    return get().operations.size;
  }
}));
