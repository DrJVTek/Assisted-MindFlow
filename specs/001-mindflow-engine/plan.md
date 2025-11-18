# Implementation Plan: MindFlow Engine (Speckit)

**Branch**: `001-mindflow-engine` | **Date**: 2025-11-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mindflow-engine/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build an AI-assisted visual reasoning engine based on graph nodes (MindMap) with centralized LLM management and optional automatic orchestration. The system enables users to create, navigate, and manipulate reasoning graphs where nodes represent thoughts (questions, answers, hypotheses, etc.) and edges represent logical relationships. AI assistants (Claude, GPT, local models) analyze graph context and respond with both human-readable explanations and explicit graph operations.

**Technical Approach**: Implement as a library-first architecture with core graph engine, pluggable LLM provider interface, context selection engine, and JSON-based operation protocol. Engine exposes operations via unified API. UI layer (separate concern) communicates with engine via this API.

## Technical Context

**Language/Version**: Python 3.11+ (resolved via research.md: best LLM SDK ecosystem, multiplatform, rapid prototyping)
**Primary Dependencies**: anthropic>=0.18.0, openai>=1.12.0, networkx>=3.2, pydantic>=2.6.0, tiktoken>=0.6.0 (see research.md for full rationale)
**Storage**: JSON files (human-readable, version-controlled) with future option for SQLite/database
**Testing**: pytest>=8.0.0 with pytest-mock>=3.12.0, pytest-asyncio>=0.23.0
**Target Platform**: Multiplatform (Windows + Linux) - NON-NEGOTIABLE from CLAUDE.md
**Project Type**: Single library project (engine only, UI separate)
**Performance Goals**:
- Graph operations < 100ms for graphs with < 200 nodes
- Context building < 2 seconds
- Support 100+ nodes with 200+ edges without lag
**Constraints**:
- Multiplatform (Windows + Linux)
- No hardcoded API keys or paths (config files only)
- Token budget limits for LLM calls
- Must work offline (local LLM mode)
**Scale/Scope**:
- Typical use: 10-200 nodes per graph
- Edge cases: Up to 1000 nodes
- Multiple LLM providers (5+ initially)
- 50+ functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Required Checks (from constitution.md)

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| **I. Graph Integrity** | Operations atomic/reversible | ⚠️ DESIGN REQUIRED | Must design transaction mechanism for graph ops |
| **I. Graph Integrity** | Referential integrity enforced | ⚠️ DESIGN REQUIRED | Need parent/child consistency checks |
| **I. Graph Integrity** | Circular dependency detection | ⚠️ DESIGN REQUIRED | Must implement cycle detection algorithm |
| **I. Graph Integrity** | Error handling without corruption | ⚠️ DESIGN REQUIRED | Rollback mechanism for failed operations |
| **I. Graph Integrity** | Traceability of changes | ✅ PASS | Spec includes author field and timestamps |
| **II. LLM Provider Agnostic** | Unified interface | ✅ PASS | Spec requires unified interface (FR-001, FR-002) |
| **II. LLM Provider Agnostic** | Provider swappable | ✅ PASS | setActiveProvider() in spec |
| **II. LLM Provider Agnostic** | New providers addable | ✅ PASS | Capabilities API allows extension |
| **II. LLM Provider Agnostic** | Offline/local default | ✅ PASS | Local providers (llama.cpp, Ollama) supported |
| **III. Explicit Operations** | AI returns graph_actions | ✅ PASS | Spec requires JSON format (FR-031) |
| **III. Explicit Operations** | Operation logging | ⚠️ DESIGN REQUIRED | Need logging strategy |
| **III. Explicit Operations** | Optional review mode | ⚠️ DESIGN REQUIRED | User approval workflow for AI ops |
| **III. Explicit Operations** | Orchestration opt-in | ✅ PASS | FR-035: disabled by default |
| **III. Explicit Operations** | Author tracking | ✅ PASS | Node.author field in spec |
| **IV. Test-First** | TDD for graph ops | ⚠️ PROCESS | Enforced during implementation |
| **IV. Test-First** | Unit tests for GraphOps | ⚠️ PROCESS | Will be required in /speckit.tasks |
| **IV. Test-First** | Integration tests for LLMs | ⚠️ PROCESS | Mock provider testing required |
| **V. Context Transparency** | Display selected nodes | ⚠️ DESIGN REQUIRED | Context preview mechanism |
| **V. Context Transparency** | Token count visible | ⚠️ DESIGN REQUIRED | Token counting utility |
| **V. Context Transparency** | Strategy selectable | ✅ PASS | FR-024, FR-025 define strategies |
| **V. Context Transparency** | Manual override available | ✅ PASS | ManualOverride strategy in spec |
| **VI. Multiplatform** | Windows + Linux support | ✅ PASS | Platform-agnostic approach |
| **VI. Multiplatform** | Path handling | ⚠️ IMPLEMENTATION | Use pathlib (Python) or path (Node.js) |
| **VI. Multiplatform** | Line ending handling | ⚠️ IMPLEMENTATION | JSON format handles this |
| **VII. No Simulation** | Real implementations only | ✅ PASS | Spec is concrete, no placeholders |
| **VII. No Simulation** | No hardcoded config | ✅ PASS | Config file approach |
| **VII. No Simulation** | Test before claiming | ⚠️ PROCESS | TDD enforces this |

**Gate Status**: ⚠️ CONDITIONAL PASS - Design phase (Phase 1) must address all "DESIGN REQUIRED" items. Process items enforced during implementation.

**Items requiring Phase 1 design**:
1. Transaction mechanism for atomic graph operations
2. Referential integrity enforcement strategy
3. Cycle detection algorithm
4. Operation rollback mechanism
5. Logging strategy and format
6. User approval workflow for AI operations
7. Context preview mechanism
8. Token counting utility

## Project Structure

### Documentation (this feature)

```text
specs/001-mindflow-engine/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── graph-ops.json   # GraphOp interface definitions
│   ├── llm-provider.json # LLM provider interface
│   ├── context-engine.json # Context selection interface
│   └── orchestrator.json   # Orchestration interface
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── models/
│   ├── node.py/ts           # Node entity
│   ├── group.py/ts          # Group entity
│   ├── comment.py/ts        # Comment entity
│   └── graph.py/ts          # Graph container
├── services/
│   ├── graph_engine.py/ts   # Core graph operations
│   ├── llm_manager.py/ts    # LLM provider management
│   ├── context_engine.py/ts # Context selection strategies
│   └── orchestrator.py/ts   # Automatic orchestration
├── providers/
│   ├── base.py/ts           # Base LLM provider interface
│   ├── claude.py/ts         # Claude implementation
│   ├── openai.py/ts         # OpenAI implementation
│   ├── local.py/ts          # Local model (llama.cpp/Ollama)
│   └── ...                  # Other providers
├── utils/
│   ├── validation.py/ts     # Schema validation
│   ├── cycles.py/ts         # Cycle detection
│   └── tokens.py/ts         # Token counting
└── cli/
    └── main.py/ts           # CLI interface (optional)

tests/
├── unit/
│   ├── test_models.py/ts
│   ├── test_graph_ops.py/ts
│   ├── test_context.py/ts
│   └── test_cycles.py/ts
├── integration/
│   ├── test_llm_providers.py/ts
│   └── test_orchestration.py/ts
└── contract/
    └── test_api_contracts.py/ts

config/
└── config.example.json      # Example configuration

docs/
└── (documentation files)

workbench/
└── (temporary experiments, git-ignored)
```

**Structure Decision**: Single library project as the MindFlow Engine is a backend reasoning engine without UI. Future UI will be separate application consuming this library. Structure follows standard library layout with clear separation between models (data), services (business logic), providers (external integrations), and utilities.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations requiring justification. All constitutional requirements either pass or require design/implementation work tracked in Constitution Check table above.
