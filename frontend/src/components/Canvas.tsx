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

  // Local state for nodes and edges (synced with ReactFlow)
  const [localNodes, setLocalNodes] = useState<any[]>([]);
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

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', preferences.theme);
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

  // Find node being edited from graph data
  const nodeToEdit = useMemo(() => {
    if (!nodeBeingEdited || !graphData) return null;
    return graphData.nodes[nodeBeingEdited] || null;
  }, [nodeBeingEdited, graphData]);

  // Handle viewport changes (save to localStorage with debounce)
  const onMove = useCallback(
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

  // Handle node drag (debug)
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      console.log('Node dragging:', node.id, node.position);
    },
    []
  );

  // Handle node drag end (save position)
  const onNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      console.log('Node drag stopped:', node.id, node.position);
      try {
        // Save position to backend (position is stored in meta.position)
        // Note: The API expects position updates through the updateNode endpoint
        // which will update node.meta.position
        console.log(`Node ${node.id} position changed:`, node.position);
        // TODO: Add position persistence to backend if needed
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

  const handleAskLLM = useCallback(() => {
    if (contextMenu?.nodeId) {
      setLLMNodeId(contextMenu.nodeId);
      setLLMDialogOpen(true);
      closeContextMenu();
    }
  }, [contextMenu, closeContextMenu]);

  const handleDeleteNode = useCallback(async () => {
    if (!contextMenu?.nodeId) return;

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

        // Force reload graph data to show the new node
        window.location.reload();
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
    }) => {
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
    if (!pendingCascadeNodeId) return;

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
        <CanvasNavigator />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem',
          color: '#666'
        }}>
          <div style={{ fontSize: '1.2rem' }}>No canvas selected</div>
          <div>Create a new canvas or select one from the sidebar</div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100vh',
        }}
      >
        <CanvasNavigator />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div>Loading graph...</div>
        </div>
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
        <CanvasNavigator />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ color: '#d32f2f', fontSize: '1.2rem' }}>Error loading graph</div>
          <div style={{ color: '#666' }}>{error}</div>
        </div>
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
      <CanvasNavigator />

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

      {/* Detail Panel (lazy loaded) */}
      {selectedNode && (
        <Suspense fallback={<div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '400px',
          height: '100vh',
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
        }}>Loading...</div>}>
          <DetailPanel
            node={selectedNode}
            onClose={() => selectNode(null)}
          />
        </Suspense>
      )}

      {/* Settings Panel */}
      {settingsPanelOpen && (
        <SettingsPanel onClose={() => setSettingsPanelOpen(false)} />
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
          onSave={handleUpdateNode}
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
      {versionHistoryOpen && versionHistoryNodeId && graphData && (
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
            window.location.reload(); // Simple approach - reload to get latest data
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
      </div>
    </div>
  );
}
