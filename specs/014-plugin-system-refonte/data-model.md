# Data Model: Plugin System Refonte

**Branch**: `014-plugin-system-refonte` | **Date**: 2026-03-15

## Entities

### Plugin (runtime only — not persisted)

| Field | Type | Description |
|-------|------|-------------|
| name | string | From PLUGIN_MANIFEST["name"] |
| version | string | Semver from manifest |
| author | string | From manifest |
| description | string | From manifest |
| category | string | From manifest (e.g., "llm", "tools", "transform") |
| requires | string[] | pip dependencies from manifest |
| mindflow_version | string | Minimum compatible version |
| path | string | Absolute directory path |
| node_ids | string[] | List of registered node type IDs |
| is_community | boolean | True if loaded from community directory |

### NodeTypeDefinition (runtime, served via API)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique node type ID (e.g., "openai_chat") |
| display_name | string | Human-readable name |
| category | string | Hierarchical category (e.g., "llm/openai") |
| inputs | InputSpec | Required, optional, and credential inputs |
| return_types | string[] | Output type names |
| return_names | string[] | Output port names |
| streaming | boolean | Whether node supports SSE streaming |
| function | string | Method name to call on the node instance |
| ui | UISpec | Color, icon, width, min_height |

### InputSpec

| Field | Type | Description |
|-------|------|-------------|
| required | Record<string, InputDef> | Inputs that must be provided |
| optional | Record<string, InputDef> | Inputs with defaults |
| credentials | Record<string, InputDef> | Secret inputs resolved from credential store |

### InputDef (tuple format: [type, options])

| Field | Type | Description |
|-------|------|-------------|
| type | string | One of: STRING, INT, FLOAT, BOOLEAN, COMBO, SECRET, CONTEXT, USAGE, TOOL_RESULT, EMBEDDING, DOCUMENT |
| multiline | boolean | For STRING: use textarea |
| max_length | number | For STRING: character limit |
| default | any | Default value |
| min | number | For INT/FLOAT: minimum |
| max | number | For INT/FLOAT: maximum |
| step | number | For INT/FLOAT: increment |
| options | string[] | For COMBO: available choices |
| options_from | string | For COMBO: dynamic source (e.g., "api", "mcp_tools") |
| placeholder | string | UI placeholder text |
| label | string | For SECRET: human-readable credential name |

### TypeDefinition (runtime, served via API)

| Field | Type | Description |
|-------|------|-------------|
| name | string | Type name (e.g., "STRING", "CONTEXT") |
| color | string | Hex color for port rendering |
| description | string | Human-readable description |
| is_connection_type | boolean | Whether this type appears on connection ports |

### Type Compatibility Matrix

| From \ To | STRING | CONTEXT | INT | FLOAT | BOOLEAN | USAGE | TOOL_RESULT | EMBEDDING | DOCUMENT |
|-----------|--------|---------|-----|-------|---------|-------|-------------|-----------|----------|
| STRING | yes | yes | no | no | no | no | no | no | no |
| CONTEXT | yes | yes | no | no | no | no | no | no | no |
| INT | yes | no | yes | yes | yes | no | no | no | no |
| FLOAT | yes | no | no | yes | no | no | no | no | no |
| BOOLEAN | yes | no | yes | no | yes | no | no | no | no |
| USAGE | yes | no | no | no | no | yes | no | no | no |
| TOOL_RESULT | yes | no | no | no | no | no | yes | no | no |
| EMBEDDING | no | no | no | no | no | no | no | yes | no |
| DOCUMENT | yes | no | no | no | no | no | no | no | yes |

Widget types (COMBO, SECRET) are not connection types — they are resolved at the node level, not via edges.

### Node (persisted in graph JSON)

Existing fields plus additions for plugin system:

| Field | Type | Description | Status |
|-------|------|-------------|--------|
| id | string (UUID) | Unique node ID | EXISTING |
| class_type | string | Plugin node type ID (e.g., "openai_chat") | EXISTING |
| content | string | User-entered prompt text | EXISTING |
| inputs | Record<string, any> | Widget values for non-connected inputs | EXISTING |
| connections | Record<string, ConnectionRef> | Named input → source node output mapping | EXISTING |
| parents | string[] | Parent node IDs | EXISTING |
| children | string[] | Child node IDs | EXISTING |
| meta | NodeMeta | Position, status, importance, etc. | EXISTING |
| provider_id | string? | Reference to provider instance | EXISTING |
| llm_response | string? | Cached LLM response | EXISTING |
| llm_operation_id | string? | Current/last operation ID | EXISTING |

### ConnectionRef (in node.connections)

| Field | Type | Description |
|-------|------|-------------|
| source_node | string | ID of the source node |
| source_output | number | Index into source node's RETURN_TYPES |

### NodeExecutionState (runtime only)

| Field | Type | Description |
|-------|------|-------------|
| node_id | string | Reference to node |
| state | enum | CLEAN, DIRTY, EXECUTING, FAILED |
| cached_output | tuple? | Cached execution result (when CLEAN) |
| last_input_hash | string? | Hash of inputs at last execution (for dirty detection) |
| error | string? | Error message if FAILED |

## State Transitions

### Node Execution State

```
          ┌──────────────────────────────────┐
          │                                  │
   DIRTY ─┬──► EXECUTING ──► CLEAN          │
          │        │                         │
          │        ▼                         │
          │     FAILED ──────────────────────┘
          │        │          (retry = mark dirty again)
          │        ▼
          └── user modifies input
              or ancestor re-executes
```

- **DIRTY**: Node needs execution (initial state, or after input change / ancestor re-execution)
- **EXECUTING**: Currently running
- **CLEAN**: Has valid cached output
- **FAILED**: Execution errored — can be retried (re-marked DIRTY)

### Dirty Propagation Rules

1. User edits node's `content` or `inputs` → mark node DIRTY
2. Node becomes DIRTY → all descendants become DIRTY (recursive via children)
3. Node execution completes → mark CLEAN, store output in cache
4. Node execution fails → mark FAILED, propagate FAILED to downstream (skip execution)
