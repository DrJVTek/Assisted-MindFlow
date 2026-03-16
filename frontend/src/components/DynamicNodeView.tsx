/**
 * DynamicNodeView — renders node inputs dynamically from plugin INPUT_TYPES metadata.
 *
 * Input type → Widget mapping:
 *   STRING (multiline) → textarea
 *   STRING              → text input
 *   INT                 → number input
 *   FLOAT               → slider
 *   BOOLEAN             → toggle switch
 *   COMBO               → dropdown select
 *   SECRET              → password input
 */

import React from 'react';
import type { InputSpec, NodeTypeDefinition } from '../types/plugin';

interface DynamicNodeViewProps {
  nodeTypeDef: NodeTypeDefinition;
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  readOnly?: boolean;
}

function resolveInputSpec(raw: InputSpec | [string, ...unknown[]]): {
  type: string;
  spec: Partial<InputSpec>;
} {
  if (Array.isArray(raw)) {
    const [type, ...rest] = raw;
    const opts = typeof rest[0] === 'object' && rest[0] !== null ? (rest[0] as Partial<InputSpec>) : {};
    return { type: type as string, spec: opts };
  }
  return { type: raw.type || 'STRING', spec: raw };
}

function InputWidget({
  name,
  type,
  spec,
  value,
  onChange,
  readOnly,
}: {
  name: string;
  type: string;
  spec: Partial<InputSpec>;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    fontSize: '13px',
    borderRadius: '4px',
    border: '1px solid var(--panel-border, #ccc)',
    backgroundColor: 'var(--panel-bg, #fff)',
    color: 'var(--node-text, #333)',
  };

  switch (type) {
    case 'STRING':
      if (spec.multiline) {
        return (
          <textarea
            value={(value as string) ?? spec.default ?? ''}
            onChange={e => onChange(e.target.value)}
            readOnly={readOnly}
            style={{ ...baseStyle, minHeight: '80px', resize: 'vertical' }}
          />
        );
      }
      return (
        <input
          type="text"
          value={(value as string) ?? spec.default ?? ''}
          onChange={e => onChange(e.target.value)}
          readOnly={readOnly}
          style={baseStyle}
        />
      );

    case 'INT':
      return (
        <input
          type="number"
          value={(value as number) ?? spec.default ?? 0}
          min={spec.min}
          max={spec.max}
          step={spec.step ?? 1}
          onChange={e => onChange(parseInt(e.target.value, 10))}
          readOnly={readOnly}
          style={baseStyle}
        />
      );

    case 'FLOAT':
      return (
        <input
          type="range"
          value={(value as number) ?? spec.default ?? 0.5}
          min={spec.min ?? 0}
          max={spec.max ?? 1}
          step={spec.step ?? 0.01}
          onChange={e => onChange(parseFloat(e.target.value))}
          disabled={readOnly}
          style={{ width: '100%', accentColor: 'var(--primary-color)' }}
        />
      );

    case 'BOOLEAN':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={(value as boolean) ?? (spec.default as boolean) ?? false}
            onChange={e => onChange(e.target.checked)}
            disabled={readOnly}
          />
          <span style={{ fontSize: '13px', color: 'var(--node-text)' }}>{spec.label ?? name}</span>
        </label>
      );

    case 'COMBO':
      return (
        <select
          value={(value as string) ?? spec.default ?? ''}
          onChange={e => onChange(e.target.value)}
          disabled={readOnly}
          style={baseStyle}
        >
          {(spec.options ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'SECRET':
      return (
        <input
          type="password"
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          readOnly={readOnly}
          placeholder="••••••••"
          style={baseStyle}
        />
      );

    default:
      // Unknown type — render as text input
      return (
        <input
          type="text"
          value={String(value ?? spec.default ?? '')}
          onChange={e => onChange(e.target.value)}
          readOnly={readOnly}
          style={baseStyle}
        />
      );
  }
}

export function DynamicNodeView({ nodeTypeDef, values, onChange, readOnly }: DynamicNodeViewProps) {
  const { inputs } = nodeTypeDef;

  const renderSection = (
    title: string,
    section: Record<string, InputSpec | [string, ...unknown[]]> | undefined,
  ) => {
    if (!section || Object.keys(section).length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #888)', textTransform: 'uppercase' }}>
          {title}
        </div>
        {Object.entries(section).map(([name, rawSpec]) => {
          const { type, spec } = resolveInputSpec(rawSpec);
          return (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--node-text)' }}>
                {spec.label ?? name}
              </label>
              <InputWidget
                name={name}
                type={type}
                spec={spec}
                value={values[name]}
                onChange={v => onChange(name, v)}
                readOnly={readOnly}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {renderSection('Required', inputs.required)}
      {renderSection('Optional', inputs.optional)}
    </div>
  );
}
