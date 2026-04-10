/**
 * Custom Node Component — Compact card on canvas
 *
 * Nodes are COLLAPSED by default on the canvas. They show:
 * - Colored title bar (plugin color)
 * - 1-line content preview
 * - Named ports (left=inputs, right=outputs)
 * - Execution status indicator
 *
 * Full content editing happens in the DetailPanel (right side)
 * when a node is selected. This gives a ChatGPT-like experience
 * where the canvas is the conversation map and the panel is the workspace.
 */

import React, { memo, useMemo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { Bot, User, Wrench, Loader, Check, AlertCircle, Play, Square } from 'lucide-react';
import type { NodeType, NodeAuthor, NodeStatus } from '../types/graph';
import { useNodeTypesStore } from '../stores/nodeTypesStore';
import { useProviderStore } from '../stores/providerStore';
import { useExecutionStore } from '../stores/executionStore';

// ─── Types ───────────────────────────────────────────────────────────

interface NodeData {
  nodeId: string;
  preview: string;
  type: NodeType;
  class_type?: string;
  author: NodeAuthor;
  status: NodeStatus;
  importance: number;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
  currentZoom?: number;
  content?: string;
  id?: string;
  graphId?: string;
  provider_id?: string | null;

  // LLM status
  llm_status?: 'idle' | 'queued' | 'streaming' | 'complete' | 'error';
  llm_response?: string | null;
}

interface CustomNodeProps {
  data: NodeData;
  selected?: boolean;
}

// ─── Port helpers ───────────────────────────────────────────────────

interface PortInfo {
  name: string;
  type: string;
  color: string;
}

const WIDGET_TYPES = new Set(['COMBO', 'INT', 'FLOAT', 'BOOLEAN', 'SECRET']);

// Fallback color used only when the type system store hasn't loaded yet.
// Real type colors come from /api/node-types → typeDefinitions via
// nodeTypesStore.getTypeColor().
const FALLBACK_PORT_COLOR = '#90A4AE';

function extractTemplateVars(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(2, -2)))];
}

function getAuthorIcon(author: NodeAuthor): React.ReactElement {
  const s = { size: 11, strokeWidth: 2 };
  switch (author) {
    case 'human': return <User {...s} />;
    case 'llm': return <Bot {...s} />;
    case 'tool': return <Wrench {...s} />;
    default: return <User {...s} />;
  }
}

// ─── Compact Node Component ─────────────────────────────────────────

export const CustomNode = memo(({ data, selected }: CustomNodeProps) => {
  const {
    preview = '',
    type = 'note' as NodeType,
    class_type,
    author = 'human' as NodeAuthor,
    status = 'draft' as NodeStatus,
    importance = 0.5,
    opacity = 1.0,
    currentZoom = 1.0,
    content = '',
    id,
    nodeId,
    graphId,
    provider_id,
    llm_status,
    llm_response,
  } = data;

  const provider = useProviderStore((s) =>
    provider_id ? s.providers.find((p) => p.id === provider_id) : undefined
  );

  const getTypeColor = useNodeTypesStore((s) => s.getTypeColor);
  const nodeTypeDef = useNodeTypesStore((s) => {
    const ct = class_type || type;
    return s.nodeTypes[ct];
  });

  // ─── Quick-run button state ─────────────────────────────────────
  // Lets the user execute this node directly from the canvas without
  // opening the DetailPanel. Reads isExecuting + runningNodeId from
  // the shared executionStore so every node can tell if IT is the one
  // currently running (and show a spinner) or if some other node is.
  const executeNode = useExecutionStore((s) => s.executeNode);
  const cancelExecution = useExecutionStore((s) => s.cancelExecution);
  const globalIsExecuting = useExecutionStore((s) => s.isExecuting);
  const runningNodeId = useExecutionStore((s) => s.runningNodeId);
  const thisIsRunning = globalIsExecuting && runningNodeId === (id || nodeId);
  // Only show a run button if this node type is something you can "run"
  // in a meaningful way. Right now that means "has outputs" OR "is an
  // LLM node". Pure sinks (text_output with RETURN_TYPES=()) are still
  // runnable — running a sink executes its ancestor chain, which is
  // exactly what you'd want.
  const canRun = Boolean(nodeTypeDef);

  const handleRunClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // don't trigger node selection
      if (!graphId || !id) return;
      if (thisIsRunning) {
        cancelExecution(graphId);
      } else {
        executeNode(graphId, id, true);
      }
    },
    [graphId, id, thisIsRunning, executeNode, cancelExecution]
  );

  // ─── Derive ports ───────────────────────────────────────────────
  const { inputPorts, outputPorts, headerColor, displayName } = useMemo(() => {
    const inputs: PortInfo[] = [];
    const outputs: PortInfo[] = [];
    let color = '#546E7A';
    let name = (class_type || type || 'node').replace(/_/g, ' ');

    if (nodeTypeDef) {
      color = nodeTypeDef.ui?.color || color;
      name = nodeTypeDef.display_name || name;

      const allInputs = {
        ...(nodeTypeDef.inputs?.required || {}),
        ...(nodeTypeDef.inputs?.optional || {}),
      };
      for (const [inputName, rawSpec] of Object.entries(allInputs)) {
        const inputType = Array.isArray(rawSpec) ? rawSpec[0] as string : (rawSpec as any).type || 'STRING';
        if (!WIDGET_TYPES.has(inputType)) {
          inputs.push({
            name: inputName,
            type: inputType,
            color: getTypeColor(inputType) || FALLBACK_PORT_COLOR,
          });
        }
      }

      const returnTypes = nodeTypeDef.return_types || [];
      const returnNames = nodeTypeDef.return_names || [];
      for (let i = 0; i < returnTypes.length; i++) {
        outputs.push({
          name: returnNames[i] || `output_${i}`,
          type: returnTypes[i],
          color: getTypeColor(returnTypes[i]) || FALLBACK_PORT_COLOR,
        });
      }
    } else {
      // No plugin metadata loaded yet — render a single generic port.
      // This path should be rare because Canvas waits for nodeTypesStore
      // before allowing connections to be made.
      const stringColor = getTypeColor('STRING') || FALLBACK_PORT_COLOR;
      inputs.push({ name: 'input', type: 'STRING', color: stringColor });
      outputs.push({ name: 'output', type: 'STRING', color: stringColor });
    }

    return { inputPorts: inputs, outputPorts: outputs, headerColor: color, displayName: name };
  }, [nodeTypeDef, class_type, type, getTypeColor]);

  // Template variable ports
  const templateVarPorts = useMemo(() => {
    if (!content) return [];
    const vars = extractTemplateVars(content);
    const existing = new Set(inputPorts.map(p => p.name));
    return vars.filter(v => !existing.has(v)).map(v => ({
      name: v, type: 'STRING', color: '#FFD54F',
    }));
  }, [content, inputPorts]);

  const allInputPorts = useMemo(
    () => [...inputPorts, ...templateVarPorts],
    [inputPorts, templateVarPorts]
  );

  // ─── Status ─────────────────────────────────────────────────────
  const isExecuting = llm_status === 'queued' || llm_status === 'streaming';
  const isComplete = llm_status === 'complete';
  const isError = llm_status === 'error';
  const isZoomedOut = currentZoom < 0.3;

  // 1-line preview of content
  const contentPreview = useMemo(() => {
    const text = content || preview || '';
    if (text.length <= 60) return text;
    return text.substring(0, 57) + '...';
  }, [content, preview]);

  // Response preview (1 line)
  const responsePreview = useMemo(() => {
    if (!llm_response) return null;
    if (llm_response.length <= 50) return llm_response;
    return llm_response.substring(0, 47) + '...';
  }, [llm_response]);

  // ─── Handle positions ───────────────────────────────────────────
  const TITLE_H = 28;
  const PORT_H = 16;
  const PORT_START = TITLE_H + 4;
  const getPortY = (i: number) => PORT_START + i * PORT_H + PORT_H / 2;

  const maxPorts = Math.max(allInputPorts.length, outputPorts.length);
  const portsHeight = maxPorts * PORT_H;
  const nodeMinHeight = TITLE_H + (maxPorts > 0 ? portsHeight + 8 : 0) + 28; // 28 = preview line

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div
      className={`mindflow-node${isExecuting ? ' mindflow-node--executing' : ''}${isComplete ? ' mindflow-node--complete' : ''}${isError ? ' mindflow-node--error' : ''}`}
      style={{
        backgroundColor: '#1E1E2E',
        borderColor: selected ? '#4FC3F7' : isExecuting ? '#2196F3' : isError ? '#F44336' : isComplete ? '#4CAF50' : '#2A2A40',
        borderWidth: selected ? 2 : 1,
        borderStyle: 'solid',
        borderRadius: '6px',
        width: 260,
        minHeight: nodeMinHeight,
        opacity,
        boxShadow: selected
          ? '0 0 0 1px #4FC3F7, 0 4px 12px rgba(79, 195, 247, 0.2)'
          : isExecuting
            ? '0 0 8px rgba(33, 150, 243, 0.4)'
            : '0 2px 6px rgba(0, 0, 0, 0.2)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        cursor: 'pointer',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── Named Input Handles (left) ─────────────────────────── */}
      {/* Port NAMES are rendered in the body below (see "Port labels row"),
          not next to the handles — adding labels next to the handles here
          created a visual duplication. Only the connection handles live
          on the border. */}
      {allInputPorts.map((port, i) => (
        <Handle
          key={`in-${port.name}`}
          type="target"
          position={Position.Left}
          id={port.name}
          style={{
            top: getPortY(i),
            background: port.color,
            width: 10,
            height: 10,
            border: '2px solid #1E1E2E',
            left: -5,
          }}
        />
      ))}

      {/* ── Named Output Handles (right) ───────────────────────── */}
      {outputPorts.map((port, i) => (
        <Handle
          key={`out-${port.name}`}
          type="source"
          position={Position.Right}
          id={port.name}
          style={{
            top: getPortY(i),
            background: port.color,
            width: 10,
            height: 10,
            border: '2px solid #1E1E2E',
            right: -5,
          }}
        />
      ))}

      {/* No fallback __default handles — if plugin metadata hasn't loaded,
          the node simply has no connectable ports. This prevents the
          creation of half-typed edges that can't be cleanly deleted. */}

      {/* ── Title Bar ──────────────────────────────────────────── */}
      <div
        style={{
          background: headerColor,
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          minHeight: TITLE_H,
          borderRadius: '5px 5px 0 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
          {/* Execution status icon */}
          {isExecuting && <Loader size={11} style={{ color: 'rgba(255,255,255,0.9)', animation: 'spin 1s linear infinite' }} />}
          {isComplete && <Check size={11} style={{ color: 'rgba(255,255,255,0.9)' }} />}
          {isError && <AlertCircle size={11} style={{ color: 'rgba(255,255,255,0.9)' }} />}

          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'white',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}>
            {displayName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {provider && (
            <span style={{
              fontSize: '8px', fontWeight: 500, color: 'rgba(255,255,255,0.6)',
              backgroundColor: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: '2px',
            }}>
              {provider.name}
            </span>
          )}
          <div style={{ color: 'rgba(255,255,255,0.6)', display: 'flex' }}>
            {getAuthorIcon(author)}
          </div>
          {/* Quick-run button — executes this node (and its ancestors)
              without needing to open the DetailPanel first. Turns into
              a stop button while the node is running. Disabled when any
              OTHER node is running so the user can't queue overlapping
              executions. */}
          {canRun && (
            <button
              onClick={handleRunClick}
              disabled={globalIsExecuting && !thisIsRunning}
              title={thisIsRunning ? 'Cancel execution' : 'Run this node (and its ancestors)'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                padding: 0,
                borderRadius: 3,
                border: 'none',
                backgroundColor: thisIsRunning
                  ? 'rgba(239, 68, 68, 0.9)'
                  : 'rgba(255, 255, 255, 0.18)',
                color: 'white',
                cursor: (globalIsExecuting && !thisIsRunning) ? 'not-allowed' : 'pointer',
                opacity: (globalIsExecuting && !thisIsRunning) ? 0.35 : 1,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!globalIsExecuting || thisIsRunning) {
                  e.currentTarget.style.backgroundColor = thisIsRunning
                    ? 'rgba(239, 68, 68, 1)'
                    : 'rgba(255, 255, 255, 0.35)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = thisIsRunning
                  ? 'rgba(239, 68, 68, 0.9)'
                  : 'rgba(255, 255, 255, 0.18)';
              }}
            >
              {thisIsRunning ? <Square size={9} /> : <Play size={9} fill="currentColor" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Port labels + Content preview ──────────────────────── */}
      {!isZoomedOut && (
        <div style={{ padding: '4px 8px 6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {/* Port labels row */}
          {(allInputPorts.length > 0 || outputPorts.length > 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', minHeight: portsHeight }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {allInputPorts.map(p => (
                  <span key={p.name} style={{
                    fontSize: '8px', color: '#6B7280', lineHeight: `${PORT_H}px`,
                    display: 'flex', alignItems: 'center', gap: '3px',
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: p.color, display: 'inline-block' }} />
                    {p.name}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'flex-end' }}>
                {outputPorts.map(p => (
                  <span key={p.name} style={{
                    fontSize: '8px', color: '#6B7280', lineHeight: `${PORT_H}px`,
                    display: 'flex', alignItems: 'center', gap: '3px', flexDirection: 'row-reverse',
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: p.color, display: 'inline-block' }} />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Content preview */}
          {contentPreview && (
            <div style={{
              fontSize: '10px',
              color: '#9CA3AF',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              borderTop: '1px solid #2A2A40',
              paddingTop: '3px',
              marginTop: '2px',
            }}>
              {contentPreview}
            </div>
          )}

          {/* Response preview */}
          {responsePreview && (
            <div style={{
              fontSize: '9px',
              color: '#6B7280',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontStyle: 'italic',
            }}>
              → {responsePreview}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
