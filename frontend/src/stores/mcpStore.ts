/**
 * Zustand store for MCP client connections (Feature 011 - US5)
 */

import { create } from 'zustand';
import type { MCPConnection, MCPToolWithSource, CreateMCPConnectionRequest } from '../types/mcp';
import { api } from '../services/api';

interface MCPState {
  connections: MCPConnection[];
  allTools: MCPToolWithSource[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchConnections: () => Promise<void>;
  addConnection: (request: CreateMCPConnectionRequest) => Promise<MCPConnection>;
  removeConnection: (connectionId: string) => Promise<void>;
  refreshConnection: (connectionId: string) => Promise<MCPConnection>;
  fetchAllTools: () => Promise<void>;
  invokeTool: (connectionId: string, toolName: string, args: Record<string, any>) => Promise<{ result: string; is_error: boolean }>;

  // Queries
  getConnection: (connectionId: string) => MCPConnection | undefined;
}

export const useMCPStore = create<MCPState>((set, get) => ({
  connections: [],
  allTools: [],
  loading: false,
  error: null,

  fetchConnections: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.listMCPConnections();
      set({ connections: response.connections, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  addConnection: async (request) => {
    const conn = await api.addMCPConnection(request);
    set(state => ({
      connections: [...state.connections, conn],
    }));
    return conn;
  },

  removeConnection: async (connectionId) => {
    await api.removeMCPConnection(connectionId);
    set(state => ({
      connections: state.connections.filter(c => c.id !== connectionId),
      allTools: state.allTools.filter(t => t.connection_id !== connectionId),
    }));
  },

  refreshConnection: async (connectionId) => {
    const conn = await api.refreshMCPConnection(connectionId);
    set(state => ({
      connections: state.connections.map(c => c.id === connectionId ? conn : c),
    }));
    return conn;
  },

  fetchAllTools: async () => {
    try {
      const response = await api.listMCPTools();
      set({ allTools: response.tools });
    } catch (err) {
      console.error('Failed to fetch MCP tools:', err);
    }
  },

  invokeTool: async (connectionId, toolName, args) => {
    return await api.invokeMCPTool(connectionId, toolName, args);
  },

  getConnection: (connectionId) => {
    return get().connections.find(c => c.id === connectionId);
  },
}));
