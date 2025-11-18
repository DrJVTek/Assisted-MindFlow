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

    const fetchGraph = async () => {
      try {
        setLoading(true);
        setError(null);

        const graph = await api.getGraph(graphId);
        setGraphData(graph);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load graph data';
        setError(message);
        console.error('Failed to fetch graph:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGraph();
  }, [graphId, setGraphData, setLoading, setError]);

  return { graphData, isLoading, error };
}

