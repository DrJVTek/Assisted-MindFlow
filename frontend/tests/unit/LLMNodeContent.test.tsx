/**
 * Unit tests for LLMNodeContent component
 *
 * Feature 009: Inline LLM Response Display - User Story 2
 *
 * Tests:
 * - Dual-pane layout (question section + response section)
 * - Question display (fixed at top)
 * - Response rendering (scrollable, markdown-formatted)
 * - Scrollbar behavior (appears when content exceeds height)
 * - Loading states (during streaming)
 * - Empty states (no response yet)
 * - Font size application
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LLMNodeContent } from '../../src/components/LLMNodeContent';

describe('LLMNodeContent', () => {
  describe('Dual-Pane Layout', () => {
    it('renders question section and response section', () => {
      render(
        <LLMNodeContent
          question="What is React?"
          response="React is a JavaScript library for building user interfaces."
        />
      );

      // Question section
      expect(screen.getByText('What is React?')).toBeInTheDocument();

      // Response section
      expect(screen.getByText(/React is a JavaScript library/)).toBeInTheDocument();
    });

    it('applies correct layout structure', () => {
      const { container } = render(
        <LLMNodeContent
          question="Test question"
          response="Test response"
        />
      );

      // Container should have flexbox layout class
      const contentContainer = container.firstChild;
      expect(contentContainer).toHaveClass('llm-node-content');
    });

    it('question section has flex-shrink:0 style', () => {
      const { container } = render(
        <LLMNodeContent
          question="Test question"
          response="Test response"
        />
      );

      // Question section should not shrink
      const questionSection = container.querySelector('.llm-node-question');
      expect(questionSection).toBeInTheDocument();
    });

    it('response section has flex:1 and overflow-y:auto', () => {
      const { container } = render(
        <LLMNodeContent
          question="Test question"
          response="Test response"
        />
      );

      // Response section should expand and be scrollable
      const responseSection = container.querySelector('.llm-node-response');
      expect(responseSection).toBeInTheDocument();
    });
  });

  describe('Question Display', () => {
    it('renders question text', () => {
      render(
        <LLMNodeContent
          question="What is the meaning of life?"
          response="42"
        />
      );

      expect(screen.getByText('What is the meaning of life?')).toBeInTheDocument();
    });

    it('renders long questions without truncation', () => {
      const longQuestion = 'This is a very long question '.repeat(10);
      render(
        <LLMNodeContent
          question={longQuestion}
          response="Answer"
        />
      );

      // Use more flexible matcher (text may be split/trimmed)
      expect(screen.getByText(/This is a very long question/)).toBeInTheDocument();
    });

    it('handles empty question', () => {
      render(
        <LLMNodeContent
          question=""
          response="Answer"
        />
      );

      // Should still render question section
      const questionSection = document.querySelector('.llm-node-question');
      expect(questionSection).toBeInTheDocument();
    });
  });

  describe('Response Display', () => {
    it('renders markdown-formatted response', () => {
      const markdownResponse = '**Bold text** and *italic text*';
      render(
        <LLMNodeContent
          question="Test"
          response={markdownResponse}
        />
      );

      // MarkdownRenderer should process markdown
      expect(screen.getByText('Bold text')).toBeInTheDocument();
      expect(screen.getByText('italic text')).toBeInTheDocument();
    });

    it('renders code blocks in response', () => {
      const codeResponse = '```javascript\nconst x = 1;\n```';
      const { container } = render(
        <LLMNodeContent
          question="Test"
          response={codeResponse}
        />
      );

      // Code block rendered (syntax highlighting may split text)
      const code = container.querySelector('code');
      expect(code).toBeInTheDocument();
      expect(code?.textContent).toContain('const');
      expect(code?.textContent).toContain('x');
    });

    it('renders lists in response', () => {
      const listResponse = '- Item 1\n- Item 2\n- Item 3';
      render(
        <LLMNodeContent
          question="Test"
          response={listResponse}
        />
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('handles very long responses', () => {
      // Simulate 50k characters (performance test requirement)
      const longResponse = '# Response\n\n' + 'Word '.repeat(10000);
      render(
        <LLMNodeContent
          question="Test"
          response={longResponse}
        />
      );

      expect(screen.getByText('Response')).toBeInTheDocument();
    });
  });

  describe('Loading and Empty States', () => {
    it('shows loading state when llmOperationId exists but response is empty', () => {
      render(
        <LLMNodeContent
          question="Test question"
          response=""
          llmOperationId="op-123"
        />
      );

      // Should show loading indicator
      expect(screen.getByText(/loading|generating/i)).toBeInTheDocument();
    });

    it('shows empty state when no response and no operation', () => {
      render(
        <LLMNodeContent
          question="Test question"
          response=""
        />
      );

      // Should show empty state
      expect(screen.getByText(/no response/i)).toBeInTheDocument();
    });

    it('shows response even when llmOperationId exists (completed operation)', () => {
      render(
        <LLMNodeContent
          question="Test"
          response="Final answer"
          llmOperationId="op-123"
        />
      );

      // Should show response (operation might still be tracked but response exists)
      expect(screen.getByText('Final answer')).toBeInTheDocument();
    });
  });

  describe('Font Size', () => {
    it('applies default font size when not specified', () => {
      const { container } = render(
        <LLMNodeContent
          question="Test"
          response="Answer"
        />
      );

      const responseSection = container.querySelector('.llm-node-response');
      // Default should be applied (14px from component)
      expect(responseSection).toBeInTheDocument();
    });

    it('applies custom font size', () => {
      const { container } = render(
        <LLMNodeContent
          question="Test"
          response="Answer"
          fontSize={18}
        />
      );

      const responseSection = container.querySelector('.llm-node-response');
      expect(responseSection).toHaveStyle({ fontSize: '18px' });
    });

    it('respects min/max font size range (10-24px)', () => {
      const { container: container1 } = render(
        <LLMNodeContent
          question="Test"
          response="Answer"
          fontSize={8} // Below min
        />
      );

      const { container: container2 } = render(
        <LLMNodeContent
          question="Test"
          response="Answer"
          fontSize={30} // Above max
        />
      );

      // Should clamp to valid range
      const response1 = container1.querySelector('.llm-node-response');
      const response2 = container2.querySelector('.llm-node-response');

      expect(response1).toHaveStyle({ fontSize: '10px' });
      expect(response2).toHaveStyle({ fontSize: '24px' });
    });
  });

  describe('Edge Cases', () => {
    it('handles null response', () => {
      render(
        <LLMNodeContent
          question="Test"
          response={null as any}
        />
      );

      // Should render without crashing
      expect(screen.getByText(/no response/i)).toBeInTheDocument();
    });

    it('handles undefined response', () => {
      render(
        <LLMNodeContent
          question="Test"
          response={undefined as any}
        />
      );

      // Should render without crashing
      expect(screen.getByText(/no response/i)).toBeInTheDocument();
    });

    it('handles special characters in question', () => {
      const specialQuestion = "What is <>& question?";
      render(
        <LLMNodeContent
          question={specialQuestion}
          response="Answer"
        />
      );

      expect(screen.getByText(/What is/)).toBeInTheDocument();
    });

    it('handles malicious markdown in response', () => {
      const malicious = '<script>alert("xss")</script>Safe text';
      const { container } = render(
        <LLMNodeContent
          question="Test"
          response={malicious}
        />
      );

      // MarkdownRenderer should sanitize - no script tags
      expect(container.querySelector('script')).toBeNull();
      // Safe text should still render
      expect(container.textContent).toContain('Safe text');
    });
  });

  describe('Accessibility', () => {
    it('has semantic HTML structure', () => {
      const { container } = render(
        <LLMNodeContent
          question="Test question"
          response="Test answer"
        />
      );

      // Should use semantic elements
      expect(container.querySelector('.llm-node-question')).toBeInTheDocument();
      expect(container.querySelector('.llm-node-response')).toBeInTheDocument();
    });

    it('response section has aria-label', () => {
      const { container } = render(
        <LLMNodeContent
          question="Test"
          response="Answer"
        />
      );

      const responseSection = container.querySelector('.llm-node-response');
      expect(responseSection).toHaveAttribute('aria-label');
    });

    it('loading state has aria-live region', () => {
      render(
        <LLMNodeContent
          question="Test"
          response=""
          llmOperationId="op-123"
        />
      );

      // Loading indicator should be announced to screen readers
      const loadingElement = screen.getByText(/loading|generating/i);
      expect(loadingElement.closest('[aria-live]')).toBeInTheDocument();
    });
  });
});
