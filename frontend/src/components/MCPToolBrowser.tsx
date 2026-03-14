/**
 * MCP Tool Browser Component (Feature 011 - US5)
 *
 * Browse available MCP tools grouped by source server:
 * - Show tool descriptions and input schemas
 * - Filter/search tools
 * - Select tools for attachment to nodes
 */

import { useState, useEffect, useMemo } from 'react';
import { Search, Wrench, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useMCPStore } from '../stores/mcpStore';
import type { MCPToolWithSource } from '../types/mcp';

interface MCPToolBrowserProps {
  /** Currently selected tool names */
  selectedTools: string[];
  /** Callback when tool selection changes */
  onSelectionChange: (toolNames: string[]) => void;
  /** Compact mode for embedding in node editors */
  compact?: boolean;
}

export function MCPToolBrowser({
  selectedTools,
  onSelectionChange,
  compact = false,
}: MCPToolBrowserProps) {
  const { allTools, fetchAllTools } = useMCPStore();
  const [search, setSearch] = useState('');
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAllTools();
  }, [fetchAllTools]);

  // Group tools by source server
  const groupedTools = useMemo(() => {
    const groups: Record<string, MCPToolWithSource[]> = {};
    for (const tool of allTools) {
      const key = tool.connection_name || tool.connection_id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tool);
    }
    return groups;
  }, [allTools]);

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupedTools;
    const q = search.toLowerCase();
    const result: Record<string, MCPToolWithSource[]> = {};
    for (const [server, tools] of Object.entries(groupedTools)) {
      const matched = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
      if (matched.length > 0) result[server] = matched;
    }
    return result;
  }, [groupedTools, search]);

  const toggleServer = (server: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(server)) next.delete(server);
      else next.add(server);
      return next;
    });
  };

  const toggleSchema = (toolName: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) next.delete(toolName);
      else next.add(toolName);
      return next;
    });
  };

  const toggleTool = (toolName: string) => {
    if (selectedTools.includes(toolName)) {
      onSelectionChange(selectedTools.filter((t) => t !== toolName));
    } else {
      onSelectionChange([...selectedTools, toolName]);
    }
  };

  const serverNames = Object.keys(filteredGroups);

  if (allTools.length === 0) {
    return (
      <div
        className={`text-gray-500 text-sm ${compact ? 'py-2' : 'py-6 text-center'}`}
      >
        No MCP tools available. Connect to an MCP server in Settings.
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
          size={compact ? 12 : 14}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools..."
          className={`w-full border rounded bg-white dark:bg-gray-800 ${
            compact ? 'pl-6 pr-2 py-1 text-xs' : 'pl-7 pr-2 py-1.5'
          }`}
        />
      </div>

      {/* Tool groups */}
      <div className="space-y-1">
        {serverNames.map((server) => {
          const tools = filteredGroups[server];
          const isExpanded = expandedServers.has(server) || serverNames.length === 1;
          const selectedCount = tools.filter((t) =>
            selectedTools.includes(t.name)
          ).length;

          return (
            <div
              key={server}
              className="border rounded dark:border-gray-700"
            >
              {/* Server header */}
              <button
                onClick={() => toggleServer(server)}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
              >
                {isExpanded ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                <Wrench size={12} className="text-gray-500" />
                <span className="font-medium flex-1 truncate">{server}</span>
                <span className="text-gray-400">
                  {selectedCount > 0 && (
                    <span className="text-blue-500 mr-1">
                      {selectedCount}/
                    </span>
                  )}
                  {tools.length}
                </span>
              </button>

              {/* Tool list */}
              {isExpanded && (
                <div className="border-t dark:border-gray-700">
                  {tools.map((tool) => {
                    const isSelected = selectedTools.includes(tool.name);
                    const showSchema = expandedSchemas.has(tool.name);

                    return (
                      <div
                        key={tool.name}
                        className="border-b last:border-b-0 dark:border-gray-700"
                      >
                        <div
                          className={`flex items-start gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/20'
                              : ''
                          }`}
                          onClick={() => toggleTool(tool.name)}
                        >
                          {/* Checkbox */}
                          <div
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {isSelected && <Check size={10} />}
                          </div>

                          {/* Tool info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-mono font-medium truncate">
                              {tool.name}
                            </div>
                            {tool.description && (
                              <div className="text-gray-500 truncate">
                                {tool.description}
                              </div>
                            )}
                          </div>

                          {/* Schema toggle */}
                          {tool.input_schema &&
                            Object.keys(tool.input_schema).length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSchema(tool.name);
                                }}
                                className="text-gray-400 hover:text-gray-600 p-0.5 flex-shrink-0"
                                title="View schema"
                              >
                                {showSchema ? (
                                  <ChevronDown size={12} />
                                ) : (
                                  <ChevronRight size={12} />
                                )}
                              </button>
                            )}
                        </div>

                        {/* Schema details */}
                        {showSchema && tool.input_schema && (
                          <div className="px-8 py-1 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700">
                            <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(tool.input_schema, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selection summary */}
      {selectedTools.length > 0 && (
        <div className="text-gray-500 flex items-center justify-between">
          <span>
            {selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''}{' '}
            selected
          </span>
          <button
            onClick={() => onSelectionChange([])}
            className="text-red-400 hover:text-red-500"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
