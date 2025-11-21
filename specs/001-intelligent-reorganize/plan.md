# Implementation Plan: Intelligent Canvas Reorganize

**Branch**: `001-intelligent-reorganize` | **Date**: 2025-11-21 | **Spec**: [spec.md](./spec.md)

## Summary

Add an intelligent "Reorganize" button to the canvas toolbar that automatically applies hierarchical layout to cluttered node graphs. Uses the existing elkjs library (v0.9.3) to compute optimal node positions while preserving groups, comments, and connections. Layout direction (top-to-bottom, left-to-right, etc.) is user-selectable via context menu. Reorganization is undoable and persists to backend.

**Primary user value**: Users can clean up messy canvases with a single click instead of manually repositioning dozens of nodes.

## Technical Context

**Language/Version**: TypeScript 5.9 (frontend), Python 3.11+ (backend)
**Primary Dependencies**:
- Frontend: React 19.2.0, ReactFlow 11.11.4, elkjs 0.9.3, Zustand 5.0.8
- Backend: FastAPI 0.108.0+, Pydantic 2.6.0+

**Storage**: JSON files in `data/` directory (existing graph persistence)
**Testing**: Frontend: @testing-library/react 16.3.0; Backend: pytest 8.0.0+
**Target Platform**: Web application (Windows/Linux compatible)
**Project Type**: Web application (separate frontend/ and src/ backend)
**Performance Goals**:
- < 3 seconds for 20-50 node reorganization
- < 100ms UI response time for button clicks
- No browser freezing during layout computation

**Constraints**:
- Viewport must maintain current position/zoom (no auto-fit)
- Groups and comment nodes must be preserved
- All node data except positions must remain unchanged
- Must integrate with existing undo/redo system

**Scale/Scope**:
- Target: 50 nodes typical, 100+ nodes edge case
- Single feature addition to existing canvas system
- No new API endpoints required (uses existing graph update API)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Core Principles Compliance

✅ **I. Graph Integrity (NON-NEGOTIABLE)**
- All operations atomic: Layout computation produces new node positions, then single bulk update
- Referential integrity maintained: Only positions change, all edges/groups/comments preserved
- Reversible: Full undo support via existing undo/redo system
- No data corruption: Layout algorithm runs in isolation, validates before applying

✅ **II. LLM Provider Agnostic**
- Feature does not involve LLM interactions - N/A

✅ **III. Explicit Operations, No Magic (NON-NEGOTIABLE)**
- User-triggered only (button click)
- No automatic re-layout
- Clear visual feedback (progress indicator)
- Undo capability preserves user control

✅ **IV. Test-First for Graph Operations (NON-NEGOTIABLE)**
- TDD required for layout computation logic
- Tests for group preservation, cycle handling, disconnected graphs
- Integration tests for undo/redo
- **Note**: Tests will be written before implementation per constitution

✅ **V. Context Transparency**
- Feature does not involve LLM context - N/A

✅ **VI. Multiplatform Support (NON-NEGOTIABLE)**
- Pure TypeScript/Python - platform-agnostic
- No platform-specific dependencies
- elkjs runs in browser (WASM-based)

✅ **VII. No Simulation or Hardcoded Data**
- Real elkjs layout engine integration
- No mock implementations
- Actual node position updates persisted to backend

### Data Persistence and Durability

✅ **Persistence**: Reorganized positions saved to existing graph JSON files
✅ **Format**: Uses existing JSON format for graphs
✅ **Performance**: Existing system handles 100+ nodes within requirements

### Security and Privacy

✅ **No security impact**: Client-side layout computation, standard graph API

### Performance Standards

✅ **Graph operations**: Position updates use existing bulk update (< 100ms)
✅ **UI responsiveness**: Async layout computation with progress indicator
✅ **Memory**: elkjs processes graph in-memory, released after computation

**GATE RESULT: ✅ PASS** - No violations. Feature aligns with all constitutional principles.

## Project Structure

### Documentation (this feature)

```
specs/001-intelligent-reorganize/
├── spec.md                   # Feature specification (completed)
├── plan.md                   # This file
├── research.md               # elkjs integration patterns (Phase 0)
├── data-model.md            # Layout configuration entity (Phase 1)
├── quickstart.md            # Manual testing scenarios (Phase 1)
└── tasks.md                 # Implementation tasks (Phase 2, via /speckit.tasks)
```

### Source Code (repository root)

```
frontend/
├── src/
│   ├── components/
│   │   └── Canvas.tsx                              # Add Reorganize button
│   ├── features/
│   │   └── canvas/
│   │       ├── hooks/
│   │       │   ├── useLayout.ts                    # NEW: Layout computation hook
│   │       │   └── useLayoutConfig.ts              # NEW: Layout config persistence
│   │       ├── services/
│   │       │   └── layoutService.ts                # NEW: elkjs integration
│   │       ├── utils/
│   │       │   ├── elkjsAdapter.ts                 # NEW: Graph format conversion
│   │       │   └── groupPreservation.ts            # NEW: Group boundary logic
│   │       └── components/
│   │           └── LayoutContextMenu.tsx           # NEW: Direction selection menu
│   ├── stores/
│   │   └── canvasStore.ts                          # Extend: layout config state
│   └── types/
│       └── layout.ts                                # NEW: Layout types
└── tests/
    └── features/
        └── canvas/
            ├── layoutService.test.ts                # NEW: elkjs integration tests
            ├── elkjsAdapter.test.ts                 # NEW: Format conversion tests
            └── groupPreservation.test.ts            # NEW: Group logic tests

src/  (Backend - minimal changes)
└── mindflow/
    └── models/
        └── graph.py                                 # Extend: validate layout config

tests/  (Backend - minimal changes)
└── unit/
    └── test_graph_validation.py                    # Extend: layout config tests
```

**Structure Decision**:
- Web application structure (frontend/ + src/ backend)
- Feature implementation primarily in `frontend/src/features/canvas/`
- New dedicated directory for layout logic (`features/canvas/hooks/`, `services/`, `utils/`)
- Backend changes minimal (only validation if needed)
- Follow existing patterns: hooks for React state, services for business logic, utils for pure functions

## Complexity Tracking

**No violations** - Constitution Check passed without exceptions. No complexity justification needed.

## Implementation Strategy

### MVP Definition (User Story 1 - P1)

**Core functionality**:
- Reorganize button in canvas toolbar
- Basic hierarchical layout using elkjs (top-to-bottom direction)
- Apply layout to all nodes on canvas
- Save updated positions to backend
- Undo support via existing system

**Success criteria for MVP**:
- Clicking Reorganize repositions nodes into hierarchical layout
- Edge crossings visibly reduced
- Operation completes in < 3 seconds for 50 nodes
- Undo restores previous positions

**Out of MVP scope** (defer to P2/P3):
- Group/comment preservation (P2)
- Layout direction selection (P3)
- Advanced edge case handling

### Incremental Delivery Plan

**Phase 1: MVP (P1 - Auto-Layout)**
1. Implement basic elkjs integration
2. Add Reorganize button to toolbar
3. Apply layout algorithm to current canvas
4. Persist positions via existing API
5. Integrate with undo/redo

**Phase 2: Group Preservation (P2)**
1. Detect groups in canvas
2. Apply group constraints to elk layout
3. Reposition comments near original adjacencies
4. Test group boundary integrity

**Phase 3: Direction Control (P3)**
1. Add layout config to store
2. Implement context menu for direction selection
3. Pass direction parameter to elkjs
4. Persist user's preferred direction

### Rollback Strategy

- Feature is additive (new button)
- No changes to existing graph operations
- Can be disabled by hiding button (feature flag if needed)
- Undo always available to revert specific reorganizations

## Phase 0: Research

**Objective**: Resolve integration patterns for elkjs, understand group constraints, identify potential issues.

### Research Tasks

1. **elkjs Integration Patterns**
   - Decision needed: How to convert ReactFlow graph to ELK graph format
   - Research: ELK JSON format, node/edge mapping, coordinate system alignment
   - Alternatives: Direct elkjs API vs. wrapper library

2. **Group Preservation Strategy**
   - Decision needed: How to enforce group boundaries during layout
   - Research: ELK's compound node feature, constraint-based layout
   - Alternatives: Pre/post-process groups vs. native ELK compound nodes

3. **Performance Optimization**
   - Decision needed: Web Worker for large graphs, async computation
   - Research: elkjs performance characteristics, browser limitations
   - Alternatives: Synchronous (simple) vs. Web Worker (complex, better UX)

4. **Undo/Redo Integration**
   - Decision needed: How to capture bulk position changes as single operation
   - Research: Existing undo system API, batch update patterns
   - Alternatives: Individual updates vs. bulk snapshot

**Output**: `research.md` documenting decisions with rationale

## Phase 1: Design & Contracts

### Data Model

**Entity**: Layout Configuration

```typescript
interface LayoutConfig {
  direction: 'TB' | 'BT' | 'LR' | 'RL';  // Top-to-bottom, bottom-to-top, left-to-right, right-to-left
  spacing: {
    node: number;      // Minimum space between nodes (default: 50)
    rank: number;      // Space between hierarchy levels (default: 80)
  };
  algorithm: 'layered' | 'force';  // ELK algorithm type (default: layered)
}

// Stored per canvas in canvasStore
interface CanvasStore {
  layoutConfigs: Record<string, LayoutConfig>;  // canvasId -> config
  // ... existing fields
}
```

**Entity**: ELK Graph Format (adapter output)

```typescript
interface ELKNode {
  id: string;
  width: number;
  height: number;
  children?: ELKNode[];  // For groups
}

interface ELKEdge {
  id: string;
  sources: string[];
  targets: string[];
}

interface ELKGraph {
  id: string;
  children: ELKNode[];
  edges: ELKEdge[];
  layoutOptions?: Record<string, string>;
}
```

### API Contracts

**No new API endpoints required** - Feature uses existing graph update API:

```
PUT /api/graphs/{graph_id}
```

Request body includes updated node positions in existing format.

### Test Scenarios (Quickstart)

**Manual Test 1: Basic Reorganization**
1. Create canvas with 15 nodes in random positions
2. Add connections between nodes (tree structure)
3. Click Reorganize button
4. Verify: Nodes arranged hierarchically, edges flow top-to-bottom
5. Verify: Operation completes in < 3 seconds

**Manual Test 2: Group Preservation**
1. Create canvas with 10 nodes
2. Group 5 nodes together
3. Click Reorganize
4. Verify: Grouped nodes stay within group boundary
5. Verify: Group positioned cohesively with ungrouped nodes

**Manual Test 3: Layout Direction**
1. Create canvas with hierarchical structure
2. Right-click Reorganize button
3. Select "Left to Right"
4. Click Reorganize
5. Verify: Layout flows left-to-right
6. Verify: Direction preference persisted

**Manual Test 4: Undo**
1. Organize canvas manually
2. Click Reorganize
3. Click Undo
4. Verify: Nodes return to pre-reorganization positions

**Manual Test 5: Large Graph**
1. Create canvas with 100 nodes
2. Click Reorganize
3. Verify: Progress indicator shows
4. Verify: Completes within reasonable time (< 10 seconds acceptable for 100 nodes)
5. Verify: No browser freezing

## Agent Context Update

After Phase 1 completion, run:

```bash
.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude
```

This will add:
- elkjs integration patterns
- ReactFlow layout application
- Layout configuration management

to `.specify/memory/cline_context.md` (or appropriate agent file).

## Post-Design Constitution Validation

**Date**: 2025-11-21
**Status**: ✅ VALIDATED - No new violations discovered during design phase

After completing Phase 0 (Research) and Phase 1 (Design), re-validating constitutional compliance based on detailed technical decisions:

### Core Principles Compliance (Post-Design)

✅ **I. Graph Integrity (NON-NEGOTIABLE)**
- **Atomicity confirmed**: Per Decision 5 (research.md:158), single `setLocalNodes()` call for batch update
- **Referential integrity confirmed**: Per data-model.md, only `position` field changes, all relationships preserved
- **Reversibility confirmed**: Per Decision 4 (research.md:118), full snapshot-based undo with before/after states
- **Validation confirmed**: Per quickstart.md MT-008, data integrity testing included
- **No new issues discovered**

✅ **II. LLM Provider Agnostic**
- Still N/A - feature does not involve LLM interactions

✅ **III. Explicit Operations, No Magic (NON-NEGOTIABLE)**
- **User control confirmed**: Per quickstart.md MT-007, viewport maintains position (no auto-fit)
- **Progress indicator confirmed**: Per research.md:104, spinner shown during layout
- **No auto-reorganization**: User must click button each time
- **No new issues discovered**

✅ **IV. Test-First for Graph Operations (NON-NEGOTIABLE)**
- **Test scenarios defined**: quickstart.md provides 8 comprehensive manual test scenarios
- **TDD approach confirmed**: research.md:344 lists unit test requirements before implementation
- **Coverage targets set**: Group preservation, cycle handling, disconnected graphs, undo/redo
- **Implementation order enforced**: Tests → Implementation (per constitution Section IV)
- **No new issues discovered**

✅ **V. Context Transparency**
- Still N/A - feature does not involve LLM context

✅ **VI. Multiplatform Support (NON-NEGOTIABLE)**
- **Platform-agnostic confirmed**: TypeScript (browser) + Python (FastAPI) both cross-platform
- **No OS-specific code**: elkjs is WASM-based, runs in any modern browser
- **Path handling confirmed**: JSON persistence uses existing cross-platform graph API
- **No new issues discovered**

✅ **VII. No Simulation or Hardcoded Data**
- **Real elkjs integration confirmed**: research.md:28-45 documents actual elkjs API usage
- **No mock implementations**: layoutService.ts will use real ELK layout engine
- **Configuration via LayoutConfig**: data-model.md defines proper config entity (no hardcoded values)
- **Testing requirement confirmed**: quickstart.md MT-005 requires actual performance validation
- **No new issues discovered**

### Data Persistence and Durability (Post-Design)

✅ **Persistence validated**:
- Per data-model.md, positions persist via existing `PUT /api/graphs/{graph_id}` API
- JSON format unchanged (only position field updates)
- LayoutConfig stored in Zustand (client-side memory) - no backend changes required

✅ **Performance validated**:
- Per research.md:214, performance targets documented: 50 nodes: 40-80ms, 100 nodes: 100-200ms
- Per quickstart.md MT-005, performance testing required before claiming success

### Security and Privacy (Post-Design)

✅ **No security impact**: Still client-side only, no new API surface

### Performance Standards (Post-Design)

✅ **Performance targets confirmed**:
- Graph operations: Bulk position update via single setState call (< 100ms per constitution)
- UI responsiveness: Progress indicator during layout (per research.md:104)
- Memory: elkjs processes in-memory, released after computation (per data-model.md)

### New Considerations from Design Phase

**Configuration Management**:
- LayoutConfig stored per-canvas in Zustand store (data-model.md)
- No hardcoded layout options - all user-configurable
- Default values defined in data-model.md (direction: 'DOWN', spacing: {node: 80, rank: 100})
- ✅ Complies with Constitution Section VII (no hardcoded data)

**Group Preservation Strategy**:
- Per Decision 2 (research.md:52), groups processed separately to maintain integrity
- Per data-model.md, GroupLayoutResult ensures members stay within boundaries
- Per quickstart.md MT-002, group integrity testing required
- ✅ Complies with Constitution Section I (graph integrity)

**Edge Case Handling**:
- Per research.md:377, circular edges handled gracefully (elkjs cycle detection)
- Per quickstart.md MT-006, edge cases explicitly tested
- ✅ Complies with Constitution Section I (no data corruption)

**GATE RESULT: ✅ PASS** - Post-design validation confirms all constitutional principles remain satisfied. No new violations discovered. Feature is ready for task generation.

---

## Next Steps

1. ✅ **Complete Phase 0**: `research.md` generated
2. ✅ **Complete Phase 1**: `data-model.md` and `quickstart.md` generated
3. ✅ **Update agent context**: Script executed successfully
4. ✅ **Re-validate constitution**: Validation complete (see above)
5. **Generate tasks**: Run `/speckit.tasks` to create implementation task list

## Notes

- **elkjs already installed**: Version 0.9.3 in frontend/package.json
- **Minimal backend changes**: Only if layout config needs server-side validation
- **Leverage existing patterns**: ReactFlow hooks, Zustand store, existing API patterns
- **Progressive enhancement**: MVP first (P1), then groups (P2), then direction (P3)
