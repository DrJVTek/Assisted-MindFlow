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

import React, { memo, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { Bot, User, Wrench, Loader, Check, AlertCircle } from 'lucide-react';
import type { NodeType, NodeAuthor, NodeStatus } from '../types/graph';
import { useNodeTypesStore } from '../stores/nodeTypesStore';
import { useProviderStore } from '../stores/providerStore';

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

const TYPE_COLORS: Record<string, string> = {
  STRING: '#8BC34A',
  CONTEXT: '#00BCD4',
  INT: '#2196F3',
  FLOAT: '#FF9800',
  BOOLEAN: '#9C27B0',
  COMBO: '#607D8B',
  SECRET: '#F44336',
  USAGE: '#795548',
  TOOL_RESULT: '#E91E63',
  EMBEDDING: '#3F51B5',
  DOCUMENT: '#FF5722',
};

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
            color: getTypeColor(inputType) || TYPE_COLORS[inputType] || '#90A4AE',
          });
        }
      }

      const returnTypes = nodeTypeDef.return_types || [];
      const returnNames = nodeTypeDef.return_names || [];
      for (let i = 0; i < returnTypes.length; i++) {
        outputs.push({
          name: returnNames[i] || `output_${i}`,
          type: returnTypes[i],
          color: getTypeColor(returnTypes[i]) || TYPE_COLORS[returnTypes[i]] || '#90A4AE',
        });
      }
    } else {
      inputs.push({ name: 'input', type: 'STRING', color: TYPE_COLORS.STRING });
      outputs.push({ name: 'output', type: 'STRING', color: TYPE_COLORS.STRING });
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
        width: 220,
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
      {allInputPorts.map((port, i) => (
        <Handle
          key={`in-${port.name}`}
          type="target"
          position={Position.Left}
          id={port.name}
          style={{
            top: getPortY(i),
            background: port.color,
            width: 8,
            height: 8,
            border: '2px solid #1E1E2E',
            left: -4,
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
            width: 8,
            height: 8,
            border: '2px solid #1E1E2E',
            right: -4,
          }}
        />
      ))}

      {/* Fallback handles for nodes without plugin metadata (legacy/migration) */}
      {allInputPorts.length === 0 && (
        <Handle
          type="target"
          position={Position.Top}
          id="__default_in"
          style={{ background: '#546E7A', width: 6, height: 6, border: '1px solid #1E1E2E', opacity: 0.5 }}
        />
      )}
      {outputPorts.length === 0 && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="__default_out"
          style={{ background: '#546E7A', width: 6, height: 6, border: '1px solid #1E1E2E', opacity: 0.5 }}
        />
      )}

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
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
