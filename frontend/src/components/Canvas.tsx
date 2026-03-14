/**
 * Canvas Component - Main interactive node canvas using React Flow
 *
 * Features:
 * - Infinite canvas with zoom (25%-400%) and pan
 * - Grid background
 * - Minimap for navigation
 * - Controls for zoom/fit-to-view
 * - Keyboard shortcuts
 * - Viewport persistence
 * - Touch gestures: pinch-to-zoom, two-finger pan, tap to select
 * - Mouse: drag to pan, scroll to zoom, click to select
 */

import React, { useCallback, useMemo, useEffect, useState, lazy, Suspense } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  Panel,
  useReactFlow,
  applyNodeChanges,
} from 'reactflow';
import { Settings, RefreshCw, Undo, Redo } from 'lucide-react';
import 'reactflow/dist/style.css';

import { useCanvasStore } from '../stores/canvasStore';
import { useLLMOperationsStore } from '../stores/llmOperationsStore';
import { useGraphData } from '../features/canvas/hooks/useGraphData';
import { useViewport } from '../features/canvas/hooks/useViewport';
import { useLayout } from '../features/canvas/hooks/useLayout';
import { transformGraphToReactFlow } from '../features/canvas/utils/transform';
import { MIN_ZOOM, MAX_ZOOM, formatZoomPercentage } from '../features/canvas/utils/viewport';
import { CustomNode } from './Node';
import { GroupNode } from './GroupNode';
import { CommentNode } from './CommentNode';
import { SettingsPanel } from './SettingsPanel';
import { ContextMenu } from './ContextMenu';
import { NodeCreator } from './NodeCreator';
import { NodeEditor } from './NodeEditor';
import { CascadeRegenDialog } from './CascadeRegenDialog';
import { VersionHistory } from './VersionHistory';
import { LLMDialog } from './LLMDialog';
import { AggregatePanel } from './AggregatePanel';
import { DebateControls } from './DebateControls';
import { ImportConversationDialog } from './ImportConversationDialog';
import { CanvasNavigator } from '../features/canvas/components/CanvasNavigator';
import { api } from '../services/api';
import { useCascadeRegen } from '../features/llm/hooks/useCascadeRegen';
import { getAffectedNodes } from '../features/llm/utils/cascade';

// Type for context menu (defined here to avoid import issues)
type ContextMenuType = 'canvas' | 'node' | 'group';

// Lazy load DetailPanel for better performance
const DetailPanel = lazy(() => import('./DetailPanel').then(module => ({ default: module.DetailPanel })));

// Register custom node types
const nodeTypes = {
  custom: CustomNode,
  group: GroupNode,
  comment: CommentNode,
};

// Node type (React Flow's internal type - not exported)
type Node = {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

/**
 * Canvas component wrapped with ReactFlowProvider
 */
export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

/**
 * Inner Canvas component with React Flow
 */
function CanvasInner() {
  const { selectNode, preferences, selectedNodeId, createCanvas, canvases, activeCanvasId, fetchCanvases } = useCanvasStore();
  const { cancelOperation } = useLLMOperationsStore(); // Feature 009 T023
  const [currentZoom, setCurrentZoom] = useState(1.0);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const reactFlowInstance = useReactFlow();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: ContextMenuType;
    nodeId?: string;
  } | null>(null);

  // Node creator state
  const [nodeCreatorOpen, setNodeCreatorOpen] = useState(false);
  const [nodeCreatorParentId, setNodeCreatorParentId] = useState<string | undefined>(undefined);

  // Node editor state
  const [nodeEditorOpen, setNodeEditorOpen] = useState(false);
  const [nodeBeingEdited, setNodeBeingEdited] = useState<string | null>(null);

  // Cascade regeneration state
  const [cascadeDialogOpen, setCascadeDialogOpen] = useState(false);
  const [pendingCascadeNodeId, setPendingCascadeNodeId] = useState<string | null>(null);
  const { isRegenerating, regenerateCascade } = useCascadeRegen();

  // Version history state
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versionHistoryNodeId, setVersionHistoryNodeId] = useState<string | null>(null);

  // LLM dialog state
  const [llmDialogOpen, setLLMDialogOpen] = useState(false);
  const [llmNodeId, setLLMNodeId] = useState<string | null>(null);

  // Import conversation dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Local state for nodes and edges (synced with ReactFlow)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localNodes, setLocalNodes] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localEdges, setLocalEdges] = useState<any[]>([]);

  // Multi-selection state
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

  // Load canvases on mount
  useEffect(() => {
    fetchCanvases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Get graphId from active canvas
  const activeCanvas = canvases.find(c => c.id === activeCanvasId);
  const graphId = activeCanvas?.graph_id;

  // Load graph data from API (only if we have an active canvas)
  const { graphData, isLoading, error } = useGraphData(graphId || '');

  // Viewport management with persistence
  const { saveViewport, fitView, zoomIn, zoomOut } = useViewport(graphId);

  // Layout reorganization with undo/redo
  const {
    handleReorganize,
    isLoading: isReorganizing,
    undo: undoReorganize,
    redo: redoReorganize,
    canUndo,
    canRedo,
  } = useLayout(localNodes, localEdges, setLocalNodes, graphId);

  // Apply theme to document — both data-theme attribute and .dark class for Tailwind
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', preferences.theme);
    if (preferences.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [preferences.theme]);

  // Transform graph data to React Flow format with edge emphasis and zoom-based detail level
  const { nodes, edges } = useMemo(() => {
    if (!graphData) {
      return { nodes: [], edges: [] };
    }

    const { nodes: rfNodes, edges: rfEdges } = transformGraphToReactFlow(graphData);

    // Add current zoom level to node data for conditional rendering
    const nodesWithZoom = rfNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        currentZoom,
      },
    }));

    // Emphasize edges connected to selected node
    if (selectedNodeId) {
      const emphasizedEdges = rfEdges.map(edge => {
        const isConnected = edge.source === selectedNodeId || edge.target === selectedNodeId;
        if (isConnected) {
          return {
            ...edge,
            style: {
              ...edge.style,
              strokeWidth: 3,
              opacity: 1.0,
              stroke: '#1976D2',
            },
            zIndex: 10, // Render on top
          };
        }
        return edge;
      });
      return { nodes: nodesWithZoom, edges: emphasizedEdges };
    }

    return { nodes: nodesWithZoom, edges: rfEdges };
  }, [graphData, selectedNodeId, currentZoom]);

  // Sync computed nodes/edges to local state (preserving ReactFlow's internal changes during drag)
  useEffect(() => {
    setLocalNodes(nodes);
    setLocalEdges(edges);
  }, [nodes, edges]);

  // Find selected node from graph data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !graphData) return null;
    return graphData.nodes[selectedNodeId] || null;
  }, [selectedNodeId, graphData]);

  // Check if selected node has connected children (for debate controls)
  const selectedNodeHasChildren = useMemo(() => {
    if (!selectedNodeId) return false;
    return localEdges.some(edge => edge.source === selectedNodeId);
  }, [selectedNodeId, localEdges]);

  // Find node being edited from graph data
  const nodeToEdit = useMemo(() => {
    if (!nodeBeingEdited || !graphData) return null;
    return graphData.nodes[nodeBeingEdited] || null;
  }, [nodeBeingEdited, graphData]);

  // Handle viewport changes (save to localStorage with debounce)
  const onMove = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_event: any, viewport: any) => {
      saveViewport(viewport);
      setCurrentZoom(viewport.zoom);
    },
    [saveViewport]
  );

  // Handle node click
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  // Handle node double-click (open editor)
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setNodeBeingEdited(node.id);
      setNodeEditorOpen(true);
    },
    []
  );

  // Handle node changes (drag, select, etc.) - sync with local state
  const onNodesChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (changes: any[]) => {
      setLocalNodes((nds) => {
        const updatedNodes = applyNodeChanges(changes, nds);

        // Track selected nodes for multi-selection
        const selected = updatedNodes
          .filter((node) => node.selected)
          .map((node) => node.id);
        setSelectedNodes(selected);

        return updatedNodes;
      });
    },
    []
  );

  // Handle node drag (no-op, position tracked by ReactFlow internally)
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, _node: Node) => {
      // Intentionally empty — ReactFlow handles live position updates
    },
    []
  );

  // Handle node drag end (save position to backend)
  const onNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (!graphId || !node.position) return;
      try {
        await api.updateNode(graphId, node.id, {
          position: { x: node.position.x, y: node.position.y },
        });
      } catch (error) {
        console.error('Error saving node position:', error);
      }
    },
    [graphId]
  );

  // Handle canvas click (deselect)
  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Handle double-click to fit view
  const onDoubleClick = useCallback(() => {
    fitView();
  }, [fitView]);

  // Handle canvas right-click (context menu)
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      type: 'canvas',
    });
  }, []);

  // Handle node right-click (context menu)
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      type: 'node',
      nodeId: node.id,
    });
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Context menu action handlers
  const handleAddNode = useCallback(() => {
    setNodeCreatorParentId(undefined);
    setNodeCreatorOpen(true);
    closeContextMenu();
  }, [closeContextMenu]);

  const handleAddComment = useCallback(async () => {
    if (!contextMenu) {
      closeContextMenu();
      return;
    }

    if (!graphId) return;

    try {
      // Get the canvas position where user right-clicked
      const canvasPosition = reactFlowInstance.screenToFlowPosition({
        x: contextMenu.x,
        y: contextMenu.y,
      });

      console.log('Creating comment at position:', canvasPosition);

      const content = prompt('Enter comment text:');
      if (!content || !content.trim()) {
        closeContextMenu();
        return;
      }

      // Create comment via API
      await api.createComment(graphId, {
        content: content.trim(),
        author: 'human',
        position: {
          x: canvasPosition.x,
          y: canvasPosition.y,
        },
      });

      console.log('Comment created successfully');
      closeContextMenu();

      // Reload to show new comment
      window.location.reload();
    } catch (error) {
      console.error('Error creating comment:', error);
      alert(`Error creating comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      closeContextMenu();
    }
  }, [contextMenu, graphId, closeContextMenu, reactFlowInstance]);

  const handleCreateGroup = useCallback(async () => {
    if (selectedNodes.length === 0) {
      alert('Please select at least one node to create a group');
      closeContextMenu();
      return;
    }

    if (!graphId) return;

    try {
      const label = prompt('Enter group name:');
      if (!label || !label.trim()) {
        closeContextMenu();
        return;
      }

      console.log('Creating group with selected nodes:', selectedNodes);

      // Create group via API
      await api.createGroup(graphId, {
        label: label.trim(),
        kind: 'cluster',
        pinned_nodes: selectedNodes,
        color: '#E3F2FD', // Default blue
      });

      console.log('Group created successfully');
      closeContextMenu();

      // Reload to show new group
      window.location.reload();
    } catch (error) {
      console.error('Error creating group:', error);
      alert(`Error creating group: ${error instanceof Error ? error.message : 'Unknown error'}`);
      closeContextMenu();
    }
  }, [selectedNodes, graphId, closeContextMenu]);

  const handleEditNode = useCallback(() => {
    if (contextMenu?.nodeId) {
      setNodeBeingEdited(contextMenu.nodeId);
      setNodeEditorOpen(true);
      closeContextMenu();
    }
  }, [contextMenu, closeContextMenu]);

  const handleViewHistory = useCallback(() => {
    if (contextMenu?.nodeId) {
      setVersionHistoryNodeId(contextMenu.nodeId);
      setVersionHistoryOpen(true);
      closeContextMenu();
    }
  }, [contextMenu, closeContextMenu]);

  const handleAskLLM = useCallback(async () => {
    if (!contextMenu?.nodeId || !graphData || !graphId) return;

    const node = graphData.nodes[contextMenu.nodeId];
    if (!node) return;

    // Feature 009 T023: Cancel existing operation if present
    if (node.llm_operation_id) {
      try {
        console.log(`[handleAskLLM] Cancelling existing operation: ${node.llm_operation_id}`);
        await cancelOperation(node.llm_operation_id);
        console.log('[handleAskLLM] Operation cancelled successfully');
      } catch (error) {
        console.error('[handleAskLLM] Error cancelling operation:', error);
        // Continue anyway - user wants to regenerate
      }

      // Feature 009 T024: Clear llm_response locally before starting new operation
      try {
        console.log(`[handleAskLLM] Clearing llm_response for node ${contextMenu.nodeId}`);
        await api.updateNode(graphId, contextMenu.nodeId, {
          llm_response: null,
          llm_operation_id: null
        });
        console.log('[handleAskLLM] Response cleared successfully');

        // Force reload to show cleared state
        window.location.reload();
      } catch (error) {
        console.error('[handleAskLLM] Error clearing response:', error);
        // Continue anyway - user wants to regenerate
      }
    }

    setLLMNodeId(contextMenu.nodeId);
    setLLMDialogOpen(true);
    closeContextMenu();
  }, [contextMenu, graphData, graphId, cancelOperation, closeContextMenu]);

  const handleDeleteNode = useCallback(async () => {
    if (!contextMenu?.nodeId || !graphId) return;

    const nodeToDelete = graphData?.nodes[contextMenu.nodeId];
    if (!nodeToDelete) return;

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete this ${nodeToDelete.type} node?\n\n` +
      `"${nodeToDelete.content.substring(0, 100)}${nodeToDelete.content.length > 100 ? '...' : ''}"\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) {
      closeContextMenu();
      return;
    }

    try {
      console.log('Deleting node via API:', contextMenu.nodeId);

      await api.deleteNode(graphId, contextMenu.nodeId);

      console.log('Node deleted successfully');

      closeContextMenu();

      // Force reload graph data to show updated graph
      window.location.reload();
    } catch (error) {
      console.error('Error deleting node:', error);
      alert(`Error deleting node: ${error instanceof Error ? error.message : 'Unknown error'}`);
      closeContextMenu();
    }
  }, [contextMenu, graphData, graphId, closeContextMenu]);

  const handleAddChildNode = useCallback(() => {
    if (contextMenu?.nodeId) {
      setNodeCreatorParentId(contextMenu.nodeId);
      setNodeCreatorOpen(true);
    }
  }, [contextMenu]);

  // Handle node creation
  const handleSaveNode = useCallback(
    async (nodeData: {
      type: string;
      content: string;
      importance: number;
      tags: string[];
      status: string;
      parentId?: string;
    }) => {
      if (!graphId) return;
      try {
        console.log('Creating node via API:', nodeData);

        const createdNode = await api.createNode(graphId, {
          type: nodeData.type,
          content: nodeData.content,
          importance: nodeData.importance,
          tags: nodeData.tags,
          status: nodeData.status,
          parent_ids: nodeData.parentId ? [nodeData.parentId] : [],
        });

        console.log('Node created successfully:', createdNode);

        // Feature 009: Add node to local state with isNewNode flag for auto-launch
        // Calculate position for new node (centered in viewport or near parent)
        const newPosition = nodeData.parentId
          ? { x: 100, y: 100 } // TODO: Calculate position near parent
          : { x: 100, y: 100 }; // TODO: Center in viewport

        const newReactFlowNode = {
          id: createdNode.id,
          type: 'custom', // Or based on nodeData.type
          position: newPosition,
          data: {
            ...createdNode,
            isNewNode: true, // Feature 009: Flag for auto-launch trigger
            graphId, // Feature 009: Required for LLM operations
          },
        };

        // Add to local nodes
        setLocalNodes((prev) => [...prev, newReactFlowNode]);

        // If there's a parent, add edge
        if (nodeData.parentId) {
          setLocalEdges((prev) => [
            ...prev,
            {
              id: `${nodeData.parentId}-${createdNode.id}`,
              source: nodeData.parentId,
              target: createdNode.id,
            },
          ]);
        }

        // Clear isNewNode flag after a short delay to prevent re-triggering on subsequent renders
        setTimeout(() => {
          setLocalNodes((prev) =>
            prev.map((node) =>
              node.id === createdNode.id
                ? { ...node, data: { ...node.data, isNewNode: false } }
                : node
            )
          );
        }, 1000);
      } catch (error) {
        console.error('Error creating node:', error);
        alert(`Error creating node: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [graphId]
  );

  // Handle node update
  const handleUpdateNode = useCallback(
    async (nodeId: string, updates: {
      content: string;
      importance: number;
      tags: string[];
      status: string;
      type: string;
    }) => {
      if (!graphId) return;
      try {
        console.log('Updating node via API:', nodeId, updates);

        const updatedNode = await api.updateNode(graphId, nodeId, updates);

        console.log('Node updated successfully:', updatedNode);

        // Check if this node has descendants that need regeneration
        if (graphData) {
          const affectedNodes = getAffectedNodes(graphData, nodeId);
          if (affectedNodes.length > 0) {
            // Show cascade dialog to confirm regeneration
            setPendingCascadeNodeId(nodeId);
            setCascadeDialogOpen(true);
            return; // Don't reload yet, wait for cascade dialog
          }
        }

        // No descendants - just reload
        window.location.reload();
      } catch (error) {
        console.error('Error updating node:', error);
        alert(`Error updating node: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [graphId, graphData]
  );

  // Handle cascade regeneration confirmation
  const handleConfirmCascade = useCallback(async () => {
    if (!pendingCascadeNodeId || !graphId) return;

    try {
      const result = await regenerateCascade(graphId, pendingCascadeNodeId);

      if (result) {
        console.log('Cascade regeneration result:', result);

        if (result.success) {
          alert(`Successfully regenerated ${result.regenerated_count} downstream nodes`);
        } else {
          alert(`Regenerated ${result.regenerated_count} nodes with ${result.errors.length} errors`);
        }
      }

      // Close dialog and reload
      setCascadeDialogOpen(false);
      setPendingCascadeNodeId(null);
      window.location.reload();
    } catch (error) {
      console.error('Error in cascade regeneration:', error);
      alert(`Error regenerating cascade: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setCascadeDialogOpen(false);
      setPendingCascadeNodeId(null);
    }
  }, [graphId, pendingCascadeNodeId, regenerateCascade]);

  // Handle cascade cancellation
  const handleCancelCascade = useCallback(() => {
    setCascadeDialogOpen(false);
    setPendingCascadeNodeId(null);
    // Reload to show the updated node (without cascade)
    window.location.reload();
  }, []);

  // Handle NodeEditor save
  const handleNodeEditorSave = useCallback(async (nodeId: string, updates: {
    type?: string;
    status?: string;
    collapsed?: boolean;
    summary?: string;
  }) => {
    if (!graphId) return;
    try {
      console.log('Updating node via NodeEditor:', nodeId, updates);
      await api.updateNode(graphId, nodeId, updates);
      window.location.reload();
    } catch (error) {
      console.error('Error updating node:', error);
      alert(`Error updating node: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [graphId]);

  // Handle node from AggregatePanel
  const handleNavigateToNode = useCallback((nodeId: string) => {
    // Find node in local nodes
    const node = localNodes.find(n => n.id === nodeId);
    if (!node) {
      console.warn('Node not found:', nodeId);
      return;
    }

    // Pan to node with smooth transition
    reactFlowInstance.setCenter(
      node.position.x + (node.width || 200) / 2,
      node.position.y + (node.height || 100) / 2,
      { zoom: 1.5, duration: 800 }
    );

    // Select the node
    selectNode(nodeId);
  }, [localNodes, reactFlowInstance, selectNode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const PAN_STEP = 50; // pixels to pan per arrow key press

      // Ctrl+Z: Undo reorganization
      if (event.key === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) {
          undoReorganize();
        }
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z: Redo reorganization
      if (
        (event.key === 'y' && (event.ctrlKey || event.metaKey)) ||
        (event.key === 'z' && (event.ctrlKey || event.metaKey) && event.shiftKey)
      ) {
        event.preventDefault();
        if (canRedo) {
          redoReorganize();
        }
        return;
      }

      // Ctrl+N: Create new canvas
      if (event.key === 'n' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const canvasCount = canvases.length;
        const defaultName = `Untitled Canvas ${canvasCount + 1}`;
        createCanvas(defaultName).catch(console.error);
        return;
      }

      switch (event.key) {
        case 'Escape':
          selectNode(null);
          break;

        case '+':
        case '=':
          event.preventDefault();
          zoomIn();
          break;

        case '-':
        case '_':
          event.preventDefault();
          zoomOut();
          break;

        case 'ArrowUp':
          event.preventDefault();
          reactFlowInstance.setViewport({
            ...reactFlowInstance.getViewport(),
            y: reactFlowInstance.getViewport().y + PAN_STEP,
          });
          break;

        case 'ArrowDown':
          event.preventDefault();
          reactFlowInstance.setViewport({
            ...reactFlowInstance.getViewport(),
            y: reactFlowInstance.getViewport().y - PAN_STEP,
          });
          break;

        case 'ArrowLeft':
          event.preventDefault();
          reactFlowInstance.setViewport({
            ...reactFlowInstance.getViewport(),
            x: reactFlowInstance.getViewport().x + PAN_STEP,
          });
          break;

        case 'ArrowRight':
          event.preventDefault();
          reactFlowInstance.setViewport({
            ...reactFlowInstance.getViewport(),
            x: reactFlowInstance.getViewport().x - PAN_STEP,
          });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectNode, zoomIn, zoomOut, reactFlowInstance, canvases, createCanvas, undoReorganize, redoReorganize, canUndo, canRedo]);

  // No canvas selected state
  if (!activeCanvasId) {
    return (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100vh',
        }}
      >
        <CanvasNavigator onSettings={() => setSettingsPanelOpen(true)} onImport={() => setImportDialogOpen(true)} />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '0',
          background: 'var(--canvas-bg)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Watermark logo */}
          <img
            src="/logo.png"
            alt=""
            draggable={false}
            style={{
              width: '180px',
              height: '180px',
              objectFit: 'contain',
              opacity: 0.10,
              userSelect: 'none',
              pointerEvents: 'none',
              filter: preferences.theme === 'dark' ? 'brightness(2.5) saturate(0.5)' : 'saturate(0.4)',
            }}
          />

          <div style={{
            marginTop: '12px',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--node-text)',
            opacity: 0.10,
            letterSpacing: '-0.5px',
            userSelect: 'none',
          }}>
            MindFlow
          </div>

          <div style={{
            marginTop: '28px',
            color: 'var(--node-text-muted)',
            fontSize: '14px',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            Select a canvas or create a new one
          </div>
        </div>
        {settingsPanelOpen && (
          <SettingsPanel onClose={() => setSettingsPanelOpen(false)} />
        )}
      </div>
    );
  }

  // Loading state — only show when actually loading a graph, not during canvas CRUD
  if (isLoading && graphId) {
    return (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100vh',
        }}
      >
        <CanvasNavigator onSettings={() => setSettingsPanelOpen(true)} onImport={() => setImportDialogOpen(true)} />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--canvas-bg)',
          color: 'var(--node-text-muted)',
          fontSize: '14px',
        }}>
          Loading canvas...
        </div>
        {settingsPanelOpen && (
          <SettingsPanel onClose={() => setSettingsPanelOpen(false)} />
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100vh',
        }}
      >
        <CanvasNavigator onSettings={() => setSettingsPanelOpen(true)} onImport={() => setImportDialogOpen(true)} />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '12px',
          background: 'var(--canvas-bg)',
        }}>
          <div style={{ color: 'var(--danger-color)', fontSize: '16px', fontWeight: 600 }}>Error loading graph</div>
          <div style={{ color: 'var(--node-text-muted)', fontSize: '14px' }}>{error}</div>
        </div>
        {settingsPanelOpen && (
          <SettingsPanel onClose={() => setSettingsPanelOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100vh',
      }}
    >
      {/* Canvas Navigator Sidebar */}
      <CanvasNavigator onSettings={() => setSettingsPanelOpen(true)} onImport={() => setImportDialogOpen(true)} />

      {/* Main Canvas Area */}
      <div
        style={{
          flex: 1,
          height: '100vh',
          touchAction: 'none', // Prevent browser default touch behaviors
        }}
        role="application"
        aria-label="Interactive node canvas for reasoning graphs"
      >
        <ReactFlow
          nodes={localNodes}
          edges={localEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={onPaneClick}
          onDoubleClick={onDoubleClick}
          onMove={onMove}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          fitView={preferences.autoFitOnLoad}
          // Touch & Mouse Configuration
          panOnDrag={[1, 2]}      // Middle/right mouse button for panning (left for node drag)
          panOnScroll={false}     // Disabled: scroll is used for zoom (better UX)
          zoomOnScroll={true}     // Mouse wheel zoom on desktop
          zoomOnPinch={true}      // Pinch-to-zoom on touch devices
          zoomOnDoubleClick={false} // Disabled: node double-click opens editor
          nodesDraggable={true}     // Enable node dragging with left mouse button
          nodesConnectable={false}  // Disable edge creation for now
          elementsSelectable={true} // Allow selecting elements
          selectNodesOnDrag={false} // Don't select on drag (allows node movement)
          // Selection Configuration
          multiSelectionKeyCode="Shift" // Shift for multi-selection
          selectionOnDrag={true}        // Enable selection box on Shift+drag
          // Performance Optimizations
          onlyRenderVisibleElements={true} // Viewport culling for large graphs
          attributionPosition="bottom-right"
        >
          {/* Grid background */}
          {preferences.gridVisible && (
            <Background
              variant={BackgroundVariant.Dots}
              gap={preferences.gridSize}
              size={1}
              color="#90A4AE"
            />
          )}

          {/* Zoom controls */}
          <Controls showInteractive={false} />

          {/* Minimap */}
          {preferences.minimapVisible && (
            <MiniMap
              nodeColor="#1976D2"
              maskColor="rgba(0, 0, 0, 0.1)"
              position="bottom-right"
              style={{ marginBottom: 50 }}
              zoomable
              pannable
            />
          )}

          {/* Zoom level display */}
          <Panel position="top-left" style={{
            backgroundColor: 'var(--panel-bg)',
            padding: '8px 12px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--node-text)',
          }}>
            {formatZoomPercentage(currentZoom)}
          </Panel>

          {/* Toolbar buttons */}
          <Panel position="top-right" style={{
            backgroundColor: 'var(--panel-bg)',
            padding: '8px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            gap: '8px',
          }}>
            {/* Reorganize button */}
            <button
              onClick={handleReorganize}
              disabled={isReorganizing}
              style={{
                background: 'none',
                border: 'none',
                cursor: isReorganizing ? 'wait' : 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: isReorganizing ? 'var(--node-text-muted)' : 'var(--node-text-secondary)',
                opacity: isReorganizing ? 0.5 : 1,
              }}
              aria-label={isReorganizing ? 'Reorganizing canvas...' : 'Reorganize canvas layout'}
              title={isReorganizing ? 'Reorganizing...' : 'Reorganize canvas layout'}
            >
              <RefreshCw size={20} className={isReorganizing ? 'spin' : ''} />
            </button>

            {/* Undo button */}
            <button
              onClick={undoReorganize}
              disabled={!canUndo}
              style={{
                background: 'none',
                border: 'none',
                cursor: canUndo ? 'pointer' : 'not-allowed',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--node-text-secondary)',
                opacity: canUndo ? 1 : 0.3,
              }}
              aria-label="Undo reorganization (Ctrl+Z)"
              title="Undo (Ctrl+Z)"
            >
              <Undo size={20} />
            </button>

            {/* Redo button */}
            <button
              onClick={redoReorganize}
              disabled={!canRedo}
              style={{
                background: 'none',
                border: 'none',
                cursor: canRedo ? 'pointer' : 'not-allowed',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--node-text-secondary)',
                opacity: canRedo ? 1 : 0.3,
              }}
              aria-label="Redo reorganization (Ctrl+Y)"
              title="Redo (Ctrl+Y)"
            >
              <Redo size={20} />
            </button>

            {/* Settings button */}
            <button
              onClick={() => setSettingsPanelOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--node-text-secondary)',
              }}
              aria-label="Open settings"
            >
              <Settings size={20} />
            </button>
          </Panel>
        </ReactFlow>

        {/* Detail Panel */}
        {selectedNode && (
          <Suspense fallback={<div style={{
            position: 'fixed',
            right: 0,
            top: 0,
            width: '400px',
            height: '100vh',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
          }}>Loading...</div>}>
            <DetailPanel
              node={selectedNode}
              onClose={() => selectNode(null)}
              onUpdate={handleUpdateNode}
            />
          </Suspense>
        )}

        {/* Debate Controls - shown when selected node has children */}
        {selectedNodeId && graphId && selectedNodeHasChildren && (
          <div style={{
            position: 'fixed',
            right: selectedNode ? 410 : 10,
            bottom: 20,
            zIndex: 999,
            minWidth: '200px',
          }}>
            <DebateControls
              graphId={graphId}
              nodeId={selectedNodeId}
              hasConnectedChildren={selectedNodeHasChildren}
            />
          </div>
        )}

        {/* Settings Panel */}
        {settingsPanelOpen && (
          <SettingsPanel onClose={() => setSettingsPanelOpen(false)} />
        )}

        {/* Import Conversation Dialog */}
        {importDialogOpen && graphId && (
          <ImportConversationDialog
            graphId={graphId}
            onClose={() => setImportDialogOpen(false)}
            onImported={(groupId, nodeCount) => {
              console.log(`Imported ${nodeCount} nodes, group=${groupId}`);
              // Refresh graph data to show imported nodes
              window.location.reload();
            }}
          />
        )}

        {/* Context Menu */}
        {contextMenu && contextMenu.visible && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            type={contextMenu.type}
            onClose={closeContextMenu}
            onAddNode={contextMenu.type === 'canvas' ? handleAddNode : undefined}
            onAddComment={contextMenu.type === 'canvas' ? handleAddComment : undefined}
            onCreateGroup={contextMenu.type === 'canvas' ? handleCreateGroup : undefined}
            onEdit={contextMenu.type === 'node' ? handleEditNode : undefined}
            onDelete={contextMenu.type === 'node' ? handleDeleteNode : undefined}
            onAddChild={contextMenu.type === 'node' ? handleAddChildNode : undefined}
            onAskLLM={contextMenu.type === 'node' ? handleAskLLM : undefined}
            onViewHistory={contextMenu.type === 'node' ? handleViewHistory : undefined}
            onSettings={contextMenu.type === 'canvas' ? () => setSettingsPanelOpen(true) : undefined}
            onImportChatGPT={contextMenu.type === 'canvas' ? () => setImportDialogOpen(true) : undefined}
          />
        )}

        {/* Node Creator Modal */}
        {nodeCreatorOpen && (
          <NodeCreator
            onClose={() => setNodeCreatorOpen(false)}
            onSave={handleSaveNode}
            parentId={nodeCreatorParentId}
          />
        )}

        {/* Node Editor Modal */}
        {nodeEditorOpen && nodeToEdit && (
          <NodeEditor
            node={nodeToEdit}
            onClose={() => {
              setNodeEditorOpen(false);
              setNodeBeingEdited(null);
            }}
            onSave={handleNodeEditorSave}
          />
        )}

        {/* Cascade Regeneration Dialog */}
        {cascadeDialogOpen && pendingCascadeNodeId && graphData && (
          <CascadeRegenDialog
            graph={graphData}
            modifiedNodeId={pendingCascadeNodeId}
            onConfirm={handleConfirmCascade}
            onCancel={handleCancelCascade}
            isRegenerating={isRegenerating}
          />
        )}

        {/* Version History Panel */}
        {versionHistoryOpen && versionHistoryNodeId && graphData && graphId && (
          <VersionHistory
            graphId={graphId}
            nodeId={versionHistoryNodeId}
            currentContent={graphData.nodes[versionHistoryNodeId]?.content || ''}
            onClose={() => {
              setVersionHistoryOpen(false);
              setVersionHistoryNodeId(null);
            }}
            onRestore={async () => {
              // Refresh graph data after restore
              window.location.reload();
            }}
          />
        )}

        {/* LLM Dialog */}
        {llmDialogOpen && llmNodeId && graphId && (
          <LLMDialog
            isOpen={llmDialogOpen}
            onClose={() => setLLMDialogOpen(false)}
            nodeId={llmNodeId}
            graphId={graphId}
          />
        )}

        {/* Aggregate Panel - Multi-operation dashboard */}
        {graphId && (
          <AggregatePanel
            graphId={graphId}
            onNavigateToNode={handleNavigateToNode}
            initialCollapsed={false}
          />
        )}
      </div>
    </div>
  );
}
