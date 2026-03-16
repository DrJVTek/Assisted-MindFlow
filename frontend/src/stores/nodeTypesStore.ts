/**
 * Zustand store for node type definitions from the plugin system.
 *
 * Fetches GET /api/node-types at startup and caches the result.
 * Provides selectors for looking up node types, categories, and type definitions.
 */

import { create } from 'zustand';
import type {
  NodeTypeDefinition,
  TypeDefinition,
  CategoryInfo,
  NodeTypesResponse,
} from '../types/plugin';

interface NodeTypesStore {
  /** All node type definitions keyed by class_type */
  nodeTypes: Record<string, NodeTypeDefinition>;

  /** Data type definitions (STRING, CONTEXT, etc.) */
  typeDefinitions: Record<string, TypeDefinition>;

  /** Category list for grouping in NodeCreator */
  categories: CategoryInfo[];

  /** Loading state */
  isLoading: boolean;
  error: string | null;
  isLoaded: boolean;

  /** Fetch node types from backend */
  fetchNodeTypes: () => Promise<void>;

  /** Get a single node type definition */
  getNodeType: (classType: string) => NodeTypeDefinition | undefined;

  /** Get all node types for a category */
  getByCategory: (category: string) => Array<[string, NodeTypeDefinition]>;

  /** Get the display name for a node type */
  getDisplayName: (classType: string) => string;

  /** Get the color for a data type */
  getTypeColor: (typeName: string) => string;

  /** Resolve provider type from a node's class_type (via plugin category).
   *  Returns e.g. "chatgpt_web", "openai", "local", or null if not an LLM node. */
  getProviderType: (classType: string) => string | null;
}

export const useNodeTypesStore = create<NodeTypesStore>((set, get) => ({
  nodeTypes: {},
  typeDefinitions: {},
  categories: [],
  isLoading: false,
  error: null,
  isLoaded: false,

  fetchNodeTypes: async () => {
    if (get().isLoaded) return; // Already loaded
    set({ isLoading: true, error: null });

    try {
      const res = await fetch('/api/node-types');
      if (!res.ok) {
        throw new Error(`Failed to fetch node types: ${res.status} ${res.statusText}`);
      }
      const data: NodeTypesResponse = await res.json();
      set({
        nodeTypes: data.node_types,
        typeDefinitions: data.type_definitions,
        categories: data.categories,
        isLoading: false,
        isLoaded: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching node types';
      set({ isLoading: false, error: message });
      console.error('[nodeTypesStore] Failed to fetch node types:', err);
    }
  },

  getNodeType: (classType: string) => {
    return get().nodeTypes[classType];
  },

  getByCategory: (category: string) => {
    const { nodeTypes } = get();
    return Object.entries(nodeTypes).filter(
      ([, def]) => def.category === category || def.category.startsWith(category + '/')
    );
  },

  getDisplayName: (classType: string) => {
    const def = get().nodeTypes[classType];
    return def?.display_name ?? classType;
  },

  getTypeColor: (typeName: string) => {
    const def = get().typeDefinitions[typeName];
    return def?.color ?? '#90A4AE';
  },

  getProviderType: (classType: string) => {
    const def = get().nodeTypes[classType];
    if (!def) return null;
    const category = def.category || '';
    // Only LLM nodes have a provider (category starts with "llm/")
    if (!category.startsWith('llm/')) return null;
    const sub = category.split('/')[1]; // e.g., "chatgpt_web", "openai", "ollama"
    // Map plugin category → ProviderType (ollama backend type is "local")
    if (sub === 'ollama') return 'local';
    return sub || null;
  },
}));
