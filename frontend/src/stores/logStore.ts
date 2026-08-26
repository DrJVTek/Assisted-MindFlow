/**
 * Zustand store for the bottom log panel.
 *
 * Accumulates timestamped entries that show what the system is doing,
 * without the noise of the browser console (HMR warnings, React dev
 * messages, etc.). Fed from two sources:
 *
 *   1. executionStore SSE events — piped in automatically via an
 *      intercepting wrapper around `applyEvent` so every execution
 *      produces human-readable log lines without any extra wiring.
 *
 *   2. Explicit `addLog({level, source, message})` calls from any
 *      component or handler that wants to surface something (edge
 *      delete failed, provider validate failed, plugin uploaded, ...).
 *
 * The store keeps only the most recent N entries (ring buffer) so it
 * never leaks memory during a long session.
 */

import { create } from 'zustand';

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  /** Monotonic id — used as React key and for stable ordering. */
  id: number;
  /** Millisecond timestamp when the entry was created. */
  ts: number;
  level: LogLevel;
  /** Short category label shown as a colored chip (e.g. "exec", "plugin", "provider"). */
  source: string;
  /** The message text. */
  message: string;
  /**
   * Optional longer payload shown under the message when expanded.
   * Useful for stack traces, full error JSON, or long LLM responses.
   */
  detail?: string;
}

const MAX_LOG_ENTRIES = 500;

interface LogStore {
  entries: LogEntry[];
  nextId: number;
  /** Whether the panel is expanded (showing entries) or collapsed (header only). */
  expanded: boolean;
  /** Whether the panel should auto-scroll to the newest entry. */
  autoscroll: boolean;

  addLog: (partial: {
    level: LogLevel;
    source: string;
    message: string;
    detail?: string;
  }) => void;

  clear: () => void;

  setExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
  setAutoscroll: (autoscroll: boolean) => void;
}

export const useLogStore = create<LogStore>((set) => ({
  entries: [],
  nextId: 1,
  expanded: false,
  autoscroll: true,

  addLog: ({ level, source, message, detail }) =>
    set((state) => {
      const entry: LogEntry = {
        id: state.nextId,
        ts: Date.now(),
        level,
        source,
        message,
        detail,
      };
      const next = [...state.entries, entry];
      // Ring buffer — drop oldest entries when we exceed the cap
      if (next.length > MAX_LOG_ENTRIES) {
        next.splice(0, next.length - MAX_LOG_ENTRIES);
      }
      return { entries: next, nextId: state.nextId + 1 };
    }),

  clear: () => set({ entries: [], nextId: 1 }),

  setExpanded: (expanded) => set({ expanded }),
  toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),
  setAutoscroll: (autoscroll) => set({ autoscroll }),
}));

/**
 * Convenience helper to log without importing the store hook everywhere.
 * Usage: `logEvent('exec', 'success', 'Execution completed')`.
 */
export function logEvent(
  source: string,
  level: LogLevel,
  message: string,
  detail?: string
): void {
  useLogStore.getState().addLog({ source, level, message, detail });
}
