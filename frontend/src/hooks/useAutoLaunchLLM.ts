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
   * Optional LLM provider type override
   * If not provided, uses default from settings
   */
  provider?: string;

  /**
   * Optional model override
   * If not provided, uses default from settings
   */
  model?: string;

  /**
   * Optional system prompt override
   */
  systemPrompt?: string;

  /**
   * Feature 011: Provider registry ID for multi-provider support
   */
  providerId?: string | null;

  /**
   * Plugin class_type (e.g., "chatgpt_web_chat") — used to auto-resolve
   * the correct provider from plugin metadata when no explicit providerId.
   */
  classType?: string;
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
    provider: overrideProvider,
    model: overrideModel,
    systemPrompt,
    providerId,
    classType,
  } = options;

  // Prevent duplicate launches on re-renders
  const hasLaunchedRef = useRef(false);
  // Track if this is the first render (to prevent launching on isNewNode prop changes)
  const isFirstRenderRef = useRef(true);

  // Get store actions
  const { createOperation } = useLLMOperationsStore();

  // Get streaming hook
  const { startStreaming } = useStreamingContent(nodeId, {
    graphId // Feature 009 T015: Pass graphId for persistence
  });

  useEffect(() => {
    // Check conditions on first render only
    const isFirstRender = isFirstRenderRef.current;
    const notLaunched = !hasLaunchedRef.current;
    const hasContent = content && content.trim() !== '';

    const shouldLaunch = isFirstRender &&
      notLaunched &&
      isNewNode &&
      hasContent;

    if (isNewNode) {
      console.log('[useAutoLaunchLLM]', shouldLaunch ? '✅ LAUNCHING' : '❌ Skip', { isNewNode, hasContent, isFirstRender, notLaunched });
    }

    // Mark that first render has completed
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
    }

    // Skip if shouldn't launch
    if (!shouldLaunch) {
      return;
    }

    // Mark as launched IMMEDIATELY to prevent duplicates
    hasLaunchedRef.current = true;

    // Async auto-launch function
    const autoLaunch = async () => {
      try {
        // Resolve provider/model from: providerId → classType plugin → override
        let finalProvider = overrideProvider;
        let finalModel = overrideModel;
        let finalProviderId = providerId || undefined;

        const { useProviderStore } = await import('../stores/providerStore');
        const { useNodeTypesStore } = await import('../stores/nodeTypesStore');

        // 1. If we have a providerId, fetch provider info from store
        if (finalProviderId) {
          const providerInfo = useProviderStore.getState().providers.find(
            (p) => p.id === finalProviderId
          );
          if (providerInfo) {
            if (!finalProvider) finalProvider = providerInfo.type;
            if (!finalModel) finalModel = providerInfo.selected_model;
          }
        }

        // 2. If still no provider, resolve from plugin class_type category
        if (!finalProvider && classType) {
          const pluginProviderType = useNodeTypesStore.getState().getProviderType(classType);
          if (pluginProviderType) {
            const matchingProvider = useProviderStore.getState().providers.find(
              (p) => p.type === pluginProviderType
            );
            if (matchingProvider) {
              finalProvider = matchingProvider.type;
              finalProviderId = matchingProvider.id;
              if (!finalModel) finalModel = matchingProvider.selected_model;
            } else {
              console.error(`[useAutoLaunchLLM] No provider configured for type '${pluginProviderType}'. Add one in Settings.`);
              hasLaunchedRef.current = false;
              return;
            }
          }
        }

        // 3. If still no model, get default from plugin INPUT_TYPES (first COMBO option)
        if (!finalModel && classType) {
          const nodeDef = useNodeTypesStore.getState().nodeTypes[classType];
          if (nodeDef?.inputs?.required) {
            const modelSpec = nodeDef.inputs.required.model;
            if (Array.isArray(modelSpec) && modelSpec[1]?.options?.length > 0) {
              finalModel = modelSpec[1].options[0];
            }
          }
        }

        // No silent fallback — if we don't have provider or model, abort with error
        if (!finalProvider) {
          console.error('[useAutoLaunchLLM] No provider resolved. Configure a provider in Settings.');
          hasLaunchedRef.current = false;
          return;
        }
        if (!finalModel) {
          console.error('[useAutoLaunchLLM] No model resolved. Select a model in node settings.');
          hasLaunchedRef.current = false;
          return;
        }

        // Create LLM operation
        const operationId = await createOperation({
          nodeId,
          graphId,
          provider: finalProvider,
          model: finalModel,
          prompt: content,
          systemPrompt,
          provider_id: finalProviderId,
          metadata: {
            autoLaunched: true,
            timestamp: new Date().toISOString()
          }
        });

        // Feature 009 T014: Update node's llm_operation_id to track active operation
        try {
          const response = await fetch(`/api/graphs/${graphId}/nodes/${nodeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ llm_operation_id: operationId })
          });

          if (!response.ok) {
            console.warn('[useAutoLaunchLLM] Failed to update node llm_operation_id:', response.statusText);
          }
        } catch (updateError) {
          console.warn('[useAutoLaunchLLM] Error updating node llm_operation_id:', updateError);
          // Don't fail the whole operation if this update fails
        }

        // Start streaming
        await startStreaming(operationId);
      } catch (error) {
        console.error('[useAutoLaunchLLM] Auto-launch failed:', error);
        // Reset flag on error so user can manually retry
        hasLaunchedRef.current = false;
      }
    };

    // Execute auto-launch
    autoLaunch();

    // NOTE: No cleanup needed - operation lifecycle managed by store
  }, [nodeId, graphId, isNewNode, content, overrideProvider, overrideModel, systemPrompt, classType, createOperation, startStreaming]);
}
