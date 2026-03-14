# API Contract: MCP Server Tools

MindFlow exposes these tools via MCP protocol (no authentication, localhost only).

## Tools

### list_canvases
List all available canvases.

**Input**: (none)

**Output**:
```json
{
  "canvases": [
    { "id": "uuid", "name": "My Canvas", "description": "...", "node_count": 12 }
  ]
}
```

---

### get_canvas
Get a canvas with its full graph data.

**Input**:
```json
{ "canvas_id": "uuid" }
```

**Output**:
```json
{
  "id": "uuid",
  "name": "My Canvas",
  "graph": {
    "id": "uuid",
    "nodes": { "node-id": { "content": "...", "provider_id": "...", "llm_response": "..." } },
    "groups": {},
    "comments": {}
  }
}
```

---

### read_node
Read a single node's content and metadata.

**Input**:
```json
{ "graph_id": "uuid", "node_id": "uuid" }
```

**Output**:
```json
{
  "id": "uuid",
  "content": "What is the meaning of life?",
  "llm_response": "The meaning of life...",
  "provider_id": "uuid",
  "provider_name": "My Claude",
  "provider_type": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "status": "completed",
  "tags": ["philosophy"],
  "position": { "x": 100, "y": 200 }
}
```

---

### create_node
Create a new node on the canvas.

**Input**:
```json
{
  "graph_id": "uuid",
  "content": "Explain quantum computing",
  "provider_id": "uuid",
  "type": "question",
  "tags": ["science"],
  "position": { "x": 300, "y": 400 },
  "parent_ids": ["uuid"]
}
```

**Output**:
```json
{
  "id": "uuid",
  "content": "Explain quantum computing",
  "provider_id": "uuid",
  "status": "idle"
}
```

---

### update_node
Update a node's content or metadata.

**Input**:
```json
{
  "graph_id": "uuid",
  "node_id": "uuid",
  "content": "Updated prompt",
  "tags": ["updated"]
}
```

**Output**: Updated node object.

---

### delete_node
Delete a node from the graph.

**Input**:
```json
{ "graph_id": "uuid", "node_id": "uuid" }
```

**Output**:
```json
{ "message": "Node deleted" }
```

---

### trigger_llm
Trigger LLM generation on a node using its assigned provider.

**Input**:
```json
{
  "graph_id": "uuid",
  "node_id": "uuid",
  "system_prompt": "Optional system prompt override"
}
```

**Output**:
```json
{
  "operation_id": "uuid",
  "status": "processing",
  "provider_name": "My Claude",
  "model": "claude-sonnet-4-20250514"
}
```

Note: The operation runs asynchronously. The MCP client can poll the node's content to see the completed response.

---

### start_debate
Start a debate chain from a node.

**Input**:
```json
{
  "graph_id": "uuid",
  "start_node_id": "uuid",
  "max_rounds": 3
}
```

**Output**:
```json
{
  "debate_id": "uuid",
  "node_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "status": "running"
}
```
