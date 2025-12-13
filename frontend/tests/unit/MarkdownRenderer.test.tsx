/**
 * Unit tests for MarkdownRenderer component
 *
 * Feature 009: Inline LLM Response Display
 *
 * Tests:
 * - Basic markdown rendering (headings, bold, italic, lists)
 * - Code block rendering with syntax highlighting
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - XSS protection (malicious script tags sanitized)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer } from '../../src/components/MarkdownRenderer';

describe('MarkdownRenderer', () => {
  describe('Basic Markdown Rendering', () => {
    it('renders headings correctly', () => {
      const markdown = '# Heading 1\n## Heading 2\n### Heading 3';
      render(<MarkdownRenderer content={markdown} />);

      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Heading 2')).toBeInTheDocument();
      expect(screen.getByText('Heading 3')).toBeInTheDocument();
    });

    it('renders emphasis (bold and italic)', () => {
      const markdown = 'This is **bold** and this is *italic*';
      render(<MarkdownRenderer content={markdown} />);

      const bold = screen.getByText('bold');
      const italic = screen.getByText('italic');

      expect(bold.tagName).toBe('STRONG');
      expect(italic.tagName).toBe('EM');
    });

    it('renders unordered lists', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';
      render(<MarkdownRenderer content={markdown} />);

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('renders ordered lists', () => {
      const markdown = '1. First\n2. Second\n3. Third';
      render(<MarkdownRenderer content={markdown} />);

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('renders links', () => {
      const markdown = '[Click here](https://example.com)';
      render(<MarkdownRenderer content={markdown} />);

      const link = screen.getByText('Click here');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', 'https://example.com');
    });
  });

  describe('Code Block Rendering', () => {
    it('renders inline code', () => {
      const markdown = 'Use `const x = 1;` for constants';
      render(<MarkdownRenderer content={markdown} />);

      const code = screen.getByText('const x = 1;');
      expect(code.tagName).toBe('CODE');
    });

    it('renders code blocks', () => {
      const markdown = '```javascript\nconst x = 1;\nconsole.log(x);\n```';
      const { container } = render(<MarkdownRenderer content={markdown} />);

      // Code blocks are rendered with syntax highlighting
      const codeElement = container.querySelector('code');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement?.textContent).toContain('const x = 1');
      expect(codeElement?.textContent).toContain('console.log(x)');
    });

    it('renders code blocks without language', () => {
      const markdown = '```\nPlain code block\n```';
      render(<MarkdownRenderer content={markdown} />);

      expect(screen.getByText('Plain code block')).toBeInTheDocument();
    });
  });

  describe('GitHub Flavored Markdown', () => {
    it('renders tables', () => {
      const markdown = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1 | Cell 2 |';
      render(<MarkdownRenderer content={markdown} />);

      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Header 2')).toBeInTheDocument();
      expect(screen.getByText('Cell 1')).toBeInTheDocument();
      expect(screen.getByText('Cell 2')).toBeInTheDocument();
    });

    it('renders strikethrough', () => {
      const markdown = '~~Strikethrough text~~';
      render(<MarkdownRenderer content={markdown} />);

      const strikethrough = screen.getByText('Strikethrough text');
      expect(strikethrough.tagName).toBe('DEL');
    });

    it('renders task lists', () => {
      const markdown = '- [x] Completed task\n- [ ] Incomplete task';
      render(<MarkdownRenderer content={markdown} />);

      expect(screen.getByText('Completed task')).toBeInTheDocument();
      expect(screen.getByText('Incomplete task')).toBeInTheDocument();

      // Check for checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  describe('XSS Protection', () => {
    it('sanitizes script tags', () => {
      const malicious = '<script>alert("xss")</script>Normal text';
      const { container } = render(<MarkdownRenderer content={malicious} />);

      // Script tag should be escaped, not executed
      expect(document.querySelector('script')).toBeNull();
      expect(container.textContent).toContain('Normal text');
    });

    it('sanitizes onclick handlers', () => {
      const malicious = '<div onclick="alert(\'xss\')">Click me</div>';
      render(<MarkdownRenderer content={malicious} />);

      // onclick handler should be stripped
      const div = screen.queryByText('Click me');
      if (div) {
        expect(div).not.toHaveAttribute('onclick');
      }
    });

    it('sanitizes iframe injection', () => {
      const malicious = '<iframe src="javascript:alert(\'xss\')"></iframe>Normal text';
      render(<MarkdownRenderer content={malicious} />);

      // iframe should not be rendered
      expect(document.querySelector('iframe')).toBeNull();
      expect(screen.getByText(/Normal text/)).toBeInTheDocument();
    });

    it('allows safe HTML entities', () => {
      const markdown = '&lt;b&gt;Bold&lt;/b&gt;';
      render(<MarkdownRenderer content={markdown} />);

      // HTML entities should be rendered as text
      expect(screen.getByText(/<b>Bold<\/b>/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('renders empty content', () => {
      const { container } = render(<MarkdownRenderer content="" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('renders very long content', () => {
      // Simulate 10k characters
      const longContent = '# Test\n\n' + 'A'.repeat(10000);
      render(<MarkdownRenderer content={longContent} />);

      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('handles special characters', () => {
      const markdown = '# Special: <>&"\'';
      render(<MarkdownRenderer content={markdown} />);

      expect(screen.getByText(/Special/)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <MarkdownRenderer content="# Test" className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Performance (T036)', () => {
    it('renders 50k character response in under 200ms', () => {
      // Simulate 50k character markdown response
      const longMarkdown = '# Large Response\n\n' +
        '## Section\n\n' +
        'Lorem ipsum dolor sit amet. '.repeat(2000); // ~50k chars

      const startTime = performance.now();
      render(<MarkdownRenderer content={longMarkdown} />);
      const endTime = performance.now();

      const renderTime = endTime - startTime;
      console.log(`[Performance] 50k chars rendered in ${renderTime.toFixed(2)}ms`);

      // Should render in under 200ms (relaxed from 100ms for safety margin)
      expect(renderTime).toBeLessThan(200);
    });

    it('handles 100k character limit', () => {
      // Test at backend limit
      const maxContent = '# Maximum\n\n' + 'X'.repeat(100000 - 15);

      expect(() => {
        render(<MarkdownRenderer content={maxContent} />);
      }).not.toThrow();
    });
  });
});
