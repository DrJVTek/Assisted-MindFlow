/**
 * Types for inter-LLM debate chains (Feature 011 - US2)
 */

export type DebateStatus = 'pending' | 'running' | 'completed' | 'stopped' | 'error';

export interface DebateChain {
  id: string;
  graph_id: string;
  start_node_id: string;
  node_ids: string[];
  round_count: number;
  max_rounds: number;
  status: DebateStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface StartDebateRequest {
  graph_id: string;
  start_node_id: string;
  max_rounds?: number;
}

export interface ContinueDebateRequest {
  additional_rounds?: number;
}
