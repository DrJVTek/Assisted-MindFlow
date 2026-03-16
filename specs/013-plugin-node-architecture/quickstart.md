# Quickstart: Plugin Node Architecture

**Feature**: 013-plugin-node-architecture
**Date**: 2026-03-15

## Test Scenarios

### Scenario 1: Plugin Discovery & Loading

**Setup**: Place a minimal test plugin in `plugins/core/text_input/`

```python
# plugins/core/text_input/__init__.py
from .nodes import TextInputNode

PLUGIN_MANIFEST = {
    "name": "Text Input",
    "version": "1.0.0",
    "author": "MindFlow",
    "category": "input",
}

NODE_CLASS_MAPPINGS = {
    "text_input": TextInputNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "text_input": "Text Input",
}
```

```python
# plugins/core/text_input/nodes.py
from mindflow.plugins.base import BaseNode

class TextInputNode(BaseNode):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "max_length": 50000}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "execute"
    CATEGORY = "input"
    UI = {"color": "#4CAF50", "icon": "text"}

    async def execute(self, text):
        return (text,)
```

**Test**:
1. Start the application → plugin should be discovered and loaded
2. `GET /api/node-types` → should include `text_input` with all metadata
3. Frontend should show "Text Input" in the node creation dialog under "Input" category

---

### Scenario 2: LLM Provider Interface

**Setup**: Register an OpenAI provider instance

**Test**:
```bash
# Register provider
curl -X POST http://localhost:8000/api/providers \
  -H "Content-Type: application/json" \
  -d '{"name": "My OpenAI", "type": "openai", "credentials": {"api_key": "sk-test"}}'

# Validate connection
curl -X POST http://localhost:8000/api/providers/{id}/validate

# List models
curl http://localhost:8000/api/providers/{id}/models

# Check status
curl http://localhost:8000/api/providers/{id}/status
```

**Expected**: Provider connects, lists models, reports status. Invalid API key → explicit error (no fallback).

---

### Scenario 3: Graph Execution (3-Node Chain)

**Setup**: Create a graph with: TextInput → LLMChat → (output)

**Test**:
```bash
# Execute with streaming
curl -N http://localhost:8000/api/graphs/{graph_id}/execute/{target_node_id} \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"stream": true}'
```

**Expected SSE stream**:
1. `execution_start` with ordered node list
2. `node_start` + `node_complete` for TextInput
3. `node_start` + multiple `token` events + `node_complete` for LLMChat
4. `execution_complete`

---

### Scenario 4: Type-Safe Connections

**Test on frontend**:
1. Create a TextInput node (output: STRING) and an LLMChat node (input: CONTEXT)
2. Drag connection from TextInput output → LLMChat context input → should succeed (STRING → CONTEXT auto-conversion)
3. Create an EmbeddingNode (output: EMBEDDING)
4. Drag connection from EmbeddingNode → LLMChat prompt input → should be visually rejected (EMBEDDING ≠ STRING)

---

### Scenario 5: Legacy Migration

**Test**:
1. Load an existing canvas JSON with old format (`type: "question"`, no `version` field)
2. Application should auto-migrate:
   - `type: "question"` → `class_type: "llm_chat"`
   - `type: "note"` → `class_type: "text_input"`
3. Save → canvas should be written in v2.0.0 format
4. Node content, relationships, and metadata should be preserved

---

### Scenario 6: Composite Node

**Test**:
1. Create 3 connected nodes: TextInput → LLMChat (system prompt: "Summarize") → TextInput (output display)
2. Select all 3, group into composite "Quick Summary"
3. Expose parameter: LLMChat.temperature as "Creativity"
4. Composite should appear as single node with "Creativity" slider
5. Execute → internal nodes run in order, result appears at composite output
6. Create second instance of same composite → independent parameter values

---

### Scenario 7: Provider Isolation

**Test**:
1. Register two OpenAI providers with different API keys
2. Create two LLMChat nodes, each assigned to a different provider
3. Execute both concurrently
4. Each should use its own API key — verify via request logs
5. One provider with invalid key should fail explicitly without affecting the other

---

### Scenario 8: Error Handling (Zero Fallback)

**Test**:
1. Create LLMChat node with no provider assigned → explicit error: "No provider configured"
2. Create LLMChat node with invalid provider credentials → explicit error: "Authentication failed: Invalid API key"
3. Create graph with cycle (A → B → A) → explicit error: "Cycle detected" before any execution
4. Reference a node type from removed plugin → "Missing plugin" indicator, other nodes still work

## Verification Checklist

- [ ] All 5 existing LLM providers work as plugins
- [ ] `GET /api/node-types` returns all registered node types
- [ ] Frontend renders node creation UI dynamically (no hardcoded types)
- [ ] Type-safe connections prevent invalid links
- [ ] Graph execution follows topological order
- [ ] Terminal node streams via SSE
- [ ] Composite nodes execute as sub-graphs
- [ ] Legacy graphs auto-migrate on load
- [ ] Provider isolation verified (no credential cross-contamination)
- [ ] All 15 code review issues fixed
- [ ] Dead code removed (LLMService, unused cache)
- [ ] Zero silent fallbacks — all errors explicit
