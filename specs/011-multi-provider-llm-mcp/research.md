# Research: Multi-Provider LLM & MCP Integration

**Feature**: 011-multi-provider-llm-mcp
**Date**: 2026-03-14

## R1: MCP Python SDK for Server + Client

**Decision**: Use the official `mcp` Python package (PyPI: `mcp`) for both server and client.

**Rationale**: The `mcp` package is the official Anthropic-maintained MCP SDK. It provides:
- `FastMCP` class for creating MCP servers with decorator-based tool registration
- `ClientSession` + transports (stdio, SSE, streamable HTTP) for MCP client connections
- Built-in tool discovery, schema validation, and protocol compliance
- Actively maintained, well-documented, and compatible with Claude Code, Codex, etc.

**Alternatives considered**:
- Custom MCP implementation: Rejected — the protocol spec is non-trivial, and the SDK handles all edge cases
- Third-party wrappers: Rejected — the official SDK is the standard

**Integration approach**:
- MCP server runs as a separate process or as an additional transport on the FastAPI server
- MCP server tools delegate to the same service layer as the REST API (shared state)
- MCP client connections managed by a `MCPClientManager` service that maintains persistent sessions

## R2: Google Gemini Provider

**Decision**: Use the `google-generativeai` Python package for Gemini API access.

**Rationale**: Official Google SDK, supports both API key and OAuth authentication, streaming, and function calling (tool use). Compatible with the existing `LLMProvider` ABC pattern.

**Alternatives considered**:
- OpenAI-compatible endpoint (Gemini supports this): Simpler but loses Gemini-specific features
- Direct REST calls via httpx: More work, no benefit over the SDK

**Implementation**: New `GeminiProvider` class in `providers/gemini.py` implementing `LLMProvider` ABC.

## R3: Encrypted Credential Storage

**Decision**: Use the `cryptography` library (already a dependency) with Fernet symmetric encryption and a machine-derived key.

**Rationale**:
- `cryptography` is already in `pyproject.toml` (used by `token_storage.py` for OAuth tokens)
- Fernet provides authenticated encryption (AES-128-CBC + HMAC)
- Machine-derived key from `os.urandom()`, stored in a separate key file (`data/secrets/.key`)
- Key file created on first use, persists across restarts
- No user password needed — the key file IS the secret

**Alternatives considered**:
- OS keychain (keyring library): Cross-platform complexity, requires system dependencies on Linux
- Plaintext JSON: Rejected per clarification — user explicitly chose encrypted storage
- Environment variables: Doesn't persist, poor UX for multiple providers

**File layout**:
```
data/secrets/
├── .key                    # Machine-derived encryption key (auto-generated)
└── providers.enc           # Encrypted JSON with all provider credentials
```

## R4: Debate Engine Architecture

**Decision**: Sequential async pipeline using existing edge/child_ids relationships.

**Rationale**:
- Debates follow existing graph edges (parent → child) — no new data structure needed for the graph
- A `DebateChain` model tracks metadata: starting node, round count, max rounds, status
- The engine walks the chain sequentially, calling each provider and accumulating full history
- Cycle detection reuses existing `utils/cycles.py` (networkx-based)
- Full conversation history forwarded as `messages` array (not single prompt concatenation)

**Alternatives considered**:
- Parallel execution with synchronization: Rejected — debates are inherently sequential (each response depends on prior)
- WebSocket-based real-time updates: Rejected — SSE already works well for streaming; debates use existing SSE per-node
- Separate debate graph model: Rejected — reuse existing graph edges and nodes

**Message format for forwarding**:
```python
messages = [
    {"role": "system", "content": "You are participating in a multi-LLM debate..."},
    {"role": "user", "content": original_prompt},
    {"role": "assistant", "content": node_1_response, "name": "Claude"},
    {"role": "user", "content": f"[GPT's perspective]: {node_2_response}"},
    # ... full history
]
```

## R5: MCP Server Tool Design

**Decision**: Expose 8 core tools via MCP server, mapping to existing REST API operations.

**Rationale**: The MCP server is a thin adapter over the existing service layer. Each tool maps to an existing REST endpoint, ensuring consistency between UI and MCP access.

**Tools**:
| Tool | Maps to | Description |
|------|---------|-------------|
| `list_canvases` | GET /api/canvases | List available canvases |
| `get_canvas` | GET /api/canvases/{id} | Get canvas with full graph |
| `read_node` | GET /api/graphs/{gid}/nodes | Read node content and metadata |
| `create_node` | POST /api/graphs/{gid}/nodes | Create a new node |
| `update_node` | PUT /api/graphs/{gid}/nodes/{nid} | Update node content |
| `delete_node` | DELETE /api/graphs/{gid}/nodes/{nid} | Delete a node |
| `trigger_llm` | POST /api/llm-operations | Trigger LLM generation on a node |
| `start_debate` | POST /api/debates | Start a debate chain |

## R6: MCP Client Integration with LLM Tool Use

**Decision**: MCP client tools are exposed to LLMs as standard function-calling tools.

**Rationale**:
- All target LLM providers (OpenAI, Claude, Gemini) support function calling / tool use
- External MCP tools are converted to the provider's tool format (OpenAI function schema, Claude tool schema, etc.)
- When the LLM returns a tool call, the system executes it via the MCP client session and feeds the result back
- This creates a tool-use loop: LLM → tool call → MCP server → result → LLM

**Provider compatibility**:
- OpenAI: `tools` parameter with `function` type
- Anthropic: `tools` parameter with `input_schema`
- Gemini: `tools` parameter with `function_declarations`
- Ollama: OpenAI-compatible tool format (supported by recent versions)

## R7: Provider Registry Persistence

**Decision**: JSON config file + encrypted credentials file, loaded into memory at startup.

**Rationale**:
- Provider metadata (name, type, color, selected model, status) stored in `data/providers.json`
- Credentials (API keys, OAuth tokens) stored separately in `data/secrets/providers.enc`
- Registry loaded into memory at startup, saved on change
- Matches existing pattern (canvases stored as JSON, OAuth tokens encrypted)

**File structure**:
```json
// data/providers.json
{
  "providers": [
    {
      "id": "uuid",
      "name": "My Claude",
      "type": "anthropic",
      "color": "#6B4FBB",
      "selected_model": "claude-sonnet-4-20250514",
      "endpoint_url": null,
      "status": "connected",
      "created_at": "2026-03-14T...",
      "available_models": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"]
    }
  ]
}
```

Credentials in encrypted file reference provider by ID.
