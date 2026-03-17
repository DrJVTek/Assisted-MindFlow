/**
 * TypeScript types for MindFlow Graph entities (based on Python backend models)
 */

// Re-export UUID from dedicated file
export type { UUID } from './uuid';

// Legacy node types kept for backward compatibility.
// New nodes use class_type (string) from the plugin system.
export type NodeType =
  | 'question'
  | 'answer'
  | 'note'
  | 'hypothesis'
  | 'evaluation'
  | 'summary'
  | 'plan'
  | 'group_meta'
  | 'comment'
  | 'stop'
  | string; // Plugin-defined types (e.g., "llm_chat", "text_input")

export type NodeAuthor = 'human' | 'llm' | 'tool';

/**
 * State of a node's LLM operation.
 *
 * Represents the lifecycle of an LLM operation on a node:
 * - idle: No LLM operation in progress
 * - queued: LLM operation queued, waiting for available slot
 * - processing: LLM request sent, waiting for first token
 * - streaming: LLM tokens arriving, content being accumulated
 * - completed: LLM operation finished successfully
 * - failed: LLM operation failed (timeout, error, rate limit)
 * - cancelled: LLM operation cancelled by user
 *
 * State Transitions:
 *   idle → queued → processing → streaming → completed
 *                                            ↓
 *                                          failed
 *                                            ↓
 *                                        cancelled (from any state)
 */
export enum NodeState {
  IDLE = 'idle',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  STREAMING = 'streaming',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export type NodeStatus = 'draft' | 'valid' | 'invalid' | 'final' | 'experimental';

export interface NodeMetadata {
  position?: {
    x: number;
    y: number;
  };
  created_at: string; // ISO 8601 datetime
  updated_at: string; // ISO 8601 datetime
  importance: number; // 0.0 to 1.0
  tags: string[];
  status: NodeStatus;
  stop: boolean;
}

export interface Node {
  id: UUID;
  type: NodeType;
  class_type?: string; // Plugin node type (e.g., "llm_chat", "text_input")
  author: NodeAuthor;
  content: string;
  parents: UUID[];
  children: UUID[];
  groups: UUID[];
  meta: NodeMetadata;

  // Plugin node inputs, connections, and provider
  inputs?: Record<string, unknown>;
  connections?: Record<string, { source_node_id: string; output_name: string }>;
  provider_id?: string | null;

  // Feature 009: Inline LLM Response Display
  llm_response?: string | null;
  llm_operation_id?: UUID | null;
  font_size?: number; // 10-24, default 14
  node_width?: number; // 280-800, default 400
  node_height?: number; // 200-1200, default 400

  // Inline LLM workflow fields
  llm_status?: 'idle' | 'queued' | 'streaming' | 'complete' | 'error';
  llm_error?: string | null;
  prompt_height?: number;
  response_height?: number;
  note_top?: string | null;
  note_bottom?: string | null;

  // Collapse/expand functionality
  collapsed?: boolean; // If true, show only summary/title
  summary?: string | null; // Title when collapsed (max 100 chars)
}

export type GroupKind = 'project' | 'cluster' | 'subgroup' | 'generated' | 'auto';

export interface GroupMetadata {
  color?: string | null;
  pinned_nodes: UUID[];
  created_at: string; // ISO 8601 datetime
  tags: string[];
}

export interface Group {
  id: UUID;
  label: string;
  kind: GroupKind;
  parent_group?: UUID | null;
  meta: GroupMetadata;
}

export interface CommentTarget {
  node?: UUID;
  edge?: [UUID, UUID];
}

export interface Comment {
  id: UUID;
  author: NodeAuthor;
  content: string;
  attached_to: CommentTarget;
  created_at: string; // ISO 8601 datetime
}

export interface GraphMetadata {
  name: string;
  description?: string | null;
  created_at: string; // ISO 8601 datetime
  updated_at: string; // ISO 8601 datetime
  schema_version: string;
}

export interface Graph {
  id: UUID;
  version?: string; // Graph format version (default "2.0.0")
  meta: GraphMetadata;
  nodes: Record<UUID, Node>;
  groups: Record<UUID, Group>;
  comments: Record<UUID, Comment>;
  composite_definitions?: Record<string, unknown>;
}

export type TriggerReason = 'manual_edit' | 'parent_cascade' | 'user_regen' | 'rollback';

export interface NodeVersion {
  version_id: UUID;
  node_id: UUID;
  version_number: number;
  content: string;
  created_at: string; // ISO 8601 datetime
  trigger_reason: TriggerReason;
  llm_metadata?: Record<string, any> | null;
}
