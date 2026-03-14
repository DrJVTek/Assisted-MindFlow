/**
 * useGraphData Hook
 *
 * Fetches graph data from API and manages loading/error states.
 * Uses local state for loading/error to avoid conflicts with
 * the shared canvasStore isLoading (used by canvas CRUD operations).
 */

import { useState, useEffect } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { api } from '../../../services/api';

/**
 * Hook to fetch and load graph data
 *
 * @param graphId - UUID of the graph to load
 */
export function useGraphData(graphId: string | null) {
  const setGraphData = useCanvasStore((state) => state.setGraphData);
  const graphData = useCanvasStore((state) => state.graphData);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!graphId) {
      setGraphData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Skip fetch if we already have data for this graph (cache)
    if (graphData && graphData.id === graphId) {
      return;
    }

    const fetchGraph = async (retries = 3) => {
      try {
        setIsLoading(true);
        setError(null);

        const graph = await api.getGraph(graphId);
        setGraphData(graph);
      } catch (err) {
        // Retry logic for network errors
        if (retries > 0) {
          console.warn(`Retrying graph fetch (${retries} attempts left)...`);
          setTimeout(() => fetchGraph(retries - 1), 1000);
          return;
        }

        const message =
          err instanceof Error ? err.message : 'Failed to load graph data';
        setError(message);
        console.error('Failed to fetch graph after retries:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGraph();
  }, [graphId, setGraphData, graphData]);

  return { graphData, isLoading, error };
}
