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
    maxReconnectAttempts = 3
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
      eventSource.addEventListener('complete', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        const tokensUsed = data.tokens_used || 0;

        // Update store
        completeOperation(operationId, tokensUsed);

        // Close connection
        eventSource.close();
        setIsStreaming(false);
        currentOperationRef.current = null;

        // Callback
        if (onComplete) {
          onComplete(tokensUsed);
        }
      });

      // Handle errors
      eventSource.addEventListener('error', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        const errorMsg = data.error || 'Unknown error';

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
      eventSource.onerror = (event) => {
        console.error('EventSource error:', event);

        // Attempt reconnection if enabled
        if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
          console.log(`Reconnecting... (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          setReconnectAttempts(prev => prev + 1);

          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          setTimeout(() => {
            startStreaming(operationId);
          }, delay);

        } else {
          // Max retries exceeded
          const errorMsg = 'Connection lost';
          setError(errorMsg);
          setIsStreaming(false);
          failOperation(operationId, errorMsg);
          eventSource.close();
          currentOperationRef.current = null;

          if (onError) {
            onError(errorMsg);
          }
        }
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
    updateStatus,
    updateProgress,
    completeOperation,
    failOperation,
    onComplete,
    onError,
    onToken
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
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    isStreaming,
    error,
    reconnectAttempts,
    startStreaming,
    stopStreaming
  };
}
