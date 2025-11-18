/**
 * useGraphData Hook
 *
 * Fetches graph data from API and manages loading/error states
 */

import { useEffect } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { api } from '../../../services/api';

/**
 * Hook to fetch and load graph data
 *
 * @param graphId - UUID of the graph to load
 */
export function useGraphData(graphId: string | null) {
  const setGraphData = useCanvasStore((state) => state.setGraphData);
  const setLoading = useCanvasStore((state) => state.setLoading);
  const setError = useCanvasStore((state) => state.setError);

  const graphData = useCanvasStore((state) => state.graphData);
  const isLoading = useCanvasStore((state) => state.isLoading);
  const error = useCanvasStore((state) => state.error);

  useEffect(() => {
    if (!graphId) {
      setGraphData(null);
      return;
    }

    // Skip fetch if we already have data for this graph (cache)
    if (graphData && graphData.id === graphId) {
      return;
    }

    const fetchGraph = async (retries = 3) => {
      try {
        setLoading(true);
        setError(null);

        const graph = await api.getGraph(graphId);
        setGraphData(graph);
      } catch (error) {
        // Retry logic for network errors
        if (retries > 0) {
          console.warn(`Retrying graph fetch (${retries} attempts left)...`);
          setTimeout(() => fetchGraph(retries - 1), 1000);
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Failed to load graph data';
        setError(message);
        console.error('Failed to fetch graph after retries:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGraph();
  }, [graphId, setGraphData, setLoading, setError, graphData]);

  return { graphData, isLoading, error };
}

