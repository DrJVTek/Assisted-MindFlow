-- Migration: Add LLM Operations Table for Concurrent LLM Operations
-- Feature: 007-concurrent-llm-hierarchy
-- Date: 2025-11-21
-- Description: Creates llm_operations table to track concurrent LLM streaming operations

-- Create llm_operations table
CREATE TABLE IF NOT EXISTS llm_operations (
    -- Core identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,

    -- Operation status
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('queued', 'processing', 'streaming', 'completed', 'failed', 'cancelled')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    queue_position INTEGER,

    -- LLM configuration
    provider VARCHAR(50) NOT NULL
        CHECK (provider IN ('openai', 'anthropic', 'ollama')),
    model VARCHAR(100) NOT NULL,
    prompt TEXT NOT NULL,
    system_prompt TEXT,

    -- Content (accumulated during streaming)
    content TEXT NOT NULL DEFAULT '',
    content_length INTEGER NOT NULL DEFAULT 0,

    -- Timing
    queued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Resource tracking
    tokens_used INTEGER,
    cost DECIMAL(10, 6),  -- USD cost with 6 decimal precision

    -- Error handling
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,

    -- Metadata (provider-specific data as JSON)
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Constraints
    CONSTRAINT check_duration CHECK (
        started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at
    ),
    CONSTRAINT check_queue_position CHECK (
        queue_position IS NULL OR queue_position >= 0
    )
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_operations_status ON llm_operations(status);
CREATE INDEX IF NOT EXISTS idx_operations_user_id ON llm_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_node_id ON llm_operations(node_id);
CREATE INDEX IF NOT EXISTS idx_operations_graph_id ON llm_operations(graph_id);
CREATE INDEX IF NOT EXISTS idx_operations_queued_at ON llm_operations(queued_at DESC);

-- Partial index for queued operations (performance optimization)
CREATE INDEX IF NOT EXISTS idx_operations_status_queued ON llm_operations(status, queued_at)
    WHERE status = 'queued';

-- Partial index for active operations (processing, streaming)
CREATE INDEX IF NOT EXISTS idx_operations_active ON llm_operations(status, queued_at)
    WHERE status IN ('processing', 'streaming');

-- Comment on table
COMMENT ON TABLE llm_operations IS 'Tracks concurrent LLM streaming operations with queue management and state persistence';

-- Comments on key columns
COMMENT ON COLUMN llm_operations.status IS 'Current operation state: queued, processing, streaming, completed, failed, cancelled';
COMMENT ON COLUMN llm_operations.queue_position IS 'Position in queue (NULL when not queued)';
COMMENT ON COLUMN llm_operations.content IS 'Accumulated LLM response content (updated during streaming)';
COMMENT ON COLUMN llm_operations.metadata IS 'Provider-specific metadata as JSONB for extensibility';

-- Create rollback script
-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_operations_active;
-- DROP INDEX IF EXISTS idx_operations_status_queued;
-- DROP INDEX IF EXISTS idx_operations_queued_at;
-- DROP INDEX IF EXISTS idx_operations_graph_id;
-- DROP INDEX IF EXISTS idx_operations_node_id;
-- DROP INDEX IF EXISTS idx_operations_user_id;
-- DROP INDEX IF EXISTS idx_operations_status;
-- DROP TABLE IF EXISTS llm_operations;
