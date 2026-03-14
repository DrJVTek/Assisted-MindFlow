# API Contract: Debate Chains

**Prefix**: `/api/debates`

## Endpoints

### POST /api/debates
Start a new debate chain between connected LLM nodes.

**Request**:
```json
{
  "graph_id": "uuid",
  "start_node_id": "uuid",
  "max_rounds": 5
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "graph_id": "uuid",
  "start_node_id": "uuid",
  "node_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "round_count": 0,
  "max_rounds": 5,
  "status": "running",
  "created_at": "2026-03-14T10:00:00Z"
}
```

**Behavior**:
1. Discovers the chain by walking edges from `start_node_id` (depth-first, following child_ids)
2. Validates all nodes in the chain have assigned providers
3. Checks for cycles (limits to max_rounds if cyclic)
4. Starts debate execution asynchronously
5. Each node generates via its assigned provider, receiving full history from prior nodes

**Errors**:
- 400: Less than 2 nodes in chain, or start_node has no connected LLM nodes
- 404: Graph or start_node not found
- 409: Debate already running on this chain
- 422: Nodes missing provider assignments

---

### GET /api/debates/{debate_id}
Get debate status and results.

**Response** (200):
```json
{
  "id": "uuid",
  "graph_id": "uuid",
  "start_node_id": "uuid",
  "node_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "round_count": 2,
  "max_rounds": 5,
  "status": "completed",
  "created_at": "2026-03-14T10:00:00Z",
  "updated_at": "2026-03-14T10:01:30Z"
}
```

Node responses are on the nodes themselves (read via GET /api/graphs/{gid}/nodes).

---

### POST /api/debates/{debate_id}/continue
Continue an existing debate for additional rounds.

**Request**:
```json
{
  "additional_rounds": 1
}
```

**Response** (200): Updated debate object with status "running".
**Errors**: 404, 409 (already running).

---

### DELETE /api/debates/{debate_id}
Stop/cancel a running debate.

**Response** (200):
```json
{
  "message": "Debate stopped",
  "rounds_completed": 2
}
```

---

### GET /api/debates?graph_id={graph_id}
List debates for a graph.

**Response** (200):
```json
{
  "debates": [...]
}
```

---

### POST /api/graphs/{graph_id}/nodes/summarize-group
Generate a summary node from a group of nodes (optional feature FR-008b).

**Request**:
```json
{
  "node_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "provider_id": "uuid",
  "position": { "x": 500, "y": 300 }
}
```

**Response** (201):
```json
{
  "summary_node_id": "uuid",
  "content": "Summary of the debate...",
  "message": "Summary generated from 3 nodes"
}
```

**Behavior**: Collects content from all specified nodes, sends to the designated provider with a summarization prompt, creates a new node with the summary.
