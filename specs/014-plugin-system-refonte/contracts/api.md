# API Contracts: Plugin System Refonte

**Branch**: `014-plugin-system-refonte` | **Date**: 2026-03-15

## Existing Endpoints (to preserve)

### GET /api/node-types
**Status**: EXISTING — needs validation of response completeness.

**Response** `200 OK`:
```json
{
  "node_types": {
    "<node_type_id>": {
      "display_name": "string",
      "category": "string",
      "inputs": {
        "required": { "<name>": ["<TYPE>", { ...options }] },
        "optional": { "<name>": ["<TYPE>", { ...options }] },
        "credentials": { "<name>": ["SECRET", { "label": "string" }] }
      },
      "return_types": ["STRING", "CONTEXT"],
      "return_names": ["response", "context"],
      "streaming": true,
      "function": "generate",
      "ui": {
        "color": "#10A37F",
        "icon": "openai",
        "width": 400,
        "min_height": 300
      }
    }
  },
  "type_definitions": {
    "<TYPE_NAME>": {
      "color": "#8BC34A",
      "description": "Text content",
      "is_connection_type": true
    }
  },
  "categories": [
    {
      "name": "llm/openai",
      "display_name": "OpenAI",
      "icon": "openai"
    }
  ]
}
```

### GET /api/providers
**Status**: EXISTING — no changes needed.

### POST /api/providers
**Status**: EXISTING — no changes needed.

### GET /api/graphs/{graph_id}
**Status**: EXISTING — response includes nodes with `class_type`, `inputs`, `connections`.

### PUT /api/graphs/{graph_id}/nodes/{node_id}
**Status**: EXISTING — used to update node content, inputs, position, connections.

## New/Modified Endpoints

### POST /api/graphs/{graph_id}/execute/{node_id}
**Status**: MODIFY — add dirty/clean execution caching.

**Request** (no body needed — executes from graph state):
```
POST /api/graphs/{graph_id}/execute/{node_id}
```

**Response** `200 OK` (SSE stream):
```
event: node_start
data: {"node_id": "abc", "status": "executing"}

event: node_complete
data: {"node_id": "abc", "status": "clean", "cached": false}

event: node_skip
data: {"node_id": "def", "status": "clean", "cached": true}

event: stream_token
data: {"node_id": "target-id", "token": "Hello"}

event: stream_token
data: {"node_id": "target-id", "token": " world"}

event: complete
data: {"node_id": "target-id", "status": "clean"}
```

New SSE event types:
- `node_skip`: Ancestor was clean, result reused from cache
- `node_start` / `node_complete`: Ancestor executing (dirty)

**Error Response** `400 Bad Request`:
```json
{
  "error": "cycle_detected",
  "message": "Graph contains a cycle: node-a → node-b → node-a",
  "nodes": ["node-a", "node-b"]
}
```

**Error Response** `422 Unprocessable Entity`:
```json
{
  "error": "missing_credential",
  "message": "Missing credential: OpenAI API Key",
  "node_id": "node-abc",
  "credential_label": "OpenAI API Key"
}
```

### DELETE /api/graphs/{graph_id}/execute/{node_id}
**Status**: NEW — cancel execution.

**Response** `200 OK`:
```json
{
  "cancelled": true,
  "nodes_cancelled": ["node-a", "node-b"]
}
```

### POST /api/graphs/{graph_id}/nodes/{node_id}/mark-dirty
**Status**: NEW — explicitly invalidate a node and its descendants.

**Response** `200 OK`:
```json
{
  "dirty_nodes": ["node-a", "node-b", "node-c"]
}
```

## Test Contracts

### Plugin Loading
- Load valid plugin → registered in registry
- Load plugin missing FUNCTION → skipped with error log
- Load plugin with missing pip dependency → skipped with error log
- Load two plugins with same node ID → first (core) wins, warning logged

### Type Validation
- STRING → STRING connection → accepted
- STRING → INT connection → rejected
- STRING → CONTEXT connection → accepted (implicit conversion)
- EMBEDDING → STRING connection → rejected

### Graph Execution
- Linear chain (A→B→C), all dirty → executes A, B, C in order
- Linear chain, A and B clean → skips A and B, executes C only
- Diamond (A→B, A→C, B→D, C→D), all dirty → A once, B||C parallel, D last
- Cycle detected → error before execution
- Parent fails → downstream skipped, error reported
- Cancel during execution → in-progress nodes stopped

### Credential Resolution
- Node requires credential, credential configured → resolves from store
- Node requires credential, credential missing → error: "Missing credential: [label]"
- Credential never in graph JSON export
