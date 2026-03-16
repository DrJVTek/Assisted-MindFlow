/**
 * Unit tests for useAutoLaunchLLM hook
 *
 * Feature 009: User Story 1 - Auto-Launch LLM on Node Creation
 *
 * Tests:
 * - Hook launches LLM when isNewNode=true
 * - Hook does NOT launch when isNewNode=false
 * - Hook prevents duplicate launches on re-renders
 * - Hook uses existing LLM configuration
 * - Hook handles errors gracefully
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAutoLaunchLLM } from '../../src/hooks/useAutoLaunchLLM';

// Mock the stores and hooks
vi.mock('../../src/stores/llmOperationsStore', () => ({
  useLLMOperationsStore: vi.fn(() => ({
    createOperation: mockCreateOperation
  }))
}));

vi.mock('../../src/hooks/useStreamingContent', () => ({
  useStreamingContent: vi.fn(() => ({
    startStreaming: mockStartStreaming,
    stopStreaming: vi.fn(),
    isStreaming: false,
    error: null
  }))
}));

vi.mock('../../src/stores/providerStore', () => ({
  useProviderStore: {
    getState: () => ({
      providers: [
        { id: 'test-provider-id', type: 'local', name: 'Test Ollama', selected_model: 'llama3.2' },
      ],
    }),
  },
}));

vi.mock('../../src/stores/nodeTypesStore', () => ({
  useNodeTypesStore: {
    getState: () => ({
      getProviderType: (classType: string) => {
        if (classType === 'ollama_chat') return 'local';
        return null;
      },
    }),
  },
}));

// Mock functions
const mockCreateOperation = vi.fn();
const mockStartStreaming = vi.fn();

describe('useAutoLaunchLLM', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    mockCreateOperation.mockResolvedValue('op-123');
    mockStartStreaming.mockResolvedValue(undefined);
    // Provide default LLM config in localStorage for tests without classType
    localStorage.setItem('mindflow_llm_config', JSON.stringify({ provider: 'local', model: 'llama3.2' }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('mindflow_llm_config');
  });

  it('launches LLM on mount when isNewNode=true', async () => {
    renderHook(() =>
      useAutoLaunchLLM({
        nodeId: 'node-1',
        graphId: 'graph-1',
        isNewNode: true,
        content: 'test question'
      })
    );

    await waitFor(() => {
      expect(mockCreateOperation).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'node-1',
        graphId: 'graph-1',
        prompt: 'test question'
      })
    );

    await waitFor(() => {
      expect(mockStartStreaming).toHaveBeenCalledWith('op-123');
    });
  });

  it('does NOT launch when isNewNode=false', async () => {
    renderHook(() =>
      useAutoLaunchLLM({
        nodeId: 'node-1',
        graphId: 'graph-1',
        isNewNode: false,
        content: 'test question'
      })
    );

    // Wait a bit to ensure no async calls happen
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockCreateOperation).not.toHaveBeenCalled();
    expect(mockStartStreaming).not.toHaveBeenCalled();
  });

  it('does NOT launch when content is empty', async () => {
    renderHook(() =>
      useAutoLaunchLLM({
        nodeId: 'node-1',
        graphId: 'graph-1',
        isNewNode: true,
        content: ''
      })
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockCreateOperation).not.toHaveBeenCalled();
  });

  it('prevents duplicate launches on re-renders', async () => {
    const { rerender } = renderHook(
      ({ isNewNode }) =>
        useAutoLaunchLLM({
          nodeId: 'node-1',
          graphId: 'graph-1',
          isNewNode,
          content: 'test question'
        }),
      { initialProps: { isNewNode: true } }
    );

    await waitFor(() => {
      expect(mockCreateOperation).toHaveBeenCalledTimes(1);
    });

    // Re-render with same props
    rerender({ isNewNode: true });
    rerender({ isNewNode: true });
    rerender({ isNewNode: true });

    // Wait to ensure no additional calls
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should still only be called once
    expect(mockCreateOperation).toHaveBeenCalledTimes(1);
  });

  it('handles createOperation errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockCreateOperation.mockRejectedValue(new Error('LLM service unavailable'));

    renderHook(() =>
      useAutoLaunchLLM({
        nodeId: 'node-1',
        graphId: 'graph-1',
        isNewNode: true,
        content: 'test question'
      })
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    expect(mockStartStreaming).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('handles startStreaming errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockStartStreaming.mockRejectedValue(new Error('Stream connection failed'));

    renderHook(() =>
      useAutoLaunchLLM({
        nodeId: 'node-1',
        graphId: 'graph-1',
        isNewNode: true,
        content: 'test question'
      })
    );

    await waitFor(() => {
      expect(mockCreateOperation).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  it('uses LLM configuration from store/settings', async () => {
    renderHook(() =>
      useAutoLaunchLLM({
        nodeId: 'node-1',
        graphId: 'graph-1',
        isNewNode: true,
        content: 'test question'
      })
    );

    await waitFor(() => {
      expect(mockCreateOperation).toHaveBeenCalled();
    });

    const createCallArgs = mockCreateOperation.mock.calls[0][0];

    // Should have provider and model (from settings/defaults)
    expect(createCallArgs).toHaveProperty('provider');
    expect(createCallArgs).toHaveProperty('model');
  });

  it('does NOT re-launch if isNewNode changes from false to true after mount', async () => {
    const { rerender } = renderHook(
      ({ isNewNode }) =>
        useAutoLaunchLLM({
          nodeId: 'node-1',
          graphId: 'graph-1',
          isNewNode,
          content: 'test question'
        }),
      { initialProps: { isNewNode: false } }
    );

    // Initial render with isNewNode=false
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockCreateOperation).not.toHaveBeenCalled();

    // Change to isNewNode=true
    rerender({ isNewNode: true });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Should still not launch (only launches on initial mount with isNewNode=true)
    expect(mockCreateOperation).not.toHaveBeenCalled();
  });
});
