/**
 * Debate Controls Component (Feature 011 - US2)
 *
 * Shows debate actions for nodes with connected LLM children:
 * - "Start Debate" button when no debate is running
 * - Round counter and status during active debates
 * - "Continue" button for completed debates
 * - "Stop" button for running debates
 */

import { useState } from 'react';
import { Play, Square, RotateCcw, Loader2, MessageSquare } from 'lucide-react';
import { useDebateStore } from '../stores/debateStore';
import type { DebateStatus } from '../types/debate';

interface DebateControlsProps {
  graphId: string;
  nodeId: string;
  /** Whether this node has connected children (needed for debate) */
  hasConnectedChildren: boolean;
}

export function DebateControls({ graphId, nodeId, hasConnectedChildren }: DebateControlsProps) {
  const { debates, startDebate, continueDebate, stopDebate } = useDebateStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find active debate for this node
  const debate = debates.find(
    (d) => d.start_node_id === nodeId && d.graph_id === graphId
  );

  if (!hasConnectedChildren && !debate) {
    return null;
  }

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await startDebate(graphId, nodeId, 5);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!debate) return;
    setLoading(true);
    setError(null);
    try {
      await continueDebate(debate.id, 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!debate) return;
    setLoading(true);
    try {
      await stopDebate(debate.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: DebateStatus): string => {
    switch (status) {
      case 'running':
        return 'var(--primary-color)';
      case 'completed':
        return 'var(--success-color, #4CAF50)';
      case 'stopped':
        return 'var(--node-text-muted)';
      case 'error':
        return 'var(--danger-color, #F44336)';
      default:
        return 'var(--node-text-muted)';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '8px',
        borderRadius: '6px',
        backgroundColor: 'var(--panel-bg-secondary, #f5f5f5)',
        border: '1px solid var(--panel-border, #e0e0e0)',
        fontSize: '12px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--node-text-secondary)' }}>
        <MessageSquare size={12} />
        <span>Debate</span>
      </div>

      {/* Status display */}
      {debate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: statusColor(debate.status),
              ...(debate.status === 'running' ? { animation: 'pulse 1.5s infinite' } : {}),
            }}
          />
          <span style={{ textTransform: 'capitalize', color: 'var(--node-text)' }}>
            {debate.status}
          </span>
          <span style={{ color: 'var(--node-text-muted)' }}>
            Round {debate.round_count}/{debate.max_rounds}
          </span>
          <span style={{ color: 'var(--node-text-muted)' }}>
            ({debate.node_ids.length} nodes)
          </span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={{ color: 'var(--danger-color, #F44336)', fontSize: '11px' }}>
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {!debate || debate.status === 'completed' || debate.status === 'stopped' || debate.status === 'error' ? (
          <>
            {!debate && (
              <button
                onClick={handleStart}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={12} />}
                Start Debate
              </button>
            )}
            {debate && (debate.status === 'completed' || debate.status === 'stopped') && (
              <button
                onClick={handleContinue}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: '4px',
                  border: '1px solid var(--primary-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--primary-color)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={12} />}
                Continue (+1 round)
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleStop}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 500,
              borderRadius: '4px',
              border: 'none',
              backgroundColor: 'var(--danger-color, #F44336)',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Square size={12} />}
            Stop Debate
          </button>
        )}
      </div>
    </div>
  );
}
