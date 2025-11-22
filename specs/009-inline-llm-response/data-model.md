# Data Model: Inline LLM Response Display

## Overview

This feature extends the existing Node entity with LLM response storage and rendering metadata. No new entities are created - we augment the existing graph node model.

## Entity: Node (Extended)

**Purpose**: Represents a reasoning node in the graph with integrated LLM question-response capability.

### Schema Extension

**New Fields**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `llm_response` | `string` | No | LLM-generated markdown response | Max 100k characters |
| `llm_operation_id` | `UUID \| null` | No | Active LLM operation ID (null when complete) | Valid UUID or null |
| `font_size` | `number` | No | Font size in pixels for node content | Range: 10-24, default: 14 |
| `node_width` | `number` | No | Node width in pixels | Range: 280-800, default: 400 |
| `node_height` | `number` | No | Node height in pixels | Range: 200-1200, default: 400 |

**Existing Fields** (no changes):
- `id`: UUID
- `type`: string (e.g., "custom", "group", "comment")
- `content`: string (question text)
- `importance`: number
- `tags`: string[]
- `status`: string
- `created_at`: timestamp
- `updated_at`: timestamp
- `meta`: object (existing metadata)

### State Transitions

```
[Node Created]
    ↓
[Auto-launch Triggered] → llm_operation_id = <uuid>
    ↓
[Streaming] → llm_response += tokens (incremental)
    ↓
[Complete/Error] → llm_operation_id = null
    ↓
[Manual Regeneration] → llm_operation_id = <new_uuid> (loop back to Streaming)
```

### Validation Rules

1. **llm_response**:
   - If present, must be valid UTF-8 string
   - Maximum length: 100,000 characters
   - Stored as markdown plain text (no HTML)
   - Empty string vs null: Use null for "no response yet", empty string for "empty response returned"

2. **llm_operation_id**:
   - Must be valid UUID when set
   - Must be null when no operation is active
   - References operation in `llm_operations` store (frontend-only, not persisted)

3. **font_size**:
   - Integer only
   - Range: 10-24 pixels
   - Default: 14 pixels
   - Affects both question and response text

4. **node_width / node_height**:
   - Integer only
   - Width range: 280-800 pixels (min allows readable text + scrollbar)
   - Height range: 200-1200 pixels (min shows question + some response)
   - Default: 400x400 pixels
   - Enforced by React Flow NodeResizer `minWidth/maxWidth` props

### Relationships

**No new relationships**. Node continues to participate in existing graph relationships:
- `parent_ids`: Links to parent nodes
- `child_ids`: Links to child nodes
- `group_id`: Optional group membership

### Persistence

**Backend (Python/Pydantic)**:

```python
# models/graph.py
from pydantic import BaseModel, Field
from typing import Optional

class Node(BaseModel):
    id: str
    type: str
    content: str
    importance: int
    tags: list[str]
    status: str
    created_at: str
    updated_at: str
    meta: dict

    # NEW FIELDS
    llm_response: Optional[str] = Field(None, max_length=100000)
    llm_operation_id: Optional[str] = None
    font_size: int = Field(14, ge=10, le=24)
    node_width: int = Field(400, ge=280, le=800)
    node_height: int = Field(400, ge=200, le=1200)
```

**Frontend (TypeScript)**:

```typescript
// types/graph.ts
export interface Node {
  id: UUID;
  type: string;
  content: string;
  importance: number;
  tags: string[];
  status: string;
  created_at: string;
  updated_at: string;
  meta: Record<string, unknown>;

  // NEW FIELDS
  llm_response?: string | null;
  llm_operation_id?: UUID | null;
  font_size?: number; // 10-24, default 14
  node_width?: number; // 280-800, default 400
  node_height?: number; // 200-1200, default 400
}
```

### Migration Strategy

**Backend Migration** (if using database - currently file-based):
- Add new fields to schema with `Optional` / `nullable`
- Existing nodes get `null` for new fields
- No data loss - backward compatible

**Frontend Migration**:
- TypeScript optional fields (`?`) ensure backward compatibility
- Existing nodes without new fields render with defaults
- ReactFlow handles missing `node_width/node_height` gracefully

### Example Data

**New Node (just created, auto-launch triggered)**:
```json
{
  "id": "uuid-1",
  "type": "custom",
  "content": "Explain quantum entanglement",
  "importance": 5,
  "tags": ["physics", "quantum"],
  "status": "active",
  "created_at": "2025-11-22T10:00:00Z",
  "updated_at": "2025-11-22T10:00:00Z",
  "meta": {},
  "llm_response": null,
  "llm_operation_id": "uuid-op-1",
  "font_size": 14,
  "node_width": 400,
  "node_height": 400
}
```

**Node with Complete Response**:
```json
{
  "id": "uuid-1",
  "type": "custom",
  "content": "Explain quantum entanglement",
  "importance": 5,
  "tags": ["physics", "quantum"],
  "status": "active",
  "created_at": "2025-11-22T10:00:00Z",
  "updated_at": "2025-11-22T10:01:30Z",
  "meta": {},
  "llm_response": "# Quantum Entanglement\n\nQuantum entanglement is a phenomenon...",
  "llm_operation_id": null,
  "font_size": 16,
  "node_width": 500,
  "node_height": 600
}
```

## Data Flow

### Node Creation → Auto-Launch

```
1. User creates node via NodeCreator
   ↓
2. Frontend: api.createNode(graphId, { content: "question", ... })
   ↓
3. Backend: Creates Node with llm_response=null, llm_operation_id=null
   ↓
4. Frontend: Receives new node, adds to ReactFlow with isNewNode=true flag
   ↓
5. Frontend: Node renders, useAutoLaunchLLM detects isNewNode=true
   ↓
6. Frontend: Creates LLM operation, sets llm_operation_id in local store
   ↓
7. Frontend: Starts streaming, incremental updates to llm_response
   ↓
8. Frontend: On completion, persists llm_response to backend via updateNode()
   ↓
9. Backend: Saves node with llm_response field populated
```

### Manual Regeneration

```
1. User right-clicks node → "Ask LLM"
   ↓
2. Frontend: Cancels existing operation if llm_operation_id exists
   ↓
3. Frontend: Creates new LLM operation
   ↓
4. Frontend: Clears llm_response locally, starts streaming
   ↓
5. Frontend: On completion, persists new llm_response to backend
```

## Storage Impact

**File Size Estimates** (per node):
- Question (content): ~100-500 bytes
- Response (llm_response): ~1-50 KB (average 5 KB)
- Metadata (font_size, dimensions): ~50 bytes

**100 nodes with responses**: ~500 KB additional storage
**1000 nodes with responses**: ~5 MB additional storage

**Performance**:
- JSON serialization/deserialization: <10ms for 100 nodes
- File I/O: <100ms for 5 MB file (SSD)
- No database indexes needed (file-based storage)

## Security Considerations

**XSS Prevention**:
- `llm_response` stored as plain markdown (no HTML)
- Frontend sanitizes via react-markdown (no `dangerouslySetInnerHTML`)
- Backend validation: Reject responses containing `<script>` tags (defense in depth)

**Input Validation**:
- Content length limits prevent DoS (100k char max)
- Font size bounds prevent UI breakage
- Dimension bounds prevent performance issues

**Data Integrity**:
- `llm_operation_id` references frontend-only store (ephemeral)
- Invalid UUIDs rejected by Pydantic validation
- Null vs empty string distinction maintained
