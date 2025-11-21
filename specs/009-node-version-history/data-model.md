# Data Model: Node Version History with Temporal Timeline UI

**Feature**: Node Version History with Temporal Timeline UI (Spatio-Temporal System)
**Branch**: `009-node-version-history`
**Date**: 2025-11-21

## Overview

This document defines the data models and relationships required to support complete version history tracking for nodes, parent impact tracking through child change markers, and temporal timeline visualization. The system transforms MindFlow from spatial (node hierarchy) to spatio-temporal (node hierarchy + time dimension).

---

## Core Entities

### 1. NodeVersion (Backend & Frontend)

Represents an immutable snapshot of node content at a specific point in time.

#### TypeScript Schema (Frontend)

```typescript
export interface NodeVersion {
    // Core identification
    version_id: string;                 // UUID of the version
    node_id: string;                    // UUID of the parent node
    version_number: number;             // Sequential: 1, 2, 3, ...

    // Content snapshot
    content: string;                    // Full content at this point in time
    word_count: number;                 // Cached for performance
    char_count: number;                 // Cached for performance

    // Metadata
    created_at: Date;                   // When version was created
    trigger_reason: TriggerReason;      // Why version was created
    author: Author;                     // Who/what created it

    // Optional metadata (for specific triggers)
    llm_metadata?: LLMMetadata;         // Present if trigger_reason = 'user_regen'
    cascade_metadata?: CascadeMetadata; // Present if trigger_reason = 'parent_cascade'
    parent_version_id?: string;         // For rollback chains
}

export enum TriggerReason {
    MANUAL_EDIT = 'manual_edit',           // User typed content
    USER_REGEN = 'user_regen',             // LLM generated content
    PARENT_CASCADE = 'parent_cascade',     // Parent regenerated due to child changes
    ROLLBACK = 'rollback',                 // User restored previous version
    MANUAL_SAVE = 'manual_save'            // User clicked "Save version" button
}

export enum Author {
    HUMAN = 'human',
    LLM = 'LLM'
}

export interface LLMMetadata {
    provider: string;                    // 'openai', 'anthropic', 'ollama'
    model: string;                       // e.g., 'gpt-4-turbo'
    tokens: number;                      // Token count
    generation_time_ms: number;          // How long generation took
    prompt_used: string;                 // User prompt (first 500 chars)
}

export interface CascadeMetadata {
    triggering_child_versions: string[]; // List of child version IDs that triggered regeneration
    cascade_depth: number;               // 1 = direct child, 2 = grandchild, etc.
    cascade_timestamp: Date;             // When cascade was initiated
}
```

#### Python Schema (Backend)

```python
from enum import Enum
from datetime import datetime
from uuid import UUID, uuid4
from pydantic import BaseModel, Field
from typing import Optional, List

class TriggerReason(str, Enum):
    MANUAL_EDIT = "manual_edit"
    USER_REGEN = "user_regen"
    PARENT_CASCADE = "parent_cascade"
    ROLLBACK = "rollback"
    MANUAL_SAVE = "manual_save"

class Author(str, Enum):
    HUMAN = "human"
    LLM = "LLM"

class LLMMetadata(BaseModel):
    provider: str
    model: str
    tokens: int
    generation_time_ms: int
    prompt_used: str = Field(max_length=500)

class CascadeMetadata(BaseModel):
    triggering_child_versions: List[UUID]
    cascade_depth: int
    cascade_timestamp: datetime

class NodeVersion(BaseModel):
    # Core identification
    version_id: UUID = Field(default_factory=uuid4)
    node_id: UUID
    version_number: int = Field(ge=1)

    # Content snapshot
    content: str = Field(max_length=10000)
    word_count: int = Field(ge=0)
    char_count: int = Field(ge=0)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    trigger_reason: TriggerReason
    author: Author

    # Optional metadata
    llm_metadata: Optional[LLMMetadata] = None
    cascade_metadata: Optional[CascadeMetadata] = None
    parent_version_id: Optional[UUID] = None  # For rollback chains
```

#### Database Schema (PostgreSQL)

```sql
CREATE TABLE node_versions (
    -- Core identification
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number > 0),

    -- Content snapshot
    content TEXT NOT NULL CHECK (LENGTH(content) <= 10000),
    word_count INTEGER NOT NULL DEFAULT 0 CHECK (word_count >= 0),
    char_count INTEGER NOT NULL DEFAULT 0 CHECK (char_count >= 0),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    trigger_reason VARCHAR(50) NOT NULL
        CHECK (trigger_reason IN ('manual_edit', 'user_regen', 'parent_cascade', 'rollback', 'manual_save')),
    author VARCHAR(10) NOT NULL CHECK (author IN ('human', 'LLM')),

    -- Optional metadata (stored as JSONB)
    llm_metadata JSONB,
    cascade_metadata JSONB,
    parent_version_id UUID REFERENCES node_versions(version_id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT unique_node_version UNIQUE (node_id, version_number),
    CONSTRAINT check_llm_metadata CHECK (
        (trigger_reason = 'user_regen' AND llm_metadata IS NOT NULL) OR
        (trigger_reason != 'user_regen')
    ),
    CONSTRAINT check_cascade_metadata CHECK (
        (trigger_reason = 'parent_cascade' AND cascade_metadata IS NOT NULL) OR
        (trigger_reason != 'parent_cascade')
    )
);

-- Indexes for performance
CREATE INDEX idx_versions_node_id ON node_versions(node_id, version_number DESC);
CREATE INDEX idx_versions_created_at ON node_versions(created_at DESC);
CREATE INDEX idx_versions_trigger ON node_versions(trigger_reason, created_at DESC);

-- Partial index for recent versions (hot data)
CREATE INDEX idx_versions_node_recent ON node_versions(node_id, created_at DESC)
    WHERE created_at > NOW() - INTERVAL '30 days';
```

**Validation Rules:**
- `version_number` must be sequential (1, 2, 3, ...) per node
- `content` max 10,000 characters (enforced at application layer)
- `llm_metadata` required if `trigger_reason` = 'user_regen'
- `cascade_metadata` required if `trigger_reason` = 'parent_cascade'
- `created_at` must be chronological (later versions have later timestamps)
- `parent_version_id` creates rollback chain (version 5 rolled back to version 2, version 6 is the restored version pointing to version 2)

---

### 2. ChildChangeMarker (Backend)

Represents a historical marker in a parent node's timeline indicating that a child node was modified.

#### Python Schema

```python
class MarkerType(str, Enum):
    DIRECT_CHILD_CHANGE = "direct_child_change"
    TRANSITIVE_CHILD_CHANGE = "transitive_child_change"

class ChildChangeMarker(BaseModel):
    # Core identification
    marker_id: UUID = Field(default_factory=uuid4)
    parent_node_id: UUID
    child_node_id: UUID
    child_version_id: UUID

    # Marker details
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    marker_type: MarkerType
    cascade_depth: int = Field(ge=1)  # 1 = direct child, 2 = grandchild, etc.

    # Preview data (cached for performance)
    child_node_title: str = Field(max_length=100)
    child_content_preview: str = Field(max_length=200)  # First 200 chars of child version
```

#### Database Schema (PostgreSQL)

```sql
CREATE TABLE child_change_markers (
    -- Core identification
    marker_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    child_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    child_version_id UUID NOT NULL REFERENCES node_versions(version_id) ON DELETE CASCADE,

    -- Marker details
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    marker_type VARCHAR(50) NOT NULL
        CHECK (marker_type IN ('direct_child_change', 'transitive_child_change')),
    cascade_depth INTEGER NOT NULL CHECK (cascade_depth > 0),

    -- Cached preview data
    child_node_title VARCHAR(100) NOT NULL,
    child_content_preview VARCHAR(200) NOT NULL
);

-- Indexes for parent timeline queries
CREATE INDEX idx_child_markers_parent ON child_change_markers(parent_node_id, timestamp DESC);
CREATE INDEX idx_child_markers_child ON child_change_markers(child_node_id, timestamp DESC);
```

**Validation Rules:**
- `cascade_depth` = 1 for direct child, 2 for grandchild, etc.
- `marker_type` = 'direct_child_change' if depth = 1
- `marker_type` = 'transitive_child_change' if depth > 1
- Multiple markers can exist for same child (child can change multiple times)

---

### 3. VersionDiff (Computed, Not Stored)

Represents the difference between two versions, computed on-demand using Myers diff algorithm.

#### TypeScript Schema

```typescript
export interface VersionDiff {
    // Version references
    old_version_id: string;
    new_version_id: string;

    // Diff results
    changes: DiffChange[];

    // Summary statistics
    word_count_delta: number;           // +150, -30, etc.
    char_count_delta: number;
    additions_count: number;            // Number of added words
    deletions_count: number;            // Number of deleted words
    modifications_count: number;        // Number of modified words

    // Metadata
    computed_at: Date;
    computation_time_ms: number;
}

export interface DiffChange {
    type: ChangeType;
    text?: string;                      // For additions/deletions
    old_text?: string;                  // For modifications
    new_text?: string;                  // For modifications
    start_pos: number;                  // Character position in document
    end_pos: number;
}

export enum ChangeType {
    ADDITION = 'addition',              // Text added
    DELETION = 'deletion',              // Text deleted
    MODIFICATION = 'modification',      // Text changed
    UNCHANGED = 'unchanged',            // Text same (for context)
    COLLAPSED_UNCHANGED = 'collapsed_unchanged'  // Large unchanged section collapsed
}
```

#### Python Schema

```python
class ChangeType(str, Enum):
    ADDITION = "addition"
    DELETION = "deletion"
    MODIFICATION = "modification"
    UNCHANGED = "unchanged"
    COLLAPSED_UNCHANGED = "collapsed_unchanged"

class DiffChange(BaseModel):
    type: ChangeType
    text: Optional[str] = None
    old_text: Optional[str] = None
    new_text: Optional[str] = None
    start_pos: int
    end_pos: int

class VersionDiff(BaseModel):
    # Version references
    old_version_id: UUID
    new_version_id: UUID

    # Diff results
    changes: List[DiffChange]

    # Summary statistics
    word_count_delta: int
    char_count_delta: int
    additions_count: int
    deletions_count: int
    modifications_count: int

    # Metadata
    computed_at: datetime = Field(default_factory=datetime.utcnow)
    computation_time_ms: int
```

**Not stored in database** - computed on-demand when user clicks "Compare versions"

---

### 4. TimelineEvent (Backend & Frontend)

Unified event type for global timeline view, aggregating NodeVersions and ChildChangeMarkers.

#### TypeScript Schema

```typescript
export interface TimelineEvent {
    // Core identification
    event_id: string;                   // UUID or derived from version/marker ID
    event_type: EventType;

    // Node references
    node_id: string;
    node_title: string;                 // Cached for performance

    // Timing
    timestamp: Date;

    // Event details
    author: Author;
    trigger_reason?: TriggerReason;     // For version events

    // Preview data
    content_preview: string;            // First 100 chars

    // Metadata
    metadata: Record<string, any>;      // Flexible for different event types
}

export enum EventType {
    VERSION_CREATED = 'version_created',
    CHILD_CHANGED = 'child_changed',
    CASCADE_TRIGGERED = 'cascade_triggered'
}
```

#### Python Schema

```python
class EventType(str, Enum):
    VERSION_CREATED = "version_created"
    CHILD_CHANGED = "child_changed"
    CASCADE_TRIGGERED = "cascade_triggered"

class TimelineEvent(BaseModel):
    # Core identification
    event_id: UUID
    event_type: EventType

    # Node references
    node_id: UUID
    node_title: str = Field(max_length=100)

    # Timing
    timestamp: datetime

    # Event details
    author: Author
    trigger_reason: Optional[TriggerReason] = None

    # Preview data
    content_preview: str = Field(max_length=100)

    # Metadata
    metadata: dict = Field(default_factory=dict)
```

**Generated dynamically** by querying node_versions and child_change_markers tables

---

### 5. VersionArchive (Backend)

Stores compressed versions older than 30 days (file-based storage).

#### Python Schema

```python
class VersionArchive(BaseModel):
    # Archive metadata
    node_id: UUID
    archive_path: str                   # File path: data/versions/{node_id}/archive.json.gz
    archived_at: datetime
    archive_reason: str                 # 'age_threshold', 'count_limit'

    # Archive contents (not in database, in file)
    version_count: int
    total_size_bytes: int
    oldest_version_date: datetime
    newest_version_date: datetime
```

**File Structure:**
```json
// data/versions/{node_id}/archive.json.gz (compressed)
{
  "node_id": "uuid",
  "archived_at": "2025-11-21T10:30:00Z",
  "versions": [
    {
      "version_id": "uuid",
      "version_number": 1,
      "content": "...",
      "created_at": "2025-01-01T10:00:00Z",
      "trigger_reason": "manual_edit",
      "author": "human"
    },
    // ... more versions
  ]
}
```

---

## Relationships

### Entity Relationship Diagram

```
┌──────────────┐
│     Node     │
└──────┬───────┘
       │ 1:N
       │
       ↓
┌──────────────┐      1:0..1       ┌────────────────────┐
│ NodeVersion  │ ←───────────────  │ NodeVersion (prev) │
│              │                    │ (rollback chain)   │
└──────┬───────┘                    └────────────────────┘
       │ N:1
       │
       ↓
┌──────────────────┐
│ ChildChangeMarker│ ──→ references child_version_id
└──────┬───────────┘
       │ N:1
       │
       ↓
┌──────────────┐
│ Parent Node  │
└──────────────┘

TimelineEvent (derived)
       ↓
   Aggregates:
   - NodeVersions (all nodes)
   - ChildChangeMarkers (all parents)
```

### Relationship Details

**Node → NodeVersion (1:N)**
- One node has many versions
- Versions deleted when node deleted (CASCADE)
- Ordered by version_number (sequential)

**NodeVersion → NodeVersion (0..1) - Rollback Chain**
- Version can reference a previous version (parent_version_id)
- Forms chain: v5 rolled back to v2, v6 created pointing to v2
- Used to track version lineage

**ChildChangeMarker → NodeVersion (N:1)**
- Marker references specific child version that triggered it
- Multiple markers can reference same version (multiple parents)

**ChildChangeMarker → Node (N:1, twice)**
- Marker references parent node (where marker is displayed)
- Marker references child node (source of change)

**TimelineEvent → (NodeVersion + ChildChangeMarker)**
- Dynamically generated view
- Aggregates both version events and child change events
- Sorted by timestamp for chronological display

---

## Data Persistence

### Storage Layers

**PostgreSQL (Durable State)**
- node_versions table (recent versions, <30 days)
- child_change_markers table (all markers)
- Query patterns: filter by node, date range, trigger reason
- Retention: Recent versions permanent, old versions archived

**File System (Compressed Archive)**
- data/versions/{node_id}/archive.json.gz (old versions, >30 days)
- gzip compression (90% size reduction)
- Loaded on-demand with "Load archived versions" button
- Pattern: One archive file per node

**Frontend (Transient State)**
- Zustand store for active timeline state
- LRU cache for recently viewed versions (100 versions max)
- No persistence across browser refresh (reload from backend)

### Data Flow

```
User Edit
    ↓
Frontend (debounce 3s)
    ↓
POST /api/nodes/{id}/versions → PostgreSQL (node_versions)
    ↓
If child node → Create ChildChangeMarker for parent
    ↓
Frontend polls GET /api/nodes/{id}/versions → Display timeline
```

---

## Validation Rules Summary

### Cross-Entity Validations

1. **Version Number Sequence:**
   - Version numbers must be sequential per node (no gaps)
   - Enforced by application logic (not database constraint)

2. **Trigger Reason Consistency:**
   - 'user_regen' must have llm_metadata
   - 'parent_cascade' must have cascade_metadata
   - 'rollback' must have parent_version_id

3. **Child Marker Validity:**
   - parent_node_id and child_node_id must be connected by edge in graph
   - child_version_id must belong to child_node_id

4. **Archive Consistency:**
   - Archived versions removed from database
   - Archive file must exist and be valid gzip JSON

5. **Cascade Depth:**
   - cascade_depth = 1 for direct child
   - cascade_depth > 1 for transitive (grandchild, etc.)
   - Maximum depth = 5 (prevent infinite loops)

---

## Performance Considerations

### Index Strategy

**PostgreSQL Indexes:**
- `idx_versions_node_id`: Fast lookup of all versions for a node
- `idx_versions_node_recent`: Partial index for hot data (<30 days)
- `idx_versions_created_at`: Time-based queries for global timeline
- `idx_child_markers_parent`: Parent timeline with child markers
- `idx_versions_trigger`: Filter by trigger reason (e.g., all LLM operations)

**Query Performance:**
- Load 100 versions for node: <50ms (indexed query)
- Global timeline (50k events): <2s (with aggregation)
- Compute diff (1000 words): <100ms (Myers algorithm)
- Compute diff (10,000 words): <1s (background worker)

### Memory Estimates

**Per NodeVersion:**
- Database row: ~1.5KB (content + metadata)
- Frontend object: ~2KB (parsed JSON)

**Per ChildChangeMarker:**
- Database row: ~500 bytes (minimal data)
- Frontend object: ~1KB

**100 versions + 20 markers:**
- Database: ~160KB
- Frontend: ~220KB (acceptable for single node)

**50,000 total versions:**
- Database: ~80MB (before archiving)
- Database after archiving (30 days): ~10MB (recent only)
- Archive files: ~70MB compressed (~700MB uncompressed, 90% compression ratio)

---

## Migration Strategy

### Schema Evolution

**Version 1.0 (Initial):**
- Basic version tracking
- Simple diff computation
- Per-node timeline only

**Version 1.1 (Future):**
- Add `version_tags` table (user-defined tags: "Milestone", "Final Draft")
- Add `version_comments` table (user annotations on versions)
- Add `version_branches` table (Git-like branching)

**Migration Path:**
```sql
-- Example migration (Version 1.0 → 1.1)
CREATE TABLE version_tags (
    tag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES node_versions(version_id) ON DELETE CASCADE,
    tag_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_version_tags ON version_tags(version_id);
```

---

## Security Considerations

### Data Sanitization

**Sensitive Fields:**
- `NodeVersion.content` may contain sensitive user data
- `LLMMetadata.prompt_used` may contain sensitive context
- Never log full content in server logs (truncate to 100 chars)

**Access Control:**
- Users can only access versions of their own graphs
- Graph-level permissions apply to all versions
- No cross-user version queries

**Audit Trail:**
- All version creations logged with user_id
- Rollbacks logged with reason and timestamp
- Child markers logged with triggering user

---

## API Data Transfer Objects (DTOs)

### CreateVersionRequest

```typescript
export interface CreateVersionRequest {
    node_id: string;
    content: string;
    trigger_reason: TriggerReason;
    llm_metadata?: LLMMetadata;
    cascade_metadata?: CascadeMetadata;
    bypass_throttle?: boolean;          // Force immediate version creation
}
```

### VersionListResponse

```typescript
export interface VersionListResponse {
    versions: NodeVersion[];
    total_count: number;
    has_archived: boolean;              // True if archived versions exist
    oldest_version_date: Date;
    newest_version_date: Date;
}
```

### DiffRequest

```typescript
export interface DiffRequest {
    version_a_id: string;
    version_b_id: string;
}
```

### DiffResponse

```typescript
export interface DiffResponse {
    diff: VersionDiff;
    version_a: NodeVersion;             // Full version objects for context
    version_b: NodeVersion;
}
```

### TimelineEventsRequest

```typescript
export interface TimelineEventsRequest {
    graph_id: string;
    start_date?: Date;
    end_date?: Date;
    event_types?: EventType[];
    node_ids?: string[];
    limit?: number;                     // Pagination
    offset?: number;
}
```

### TimelineEventsResponse

```typescript
export interface TimelineEventsResponse {
    events: TimelineEvent[];
    total_count: number;
    aggregated: boolean;                // True if events were clustered
    cluster_window_ms?: number;         // Aggregation window if clustered
}
```

---

## Conclusion

This data model supports:
- ✅ Immutable version history for every node
- ✅ Parent impact tracking through child change markers
- ✅ Efficient storage with PostgreSQL + file archives
- ✅ Fast queries with strategic indexing
- ✅ Diff computation on-demand (not stored)
- ✅ Global timeline aggregation for 50k+ events
- ✅ Rollback chains for version lineage
- ✅ Scalable architecture (handles 500 nodes × 100 versions)

All entities designed for performance, maintainability, and spatio-temporal analysis.
