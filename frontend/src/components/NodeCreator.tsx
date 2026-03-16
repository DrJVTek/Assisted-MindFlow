/**
 * ComfyUI-style Node Picker
 *
 * Searchable palette that lists available node types grouped by category.
 * Right-click canvas → picker appears at cursor → click node type → node placed on canvas.
 * No form fields — nodes are configured in the DetailPanel after placement.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronRight, X } from 'lucide-react';
import { useNodeTypes } from '../hooks/useNodeTypes';
import type { NodeTypeDefinition } from '../types/plugin';

export interface NodeCreatorProps {
  onClose: () => void;
  onSelect: (classType: string) => void;
  /** Screen position where the picker should appear */
  position?: { x: number; y: number };
  parentId?: string;
}

// Category display configuration
const CATEGORY_ICONS: Record<string, string> = {
  llm: '🤖',
  input: '📝',
  output: '📤',
  transform: '🔄',
  community: '🌐',
};

function getCategoryIcon(category: string): string {
  const root = category.split('/')[0];
  return CATEGORY_ICONS[root] || '⚡';
}

function getCategoryDisplayName(category: string): string {
  return category
    .split('/')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' › ');
}

export function NodeCreator({ onClose, onSelect, position, parentId }: NodeCreatorProps) {
  const { nodeTypes, isLoaded, isLoading } = useNodeTypes();
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Auto-focus search on open
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Group node types by root category
  const categorized = useMemo(() => {
    const groups: Record<string, Array<{ classType: string; def: NodeTypeDefinition }>> = {};

    for (const [classType, def] of Object.entries(nodeTypes)) {
      const category = def.category || 'uncategorized';
      const root = category.split('/')[0];
      if (!groups[root]) groups[root] = [];
      groups[root].push({ classType, def });
    }

    const order = ['llm', 'input', 'output', 'transform'];
    return Object.entries(groups).sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [nodeTypes]);

  // Filtered results when searching
  const filteredItems = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const results: Array<{ classType: string; def: NodeTypeDefinition }> = [];
    for (const [classType, def] of Object.entries(nodeTypes)) {
      const searchable = `${def.display_name} ${classType} ${def.category}`.toLowerCase();
      if (searchable.includes(q)) {
        results.push({ classType, def });
      }
    }
    return results;
  }, [search, nodeTypes]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => {
    if (filteredItems) return filteredItems;
    const items: Array<{ classType: string; def: NodeTypeDefinition }> = [];
    for (const [category, entries] of categorized) {
      if (expandedCategories.has(category)) {
        items.push(...entries);
      }
    }
    return items;
  }, [filteredItems, categorized, expandedCategories]);

  // Reset selection on search change
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleSelect = useCallback(
    (classType: string) => {
      onSelect(classType);
      onClose();
    },
    [onSelect, onClose]
  );

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && flatItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(flatItems[selectedIndex].classType);
      }
    },
    [onClose, flatItems, selectedIndex, handleSelect]
  );

  // Scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current.get(selectedIndex);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Position calculation — keep within viewport
  const pickerStyle = useMemo(() => {
    const width = 280;
    const maxHeight = 420;
    let x = position?.x ?? window.innerWidth / 2 - width / 2;
    let y = position?.y ?? window.innerHeight / 2 - maxHeight / 2;

    if (x + width > window.innerWidth - 10) x = window.innerWidth - width - 10;
    if (y + maxHeight > window.innerHeight - 10) y = window.innerHeight - maxHeight - 10;
    if (x < 10) x = 10;
    if (y < 10) y = 10;

    return { left: x, top: y, width, maxHeight };
  }, [position]);

  // Render a node type item
  const renderItem = (
    item: { classType: string; def: NodeTypeDefinition },
    _index: number,
    globalIndex: number
  ) => {
    const { classType, def } = item;
    const color = def.ui?.color || '#546E7A';
    const isSelected = globalIndex === selectedIndex;
    const ports = def.return_types?.length || 0;
    const inputs = Object.keys(def.inputs?.required || {}).length;

    return (
      <button
        key={classType}
        ref={(el) => {
          if (el) itemRefs.current.set(globalIndex, el);
          else itemRefs.current.delete(globalIndex);
        }}
        onClick={() => handleSelect(classType)}
        onMouseEnter={() => setSelectedIndex(globalIndex)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          border: 'none',
          background: isSelected ? 'var(--panel-bg-secondary)' : 'transparent',
          color: 'var(--node-text)',
          cursor: 'pointer',
          borderRadius: '4px',
          fontSize: '12px',
          textAlign: 'left',
          transition: 'background 0.1s',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '2px',
            backgroundColor: color,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {def.display_name}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--node-text-secondary)', marginTop: '1px' }}>
            {inputs > 0 && `${inputs} in`}
            {inputs > 0 && ports > 0 && ' · '}
            {ports > 0 && `${ports} out`}
            {def.streaming && ' · stream'}
          </div>
        </div>
      </button>
    );
  };

  let globalIndex = 0;

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        left: pickerStyle.left,
        top: pickerStyle.top,
        width: pickerStyle.width,
        maxHeight: pickerStyle.maxHeight,
        backgroundColor: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 9999,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Search header */}
      <div
        style={{
          padding: '8px',
          borderBottom: '1px solid var(--panel-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Search size={14} style={{ color: 'var(--node-text-secondary)', flexShrink: 0 }} />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes..."
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            color: 'var(--node-text)',
            fontSize: '13px',
            outline: 'none',
            padding: '4px 0',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              color: 'var(--node-text-secondary)',
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Node list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px',
        }}
      >
        {isLoading && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--node-text-secondary)', fontSize: '12px' }}>
            Loading node types...
          </div>
        )}

        {isLoaded && Object.keys(nodeTypes).length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--node-text-secondary)', fontSize: '12px' }}>
            No node types available
          </div>
        )}

        {/* Search results */}
        {filteredItems && (
          <>
            {filteredItems.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  color: 'var(--node-text-secondary)',
                  fontSize: '12px',
                }}
              >
                No matches for "{search}"
              </div>
            ) : (
              filteredItems.map((item, i) => renderItem(item, i, i))
            )}
          </>
        )}

        {/* Category browser (when not searching) */}
        {!filteredItems &&
          categorized.map(([category, entries]) => {
            const isExpanded = expandedCategories.has(category);
            const startIndex = globalIndex;

            return (
              <div key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 8px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--node-text-secondary)',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    textAlign: 'left',
                  }}
                >
                  <ChevronRight
                    size={12}
                    style={{
                      transform: isExpanded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.15s',
                    }}
                  />
                  <span>{getCategoryIcon(category)}</span>
                  <span>{getCategoryDisplayName(category)}</span>
                  <span style={{ color: 'var(--node-text-muted)', marginLeft: 'auto', fontSize: '10px' }}>
                    {entries.length}
                  </span>
                </button>

                {isExpanded && (
                  <div style={{ paddingLeft: '12px' }}>
                    {entries.map((item, i) => {
                      const gi = startIndex + i;
                      return renderItem(item, i, gi);
                    })}
                  </div>
                )}

                {(() => {
                  if (isExpanded) globalIndex += entries.length;
                  return null;
                })()}
              </div>
            );
          })}
      </div>

      {/* Footer hint */}
      {parentId && (
        <div
          style={{
            padding: '6px 10px',
            borderTop: '1px solid var(--panel-border)',
            fontSize: '10px',
            color: 'var(--node-text-secondary)',
            textAlign: 'center',
          }}
        >
          Adding as child node
        </div>
      )}
    </div>
  );
}
