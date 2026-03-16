# API Contract: Graph Execution Engine

**Purpose**: Defines the execution endpoints that replace per-node operation creation with graph-aware execution.

## Endpoints

### POST /api/graphs/{graph_id}/execute/{node_id} — Execute Node with Dependencies

Triggers topological execution of the target node and all its ancestors.

**Request** (optional body):
```json
{
  "stream": true,
  "force_rerun": false
}
```

- `stream` (default: true) — whether the terminal node should stream its response via SSE
- `force_rerun` (default: false) — re-execute parents even if they have cached results

**Response (200, stream=false)**:
```json
{
  "execution_id": "uuid",
  "target_node_id": "uuid",
  "execution_order": ["node-1", "node-2", "node-3"],
  "results": {
    "node-1": {"status": "completed", "outputs": {"text": "..."}},
    "node-2": {"status": "completed", "outputs": {"response": "...", "usage_info": {...}}},
    "node-3": {"status": "completed", "outputs": {"response": "..."}}
  }
}
```

**Response (200, stream=true)** — SSE stream:
```
event: execution_start
data: {"execution_id": "uuid", "execution_order": ["node-1", "node-2", "node-3"]}

event: node_start
data: {"node_id": "node-1", "class_type": "text_input"}

event: node_complete
data: {"node_id": "node-1", "outputs": {"text": "What is quantum computing?"}}

event: node_start
data: {"node_id": "node-2", "class_type": "llm_chat"}

event: token
data: {"node_id": "node-2", "token": "Quantum"}

event: token
data: {"node_id": "node-2", "token": " computing"}

event: token
data: {"node_id": "node-2", "token": " is"}

event: node_complete
data: {"node_id": "node-2", "outputs": {"response": "Quantum computing is...", "usage_info": {"prompt_tokens": 12, "completion_tokens": 150, "total_tokens": 162}}}

event: execution_complete
data: {"execution_id": "uuid", "status": "completed"}
```

**Error events**:
```
event: node_error
data: {"node_id": "node-2", "error": "Provider authentication failed: Invalid API key", "cancelled_downstream": ["node-3"]}

event: execution_error
data: {"execution_id": "uuid", "error": "Execution failed at node node-2"}
```

### DELETE /api/graphs/{graph_id}/execute/{execution_id} — Cancel Execution

Cancels a running execution.

**Response (200)**:
```json
{
  "execution_id": "uuid",
  "status": "cancelled",
  "completed_nodes": ["node-1"],
  "cancelled_nodes": ["node-2", "node-3"]
}
```

### POST /api/graphs/{graph_id}/validate — Validate Graph Before Execution

Checks for cycles and type compatibility without executing.

**Response (200, valid)**:
```json
{
  "valid": true,
  "node_count": 5,
  "edge_count": 4,
  "has_cycles": false,
  "type_errors": []
}
```

**Response (200, invalid)**:
```json
{
  "valid": false,
  "has_cycles": true,
  "cycle_nodes": ["node-2", "node-3"],
  "type_errors": [
    {
      "source_node": "node-1",
      "source_output": "response",
      "source_type": "STRING",
      "target_node": "node-4",
      "target_input": "embedding",
      "target_type": "EMBEDDING",
      "message": "Cannot connect STRING output to EMBEDDING input"
    }
  ]
}
```

## Backward Compatibility

The existing LLM operations endpoints continue to work during migration:

- `POST /api/llm-operations/graphs/{graph_id}/operations` — creates a single-node execution (wraps the new execution engine)
- `GET /api/llm-operations/graphs/{graph_id}/operations/{op_id}/stream` — proxies to execution engine SSE
- `DELETE /api/llm-operations/{op_id}` — maps to execution cancellation

These endpoints are deprecated and will be removed after full migration.

## SSE Event Types

| Event | When | Data |
|-------|------|------|
| execution_start | Execution begins | execution_id, execution_order |
| node_start | Node begins execution | node_id, class_type |
| node_progress | Node reports progress | node_id, progress (0-100) |
| token | Streaming node emits token | node_id, token |
| node_complete | Node finishes | node_id, outputs |
| node_error | Node fails | node_id, error, cancelled_downstream |
| execution_complete | All done | execution_id, status |
| execution_error | Execution failed | execution_id, error |

## Notes

- All SSE data payloads are JSON-serialized with `json.dumps()` — no manual string escaping (FR-013)
- The execution engine uses the concurrency manager for provider calls (existing semaphore system)
- Parent nodes with cached results can be skipped unless `force_rerun: true`
- Composite nodes are expanded transparently — the client sees individual internal node events
