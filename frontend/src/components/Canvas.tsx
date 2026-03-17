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
  addEdge,
  type Connection,
} from 'reactflow';
import { Settings, RefreshCw, Undo, Redo } from 'lucide-react';
import 'reactflow/dist/style.css';

import { useCanvasStore } from '../stores/canvasStore';
import { useLLMOperationsStore } from '../stores/llmOperationsStore';
import { useGraphData } from '../features/canvas/hooks/useGraphData';
import { useViewport } from '../features/canvas/hooks/useViewport';
import { useLayout } from '../features/canvas/hooks/useLayout';
import { transformGraphToReactFlow, transformNode, visualNodeToReactFlowNode } from '../features/canvas/utils/transform';
import { useConnectionValidator } from './ConnectionValidator';
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

// Register custom node types — module-level for stable reference.
// Also memoized inside CanvasInner as a safety net against HMR re-execution.
const NODE_TYPES = {
  custom: CustomNode,
  group: GroupNode,
  comment: CommentNode,
} as const;

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

  // Stable nodeTypes reference — prevents React Flow warning #002 even during HMR
  const nodeTypes = useMemo(() => NODE_TYPES, []);

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
  const [nodeCreatorPosition, setNodeCreatorPosition] = useState<{ x: number; y: number } | undefined>(undefined);

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

  // Connection validation (Phase 6: type-safe connections)
  const { isValidConnection } = useConnectionValidator();

  // Load canvases on mount
  useEffect(() => {
    fetchCanvases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Get graphId from active canvas
  const activeCanvas = canvases.find(c => c.id === activeCanvasId);
  const graphId = activeCanvas?.graph_id;

  // Load graph data from API (only if we have an active canvas)
  const { graphData, isLoading, error, refreshGraph } = useGraphData(graphId || '');

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

  // Handle node click (only open detail panel for regular nodes)
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== 'custom') return;
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

  // Handle new connection between nodes
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!graphId || !connection.source || !connection.target) return;

      // Add edge to local state
      setLocalEdges(eds => addEdge(connection, eds));

      // Build the update payload
      const updatePayload: Record<string, unknown> = {
        parent_id: connection.source,
      };

      // If named handles are used (ComfyUI-style ports), save the connection mapping
      // sourceHandle = output port name, targetHandle = input port name
      const sourceHandle = connection.sourceHandle;
      const targetHandle = connection.targetHandle;
      if (targetHandle && !targetHandle.startsWith('__default') && sourceHandle && !sourceHandle.startsWith('__default')) {
        updatePayload.connection = {
          input_name: targetHandle,
          source_node_id: connection.source,
          output_name: sourceHandle,
        };
      }

      // Persist parent/child relationship + named connection to backend
      try {
        const response = await fetch(`/api/graphs/${graphId}/nodes/${connection.target}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        });
        if (!response.ok) {
          console.error('[Canvas] Failed to save connection:', response.statusText);
        }
      } catch (err) {
        console.error('[Canvas] Error saving connection:', err);
      }
    },
    [graphId]
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
      // Only persist position for regular nodes (not groups or comments)
      if (node.type !== 'custom') return;
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

  // Handle double-click on canvas — open node picker at cursor (ComfyUI-style)
  const onDoubleClick = useCallback((event: React.MouseEvent) => {
    setNodeCreatorParentId(undefined);
    setNodeCreatorPosition({ x: event.clientX, y: event.clientY });
    setNodeCreatorOpen(true);
  }, []);

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
    setNodeCreatorPosition(contextMenu ? { x: contextMenu.x, y: contextMenu.y } : undefined);
    setNodeCreatorOpen(true);
    closeContextMenu();
  }, [closeContextMenu, contextMenu]);

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
      refreshGraph();
    } catch (error) {
      console.error('Error creating comment:', error);
      console.error('Error creating comment:', error);
      closeContextMenu();
    }
  }, [contextMenu, graphId, closeContextMenu, reactFlowInstance, refreshGraph]);

  const handleCreateGroup = useCallback(async () => {
    if (selectedNodes.length === 0) {
      console.warn('Cannot create group: no nodes selected');
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
      refreshGraph();
    } catch (error) {
      console.error('Error creating group:', error);
      console.error('Error creating group:', error);
      closeContextMenu();
    }
  }, [selectedNodes, graphId, closeContextMenu, refreshGraph]);

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
        refreshGraph();
      } catch (error) {
        console.error('[handleAskLLM] Error clearing response:', error);
        // Continue anyway - user wants to regenerate
      }
    }

    setLLMNodeId(contextMenu.nodeId);
    setLLMDialogOpen(true);
    closeContextMenu();
  }, [contextMenu, graphData, graphId, cancelOperation, closeContextMenu, refreshGraph]);

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
      refreshGraph();
    } catch (error) {
      console.error('Error deleting node:', error);
      console.error('Error deleting node:', error);
      closeContextMenu();
    }
  }, [contextMenu, graphData, graphId, closeContextMenu, refreshGraph]);

  const handleAddChildNode = useCallback(() => {
    if (contextMenu?.nodeId) {
      setNodeCreatorParentId(contextMenu.nodeId);
      setNodeCreatorPosition(contextMenu ? { x: contextMenu.x, y: contextMenu.y } : undefined);
      setNodeCreatorOpen(true);
    }
  }, [contextMenu]);

  // Create an empty child node (for ChatGPT-like conversation flow)
  const handleCreateChildFromPanel = useCallback(async (parentId: string) => {
    if (!graphId || !graphData) return;
    const parentNode = graphData.nodes[parentId];
    if (!parentNode) return;

    try {
      const createdNode = await api.createNode(graphId, {
        type: parentNode.type || 'note',
        content: '',
        importance: 0.5,
        tags: [],
        status: 'draft',
        parent_ids: [parentId],
        provider_id: (parentNode as any).provider_id || undefined,
      });

      // Position below parent
      const parentPos = parentNode.meta?.position || { x: 100, y: 100 };
      const newPos = { x: parentPos.x, y: parentPos.y + 150 };
      await api.updateNode(graphId, createdNode.id, { position: newPos } as any).catch(() => {});

      const nodeForTransform = {
        id: createdNode.id,
        type: createdNode.type || parentNode.type,
        author: 'human',
        content: '',
        children: [],
        parents: [parentId],
        meta: { position: newPos, status: 'draft', importance: 0.5, ...(createdNode.meta || {}) },
        llm_response: null,
        llm_operation_id: null,
        provider_id: (parentNode as any).provider_id || null,
      };

      const visualNode = transformNode(nodeForTransform as any);
      const newReactFlowNode = visualNodeToReactFlowNode(visualNode, nodeForTransform as any, graphId);
      newReactFlowNode.position = newPos;

      setLocalNodes((prev) => [...prev, newReactFlowNode]);
      setLocalEdges((prev) => [
        ...prev,
        { id: `${parentId}-${createdNode.id}`, source: parentId, target: createdNode.id },
      ]);

      // Select the new node so the panel switches to it
      selectNode(createdNode.id);
    } catch (err) {
      console.error('Failed to create child node:', err);
    }
  }, [graphId, graphData, selectNode]);

  // Handle ComfyUI-style node creation: user picked a node type from the palette
  const handleNodeTypeSelected = useCallback(
    async (classType: string) => {
      if (!graphId) return;
      try {
        // Calculate canvas position from the right-click / picker position
        let canvasPos = { x: 100, y: 100 };
        if (nodeCreatorPosition) {
          canvasPos = reactFlowInstance.screenToFlowPosition({
            x: nodeCreatorPosition.x,
            y: nodeCreatorPosition.y,
          });
        }

        const createdNode = await api.createNode(graphId, {
          type: classType,
          content: '',
          importance: 0.5,
          tags: [],
          status: 'draft',
          parent_ids: nodeCreatorParentId ? [nodeCreatorParentId] : [],
        });

        // Build a Node-shaped object for the transform pipeline
        const nodeForTransform = {
          id: createdNode.id,
          type: classType,
          class_type: classType,
          author: createdNode.author || 'human',
          content: '',
          children: createdNode.children || [],
          parents: createdNode.parents || (nodeCreatorParentId ? [nodeCreatorParentId] : []),
          meta: {
            ...(createdNode.meta || {}),
            // Position from cursor — must come AFTER spread to avoid being overwritten by null
            position: canvasPos,
            status: createdNode.meta?.status || 'draft',
            importance: createdNode.meta?.importance ?? 0.5,
          },
          llm_response: null,
          llm_operation_id: null,
        };

        // Transform through the same pipeline as loaded nodes
        const visualNode = transformNode(nodeForTransform as any);
        const newReactFlowNode = visualNodeToReactFlowNode(visualNode, nodeForTransform as any, graphId);
        newReactFlowNode.position = canvasPos;
        newReactFlowNode.data.isNewNode = true;
        newReactFlowNode.data.class_type = classType;

        setLocalNodes((prev) => [...prev, newReactFlowNode]);

        if (nodeCreatorParentId) {
          setLocalEdges((prev) => [
            ...prev,
            {
              id: `${nodeCreatorParentId}-${createdNode.id}`,
              source: nodeCreatorParentId,
              target: createdNode.id,
            },
          ]);
        }

        // Select the new node to open DetailPanel
        selectNode(createdNode.id);

        // Clear isNewNode flag after delay
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
        console.error('Error creating node:', error);
      }
    },
    [graphId, nodeCreatorParentId, nodeCreatorPosition, reactFlowInstance, selectNode]
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
        refreshGraph();
      } catch (error) {
        console.error('Error updating node:', error);
        console.error('Error updating node:', error);
      }
    },
    [graphId, graphData, refreshGraph]
  );

  // Handle cascade regeneration confirmation
  const handleConfirmCascade = useCallback(async () => {
    if (!pendingCascadeNodeId || !graphId) return;

    try {
      const result = await regenerateCascade(graphId, pendingCascadeNodeId);

      setCascadeDialogOpen(false);
      setPendingCascadeNodeId(null);
      refreshGraph();
    } catch (error) {
      console.error('Error in cascade regeneration:', error);
      setCascadeDialogOpen(false);
      setPendingCascadeNodeId(null);
    }
  }, [graphId, pendingCascadeNodeId, regenerateCascade, refreshGraph]);

  // Handle cascade cancellation
  const handleCancelCascade = useCallback(() => {
    setCascadeDialogOpen(false);
    setPendingCascadeNodeId(null);
    refreshGraph();
  }, [refreshGraph]);

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
      refreshGraph();
    } catch (error) {
      console.error('Error updating node:', error);
    }
  }, [graphId, refreshGraph]);

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
          nodesConnectable={true}   // Enable edge creation with type validation
          onConnect={onConnect}
          isValidConnection={isValidConnection}
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
              graphId={graphId || ''}
              allNodes={graphData?.nodes || {}}
              onClose={() => selectNode(null)}
              onUpdate={handleUpdateNode}
              onCreateChild={handleCreateChildFromPanel}
              onSelectNode={(nodeId) => selectNode(nodeId)}
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
              // Invalidate graph cache and re-fetch to show imported nodes
              useCanvasStore.getState().setGraphData(null);
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

        {/* Node Picker (ComfyUI-style) */}
        {nodeCreatorOpen && (
          <NodeCreator
            onClose={() => setNodeCreatorOpen(false)}
            onSelect={handleNodeTypeSelected}
            position={nodeCreatorPosition}
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
              refreshGraph();
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
