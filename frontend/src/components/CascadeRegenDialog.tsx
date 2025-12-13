/**
 * Cascade Regeneration Confirmation Dialog
 *
 * Shows affected nodes and confirms before regenerating the cascade.
 */


import type { Graph, UUID } from '../types/graph';
import { getAffectedNodes, getAffectedNodesInfo } from '../features/llm/utils/cascade';

interface CascadeRegenDialogProps {
  graph: Graph;
  modifiedNodeId: UUID;
  onConfirm: () => void;
  onCancel: () => void;
  isRegenerating?: boolean;
}

export function CascadeRegenDialog({
  graph,
  modifiedNodeId,
  onConfirm,
  onCancel,
  isRegenerating = false,
}: CascadeRegenDialogProps) {
  const affectedNodeIds = getAffectedNodes(graph, modifiedNodeId);
  const affectedNodesInfo = getAffectedNodesInfo(graph, affectedNodeIds);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600 }}>
          Regenerate Downstream Nodes?
        </h2>

        {affectedNodeIds.length === 0 ? (
          <p style={{ color: '#666', margin: '0 0 16px 0' }}>
            This node has no downstream nodes to regenerate.
          </p>
        ) : (
          <>
            <p style={{ color: '#666', margin: '0 0 16px 0' }}>
              Modifying this node will regenerate {affectedNodeIds.length} downstream node
              {affectedNodeIds.length !== 1 ? 's' : ''}:
            </p>

            <div
              style={{
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                padding: '12px',
                maxHeight: '300px',
                overflow: 'auto',
                marginBottom: '16px',
              }}
            >
              {affectedNodesInfo.map((nodeInfo, index) => (
                <div
                  key={nodeInfo.id}
                  style={{
                    padding: '8px',
                    borderBottom:
                      index < affectedNodesInfo.length - 1
                        ? '1px solid #e0e0e0'
                        : 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#1976D2',
                      marginBottom: '4px',
                    }}
                  >
                    {nodeInfo.type.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '14px', color: '#333' }}>
                    {nodeInfo.contentPreview}
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '14px', color: '#d32f2f', margin: '0 0 16px 0' }}>
              This action will overwrite the current content of these nodes using LLM
              generation.
            </p>
          </>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={isRegenerating}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              backgroundColor: 'white',
              cursor: isRegenerating ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: isRegenerating ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          {affectedNodeIds.length > 0 && (
            <button
              onClick={onConfirm}
              disabled={isRegenerating}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: isRegenerating ? '#999' : '#1976D2',
                color: 'white',
                cursor: isRegenerating ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              {isRegenerating ? 'Regenerating...' : 'Regenerate All'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
