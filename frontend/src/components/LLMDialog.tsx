/**
 * LLMDialog - Dialog for launching LLM operations on nodes
 *
 * Allows users to:
 * - Select LLM provider (OpenAI, Anthropic, Ollama)
 * - Select model
 * - Enter prompt
 * - Configure parameters (temperature, etc.)
 * - Start streaming operation
 *
 * Example:
 * ```tsx
 * <LLMDialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   nodeId={nodeId}
 *   graphId={graphId}
 * />
 * ```
 */

import React, { useState } from 'react';
import { X, Bot, Sparkles } from 'lucide-react';
import type { UUID } from '../types/uuid';
import { useLLMOperationsStore } from '../stores/llmOperationsStore';
import { useStreamingContent } from '../hooks/useStreamingContent';

export interface LLMDialogProps {
  /**
   * Dialog open state
   */
  isOpen: boolean;

  /**
   * Close callback
   */
  onClose: () => void;

  /**
   * Node ID to generate content for
   */
  nodeId: UUID;

  /**
   * Graph ID
   */
  graphId: UUID;

  /**
   * Optional initial prompt
   */
  initialPrompt?: string;
}

/**
 * LLM operation dialog component
 */
export const LLMDialog: React.FC<LLMDialogProps> = ({
  isOpen,
  onClose,
  nodeId,
  graphId,
  initialPrompt = ''
}) => {
  // State
  const [provider, setProvider] = useState<'ollama' | 'openai' | 'anthropic'>('ollama');
  const [model, setModel] = useState('llama3.2:3b');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);

  // Stores & hooks
  const createOperation = useLLMOperationsStore(state => state.createOperation);
  const { startStreaming } = useStreamingContent(nodeId, {
    onComplete: (tokens) => {
      console.log(`LLM completed: ${tokens} tokens`);
      onClose();
    },
    onError: (error) => {
      console.error('LLM error:', error);
      alert(`Error: ${error}`);
      setIsLaunching(false);
    }
  });

  // Model options by provider
  const modelOptions = {
    ollama: [
      'llama3.2:3b',
      'llama3.2:latest',
      'llama3:8b',
      'mistral:latest',
      'deepseek-r1:7b',
      'qwen2.5-coder:14b',
    ],
    openai: [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
    ],
    anthropic: [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ]
  };

  // Launch LLM operation
  const handleLaunch = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    try {
      setIsLaunching(true);

      // Create operation
      const operationId = await createOperation({
        nodeId,
        graphId,
        provider,
        model,
        prompt: prompt.trim(),
        systemPrompt: systemPrompt.trim() || undefined
      });

      // Start streaming
      await startStreaming(operationId);

    } catch (error) {
      console.error('Error launching LLM:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLaunching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Ask LLM</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            disabled={isLaunching}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Provider selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as any);
                setModel(modelOptions[e.target.value as keyof typeof modelOptions][0]);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLaunching}
            >
              <option value="ollama">Ollama (Local)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>

          {/* Model selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLaunching}
            >
              {modelOptions[provider].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt *
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What would you like the LLM to generate?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              rows={6}
              disabled={isLaunching}
            />
          </div>

          {/* System prompt (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              System Prompt (optional)
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Optional system instructions..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              rows={3}
              disabled={isLaunching}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded transition-colors"
            disabled={isLaunching}
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={isLaunching || !prompt.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLaunching ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Launching...
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" />
                Start LLM
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
