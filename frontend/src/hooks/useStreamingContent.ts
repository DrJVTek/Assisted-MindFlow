/**
 * useStreamingContent - React hook for LLM streaming via Server-Sent Events
 *
 * Manages EventSource connection to backend SSE endpoint and updates stores
 * with real-time tokens as they arrive from the LLM.
 *
 * Features:
 * - Automatic connection management
 * - Reconnection on disconnect
 * - Error handling and retry logic
 * - Store updates (operations + content)
 * - Cleanup on unmount
 *
 * Example:
 * ```typescript
 * const { startStreaming, stopStreaming, isStreaming, error } = useStreamingContent(nodeId);
 *
 * // Start streaming
 * await startStreaming(operationId);
 *
 * // Stop/cancel
 * stopStreaming();
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { UUID } from '../types/uuid';
import { useLLMOperationsStore } from '../stores/llmOperationsStore';
import type { OperationStatus } from '../stores/llmOperationsStore';
import { useStreamingContentStore } from '../stores/streamingContentStore';

export interface UseStreamingContentOptions {
  /**
   * Callback when streaming completes successfully
   */
  onComplete?: (tokensUsed: number) => void;

  /**
   * Callback when streaming fails
   */
  onError?: (error: string) => void;

  /**
   * Callback on each token (for analytics, logging, etc.)
   */
  onToken?: (token: string) => void;

  /**
   * Auto-reconnect on connection loss
   */
  autoReconnect?: boolean;

  /**
   * Maximum reconnection attempts
   */
  maxReconnectAttempts?: number;

  /**
   * Graph ID for persisting response (Feature 009)
   */
  graphId?: UUID;
}

/**
 * Hook for streaming LLM content via Server-Sent Events
 */
export function useStreamingContent(
  nodeId: UUID,
  options: UseStreamingContentOptions = {}
) {
  const {
    onComplete,
    onError,
    onToken,
    autoReconnect = true,
    maxReconnectAttempts = 3,
    graphId // Feature 009 T015: For persisting llm_response
  } = options;

  // State
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentOperationRef = useRef<UUID | null>(null);

  // Stores
  const updateStatus = useLLMOperationsStore(state => state.updateStatus);
  const updateProgress = useLLMOperationsStore(state => state.updateProgress);
  const completeOperation = useLLMOperationsStore(state => state.completeOperation);
  const failOperation = useLLMOperationsStore(state => state.failOperation);

  const appendContent = useStreamingContentStore(state => state.appendContent);
  const clearContent = useStreamingContentStore(state => state.clearContent);
  const getContent = useStreamingContentStore(state => state.getContent); // Feature 009 T015

  /**
   * Start streaming for an operation
   */
  const startStreaming = useCallback(async (operationId: UUID) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear previous content
    clearContent(nodeId);

    // Reset state
    setIsStreaming(true);
    setError(null);
    setReconnectAttempts(0);
    currentOperationRef.current = operationId;

    try {
      // Create EventSource connection
      const eventSource = new EventSource(
        `/api/llm-operations/${operationId}/stream`
      );

      eventSourceRef.current = eventSource;

      // Handle token events
      eventSource.addEventListener('token', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        const token = data.content;

        // Append to store
        appendContent(nodeId, token);

        // Callback
        if (onToken) {
          onToken(token);
        }
      });

      // Handle status events
      eventSource.addEventListener('status', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        updateStatus(operationId, data.status as OperationStatus);
      });

      // Handle progress events
      eventSource.addEventListener('progress', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        updateProgress(operationId, data.progress);
      });

      // Handle completion
      eventSource.addEventListener('complete', async (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        const tokensUsed = data.tokens_used || 0;

        // Update store
        completeOperation(operationId);

        // Feature 009 T015: Persist llm_response to backend
        if (graphId) {
          try {
            const finalContent = getContent(nodeId);
            const response = await fetch(`/api/graphs/${graphId}/nodes/${nodeId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                llm_response: finalContent,
                llm_operation_id: null // Clear operation ID on completion
              })
            });

            if (!response.ok) {
              console.warn('[useStreamingContent] Failed to persist llm_response:', response.statusText);
            }
          } catch (persistError) {
            console.error('[useStreamingContent] Error persisting llm_response:', persistError);
          }
        }

        // Close connection
        eventSource.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
        currentOperationRef.current = null;

        // Callback
        if (onComplete) {
          onComplete(tokensUsed);
        }
      });

      // Handle errors
      eventSource.addEventListener('error', (e: MessageEvent) => {
        let errorMsg = 'Unknown error';
        try {
          if (e.data) {
            const data = JSON.parse(e.data);
            errorMsg = data.error || 'Unknown error';
          }
        } catch (parseError) {
          console.warn('Failed to parse error event data:', e.data);
        }

        // Update store
        failOperation(operationId, errorMsg);

        // Close connection
        eventSource.close();
        setIsStreaming(false);
        setError(errorMsg);
        currentOperationRef.current = null;

        // Callback
        if (onError) {
          onError(errorMsg);
        }
      });

      // Handle EventSource errors (connection issues)
      eventSource.onerror = () => {
        // EventSource auto-reconnects on error. On non-retryable errors
        // (like 400 for already-terminal operations) it keeps retrying forever.
        // Close immediately and don't retry — the 'error' event listener above
        // already handles server-sent error events with proper messages.
        eventSource.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
        currentOperationRef.current = null;

        // Only set error if we don't already have one (from the 'error' event)
        setError(prev => prev || 'Connection lost');
      };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start streaming';
      setError(errorMsg);
      setIsStreaming(false);
      failOperation(operationId, errorMsg);

      if (onError) {
        onError(errorMsg);
      }
    }
  }, [
    nodeId,
    autoReconnect,
    maxReconnectAttempts,
    reconnectAttempts,
    appendContent,
    clearContent,
    getContent,
    updateStatus,
    updateProgress,
    completeOperation,
    failOperation,
    onComplete,
    onError,
    onToken,
    graphId
  ]);

  /**
   * Stop streaming (cancel operation)
   */
  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (currentOperationRef.current) {
      // Note: Should call cancel API endpoint here
      currentOperationRef.current = null;
    }

    setIsStreaming(false);
    setError(null);
  }, []);

  /**
   * Cleanup on unmount (T038: Handle node deletion during streaming)
   */
  useEffect(() => {
    return () => {
      // Close EventSource connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Clear streaming content for this node
      if (currentOperationRef.current) {
        clearContent(nodeId);
        currentOperationRef.current = null;
      }
    };
  }, [nodeId, clearContent]);

  return {
    isStreaming,
    error,
    reconnectAttempts,
    startStreaming,
    stopStreaming
  };
}
