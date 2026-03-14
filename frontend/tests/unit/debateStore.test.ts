/**
 * Unit tests for debateStore (T067)
 *
 * Feature 011 - US2: Inter-LLM debate chains
 *
 * Tests:
 * - Initial state
 * - startDebate adds debate
 * - continueDebate updates existing
 * - stopDebate sets status to stopped
 * - fetchDebate adds/replaces debate
 * - fetchDebates loads all for graph
 * - getDebate query
 * - getActiveDebates filters by status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDebateStore } from '../../src/stores/debateStore';
import type { DebateChain } from '../../src/types/debate';

// Mock the API module
vi.mock('../../src/services/api', () => ({
  api: {
    startDebate: vi.fn(),
    continueDebate: vi.fn(),
    stopDebate: vi.fn(),
    getDebate: vi.fn(),
    listDebates: vi.fn(),
  },
}));

import { api } from '../../src/services/api';

const mockApi = api as {
  startDebate: ReturnType<typeof vi.fn>;
  continueDebate: ReturnType<typeof vi.fn>;
  stopDebate: ReturnType<typeof vi.fn>;
  getDebate: ReturnType<typeof vi.fn>;
  listDebates: ReturnType<typeof vi.fn>;
};

const mockDebate: DebateChain = {
  id: 'debate-1',
  graph_id: 'graph-1',
  start_node_id: 'node-1',
  node_ids: ['node-1', 'node-2'],
  round_count: 2,
  max_rounds: 5,
  status: 'running',
  error_message: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const completedDebate: DebateChain = {
  ...mockDebate,
  id: 'debate-2',
  status: 'completed',
  round_count: 5,
};

const pendingDebate: DebateChain = {
  ...mockDebate,
  id: 'debate-3',
  status: 'pending',
  round_count: 0,
};

describe('debateStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDebateStore.setState({
      debates: [],
      loading: false,
      error: null,
    });
  });

  describe('initial state', () => {
    it('starts with empty debates, not loading, no error', () => {
      const state = useDebateStore.getState();
      expect(state.debates).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('startDebate', () => {
    it('adds new debate to list', async () => {
      mockApi.startDebate.mockResolvedValue(mockDebate);

      const result = await useDebateStore.getState().startDebate('graph-1', 'node-1', 5);

      expect(result.id).toBe('debate-1');
      expect(useDebateStore.getState().debates).toHaveLength(1);
      expect(mockApi.startDebate).toHaveBeenCalledWith({
        graph_id: 'graph-1',
        start_node_id: 'node-1',
        max_rounds: 5,
      });
    });

    it('replaces existing debate with same id', async () => {
      useDebateStore.setState({ debates: [mockDebate] });
      const updatedDebate = { ...mockDebate, round_count: 3 };
      mockApi.startDebate.mockResolvedValue(updatedDebate);

      await useDebateStore.getState().startDebate('graph-1', 'node-1');

      const debates = useDebateStore.getState().debates;
      expect(debates).toHaveLength(1);
      expect(debates[0].round_count).toBe(3);
    });
  });

  describe('continueDebate', () => {
    it('updates existing debate in list', async () => {
      useDebateStore.setState({ debates: [mockDebate] });
      const continued = { ...mockDebate, round_count: 4 };
      mockApi.continueDebate.mockResolvedValue(continued);

      const result = await useDebateStore.getState().continueDebate('debate-1', 2);

      expect(result.round_count).toBe(4);
      expect(useDebateStore.getState().debates[0].round_count).toBe(4);
      expect(mockApi.continueDebate).toHaveBeenCalledWith('debate-1', { additional_rounds: 2 });
    });
  });

  describe('stopDebate', () => {
    it('sets debate status to stopped', async () => {
      useDebateStore.setState({ debates: [mockDebate] });
      mockApi.stopDebate.mockResolvedValue({ message: 'stopped', rounds_completed: 2 });

      await useDebateStore.getState().stopDebate('debate-1');

      const state = useDebateStore.getState();
      expect(state.debates[0].status).toBe('stopped');
    });
  });

  describe('fetchDebate', () => {
    it('adds debate to list if not present', async () => {
      mockApi.getDebate.mockResolvedValue(mockDebate);

      const result = await useDebateStore.getState().fetchDebate('debate-1');

      expect(result.id).toBe('debate-1');
      expect(useDebateStore.getState().debates).toHaveLength(1);
    });

    it('replaces existing debate with same id', async () => {
      useDebateStore.setState({ debates: [mockDebate] });
      const updated = { ...mockDebate, round_count: 5, status: 'completed' as const };
      mockApi.getDebate.mockResolvedValue(updated);

      await useDebateStore.getState().fetchDebate('debate-1');

      const debates = useDebateStore.getState().debates;
      expect(debates).toHaveLength(1);
      expect(debates[0].status).toBe('completed');
    });
  });

  describe('fetchDebates', () => {
    it('loads all debates for a graph', async () => {
      mockApi.listDebates.mockResolvedValue({ debates: [mockDebate, completedDebate] });

      await useDebateStore.getState().fetchDebates('graph-1');

      const state = useDebateStore.getState();
      expect(state.debates).toHaveLength(2);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      mockApi.listDebates.mockRejectedValue(new Error('Server error'));

      await useDebateStore.getState().fetchDebates('graph-1');

      const state = useDebateStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Server error');
    });
  });

  describe('getDebate', () => {
    it('returns debate by id', () => {
      useDebateStore.setState({ debates: [mockDebate, completedDebate] });

      const result = useDebateStore.getState().getDebate('debate-2');
      expect(result).toBeDefined();
      expect(result!.status).toBe('completed');
    });

    it('returns undefined for unknown id', () => {
      useDebateStore.setState({ debates: [mockDebate] });
      expect(useDebateStore.getState().getDebate('unknown')).toBeUndefined();
    });
  });

  describe('getActiveDebates', () => {
    it('returns only running and pending debates', () => {
      useDebateStore.setState({ debates: [mockDebate, completedDebate, pendingDebate] });

      const active = useDebateStore.getState().getActiveDebates();
      expect(active).toHaveLength(2);

      const statuses = active.map(d => d.status);
      expect(statuses).toContain('running');
      expect(statuses).toContain('pending');
      expect(statuses).not.toContain('completed');
    });

    it('returns empty array when no active debates', () => {
      useDebateStore.setState({ debates: [completedDebate] });
      expect(useDebateStore.getState().getActiveDebates()).toEqual([]);
    });
  });
});
