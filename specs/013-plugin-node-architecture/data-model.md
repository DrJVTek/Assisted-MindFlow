# Data Model: Plugin Node Architecture

**Feature**: 013-plugin-node-architecture
**Date**: 2026-03-15

## Entities

### 1. LLMProvider (Abstract Interface — Driver Layer)

Separate from the plugin system. Independent driver for LLM services.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| provider_type | str | Yes | Unique provider type identifier (e.g., "openai", "anthropic") |
| credentials | CredentialSet | Yes | Injected at construction, never stored in graph |
| status | ProviderStatus | Yes | idle / connecting / connected / error / rate_limited |
| connection_info | dict | No | Provider-specific connection metadata |

**Methods (Interface)**:
- `async connect() -> None`
- `async disconnect() -> None`
- `async generate(prompt, model, **kwargs) -> ProviderResponse`
- `async stream(prompt, model, **kwargs) -> AsyncIterator[str]`
- `async list_models() -> list[ModelInfo]`
- `get_status() -> ProviderStatus`
- `get_progress() -> ProgressInfo | None`
- `required_credentials() -> list[CredentialSpec]` (classmethod)

**States**: `idle → connecting → connected → error` (can transition back to `connected` after error recovery)

---

### 2. ProviderResponse

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | str | Yes | Generated text |
| usage | UsageInfo | No | Token usage statistics |
| model | str | Yes | Model actually used |
| metadata | dict | No | Provider-specific metadata |

---

### 3. ModelInfo

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | str | Yes | Model identifier (e.g., "gpt-4o") |
| name | str | Yes | Display name |
| context_length | int | No | Max context window |
| capabilities | list[str] | No | e.g., ["streaming", "vision", "tools"] |

---

### 4. CredentialSpec

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| key | str | Yes | Credential key name (e.g., "api_key") |
| label | str | Yes | Human-readable label |
| type | str | Yes | "api_key" / "oauth" / "endpoint_url" |
| required | bool | Yes | Whether credential is mandatory |

---

### 5. BaseNode (Plugin Node — Canvas Layer)

Abstract base class for all node plugins.

| Class Attribute | Type | Required | Description |
|-----------------|------|----------|-------------|
| INPUT_TYPES() | classmethod → dict | Yes | Defines required, optional, and credentials inputs |
| RETURN_TYPES | tuple[str, ...] | Yes | Output data types |
| RETURN_NAMES | tuple[str, ...] | Yes | Output port names |
| FUNCTION | str | Yes | Name of the execution method |
| CATEGORY | str | Yes | Category path (e.g., "llm/openai", "input", "transform") |
| STREAMING | bool | No | Whether node supports streaming (default: False) |
| UI | dict | No | Frontend hints: color, icon, width, min_height |

**INPUT_TYPES structure**:
```
{
  "required": { "input_name": ("TYPE", {options}) },
  "optional": { "input_name": ("TYPE", {options}) },
  "credentials": { "cred_name": ("SECRET", {options}) }
}
```

---

### 6. LLMNode(BaseNode)

Extension for LLM-category node plugins.

| Additional Attribute | Type | Description |
|---------------------|------|-------------|
| STREAMING | bool | Always True for LLM nodes |
| provider | LLMProvider | Reference to provider instance (set at execution time) |

**Additional methods**:
- `async stream(**kwargs) -> AsyncIterator[str]` — token-by-token output

---

### 7. PluginManifest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | str | Yes | Plugin display name |
| version | str | Yes | Semver version |
| author | str | No | Plugin author |
| description | str | No | Plugin description |
| category | str | No | Primary category |
| requires | list[str] | No | pip dependencies |
| mindflow_version | str | No | Compatibility constraint |

---

### 8. PluginInfo (Registry Entry)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| manifest | PluginManifest | Yes | Plugin metadata |
| path | str | Yes | Absolute path to plugin directory |
| node_ids | list[str] | Yes | Node type IDs registered by this plugin |
| load_error | str | No | Error message if plugin failed to load |

---

### 9. Node Instance (Graph Data — Updated)

Replaces the current Node model. Key changes: `class_type` replaces `type` enum.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique node identifier |
| class_type | str | Yes | Plugin node type ID (e.g., "llm_chat", "text_input") — replaces old `type` enum |
| author | str | Yes | "human" / "llm" / "tool" |
| content | str | Yes | Primary content (0-10000 chars) |
| parents | list[UUID] | Yes | Parent node IDs |
| children | list[UUID] | Yes | Child node IDs |
| groups | list[UUID] | Yes | Group memberships |
| meta | NodeMetadata | Yes | Timestamps, importance, tags, status |
| inputs | dict | No | Inline input values (not connected) |
| connections | dict | No | Input connections: `{input_name: {source_node, source_output}}` |
| provider_id | UUID | No | Reference to LLM Provider Instance (for LLM nodes) |
| llm_response | str | No | Accumulated LLM response |
| llm_operation_id | UUID | No | Active operation reference |
| llm_status | str | No | idle / queued / streaming / complete / error |
| llm_error | str | No | Error message |
| position | Position | No | Canvas position {x, y} |
| dimensions | Dimensions | No | {width, height} |
| font_size | int | No | 10-24, default 14 |
| prompt_height | int | No | Dual-zone prompt area height |
| response_height | int | No | Dual-zone response area height |
| note_top | str | No | Note above prompt |
| note_bottom | str | No | Note below response |
| collapsed | bool | No | Collapsed state |
| summary | str | No | Title when collapsed |
| mcp_tools | list[str] | No | MCP tool names |

---

### 10. CompositeNodeDefinition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | str | Yes | Unique composite definition ID |
| name | str | Yes | Display name |
| version | str | No | Version string |
| exposed_params | dict | Yes | Parameter bindings: `{param_name: {internal_node, internal_param, type, options/default}}` |
| inputs | dict | Yes | External inputs: `{input_name: {type, maps_to: {node, input}}}` |
| outputs | list | Yes | External outputs: `[{type, maps_from: {node, output_index}}]` |
| internal_graph | Graph | Yes | Sub-graph with nodes and connections |

---

### 11. ExecutionPlan

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| target_node_id | UUID | Yes | Node that triggered execution |
| execution_order | list[UUID] | Yes | Topologically sorted node IDs (ancestors first, target last) |
| stream_target | bool | Yes | Whether terminal node should stream |
| resolved_inputs | dict | No | Pre-resolved input values per node |

---

### 12. Graph (Updated — v2.0.0)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Graph identifier |
| version | str | Yes | Schema version ("2.0.0" for plugin format) |
| meta | GraphMeta | Yes | name, description, timestamps |
| nodes | dict[UUID, Node] | Yes | All nodes in the graph |
| groups | dict[UUID, Group] | Yes | Node groups |
| comments | dict[UUID, Comment] | Yes | Annotations |
| composite_definitions | dict[str, CompositeNodeDefinition] | No | Saved composite node templates |

---

## Data Type System

| Type | Connection Type | Widget | Color |
|------|----------------|--------|-------|
| STRING | Yes | Input / Textarea | #8BC34A |
| INT | Yes | Number input | #2196F3 |
| FLOAT | Yes | Slider / Number | #FF9800 |
| BOOLEAN | Yes | Toggle | #9C27B0 |
| COMBO | No (widget only) | Dropdown | #607D8B |
| SECRET | No (credential only) | Password input | #F44336 |
| CONTEXT | Yes | — | #00BCD4 |
| USAGE | Yes | — | #795548 |
| TOOL_RESULT | Yes | — | #E91E63 |
| EMBEDDING | Yes | — | #3F51B5 |
| DOCUMENT | Yes | — | #FF5722 |

**Conversion rules**:
- STRING → CONTEXT: implicit (text wrapped as context)
- Any → STRING: implicit (toString)
- All others: explicit only, connection rejected

## Relationships

```
PluginManifest ──1:N──► NodeType (via NODE_CLASS_MAPPINGS)
NodeType ──1:N──► NodeInstance (each instance on canvas)
NodeInstance ──N:1──► LLMProviderInstance (for LLM nodes, via provider_id)
NodeInstance ──N:N──► NodeInstance (parent/child DAG)
NodeInstance ──N:N──► Group (membership)
Graph ──1:N──► NodeInstance
Graph ──1:N──► CompositeNodeDefinition
CompositeNodeDefinition ──1:1──► Graph (internal sub-graph)
Canvas ──1:1──► Graph
```
