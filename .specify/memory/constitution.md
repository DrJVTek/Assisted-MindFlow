# MindFlow Engine Constitution

## Core Principles

### I. Graph Integrity (NON-NEGOTIABLE)

The graph must remain in a consistent, valid state at all times:
- Every graph operation MUST be atomic and reversible
- Node relationships MUST maintain referential integrity (no orphaned references)
- Circular dependencies MUST be detected before creation
- Graph operations MUST NOT corrupt existing data on error
- All graph state changes MUST be traceable and auditable

**Rationale**: The graph is the core data structure - corruption is unacceptable. Users must trust that their reasoning chains remain intact.

### II. LLM Provider Agnostic

All LLM interactions MUST go through a unified, provider-independent interface:
- Core graph operations MUST NOT depend on specific LLM providers
- Provider implementations MUST be swappable without code changes
- New providers MUST be addable without modifying existing code
- LLM-specific features MUST be exposed via capabilities API
- Default to local/offline mode when no provider configured

**Rationale**: Today Claude, tomorrow Continuum. The system must outlive any single LLM provider.

### III. Explicit Operations, No Magic (NON-NEGOTIABLE)

All graph modifications MUST be explicit, traceable, and user-controllable:
- AI MUST return explicit graph_actions in structured format
- System MUST log all graph operations with context
- Users MUST be able to review AI-suggested operations before execution (optional review mode)
- Automatic orchestration MUST be opt-in, NEVER default
- Every node MUST record its author (human|llm|tool)

**Rationale**: Trust requires transparency. Users must understand and control what happens to their reasoning graph.

### IV. Test-First for Graph Operations (NON-NEGOTIABLE)

TDD mandatory for all graph operations and LLM integration:
- Tests written → User approved → Tests fail → Then implement
- Every GraphOp (CREATE_NODE, LINK, MERGE_NODES, etc.) MUST have unit tests
- Context engine strategies MUST have tests verifying correct node selection
- LLM provider interface MUST have integration tests with mocked providers
- Circular dependency detection MUST be tested with edge cases
- Red-Green-Refactor cycle strictly enforced

**Rationale**: Graph operations are complex and error-prone. Tests prevent data corruption and regressions.

### V. Context Transparency

Users MUST understand what context is being sent to LLMs:
- System MUST display selected nodes when building context
- Token count MUST be visible before LLM call
- Context strategy and summarization type MUST be user-selectable
- Manual override MUST always be available
- Truncation or summarization MUST be logged and visible

**Rationale**: Context shapes AI responses. Users need to debug and optimize their reasoning process.

### VI. Multiplatform Support (NON-NEGOTIABLE)

ALL code MUST work on Windows and Linux:
- Use platform-agnostic path handling
- Test on both platforms before merge
- Use `#ifdef _WIN32` for platform-specific code when necessary
- No assumptions about file system case sensitivity
- Handle line endings properly (CRLF vs LF)

**Rationale**: Project requirement from CLAUDE.md. Non-negotiable constraint.

### VII. No Simulation or Hardcoded Data

Implementation MUST be real, not mocked:
- NO demo mode or placeholder implementations
- NO hardcoded paths, API keys, or configuration (use config files)
- NO "simple approaches" to circumvent requirements
- If a feature can't be fully implemented, explain why - don't fake it
- ALWAYS test before claiming functionality works

**Rationale**: Project requirement from CLAUDE.md. Simulations create false confidence and waste time.

## Data Persistence and Durability

Graph data MUST be persisted durably:
- All graph state (nodes, groups, comments, edges) MUST survive process restart
- File format MUST be human-readable (JSON or similar)
- Large graphs (100+ nodes) MUST load/save within 3 seconds
- Concurrent modifications MUST be handled safely (file locking or atomic writes)
- Backup/export functionality MUST preserve all relationships

**Format Requirements**:
- Use standard formats (JSON, YAML, or similar)
- Version the data format for future migrations
- Include metadata (created_at, schema_version, etc.)

## Security and Privacy

LLM interactions involve user data - handle carefully:
- API keys MUST be stored in config files, NEVER in code
- User graph content MUST NOT be logged in plain text (sanitize logs)
- Local LLM providers preferred for sensitive reasoning
- Warn users when sending data to cloud LLM providers
- Support offline mode for privacy-critical use cases

## Performance Standards

System MUST remain responsive:
- Graph operations (CREATE_NODE, LINK, etc.) MUST complete in < 100ms for graphs with < 200 nodes
- UI updates MUST reflect changes within 1 second
- Context building MUST complete in < 2 seconds for typical use cases
- LLM response time excluded (depends on provider)
- Memory usage MUST scale linearly with graph size (no memory leaks)

## Development Workflow

### Code Organization
- **Minimal root files**: Only essential files at project root (README.md, LICENSE, build scripts)
- **Source code**: All implementation in `src/` directory
- **Tests**: All tests in `tests/` directory with structure mirroring `src/`
- **Documentation**: All docs in `docs/` directory
- **Temporary/experimental**: Use `workbench/` (git-ignored)

### Testing Requirements
- Minimum 80% code coverage target
- All PRs MUST include tests for new functionality
- Integration tests for LLM provider interface
- Performance tests for large graphs (100+ nodes)
- Edge case tests for circular dependencies, orphaned nodes, etc.

### Code Review
- All code MUST be reviewed before merge
- At least 1 approval required
- Reviewers MUST verify:
  - Tests exist and pass
  - No hardcoded values or simulation code
  - Platform-agnostic code (Windows + Linux)
  - No implementation details leak into interfaces

## Governance

This constitution supersedes all other practices and guidelines.

**Priority Order**:
1. Constitution principles (this file)
2. Project-specific rules in CLAUDE.md
3. Feature specifications in `specs/*/spec.md`
4. Implementation plans in `specs/*/plan.md`

**Amendments**:
- Constitution changes require explicit approval and documentation
- Breaking changes require migration plan
- Version must be incremented on amendments

**Compliance**:
- All PRs/reviews MUST verify constitutional compliance
- Violations MUST be justified or corrected before merge
- When in doubt, refer to Core Principles (sections I-VII)

**Living Document**:
- Constitution evolves with project understanding
- Regular reviews during major milestones
- Community input welcomed for improvements

**Version**: 1.0.0 | **Ratified**: 2025-11-17 | **Last Amended**: 2025-11-17
