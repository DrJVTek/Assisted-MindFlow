/**
 * LLMNodeContent - Display question and LLM response in dual-pane layout
 *
 * Feature 009: Inline LLM Response Display - User Story 2
 *
 * Layout:
 * - Question section (fixed at top, flex-shrink: 0)
 * - Response section (scrollable, flex: 1, overflow-y: auto)
 *
 * Features:
 * - Markdown-formatted response via MarkdownRenderer
 * - Loading state (when operation active but no response yet)
 * - Empty state (no response and no active operation)
 * - Scroll optimization (will-change, contain, smooth scroll)
 * - Accessibility (aria-labels, aria-live for loading)
 * - Font size control (10-24px range)
 */

import React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import './LLMNodeContent.css';
import type { UUID } from '../types/uuid';

export interface LLMNodeContentProps {
  /**
   * Question text (displayed at top)
   */
  question: string;

  /**
   * LLM response (markdown-formatted, displayed below question)
   */
  response: string | null | undefined;

  /**
   * Active LLM operation ID (for tracking loading state)
   */
  llmOperationId?: UUID | null;

  /**
   * Font size in pixels (10-24px range, default: 14px)
   */
  fontSize?: number;
}

/**
 * Clamp font size to valid range (10-24px)
 */
function clampFontSize(size: number | undefined): number {
  const MIN_SIZE = 10;
  const MAX_SIZE = 24;
  const DEFAULT_SIZE = 14;

  if (size === undefined) {
    return DEFAULT_SIZE;
  }

  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, size));
}

/**
 * LLMNodeContent Component
 *
 * Displays question and response in split layout with scrolling
 */
export function LLMNodeContent({
  question,
  response,
  llmOperationId,
  fontSize
}: LLMNodeContentProps) {
  // Clamp font size to valid range
  const validFontSize = clampFontSize(fontSize);

  // Determine display state
  const hasResponse = response !== null && response !== undefined && response.trim() !== '';
  const isLoading = !hasResponse && llmOperationId !== null && llmOperationId !== undefined;
  const isEmpty = !hasResponse && !isLoading;

  return (
    <div className="llm-node-content">
      {/* Question Section (Fixed at top, does not scroll) */}
      <div className="llm-node-question">
        <div className="llm-node-question-label">Question:</div>
        <div className="llm-node-question-text">{question}</div>
      </div>

      {/* Response Section (Scrollable) */}
      <div
        className="llm-node-response"
        style={{ fontSize: `${validFontSize}px` }}
        aria-label="LLM Response"
      >
        {/* Loading State */}
        {isLoading && (
          <div className="llm-node-loading" aria-live="polite">
            <div className="llm-node-loading-spinner"></div>
            <div className="llm-node-loading-text">Generating response...</div>
          </div>
        )}

        {/* Empty State */}
        {isEmpty && (
          <div className="llm-node-empty">
            No response yet
          </div>
        )}

        {/* Response Content (Markdown) */}
        {hasResponse && (
          <MarkdownRenderer content={response} />
        )}
      </div>
    </div>
  );
}
