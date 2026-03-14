/**
 * Unit tests for LLMNodeContent component
 *
 * Feature 009: Inline LLM Response Display - User Story 2
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LLMNodeContent } from '../../src/components/LLMNodeContent';

describe('LLMNodeContent', () => {
  const defaultProps = {
    nodeId: 'node-1',
    graphId: 'graph-1',
    content: 'Test content',
    llmResponse: 'Test output',
    llmStatus: 'complete' as const,
    llmError: null,
    llmOperationId: null,
    promptHeight: 150,
    responseHeight: 250,
    noteTop: null,
    noteBottom: null,
    onContentChange: vi.fn(),
    onHeightsChange: vi.fn(),
    onNoteChange: vi.fn(),
    onGenerateClick: vi.fn(),
    onStopClick: vi.fn(),
    onRefreshClick: vi.fn(),
  };

  describe('Dual-Pane Layout', () => {
    it('renders question (prompt) section and response section', () => {
      render(
        <LLMNodeContent
          {...defaultProps}
          content="What is React?"
          llmResponse="React is a JavaScript library"
        />
      );

      expect(screen.getByDisplayValue('What is React?')).toBeInTheDocument();
      expect(screen.getByText(/React is a JavaScript library/)).toBeInTheDocument();
    });

    it('applies correct layout structure', () => {
      const { container } = render(<LLMNodeContent {...defaultProps} />);
      const contentContainer = container.firstChild;
      expect(contentContainer).toHaveClass('llm-node-content-dual-zone');
    });
  });

  describe('Prompt Display', () => {
    it('renders prompt text in textarea', () => {
      render(
        <LLMNodeContent
          {...defaultProps}
          content="What is the meaning of life?"
        />
      );
      expect(screen.getByDisplayValue('What is the meaning of life?')).toBeInTheDocument();
    });
  });

  describe('Response Display', () => {
    it('renders markdown-formatted response', () => {
      const markdownResponse = '**Bold text** and *italic text*';
      render(
        <LLMNodeContent
          {...defaultProps}
          llmResponse={markdownResponse}
        />
      );
      expect(screen.getByText('Bold text')).toBeInTheDocument();
      expect(screen.getByText('italic text')).toBeInTheDocument();
    });

    it('handles empty response check', () => {
      render(
        <LLMNodeContent
          {...defaultProps}
          llmResponse={null}
          llmStatus="idle"
        />
      );
      expect(screen.getByText(/No response yet/i)).toBeInTheDocument();
    });
  });

  describe('Loading and Status States', () => {
    it('shows streaming status', () => {
      render(
        <LLMNodeContent
          {...defaultProps}
          llmStatus="streaming"
          llmResponse=""
        />
      );
      expect(screen.getByText(/Génération.../i)).toBeInTheDocument();
    });

    it('shows queued status', () => {
      render(
        <LLMNodeContent
          {...defaultProps}
          llmStatus="queued"
        />
      );
      expect(screen.getByText(/En attente.../i)).toBeInTheDocument();
    });

    it('shows error state', () => {
      render(
        <LLMNodeContent
          {...defaultProps}
          llmStatus="error"
          llmError="Something went wrong"
          llmResponse={null}
        />
      );
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Font Size', () => {
    it('applies custom font size', () => {
      const { container } = render(
        <LLMNodeContent
          {...defaultProps}
          fontSize={18}
        />
      );
      // The font size is applied to the main container
      expect(container.firstChild).toHaveStyle({ fontSize: '18px' });
    });
  });

  describe('Edge Cases', () => {
    it('handles null response prop gracefully', () => {
      render(
        <LLMNodeContent
          {...defaultProps}
          llmResponse={null}
        />
      );
      expect(screen.getByText(/No response yet/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('renders prompt label', () => {
      render(<LLMNodeContent {...defaultProps} />);
      expect(screen.getByText(/PROMPT/i)).toBeInTheDocument();
    });

    it('renders response label', () => {
      render(<LLMNodeContent {...defaultProps} />);
      expect(screen.getByText(/RESPONSE/i)).toBeInTheDocument();
    });
  });
});
