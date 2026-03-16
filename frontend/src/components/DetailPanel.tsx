/**
 * DetailPanel — ChatGPT-like workspace for the selected node.
 *
 * When a node is selected on the canvas, this panel shows:
 * 1. Parent context (previous response, read-only) at top
 * 2. Prompt editor (the node's content)
 * 3. LLM response zone (streamed markdown)
 * 4. Auto-creates a new empty child node after response completes
 *
 * The canvas shows collapsed compact nodes; this panel is where
 * the actual conversation/editing happens.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Send,
  ChevronDown,
  ChevronUp,
  Settings2,
  Plus,
} from 'lucide-react';
import type { Node, NodeType, NodeStatus } from '../types/graph';
import { useProviderStore } from '../stores/providerStore';
import { PROVIDER_TYPE_LABELS } from '../types/provider';
import { ProviderSelector } from './ProviderSelector';
import { LLMNodeContent } from './LLMNodeContent';
import { DynamicNodeView } from './DynamicNodeView';
import { useLLMOperationsStore } from '../stores/llmOperationsStore';
import { useStreamingContent } from '../hooks/useStreamingContent';
import { useNodeTypesStore } from '../stores/nodeTypesStore';
import { api } from '../services/api';

// ─── Types ───────────────────────────────────────────────────────────

export interface NodeUpdateData {
  type: string;
  status: string;
  importance: number;
  tags: string[];
  content: string;
}

interface DetailPanelProps {
  node: Node;
  graphId: string;
  /** All nodes in the graph — used to find parent content */
  allNodes: Record<string, Node>;
  onClose: () => void;
  onUpdate?: (nodeId: string, updates: Partial<NodeUpdateData>) => void;
  /** Called when a new child node should be created */
  onCreateChild?: (parentId: string) => void;
  /** Called to select a different node */
  onSelectNode?: (nodeId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getParentContext(node: Node, allNodes: Record<string, Node>): { prompt: string; response: string } | null {
  if (!node.parents || node.parents.length === 0) return null;

  // Get the first parent (primary conversation chain)
  const parentId = node.parents[0];
  const parent = allNodes[parentId];
  if (!parent) return null;

  return {
    prompt: parent.content || '',
    response: parent.llm_response || '',
  };
}

// ─── Main Component ─────────────────────────────────────────────────

export function DetailPanel({
  node,
  graphId,
  allNodes,
  onClose,
  onUpdate,
  onCreateChild,
  onSelectNode,
}: DetailPanelProps) {
  const [content, setContent] = useState(node.content);
  const [showSettings, setShowSettings] = useState(false);
  const [autoCreatedChildId, setAutoCreatedChildId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevLlmStatusRef = useRef<string | null>(null);

  // Node type info (must come before provider resolution)
  const classType = (node as any).class_type || node.type;
  const nodeTypeDef = useNodeTypesStore((s) => s.nodeTypes[classType]);
  const pluginProviderType = useNodeTypesStore((s) => s.getProviderType(classType));
  const headerColor = nodeTypeDef?.ui?.color || '#546E7A';
  const displayName = nodeTypeDef?.display_name || (node.type || 'node').replace(/_/g, ' ');

  // Provider info — resolve from explicit provider_id, or auto-detect from plugin category
  const providerId = (node as any).provider_id || null;
  const provider = useProviderStore((s) => {
    // Explicit provider_id takes priority
    if (providerId) return s.providers.find((p) => p.id === providerId);
    // Auto-resolve from plugin category (e.g., class_type "chatgpt_web_chat" → provider type "chatgpt_web")
    if (pluginProviderType) return s.providers.find((p) => p.type === pluginProviderType);
    return undefined;
  });

  // LLM operations
  const { createOperation } = useLLMOperationsStore();
  const { startStreaming } = useStreamingContent(node.id, { graphId });

  // Parent context
  const parentContext = getParentContext(node, allNodes);

  // Reset when node changes
  useEffect(() => {
    setContent(node.content);
    setAutoCreatedChildId(null);
    prevLlmStatusRef.current = null;
    // Focus textarea when opening a new empty node
    if (!node.content && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [node.id, node.content]);

  // Auto-create child node when LLM response completes
  useEffect(() => {
    const currentStatus = (node as any).llm_status;
    const prevStatus = prevLlmStatusRef.current;
    prevLlmStatusRef.current = currentStatus;

    if (
      prevStatus &&
      prevStatus !== 'complete' &&
      currentStatus === 'complete' &&
      !autoCreatedChildId &&
      onCreateChild
    ) {
      onCreateChild(node.id);
      // We'll get the child ID from the callback
    }
  }, [(node as any).llm_status, node.id, autoCreatedChildId, onCreateChild]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  const handleSaveContent = useCallback(async () => {
    if (!graphId) return;
    try {
      await api.updateNode(graphId, node.id, { content });
      onUpdate?.(node.id, { content } as any);
      // Mark node and descendants dirty for re-execution
      fetch(`/api/graphs/${graphId}/nodes/${node.id}/mark-dirty`, {
        method: 'POST',
      }).catch(() => {
        // Non-critical — dirty state will be resolved on next execution
      });
    } catch (err) {
      console.error('Failed to save content:', err);
    }
  }, [graphId, node.id, content, onUpdate]);

  const handleGenerate = useCallback(async () => {
    if (!graphId || !content.trim()) return;

    // Save content first
    await handleSaveContent();

    try {
      const DEFAULT_MODELS: Record<string, string> = {
        openai: 'gpt-4o',
        anthropic: 'claude-sonnet-4-6',
        gemini: 'gemini-2.0-flash',
        local: 'llama3.2',
        chatgpt_web: 'gpt-5.1-codex',
      };

      // Resolve provider: explicit provider > plugin auto-detect > localStorage config
      let providerType: string | undefined;
      let providerModel: string | undefined;
      let resolvedProviderId: string | undefined;

      if (provider) {
        // Provider already resolved (from provider_id or plugin category auto-detect)
        providerType = provider.type;
        providerModel = provider.selected_model || DEFAULT_MODELS[provider.type];
        resolvedProviderId = provider.id;
      } else {
        // Last resort: check localStorage
        const storedConfig = localStorage.getItem('mindflow_llm_config');
        if (storedConfig) {
          const config = JSON.parse(storedConfig);
          providerType = config.provider;
          providerModel = config.model;
        }
      }

      if (!providerType) {
        alert('No provider configured for this node type. Add a provider in Settings.');
        return;
      }
      if (!providerModel) {
        providerModel = DEFAULT_MODELS[providerType];
      }

      const operationRequest: Record<string, unknown> = {
        nodeId: node.id,
        graphId,
        provider: providerType,
        model: providerModel,
        prompt: content,
      };

      if (resolvedProviderId || providerId) operationRequest.provider_id = resolvedProviderId || providerId;

      const mcpTools = (node as any).mcp_tools;
      if (mcpTools && mcpTools.length > 0) {
        operationRequest.mcp_tools = mcpTools;
      }

      const operationId = await createOperation(operationRequest as any);
      if (operationId) startStreaming(operationId);
    } catch (err) {
      console.error('Failed to generate:', err);
    }
  }, [graphId, content, node.id, provider, providerId, createOperation, startStreaming, handleSaveContent]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter to send
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleGenerate();
    }
  }, [handleGenerate]);

  const handleHeightsChange = useCallback(async (pHeight: number, rHeight: number) => {
    if (!graphId) return;
    try {
      await api.updateNode(graphId, node.id, {
        prompt_height: Math.round(Math.max(100, pHeight)),
        response_height: Math.round(Math.max(100, rHeight))
      });
    } catch (err) {
      console.error('Failed to update heights:', err);
    }
  }, [graphId, node.id]);

  const handleNoteChange = useCallback(async (noteTop: string | null, noteBottom: string | null) => {
    if (!graphId) return;
    try {
      await api.updateNode(graphId, node.id, { note_top: noteTop, note_bottom: noteBottom });
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  }, [graphId, node.id]);

  // ─── Derived state ──────────────────────────────────────────────
  const llmStatus = (node as any).llm_status || 'idle';
  const llmResponse = node.llm_response || null;
  const llmError = (node as any).llm_error || null;
  const isExecuting = llmStatus === 'queued' || llmStatus === 'streaming';

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '480px',
        height: '100vh',
        backgroundColor: '#16161E',
        boxShadow: '-2px 0 16px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: '1px solid #2A2A40',
        color: '#E0E0E0',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        style={{
          background: headerColor,
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '14px', fontWeight: 600, color: 'white',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}>
            {displayName}
          </span>
          {provider && (
            <span style={{
              fontSize: '10px', color: 'rgba(255,255,255,0.7)',
              backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '3px',
            }}>
              {provider.name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)', padding: '4px', display: 'flex',
            }}
            title="Node settings"
          >
            <Settings2 size={16} />
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)', padding: '4px', display: 'flex',
            }}
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Settings drawer ────────────────────────────────────── */}
      {showSettings && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #2A2A40',
          backgroundColor: '#1A1A28',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>
            Node Settings
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#9CA3AF' }}>
            <span>ID: <code style={{ fontSize: '10px', color: '#6B7280' }}>{node.id.substring(0, 8)}...</code></span>
            <span>Status: {(node.meta?.status || 'draft')}</span>
            <span>Author: {node.author}</span>
          </div>
          {provider && (
            <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
              Provider: {provider.name} ({PROVIDER_TYPE_LABELS[provider.type]})
            </div>
          )}
          {/* Dynamic input widgets from plugin metadata */}
          {nodeTypeDef && nodeTypeDef.inputs?.optional && Object.keys(nodeTypeDef.inputs.optional).length > 0 && (
            <DynamicNodeView
              nodeTypeDef={nodeTypeDef}
              values={(node as any).inputs || {}}
              onChange={(name, value) => {
                if (!graphId) return;
                const updatedInputs = { ...((node as any).inputs || {}), [name]: value };
                api.updateNode(graphId, node.id, { inputs: updatedInputs } as any)
                  .then(() => onUpdate?.(node.id, { inputs: updatedInputs } as any))
                  .catch(err => console.error('Failed to save input:', err));
              }}
            />
          )}
        </div>
      )}

      {/* ── Scrollable content area ────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── Parent context (previous turn) ─────────────────── */}
        {parentContext && parentContext.response && (
          <ParentContextBlock
            prompt={parentContext.prompt}
            response={parentContext.response}
          />
        )}

        {/* ── LLM Response zone ──────────────────────────────── */}
        {(llmResponse || isExecuting || llmError) && (
          <div style={{ padding: '0 16px 12px' }}>
            <LLMNodeContent
              nodeId={node.id}
              graphId={graphId}
              content={content}
              llmResponse={llmResponse}
              llmOperationId={(node as any).llm_operation_id || null}
              isNewNode={false}
              llmStatus={llmStatus}
              llmError={llmError}
              promptHeight={(node as any).prompt_height || 300}
              responseHeight={(node as any).response_height || 300}
              noteTop={(node as any).note_top || null}
              noteBottom={(node as any).note_bottom || null}
              fontSize={14}
              onContentChange={handleContentChange}
              onGenerateClick={handleGenerate}
              onStopClick={() => { }}
              onRefreshClick={() => { }}
              onHeightsChange={handleHeightsChange}
              onNoteChange={handleNoteChange}
            />
          </div>
        )}

        {/* Spacer to push prompt to bottom */}
        <div style={{ flex: 1 }} />
      </div>

      {/* ── Prompt input (fixed at bottom) ─────────────────────── */}
      <div style={{
        borderTop: '1px solid #2A2A40',
        padding: '12px 16px',
        backgroundColor: '#1A1A28',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveContent}
            placeholder="Type your prompt here... (Ctrl+Enter to send)"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #2A2A40',
              backgroundColor: '#1E1E2E',
              color: '#E0E0E0',
              fontSize: '14px',
              fontFamily: 'inherit',
              lineHeight: '1.5',
              minHeight: '44px',
              maxHeight: '200px',
              resize: 'vertical',
              outline: 'none',
            }}
            rows={2}
          />
          <button
            onClick={handleGenerate}
            disabled={isExecuting || !content.trim()}
            style={{
              background: isExecuting ? '#374151' : headerColor,
              border: 'none',
              borderRadius: '8px',
              cursor: isExecuting ? 'not-allowed' : 'pointer',
              color: 'white',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isExecuting || !content.trim() ? 0.5 : 1,
              transition: 'opacity 0.15s, background 0.15s',
              flexShrink: 0,
            }}
            title="Generate response (Ctrl+Enter)"
          >
            <Send size={18} />
          </button>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '6px',
          padding: '0 2px',
        }}>
          <span style={{ fontSize: '10px', color: '#4B5563' }}>
            Ctrl+Enter to send
          </span>
          {/* Quick-add child node button */}
          {llmResponse && !isExecuting && onCreateChild && (
            <button
              onClick={() => onCreateChild(node.id)}
              style={{
                background: 'none',
                border: '1px solid #2A2A40',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#6B7280',
                padding: '2px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
              }}
              title="Create a new node to continue the conversation"
            >
              <Plus size={12} />
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Parent Context Block ───────────────────────────────────────────

function ParentContextBlock({ prompt, response }: { prompt: string; response: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = response.length > 300;
  const displayResponse = expanded ? response : (isLong ? response.substring(0, 300) + '...' : response);

  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: '1px solid #2A2A40',
      backgroundColor: '#1A1A25',
    }}>
      {/* Parent's prompt */}
      {prompt && (
        <div style={{
          fontSize: '12px',
          color: '#6B7280',
          marginBottom: '6px',
          fontStyle: 'italic',
        }}>
          {prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt}
        </div>
      )}
      {/* Parent's response */}
      <div style={{
        fontSize: '13px',
        color: '#9CA3AF',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {displayResponse}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#4FC3F7',
            fontSize: '11px',
            padding: '4px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
