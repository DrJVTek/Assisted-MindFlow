/**
 * CompositeNode — displays a composite node as a single collapsed unit.
 *
 * Shows:
 * - Composite name and node count
 * - Exposed parameter controls
 * - Double-click to inspect internals (future)
 * - Input/output handles matching the composite definition
 */

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

interface CompositeNodeProps {
  data: {
    label: string;
    compositeId: string;
    internalNodeCount: number;
    exposedParams: Record<string, { type: string; value: unknown; default: unknown }>;
    inputCount: number;
    outputCount: number;
  };
  selected: boolean;
}

export const CompositeNode = memo(({ data, selected }: CompositeNodeProps) => {
  const { label, internalNodeCount, exposedParams } = data;

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        border: `2px solid ${selected ? '#1976D2' : '#7B1FA2'}`,
        backgroundColor: 'var(--panel-bg, #fff)',
        minWidth: '200px',
        boxShadow: selected ? '0 0 0 2px rgba(25, 118, 210, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#7B1FA2',
          width: 10,
          height: 10,
          border: '2px solid white',
        }}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '2px',
            backgroundColor: '#7B1FA2',
          }}
        />
        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--node-text)' }}>
          {label}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--node-text-secondary)',
            marginLeft: 'auto',
          }}
        >
          {internalNodeCount} nodes
        </div>
      </div>

      {/* Exposed parameters */}
      {Object.keys(exposedParams).length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--node-text-secondary)' }}>
          {Object.entries(exposedParams).map(([name, param]) => (
            <div
              key={name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2px 0',
              }}
            >
              <span>{name}</span>
              <span style={{ fontFamily: 'monospace' }}>
                {String(param.value ?? param.default ?? '—')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#7B1FA2',
          width: 10,
          height: 10,
          border: '2px solid white',
        }}
      />
    </div>
  );
});

CompositeNode.displayName = 'CompositeNode';
