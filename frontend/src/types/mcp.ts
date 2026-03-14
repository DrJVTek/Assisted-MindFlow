/**
 * Types for MCP client connections (Feature 011 - US5)
 */

export type TransportType = 'stdio' | 'sse' | 'streamable_http';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RemoteMCPTool {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export interface MCPConnection {
  id: string;
  name: string;
  transport_type: TransportType;
  config: Record<string, any>;
  status: ConnectionStatus;
  discovered_tools: RemoteMCPTool[];
  tool_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMCPConnectionRequest {
  name: string;
  transport_type: TransportType;
  config: Record<string, any>;
}

/** Tool with its source connection info */
export interface MCPToolWithSource {
  connection_id: string;
  connection_name: string;
  name: string;
  description: string;
  input_schema: Record<string, any>;
}
