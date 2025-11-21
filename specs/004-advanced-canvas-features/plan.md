# Implementation Plan: Advanced Canvas Features

**Branch**: 004-advanced-canvas-features | **Date**: 2025-11-18 | **Spec**: [spec.md](./spec.md)

## Summary

Implement multi-canvas workspace management, auto-layout algorithm, reusable sub-graphs with I/O ports, copy/paste operations, and customization features. This transforms MindFlow from a single-canvas tool into a multi-workspace platform with advanced organization and modularity.

**Key Technical Decisions**:
- ELK.js for auto-layout (web worker to prevent UI blocking)
- Template + Instance model for sub-graphs
- In-memory clipboard with best-effort browser clipboard sync
- Each canvas = separate Graph instance (1:1 mapping)

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5.9 (frontend)
**Primary Dependencies**: FastAPI, ReactFlow, Zustand, elkjs (NEW)
**Storage**: JSON files (data/canvases/, data/subgraphs/, data/users/)
**Testing**: pytest (backend), vitest (frontend)
**Target Platform**: Web application (Windows + Linux servers, modern browsers)
**Project Type**: Web (backend + frontend)
**Performance Goals**: Canvas switch <100ms, Auto-layout <500ms for 100 nodes
**Constraints**: Browser clipboard security (handled via in-memory fallback)
**Scale/Scope**: 100+ canvases per user, 100-200 nodes per canvas, 50+ sub-graph templates

## Constitution Check

### PASS - All constitution requirements satisfied

- Graph Integrity: Circular dependency detection, atomic operations
- LLM Provider Agnostic: N/A for this feature
- Explicit Operations: User-initiated, no magic
- Test-First: TDD for all graph operations
- Multiplatform: Windows + Linux compatible
- No Simulation: Real ELK.js integration, real clipboard

## Project Structure

### Documentation (this feature)

```
specs/004-advanced-canvas-features/
├─ plan.md              # This file
├─ spec.md              # Feature specification
├─ research.md          # Phase 0 output
├─ data-model.md        # Phase 1 output
├─ quickstart.md        # Phase 1 output
└─ contracts/           # Phase 1 output
   ├─ canvas-api.md
   └─ subgraph-api.md
```

### Source Code

Backend: src/mindflow/models/ (canvas.py, subgraph.py, preferences.py)
Frontend: frontend/src/features/canvas/ (components, hooks, services)
Tests: tests/ (backend and frontend)

See full structure in section above.

## Implementation Phases

### Phase 0: Research (COMPLETE)
- ELK.js chosen for auto-layout
- Template + Instance model for sub-graphs
- Data structures defined

### Phase 1: Design & Contracts (COMPLETE)
- Data models documented
- API contracts defined
- Quickstart guide created

### Phase 2: Backend Implementation (3-4 days)
- Data models (canvas, subgraph, preferences)
- API routes (/api/canvases, /api/subgraphs)
- Circular dependency detection
- Unit and integration tests

### Phase 3: Frontend Implementation (5-6 days)
- Canvas navigation sidebar
- Copy/paste operations
- Auto-layout with ELK.js
- Sub-graph UI (library, editor, instances)
- Icon customization

### Phase 4: Testing & Refinement (2-3 days)
- Integration testing
- Performance benchmarks
- Cross-browser testing
- Bug fixes and polish

### Phase 5: Documentation & Deployment (1 day)
- Update README
- User guide
- API documentation

## Timeline

Total: 16 days (full-time development)

## Success Criteria

- Canvas switching <100ms
- Auto-layout <500ms for 100 nodes
- Sub-graph creation success rate >80%
- Icon changes <100ms
- Support 50+ sub-graph templates

## Dependencies

- Feature 001: MindFlow Engine (graph model)
- Feature 002: Node Canvas Interface (ReactFlow)
- Feature 003: Node Editor (node CRUD)
- NEW: elkjs ^0.9.0

## Next Steps

1. Review plan with stakeholders
2. Begin Phase 2: Backend implementation
3. Use TDD: tests first, then implement
4. Regular progress updates

---

**Plan Status**: Complete and ready for implementation
**Last Updated**: 2025-11-18
