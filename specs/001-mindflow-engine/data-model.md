# Data Model: MindFlow Engine

**Date**: 2025-11-17
**Feature**: MindFlow Engine (Speckit)
**Branch**: 001-mindflow-engine

## Overview

This document defines the core data model for the MindFlow Engine, including entities, relationships, validation rules, and state transitions.

---

## Core Entities

### 1. Node

Represents a discrete unit of thought/reasoning in the graph.

**Fields**:
```python
from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime
from uuid import UUID, uuid4

NodeType = Literal[
    "question", "answer", "note", "hypothesis",
    "evaluation", "summary", "plan", "group_meta",
    "comment", "stop"
]

NodeAuthor = Literal["human", "llm", "tool"]

NodeStatus = Literal["draft", "valid", "invalid", "final", "experimental"]

class NodeMetadata(BaseModel):
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    tags: list[str] = Field(default_factory=list)
    status: NodeStatus = "draft"
    stop: bool = False  # Marks node as exit/output point

class Node(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    type: NodeType
    author: NodeAuthor
    content: str = Field(min_length=1, max_length=10000)
    parents: list[UUID] = Field(default_factory=list)
    children: list[UUID] = Field(default_factory=list)
    groups: list[UUID] = Field(default_factory=list)
    meta: NodeMetadata = Field(default_factory=NodeMetadata)

    def update_timestamp(self):
        """Update modified timestamp on content change."""
        self.meta.updated_at = datetime.utcnow()
```

**Validation Rules**:
- `id`: Must be unique UUID across all nodes
- `content`: Non-empty string, max 10k characters
- `parents` / `children`: Must reference existing node IDs
- `groups`: Must reference existing group IDs
- `meta.importance`: Float between 0.0 and 1.0
- `meta.stop`: If true, node marks end of reasoning path

**Relationships**:
- **Parent-Child**: Directed edge representing logical flow
- **Group Membership**: Many-to-many with Groups
- **Comments**: One-to-many with Comments (via attachedTo)

**Invariants**:
1. If node A is in node B's `parents`, then B must be in A's `children` (bidirectional consistency)
2. No node can be its own ancestor (acyclic graph constraint)
3. Stop nodes typically have no children (exit points)

---

### 2. Group

Hierarchical container for organizing related nodes.

**Fields**:
```python
from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime
from uuid import UUID, uuid4

GroupKind = Literal["project", "cluster", "subgroup", "generated", "auto"]

class GroupMetadata(BaseModel):
    color: Optional[str] = None  # Hex color for UI (e.g., "#FF5733")
    pinned_nodes: list[UUID] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    tags: list[str] = Field(default_factory=list)

class Group(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    label: str = Field(min_length=1, max_length=100)
    kind: GroupKind
    parent_group: Optional[UUID] = None
    meta: GroupMetadata = Field(default_factory=GroupMetadata)
```

**Validation Rules**:
- `id`: Must be unique UUID across all groups
- `label`: Non-empty string, max 100 characters
- `kind`: One of the defined group types
- `parent_group`: If set, must reference existing group ID (no self-reference, no cycles)

**Relationships**:
- **Parent-Child Groups**: Tree structure (each group has at most one parent)
- **Node Membership**: Many-to-many with Nodes

**Invariants**:
1. Group hierarchy must be acyclic (no group can be its own ancestor)
2. Projects (`kind="project"`) should be root-level (parent_group=None)
3. Auto-generated groups (`kind="generated"` or `"auto"`) created by orchestration only

**Special Cases**:
- **Project**: Root container, reusable as subgraph in other projects
- **Cluster**: User-defined thematic grouping
- **Generated/Auto**: Created automatically by orchestration

---

### 3. Comment

Non-invasive annotation attached to nodes or edges.

**Fields**:
```python
from pydantic import BaseModel, Field
from typing import Union
from datetime import datetime
from uuid import UUID, uuid4

CommentTarget = dict[str, Union[UUID, tuple[UUID, UUID]]]
# Example: {"node_id": UUID} or {"edge": (parent_uuid, child_uuid)}

class Comment(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    author: NodeAuthor  # Reuse same author types as Node
    content: str = Field(min_length=1, max_length=5000)
    attached_to: CommentTarget
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

**Validation Rules**:
- `id`: Must be unique UUID across all comments
- `content`: Non-empty string, max 5k characters
- `attached_to`: Must contain either `node_id` (UUID) or `edge` (tuple of 2 UUIDs)
- Both node IDs in edge tuple must exist

**Relationships**:
- Attached to Node: One-to-many (many comments per node)
- Attached to Edge: One-to-many (many comments per relationship)

**Use Cases**:
- User feedback on node content
- AI-generated suggestions
- Collaborative annotations (future)

---

### 4. Graph (Container)

Top-level container holding all nodes, groups, comments, and metadata.

**Fields**:
```python
from pydantic import BaseModel, Field
from typing import Dict
from datetime import datetime
from uuid import UUID, uuid4

class GraphMetadata(BaseModel):
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    schema_version: str = "1.0.0"

class Graph(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    meta: GraphMetadata
    nodes: Dict[UUID, Node] = Field(default_factory=dict)
    groups: Dict[UUID, Group] = Field(default_factory=dict)
    comments: Dict[UUID, Comment] = Field(default_factory=dict)

    def to_json(self) -> str:
        """Serialize graph to JSON for storage."""
        return self.model_dump_json(indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> "Graph":
        """Deserialize graph from JSON."""
        return cls.model_validate_json(json_str)
```

**Validation Rules**:
- All node parent/child references must point to existing nodes
- All group parent references must point to existing groups
- All comment attachments must reference existing nodes/edges
- No orphaned references after node/group deletion

**Persistence**:
- Single JSON file per graph
- Human-readable format
- Atomic writes (write to temp, then rename)
- Backup before modification

---

## Graph Operations

### Operation Types

All graph modifications happen through explicit operations:

```python
from pydantic import BaseModel
from typing import Literal, Optional, Any

OpType = Literal[
    "CREATE_NODE", "UPDATE_NODE", "DELETE_NODE", "LINK",
    "CREATE_GROUP", "ADD_NODE_TO_GROUP", "REMOVE_NODE_FROM_GROUP",
    "MERGE_GROUPS", "MERGE_NODES", "FORK_FROM", "SET_STOP",
    "RECABLE_NODE", "ADD_COMMENT"
]

class GraphOperation(BaseModel):
    op: OpType
    params: dict[str, Any]

class GraphOperationResult(BaseModel):
    success: bool
    message: str
    created_ids: Optional[list[UUID]] = None  # For CREATE operations
    modified_ids: Optional[list[UUID]] = None
```

---

### CREATE_NODE

**Parameters**:
```python
{
    "type": "question",  # NodeType
    "content": "How do we solve X?",
    "parents": ["uuid-1", "uuid-2"],  # Optional, list of parent UUIDs
    "groups": ["uuid-3"],  # Optional, list of group UUIDs
    "meta": {  # Optional
        "importance": 0.8,
        "tags": ["important", "research"]
    }
}
```

**Validation**:
- All parent IDs must exist
- All group IDs must exist
- Adding edges to parents must not create cycles

**Result**:
```python
{
    "success": true,
    "message": "Node created successfully",
    "created_ids": ["new-uuid"],
    "modified_ids": ["uuid-1", "uuid-2"]  # Parents updated with new child
}
```

---

### UPDATE_NODE

**Parameters**:
```python
{
    "id": "uuid-1",
    "content": "Updated question text",  # Optional
    "meta": {  # Optional
        "importance": 0.9,
        "status": "valid"
    }
}
```

**Validation**:
- Node ID must exist
- If updating meta.stop, validate no children exist (optional strict mode)

**Result**:
```python
{
    "success": true,
    "message": "Node updated",
    "modified_ids": ["uuid-1"]
}
```

---

### LINK

**Parameters**:
```python
{
    "parent_id": "uuid-1",
    "child_id": "uuid-2"
}
```

**Validation**:
- Both IDs must exist
- Must not create cycle
- Link must not already exist

**Result**:
```python
{
    "success": true,
    "message": "Nodes linked",
    "modified_ids": ["uuid-1", "uuid-2"]
}
```

---

### MERGE_NODES

**Parameters**:
```python
{
    "node_ids": ["uuid-1", "uuid-2", "uuid-3"],
    "objective": "Consolidate hypotheses",  # Human-readable goal
    "output_type": "summary"  # NodeType for synthesis node
}
```

**Validation**:
- All node IDs must exist
- At least 2 nodes required

**Behavior**:
- Creates new synthesis node
- Links synthesis node to all input nodes as children
- Original nodes remain in graph
- If AI synthesis requested, populate content via LLM

**Result**:
```python
{
    "success": true,
    "message": "Nodes merged into synthesis",
    "created_ids": ["synthesis-uuid"],
    "modified_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

---

### SET_STOP

**Parameters**:
```python
{
    "node_id": "uuid-1"
}
```

**Validation**:
- Node must exist
- Warning if node has children (stop nodes typically shouldn't)

**Result**:
```python
{
    "success": true,
    "message": "Node marked as stop",
    "modified_ids": ["uuid-1"]
}
```

---

### RECABLE_NODE

**Parameters**:
```python
{
    "node_id": "uuid-child",
    "new_parents": ["uuid-parent-1", "uuid-parent-2"]
}
```

**Validation**:
- Node and all new parents must exist
- New connections must not create cycles
- Removes all old parent links

**Result**:
```python
{
    "success": true,
    "message": "Node recabled",
    "modified_ids": ["uuid-child", "uuid-old-parent", "uuid-parent-1", "uuid-parent-2"]
}
```

---

## Context Selection Models

### Context Strategy

```python
from pydantic import BaseModel
from typing import Literal

ContextStrategy = Literal[
    "Timeline",  # Chronological order
    "GraphNeighborhood",  # Parents, children, siblings
    "GroupContext",  # All nodes in group
    "ManualOverride"  # User-specified nodes
]

SummaryType = Literal[
    "GlobalSummary",  # All nodes
    "TemporalSummary",  # Recent nodes prioritized
    "WeightedSummary",  # By importance
    "GroupSummary",  # Group-level summary
    "PathSummary",  # Root to current node
    "HybridSummary"  # Optimized mix
]

class ContextRequest(BaseModel):
    focus_node_id: Optional[UUID] = None
    strategy: ContextStrategy = "GraphNeighborhood"
    summary_type: SummaryType = "HybridSummary"
    max_tokens: int = 8000

class ContextResult(BaseModel):
    selected_nodes: list[UUID]
    summarized: bool
    token_count: int
    context_text: str
```

---

## LLM Provider Models

### Provider Configuration

```python
from pydantic import BaseModel, SecretStr
from typing import Optional, Dict, Any

class LLMProviderConfig(BaseModel):
    provider_id: str
    name: str
    api_key_env: Optional[str] = None  # Environment variable name
    endpoint: Optional[str] = None  # For custom/local providers
    model: str
    max_tokens: int = 4096
    temperature: float = 0.7
    timeout: int = 30  # seconds
    retries: int = 3

class LLMCapabilities(BaseModel):
    supports_json_mode: bool = False
    supports_function_calling: bool = False
    max_context_tokens: int = 8000
    embedding_dimensions: Optional[int] = None
```

### Generation Request/Response

```python
class GenerationRequest(BaseModel):
    prompt: str
    context: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

class GenerationResponse(BaseModel):
    reply: str  # Human-readable text
    graph_actions: list[GraphOperation] = Field(default_factory=list)
    token_usage: Optional[Dict[str, int]] = None  # prompt, completion, total
```

---

## State Transitions

### Node Status Flow

```
draft → valid/invalid
draft → experimental
valid → final
invalid → draft (after revision)
experimental → valid/invalid
```

**Rules**:
- Nodes start as `draft` by default
- Orchestration marks evaluation nodes as `valid` or `invalid`
- Users can mark nodes as `final` (accepted conclusions)
- `experimental` used for speculative AI-generated content

### Orchestration States

```python
from enum import Enum

class OrchestrationState(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"

class OrchestrationConfig(BaseModel):
    group_id: UUID
    mode: Literal["BreadthFirst", "DepthFirst", "Heuristic", "Temporal"]
    max_nodes_per_pass: int = 10
    max_depth: int = 5
    time_budget_seconds: int = 300
    min_confidence: float = 0.6

class OrchestrationStatus(BaseModel):
    state: OrchestrationState
    nodes_generated: int
    current_depth: int
    elapsed_time: float
```

---

## Persistence Format

### File Structure

```
data/graphs/
├── project-001.json      # Single graph file
├── project-002.json
└── backups/
    ├── project-001_2025-11-17T10-30-00.json
    └── project-002_2025-11-17T11-00-00.json
```

### Graph JSON Format

```json
{
  "id": "uuid-graph",
  "meta": {
    "name": "Market Analysis",
    "description": "Reasoning about market opportunities",
    "created_at": "2025-11-17T10:00:00Z",
    "updated_at": "2025-11-17T12:30:00Z",
    "schema_version": "1.0.0"
  },
  "nodes": {
    "uuid-1": {
      "id": "uuid-1",
      "type": "question",
      "author": "human",
      "content": "What are the key market trends?",
      "parents": [],
      "children": ["uuid-2", "uuid-3"],
      "groups": ["uuid-group-1"],
      "meta": {
        "created_at": "2025-11-17T10:00:00Z",
        "updated_at": "2025-11-17T10:00:00Z",
        "importance": 0.9,
        "tags": ["research", "priority"],
        "status": "valid",
        "stop": false
      }
    }
  },
  "groups": {
    "uuid-group-1": {
      "id": "uuid-group-1",
      "label": "Market Research",
      "kind": "project",
      "parent_group": null,
      "meta": {
        "color": "#FF5733",
        "pinned_nodes": ["uuid-1"],
        "created_at": "2025-11-17T10:00:00Z",
        "tags": ["strategic"]
      }
    }
  },
  "comments": {
    "uuid-comment-1": {
      "id": "uuid-comment-1",
      "author": "human",
      "content": "Need more data on this",
      "attached_to": {"node_id": "uuid-1"},
      "created_at": "2025-11-17T11:00:00Z"
    }
  }
}
```

---

## Indexing & Query Optimization

For large graphs (100+ nodes), consider in-memory indexes:

```python
class GraphIndexes:
    """Cached indexes for fast queries."""
    nodes_by_type: Dict[NodeType, set[UUID]]
    nodes_by_author: Dict[NodeAuthor, set[UUID]]
    nodes_by_group: Dict[UUID, set[UUID]]
    nodes_by_tag: Dict[str, set[UUID]]

    def rebuild(self, graph: Graph):
        """Rebuild all indexes from graph."""
        # Populate indexes from graph.nodes
        ...
```

**Invalidation**: Rebuild indexes after graph modifications.

---

**Data Model Complete**: Ready for contract generation and implementation.
