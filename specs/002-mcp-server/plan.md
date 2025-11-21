# Implementation Plan: MCP Server Integration

**Feature**: 002-mcp-server
**Created**: 2025-11-21
**Status**: Phase 0 Complete (Planning)
**Estimated Duration**: 4 weeks

---

## Table of Contents

1. [Technical Context](#technical-context)
2. [Constitution Compliance Check](#constitution-compliance-check)
3. [Project Structure](#project-structure)
4. [Phase 0: Research & Planning](#phase-0-research--planning-complete)
5. [Phase 1: Core MCP Client](#phase-1-core-mcp-client-week-1)
6. [Phase 2: Configuration UI](#phase-2-configuration-ui-week-2)
7. [Phase 3: LLM Tool Integration](#phase-3-llm-tool-integration-week-3)
8. [Phase 4: Advanced Features](#phase-4-advanced-features-week-4)
9. [Dependencies](#dependencies)
10. [Security Considerations](#security-considerations)
11. [Testing Strategy](#testing-strategy)
12. [Success Metrics](#success-metrics)

---

## Technical Context

### Current Stack

**Backend**:
- Python 3.11+ | FastAPI 0.121.2 | SQLite + SQLAlchemy
- httpx 0.28.1 (already present) | asyncio + uvicorn

**Frontend**:
- React 19.2.0 | Zustand 5.0.8 | axios 1.13.2
- lucide-react 0.554.0 | Vite 7.2.2

**Testing**:
- pytest + pytest-asyncio | Vitest 4.0.10 + Testing Library 16.3.0

### New Dependencies Required

**Backend** (add to `requirements.txt`):
```
cryptography==43.0.0          # Credential encryption
jsonschema==4.23.0            # Tool parameter validation
```

---

## Constitution Compliance Check

### ✅ Principle I: Graph Integrity (NON-NEGOTIABLE)
- MCP does NOT modify graph structure directly
- Tools can create nodes/edges via explicit LLM actions
- All graph operations through existing GraphOps

### ✅ Principle II: LLM Provider Agnostic
- MCP tools → generic function format
- Works with Claude, GPT-4, local models
- No provider-specific features

### ✅ Principle III: Explicit Operations, No Magic (NON-NEGOTIABLE)
- All tool invocations logged
- Users view complete history
- Tool permissions enforce control
- Confirmation for sensitive operations

### ✅ Principle IV: Test-First (NON-NEGOTIABLE)
- TDD enforced for all MCP services
- Unit, integration, E2E tests

### ✅ Principle V: Context Transparency
- Available tools shown in LLM prompt
- Tool usage logged and visible
- Tool details accessible

### ✅ Principle VI: Multiplatform Support (NON-NEGOTIABLE)
- SQLite (Windows + Linux)
- HTTP transport (platform-agnostic)
- No platform-specific code

### ✅ Principle VII: No Simulation or Hardcoded Data
- No demo servers hardcoded
- Users configure their own servers
- Real MCP protocol implementation

### ✅ Principle VIII: Data Persistence
- All configs persisted in SQLite
- Credentials encrypted at rest
- Survives process restart

### ✅ Principle IX: Security and Privacy
- Credentials encrypted (Fernet)
- No logging of secrets
- Input validation (SSRF prevention)
- Rate limiting + tool permissions

### ✅ Principle X: Performance Standards
- Tool discovery cached (5 min TTL)
- Connection pooling
- Async operations
- P90 latency target: < 5 seconds

### ✅ Principle XI: Development Workflow
- Minimal root files
- All code in `src/mindflow/`
- Tests in `tests/`

---

## Project Structure

### New Files to Create

```
src/mindflow/
├── api/routes/mcp.py                       # NEW: MCP REST API
├── services/
│   ├── mcp_client.py                       # NEW: HTTP MCP client
│   ├── mcp_config.py                       # NEW: Config manager
│   ├── mcp_discovery.py                    # NEW: Tool discovery
│   ├── mcp_invocation.py                   # NEW: Tool invocation
│   ├── credential_store.py                 # NEW: Encryption
│   └── llm_integration.py                  # NEW: LLM functions
├── models/
│   ├── mcp_server.py                       # NEW: MCPServer model
│   ├── mcp_tool.py                         # NEW: MCPTool model
│   ├── mcp_resource.py                     # NEW: MCPResource model
│   ├── mcp_prompt.py                       # NEW: MCPPrompt model
│   └── tool_invocation.py                  # NEW: ToolInvocation model
└── schemas/mcp_schemas.py                  # NEW: Pydantic schemas

frontend/src/
├── components/mcp/
│   ├── MCPSettingsPanel.tsx                # NEW: Main settings UI
│   ├── ServerList.tsx                      # NEW: Server list
│   ├── ServerCard.tsx                      # NEW: Server card
│   ├── ServerDialog.tsx                    # NEW: Add/Edit form
│   ├── TestConnectionButton.tsx            # NEW: Connection test
│   ├── ToolPermissionsPanel.tsx            # NEW: Permissions UI
│   └── ToolHistoryPanel.tsx                # NEW: History UI
├── stores/mcpStore.ts                      # NEW: Zustand store
├── services/mcpApi.ts                      # NEW: API client
└── types/mcp.ts                            # NEW: TypeScript types

tests/
├── unit/
│   ├── test_mcp_client.py
│   ├── test_credential_store.py
│   └── test_mcp_config.py
├── integration/
│   ├── test_mcp_api.py
│   ├── test_mcp_discovery.py
│   └── test_llm_mcp.py
└── e2e/test_mcp_workflow.py

specs/002-mcp-server/examples/              # NEW: Example servers
```

---

## Phase 0: Research & Planning (COMPLETE)

**Duration**: 2 days | **Status**: ✅ **COMPLETE**

### Deliverables
- [x] research.md (2000+ lines)
- [x] data-model.md (1200+ lines)
- [x] contracts/api-mcp.yaml
- [x] contracts/mcp-protocol.yaml
- [x] quickstart.md
- [x] plan.md (this file)

---

## Phase 1: Core MCP Client (Week 1)

**Duration**: 5 days | **Priority**: P0 (Foundation)

### Goals
- Implement HTTP-based MCP client
- Create database models and migrations
- Implement credential encryption
- Write comprehensive unit tests

### Day 1: Database Models

**Files**: `src/mindflow/models/mcp_*.py` (5 models)

**Key Implementation**:
```python
# MCPServer model with encryption support
class MCPServer(Base):
    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True)
    url = Column(String(1024))
    auth_token_encrypted = Column(Text)
    status = Column(Enum(ServerStatus))
    # ... see data-model.md
```

**Acceptance Criteria**:
- [ ] All 5 models created
- [ ] Database migrations generated
- [ ] Helper methods implemented
- [ ] Unit tests pass

### Day 2: Credential Store

**Files**: `src/mindflow/services/credential_store.py`

**Key Implementation**:
```python
class CredentialStore:
    def __init__(self, encryption_key: bytes = None):
        self.cipher = Fernet(encryption_key)

    def encrypt(self, plaintext: str) -> str:
        encrypted = self.cipher.encrypt(plaintext.encode())
        return base64.b64encode(encrypted).decode()
```

**Acceptance Criteria**:
- [ ] Fernet encryption works
- [ ] Encrypt/decrypt roundtrip
- [ ] Wrong key fails
- [ ] Unit tests pass

### Day 3-4: MCP HTTP Client

**Files**: `src/mindflow/services/mcp_client.py`

**Key Implementation**:
```python
class MCPHTTPClient:
    async def _call(self, method: str, params: dict) -> dict:
        payload = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params
        }
        response = await self.session.post(f"{self.base_url}/mcp", json=payload)
        # Handle response...
```

**Acceptance Criteria**:
- [ ] list_tools() works
- [ ] call_tool() works
- [ ] JSON-RPC 2.0 format correct
- [ ] Error handling works
- [ ] 80%+ test coverage

### Day 5: Configuration Manager

**Files**: `src/mindflow/services/mcp_config.py`

**Key Implementation**:
```python
class MCPConfigManager:
    def get_all_servers(self) -> List[MCPServer]:
        # Load from DB
        db_servers = self.db.query(MCPServer).all()
        # Load from file (skip duplicates)
        file_servers = self.load_file_config()
        # Merge (DB takes precedence)
```

**Acceptance Criteria**:
- [ ] Loads from database
- [ ] Loads from YAML file
- [ ] DB servers take precedence
- [ ] Unit tests pass

### Phase 1 Deliverables
- [ ] 5 database models with migrations
- [ ] CredentialStore with encryption
- [ ] MCPHTTPClient with JSON-RPC
- [ ] MCPConfigManager
- [ ] 45+ unit tests (80%+ coverage)

---

## Phase 2: Configuration UI (Week 2)

**Duration**: 5 days | **Priority**: P1 (User Story 1 & 2)

### Goals
- Build REST API for MCP management
- Create React UI for server configuration
- Implement connection testing
- Enable tool discovery

### Day 1: REST API Endpoints

**Files**: `src/mindflow/api/routes/mcp.py`

**Endpoints**:
```
POST   /api/mcp/servers           # Create server
GET    /api/mcp/servers           # List servers
PUT    /api/mcp/servers/{id}      # Update server
DELETE /api/mcp/servers/{id}      # Delete server
POST   /api/mcp/servers/{id}/test # Test connection
```

**Acceptance Criteria**:
- [ ] All CRUD endpoints work
- [ ] Credentials encrypted before storage
- [ ] Validation errors return 400
- [ ] Integration tests pass

### Day 2-3: Frontend Components

**Files**: `frontend/src/components/mcp/` (6 components)

**Key Components**:
- MCPSettingsPanel (main UI)
- ServerList (display servers)
- ServerCard (individual server)
- ServerDialog (add/edit form)
- TestConnectionButton (test connection)

**Acceptance Criteria**:
- [ ] UI renders server list
- [ ] Add/edit server works
- [ ] Test connection shows results
- [ ] Loading/error states handled
- [ ] Component tests pass

### Day 4: State Management

**Files**:
- `frontend/src/stores/mcpStore.ts`
- `frontend/src/services/mcpApi.ts`

**Acceptance Criteria**:
- [ ] Zustand store manages state
- [ ] API client handles endpoints
- [ ] Error handling in API client
- [ ] Store tests pass

### Day 5: Integration & E2E Tests

**Files**: `tests/e2e/test_mcp_ui.py`

**Acceptance Criteria**:
- [ ] E2E tests cover full workflow
- [ ] Tests run in CI
- [ ] All tests passing

### Phase 2 Deliverables
- [ ] 7 REST API endpoints
- [ ] 6 React components
- [ ] Zustand store + API client
- [ ] 21+ integration tests
- [ ] 8+ E2E tests

---

## Phase 3: LLM Tool Integration (Week 3)

**Duration**: 5 days | **Priority**: P2 (User Story 3)

### Goals
- Enable AI to discover MCP tools
- Convert MCP tools to LLM function format
- Handle tool calls from LLM
- Implement agentic workflow

### Day 1: Tool Discovery Service

**Files**: `src/mindflow/services/mcp_discovery.py`

**Key Implementation**:
```python
class ToolDiscoveryService:
    async def discover_all_tools(self, force_refresh=False):
        # Discover from all enabled servers
        # Update database with new tools
        # Cache for 5 minutes
```

**Acceptance Criteria**:
- [ ] Discovers tools from all servers
- [ ] Caches tools (5 min TTL)
- [ ] Updates/creates tools in DB
- [ ] Tests pass

### Day 2: LLM Integration Service

**Files**: `src/mindflow/services/llm_integration.py`

**Key Implementation**:
```python
class LLMIntegration:
    async def get_available_functions(self):
        # Convert MCP tools to LLM function format
        tools = await self.discovery.discover_all_tools()
        return [tool.to_llm_function() for tool in tools if tool.enabled]
```

**Acceptance Criteria**:
- [ ] Converts to LLM function format
- [ ] Works with Claude, GPT-4
- [ ] Only includes enabled tools
- [ ] Tests pass

### Day 3: Tool Invocation Service

**Files**: `src/mindflow/services/mcp_invocation.py`

**Key Implementation**:
```python
class ToolInvoker:
    async def invoke(self, tool_id, arguments, session_id=None):
        # Create invocation record
        # Invoke tool via MCP client
        # Log success/error
        # Update statistics
```

**Acceptance Criteria**:
- [ ] Invokes tools via MCP
- [ ] Creates invocation records
- [ ] Updates statistics
- [ ] Respects permissions
- [ ] Tests pass

### Day 4: Agentic Workflow

**Files**: `src/mindflow/services/agentic_workflow.py`

**Key Implementation**:
```python
class AgenticWorkflow:
    async def run(self, user_message, max_iterations=10):
        # Multi-turn conversation
        # LLM decides when to use tools
        # Invoke tools and return results
        # Continue until done
```

**Acceptance Criteria**:
- [ ] Multi-turn conversations work
- [ ] Tool calls handled correctly
- [ ] Stops at max iterations
- [ ] Tests pass

### Day 5: API Endpoints

**Files**: `src/mindflow/api/routes/mcp.py` (modify)

**New Endpoints**:
```
POST /api/mcp/tools/invoke      # Invoke tool
GET  /api/mcp/invocations       # List history
```

**Acceptance Criteria**:
- [ ] Endpoints work
- [ ] Filtering works
- [ ] Integration tests pass

### Phase 3 Deliverables
- [ ] ToolDiscoveryService
- [ ] LLMIntegration service
- [ ] ToolInvoker service
- [ ] AgenticWorkflow
- [ ] 2 new API endpoints
- [ ] 36+ integration tests

---

## Phase 4: Advanced Features (Week 4)

**Duration**: 5 days | **Priority**: P3 (User Story 4 & 5)

### Goals
- Tool usage history UI
- Tool permissions management UI
- Performance optimizations
- Documentation

### Day 1: Tool History UI

**Files**: `frontend/src/components/mcp/ToolHistoryPanel.tsx`

**Acceptance Criteria**:
- [ ] Displays recent invocations
- [ ] Filtering works
- [ ] Detail view shows full data
- [ ] Tests pass

### Day 2: Tool Permissions UI

**Files**: `frontend/src/components/mcp/ToolPermissionsPanel.tsx`

**Acceptance Criteria**:
- [ ] Lists all tools
- [ ] Enable/disable toggle
- [ ] Confirmation toggle
- [ ] Tests pass

### Day 3: Performance Optimizations

**Tasks**:
- Connection pooling
- Parallel tool invocation
- Database query optimization
- Result caching

**Acceptance Criteria**:
- [ ] P90 latency < 5 seconds
- [ ] Cache hit rate > 80%
- [ ] Performance tests pass

### Day 4-5: Documentation & Polish

**Files**:
- `specs/002-mcp-server/examples/file_server.py`
- `specs/002-mcp-server/examples/calculator_server.py`

**Acceptance Criteria**:
- [ ] Example servers work
- [ ] All tests passing
- [ ] No critical bugs

### Phase 4 Deliverables
- [ ] Tool history UI
- [ ] Tool permissions UI
- [ ] Performance optimizations
- [ ] Example MCP servers (3)
- [ ] All tests passing

---

## Dependencies

### Python (Add to requirements.txt)
```
cryptography==43.0.0
jsonschema==4.23.0
```

### Frontend
No new dependencies (all present)

### External
- MCP servers (user-provided)
- LLM API key

---

## Security Considerations

- **Credentials**: Fernet encryption, no logging
- **Input Validation**: URL validation (SSRF prevention), parameter sanitization
- **Rate Limiting**: 100 calls/min per server
- **Tool Permissions**: Enable/disable, confirmation dialogs
- **Audit Logging**: All invocations logged

---

## Testing Strategy

### Unit Tests (80% Coverage)
- Backend: ~45 tests (models + services)
- Frontend: ~28 tests (components + store)

### Integration Tests
- API endpoints: ~21 tests
- MCP client + mock: ~5 tests
- Tool discovery: ~5 tests
- Tool invocation: ~5 tests
- Total: ~36 tests

### E2E Tests
- User workflows: ~5 scenarios
- AI tool usage: ~3 scenarios
- Total: ~8 tests

### Performance Tests
- Tool discovery: < 2s
- Tool invocation P90: < 5s
- UI responsiveness: < 200ms
- Total: ~5 tests

**Grand Total**: 120+ tests

---

## Success Metrics

### User Adoption
- **Target**: 50% users configure 1+ server within 30 days
- **Measure**: Server creation count / active users

### Tool Usage
- **Target**: 1000+ invocations per week
- **Measure**: ToolInvocation table

### Success Rate
- **Target**: 95%+ success rate
- **Measure**: success_count / total_count

### Performance
- **Target**: P90 latency < 5s
- **Measure**: invocation duration_ms

### User Satisfaction
- **Target**: 4+ stars average
- **Measure**: User survey

---

## Reference Information

### Documentation
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/api-mcp.yaml](./contracts/api-mcp.yaml)
- [contracts/mcp-protocol.yaml](./contracts/mcp-protocol.yaml)

### External Resources
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Anthropic Function Calling](https://docs.anthropic.com/claude/docs/tool-use)

---

**Plan Complete**: Comprehensive 4-week implementation plan with clear deliverables, acceptance criteria, and testing requirements. Constitution compliance verified.
