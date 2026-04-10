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
import type { Node } from '../types/graph';
import { useProviderStore } from '../stores/providerStore';
import { PROVIDER_TYPE_LABELS } from '../types/provider';
import { LLMNodeContent } from './LLMNodeContent';
import { DynamicNodeView } from './DynamicNodeView';
import { useGraphExecution } from '../hooks/useGraphExecution';
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
  /** Refresh graph data after a field that affects derived state (e.g. provider_id) is saved */
  onRefreshGraph?: () => void;
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
  onRefreshGraph,
}: DetailPanelProps) {
  const [content, setContent] = useState(node.content);
  const [showSettings, setShowSettings] = useState(false);
  const [autoCreatedChildId, setAutoCreatedChildId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevLlmStatusRef = useRef<string | null>(null);
  const savedContentRef = useRef(node.content);

  // Node type info (must come before provider resolution)
  const classType = node.class_type || node.type;
  const nodeTypeDef = useNodeTypesStore((s) => s.nodeTypes[classType]);
  const pluginProviderType = useNodeTypesStore((s) => s.getProviderType(classType));
  const headerColor = nodeTypeDef?.ui?.color || '#546E7A';
  const displayName = nodeTypeDef?.display_name || (node.type || 'node').replace(/_/g, ' ');

  // Provider info — resolve from explicit provider_id, or auto-detect from plugin category
  const providerId = node.provider_id || null;
  const allProviders = useProviderStore((s) => s.providers);
  const provider = allProviders.find((p) => {
    if (providerId) return p.id === providerId;
    if (pluginProviderType) return p.type === pluginProviderType;
    return false;
  });

  // Graph execution engine
  const { executeNode, isExecuting: executionRunning, nodeResults, error: executionLevelError, cancelExecution } = useGraphExecution(graphId);

  // Parent context
  const parentContext = getParentContext(node, allNodes);

  // Reset when node changes
  useEffect(() => {
    setContent(node.content);
    savedContentRef.current = node.content;
    setAutoCreatedChildId(null);
    prevLlmStatusRef.current = null;
    // Focus textarea when opening a new empty node
    if (!node.content && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [node.id, node.content]);

  // Auto-create child node when LLM response completes
  useEffect(() => {
    const currentStatus = node.llm_status;
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
  }, [node.llm_status, node.id, autoCreatedChildId, onCreateChild]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  const handleSaveContent = useCallback(async () => {
    if (!graphId || content === savedContentRef.current) return;
    savedContentRef.current = content;
    try {
      await api.updateNode(graphId, node.id, { content });
    } catch (err) {
      console.error('Failed to save content:', err);
    }
  }, [graphId, node.id, content]);

  const handleGenerate = useCallback(async () => {
    if (!graphId || !content.trim()) return;

    // Save content via API directly (not through onUpdate/Canvas which reloads the page)
    try {
      await api.updateNode(graphId, node.id, { content });
    } catch (err) {
      console.error('Failed to save content before execution:', err);
      return;
    }

    // Use the execution engine — it handles provider resolution,
    // topological sort, context from parents, and SSE streaming
    executeNode(node.id, true);
  }, [graphId, content, node.id, executeNode]);

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

  // ─── Derived state from execution engine + persisted node ────────
  const nodeResult = nodeResults[node.id];
  const streamingTokens = nodeResult?.tokens || null;
  const executionError = nodeResult?.error || null;
  // Final response from outputs. LLM nodes return `response`, text_input
  // returns `text`, other nodes may use other names — try the common ones.
  const outputs = nodeResult?.outputs as Record<string, unknown> | undefined;
  const completedResponse =
    (outputs?.response as string) ||
    (outputs?.text as string) ||
    (outputs?.output as string) ||
    null;

  // Priority: live streaming tokens → completed output → persisted response
  const llmResponse = streamingTokens || completedResponse || node.llm_response || null;
  // Error surfacing: node-level (from node_error), then execution-level
  // (from execution_error — fires when the orchestrator can't even start),
  // then persisted llm_error.
  const llmError = executionError || executionLevelError || node.llm_error || null;
  const isExecuting = executionRunning || node.llm_status === 'queued' || node.llm_status === 'streaming';
  const llmStatus = executionRunning
    ? (streamingTokens ? 'streaming' : 'queued')
    : (completedResponse ? 'complete' : (llmError ? 'error' : (node.llm_status || 'idle')));

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
          {/* Provider picker — shown for any node that uses a `provider_id`
              credential in its plugin INPUT_TYPES (currently: LLMChatNode).
              The list is filtered to providers compatible with this node's
              declared credential requirements. */}
          {nodeTypeDef?.inputs?.credentials && 'provider_id' in (nodeTypeDef.inputs.credentials || {}) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--node-text)' }}>
                Provider
              </label>
              <select
                value={providerId || ''}
                onChange={(e) => {
                  if (!graphId) return;
                  const newProviderId = e.target.value || null;
                  api.updateNode(graphId, node.id, { provider_id: newProviderId } as any)
                    .then(() => onRefreshGraph?.())
                    .catch(err => console.error('Failed to update provider:', err));
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '13px',
                  borderRadius: '4px',
                  border: '1px solid var(--panel-border, #ccc)',
                  backgroundColor: 'var(--panel-bg, #fff)',
                  color: 'var(--node-text, #333)',
                }}
              >
                <option value="">— Select a provider —</option>
                {allProviders.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({PROVIDER_TYPE_LABELS[p.type] || p.type})
                  </option>
                ))}
              </select>
              {provider && provider.available_models.length === 0 && (
                <div style={{ fontSize: '11px', color: '#F59E0B' }}>
                  No models available. Validate the provider in Settings to fetch its model list.
                </div>
              )}
            </div>
          )}
          {/* Dynamic input widgets from plugin metadata (COMBO, INT, FLOAT, BOOLEAN — not STRING which is the prompt) */}
          {nodeTypeDef && (
            <DynamicNodeView
              nodeTypeDef={nodeTypeDef}
              values={node.inputs || {}}
              onChange={(name, value) => {
                if (!graphId) return;
                const updatedInputs = { ...(node.inputs || {}), [name]: value };
                api.updateNode(graphId, node.id, { inputs: updatedInputs } as any)
                  .catch(err => console.error('Failed to save input:', err));
              }}
              excludeTypes={['STRING']}
              // Runtime model list comes from the selected provider. This is
              // what makes the generic LLMChatNode usable for any provider
              // without hardcoding model lists in the plugin.
              dynamicOptions={
                provider?.available_models
                  ? { model: provider.available_models }
                  : undefined
              }
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
              isNewNode={false}
              llmStatus={llmStatus}
              llmError={llmError}
              promptHeight={node.prompt_height || 300}
              responseHeight={node.response_height || 300}
              noteTop={node.note_top || null}
              noteBottom={node.note_bottom || null}
              fontSize={14}
              onContentChange={handleContentChange}
              onGenerateClick={handleGenerate}
              onStopClick={cancelExecution}
              onRefreshClick={handleGenerate}
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
