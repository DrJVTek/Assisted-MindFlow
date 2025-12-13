/**
 * Canvas Navigator Component
 *
 * Left sidebar for managing multiple named canvases with full CRUD operations.
 */

import { useEffect, useState, useCallback } from 'react';
import { FolderOpen, Plus, Search, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { Canvas } from '../../../types/canvas';
import './CanvasNavigator.css';

export function CanvasNavigator() {
  const {
    canvases,
    activeCanvasId,
    isLoading,
    error,
    createCanvas,
    setActiveCanvas,
    renameCanvas,
    deleteCanvas,
    duplicateCanvas,
    clearError,
  } = useCanvasStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [contextMenuCanvas, setContextMenuCanvas] = useState<Canvas | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // Note: fetchCanvases() is called in Canvas.tsx (parent component)
  // to avoid duplicate API calls

  // Handle canvas switching
  const handleCanvasClick = useCallback(
    async (canvasId: string) => {
      if (canvasId !== activeCanvasId) {
        await setActiveCanvas(canvasId);
      }
    },
    [activeCanvasId, setActiveCanvas]
  );

  // Handle new canvas creation
  const handleNewCanvas = useCallback(async () => {
    const canvasCount = canvases.length;
    const defaultName = `Untitled Canvas ${canvasCount + 1}`;

    try {
      await createCanvas(defaultName);
    } catch (error) {
      console.error('Failed to create canvas:', error);
    }
  }, [canvases.length, createCanvas]);

  // Handle double-click to edit
  const handleDoubleClick = useCallback((canvas: Canvas) => {
    setEditingId(canvas.id);
    setEditingName(canvas.name);
  }, []);

  // Handle rename save
  const handleRenameSave = useCallback(async () => {
    if (editingId && editingName.trim() && editingName !== canvases.find(c => c.id === editingId)?.name) {
      try {
        await renameCanvas(editingId, editingName.trim());
      } catch (error) {
        console.error('Failed to rename canvas:', error);
      }
    }
    setEditingId(null);
    setEditingName('');
  }, [editingId, editingName, canvases, renameCanvas]);

  // Handle context menu open
  const handleContextMenu = useCallback((e: React.MouseEvent, canvas: Canvas) => {
    e.preventDefault();
    setContextMenuCanvas(canvas);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenuCanvas(null);
    setContextMenuPosition(null);
  }, []);

  // Handle context menu actions
  const handleRename = useCallback(() => {
    if (contextMenuCanvas) {
      setEditingId(contextMenuCanvas.id);
      setEditingName(contextMenuCanvas.name);
    }
    closeContextMenu();
  }, [contextMenuCanvas, closeContextMenu]);

  const handleDuplicate = useCallback(async () => {
    if (contextMenuCanvas) {
      try {
        await duplicateCanvas(contextMenuCanvas.id);
      } catch (error) {
        console.error('Failed to duplicate canvas:', error);
      }
    }
    closeContextMenu();
  }, [contextMenuCanvas, duplicateCanvas, closeContextMenu]);

  const handleDelete = useCallback(async () => {
    if (contextMenuCanvas) {
      const confirmed = window.confirm(
        `Are you sure you want to delete "${contextMenuCanvas.name}"?\n\nThis action cannot be undone. All nodes, groups, and comments in this canvas will be permanently deleted.`
      );

      if (confirmed) {
        try {
          await deleteCanvas(contextMenuCanvas.id);
        } catch (error) {
          console.error('Failed to delete canvas:', error);
        }
      }
    }
    closeContextMenu();
  }, [contextMenuCanvas, deleteCanvas, closeContextMenu]);

  // Filter canvases by search query
  const filteredCanvases = canvases.filter((canvas) =>
    canvas.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show search only when there are more than 10 canvases
  const showSearch = canvases.length > 10;

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Close context menu on outside click
  useEffect(() => {
    if (contextMenuPosition) {
      const handleClick = () => closeContextMenu();
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenuPosition, closeContextMenu]);

  if (isCollapsed) {
    return (
      <div className="canvas-navigator collapsed">
        <button
          className="collapse-toggle"
          onClick={() => setIsCollapsed(false)}
          title="Expand sidebar"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="canvas-navigator">
      {/* Header */}
      <div className="navigator-header">
        <div className="header-title">
          <FolderOpen size={20} />
          <h2>Canvases</h2>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            onClick={handleNewCanvas}
            title="New canvas (Ctrl+N)"
            disabled={isLoading}
          >
            <Plus size={20} />
          </button>
          <button
            className="icon-button collapse-toggle"
            onClick={() => setIsCollapsed(true)}
            title="Collapse sidebar"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="navigator-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search canvases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="navigator-error">
          <p>{error}</p>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      {/* Canvas list */}
      <div className="canvas-list">
        {isLoading && canvases.length === 0 ? (
          <div className="loading-state">Loading canvases...</div>
        ) : filteredCanvases.length === 0 ? (
          <div className="empty-state">
            {searchQuery ? 'No canvases match your search' : 'No canvases yet'}
            <button onClick={handleNewCanvas} className="create-first-button">
              Create your first canvas
            </button>
          </div>
        ) : (
          filteredCanvases.map((canvas) => (
            <div
              key={canvas.id}
              className={`canvas-item ${canvas.id === activeCanvasId ? 'active' : ''}`}
              onClick={() => handleCanvasClick(canvas.id)}
              onDoubleClick={() => handleDoubleClick(canvas)}
              onContextMenu={(e) => handleContextMenu(e, canvas)}
            >
              <div className="canvas-icon">
                <FolderOpen size={18} />
              </div>
              <div className="canvas-info">
                {editingId === canvas.id ? (
                  <input
                    className="canvas-name-input"
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleRenameSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSave();
                      if (e.key === 'Escape') {
                        setEditingId(null);
                        setEditingName('');
                      }
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <div className="canvas-name">{canvas.name}</div>
                    <div className="canvas-timestamp">
                      {formatTimestamp(canvas.last_opened)}
                    </div>
                  </>
                )}
              </div>
              <button
                className="canvas-menu-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e, canvas);
                }}
              >
                <MoreVertical size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Context menu */}
      {contextMenuCanvas && contextMenuPosition && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenuPosition.y,
            left: contextMenuPosition.x,
          }}
        >
          <button className="context-menu-item" onClick={handleRename}>
            Rename
          </button>
          <button className="context-menu-item" onClick={handleDuplicate}>
            Duplicate
          </button>
          <button className="context-menu-item danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
