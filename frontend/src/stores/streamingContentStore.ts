/**
 * Streaming Content Store - High-frequency content updates during LLM streaming
 *
 * Separate store from llmOperationsStore to prevent re-render storms.
 * This store updates at token-level granularity (100+ updates/sec during fast streaming).
 *
 * Use selective subscriptions to only re-render when specific node content changes:
 * ```typescript
 * // ✅ GOOD: Subscribe to specific node only
 * const content = useStreamingContentStore(
 *   state => state.nodeContent.get(nodeId)
 * );
 *
 * // ❌ BAD: Subscribe to entire store (re-renders on every token)
 * const { nodeContent } = useStreamingContentStore();
 * ```
 */

import { create } from 'zustand';

// UUID type (string alias) - defined locally to avoid import issues
type UUID = string;

/**
 * Streaming content state
 */
interface StreamingContentState {
  // Node content (updated during streaming)
  nodeContent: Map<UUID, string>;

  // Last update timestamp per node (for debouncing)
  lastUpdate: Map<UUID, number>;

  // Actions
  appendContent: (nodeId: UUID, content: string) => void;
  setContent: (nodeId: UUID, content: string) => void;
  clearContent: (nodeId: UUID) => void;
  clearAll: () => void;

  // Queries
  getContent: (nodeId: UUID) => string;
  getContentLength: (nodeId: UUID) => number;
  hasContent: (nodeId: UUID) => boolean;
}

/**
 * Streaming Content Zustand store
 *
 * Optimized for high-frequency updates during LLM streaming.
 * Use selective subscriptions to prevent re-render storms.
 */
export const useStreamingContentStore = create<StreamingContentState>((set, get) => ({
  // Initial state
  nodeContent: new Map(),
  lastUpdate: new Map(),

  // Append content to node
  appendContent: (nodeId, content) => {
    set((state) => {
      const current = state.nodeContent.get(nodeId) || '';
      const newContent = new Map(state.nodeContent);
      const newUpdate = new Map(state.lastUpdate);

      newContent.set(nodeId, current + content);
      newUpdate.set(nodeId, Date.now());

      return {
        nodeContent: newContent,
        lastUpdate: newUpdate
      };
    });
  },

  // Set content (replace)
  setContent: (nodeId, content) => {
    set((state) => {
      const newContent = new Map(state.nodeContent);
      const newUpdate = new Map(state.lastUpdate);

      newContent.set(nodeId, content);
      newUpdate.set(nodeId, Date.now());

      return {
        nodeContent: newContent,
        lastUpdate: newUpdate
      };
    });
  },

  // Clear content for node
  clearContent: (nodeId) => {
    set((state) => {
      const newContent = new Map(state.nodeContent);
      const newUpdate = new Map(state.lastUpdate);

      newContent.delete(nodeId);
      newUpdate.delete(nodeId);

      return {
        nodeContent: newContent,
        lastUpdate: newUpdate
      };
    });
  },

  // Clear all content
  clearAll: () => {
    set({
      nodeContent: new Map(),
      lastUpdate: new Map()
    });
  },

  // Get content for node
  getContent: (nodeId) => {
    return get().nodeContent.get(nodeId) || '';
  },

  // Get content length
  getContentLength: (nodeId) => {
    const content = get().nodeContent.get(nodeId);
    return content ? content.length : 0;
  },

  // Check if node has content
  hasContent: (nodeId) => {
    return get().nodeContent.has(nodeId);
  }
}));
