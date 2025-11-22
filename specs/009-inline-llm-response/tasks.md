# Tasks: Inline LLM Response Display

**Input**: Design documents from `/specs/009-inline-llm-response/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/node-schema.json, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Note**: Tests are included per constitution requirement IV (Test-First for Graph Operations). Node schema changes and auto-launch require tests.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Web app structure: `backend/src/`, `frontend/src/`
- Tests: `backend/tests/`, `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and basic infrastructure setup

- [ ] T001 [P] Install react-markdown dependencies in frontend (npm install react-markdown remark-gfm rehype-highlight)
- [ ] T002 [P] Import highlight.js CSS theme in frontend/src/main.tsx
- [ ] T003 [P] Extend Node type with new fields in frontend/src/types/graph.ts (llm_response, llm_operation_id, font_size, node_width, node_height)
- [ ] T004 [P] Extend Node model with new fields in backend/src/models/graph.py (llm_response, llm_operation_id, font_size, node_width, node_height)

**Checkpoint**: Dependencies installed, type definitions updated

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create MarkdownRenderer component in frontend/src/components/MarkdownRenderer.tsx (XSS-safe rendering with react-markdown, remarkGfm, rehypeHighlight)
- [ ] T006 Unit test for MarkdownRenderer in frontend/tests/unit/MarkdownRenderer.test.tsx (test markdown rendering and XSS sanitization)
- [ ] T007 Update node CRUD schema validation in backend/src/api/nodes.py to accept new optional fields
- [ ] T008 Unit test for Node model persistence in backend/tests/unit/test_node_model.py (verify new fields persist and validate correctly)

**Checkpoint**: Foundation ready - markdown renderer tested, schema validated, user story implementation can begin in parallel

---

## Phase 3: User Story 1 - Auto-Launch LLM on Node Creation (Priority: P1) 🎯 MVP

**Goal**: Automatically launch LLM operation when node is created with question content, streaming response into node

**Independent Test**: Create a node with question text → verify LLM starts automatically → verify response appears in node without any "Ask LLM" action

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T009 [P] [US1] Unit test for useAutoLaunchLLM hook in frontend/tests/unit/useAutoLaunchLLM.test.ts (test launches on isNewNode=true, skips when false, prevents duplicates)
- [ ] T010 [P] [US1] Integration test for auto-launch flow in frontend/tests/integration/auto_launch_flow.test.tsx (end-to-end: create node → auto-launch → response display)

### Implementation for User Story 1

- [ ] T011 [US1] Create useAutoLaunchLLM hook in frontend/src/hooks/useAutoLaunchLLM.ts (useEffect + useRef pattern, triggers LLM on isNewNode flag)
- [ ] T012 [US1] Add isNewNode flag to node creation logic in frontend/src/components/Canvas.tsx (set flag when creating node, pass to Node component)
- [ ] T013 [US1] Integrate useAutoLaunchLLM into Node component in frontend/src/components/Node.tsx (call hook with nodeId, graphId, isNewNode, content)
- [ ] T014 [US1] Update node state to track llm_operation_id during streaming in frontend/src/stores/llmOperationsStore.ts (link operation to node)
- [ ] T015 [US1] Persist llm_response to backend on completion in frontend/src/hooks/useStreamingContent.ts (call updateNode API with response)

**Checkpoint**: At this point, User Story 1 should be fully functional - nodes auto-launch LLM on creation and response streams into node

---

## Phase 4: User Story 2 - Question and Response Layout (Priority: P1)

**Goal**: Display question at top, markdown-formatted response below with scrollbar for long content

**Independent Test**: Generate a long response → verify question stays at top → verify response renders as markdown → verify scrollbar appears when content exceeds node height

### Tests for User Story 2

- [ ] T016 [P] [US2] Unit test for LLMNodeContent component in frontend/tests/unit/LLMNodeContent.test.tsx (test dual-pane layout, scrollbar, markdown rendering)

### Implementation for User Story 2

- [ ] T017 [P] [US2] Create LLMNodeContent component in frontend/src/components/LLMNodeContent.tsx (question section + response section with MarkdownRenderer)
- [ ] T018 [P] [US2] Add CSS for split layout in frontend/src/components/LLMNodeContent.css (flexbox: question flex-shrink:0, response flex:1 overflow-y:auto)
- [ ] T019 [P] [US2] Add scroll optimization CSS in frontend/src/components/LLMNodeContent.css (will-change:transform, contain:paint layout, scroll-behavior:smooth)
- [ ] T020 [US2] Integrate LLMNodeContent into Node component in frontend/src/components/Node.tsx (render LLMNodeContent with question and llm_response props)
- [ ] T021 [US2] Add accessibility support in frontend/src/components/LLMNodeContent.css (respect prefers-reduced-motion for scroll-behavior)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - auto-launch + beautiful inline display with scrolling

---

## Phase 5: User Story 3 - Manual Regeneration (Priority: P2)

**Goal**: Allow users to manually trigger LLM regeneration via "Ask LLM" context menu, replacing old response with new

**Independent Test**: Right-click node with existing response → select "Ask LLM" → verify new LLM operation starts → verify old response is replaced with new one

### Tests for User Story 3

- [ ] T022 [P] [US3] Integration test for manual regeneration in frontend/tests/integration/manual_regeneration.test.tsx (test "Ask LLM" cancels old operation, starts new one, replaces response)

### Implementation for User Story 3

- [ ] T023 [US3] Update handleAskLLM in Canvas.tsx to cancel existing operation if llm_operation_id is set (check node.llm_operation_id, call cancelOperation)
- [ ] T024 [US3] Clear llm_response locally before starting new operation in useStreamingContent.ts (reset response field to null)
- [ ] T025 [US3] Update LLMNodeContent to show loading state during regeneration in frontend/src/components/LLMNodeContent.tsx (display spinner/placeholder while llm_operation_id exists but response is empty)

**Checkpoint**: All P1 and P2 stories complete - users can auto-launch and manually regenerate responses

---

## Phase 6: User Story 4 - Font and Node Size Adjustment (Priority: P3)

**Goal**: Allow users to adjust font size and node dimensions for better readability

**Independent Test**: Select node → use resize handles or font controls → verify content reflows appropriately → verify readability is improved

### Tests for User Story 4

- [ ] T026 [P] [US4] Integration test for node resize in frontend/tests/integration/node_resize.test.tsx (test NodeResizer changes dimensions, content reflows, scrollbar adapts)

### Implementation for User Story 4

- [ ] T027 [P] [US4] Add NodeResizer component to Node.tsx in frontend/src/components/Node.tsx (import from reactflow, set min/max width/height per data-model.md)
- [ ] T028 [P] [US4] Add font size control to node toolbar/settings in frontend/src/components/Node.tsx (slider or dropdown for 10-24px range)
- [ ] T029 [US4] Connect font size control to node state in frontend/src/components/Node.tsx (update node.font_size, apply to LLMNodeContent style)
- [ ] T030 [US4] Persist node dimensions on resize in frontend/src/components/Node.tsx (call updateNode API with new node_width/node_height)
- [ ] T031 [US4] Persist font size changes in frontend/src/components/Node.tsx (call updateNode API with new font_size)

**Checkpoint**: All user stories complete - full feature functional with all P1, P2, P3 requirements

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T032 [P] Add error handling for auto-launch failures in useAutoLaunchLLM.ts (display error message in node, don't block UI)
- [ ] T033 [P] Add error handling for markdown rendering failures in MarkdownRenderer.tsx (fallback to plain text, log error)
- [ ] T034 [P] Add loading indicators during streaming in LLMNodeContent.tsx (show progress/spinner while response is generating)
- [ ] T035 [P] Add XSS security test in frontend/tests/unit/MarkdownRenderer.test.tsx (verify malicious markdown is sanitized)
- [ ] T036 [P] Performance test for 50k character responses in frontend/tests/integration/performance.test.tsx (verify <100ms render, 60fps scroll)
- [ ] T037 [P] Add edge case handling for empty responses in LLMNodeContent.tsx (show "No response" message)
- [ ] T038 [P] Add edge case handling for node deletion during streaming in useStreamingContent.ts (cancel operation, cleanup state)
- [ ] T039 [P] Validate quickstart.md instructions in frontend/README.md (verify setup steps work, update if needed)
- [ ] T040 Code cleanup and remove debug logs across all modified files
- [ ] T041 Final integration test on Windows platform (verify multiplatform requirement)
- [ ] T042 Final integration test on Linux platform (verify multiplatform requirement)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority - US2 depends on US1 (needs auto-launch working to display response)
  - US3 (P2) depends on US1 and US2 (needs response display to show regeneration)
  - US4 (P3) depends on US2 (needs layout working to test resize)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after US1 completes - Needs auto-launch working to have response to display
- **User Story 3 (P2)**: Can start after US1 and US2 complete - Needs response display to show regeneration
- **User Story 4 (P3)**: Can start after US2 completes - Needs layout working to test resize

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Components before integration
- Local state before persistence
- Core implementation before edge cases
- Story complete before moving to next priority

### Parallel Opportunities

**Within Phase 1 (Setup)**:
- T001, T002, T003, T004 can all run in parallel (different files)

**Within Phase 2 (Foundational)**:
- T006 and T008 can run after T005 and T007 complete
- T005 and T007 can run in parallel (frontend vs backend)

**Within User Story 1**:
- T009 and T010 can run in parallel (different test files)
- After tests written: T011, T012, T014 can run in parallel (different files)

**Within User Story 2**:
- T017, T018, T019 can run in parallel (component + CSS files)

**Within User Story 4**:
- T027, T028 can run in parallel (different concerns in same file but different sections)

**Within Phase 7 (Polish)**:
- T032, T033, T034, T035, T036, T037, T038, T039 can all run in parallel (different files/concerns)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for useAutoLaunchLLM hook in frontend/tests/unit/useAutoLaunchLLM.test.ts"
Task: "Integration test for auto-launch flow in frontend/tests/integration/auto_launch_flow.test.tsx"

# After tests written, launch implementation tasks in parallel:
Task: "Create useAutoLaunchLLM hook in frontend/src/hooks/useAutoLaunchLLM.ts"
Task: "Add isNewNode flag to node creation logic in frontend/src/components/Canvas.tsx"
Task: "Update node state to track llm_operation_id in frontend/src/stores/llmOperationsStore.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only - Both P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (auto-launch)
4. Complete Phase 4: User Story 2 (display layout)
5. **STOP and VALIDATE**: Test US1+US2 together independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Partial MVP (auto-launch works)
3. Add User Story 2 → Test independently → Full MVP (auto-launch + display)
4. Add User Story 3 → Test independently → Enhanced (+ manual regeneration)
5. Add User Story 4 → Test independently → Complete (+ resize/font controls)
6. Each story adds value without breaking previous stories

### Sequential Strategy (Recommended)

With dependencies between stories:

1. Complete Setup + Foundational
2. Developer: User Story 1 (auto-launch) → VALIDATE
3. Developer: User Story 2 (display) → VALIDATE
4. Developer: User Story 3 (regeneration) → VALIDATE
5. Developer: User Story 4 (resize/font) → VALIDATE
6. Complete Polish phase

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 are tightly coupled (both P1, US2 depends on US1)
- US3 and US4 are enhancements (P2, P3) that can be deferred
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- XSS prevention is critical - test malicious markdown thoroughly
- Multiplatform testing required (Windows + Linux)
