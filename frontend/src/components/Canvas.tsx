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

  // Handle canvas click (deselect)
  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Handle double-click to fit view
  const onDoubleClick = useCallback(() => {
    fitView();
  }, [fitView]);

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
    <div style={{
      width: '100%',
      height: '100vh',
      touchAction: 'none', // Prevent browser default touch behaviors
    }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDoubleClick={onDoubleClick}
        onMove={onMove}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitView={preferences.autoFitOnLoad}
        // Touch & Mouse Configuration
        panOnDrag={true}        // Enables mouse drag and single-finger pan on touch devices
        panOnScroll={false}     // Disabled: scroll is used for zoom (better UX)
        zoomOnScroll={true}     // Mouse wheel zoom on desktop
        zoomOnPinch={true}      // Pinch-to-zoom on touch devices
        zoomOnDoubleClick={false} // Disabled: reserved for fit-to-view
        selectNodesOnDrag={false} // Prevents accidental selection during pan
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
    </div>
  );
}
