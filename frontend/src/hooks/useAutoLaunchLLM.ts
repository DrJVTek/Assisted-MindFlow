/**
 * useAutoLaunchLLM - Automatically launch LLM operation on node creation
 *
 * Feature 009: User Story 1 - Auto-Launch LLM on Node Creation
 *
 * This hook automatically triggers an LLM operation when a new node is created,
 * eliminating the need for manual "Ask LLM" action. Uses useRef to prevent
 * duplicate launches on re-renders.
 *
 * Example:
 * ```typescript
 * // In Node component
 * useAutoLaunchLLM({
 *   nodeId: node.id,
 *   graphId: currentGraphId,
 *   isNewNode: node.data.isNewNode,
 *   content: node.data.content
 * });
 * ```
 */

import { useEffect, useRef } from 'react';
import type { UUID } from '../types/uuid';
import { useLLMOperationsStore } from '../stores/llmOperationsStore';
import { useStreamingContent } from './useStreamingContent';

export interface UseAutoLaunchLLMOptions {
  /**
   * ID of the node to attach LLM operation to
   */
  nodeId: UUID;

  /**
   * ID of the current graph
   */
  graphId: UUID;

  /**
   * Flag indicating this is a newly created node
   * Only auto-launches when true on initial render
   */
  isNewNode: boolean;

  /**
   * Node content (question text)
   * Auto-launch only triggers if content is non-empty
   */
  content: string;

  /**
   * Optional LLM provider override
   * If not provided, uses default from settings
   */
  provider?: 'openai' | 'anthropic' | 'ollama';

  /**
   * Optional model override
   * If not provided, uses default from settings
   */
  model?: string;

  /**
   * Optional system prompt override
   */
  systemPrompt?: string;
}

/**
 * Hook to automatically launch LLM operation when node is created
 *
 * Uses useRef to track if launch has already happened, preventing
 * duplicate operations on re-renders or React Strict Mode double-mounting.
 *
 * @param options - Auto-launch configuration
 */
export function useAutoLaunchLLM(options: UseAutoLaunchLLMOptions): void {
  const {
    nodeId,
    graphId,
    isNewNode,
    content,
    provider = 'ollama', // Default provider (from settings in real implementation)
    model = 'llama2', // Default model (from settings in real implementation)
    systemPrompt
  } = options;

  // Prevent duplicate launches on re-renders
  const hasLaunchedRef = useRef(false);

  // Get store actions
  const { createOperation } = useLLMOperationsStore();

  // Get streaming hook
  const { startStreaming } = useStreamingContent(nodeId);

  useEffect(() => {
    // Skip if:
    // - Already launched
    // - Not a new node
    // - Content is empty
    if (hasLaunchedRef.current || !isNewNode || !content || content.trim() === '') {
      return;
    }

    // Mark as launched IMMEDIATELY to prevent duplicates
    hasLaunchedRef.current = true;

    // Async auto-launch function
    const autoLaunch = async () => {
      try {
        console.log(`[useAutoLaunchLLM] Auto-launching LLM for node ${nodeId}`);

        // Create LLM operation
        const operationId = await createOperation({
          nodeId,
          graphId,
          provider,
          model,
          prompt: content,
          systemPrompt,
          metadata: {
            autoLaunched: true,
            timestamp: new Date().toISOString()
          }
        });

        console.log(`[useAutoLaunchLLM] Created operation ${operationId}, starting stream...`);

        // Start streaming
        await startStreaming(operationId);

        console.log(`[useAutoLaunchLLM] Stream started for operation ${operationId}`);
      } catch (error) {
        console.error('[useAutoLaunchLLM] Auto-launch failed:', error);
        // Reset flag on error so user can manually retry
        hasLaunchedRef.current = false;
      }
    };

    // Execute auto-launch
    autoLaunch();

    // NOTE: No cleanup needed - operation lifecycle managed by store
  }, [nodeId, graphId, isNewNode, content, provider, model, systemPrompt, createOperation, startStreaming]);
}
