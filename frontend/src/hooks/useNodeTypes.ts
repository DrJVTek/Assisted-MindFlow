/**
 * useNodeTypes — convenience hook wrapping nodeTypesStore with auto-fetch.
 *
 * Triggers fetchNodeTypes on first use and provides loading/error state.
 */

import { useEffect } from 'react';
import { useNodeTypesStore } from '../stores/nodeTypesStore';

export function useNodeTypes() {
  const store = useNodeTypesStore();

  useEffect(() => {
    if (!store.isLoaded && !store.isLoading) {
      store.fetchNodeTypes();
    }
  }, [store.isLoaded, store.isLoading, store.fetchNodeTypes]);

  return {
    nodeTypes: store.nodeTypes,
    typeDefinitions: store.typeDefinitions,
    categories: store.categories,
    isLoading: store.isLoading,
    error: store.error,
    isLoaded: store.isLoaded,
    getNodeType: store.getNodeType,
    getByCategory: store.getByCategory,
    getDisplayName: store.getDisplayName,
    getTypeColor: store.getTypeColor,
  };
}
