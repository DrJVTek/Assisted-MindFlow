# Research: Plugin System Refonte

**Branch**: `014-plugin-system-refonte` | **Date**: 2026-03-15

## R1: Dirty/Clean Execution Cache Strategy

**Decision**: Per-node dirty/clean flag stored in runtime memory (not persisted). Dirty propagation on input change via graph traversal.

**Rationale**:
- The execution cache is session-scoped — no need to persist across restarts since LLM outputs are already saved to node data.
- Dirty propagation uses the existing `parents`/`children` graph edges — no new data structure needed.
- Implementation: add `_execution_cache: dict[str, tuple]` and `_dirty_nodes: set[str]` to GraphExecutor.
- A node is marked dirty when: (a) its `inputs` or `content` field changes, (b) any ancestor is re-executed.
- The executor checks `_dirty_nodes` before executing each node in topological order. Clean nodes return cached results.

**Alternatives considered**:
- Content-hash-based invalidation (hash inputs, compare): More precise but adds complexity for negligible benefit in this use case (LLM calls are non-deterministic anyway).
- Persistent cache (Redis/file): Overkill for single-user local deployment.

## R2: Strict Plugin Interface Validation

**Decision**: `PluginRegistry._validate_node_class()` must check for: `INPUT_TYPES` (classmethod), `RETURN_TYPES` (tuple), `FUNCTION` (str attribute), and that the method named by `FUNCTION` exists and is callable. Optional: `STREAMING`, `CATEGORY`, `UI`, `RETURN_NAMES`.

**Rationale**:
- The existing `base.py` defines `BaseNode` and `LLMNode` but validation in `registry.py` may not enforce all required attributes.
- Strict validation at load time prevents runtime errors during execution.
- Missing optional attributes get sensible defaults (STREAMING=False, CATEGORY="uncategorized", UI={}).

**Alternatives considered**:
- Python Protocol/ABC enforcement: Too rigid — community plugins shouldn't need to inherit from MindFlow base classes. Duck typing with explicit validation is more flexible (ComfyUI pattern).
- Runtime validation only: Delays errors to execution time, worse UX.

## R3: Dead Code Inventory

**Decision**: Remove the following identified dead code:

| File | Reason |
|------|--------|
| `src/mindflow/utils/llm_providers.py` | Replaced by plugin registry |
| `src/mindflow/utils/openai_provider.py` | Replaced by `providers/openai.py` + `plugins/core/llm_openai/` |
| `src/mindflow/utils/anthropic_provider.py` | Replaced by `providers/anthropic.py` + `plugins/core/llm_anthropic/` |
| `src/mindflow/utils/ollama_provider.py` | Replaced by `providers/ollama.py` + `plugins/core/llm_ollama/` |
| `OperationStateManager` cache reads | If cache is written but never read, remove the read paths |
| `LLMService` class (if still exists) | Replaced by plugin-based execution |

**Rationale**: Dead code creates confusion and maintenance burden. Must verify no imports reference these files before deleting.

**Alternatives considered**:
- Deprecation markers: Adds noise. Since there are no external consumers, deletion is clean.

## R4: ProviderType Enum Alignment

**Decision**: The canonical source of truth for provider types is the backend `ProviderType` enum in `src/mindflow/models/provider.py`. Frontend must mirror it exactly.

**Rationale**:
- Current state: backend has `ProviderType(OPENAI, ANTHROPIC, GEMINI, LOCAL, CHATGPT_WEB)`, frontend may have different values.
- The enum values must match for provider selection, node creation, and credential resolution.
- After alignment, the frontend `ProviderType` in `types/provider.ts` must be auto-generated or manually synced from backend.

**Alternatives considered**:
- Auto-generate TypeScript types from Python: Good long-term but over-engineering for 5 enum values.
- Remove frontend enum, use strings: Loses type safety. Keep the enum but ensure it matches.

## R5: ConnectionValidator Store Deduplication

**Decision**: `ConnectionValidator.tsx` currently fetches `/api/node-types` directly instead of using `nodeTypesStore`. Refactor to use the store.

**Rationale**:
- Duplicated fetch means two separate caches, potential inconsistency.
- `nodeTypesStore` already has `getTypeColor()` and node type lookups.
- The validator should consume the same data source as all other components.

**Alternatives considered**:
- Keep separate fetch with shared cache key: Still duplicated logic. Store is the right abstraction.

## R6: Community Plugin Directory Bootstrap

**Decision**: Create `plugins/community/` with a `README.md` explaining how to add community plugins. No CLI installer, no marketplace — just directory-based loading.

**Rationale**:
- The PluginRegistry already scans multiple directories. Adding `plugins/community/` to the scan list is trivial.
- Full trust model (same as ComfyUI) — warning logged at load time.
- Future CLI installer and marketplace deferred to a later feature.

**Alternatives considered**:
- pip-based plugin installation: More complex, requires virtual environment management. Deferred.
- git submodules: Fragile and user-unfriendly. Deferred.

## R7: Frontend Dynamic Widget Rendering for Optional Inputs

**Decision**: The DetailPanel must render input widgets dynamically based on `INPUT_TYPES` metadata from the plugin. Widget type mapping:

| Plugin Type | Frontend Widget |
|------------|-----------------|
| STRING (multiline=false) | Text input |
| STRING (multiline=true) | Textarea |
| INT | Number input with min/max/step |
| FLOAT | Slider with min/max/step |
| BOOLEAN | Toggle/checkbox |
| COMBO | Dropdown select |
| SECRET | Password input (never displayed, credential store lookup) |

**Rationale**: This is how ComfyUI works — the frontend is entirely metadata-driven. No new component per plugin.

**Alternatives considered**:
- Custom React components per plugin: Defeats the purpose of dynamic UI. Reserved for future "custom widget" plugin API.
