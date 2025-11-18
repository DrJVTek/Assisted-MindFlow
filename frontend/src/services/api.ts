/**
 * API client service using Axios
 * Handles all HTTP requests to the MindFlow Canvas API
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type { Graph } from '../types/graph';
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
};

export default api;
