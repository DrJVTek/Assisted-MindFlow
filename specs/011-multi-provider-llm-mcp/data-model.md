# Data Model: Multi-Provider LLM & MCP Integration

**Feature**: 011-multi-provider-llm-mcp
**Date**: 2026-03-14

## Entity Relationship Diagram

```
┌──────────────────┐       1:N        ┌──────────────────┐
│  ProviderConfig  │◄─────────────────│      Node        │
│                  │  provider_id     │  (existing)      │
│  id              │                  │  + provider_id   │
│  name            │                  └──────────────────┘
│  type            │                         │
│  color           │                         │ N:1
│  selected_model  │                         ▼
│  endpoint_url    │                  ┌──────────────────┐
│  status          │                  │   DebateChain    │
│  available_models│                  │                  │
│  created_at      │                  │  id              │
└──────────────────┘                  │  graph_id        │
                                      │  start_node_id   │
                                      │  node_ids[]      │
                                      │  round_count     │
                                      │  max_rounds      │
                                      │  status          │
                                      │  created_at      │
                                      └──────────────────┘

┌──────────────────┐       1:N        ┌──────────────────┐
│  MCPConnection   │◄─────────────────│  RemoteMCPTool   │
│                  │  connection_id   │                  │
│  id              │                  │  name            │
│  name            │                  │  description     │
│  transport_type  │                  │  input_schema    │
│  config          │                  │  connection_id   │
│  status          │                  └──────────────────┘
│  created_at      │
└──────────────────┘
```

## Entities

### ProviderConfig (NEW)

Represents a registered LLM provider instance in the registry.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | auto | Unique identifier |
| name | string | yes | User-given display name (e.g., "Work GPT", "My Claude") |
| type | ProviderType enum | yes | One of: `openai`, `anthropic`, `gemini`, `local`, `chatgpt_web` |
| color | string | yes | Hex color code for visual identity (e.g., "#10A37F") |
| selected_model | string | no | Currently selected model ID |
| endpoint_url | string | no | Custom endpoint URL (required for `local` type) |
| status | ProviderStatus enum | auto | `disconnected`, `connected`, `error`, `rate_limited` |
| available_models | list[string] | auto | Models discovered from provider |
| created_at | datetime | auto | Registration timestamp |
| updated_at | datetime | auto | Last modification timestamp |

**Validation rules**:
- `name` must be non-empty, max 100 characters
- `color` must be valid hex (#RRGGBB or #RGB)
- `endpoint_url` required when `type` is `local`
- Multiple instances of the same `type` allowed (unique by `id`)

**State transitions**:
```
disconnected → connected (on successful validation)
connected → error (on API failure)
connected → rate_limited (on 429 response)
error → connected (on re-validation)
rate_limited → connected (after cooldown)
any → disconnected (on provider removal/key revocation)
```

**Credentials** (stored separately in encrypted file):
| Field | Type | Description |
|-------|------|-------------|
| provider_id | UUID | Reference to ProviderConfig |
| api_key | string | For `openai`, `anthropic`, `gemini` types |
| oauth_token | string | For `chatgpt_web` type (or future OAuth flows) |
| refresh_token | string | For OAuth flows requiring refresh |

### Node (MODIFIED — existing entity)

Add one field to existing Node model:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| provider_id | UUID | no | Reference to ProviderConfig. `null` means use default provider (backward compatible). |

**Backward compatibility**: Existing nodes have `provider_id = null`. The system uses a "default provider" (first registered, or system-configured) when `provider_id` is null.

### DebateChain (NEW)

Tracks a debate workflow across connected LLM nodes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | auto | Unique identifier |
| graph_id | UUID | yes | Graph containing the debate nodes |
| start_node_id | UUID | yes | First node in the debate chain |
| node_ids | list[UUID] | yes | Ordered list of node IDs in the chain |
| round_count | int | auto | Current round number (starts at 0) |
| max_rounds | int | yes | Maximum rounds allowed (default: 5) |
| status | DebateStatus enum | auto | `idle`, `running`, `paused`, `completed`, `error` |
| created_at | datetime | auto | Creation timestamp |
| updated_at | datetime | auto | Last activity timestamp |

**Validation rules**:
- `node_ids` must contain at least 2 nodes
- All `node_ids` must exist in the graph
- `max_rounds` must be between 1 and 20
- Cycle detection: if chain forms a loop, `max_rounds` enforced strictly

**State transitions**:
```
idle → running (user triggers debate)
running → paused (user pauses or provider error with remaining nodes)
running → completed (all rounds finished or max_rounds reached)
running → error (all providers failed)
paused → running (user resumes)
completed → running (user triggers "Continue debate")
```

### MCPConnection (NEW)

Represents a connection from MindFlow to an external MCP server.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | auto | Unique identifier |
| name | string | yes | User-given display name (e.g., "File System", "Web Search") |
| transport_type | TransportType enum | yes | `stdio`, `sse`, `streamable_http` |
| config | dict | yes | Transport-specific config (see below) |
| status | ConnectionStatus enum | auto | `disconnected`, `connected`, `error` |
| discovered_tools | list[RemoteMCPTool] | auto | Tools discovered from server |
| created_at | datetime | auto | Registration timestamp |

**Transport config schemas**:
```
stdio:    { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"] }
sse:      { "url": "http://localhost:3001/sse" }
streamable_http: { "url": "http://localhost:3001/mcp" }
```

**Validation rules**:
- `name` must be non-empty, max 100 characters
- `config` must match transport_type schema
- `stdio` config must have a `command` field

### RemoteMCPTool (NEW — embedded in MCPConnection)

Represents a tool discovered from an external MCP server.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | Tool name as reported by MCP server |
| description | string | no | Tool description |
| input_schema | dict | yes | JSON Schema for tool input parameters |
| connection_id | UUID | yes | Reference to parent MCPConnection |

Not persisted separately — rebuilt on connection/reconnection via MCP tool discovery.

## Enums

```
ProviderType:     openai | anthropic | gemini | local | chatgpt_web
ProviderStatus:   disconnected | connected | error | rate_limited
DebateStatus:     idle | running | paused | completed | error
TransportType:    stdio | sse | streamable_http
ConnectionStatus: disconnected | connected | error
```

## Persistence Strategy

| Entity | Storage | File/Location |
|--------|---------|---------------|
| ProviderConfig | JSON file | `data/providers.json` |
| Provider credentials | Encrypted file | `data/secrets/providers.enc` |
| Encryption key | Binary file | `data/secrets/.key` |
| Node.provider_id | Canvas JSON (existing) | `data/canvases/{id}.json` (via graph) |
| DebateChain | In-memory + JSON | `data/debates/{graph_id}.json` |
| MCPConnection | JSON file | `data/mcp_connections.json` |
| RemoteMCPTool | In-memory only | Rebuilt on connection |
