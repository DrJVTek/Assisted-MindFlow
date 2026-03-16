# MindFlow Plugin Node Architecture

## Objectif

Architecture de **plugins dynamiques** inspiree de ComfyUI, ou chaque node type et chaque LLM provider est un plugin auto-descriptif charge au demarrage.

**Status**: Implemented (spec 014-plugin-system-refonte)

---

## 1. Architecture Overview

| Aspect | Implementation |
|--------|---------------|
| **Node definition** | Classe Python avec `INPUT_TYPES()` classmethod, `RETURN_TYPES` tuple, `FUNCTION` str |
| **Node types** | Dynamique — chaque plugin enregistre ses types via `NODE_CLASS_MAPPINGS` |
| **Provider/Backend** | Chaque provider est un plugin dans `plugins/core/` |
| **Registration** | `PLUGIN_MANIFEST` + `NODE_CLASS_MAPPINGS` dans `__init__.py` |
| **Discovery** | `GET /api/node-types` retourne tout (node_types, type_definitions, categories) |
| **Execution** | Tri topologique, parents en batch, terminal en streaming SSE |
| **Type system** | 11 types avec matrice de compatibilite et conversions implicites |
| **Plugin loading** | Scan `plugins/core/` et `plugins/community/` au demarrage |
| **Frontend** | UI generee dynamiquement depuis les metadonnees plugin |
| **Caching** | Dirty/clean execution state — seuls les nodes dirty sont re-executes |

---

## 2. Plugin Structure

### 2.1. Directory Layout

```
plugins/
  core/                          # Plugins natifs (livres avec MindFlow)
    llm_openai/
      __init__.py                # PLUGIN_MANIFEST + NODE_CLASS_MAPPINGS
      nodes.py                   # OpenAIChatNode
    llm_anthropic/
      __init__.py
      nodes.py                   # AnthropicChatNode
    llm_ollama/
      __init__.py
      nodes.py                   # OllamaChatNode
    llm_gemini/
      __init__.py
      nodes.py                   # GeminiChatNode
    llm_chatgpt_web/
      __init__.py
      nodes.py                   # ChatGPTWebNode
    llm_chat/
      __init__.py
      nodes.py                   # LLMChatNode (generic)
    text_input/
      __init__.py
      nodes.py                   # TextInputNode
  community/                     # Plugins tiers (full trust, warning logged)
    _example/
      __init__.py                # Sample echo plugin
      nodes.py
```

### 2.2. Plugin Manifest

Chaque plugin declare un manifest dans `__init__.py` :

```python
# plugins/core/llm_openai/__init__.py

from .nodes import OpenAIChatNode

PLUGIN_MANIFEST = {
    "name": "llm_openai",
    "version": "1.0.0",
    "author": "MindFlow",
    "description": "OpenAI GPT chat node",
    "category": "llm",
    "requires": ["openai"],            # pip dependencies (checked at load)
    "mindflow_version": "1.0.0",       # minimum compatible version
}

NODE_CLASS_MAPPINGS = {
    "openai_chat": OpenAIChatNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "openai_chat": "OpenAI Chat",
}
```

**Required manifest fields**: `name`, `version`
**Optional fields**: `author`, `description`, `category`, `requires`, `mindflow_version`

### 2.3. Node Class Pattern

```python
from mindflow.plugins.base import BaseNode

class OpenAIChatNode(BaseNode):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt": ("STRING", {"multiline": True}),
                "model": ("COMBO", {"options": ["gpt-4o", "gpt-4o-mini", ...]}),
            },
            "optional": {
                "context": ("CONTEXT", {}),
                "system_prompt": ("STRING", {"multiline": True, "default": ""}),
                "temperature": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 2.0, "step": 0.1}),
                "max_tokens": ("INT", {"default": 1024, "min": 1, "max": 128000}),
            },
            "credentials": {
                "provider_id": ("SECRET", {"label": "OpenAI Provider"}),
            }
        }

    RETURN_TYPES = ("STRING", "CONTEXT", "STRING")
    RETURN_NAMES = ("response", "context", "prompt")
    FUNCTION = "execute"
    CATEGORY = "llm/openai"
    STREAMING = True

    UI = {
        "color": "#10A37F",
        "icon": "openai",
        "min_height": 200,
        "dual_zone": True,
    }

    async def execute(self, prompt, model, **kwargs):
        # ... actual implementation
        return (response, context, prompt)

    async def stream(self, prompt, model, **kwargs):
        # ... yields tokens for SSE streaming
        async for token in stream:
            yield token
```

**Required attributes**: `INPUT_TYPES` (classmethod), `RETURN_TYPES` (tuple), `FUNCTION` (str), `CATEGORY` (str)
**Optional attributes**: `STREAMING` (default: False), `UI` (default: {}), `RETURN_NAMES`

### 2.4. Validation Rules

The registry validates each node class at load time:

1. Must be a class (not an instance)
2. `INPUT_TYPES` must be callable (classmethod)
3. `RETURN_TYPES` must be a tuple (not list)
4. `FUNCTION` must be a string naming a callable method on the class
5. `CATEGORY` must be a string

Plugins failing validation are skipped with a clear log message.

---

## 3. Type System

### 3.1. Built-in Types

```python
BUILTIN_TYPES = {
    "STRING":      {"color": "#8BC34A",  "description": "Text content",              "is_connection_type": True},
    "INT":         {"color": "#2196F3",  "description": "Integer number",            "is_connection_type": True},
    "FLOAT":       {"color": "#FF9800",  "description": "Floating point number",     "is_connection_type": True},
    "BOOLEAN":     {"color": "#9C27B0",  "description": "True/False value",          "is_connection_type": True},
    "CONTEXT":     {"color": "#00BCD4",  "description": "Conversation context",      "is_connection_type": True},
    "USAGE":       {"color": "#795548",  "description": "Token usage information",   "is_connection_type": True},
    "TOOL_RESULT": {"color": "#E91E63",  "description": "MCP tool execution result", "is_connection_type": True},
    "EMBEDDING":   {"color": "#3F51B5",  "description": "Vector embedding",          "is_connection_type": True},
    "DOCUMENT":    {"color": "#FF5722",  "description": "Structured document",       "is_connection_type": True},
    "COMBO":       {"color": "#607D8B",  "description": "Selection from options",    "is_connection_type": False},
    "SECRET":      {"color": "#F44336",  "description": "Encrypted credential",      "is_connection_type": False},
}
```

### 3.2. Compatibility Matrix

| From \ To | STRING | INT | FLOAT | BOOLEAN | CONTEXT | USAGE | TOOL_RESULT | EMBEDDING | DOCUMENT |
|-----------|--------|-----|-------|---------|---------|-------|-------------|-----------|----------|
| STRING    | OK     | NO  | NO    | NO      | OK*     | NO    | NO          | NO        | NO       |
| INT       | OK*    | OK  | OK*   | OK*     | NO      | NO    | NO          | NO        | NO       |
| FLOAT     | OK*    | NO  | OK    | NO      | NO      | NO    | NO          | NO        | NO       |
| BOOLEAN   | OK*    | OK* | NO    | OK      | NO      | NO    | NO          | NO        | NO       |
| CONTEXT   | OK*    | NO  | NO    | NO      | OK      | NO    | NO          | NO        | NO       |
| USAGE     | OK*    | NO  | NO    | NO      | NO      | OK    | NO          | NO        | NO       |
| TOOL_RESULT| OK*   | NO  | NO    | NO      | NO      | NO    | OK          | NO        | NO       |
| EMBEDDING | NO     | NO  | NO    | NO      | NO      | NO    | NO          | OK        | NO       |
| DOCUMENT  | OK*    | NO  | NO    | NO      | NO      | NO    | NO          | NO        | OK       |

`OK*` = Implicit conversion (frontend shows dashed edge)
`NO` = Incompatible (connection rejected)

Key rules:
- EMBEDDING cannot convert to anything (opaque vector data)
- COMBO and SECRET are not connection types (used for widgets only)
- Same type is always compatible

---

## 4. Plugin Registry

**File**: `src/mindflow/plugins/registry.py`

```python
class PluginRegistry:
    def __init__(self, plugin_dirs: list[str]):
        self.plugin_dirs = plugin_dirs
        self.plugins: dict[str, PluginInfo] = {}
        self.node_classes: dict[str, type] = {}
        self.node_display_names: dict[str, str] = {}

    def discover_and_load(self):
        """Scan plugin directories and load all valid plugins."""

    def get_node_info(self) -> dict:
        """Return {node_types, type_definitions, categories} for GET /api/node-types."""

    def create_instance(self, node_id: str) -> BaseNode:
        """Instantiate a node by its registered ID."""
```

**Loading behavior**:
- Core plugins: loaded silently
- Community plugins: warning logged ("Loading community plugin: X (full trust)")
- Missing dependencies: plugin skipped with error log
- Duplicate node IDs: first-loaded (core) wins, duplicate rejected with warning
- Version incompatibility: plugin skipped if `mindflow_version > current`

---

## 5. Execution Engine

### 5.1. Topological Sort

**File**: `src/mindflow/engine/executor.py`

The executor builds a DAG from graph edges, performs topological sort (DFS with cycle detection), and executes nodes in order.

### 5.2. Dirty/Clean Caching

Each node has an execution state: `DIRTY`, `CLEAN`, `EXECUTING`, `FAILED`.

- **DIRTY**: Node needs (re)execution. Set when: first created, input modified, ancestor becomes dirty.
- **CLEAN**: Node has valid cached output. Set after successful execution.
- **EXECUTING**: Node is currently running.
- **FAILED**: Node execution errored. Cascades failure to all descendants.

`mark_dirty(node_id)` propagates to all descendants via BFS.

### 5.3. SSE Event Types

| Event | When | Data |
|-------|------|------|
| `node_start` | Dirty node begins execution | `{node_id}` |
| `node_complete` | Node finishes successfully | `{node_id, output}` |
| `node_skip` | Clean node with cached result | `{node_id, cached: true}` |
| `node_error` | Node execution failed | `{node_id, error}` |
| `execution_error` | Graph-level error (cycle) | `{error}` |
| `token` | Streaming token from terminal node | `{content}` |

### 5.4. Execution Flow

1. User clicks "Execute" on target node
2. Engine builds subgraph (target + all ancestors)
3. Topological sort (cycle detection)
4. For each node in order:
   - If CLEAN: emit `node_skip`, return cached output
   - If DIRTY: emit `node_start`, execute, emit `node_complete` or `node_error`
5. Terminal node: stream tokens via SSE if `STREAMING=True`
6. On failure: cascade FAILED state to all downstream nodes

---

## 6. API Endpoints

### GET /api/node-types

Returns complete metadata for frontend UI generation:

```json
{
  "node_types": {
    "openai_chat": {
      "display_name": "OpenAI Chat",
      "category": "llm/openai",
      "inputs": { "required": {...}, "optional": {...}, "credentials": {...} },
      "return_types": ["STRING", "CONTEXT", "STRING"],
      "return_names": ["response", "context", "prompt"],
      "streaming": true,
      "function": "execute",
      "ui": { "color": "#10A37F", "icon": "openai", "min_height": 200 }
    }
  },
  "type_definitions": {
    "STRING": { "color": "#8BC34A", "description": "Text content", "is_connection_type": true }
  },
  "categories": [
    { "name": "llm", "display_name": "Llm", "icon": "" }
  ]
}
```

### POST /api/graphs/{graph_id}/execute/{node_id}

Execute target node and all ancestors. Returns SSE stream.

### POST /api/graphs/{graph_id}/nodes/{node_id}/mark-dirty

Mark a node and all descendants as dirty. Returns `{"dirty_nodes": [...]}`.

### DELETE /api/graphs/{graph_id}/execute/{node_id}

Cancel an in-progress execution.

---

## 7. Frontend Integration

### Dynamic Node Creator

`NodeCreator.tsx` reads `nodeTypesStore` (populated from GET /api/node-types) and groups nodes by category. No hardcoded node type lists.

### Dynamic Node Rendering

`Node.tsx` derives ports, colors, and labels from `nodeTypesStore` metadata. Color comes from `ui.color`, icon from `ui.icon`.

### Connection Validation

`ConnectionValidator.tsx` uses `typeDefinitions` from the store to enforce type compatibility. Implicit conversions show dashed edges.

### Dynamic Input Widgets

`DynamicInputWidget.tsx` renders appropriate widgets based on INPUT_TYPES metadata:
- STRING → textarea
- INT → number input
- FLOAT → slider
- BOOLEAN → toggle
- COMBO → dropdown
- SECRET → password field

---

## 8. Currently Loaded Plugins (7 core)

| Plugin | Node ID | Category | Streaming |
|--------|---------|----------|-----------|
| llm_openai | openai_chat | llm/openai | Yes |
| llm_anthropic | anthropic_chat | llm/anthropic | Yes |
| llm_ollama | ollama_chat | llm/ollama | Yes |
| llm_gemini | gemini_chat | llm/gemini | Yes |
| llm_chatgpt_web | chatgpt_web_chat | llm/chatgpt_web | Yes |
| llm_chat | llm_chat | llm | Yes |
| text_input | text_input | input | No |

---

## 9. Community Plugin Development

Place plugins in `plugins/community/<name>/`:

1. Create `__init__.py` with `PLUGIN_MANIFEST` and `NODE_CLASS_MAPPINGS`
2. Create `nodes.py` with node classes extending `BaseNode`
3. Restart server — plugin loads automatically with a warning log

See `plugins/community/_example/` for a working template.

Community plugins load with **full trust** (like ComfyUI custom nodes). No sandboxing.

---

## 10. Key Differences from ComfyUI

| Aspect | ComfyUI | MindFlow |
|--------|---------|----------|
| **Focus** | Image pipeline (batch) | Conversation LLM (streaming) |
| **Execution** | Entire graph at once | Streaming terminal node, parents in batch |
| **Interaction** | Run once, get result | Interactive edit & re-run with caching |
| **Node UI** | Generic widgets | Dual-zone (prompt + response) for LLM nodes |
| **Credentials** | Global config | Per-provider, with OAuth support |
| **Type `CONTEXT`** | N/A | Conversation context type |
| **Streaming** | No (batch) | Yes (SSE, token by token) |
| **Dirty/Clean** | No caching | Execution caching with dirty propagation |
