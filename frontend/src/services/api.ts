/**
 * API client service using Axios
 * Handles all HTTP requests to the MindFlow Canvas API
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type { Graph, NodeVersion } from '../types/graph';
import type { CanvasViewport } from '../types/canvas';

/**
 * API base URL - uses Vite proxy in development
 * Proxy configured in vite.config.ts: /api -> http://localhost:8000
 */
const BASE_URL = '/api';

/**
 * Axios instance with default configuration
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 10 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Response interceptor for error handling
 */
apiClient.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    // Log errors for debugging
    console.error('API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    // Transform error for consistent handling
    const errorMessage =
      (error.response?.data as { message?: string })?.message ||
      error.message ||
      'An unknown error occurred';

    return Promise.reject(new Error(errorMessage));
  }
);

/**
 * API methods
 */
export const api = {
  /**
   * Health check
   */
  health: async (): Promise<{ status: string }> => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  /**
   * Get complete graph data
   */
  getGraph: async (graphId: string): Promise<Graph> => {
    const response = await apiClient.get(`/graphs/${graphId}`);
    return response.data;
  },

  /**
   * Get graph nodes only (paginated)
   */
  getGraphNodes: async (
    graphId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{
    nodes: Graph['nodes'];
    total: number;
    limit: number;
    offset: number;
  }> => {
    const response = await apiClient.get(`/graphs/${graphId}/nodes`, {
      params: options,
    });
    return response.data;
  },

  /**
   * Save viewport state
   */
  saveViewport: async (
    graphId: string,
    viewport: CanvasViewport
  ): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post(`/graphs/${graphId}/viewport`, viewport);
    return response.data;
  },

  /**
   * Get viewport state
   */
  getViewport: async (graphId: string): Promise<CanvasViewport> => {
    const response = await apiClient.get(`/graphs/${graphId}/viewport`);
    return response.data;
  },

  /**
   * Create a new node
   */
  createNode: async (
    graphId: string,
    nodeData: {
      type: string;
      content: string;
      importance: number;
      tags: string[];
      status: string;
      parent_ids?: string[];
    }
  ): Promise<any> => {
    const response = await apiClient.post(`/graphs/${graphId}/nodes`, nodeData);
    return response.data;
  },

  /**
   * Update an existing node
   */
  updateNode: async (
    graphId: string,
    nodeId: string,
    updates: {
      content?: string;
      importance?: number;
      tags?: string[];
      status?: string;
      position?: { x: number; y: number };
      child_ids?: string[];
      llm_response?: string | null;
      llm_operation_id?: string | null;
      font_size?: number;
      // Feature 009: Inline LLM fields
      llm_status?: string;
      llm_error?: string | null;
      prompt_height?: number;
      response_height?: number;
      note_top?: string | null;
      note_bottom?: string | null;
      collapsed?: boolean;
      summary?: string | null;
      node_width?: number;
      node_height?: number;
    }
  ): Promise<any> => {
    const response = await apiClient.put(`/graphs/${graphId}/nodes/${nodeId}`, updates);
    return response.data;
  },

  /**
   * Bulk update node positions (concurrent updates)
   */
  updateNodePositions: async (
    graphId: string,
    positions: Array<{ nodeId: string; position: { x: number; y: number } }>
  ): Promise<{ success: boolean; updated: number; errors: Array<{ nodeId: string; error: string }> }> => {
    const results = await Promise.allSettled(
      positions.map(({ nodeId, position }) =>
        apiClient.put(`/graphs/${graphId}/nodes/${nodeId}`, { position })
      )
    );

    const errors: Array<{ nodeId: string; error: string }> = [];
    let updated = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        updated++;
      } else {
        errors.push({
          nodeId: positions[index].nodeId,
          error: result.reason.message || 'Unknown error',
        });
      }
    });

    return {
      success: errors.length === 0,
      updated,
      errors,
    };
  },

  /**
   * Delete a node
   */
  deleteNode: async (graphId: string, nodeId: string): Promise<void> => {
    await apiClient.delete(`/graphs/${graphId}/nodes/${nodeId}`);
  },

  /**
   * Regenerate cascade from a modified node
   */
  regenerateCascade: async (
    graphId: string,
    modifiedNodeId: string,
    options?: {
      llmProvider?: string;
      llmModel?: string;
    }
  ): Promise<{
    success: boolean;
    affected_nodes: string[];
    regenerated_count: number;
    errors: Array<{ node_id: string; error: string }>;
    message: string;
  }> => {
    const response = await apiClient.post(`/graphs/${graphId}/regenerate-cascade`, {
      modified_node_id: modifiedNodeId,
      llm_provider: options?.llmProvider || 'mock',
      llm_model: options?.llmModel || 'mock-model',
    });
    return response.data;
  },

  // ============================================================================
  // GROUP METHODS
  // ============================================================================

  /**
   * Create a new group
   */
  createGroup: async (
    graphId: string,
    groupData: {
      label: string;
      kind?: string;
      color?: string;
      pinned_nodes?: string[];
      tags?: string[];
      parent_group?: string;
    }
  ): Promise<any> => {
    const response = await apiClient.post(`/graphs/${graphId}/groups`, groupData);
    return response.data;
  },

  /**
   * Update an existing group
   */
  updateGroup: async (
    graphId: string,
    groupId: string,
    updates: {
      label?: string;
      color?: string;
      pinned_nodes?: string[];
      tags?: string[];
    }
  ): Promise<any> => {
    const response = await apiClient.put(`/graphs/${graphId}/groups/${groupId}`, updates);
    return response.data;
  },

  /**
   * Delete a group
   */
  deleteGroup: async (graphId: string, groupId: string): Promise<void> => {
    await apiClient.delete(`/graphs/${graphId}/groups/${groupId}`);
  },

  // ============================================================================
  // COMMENT METHODS
  // ============================================================================

  /**
   * Create a new comment
   */
  createComment: async (
    graphId: string,
    commentData: {
      content: string;
      author?: string;
      node_id?: string;
      edge?: [string, string];
      position?: { x: number; y: number };
    }
  ): Promise<any> => {
    const response = await apiClient.post(`/graphs/${graphId}/comments`, commentData);
    return response.data;
  },

  /**
   * Update an existing comment
   */
  updateComment: async (
    graphId: string,
    commentId: string,
    updates: {
      content: string;
    }
  ): Promise<any> => {
    const response = await apiClient.put(`/graphs/${graphId}/comments/${commentId}`, updates);
    return response.data;
  },

  /**
   * Delete a comment
   */
  deleteComment: async (graphId: string, commentId: string): Promise<void> => {
    await apiClient.delete(`/graphs/${graphId}/comments/${commentId}`);
  },

  // ============================================================================
  // VERSION HISTORY METHODS
  // ============================================================================

  /**
   * Get all versions for a node
   */
  getNodeVersions: async (graphId: string, nodeId: string): Promise<NodeVersion[]> => {
    const response = await apiClient.get(`/graphs/${graphId}/nodes/${nodeId}/versions`);
    return response.data;
  },

  /**
   * Restore a previous version of a node
   */
  restoreNodeVersion: async (
    graphId: string,
    nodeId: string,
    versionId: string
  ): Promise<any> => {
    const response = await apiClient.post(
      `/graphs/${graphId}/nodes/${nodeId}/versions/${versionId}/restore`,
      {}
    );
    return response.data;
  },
};

  // ============================================================================
  // AUTH METHODS (ChatGPT OAuth)
  // ============================================================================

  /**
   * Start ChatGPT OAuth login flow
   */
  authLogin: async (): Promise<{
    status: string;
    message?: string;
    subscription_tier?: string;
    user_email?: string;
  }> => {
    const response = await apiClient.post('/auth/openai/login');
    return response.data;
  },

  /**
   * Get current OAuth session status
   */
  authGetStatus: async (): Promise<{
    auth_method: string;
    status: string;
    subscription_tier?: string;
    user_email?: string;
    expires_at?: string;
    needs_reauth?: boolean;
  }> => {
    const response = await apiClient.get('/auth/openai/status');
    return response.data;
  },

  /**
   * Logout from ChatGPT OAuth
   */
  authLogout: async (): Promise<{ status: string; message: string }> => {
    const response = await apiClient.post('/auth/openai/logout');
    return response.data;
  },

  /**
   * Start device code flow (for headless environments)
   */
  authDeviceCode: async (): Promise<{
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  }> => {
    const response = await apiClient.post('/auth/openai/device-code');
    return response.data;
  },
};

export default api;
