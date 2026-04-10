/**
 * LLMNodeContent - Dual-Zone Inline LLM Workflow Interface
 * 
 * Features:
 * - Editable prompt zone (top)
 * - Read-only streaming response zone (bottom)
 * - Resizable divider between zones
 * - Inline action buttons (Generate, Stop, Refresh)
 * - Status indicators (spinner, progress, icons)
 * - Collapsible notes (top/bottom)
 * - Context info display
 * - No external dialogs needed
 */

import { useState, useCallback, useEffect } from 'react';
import { Play, Square, RefreshCw, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ResizableDivider } from './ResizableDivider';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Button } from './ui/Button';
import type { UUID } from '../types/uuid';
import './LLMNodeContent.css';

export interface LLMNodeContentProps {
  nodeId: UUID;
  graphId: UUID;
  content: string; // Prompt
  llmResponse: string | null;
  llmStatus: 'idle' | 'queued' | 'streaming' | 'complete' | 'error';
  llmError: string | null;
  promptHeight: number;
  responseHeight: number;
  noteTop: string | null;
  noteBottom: string | null;
  fontSize?: number;
  contextInfo?: {
    includedParents: number;
    contextTokens: number;
    maxTokens: number;
    truncatedParents: number;
  };
  onContentChange: (newContent: string) => void;
  onHeightsChange: (promptHeight: number, responseHeight: number) => void;
  onNoteChange: (noteTop: string | null, noteBottom: string | null) => void;
  onGenerateClick: (content?: string) => void;
  onStopClick: () => void;
  onRefreshClick: () => void;
  isNewNode?: boolean;
}

export function LLMNodeContent({
  nodeId,
  graphId,
  content,
  llmResponse,
  llmStatus,
  llmError,
  promptHeight,
  responseHeight,
  noteTop,
  noteBottom,
  fontSize = 14,
  contextInfo,
  onContentChange,
  onHeightsChange,
  onNoteChange,
  onGenerateClick,
  onStopClick,
  onRefreshClick,
  isNewNode = false,
}: LLMNodeContentProps) {
  const [editedContent, setEditedContent] = useState(content);
  const [isTopNoteExpanded, setIsTopNoteExpanded] = useState(false);
  const [isBottomNoteExpanded, setIsBottomNoteExpanded] = useState(false);
  const [progress, setProgress] = useState(0);

  // const containerHeight = promptHeight + responseHeight + 2; // Removed fixed height calculation

  // Sync edited content when prop changes
  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  // Simulate progress during streaming
  useEffect(() => {
    if (llmStatus === 'streaming') {
      const interval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 2, 90));
      }, 200);
      return () => clearInterval(interval);
    } else if (llmStatus === 'complete') {
      setProgress(100);
    } else {
      setProgress(0);
    }
  }, [llmStatus]);

  const [localPromptHeight, setLocalPromptHeight] = useState(promptHeight);

  // Sync local height when prop changes (unless dragging, but we don't track dragging here easily)
  // We can assume if prop changes significantly it's an external update
  useEffect(() => {
    setLocalPromptHeight(promptHeight);
  }, [promptHeight]);

  const handleGenerate = useCallback(() => {
    if (editedContent !== content) {
      onContentChange(editedContent);
    }
    onGenerateClick(editedContent);
  }, [editedContent, content, onContentChange, onGenerateClick]);

  const handlePromptBlur = useCallback(() => {
    // Don't exit edit mode on blur immediately if we clicked the generate button
    // But for now, let's keep it simple. If we click outside, we save but don't generate.
    if (editedContent !== content) {
      onContentChange(editedContent);
    }
  }, [editedContent, content, onContentChange]);

  const handlePromptKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditedContent(content);
    } else if (e.key === 'Enter') {
      if (e.ctrlKey || !e.shiftKey) {
        // Enter (without Shift) or Ctrl+Enter -> Generate
        e.preventDefault();
        handleGenerate();
      }
      // Shift+Enter -> Default behavior (new line)
    }
  }, [content, handleGenerate]);

  const handleResize = useCallback((topHeight: number, _bottomHeight: number) => {
    setLocalPromptHeight(topHeight);
  }, []);

  const handleResizeEnd = useCallback((topHeight: number, bottomHeight: number) => {
    onHeightsChange(topHeight, bottomHeight);
  }, [onHeightsChange]);

  // Status icon and text
  const getStatusDisplay = () => {
    switch (llmStatus) {
      case 'queued':
        return { icon: <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />, text: 'En attente...' };
      case 'streaming':
        return { icon: <Loader2 className="w-4 h-4 animate-spin text-blue-500" />, text: 'Génération...' };
      case 'complete':
        return { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, text: 'Terminé' };
      case 'error':
        return { icon: <AlertCircle className="w-4 h-4 text-red-500" />, text: 'Erreur' };
      default:
        return { icon: null, text: '' };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div
      className="llm-node-content-dual-zone"
      style={{ height: '100%', fontSize: `${fontSize}px`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header with status */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          {statusDisplay.icon}
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {statusDisplay.text}
          </span>
        </div>
        {contextInfo && contextInfo.includedParents > 0 && (
          <div className="text-xs text-slate-500 dark:text-slate-400" title={`${contextInfo.includedParents} parents included${contextInfo.truncatedParents > 0 ? `, ${contextInfo.truncatedParents} truncated` : ''}`}>
            Context: {contextInfo.includedParents}p, {contextInfo.contextTokens}/{contextInfo.maxTokens}t
            {contextInfo.truncatedParents > 0 && <span className="text-orange-500 ml-1">⚠️</span>}
          </div>
        )}
      </div>

      {/* Top Note (Collapsible) */}
      {noteTop && (
        <div className="border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={() => setIsTopNoteExpanded(!isTopNoteExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span>📌 Note</span>
            {isTopNoteExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {isTopNoteExpanded && (
            <div className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20">
              {noteTop}
            </div>
          )}
        </div>
      )}

      {/* Prompt Zone */}
      <div
        className="prompt-zone p-3 bg-white dark:bg-slate-900 nodrag"
        style={{
          height: `${localPromptHeight}px`,
          flexShrink: 1,
          minHeight: '50px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex-shrink-0">📝 PROMPT</div>
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          onBlur={handlePromptBlur}
          onKeyDown={handlePromptKeyDown}
          className="w-full flex-1 min-h-0 resize-none bg-transparent border border-blue-200 dark:border-blue-800 rounded p-2 outline-none text-slate-800 dark:text-slate-200 overflow-y-auto nodrag"
          placeholder="Écrivez votre prompt ici... (Enter pour générer, Shift+Enter pour saut de ligne)"
        />
      </div>

      {/* Resizable Divider */}
      <ResizableDivider
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
        containerHeight={0} // Ignored by updated ResizableDivider
        initialTopHeight={localPromptHeight}
      />

      {/* Action Buttons */}
      <div className="flex items-center gap-2 px-3 py-2 border-y border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex-shrink-0">
        <Button
          variant="primary"
          size="sm"
          onClick={() => onGenerateClick()}
          disabled={llmStatus === 'queued' || llmStatus === 'streaming'}
        >
          <Play className="w-3 h-3 mr-1" />
          Generate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStopClick}
          disabled={llmStatus !== 'queued' && llmStatus !== 'streaming'}
        >
          <Square className="w-3 h-3 mr-1" />
          Stop
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefreshClick}
          disabled={llmStatus === 'queued' || llmStatus === 'streaming'}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Refresh
        </Button>
        {/* Progress Bar */}
        {(llmStatus === 'streaming' || llmStatus === 'queued') && (
          <div className="flex-1 ml-2">
            <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Response Zone */}
      <div
        className="response-zone overflow-auto p-3 bg-slate-50 dark:bg-slate-950 nodrag"
        style={{ flex: 1, minHeight: 0 }}
      >
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">💬 RESPONSE</div>
        {llmResponse ? (
          <div className="text-slate-800 dark:text-slate-200">
            <MarkdownRenderer content={llmResponse} />
          </div>
        ) : llmError ? (
          <div className="text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            {llmError}
          </div>
        ) : (
          <div className="text-slate-400 italic text-sm">
            {llmStatus === 'streaming' ? 'Streaming response...' : 'No response yet.'}
          </div>
        )}
      </div>

      {/* Bottom Note (Collapsible) */}
      {noteBottom && (
        <div className="border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={() => setIsBottomNoteExpanded(!isBottomNoteExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span>📌 Note</span>
            {isBottomNoteExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {isBottomNoteExpanded && (
            <div className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20">
              {noteBottom}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
