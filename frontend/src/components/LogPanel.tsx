/**
 * LogPanel — collapsible dock at the bottom of the canvas showing
 * execution events, errors, and explicit log entries.
 *
 * Reads from logStore (populated automatically by executionStore.applyEvent
 * via logEvent() calls, and by anyone calling useLogStore.getState().addLog()
 * directly).
 *
 * Two modes:
 *   - Collapsed (default): a thin header bar showing the most recent entry
 *     and a chevron to expand
 *   - Expanded: a fixed-height scrollable list of entries with level chips,
 *     source chips, timestamps, and an optional detail row under long
 *     messages (stack traces, full error payloads, ...)
 */

import { useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronUp, Trash2, Terminal } from 'lucide-react';
import { useLogStore, type LogEntry, type LogLevel } from '../stores/logStore';


const LEVEL_COLORS: Record<LogLevel, { fg: string; bg: string; chip: string }> = {
  info:    { fg: '#93c5fd', bg: 'rgba(59, 130, 246, 0.08)', chip: '#3b82f6' },
  success: { fg: '#86efac', bg: 'rgba(34, 197, 94, 0.08)',  chip: '#22c55e' },
  warn:    { fg: '#fcd34d', bg: 'rgba(245, 158, 11, 0.08)', chip: '#f59e0b' },
  error:   { fg: '#fca5a5', bg: 'rgba(239, 68, 68, 0.10)',  chip: '#ef4444' },
  debug:   { fg: '#c4b5fd', bg: 'rgba(139, 92, 246, 0.08)', chip: '#8b5cf6' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return (
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0') +
    ':' +
    String(d.getSeconds()).padStart(2, '0')
  );
}


export function LogPanel() {
  const entries = useLogStore((s) => s.entries);
  const expanded = useLogStore((s) => s.expanded);
  const autoscroll = useLogStore((s) => s.autoscroll);
  const toggleExpanded = useLogStore((s) => s.toggleExpanded);
  const clear = useLogStore((s) => s.clear);
  const setAutoscroll = useLogStore((s) => s.setAutoscroll);

  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest entry when expanded and new entries arrive
  useEffect(() => {
    if (expanded && autoscroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries.length, expanded, autoscroll]);

  // Last entry text for the collapsed header
  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const errorCount = useMemo(
    () => entries.filter((e) => e.level === 'error').length,
    [entries]
  );

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        backgroundColor: 'rgba(16, 18, 26, 0.98)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#e5e7eb',
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: '11px',
        boxShadow: expanded ? '0 -8px 24px rgba(0,0,0,0.5)' : 'none',
        transition: 'box-shadow 0.15s',
      }}
    >
      {/* Header bar — always visible */}
      <div
        onClick={toggleExpanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderBottom: expanded ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
        }}
      >
        <Terminal size={12} style={{ color: '#9ca3af' }} />
        <span style={{ fontWeight: 600, color: '#d1d5db' }}>Logs</span>
        <span style={{ color: '#6b7280' }}>·</span>
        <span style={{ color: '#9ca3af' }}>{entries.length} entries</span>
        {errorCount > 0 && (
          <span
            style={{
              color: '#fca5a5',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              padding: '1px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              fontWeight: 600,
            }}
          >
            {errorCount} error{errorCount > 1 ? 's' : ''}
          </span>
        )}

        {/* Last entry preview — only when collapsed so users see latest activity */}
        {!expanded && lastEntry && (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflow: 'hidden',
              marginLeft: '6px',
              color: LEVEL_COLORS[lastEntry.level].fg,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                fontSize: '9px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: LEVEL_COLORS[lastEntry.level].chip,
              }}
            >
              {lastEntry.source}
            </span>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {lastEntry.message}
            </span>
          </div>
        )}

        {/* Spacer to push the controls to the right when expanded */}
        {expanded && <div style={{ flex: 1 }} />}

        {/* Controls only visible when expanded so the collapsed bar stays clean */}
        {expanded && (
          <>
            <label
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                color: '#9ca3af',
                fontSize: '10px',
              }}
              title="Scroll to newest entry automatically"
            >
              <input
                type="checkbox"
                checked={autoscroll}
                onChange={(e) => setAutoscroll(e.target.checked)}
                style={{ margin: 0 }}
              />
              autoscroll
            </label>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              title="Clear all log entries"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 6px',
                fontSize: '10px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '3px',
                color: '#9ca3af',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={10} />
              Clear
            </button>
          </>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded();
          }}
          title={expanded ? 'Collapse' : 'Expand'}
          style={{
            padding: '2px 4px',
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Expanded log list */}
      {expanded && (
        <div
          ref={listRef}
          style={{
            height: '240px',
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {entries.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: '#6b7280',
                fontStyle: 'italic',
              }}
            >
              No log entries yet. Execute a node to see events here.
            </div>
          ) : (
            entries.map((entry) => <LogEntryRow key={entry.id} entry={entry} />)
          )}
        </div>
      )}
    </div>
  );
}


function LogEntryRow({ entry }: { entry: LogEntry }) {
  const colors = LEVEL_COLORS[entry.level];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '3px 12px',
        backgroundColor: colors.bg,
        borderLeft: `2px solid ${colors.chip}`,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          color: '#6b7280',
          fontSize: '10px',
          minWidth: '58px',
        }}
      >
        {formatTime(entry.ts)}
      </span>
      <span
        style={{
          flexShrink: 0,
          color: colors.chip,
          fontSize: '9px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          minWidth: '44px',
          paddingTop: '1px',
        }}
      >
        {entry.source}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: colors.fg, wordBreak: 'break-word' }}>
          {entry.message}
        </div>
        {entry.detail && (
          <div
            style={{
              marginTop: '2px',
              padding: '4px 6px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '3px',
              fontSize: '10px',
              color: '#9ca3af',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {entry.detail}
          </div>
        )}
      </div>
    </div>
  );
}
