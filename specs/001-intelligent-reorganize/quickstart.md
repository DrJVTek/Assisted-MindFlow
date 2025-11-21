# Manual Testing Guide: Intelligent Canvas Reorganize

**Feature**: 001-intelligent-reorganize
**Date**: 2025-11-21
**Purpose**: Step-by-step manual test scenarios for validating the reorganize feature

## Prerequisites

- Backend server running on `http://localhost:8000`
- Frontend dev server running on `http://localhost:5173`
- At least one canvas created in the system
- Browser with developer console open for monitoring errors

## Test Environment Setup

### Creating Test Data

Use the following node structures for consistent testing:

**Small Graph (15 nodes)**:
```
Root
├── A1
│   ├── B1
│   ├── B2
│   └── B3
├── A2
│   ├── B4
│   └── B5
└── A3
    ├── B6
    ├── B7
    └── B8
```

**Medium Graph (50 nodes)**: Expand each leaf node with 3-5 children

**Large Graph (100 nodes)**: Use script or duplicate medium graph twice

---

## Manual Test 1: Basic Reorganization (P1 - MVP)

**Test ID**: MT-001
**User Story**: User Story 1 - Auto-Layout Cluttered Canvas
**Priority**: P1 (MVP)
**Estimated Duration**: 5 minutes

### Objective
Verify that clicking Reorganize repositions nodes into a clean hierarchical layout.

### Steps

1. **Setup**:
   - Open canvas
   - Create 15 nodes in random positions (use drag to scatter them)
   - Add connections to form a tree structure (per diagram above)
   - Take screenshot of "before" state

2. **Execute**:
   - Locate "Reorganize" button in canvas toolbar (top-right area)
   - Click the Reorganize button
   - Observe for progress indicator (spinner or animation)

3. **Verify Layout**:
   - Nodes are repositioned into hierarchical structure
   - Root nodes appear at top
   - Child nodes appear below their parents
   - Spacing is consistent (minimum 80px between nodes visually)
   - No node overlaps

4. **Verify Performance**:
   - Operation completes in < 3 seconds (check browser console if timing logs available)
   - No browser freezing during operation

5. **Verify Persistence**:
   - Refresh the page
   - Verify reorganized positions are maintained (not reverted to original)

6. **Verify Edge Routing**:
   - Edges flow from parent to child clearly
   - Edge crossings are minimized (count crossings, should be < 3 for this structure)

### Expected Results

✅ **Pass Criteria**:
- All nodes repositioned without overlap
- Hierarchical structure is clear (top-to-bottom flow)
- Operation completes in < 3 seconds
- Positions persist after page refresh
- Edge crossings reduced compared to random placement

❌ **Fail Criteria**:
- Any node overlaps
- Layout is still cluttered/unclear
- Operation takes > 3 seconds
- Positions not saved (revert on refresh)
- Browser freezes or errors in console

### Acceptance Mapping

- **AC-001** (spec.md:20): Nodes repositioned into hierarchical layout ✅
- **AC-002** (spec.md:21): Edge crossings minimized ✅
- **FR-008** (spec.md:77): Completes in < 2 seconds for 50 nodes (< 3 seconds for 15 nodes) ✅
- **SC-001** (spec.md:94): 20-50 nodes in under 3 seconds ✅

---

## Manual Test 2: Group Preservation (P2)

**Test ID**: MT-002
**User Story**: User Story 2 - Preserve Groups and Comments
**Priority**: P2
**Estimated Duration**: 7 minutes

### Objective
Verify that nodes within groups remain grouped after reorganization.

### Steps

1. **Setup**:
   - Open canvas
   - Create 10 nodes in random positions
   - Select 5 nodes
   - Use "Group" action to create a group (GroupNode)
   - Add connections between nodes (some inside group, some outside)
   - Take screenshot of "before" state

2. **Execute**:
   - Click Reorganize button
   - Observe progress indicator

3. **Verify Group Integrity**:
   - All 5 grouped nodes remain within the group boundary
   - Group container resized appropriately to fit members
   - Group boundary has visible padding (40px margin)

4. **Verify Group Positioning**:
   - Group positioned cohesively with ungrouped nodes
   - Group treated as single unit in overall layout
   - Connections to/from group are clear

5. **Verify Member Layout**:
   - Nodes inside group are organized (not random)
   - Spacing inside group is consistent
   - No overlaps within group

6. **Verify Persistence**:
   - Refresh page
   - Verify group membership and positions maintained

### Expected Results

✅ **Pass Criteria**:
- All grouped nodes stay within group boundary
- Group container properly sized with padding
- Group positioned logically with other nodes
- Members organized within group
- Group membership persists after refresh

❌ **Fail Criteria**:
- Any grouped node positioned outside group
- Group boundary too small (nodes clipped)
- Group boundary too large (excessive whitespace)
- Members inside group still randomly positioned
- Group membership lost after reorganization

### Acceptance Mapping

- **AC-006** (spec.md:36): Nodes remain within groups ✅
- **AC-008** (spec.md:38): Grouped nodes maintain internal structure ✅
- **FR-004** (spec.md:73): Group membership preserved ✅
- **SC-006** (spec.md:99): Grouped nodes remain in boundaries 100% of time ✅

---

## Manual Test 3: Layout Direction (P3)

**Test ID**: MT-003
**User Story**: User Story 3 - Layout Direction Control
**Priority**: P3
**Estimated Duration**: 10 minutes

### Objective
Verify that users can control layout direction and that the preference is remembered.

### Steps

1. **Setup**:
   - Open canvas
   - Create hierarchical structure (15 nodes, 3 levels deep)
   - Click Reorganize (default direction) → verify top-to-bottom layout

2. **Test Left-to-Right**:
   - Right-click the Reorganize button
   - Select "Left to Right" from context menu
   - Click Reorganize
   - **Verify**: Root nodes on left, children to the right

3. **Test Right-to-Left**:
   - Right-click Reorganize button
   - Select "Right to Left"
   - Click Reorganize
   - **Verify**: Root nodes on right, children to the left

4. **Test Bottom-to-Top**:
   - Right-click Reorganize button
   - Select "Bottom to Top"
   - Click Reorganize
   - **Verify**: Root nodes at bottom, children above

5. **Test Top-to-Bottom** (reset to default):
   - Right-click Reorganize button
   - Select "Top to Bottom"
   - Click Reorganize
   - **Verify**: Root nodes at top, children below

6. **Test Preference Persistence**:
   - Set direction to "Left to Right"
   - Click Reorganize
   - Refresh the page
   - Click Reorganize again
   - **Verify**: Layout still flows left-to-right (preference remembered)

### Expected Results

✅ **Pass Criteria**:
- All four directions work correctly
- Context menu accessible via right-click
- Layout flow matches selected direction
- Direction preference persists across page refreshes
- Direction preference persists across multiple reorganizations

❌ **Fail Criteria**:
- Context menu doesn't appear
- Layout doesn't match selected direction
- Preference not persisted (reverts to default)
- Any direction produces incorrect layout

### Acceptance Mapping

- **AC-009** (spec.md:52): Top-to-bottom layout works ✅
- **AC-010** (spec.md:53): Left-to-right layout works ✅
- **AC-011** (spec.md:54): Direction preference remembered ✅
- **FR-013** (spec.md:82): Context menu for direction selection ✅

---

## Manual Test 4: Undo (P1 - MVP)

**Test ID**: MT-004
**User Story**: User Story 1 - Auto-Layout Cluttered Canvas (undo requirement)
**Priority**: P1 (MVP)
**Estimated Duration**: 3 minutes

### Objective
Verify that users can undo a reorganization operation to restore previous layout.

### Steps

1. **Setup**:
   - Open canvas
   - Create 10 nodes in specific positions (arrange them in a circle manually)
   - Take screenshot/note of positions

2. **Execute Reorganization**:
   - Click Reorganize
   - Verify nodes are repositioned hierarchically

3. **Execute Undo**:
   - Use undo keyboard shortcut (Ctrl+Z or Cmd+Z)
   - OR click Undo button if available

4. **Verify Restoration**:
   - All nodes return to original circular positions
   - No nodes in incorrect positions
   - Edge connections maintained

5. **Execute Redo** (if supported):
   - Use redo keyboard shortcut (Ctrl+Y or Cmd+Shift+Z)
   - Verify nodes return to hierarchical layout

6. **Test Multiple Undo/Redo**:
   - Perform several manual node moves
   - Click Reorganize
   - Undo multiple times
   - Verify each operation undoes correctly
   - Verify reorganization is treated as single undo operation (not per-node)

### Expected Results

✅ **Pass Criteria**:
- Undo restores all nodes to pre-reorganization positions
- Reorganization is single undo operation (one Ctrl+Z undoes entire reorganization)
- Redo reapplies reorganization correctly
- Undo/redo stack handles mixed operations (manual moves + reorganization)

❌ **Fail Criteria**:
- Undo doesn't work or only restores some nodes
- Reorganization creates multiple undo steps (requires multiple Ctrl+Z)
- Redo doesn't reapply reorganization
- Undo/redo causes position inconsistencies

### Acceptance Mapping

- **AC-003** (spec.md:22): User retains control (via undo) ✅
- **FR-009** (spec.md:78): Users can undo reorganization ✅
- **Decision 4** (research.md:118): Bulk position changes as single undo operation ✅

---

## Manual Test 5: Large Graph Performance (P1 - MVP)

**Test ID**: MT-005
**User Story**: User Story 1 - Auto-Layout Cluttered Canvas (performance requirement)
**Priority**: P1 (MVP)
**Estimated Duration**: 10 minutes

### Objective
Verify that reorganization handles large graphs (100+ nodes) without freezing the browser.

### Steps

1. **Setup 50-Node Graph**:
   - Use duplicate/copy feature or manual creation
   - Create 50 nodes with interconnections
   - Scatter them randomly on canvas

2. **Test 50-Node Performance**:
   - Open browser developer tools → Performance tab
   - Start performance recording
   - Click Reorganize
   - Stop recording when complete
   - **Measure**: Time from click to completion

3. **Verify 50-Node Results**:
   - Check recorded time (should be < 3 seconds per SC-001)
   - Verify no browser freezing
   - Verify progress indicator shown

4. **Setup 100-Node Graph**:
   - Duplicate the 50-node graph or add 50 more nodes
   - Scatter them randomly

5. **Test 100-Node Performance**:
   - Repeat performance recording
   - Click Reorganize
   - **Measure**: Time from click to completion

6. **Verify 100-Node Results**:
   - Check recorded time (should be < 10 seconds acceptable per plan.md)
   - Verify no browser freezing
   - Verify progress indicator shown throughout
   - Verify layout is still clear and organized

### Expected Results

✅ **Pass Criteria**:
- 50 nodes: Completes in < 3 seconds
- 100 nodes: Completes in < 10 seconds
- No browser freezing during either test
- Progress indicator visible during operation
- Layout remains clear and readable for both sizes
- No console errors or warnings

❌ **Fail Criteria**:
- 50 nodes takes > 3 seconds
- 100 nodes takes > 15 seconds
- Browser freezes (UI unresponsive)
- No progress indicator shown
- Layout becomes unclear at larger sizes
- Console errors or memory warnings

### Acceptance Mapping

- **FR-008** (spec.md:77): Typical canvases (up to 50 nodes) in < 2 seconds ✅
- **SC-001** (spec.md:94): 20-50 nodes in under 3 seconds ✅
- **Edge Case** (spec.md:63): 100+ nodes with progress indicator ✅
- **Performance Targets** (research.md:214): 50 nodes: 100-200ms, 100 nodes: 200-500ms ✅

### Performance Benchmarks

| Node Count | Target Time | Acceptable Time | Fail Threshold |
|-----------|-------------|-----------------|----------------|
| 20 nodes  | < 1 second  | < 2 seconds     | > 3 seconds    |
| 50 nodes  | < 2 seconds | < 3 seconds     | > 5 seconds    |
| 100 nodes | < 5 seconds | < 10 seconds    | > 15 seconds   |

---

## Manual Test 6: Edge Cases (P1 - MVP)

**Test ID**: MT-006
**User Story**: Edge Cases from spec.md:59
**Priority**: P1 (MVP)
**Estimated Duration**: 15 minutes

### Objective
Verify that reorganization handles unusual graph structures correctly.

### Test 6.1: Single Node Canvas

**Steps**:
1. Create canvas with exactly 1 node
2. Click Reorganize
3. **Verify**: No errors, node position unchanged or centered

**Pass Criteria**: No errors, operation completes gracefully

---

### Test 6.2: Two Nodes Canvas

**Steps**:
1. Create canvas with 2 connected nodes
2. Click Reorganize
3. **Verify**: Nodes positioned vertically (parent above child)

**Pass Criteria**: Proper hierarchy maintained even with minimal nodes

---

### Test 6.3: Circular References

**Steps**:
1. Create 3 nodes: A → B → C → A (cycle)
2. Click Reorganize
3. **Verify**: No infinite loop, cycle broken intelligently

**Pass Criteria**: Layout completes, cycle handled gracefully (per research.md:377)

---

### Test 6.4: Disconnected Subgraphs

**Steps**:
1. Create two separate subgraphs:
   - Subgraph 1: A → B → C
   - Subgraph 2: X → Y → Z
   - No connections between subgraphs
2. Click Reorganize
3. **Verify**: Both subgraphs organized independently, positioned to use space efficiently

**Pass Criteria**: Each subgraph laid out hierarchically, both visible on canvas

---

### Test 6.5: Empty Canvas

**Steps**:
1. Create canvas with no nodes
2. Click Reorganize
3. **Verify**: No errors, button disabled or no-op

**Pass Criteria**: Graceful handling, no crashes

---

### Acceptance Mapping

- **Edge Case 1** (spec.md:60): Single/two nodes ✅
- **Edge Case 2** (spec.md:61): Circular references ✅
- **Edge Case 3** (spec.md:63): 100+ nodes ✅ (covered in MT-005)
- **Edge Case 4** (spec.md:64): Disconnected subgraphs ✅

---

## Manual Test 7: Viewport Behavior (P1 - MVP)

**Test ID**: MT-007
**Clarification Decision**: Q1 Answer B (spec.md:64)
**Priority**: P1 (MVP)
**Estimated Duration**: 3 minutes

### Objective
Verify that viewport maintains current position and zoom after reorganization.

### Steps

1. **Setup**:
   - Create 20 nodes spread across large area
   - Zoom in to 150%
   - Pan viewport to focus on specific section (e.g., top-right quadrant)
   - Note current zoom level and visible nodes

2. **Execute Reorganization**:
   - Click Reorganize
   - Wait for completion

3. **Verify Viewport State**:
   - **Zoom level**: Still at 150% (not reset to 100%)
   - **Pan position**: Still focused on same area (not auto-fit to show all nodes)
   - User must manually pan to see reorganization results

4. **Test Zoom Persistence**:
   - Zoom out to 50%
   - Click Reorganize again
   - **Verify**: Zoom stays at 50%

### Expected Results

✅ **Pass Criteria**:
- Viewport zoom level unchanged
- Viewport pan position unchanged
- User retains control over view
- No automatic "fit to screen" behavior

❌ **Fail Criteria**:
- Viewport resets to 100% zoom
- Viewport auto-fits to show all nodes
- Pan position jumps unexpectedly

### Acceptance Mapping

- **Clarification Q1** (spec.md:64): Viewport maintains position/zoom ✅
- **Assumption** (spec.md:108): Users pan/zoom manually ✅

---

## Manual Test 8: Data Integrity (P1 - MVP)

**Test ID**: MT-008
**User Story**: FR-012 (spec.md:81)
**Priority**: P1 (MVP)
**Estimated Duration**: 5 minutes

### Objective
Verify that reorganization only changes positions, not node data, connections, or properties.

### Steps

1. **Setup**:
   - Create 10 nodes with diverse data:
     - Different node types (if supported)
     - Custom labels/titles
     - Node metadata (colors, tags, etc.)
     - Styled nodes (if supported)
   - Create 15 edges between nodes
   - Note all node IDs, labels, and edge connections

2. **Execute Reorganization**:
   - Click Reorganize

3. **Verify Node Data**:
   - Check each node's label → unchanged
   - Check each node's metadata → unchanged
   - Check each node's styling → unchanged
   - Check each node's type → unchanged

4. **Verify Edge Data**:
   - Count edges → same count (15)
   - Check edge source/target IDs → unchanged
   - Check edge styling/labels → unchanged

5. **Verify in Backend**:
   - Open browser network tab
   - Find PUT request to `/api/graphs/{id}`
   - Check request payload → only `position` field changed in nodes
   - Verify no other fields modified

### Expected Results

✅ **Pass Criteria**:
- Only node positions changed
- All node data preserved (labels, metadata, styling)
- All edge connections preserved (count, source/target)
- Backend receives only position updates

❌ **Fail Criteria**:
- Any node data lost or modified
- Any edges lost or disconnected
- Backend receives changes to non-position fields

### Acceptance Mapping

- **FR-012** (spec.md:81): Preserve all data except positions ✅
- **FR-001** (research.md:44): Graph Integrity principle ✅

---

## Regression Testing Checklist

After implementing the feature, verify these existing features still work:

- [ ] Manual node dragging still works
- [ ] Node creation/deletion works
- [ ] Edge creation/deletion works
- [ ] Group creation/deletion works
- [ ] Double-click to edit node works
- [ ] Multi-select works
- [ ] Context menu on canvas works
- [ ] Save/load canvas works
- [ ] Canvas switching works
- [ ] Undo/redo for non-reorganize operations works

---

## Test Reporting Template

```markdown
## Test Execution Report

**Test ID**: MT-XXX
**Date**: YYYY-MM-DD
**Tester**: [Name]
**Build/Commit**: [commit hash]

### Result: ✅ PASS / ❌ FAIL

### Observations:
- [Note any unexpected behavior]
- [Performance measurements]
- [Screenshots/videos]

### Issues Found:
- [Issue 1 description]
- [Issue 2 description]

### Notes:
[Any additional context]
```

---

## Automated Test Conversion

These manual tests should be converted to automated tests where possible:

- **MT-001**: Automated E2E test for basic reorganization
- **MT-004**: Automated unit test for undo/redo integration
- **MT-005**: Automated performance benchmark test
- **MT-008**: Automated integration test for data integrity

See `tests/` directory for automated test implementations.

---

## References

- **spec.md**: Feature specification with requirements
- **plan.md**: Implementation plan with phases
- **research.md**: Technical decisions and benchmarks
- **data-model.md**: Entity schemas and validation rules
