# Research: Plugin Node Architecture

**Feature**: 013-plugin-node-architecture
**Date**: 2026-03-15

## Research Topics

### R1: Plugin Loading Pattern (Python dynamic module import)

**Decision**: Use `importlib.util.spec_from_file_location` + `module_from_spec` for dynamic plugin loading.

**Rationale**: This is the standard Python pattern for loading modules from arbitrary file paths. It's used by ComfyUI, pytest, and many other plugin systems. It works cross-platform, supports relative imports within the plugin, and doesn't require the plugin to be on `sys.path`.

**Alternatives considered**:
- `importlib.import_module()` — requires module on sys.path, less flexible for arbitrary directories
- `exec(open(...).read())` — no proper module context, fragile
- `pkg_resources` / `setuptools` entry points — requires pip install per plugin, too heavy for folder-based discovery
- `__import__()` — lower-level, same limitations as `import_module`

**Implementation detail**: Each plugin directory must contain `__init__.py` with `PLUGIN_MANIFEST` dict and `NODE_CLASS_MAPPINGS` dict. Missing either → skip with warning.

---

### R2: LLM Provider Interface Design

**Decision**: Abstract base class with these mandatory methods:
- `async connect() -> None` — establish connection (verify endpoint, test auth)
- `async disconnect() -> None` — cleanup resources
- `async generate(prompt, model, **kwargs) -> ProviderResponse` — batch generation
- `async stream(prompt, model, **kwargs) -> AsyncIterator[str]` — token-by-token streaming
- `async list_models() -> list[ModelInfo]` — available models for this provider
- `get_status() -> ProviderStatus` — idle/working/error
- `get_progress() -> ProgressInfo | None` — percentage when available
- `required_credentials() -> list[CredentialSpec]` — what credentials are needed

**Rationale**: Covers all use cases identified in the code review:
- OpenAI/Anthropic/Gemini: API key auth, generate + stream
- Ollama: endpoint URL, generate + stream, local model list
- ChatGPT Web: OAuth flow (connect handles token refresh), stream only
- Future providers: same interface, different auth methods

**Alternatives considered**:
- Single `execute()` method with streaming flag — less explicit, harder to type
- Separate `Streamable` mixin — fragile multiple inheritance, all LLM providers need streaming
- Protocol-based (structural typing) — no runtime validation at load time

**Key design decisions**:
- Credentials are injected at construction (`__init__`), not per-call
- `connect()` is called once after construction; it validates credentials work
- Provider instances are independent (no shared state between instances of same type)
- `get_status()` and `get_progress()` are synchronous (read cached state)
- Provider-specific parameters (temperature, max_tokens, etc.) are passed via `**kwargs` to generate/stream — the provider validates them

---

### R3: Node Base Class Design

**Decision**: Two base classes following ComfyUI pattern:

1. **BaseNode** — for all node types:
   - Class attributes: `INPUT_TYPES()` (classmethod), `RETURN_TYPES`, `RETURN_NAMES`, `FUNCTION`, `CATEGORY`, `UI`
   - Instance method: the function named by `FUNCTION` attribute (e.g., `execute()`, `generate()`)

2. **LLMNode(BaseNode)** — extension for LLM-category nodes:
   - Adds `STREAMING = True` class attribute
   - Adds `stream()` method as async generator
   - Holds reference to an `LLMProvider` instance
   - `INPUT_TYPES()` must include a `credentials` section

**Rationale**: ComfyUI's pattern is proven at scale (1000+ community nodes). The class attribute approach (`INPUT_TYPES`, `RETURN_TYPES`) is introspectable, allowing the registry to extract metadata without instantiation. Adding `LLMNode` as a subclass cleanly separates LLM-specific concerns (streaming, provider reference) from general nodes (text transforms, inputs).

**Alternatives considered**:
- Decorator-based node definition — harder to introspect, less familiar
- JSON schema manifests separate from code — creates sync issues between schema and implementation
- Single base class with optional methods — less type safety, harder to validate

---

### R4: Graph Execution Engine — Topological Sort Strategy

**Decision**: DFS-based topological sort with cycle detection, executing from target node backward through ancestors.

**Rationale**:
- The graph is a DAG (directed acyclic graph) by design
- Execution is triggered per-node (not whole graph), so we sort only the sub-graph needed
- DFS is O(V+E), simple to implement, and naturally detects cycles
- Parents execute in batch (await all), terminal node streams via SSE
- Composite nodes are expanded inline: the executor enters the sub-graph, resolves internal topology, and returns composite outputs

**Alternatives considered**:
- Kahn's algorithm (BFS-based) — works but doesn't naturally detect cycles; DFS is more natural for sub-graph extraction
- Whole-graph execution — wasteful when user only triggers one node
- Parallel execution of independent branches — out of scope per spec; sequential is simpler and correct

**Error handling**:
- Cycle detected → `CycleDetectedError` before any execution
- Parent node fails → child nodes marked as cancelled, error propagated
- Execution cancelled mid-way → currently executing node interrupted, downstream cancelled, completed nodes keep results

---

### R5: Type System for Node Connections

**Decision**: 11 built-in types with color-coded connections:

| Type | Color | Description |
|------|-------|-------------|
| STRING | #8BC34A | Text content |
| INT | #2196F3 | Integer |
| FLOAT | #FF9800 | Float |
| BOOLEAN | #9C27B0 | True/False |
| COMBO | #607D8B | Selection from options (frontend-only, not a connection type) |
| SECRET | #F44336 | Encrypted credential (never flows between nodes) |
| CONTEXT | #00BCD4 | Conversation context from parent nodes |
| USAGE | #795548 | Token usage information |
| TOOL_RESULT | #E91E63 | MCP tool execution result |
| EMBEDDING | #3F51B5 | Vector embedding |
| DOCUMENT | #FF5722 | Structured document |

**Rationale**: Covers all current data flows plus anticipated future needs. COMBO and SECRET are special (widget-only and credential-only respectively, not connection types). Type validation happens on the frontend when dragging connections, and on the backend before execution.

**Conversion rules**:
- STRING → CONTEXT: automatic (wraps text as context)
- Any → STRING: automatic (toString representation)
- Others: no implicit conversion, explicit error

---

### R6: Legacy Migration Strategy

**Decision**: Automatic migration at graph load time with version detection.

**Migration rules**:
- Graph without `version` field or `version < "2.0.0"` → legacy format
- Legacy `type: "question"` → `class_type: "llm_chat"` (prompt content preserved)
- Legacy `type: "answer"` → `class_type: "llm_chat"` (response content preserved in same node)
- Legacy `type: "note"` → `class_type: "text_input"`
- Legacy `type: "hypothesis"` → `class_type: "text_input"` with tag "hypothesis"
- Legacy `type: "evaluation"` → `class_type: "text_input"` with tag "evaluation"
- Legacy `type: "summary"` → `class_type: "text_input"` with tag "summary"
- Legacy `type: "plan"` → `class_type: "text_input"` with tag "plan"
- Legacy `type: "group_meta"` → preserved as group metadata (not a node type)
- Legacy `type: "comment"` → preserved as comment annotation (not a node type)
- Legacy `type: "stop"` → `class_type: "text_input"` with tag "stop"

**Rationale**: Clean cut from old to new. The migration happens on load, and the migrated format is saved on next write. This avoids maintaining dual-format support indefinitely. The `llm_chat` node type preserves the dual-zone (prompt/response) behavior of the old question/answer nodes.

---

### R7: Composite Node Serialization

**Decision**: Composite nodes are stored as a named sub-graph definition with parameter bindings.

**Format**:
```json
{
  "composite_definitions": {
    "smart_summary_v1": {
      "name": "Smart Summary",
      "version": "1.0",
      "exposed_params": {
        "summary_type": {"internal_node": "node-2", "internal_param": "mode", "type": "COMBO", "options": ["linear", "temporal"]},
        "max_length": {"internal_node": "node-3", "internal_param": "max_tokens", "type": "INT", "default": 500}
      },
      "inputs": {"text": {"type": "STRING", "maps_to": {"node": "node-1", "input": "text"}}},
      "outputs": [{"type": "STRING", "maps_from": {"node": "node-3", "output": 0}}],
      "internal_graph": {
        "nodes": { ... },
        "connections": { ... }
      }
    }
  }
}
```

**Rationale**: Composite definitions are stored separately from the main graph, referenced by ID. This allows reuse across canvases. Exposed parameters bind to specific internal node inputs. The internal graph follows the same schema as the main graph.

---

### R8: Frontend Dynamic UI Strategy

**Decision**: Fetch `GET /api/node-types` at app startup, cache in Zustand store (`nodeTypesStore`), and render all node UI from this metadata.

**Component mapping from plugin INPUT_TYPES**:
- `STRING` → Textarea (if `multiline: true`) or Input
- `INT` → Number input with min/max/step
- `FLOAT` → Slider or number input with min/max/step
- `BOOLEAN` → Toggle/Checkbox
- `COMBO` → Dropdown/Select
- `SECRET` → Password input (masked)

**Node rendering**:
- Compact canvas view: Node.tsx reads plugin `UI` metadata for color, icon, dimensions
- Detail panel view: DetailPanel.tsx renders full input controls from `INPUT_TYPES`
- Both views are generated from the same plugin metadata — no hardcoded components per node type

**Rationale**: This eliminates the current problem where adding a node type requires modifying Node.tsx, NodeCreator.tsx, and type definitions. The frontend becomes fully data-driven.

---

### R9: Provider Interface vs Node Plugin — Boundary Clarification

**Decision**: Clear separation of concerns:

**LLM Provider Interface** (in `src/mindflow/providers/`):
- Owns: connection lifecycle, authentication, model listing, generate/stream, status/progress
- Does NOT know about: canvas, nodes, graph, UI, plugins
- Instances managed by: ProviderRegistry service (existing, refactored)

**Node Plugin System** (in `src/mindflow/plugins/` + `plugins/`):
- Owns: node type definitions, INPUT_TYPES, RETURN_TYPES, UI hints, execution logic
- LLM node plugins receive a provider instance via their execution method
- The plugin does NOT manage provider lifecycle — it calls `provider.generate()` or `provider.stream()`

**Connection point**: The execution engine resolves which provider instance to use for an LLM node based on the node's `provider_id` configuration, fetches it from the ProviderRegistry, and passes it to the node plugin's execute/stream method.

**Rationale**: This separation means:
1. Adding a new LLM provider = add provider class only (no node plugin needed if using generic `llm_chat` node)
2. Adding a new LLM workflow = add node plugin only (uses existing providers)
3. Provider bugs are isolated from node logic
4. Providers can be tested independently with mock HTTP servers
