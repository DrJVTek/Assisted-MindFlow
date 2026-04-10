/**
 * API client service using Axios
 * Handles all HTTP requests to the MindFlow Canvas API
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type { Graph, NodeVersion } from '../types/graph';
import type { CanvasViewport } from '../types/canvas';
import type {
  ProviderConfig,
  CreateProviderRequest,
  UpdateProviderRequest,
  ModelInfo,
} from '../types/provider';
import type {
  MCPConnection,
  CreateMCPConnectionRequest,
  MCPToolWithSource,
} from '../types/mcp';
import type {
  DebateChain,
  StartDebateRequest,
  ContinueDebateRequest,
} from '../types/debate';

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
      provider_id?: string | null;
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
      font_size?: number;
      // Inline LLM fields
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
      // Feature 011: Multi-provider LLM
      provider_id?: string | null;
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

  // ============================================================================
  // AUTH METHODS (DEPRECATED — use provider OAuth methods below)
  // ============================================================================

  /** @deprecated Use providerOAuthLogin instead */
  authLogin: async (): Promise<{
    status: string;
    message?: string;
    subscription_tier?: string;
    user_email?: string;
  }> => {
    const response = await apiClient.post('/auth/openai/login', {}, { timeout: 130_000 });
    return response.data;
  },

  /** @deprecated Use providerOAuthStatus instead */
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

  /** @deprecated Use providerOAuthLogout instead */
  authLogout: async (): Promise<{ status: string; message: string }> => {
    const response = await apiClient.post('/auth/openai/logout');
    return response.data;
  },

  /** @deprecated Use providerOAuthDeviceCode instead */
  authDeviceCode: async (): Promise<{
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  }> => {
    const response = await apiClient.post('/auth/openai/device-code', {}, { timeout: 600_000 });
    return response.data;
  },

  /** @deprecated Use getProviderModels instead */
  authModels: async (): Promise<{
    models: Array<{ id: string; name: string; available: boolean }>;
    selected_model: string | null;
    auth_method: string;
  }> => {
    const response = await apiClient.get('/auth/openai/models');
    return response.data;
  },

  // ── ChatGPT Web Token (conversation import) ────────────────

  /**
   * Set ChatGPT web access token for conversation import
   */
  setChatGPTAccessToken: async (accessToken: string): Promise<{
    has_token: boolean;
    status: string;
    message: string;
  }> => {
    const response = await apiClient.post('/import/chatgpt/access-token', {
      access_token: accessToken,
    });
    return response.data;
  },

  /**
   * Get ChatGPT web token status
   */
  getChatGPTTokenStatus: async (): Promise<{
    has_token: boolean;
    status: string;
    message: string;
  }> => {
    const response = await apiClient.get('/import/chatgpt/token-status');
    return response.data;
  },

  /**
   * Remove ChatGPT web token
   */
  deleteChatGPTToken: async (): Promise<{
    has_token: boolean;
    status: string;
    message: string;
  }> => {
    const response = await apiClient.delete('/import/chatgpt/access-token');
    return response.data;
  },

  // ── Conversation Import ──────────────────────────────────────

  /**
   * List ChatGPT projects (folders)
   */
  listChatGPTProjects: async (): Promise<Array<{
    id: string;
    name: string;
    created_at: string | null;
    conversation_count: number | null;
  }>> => {
    const response = await apiClient.get('/import/chatgpt/projects');
    return response.data;
  },

  /**
   * List conversations within a specific ChatGPT project
   */
  listProjectConversations: async (projectId: string, offset = 0, limit = 28): Promise<{
    conversations: Array<{
      id: string;
      title: string;
      created_at: string | null;
      source: string;
    }>;
    total: number;
  }> => {
    const response = await apiClient.get(`/import/chatgpt/projects/${projectId}/conversations?offset=${offset}&limit=${limit}`);
    return response.data;
  },

  /**
   * List ChatGPT conversations with optional archive filter
   */
  listChatGPTConversations: async (offset = 0, limit = 28, isArchived?: boolean): Promise<{
    conversations: Array<{
      id: string;
      title: string;
      created_at: string | null;
      source: string;
    }>;
    total: number;
  }> => {
    let url = `/import/chatgpt/conversations?offset=${offset}&limit=${limit}`;
    if (isArchived !== undefined) {
      url += `&is_archived=${isArchived}`;
    }
    const response = await apiClient.get(url);
    return response.data;
  },

  /**
   * Preview a ChatGPT conversation before importing
   */
  previewChatGPTConversation: async (conversationId: string): Promise<{
    id: string;
    title: string;
    source: string;
    message_count: number;
    messages: Array<{ role: string; content_preview: string; has_branches: boolean }>;
  }> => {
    const response = await apiClient.get(`/import/chatgpt/conversations/${conversationId}`);
    return response.data;
  },

  /**
   * Import a ChatGPT conversation into a graph
   */
  importChatGPTConversation: async (params: {
    conversation_id: string;
    graph_id: string;
    mode?: string;
    start_x?: number;
    start_y?: number;
  }): Promise<{
    group_id: string;
    node_count: number;
    message: string;
  }> => {
    const response = await apiClient.post('/import/chatgpt/import', params);
    return response.data;
  },
  // ============================================================================
  // PROVIDER REGISTRY METHODS (Feature 011)
  // ============================================================================

  /**
   * List all registered providers
   */
  listProviders: async (): Promise<{ providers: ProviderConfig[] }> => {
    const response = await apiClient.get('/providers');
    return response.data;
  },

  /**
   * Register a new provider
   */
  createProvider: async (request: CreateProviderRequest): Promise<ProviderConfig> => {
    const response = await apiClient.post('/providers', request);
    return response.data;
  },

  /**
   * Update an existing provider
   */
  updateProvider: async (id: string, request: UpdateProviderRequest): Promise<ProviderConfig> => {
    const response = await apiClient.put(`/providers/${id}`, request);
    return response.data;
  },

  /**
   * Delete a provider
   */
  deleteProvider: async (id: string): Promise<{ message: string; affected_nodes: number }> => {
    const response = await apiClient.delete(`/providers/${id}`);
    return response.data;
  },

  /**
   * Re-validate a provider's connection
   */
  validateProvider: async (id: string): Promise<{ status: string; available_models: string[] }> => {
    const response = await apiClient.post(`/providers/${id}/validate`);
    return response.data;
  },

  /**
   * List available models for a provider
   */
  getProviderModels: async (id: string): Promise<{ models: ModelInfo[] }> => {
    const response = await apiClient.get(`/providers/${id}/models`);
    return response.data;
  },

  // ── Provider OAuth Methods ────────────────────────────────────

  /**
   * Start OAuth login flow for a provider
   */
  providerOAuthLogin: async (providerId: string): Promise<{
    status: string;
    message?: string;
    user_email?: string;
    subscription_tier?: string;
  }> => {
    const response = await apiClient.post(`/providers/${providerId}/oauth/login`, {}, { timeout: 130_000 });
    return response.data;
  },

  /**
   * Get OAuth session status for a provider
   */
  providerOAuthStatus: async (providerId: string): Promise<{
    status: string;
    user_email?: string;
    subscription_tier?: string;
    expires_at?: string;
    needs_reauth?: boolean;
  }> => {
    const response = await apiClient.get(`/providers/${providerId}/oauth/status`);
    return response.data;
  },

  /**
   * Logout OAuth session for a provider
   */
  providerOAuthLogout: async (providerId: string): Promise<{ status: string; message: string }> => {
    const response = await apiClient.post(`/providers/${providerId}/oauth/logout`);
    return response.data;
  },

  /**
   * Start device code OAuth flow for a provider
   */
  providerOAuthDeviceCode: async (providerId: string): Promise<{
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  }> => {
    const response = await apiClient.post(`/providers/${providerId}/oauth/device-code`, {}, { timeout: 600_000 });
    return response.data;
  },

  // ============================================================================
  // DEBATE METHODS (Feature 011 - US2)
  // ============================================================================

  /**
   * Start a new debate chain
   */
  startDebate: async (request: StartDebateRequest): Promise<DebateChain> => {
    const response = await apiClient.post('/debates', request);
    return response.data;
  },

  /**
   * Get debate status
   */
  getDebate: async (debateId: string): Promise<DebateChain> => {
    const response = await apiClient.get(`/debates/${debateId}`);
    return response.data;
  },

  /**
   * Continue a debate for additional rounds
   */
  continueDebate: async (debateId: string, request: ContinueDebateRequest): Promise<DebateChain> => {
    const response = await apiClient.post(`/debates/${debateId}/continue`, request);
    return response.data;
  },

  /**
   * Stop a running debate
   */
  stopDebate: async (debateId: string): Promise<{ message: string; rounds_completed: number }> => {
    const response = await apiClient.delete(`/debates/${debateId}`);
    return response.data;
  },

  /**
   * List debates for a graph
   */
  listDebates: async (graphId?: string): Promise<{ debates: DebateChain[] }> => {
    const params = graphId ? { graph_id: graphId } : {};
    const response = await apiClient.get('/debates', { params });
    return response.data;
  },

  /**
   * Generate a summary from a group of nodes
   */
  summarizeGroup: async (graphId: string, params: {
    node_ids: string[];
    provider_id: string;
    position?: { x: number; y: number };
  }): Promise<{ summary_node_id: string; content: string; message: string }> => {
    const response = await apiClient.post(`/graphs/${graphId}/nodes/summarize-group`, params);
    return response.data;
  },

  // ============================================================================
  // MCP CLIENT METHODS (Feature 011 - US5)
  // ============================================================================

  /**
   * List all MCP connections
   */
  listMCPConnections: async (): Promise<{ connections: MCPConnection[] }> => {
    const response = await apiClient.get('/mcp-connections');
    return response.data;
  },

  /**
   * Add a new MCP server connection
   */
  addMCPConnection: async (request: CreateMCPConnectionRequest): Promise<MCPConnection> => {
    const response = await apiClient.post('/mcp-connections', request);
    return response.data;
  },

  /**
   * Get MCP connection details
   */
  getMCPConnection: async (connectionId: string): Promise<MCPConnection> => {
    const response = await apiClient.get(`/mcp-connections/${connectionId}`);
    return response.data;
  },

  /**
   * Remove an MCP connection
   */
  removeMCPConnection: async (connectionId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/mcp-connections/${connectionId}`);
    return response.data;
  },

  /**
   * Refresh tools from a connected MCP server
   */
  refreshMCPConnection: async (connectionId: string): Promise<MCPConnection> => {
    const response = await apiClient.post(`/mcp-connections/${connectionId}/refresh`);
    return response.data;
  },

  /**
   * List all available tools across all connected MCP servers
   */
  listMCPTools: async (): Promise<{ tools: MCPToolWithSource[] }> => {
    const response = await apiClient.get('/mcp-connections/tools');
    return response.data;
  },

  /**
   * Invoke an MCP tool
   */
  invokeMCPTool: async (connectionId: string, toolName: string, args: Record<string, any>): Promise<{ result: string; is_error: boolean }> => {
    const response = await apiClient.post(`/mcp-connections/${connectionId}/tools/${toolName}/invoke`, { arguments: args });
    return response.data;
  },
};

export default api;
