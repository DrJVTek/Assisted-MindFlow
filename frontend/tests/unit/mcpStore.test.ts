/**
 * Unit tests for mcpStore (T068)
 *
 * Feature 011 - US5: MCP client connections
 *
 * Tests:
 * - Initial state
 * - fetchConnections success and error
 * - addConnection adds to list
 * - removeConnection removes from list and tools
 * - refreshConnection updates in list
 * - fetchAllTools populates allTools
 * - invokeTool delegates to API
 * - getConnection query
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMCPStore } from '../../src/stores/mcpStore';
import type { MCPConnection, MCPToolWithSource } from '../../src/types/mcp';

// Mock the API module
vi.mock('../../src/services/api', () => ({
  api: {
    listMCPConnections: vi.fn(),
    addMCPConnection: vi.fn(),
    removeMCPConnection: vi.fn(),
    refreshMCPConnection: vi.fn(),
    listMCPTools: vi.fn(),
    invokeMCPTool: vi.fn(),
  },
}));

import { api } from '../../src/services/api';

const mockApi = api as {
  listMCPConnections: ReturnType<typeof vi.fn>;
  addMCPConnection: ReturnType<typeof vi.fn>;
  removeMCPConnection: ReturnType<typeof vi.fn>;
  refreshMCPConnection: ReturnType<typeof vi.fn>;
  listMCPTools: ReturnType<typeof vi.fn>;
  invokeMCPTool: ReturnType<typeof vi.fn>;
};

const mockConnection: MCPConnection = {
  id: 'conn-1',
  name: 'Test Server',
  transport_type: 'stdio',
  config: { command: 'npx', args: ['-y', 'some-server'] },
  status: 'connected',
  discovered_tools: [
    { name: 'search', description: 'Search tool', input_schema: {} },
  ],
  tool_count: 1,
  error_message: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockConnection2: MCPConnection = {
  id: 'conn-2',
  name: 'SSE Server',
  transport_type: 'sse',
  config: { url: 'http://localhost:3000/sse' },
  status: 'connected',
  discovered_tools: [],
  tool_count: 0,
  error_message: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockTool: MCPToolWithSource = {
  connection_id: 'conn-1',
  connection_name: 'Test Server',
  name: 'search',
  description: 'Search tool',
  input_schema: {},
};

describe('mcpStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMCPStore.setState({
      connections: [],
      allTools: [],
      loading: false,
      error: null,
    });
  });

  describe('initial state', () => {
    it('starts with empty connections and tools, not loading, no error', () => {
      const state = useMCPStore.getState();
      expect(state.connections).toEqual([]);
      expect(state.allTools).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchConnections', () => {
    it('populates connections on success', async () => {
      mockApi.listMCPConnections.mockResolvedValue({ connections: [mockConnection] });

      await useMCPStore.getState().fetchConnections();

      const state = useMCPStore.getState();
      expect(state.connections).toHaveLength(1);
      expect(state.connections[0].id).toBe('conn-1');
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      mockApi.listMCPConnections.mockRejectedValue(new Error('Fetch failed'));

      await useMCPStore.getState().fetchConnections();

      const state = useMCPStore.getState();
      expect(state.connections).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Fetch failed');
    });
  });

  describe('addConnection', () => {
    it('appends new connection to the list', async () => {
      mockApi.addMCPConnection.mockResolvedValue(mockConnection);

      const result = await useMCPStore.getState().addConnection({
        name: 'Test Server',
        transport_type: 'stdio',
        config: { command: 'npx' },
      });

      expect(result.id).toBe('conn-1');
      expect(useMCPStore.getState().connections).toHaveLength(1);
    });
  });

  describe('removeConnection', () => {
    it('removes connection from list', async () => {
      useMCPStore.setState({
        connections: [mockConnection, mockConnection2],
        allTools: [mockTool],
      });
      mockApi.removeMCPConnection.mockResolvedValue({ message: 'removed' });

      await useMCPStore.getState().removeConnection('conn-1');

      const state = useMCPStore.getState();
      expect(state.connections).toHaveLength(1);
      expect(state.connections[0].id).toBe('conn-2');
    });

    it('also removes tools belonging to the connection', async () => {
      useMCPStore.setState({
        connections: [mockConnection],
        allTools: [mockTool],
      });
      mockApi.removeMCPConnection.mockResolvedValue({ message: 'removed' });

      await useMCPStore.getState().removeConnection('conn-1');

      expect(useMCPStore.getState().allTools).toEqual([]);
    });
  });

  describe('refreshConnection', () => {
    it('updates connection in list', async () => {
      useMCPStore.setState({ connections: [mockConnection] });
      const refreshed: MCPConnection = {
        ...mockConnection,
        tool_count: 3,
        discovered_tools: [
          { name: 'search', description: 'Search', input_schema: {} },
          { name: 'calc', description: 'Calc', input_schema: {} },
          { name: 'fetch', description: 'Fetch', input_schema: {} },
        ],
      };
      mockApi.refreshMCPConnection.mockResolvedValue(refreshed);

      const result = await useMCPStore.getState().refreshConnection('conn-1');

      expect(result.tool_count).toBe(3);
      expect(useMCPStore.getState().connections[0].tool_count).toBe(3);
    });
  });

  describe('fetchAllTools', () => {
    it('populates allTools on success', async () => {
      mockApi.listMCPTools.mockResolvedValue({ tools: [mockTool] });

      await useMCPStore.getState().fetchAllTools();

      expect(useMCPStore.getState().allTools).toHaveLength(1);
      expect(useMCPStore.getState().allTools[0].name).toBe('search');
    });

    it('handles error gracefully without setting error state', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.listMCPTools.mockRejectedValue(new Error('fail'));

      await useMCPStore.getState().fetchAllTools();

      // fetchAllTools logs error but doesn't set state.error
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('invokeTool', () => {
    it('delegates to API and returns result', async () => {
      mockApi.invokeMCPTool.mockResolvedValue({ result: 'hello', is_error: false });

      const result = await useMCPStore.getState().invokeTool('conn-1', 'search', { query: 'test' });

      expect(result.result).toBe('hello');
      expect(result.is_error).toBe(false);
      expect(mockApi.invokeMCPTool).toHaveBeenCalledWith('conn-1', 'search', { query: 'test' });
    });

    it('returns error result when tool fails', async () => {
      mockApi.invokeMCPTool.mockResolvedValue({ result: 'Something went wrong', is_error: true });

      const result = await useMCPStore.getState().invokeTool('conn-1', 'bad-tool', {});

      expect(result.is_error).toBe(true);
    });
  });

  describe('getConnection', () => {
    it('returns connection by id', () => {
      useMCPStore.setState({ connections: [mockConnection, mockConnection2] });

      const result = useMCPStore.getState().getConnection('conn-2');
      expect(result).toBeDefined();
      expect(result!.name).toBe('SSE Server');
    });

    it('returns undefined for unknown id', () => {
      useMCPStore.setState({ connections: [mockConnection] });
      expect(useMCPStore.getState().getConnection('unknown')).toBeUndefined();
    });
  });
});
