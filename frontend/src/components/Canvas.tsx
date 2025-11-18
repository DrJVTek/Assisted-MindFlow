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
} from 'reactflow';
import { Settings } from 'lucide-react';
import 'reactflow/dist/style.css';

import { useCanvasStore } from '../stores/canvasStore';
import { useGraphData } from '../features/canvas/hooks/useGraphData';
import { useViewport } from '../features/canvas/hooks/useViewport';
import { transformGraphToReactFlow } from '../features/canvas/utils/transform';
import { MIN_ZOOM, MAX_ZOOM, formatZoomPercentage } from '../features/canvas/utils/viewport';
import { CustomNode } from './Node';
import { SettingsPanel } from './SettingsPanel';
import { ContextMenu } from './ContextMenu';
import { NodeCreator } from './NodeCreator';
import { NodeEditor } from './NodeEditor';
import { api } from '../services/api';

// Type for context menu (defined here to avoid import issues)
type ContextMenuType = 'canvas' | 'node';

// Lazy load DetailPanel for better performance
const DetailPanel = lazy(() => import('./DetailPanel').then(module => ({ default: module.DetailPanel })));

// Register custom node types
const nodeTypes = {
  custom: CustomNode,
};

// Viewport type (React Flow's internal type - not exported)
type Viewport = {
  x: number;
  y: number;
  zoom: number;
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
  const { selectNode, preferences, selectedNodeId } = useCanvasStore();
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

  // TODO: Get graphId from route params or props (hardcoded for now)
  const graphId = '550e8400-e29b-41d4-a716-446655440000'; // Demo graph UUID

  // Load graph data from API
  const { graphData, isLoading, error } = useGraphData(graphId);

  // Viewport management with persistence
  const { saveViewport, fitView, zoomIn, zoomOut } = useViewport(graphId);

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
    (_event, viewport) => {
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

  // Handle node drag end (save position)
  const onNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      try {
        // Save position to backend
        await api.updateNode(graphId, node.id, {
          position: {
            x: node.position.x,
            y: node.position.y,
          },
        });
        console.log(`Node ${node.id} position saved:`, node.position);
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

  const handleAddComment = useCallback(() => {
    console.log('Add Comment clicked - Not yet implemented');
    // TODO: Implement comment creation
    closeContextMenu();
  }, [closeContextMenu]);

  const handleCreateGroup = useCallback(() => {
    console.log('Create Group clicked - Not yet implemented');
    // TODO: Implement group creation from selected nodes
    closeContextMenu();
  }, [closeContextMenu]);

  const handleEditNode = useCallback(() => {
    if (contextMenu?.nodeId) {
      setNodeBeingEdited(contextMenu.nodeId);
      setNodeEditorOpen(true);
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

  const handleViewHistory = useCallback(() => {
    if (contextMenu?.nodeId) {
      console.log('View History clicked for:', contextMenu.nodeId);
      // TODO: Open VersionHistory panel
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

        // Force reload graph data to show the updated node
        window.location.reload();
      } catch (error) {
        console.error('Error updating node:', error);
        alert(`Error updating node: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [graphId]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const PAN_STEP = 50; // pixels to pan per arrow key press

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
  }, [selectNode, zoomIn, zoomOut, reactFlowInstance]);

  // Loading state
  if (isLoading) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>Loading graph...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ color: '#d32f2f', fontSize: '1.2rem' }}>Error loading graph</div>
        <div style={{ color: '#666' }}>{error}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        touchAction: 'none', // Prevent browser default touch behaviors
      }}
      role="application"
      aria-label="Interactive node canvas for reasoning graphs"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
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
        // Selection Configuration
        selectionOnDrag         // Box selection with drag (no modifier needed)
        multiSelectionKeyCode="Shift" // Shift for multi-selection
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

        {/* Settings button */}
        <Panel position="top-right" style={{
          backgroundColor: 'var(--panel-bg)',
          padding: '8px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          cursor: 'pointer',
        }}>
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
    </div>
  );
}
