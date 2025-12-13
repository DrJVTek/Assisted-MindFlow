/**
 * VersionHistory Component
 *
 * Displays version history timeline for a node with:
 * - Timeline UI showing all versions (newest first)
 * - Version details: version number, timestamp, trigger reason, content preview
 * - Diff viewer (highlight changes between selected version and current)
 * - Restore button per version
 * - Compare functionality
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  RotateCcw,
  User,

  GitBranch,
  RefreshCw,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import type { NodeVersion, TriggerReason } from '../types/graph';
import api from '../services/api';

interface VersionHistoryProps {
  graphId: string;
  nodeId: string;
  currentContent: string;
  onClose: () => void;
  onRestore: (versionId: string) => void;
}

/**
 * Get icon for trigger reason
 */
function getTriggerIcon(reason: TriggerReason): React.ReactElement {
  const iconProps = { size: 16, strokeWidth: 2 };

  switch (reason) {
    case 'manual_edit':
      return <User {...iconProps} />;
    case 'parent_cascade':
      return <GitBranch {...iconProps} />;
    case 'user_regen':
      return <RefreshCw {...iconProps} />;
    case 'rollback':
      return <RotateCcw {...iconProps} />;
    default:
      return <Clock {...iconProps} />;
  }
}

/**
 * Get color for trigger reason
 */
function getTriggerColor(reason: TriggerReason): string {
  switch (reason) {
    case 'manual_edit':
      return '#2196F3'; // Blue
    case 'parent_cascade':
      return '#9C27B0'; // Purple
    case 'user_regen':
      return '#FF9800'; // Orange
    case 'rollback':
      return '#4CAF50'; // Green
    default:
      return '#9E9E9E'; // Grey
  }
}

/**
 * Format trigger reason for display
 */
function formatTriggerReason(reason: TriggerReason): string {
  switch (reason) {
    case 'manual_edit':
      return 'Manual Edit';
    case 'parent_cascade':
      return 'Cascade Regen';
    case 'user_regen':
      return 'User Regen';
    case 'rollback':
      return 'Rollback';
    default:
      return reason;
  }
}

/**
 * Simple diff highlighting (character-based)
 * Returns content with <mark> tags around differences
 */
function highlightDiff(oldText: string, newText: string): string {
  // Simple character-level diff (not optimal, but functional)
  // For production, use a proper diff library like diff-match-patch

  if (oldText === newText) {
    return newText;
  }

  // Find common prefix
  let prefixLen = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix
  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  // Extract parts
  const prefix = newText.substring(0, prefixLen);
  const changed = newText.substring(prefixLen, newText.length - suffixLen);
  const suffix = newText.substring(newText.length - suffixLen);

  // Highlight changed part
  if (changed.length > 0) {
    return `${prefix}<mark style="background-color: #FFD54F; padding: 2px 4px;">${changed}</mark>${suffix}`;
  }

  return newText;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * VersionHistory Component
 */
export const VersionHistory: React.FC<VersionHistoryProps> = ({
  graphId,
  nodeId,

  onClose,
  onRestore,
}) => {
  const [versions, setVersions] = useState<NodeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  // Load versions on mount
  useEffect(() => {
    loadVersions();
  }, [graphId, nodeId]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getNodeVersions(graphId, nodeId);
      setVersions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (versionId: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(versionId)) {
      newExpanded.delete(versionId);
    } else {
      newExpanded.add(versionId);
    }
    setExpandedVersions(newExpanded);
  };

  const handleRestore = async (version: NodeVersion) => {
    if (
      confirm(
        `Restore to version ${version.version_number}?\n\nThis will create a new version with the restored content.`
      )
    ) {
      try {
        await api.restoreNodeVersion(graphId, nodeId, version.version_id);
        onRestore(version.version_id);
        onClose();
      } catch (err) {
        alert(`Failed to restore version: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '450px',
        height: '100vh',
        backgroundColor: '#FFFFFF',
        boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #E0E0E0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} strokeWidth={2} color="#546E7A" />
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#263238' }}>
            Version History
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            color: '#78909C',
          }}
          title="Close"
        >
          <X size={20} strokeWidth={2} />
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
        }}
      >
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#78909C' }}>
            Loading versions...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#FFEBEE',
              color: '#C62828',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && versions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#78909C' }}>
            No version history yet.
            <br />
            Edit this node to create the first version.
          </div>
        )}

        {!loading && !error && versions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {versions.map((version, index) => {
              const isExpanded = expandedVersions.has(version.version_id);
              const isLatest = index === 0;
              const previousVersion = index < versions.length - 1 ? versions[index + 1] : null;

              return (
                <div
                  key={version.version_id}
                  style={{
                    border: '1px solid #E0E0E0',
                    borderRadius: '8px',
                    backgroundColor: isLatest ? '#F5F5F5' : '#FFFFFF',
                    overflow: 'hidden',
                  }}
                >
                  {/* Version Header */}
                  <div
                    onClick={() => toggleExpanded(version.version_id)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      {/* Expand icon */}
                      <div style={{ color: '#78909C', display: 'flex' }}>
                        {isExpanded ? (
                          <ChevronDown size={18} strokeWidth={2} />
                        ) : (
                          <ChevronRight size={18} strokeWidth={2} />
                        )}
                      </div>

                      {/* Version info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: '#263238',
                            }}
                          >
                            Version {version.version_number}
                          </span>
                          {isLatest && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: '#2196F3',
                                backgroundColor: '#E3F2FD',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              CURRENT
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#78909C',
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: getTriggerColor(version.trigger_reason),
                            }}
                          >
                            {getTriggerIcon(version.trigger_reason)}
                            <span>{formatTriggerReason(version.trigger_reason)}</span>
                          </div>
                          <span>•</span>
                          <span>{formatTimestamp(version.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div
                      style={{
                        borderTop: '1px solid #E0E0E0',
                        padding: '16px',
                        backgroundColor: '#FAFAFA',
                      }}
                    >
                      {/* Content preview with diff */}
                      <div style={{ marginBottom: '12px' }}>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#78909C',
                            marginBottom: '8px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Content {previousVersion ? '(Changes Highlighted)' : ''}
                        </div>
                        <div
                          style={{
                            fontSize: '13px',
                            lineHeight: '1.6',
                            color: '#37474F',
                            backgroundColor: '#FFFFFF',
                            padding: '12px',
                            borderRadius: '4px',
                            border: '1px solid #E0E0E0',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                          }}
                          dangerouslySetInnerHTML={{
                            __html: previousVersion
                              ? highlightDiff(previousVersion.content, version.content)
                              : version.content,
                          }}
                        />
                      </div>

                      {/* LLM Metadata */}
                      {version.llm_metadata && Object.keys(version.llm_metadata).length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <div
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#78909C',
                              marginBottom: '8px',
                              textTransform: 'uppercase',
                            }}
                          >
                            Metadata
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#546E7A',
                              backgroundColor: '#FFFFFF',
                              padding: '8px 12px',
                              borderRadius: '4px',
                              border: '1px solid #E0E0E0',
                            }}
                          >
                            {version.llm_metadata.provider && (
                              <div>Provider: {version.llm_metadata.provider}</div>
                            )}
                            {version.llm_metadata.model && (
                              <div>Model: {version.llm_metadata.model}</div>
                            )}
                            {version.llm_metadata.restored_from_version && (
                              <div>
                                Restored from: Version {version.llm_metadata.restored_from_version}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Restore button */}
                      {!isLatest && (
                        <button
                          onClick={() => handleRestore(version)}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#45A049';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#4CAF50';
                          }}
                        >
                          <RotateCcw size={16} strokeWidth={2} />
                          Restore This Version
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid #E0E0E0',
          backgroundColor: '#F5F5F5',
          fontSize: '12px',
          color: '#78909C',
          textAlign: 'center',
        }}
      >
        {versions.length > 0 && `${versions.length} version${versions.length === 1 ? '' : 's'}`}
        {versions.length >= 10 && ' (showing last 10)'}
      </div>
    </div>
  );
};

export default VersionHistory;
