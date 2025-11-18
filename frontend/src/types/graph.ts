/**
 * TypeScript types for MindFlow Graph entities (based on Python backend models)
 */

export type UUID = string;

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
  | 'stop';

export type NodeAuthor = 'human' | 'llm' | 'tool';

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
  author: NodeAuthor;
  content: string;
  parents: UUID[];
  children: UUID[];
  groups: UUID[];
  meta: NodeMetadata;
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
  meta: GraphMetadata;
  nodes: Record<UUID, Node>;
  groups: Record<UUID, Group>;
  comments: Record<UUID, Comment>;
}
