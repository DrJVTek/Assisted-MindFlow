/**
 * Unit tests for ModelSelector component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelSelector, type ModelInfo } from '../../src/components/ModelSelector';

const sampleModels: ModelInfo[] = [
  { id: 'gpt-4o', name: 'GPT-4o', available: true },
  { id: 'gpt-5', name: 'GPT-5', available: true },
  { id: 'o4-mini', name: 'o4-mini', available: false },
];

describe('ModelSelector', () => {
  it('renders model list in dropdown', () => {
    render(
      <ModelSelector models={sampleModels} selectedModel="gpt-4o" onSelect={vi.fn()} />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeDefined();
    expect(screen.getByText('GPT-4o')).toBeDefined();
    expect(screen.getByText('GPT-5')).toBeDefined();
  });

  it('selection triggers callback', () => {
    const onSelect = vi.fn();
    render(
      <ModelSelector models={sampleModels} selectedModel="gpt-4o" onSelect={onSelect} />
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'gpt-5' } });
    expect(onSelect).toHaveBeenCalledWith('gpt-5');
  });

  it('shows empty state when no models', () => {
    render(
      <ModelSelector models={[]} selectedModel={null} onSelect={vi.fn()} />
    );

    expect(screen.getByText('No models detected')).toBeDefined();
  });

  it('shows loading state', () => {
    render(
      <ModelSelector models={[]} selectedModel={null} loading={true} onSelect={vi.fn()} />
    );

    expect(screen.getByText('(Loading...)')).toBeDefined();
  });

  it('marks unavailable models', () => {
    render(
      <ModelSelector models={sampleModels} selectedModel="gpt-4o" onSelect={vi.fn()} />
    );

    expect(screen.getByText('o4-mini (unavailable)')).toBeDefined();
  });

  it('refresh button triggers callback', () => {
    const onRefresh = vi.fn();
    render(
      <ModelSelector
        models={sampleModels}
        selectedModel="gpt-4o"
        onSelect={vi.fn()}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByText('Refresh'));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
