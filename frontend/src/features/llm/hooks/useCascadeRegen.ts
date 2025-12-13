/**
 * Hook for cascade regeneration
 */

import { useState, useCallback } from 'react';
import { api } from '../../../services/api';

export interface CascadeRegenOptions {
  llmProvider?: string;
  llmModel?: string;
}

export interface CascadeRegenResult {
  success: boolean;
  affected_nodes: string[];
  regenerated_count: number;
  errors: Array<{ node_id: string; error: string }>;
  message: string;
}

export interface UseCascadeRegenReturn {
  isRegenerating: boolean;
  error: string | null;
  regenerateCascade: (
    graphId: string,
    modifiedNodeId: string,
    options?: CascadeRegenOptions
  ) => Promise<CascadeRegenResult | null>;
  reset: () => void;
}

/**
 * Hook for managing cascade regeneration
 *
 * Usage:
 * ```tsx
 * const { isRegenerating, error, regenerateCascade } = useCascadeRegen();
 *
 * const handleRegenerate = async () => {
 *   const result = await regenerateCascade(graphId, nodeId);
 *   if (result?.success) {
 *     console.log(`Regenerated ${result.regeneratedCount} nodes`);
 *   }
 * };
 * ```
 */
export function useCascadeRegen(): UseCascadeRegenReturn {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regenerateCascade = useCallback(
    async (
      graphId: string,
      modifiedNodeId: string,
      options?: CascadeRegenOptions
    ): Promise<CascadeRegenResult | null> => {
      setIsRegenerating(true);
      setError(null);

      try {
        const result = await api.regenerateCascade(graphId, modifiedNodeId, options);
        setIsRegenerating(false);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to regenerate cascade';
        setError(errorMessage);
        setIsRegenerating(false);
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsRegenerating(false);
    setError(null);
  }, []);

  return {
    isRegenerating,
    error,
    regenerateCascade,
    reset,
  };
}
