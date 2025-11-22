/**
 * MarkdownRenderer - XSS-safe markdown rendering component
 *
 * Feature 009: Inline LLM Response Display
 *
 * Renders markdown content using react-markdown with:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - Syntax highlighting for code blocks
 * - XSS protection (no dangerouslySetInnerHTML)
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export interface MarkdownRendererProps {
  /**
   * Markdown content to render
   * Max length: 100,000 characters (enforced by backend)
   */
  content: string;

  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Renders markdown content with syntax highlighting and XSS protection
 *
 * Security:
 * - react-markdown renders to React components (no HTML injection)
 * - No dangerouslySetInnerHTML used
 * - Malicious markdown (script tags, etc.) is automatically sanitized
 *
 * Performance:
 * - Handles up to 100k characters
 * - Target: <100ms render time for 10k chars
 *
 * @example
 * ```tsx
 * <MarkdownRenderer content="# Hello\n\nThis is **bold**" />
 * ```
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className
}) => {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
