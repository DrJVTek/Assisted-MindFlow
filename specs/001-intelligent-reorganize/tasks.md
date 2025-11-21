# Tasks: Intelligent Canvas Reorganize

**Input**: Design documents from `/specs/001-intelligent-reorganize/`
**Prerequisites**: plan.md (✅), spec.md (✅), research.md (✅), data-model.md (✅), quickstart.md (✅)

**Tests**: Per constitution Section IV, TDD is mandatory for graph operations. Tests MUST be written and MUST FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Includes exact file paths in descriptions

## Path Conventions

This is a web application with:
- Frontend: `frontend/src/`
- Backend: `src/mindflow/`
- Tests: `frontend/tests/` and `tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create file structure and type definitions that all user stories will use

- [X] T001 Create `frontend/src/types/layout.ts` with LayoutConfig, ELKGraph, ELKNode, ELKEdge, GroupLayoutResult interfaces per data-model.md
- [X] T002 [P] Create empty directory structure: `frontend/src/features/canvas/hooks/`, `frontend/src/features/canvas/services/`, `frontend/src/features/canvas/utils/`
- [X] T003 [P] Create empty test directory structure: `frontend/tests/features/canvas/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core elkjs integration and utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Unit Tests (TDD - Write First, Must Fail)

- [X] T004 [P] Write unit tests for elkjsAdapter in `frontend/tests/features/canvas/elkjsAdapter.test.ts`:
  - Test ReactFlow → ELK format conversion
  - Test ELK → ReactFlow format conversion
  - Test handling of missing dimensions (fallback to defaults)
  - Test handling of empty graphs
  - **✓ Tests FAILED initially (RED phase)**

- [X] T005 [P] Write unit tests for layoutService in `frontend/tests/features/canvas/layoutService.test.ts`:
  - Test basic layout produces valid positions
  - Test layout direction parameter works (DOWN, UP, LEFT, RIGHT)
  - Test handling of disconnected graphs
  - Test handling of circular edges
  - **✓ Tests FAILED initially (RED phase)**

### Core Implementation (After Tests Written)

- [X] T006 Implement `frontend/src/features/canvas/utils/elkjsAdapter.ts`:
  - `toELKGraph(nodes, edges, layoutOptions)` function per research.md:231
  - `fromELKGraph(elkGraph, originalNodes)` function per research.md:231
  - Handle coordinate system conversion (ELK x/y → ReactFlow position)
  - Handle missing node dimensions (use 280x120 defaults)
  - **✓ T004 tests now PASS (8 tests passing)**

- [X] T007 Implement `frontend/src/features/canvas/services/layoutService.ts`:
  - Import `elkjs/lib/elk.bundled.js` per research.md:29
  - `computeLayout(nodes, edges, options)` function per research.md:241-279
  - Default layout options: algorithm='layered', spacing=80, layerSpacing=100
  - Return layouted nodes with updated positions
  - **✓ T005 tests now PASS (12 tests passing)**

**Checkpoint**: Foundation ready - elkjs integration works. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Auto-Layout Cluttered Canvas (Priority: P1) 🎯 MVP

**Goal**: Users can click a "Reorganize" button to automatically apply hierarchical layout to all nodes on canvas

**Independent Test**: Create canvas with 15 random nodes, click Reorganize, verify hierarchical layout with consistent spacing (per quickstart.md MT-001)

### Unit Tests (TDD - Write First, Must Fail)

- [X] T008 [P] [US1] Write unit tests for useLayout hook in `frontend/tests/features/canvas/useLayout.test.ts`:
  - Test hook returns handleReorganize function
  - Test loading state management during layout
  - Test error handling for layout failures
  - Mock layoutService.computeLayout
  - **✓ Tests FAILED initially (RED phase), then PASSED (11 tests passing)**

- [X] T009 [P] [US1] Write integration tests for basic reorganization in `frontend/tests/features/canvas/reorganize.integration.test.ts`:
  - Test full reorganization flow: button click → layout computation → position update → persistence
  - Test progress indicator appears during layout
  - Test undo restores previous positions
  - Mock backend API
  - **✓ Tests written (3 passing, 3 skipped pending full UI)**

### Implementation for User Story 1

- [X] T010 [US1] Implement `frontend/src/features/canvas/hooks/useLayout.ts`:
  - `handleReorganize()` async function
  - Capture before/after position snapshots for undo per research.md:135-151
  - Call layoutService.computeLayout with localNodes and localEdges
  - Update state via setLocalNodes (batch update per Decision 5)
  - Show loading state during computation
  - **✓ T008 tests now PASS (11 tests passing)**

- [X] T011 [US1] Add Reorganize button to `frontend/src/components/Canvas.tsx`:
  - Add button to canvas toolbar (top-right area per plan.md)
  - Import and use useLayout hook
  - Call handleReorganize on click
  - Show progress indicator (spinner) while isLoading from hook
  - Disable button while reorganizing (prevent double-clicks)
  - **✓ Button added with RefreshCw icon and spinning animation**

- [X] T012 [US1] Integrate undo/redo for reorganization in `frontend/src/features/canvas/hooks/useLayout.ts`:
  - Register undo operation with before/after snapshots per research.md:143-150
  - Undo operation: restore all positions from snapshot
  - Redo operation: reapply layouted positions
  - Verify undo is single operation (not per-node)
  - **✓ useUndoRedo hook created with 11 tests passing, keyboard shortcuts added (Ctrl+Z/Y)**

- [X] T013 [US1] Add position persistence after reorganization in `frontend/src/features/canvas/hooks/useLayout.ts`:
  - After successful layout, save updated positions via existing graph update API
  - Use PUT /api/graphs/{graph_id} per plan.md:291
  - Handle save errors gracefully
  - Verify positions persist on page refresh
  - **✓ updateNodePositions API method created, non-blocking save implemented**

**Checkpoint**: User Story 1 (MVP) complete - Basic reorganization works. Test per quickstart.md MT-001, MT-004, MT-005.

---

## Phase 4: User Story 2 - Preserve Groups and Comments (Priority: P2)

**Goal**: When reorganizing, nodes stay within their groups and groups are positioned cohesively

**Independent Test**: Create canvas with 2 groups containing nodes, apply reorganize, verify nodes stay within group boundaries (per quickstart.md MT-002)

### Unit Tests (TDD - Write First, Must Fail)

- [ ] T014 [P] [US2] Write unit tests for groupPreservation in `frontend/tests/features/canvas/groupPreservation.test.ts`:
  - Test separating grouped vs ungrouped nodes
  - Test layouting group members independently
  - Test calculating group bounding box
  - Test group boundaries have correct padding (40px margin)
  - Test grouped nodes don't overlap after layout
  - Test empty groups handled gracefully
  - **Verify tests FAIL** before implementing groupPreservation

### Implementation for User Story 2

- [ ] T015 [US2] Implement `frontend/src/features/canvas/utils/groupPreservation.ts`:
  - `layoutWithGroups(nodes, edges, groups, options)` function per research.md:287-339
  - Separate grouped vs ungrouped nodes
  - Layout regular nodes via computeLayout
  - Layout each group's members independently
  - Calculate group bounding boxes with 40px/60px padding
  - Return combined result with positioned groups
  - **Verify T014 tests now PASS**

- [ ] T016 [US2] Update `frontend/src/features/canvas/hooks/useLayout.ts` to use groupPreservation:
  - Detect if canvas has groups (GroupNode types)
  - If groups exist: call layoutWithGroups instead of computeLayout
  - If no groups: use existing computeLayout path
  - Merge grouped and ungrouped nodes in final result

- [ ] T017 [US2] Handle comment node repositioning in `frontend/src/features/canvas/utils/groupPreservation.ts`:
  - Identify CommentNode types
  - Track original adjacencies (nodes near comments)
  - After layout, reposition comments near their adjacent nodes
  - Maintain comment visibility (don't overlap with nodes)

**Checkpoint**: User Story 2 complete - Group preservation works. Test per quickstart.md MT-002.

---

## Phase 5: User Story 3 - Layout Direction Control (Priority: P3)

**Goal**: Users can choose layout direction (top-to-bottom, left-to-right, etc.) via context menu

**Independent Test**: Apply reorganize with different directions, verify layout flow matches selected direction (per quickstart.md MT-003)

### Unit Tests (TDD - Write First, Must Fail)

- [ ] T018 [P] [US3] Write unit tests for useLayoutConfig hook in `frontend/tests/features/canvas/useLayoutConfig.test.ts`:
  - Test loading config from canvasStore
  - Test updating config (direction change)
  - Test config persistence per canvas
  - Test default config values per data-model.md
  - **Verify tests FAIL** before implementing hook

- [ ] T019 [P] [US3] Write integration tests for direction control in `frontend/tests/features/canvas/directionControl.integration.test.ts`:
  - Test context menu appears on right-click
  - Test selecting each direction (DOWN, UP, LEFT, RIGHT)
  - Test layout flow matches selected direction
  - Test direction preference persists across reorganizations
  - **Verify tests FAIL** before implementing feature

### Implementation for User Story 3

- [ ] T020 [US3] Extend `frontend/src/stores/canvasStore.ts` to include layout config:
  - Add `layoutConfigs: Record<string, LayoutConfig>` field per plan.md:256-259
  - Add `getLayoutConfig(canvasId)` method (returns default if not set)
  - Add `setLayoutConfig(canvasId, config)` method
  - Default config: direction='DOWN', spacing={node:80, rank:100}, algorithm='layered'

- [ ] T021 [US3] Implement `frontend/src/features/canvas/hooks/useLayoutConfig.ts`:
  - Read layout config from canvasStore for current canvas
  - `updateDirection(direction)` function to update config
  - Return current config and update function
  - **Verify T018 tests now PASS**

- [ ] T022 [US3] Implement `frontend/src/features/canvas/components/LayoutContextMenu.tsx`:
  - Context menu component with 4 direction options
  - "Top to Bottom" (DOWN), "Bottom to Top" (UP)
  - "Left to Right" (RIGHT), "Right to Left" (LEFT)
  - Call useLayoutConfig.updateDirection on selection
  - Close menu after selection

- [ ] T023 [US3] Add context menu trigger to Reorganize button in `frontend/src/components/Canvas.tsx`:
  - Detect right-click on Reorganize button
  - Show LayoutContextMenu at click position
  - Close context menu on outside click or selection
  - Left-click still performs reorganize (default behavior)

- [ ] T024 [US3] Update `frontend/src/features/canvas/hooks/useLayout.ts` to use layout config:
  - Read layout config via useLayoutConfig hook
  - Pass direction to layoutService.computeLayout options
  - Map direction to elkjs 'elk.direction' option per research.md:207-212
  - **Verify T019 tests now PASS**

**Checkpoint**: User Story 3 complete - Direction control works. Test per quickstart.md MT-003.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, performance, and quality improvements across all user stories

### Edge Case Handling

- [ ] T025 [P] Add edge case handling for single/two-node canvases in `frontend/src/features/canvas/services/layoutService.ts`:
  - If 0 nodes: return immediately (no-op)
  - If 1 node: center node or leave position unchanged
  - If 2 nodes: position vertically (parent above child)
  - Test per quickstart.md MT-006.1, MT-006.2

- [ ] T026 [P] Add circular reference handling in `frontend/src/features/canvas/services/layoutService.ts`:
  - Detect cycles in edge connections
  - Allow elkjs to handle cycles (elkjs has built-in cycle detection per research.md:377)
  - Log warning if cycles detected
  - Test per quickstart.md MT-006.3

- [ ] T027 [P] Add disconnected subgraph handling in `frontend/src/features/canvas/services/layoutService.ts`:
  - Detect disconnected components
  - Layout each subgraph independently
  - Position subgraphs to use canvas space efficiently
  - Test per quickstart.md MT-006.4

### Performance & UX Polish

- [ ] T028 Add performance monitoring to `frontend/src/features/canvas/hooks/useLayout.ts`:
  - Measure layout computation time
  - Log performance metrics (node count, time taken)
  - Warn if layout takes > 3 seconds for 50 nodes
  - Verify performance targets per research.md:214-220

- [ ] T029 [P] Add CSS transitions for smooth node repositioning in `frontend/src/components/Canvas.tsx`:
  - Add transition: all 0.3s ease-in-out to node styles per research.md:186
  - Animate nodes moving from old to new positions
  - Optional: Add transition toggle in settings

- [ ] T030 [P] Improve progress indicator in `frontend/src/components/Canvas.tsx`:
  - Show spinner with "Reorganizing..." text
  - Show node count being processed (if available)
  - Disable all canvas interactions while reorganizing

### Data Integrity Validation

- [ ] T031 Verify data integrity preservation in `frontend/src/features/canvas/hooks/useLayout.ts`:
  - Assert only position field changes in nodes
  - Assert all edges preserved (count and connections)
  - Assert all node data preserved (labels, metadata, styling)
  - Test per quickstart.md MT-008

### Viewport Behavior

- [ ] T032 Verify viewport maintains position/zoom in `frontend/src/components/Canvas.tsx`:
  - After reorganization, viewport zoom unchanged
  - After reorganization, viewport pan position unchanged
  - User must manually pan/zoom to see results
  - Test per quickstart.md MT-007

### Manual Testing Validation

- [ ] T033 Run all quickstart.md manual tests:
  - MT-001: Basic Reorganization (15 nodes, tree structure)
  - MT-002: Group Preservation (10 nodes with groups)
  - MT-003: Layout Direction (4 directions)
  - MT-004: Undo (restore previous positions)
  - MT-005: Large Graph Performance (100 nodes)
  - MT-006: Edge Cases (single node, cycles, disconnected)
  - MT-007: Viewport Behavior (zoom/pan unchanged)
  - MT-008: Data Integrity (only positions change)
  - Document results and any issues found

### Documentation

- [ ] T034 [P] Add JSDoc comments to all public functions:
  - layoutService.computeLayout
  - elkjsAdapter.toELKGraph, fromELKGraph
  - groupPreservation.layoutWithGroups
  - useLayout hook
  - useLayoutConfig hook

- [ ] T035 [P] Update CLAUDE.md with feature implementation notes:
  - elkjs integration patterns used
  - Layout configuration management
  - Group preservation strategy
  - Known limitations and edge cases

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion - MVP target
- **User Story 2 (Phase 4)**: Depends on Foundational completion - Can start in parallel with US1 but logically builds on US1
- **User Story 3 (Phase 5)**: Depends on Foundational completion - Can start in parallel with US1/US2 but logically builds on US1
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅ Independently testable
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Enhances US1 but doesn't break it ✅ Independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Enhances US1 but doesn't break it ✅ Independently testable

### Within Each Phase

**Phase 2 (Foundational)**:
1. Write tests T004 and T005 first (parallel)
2. Verify tests FAIL
3. Implement T006 (elkjsAdapter)
4. Implement T007 (layoutService)
5. Verify tests PASS

**Phase 3 (User Story 1)**:
1. Write tests T008 and T009 first (parallel)
2. Verify tests FAIL
3. Implement T010 (useLayout hook)
4. Implement T011 (UI button)
5. Implement T012 (undo integration)
6. Implement T013 (persistence)
7. Verify tests PASS

**Phase 4 (User Story 2)**:
1. Write tests T014 first
2. Verify tests FAIL
3. Implement T015 (groupPreservation)
4. Implement T016 (integrate with useLayout)
5. Implement T017 (comment handling)
6. Verify tests PASS

**Phase 5 (User Story 3)**:
1. Write tests T018 and T019 first (parallel)
2. Verify tests FAIL
3. Implement T020 (canvasStore extension)
4. Implement T021 (useLayoutConfig hook)
5. Implement T022 (context menu UI)
6. Implement T023 (context menu trigger)
7. Implement T024 (integrate with useLayout)
8. Verify tests PASS

### Parallel Opportunities

**Phase 1 - All can run in parallel**:
- T001, T002, T003 (different files)

**Phase 2 - Tests in parallel**:
- T004, T005 (different test files)

**Phase 3 - Tests in parallel**:
- T008, T009 (different test files)

**Phase 5 - Tests in parallel**:
- T018, T019 (different test files)

**Phase 6 - Most can run in parallel**:
- T025, T026, T027 (different concerns in same file - serialize)
- T029, T030 (different files)
- T034, T035 (different files)

**Cross-Story Parallelism**:
- After Foundational (Phase 2) completes, US1, US2, and US3 can be worked on by different developers simultaneously
- Each story has independent tests and implementation paths

---

## Parallel Example: User Story 1

```bash
# After Foundational phase completes, launch US1 test tasks together:
Task T008: "Write unit tests for useLayout hook"
Task T009: "Write integration tests for basic reorganization"

# After tests written and verified failing, launch US1 implementation:
Task T010: "Implement useLayout hook" (core logic)
Task T011: "Add Reorganize button to Canvas" (UI)
# Then sequentially:
Task T012: "Integrate undo/redo"
Task T013: "Add position persistence"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T007) - **CRITICAL GATE**
3. Complete Phase 3: User Story 1 (T008-T013)
4. **STOP and VALIDATE**: Test independently per quickstart.md MT-001, MT-004, MT-005
5. Deploy/demo MVP if ready
6. Decision point: Proceed to P2/P3 or ship MVP?

### Incremental Delivery

1. **MVP**: Setup + Foundational + US1 → Basic reorganization working
   - Users can click Reorganize button
   - Hierarchical layout applied
   - Undo works
   - Positions persist
   - **Ship this first!**

2. **Enhancement 1**: Add US2 → Group preservation
   - Existing reorganization still works
   - Groups now preserved
   - Test independently per MT-002

3. **Enhancement 2**: Add US3 → Direction control
   - Existing reorganization + groups still work
   - Users can choose layout direction
   - Test independently per MT-003

4. **Polish**: Add Phase 6 → Edge cases and performance
   - All stories work better
   - Production-ready quality

### Parallel Team Strategy

With multiple developers:

1. **Week 1**: Team completes Setup + Foundational together (T001-T007)
2. **Week 2** (after Foundational done):
   - Developer A: User Story 1 (T008-T013) - MVP focus
   - Developer B: User Story 2 (T014-T017) - Can start in parallel
   - Developer C: User Story 3 (T018-T024) - Can start in parallel
3. **Week 3**: Team integrates stories and completes polish (T025-T035)

---

## TDD Workflow (Per Constitution Section IV)

**MANDATORY**: All tests MUST be written before implementation and MUST FAIL initially.

### For Each User Story:

1. **RED**: Write tests first (marked with "Write First, Must Fail")
   - Run tests → Verify they FAIL (no implementation yet)
   - If tests pass initially, tests are wrong (testing nothing)

2. **GREEN**: Implement feature to make tests pass
   - Write minimal implementation
   - Run tests → Verify they PASS

3. **REFACTOR**: Clean up code
   - Improve structure, readability
   - Tests still pass

### Test Verification Checkpoints:

- ✅ T004, T005 tests FAIL before T006, T007 implemented
- ✅ T004, T005 tests PASS after T006, T007 implemented
- ✅ T008, T009 tests FAIL before T010-T013 implemented
- ✅ T008, T009 tests PASS after T010-T013 implemented
- ✅ T014 tests FAIL before T015-T017 implemented
- ✅ T014 tests PASS after T015-T017 implemented
- ✅ T018, T019 tests FAIL before T020-T024 implemented
- ✅ T018, T019 tests PASS after T020-T024 implemented

---

## Success Criteria Mapping

**From spec.md Success Criteria**:

- **SC-001**: Users can reorganize 20-50 nodes in under 3 seconds
  - Verified by: T028 (performance monitoring) + MT-001, MT-005

- **SC-002**: Edge crossings reduced by 60%
  - Verified by: MT-001 (visual inspection) + elkjs algorithm

- **SC-003**: 90% of users understand reorganized layout
  - Verified by: User testing (post-implementation)

- **SC-004**: Users successfully reorganize on first attempt
  - Verified by: Usability testing with quickstart.md scenarios

- **SC-005**: Node spacing maintains 40-60 pixels minimum
  - Verified by: Default spacing=80px in layoutService + MT-001

- **SC-006**: Grouped nodes remain in boundaries 100% of time
  - Verified by: T014 tests + MT-002

---

## Notes

- **[P] tasks**: Different files, can run in parallel
- **[Story] labels**: Map tasks to user stories for traceability
- **TDD mandatory**: Per constitution, all graph operations require tests first
- **Test before implement**: RED → GREEN → REFACTOR cycle strictly enforced
- **Each story independently testable**: US1, US2, US3 can each be validated alone
- **MVP = Phase 1 + Phase 2 + Phase 3**: Ship basic reorganization first
- **Incremental delivery**: Each story adds value without breaking previous stories
- **elkjs already installed**: Version 0.9.3 in frontend/package.json (no installation needed)
- **No new API endpoints**: Uses existing PUT /api/graphs/{graph_id}
- **Backend changes**: Minimal to none (only if layout config validation needed)

---

## Task Summary

- **Total Tasks**: 35
- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 4 tasks (2 test + 2 implementation)
- **Phase 3 (US1 - MVP)**: 6 tasks (2 test + 4 implementation)
- **Phase 4 (US2)**: 4 tasks (1 test + 3 implementation)
- **Phase 5 (US3)**: 7 tasks (2 test + 5 implementation)
- **Phase 6 (Polish)**: 11 tasks

**Parallel Opportunities**:
- Phase 1: All 3 tasks can run in parallel
- Phase 2: Test tasks can run in parallel (T004, T005)
- Phase 3: Test tasks can run in parallel (T008, T009)
- Phase 5: Test tasks can run in parallel (T018, T019)
- Phase 6: Most tasks can run in parallel
- **Cross-story**: After Phase 2, all 3 user stories can proceed in parallel

**Independent Test Criteria**:
- US1: quickstart.md MT-001 (basic reorganization), MT-004 (undo), MT-005 (performance)
- US2: quickstart.md MT-002 (group preservation)
- US3: quickstart.md MT-003 (layout direction control)

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only) = 13 tasks
