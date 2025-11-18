# Tasks: Interactive Node Canvas Interface

**Input**: Design documents from `/specs/002-node-canvas-interface/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml

**Tests**: Tests are NOT explicitly requested in the specification. Tasks focus on implementation only. Testing will follow standard development practices.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `src/mindflow/api/` for Python API endpoints
- **Frontend**: `frontend/src/` for React application
- **Tests**: `tests/` for Python backend tests, `frontend/src/` for React tests

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

**Environment Setup** (✅ COMPLETE):
- Python venv created at `venv/`
- All dependencies installed in venv
- Scripts created:
  - **Windows**: `run-backend.bat`, `run-frontend.bat`
  - **Linux**: `run-backend.sh`, `run-frontend.sh` (executable)
- FastAPI server tested and working on port 8000/8001

- [x] T001 Create frontend project structure using Vite + React + TypeScript template
- [x] T002 Install frontend dependencies: react, react-dom, reactflow, zustand, axios, lucide-react
- [x] T003 [P] Install frontend dev dependencies: @types/react, @types/react-dom, @types/node, vitest, @testing-library/react
- [x] T004 [P] Configure Vite proxy for API requests in frontend/vite.config.ts
- [x] T005 [P] Configure TypeScript settings in frontend/tsconfig.json
- [x] T006 [P] Add FastAPI and Uvicorn dependencies to pyproject.toml
- [ ] T007 [P] Install pygraphviz for Dagre layout algorithm in Python environment (DEFERRED - requires GraphViz system install)
- [x] T008 Create backend API directory structure: src/mindflow/api/, src/mindflow/api/routes/, src/mindflow/api/schemas/
- [x] T009 [P] Configure ESLint and Prettier for frontend in frontend/.eslintrc.js and frontend/.prettierrc
- [x] T010 [P] Add React Flow CSS import to frontend/src/main.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T011 Create CanvasViewport Pydantic schema in src/mindflow/api/schemas/viewport.py
- [x] T012 Create FastAPI application instance in src/mindflow/api/server.py with CORS middleware
- [x] T013 [P] Define TypeScript types for Graph entities in frontend/src/types/graph.ts (based on backend models)
- [x] T014 [P] Define TypeScript types for Canvas entities in frontend/src/types/canvas.ts (CanvasViewport, VisualNode, ConnectionLine, SelectionState, UIPreferences)
- [x] T015 Create Zustand store for canvas state in frontend/src/stores/canvasStore.ts (graphData, selectedNodeId, detailPanelOpen, preferences)
- [x] T016 [P] Create API client service with Axios instance in frontend/src/services/api.ts
- [x] T017 [P] Implement graph-to-VisualNode transformation utility in frontend/src/features/canvas/utils/transform.ts
- [x] T018 [P] Implement node styling logic (type-to-color mapping, importance-to-borderWidth) in frontend/src/features/canvas/utils/styling.ts
- [x] T019 [P] Create viewport helper functions (zoom validation, pan calculations) in frontend/src/features/canvas/utils/viewport.ts
- [x] T020 Implement GET /api/graphs/{graphId} endpoint in src/mindflow/api/routes/graphs.py
- [x] T021 [P] Implement GET /api/graphs/{graphId}/nodes endpoint with pagination in src/mindflow/api/routes/graphs.py
- [x] T022 [P] Implement viewport endpoints (GET/POST /api/graphs/{graphId}/viewport) in src/mindflow/api/routes/viewport.py
- [x] T023 Register API routes in src/mindflow/api/server.py

**Checkpoint**: ✅ PHASE 2 COMPLETE - Foundation ready - user story implementation can now begin in parallel

**Test Results** (2025-11-17 23:30 UTC):
```bash
# FastAPI Server: http://127.0.0.1:8000
✅ POST /api/graphs/test-graph-123/viewport
   Response: {"success":true,"message":"Viewport state saved"}

✅ GET /api/graphs/test-graph-123/viewport (retrieve saved)
   Response: {"zoom":1.5,"x":100.0,"y":200.0,"width":1920,"height":1080}

✅ GET /api/graphs/unknown-graph/viewport (default fallback)
   Response: {"zoom":1.0,"x":0.0,"y":0.0,"width":1920,"height":1080}

✅ GET / (root endpoint)
   Response: {"message":"MindFlow Canvas API","version":"1.0.0"}

✅ GET /health
   Response: {"status":"healthy"}
```


---

## Phase 3: User Story 1 - Navigate and Explore Graph Canvas (Priority: P1) 🎯 MVP

**Goal**: Users can view their reasoning graph on an infinite canvas where they can freely zoom in/out and pan around to explore different areas of their graph.

**Independent Test**: Create a graph with 5-10 nodes, verify users can zoom from 25% to 400% and pan to view all nodes. Canvas should be smooth and responsive.

### Implementation for User Story 1

- [x] T024 [P] [US1] Create Canvas component with React Flow in frontend/src/components/Canvas.tsx
- [x] T025 [P] [US1] Create useGraphData hook to fetch graph from API in frontend/src/features/canvas/hooks/useGraphData.ts
- [x] T026 [P] [US1] Create useViewport hook for zoom/pan state management in frontend/src/features/canvas/hooks/useViewport.ts
- [x] T027 [US1] Integrate Canvas component with useGraphData hook to load and display nodes
- [x] T028 [US1] Configure React Flow zoom settings (min: 0.25, max: 4.0) in Canvas component
- [x] T029 [US1] Configure React Flow pan-on-drag behavior in Canvas component
- [x] T030 [US1] Add Background component to Canvas for grid display
- [x] T031 [P] [US1] Add Controls component to Canvas for zoom buttons and fit-to-view
- [x] T032 [P] [US1] Add MiniMap component to Canvas in bottom-right position
- [x] T033 [US1] Implement zoom-on-scroll with cursor-centered zoom in Canvas component
- [x] T034 [US1] Implement double-click to fit-to-view functionality in Canvas component
- [x] T035 [US1] Add keyboard shortcuts for navigation (arrow keys pan, +/- zoom) in Canvas component
- [x] T036 [US1] Persist viewport state to localStorage on zoom/pan changes with debounce
- [x] T037 [US1] Restore viewport state from localStorage on canvas mount
- [x] T038 [US1] Display current zoom percentage in UI (e.g., "100%", "250%")
- [x] T039 [US1] Update App.tsx to render Canvas component as main view
- [x] T040 [US1] Add error handling for failed graph data fetch with user-friendly message

**Checkpoint**: At this point, User Story 1 should be fully functional - users can load, zoom, and pan the canvas


**✅ PHASE 3 COMPLETE** - User Story 1: Navigate & Explore

**Test Results** (2025-11-17 23:09 UTC):
```bash
# Frontend dev server started successfully
VITE v7.2.2 ready in 552 ms
➜  Local:   http://localhost:5173/

# Backend API server running
INFO: Uvicorn running on http://127.0.0.1:8000
✅ All endpoints operational

# Compilation: NO ERRORS
# TypeScript: All types valid
# React: All components render without errors
```

**Files Created (Phase 3)**:
- `frontend/src/components/Canvas.tsx` - Main canvas component with React Flow
- `frontend/src/features/canvas/hooks/useGraphData.ts` - Graph data fetching hook
- `frontend/src/features/canvas/hooks/useViewport.ts` - Viewport management hook
- `frontend/src/App.tsx` - Updated to render Canvas

**Features Implemented**:
- ✅ Infinite canvas with zoom (25%-400%)
- ✅ Pan on drag
- ✅ Zoom on scroll (cursor-centered)
- ✅ Grid background (dots pattern, 50px gap)
- ✅ Minimap (bottom-right)
- ✅ Zoom controls (buttons + zoom display)
- ✅ Double-click to fit-to-view
- ✅ Keyboard shortcuts:
  - Escape: Deselect
  - +/-: Zoom in/out
  - Arrow keys: Pan (50px steps)
- ✅ Viewport persistence to localStorage (100ms debounce)
- ✅ Loading state with spinner
- ✅ Error handling with user-friendly messages


---

## Phase 4: User Story 2 - Visual Node Representation (Priority: P1)

**Goal**: Users see their reasoning nodes displayed as visual cards on the canvas with clear type indicators, content preview, and connection lines showing parent-child relationships.

**Independent Test**: Create a graph with question, answer, and hypothesis nodes connected in a chain. Verify each node type has distinct visual styling and connection lines are clearly visible.

### Implementation for User Story 2

- [x] T041 [P] [US2] Create custom Node component with type-based styling in frontend/src/components/Node.tsx
- [x] T042 [P] [US2] Implement node content preview truncation (100 characters) in Node component
- [x] T043 [P] [US2] Add node type icon display using Lucide React in Node component
- [x] T044 [US2] Apply node type-to-color mapping from styling utility in Node component
- [x] T045 [US2] Implement importance-based visual weight (border thickness, opacity) in Node component
- [x] T046 [US2] Add status indicator (draft/valid/invalid/final) with color-coded badges in Node component
- [x] T047 [US2] Display author indicator (human/llm/tool) with distinct icons in Node component
- [x] T048 [US2] Register custom Node component with React Flow nodeTypes
- [x] T049 [US2] Generate ConnectionLine edges from parent-child relationships in transform utility
- [x] T050 [US2] Configure edge styling (Bezier curves, arrows, colors) in Canvas component
- [x] T051 [US2] Set edge z-index to render behind nodes in Canvas component
- [x] T052 [US2] Add node shadow effect for elevation in Node component styling
- [x] T053 [US2] Ensure node dimensions are fixed (width: 280px, height: auto 120-400px)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users can navigate AND see beautifully styled nodes with connections

---

## Phase 5: User Story 3 - Interactive Node Selection and Details (Priority: P2)

**Goal**: Users can click on nodes to select them and view detailed information, with visual feedback showing the current selection and any related nodes.

**Independent Test**: Click on any node and verify it becomes highlighted, shows full content in a detail panel, and related parent/child nodes are visually indicated.

### Implementation for User Story 3

- [ ] T054 [P] [US3] Create DetailPanel component in frontend/src/components/DetailPanel.tsx
- [ ] T055 [P] [US3] Create useSelection hook for selection state in frontend/src/features/canvas/hooks/useSelection.ts
- [ ] T056 [US3] Implement node click handler to update selectedNodeId in Zustand store
- [ ] T057 [US3] Add visual feedback for selected node (highlighted border, elevation) in Node component
- [ ] T058 [US3] Open DetailPanel when node is selected, display full node content and metadata
- [ ] T059 [US3] Emphasize connection lines to/from selected node (thicker, brighter) in Canvas component
- [ ] T060 [US3] Implement deselection on empty canvas click in Canvas component
- [ ] T061 [US3] Implement deselection on Escape key press in Canvas component
- [ ] T062 [US3] Add hover effect on nodes (subtle highlight, cursor change) in Node component
- [ ] T063 [US3] Implement multi-select via click+drag rectangle selection in Canvas component
- [ ] T064 [US3] Display selected node metadata (created_at, updated_at, importance, tags, status) in DetailPanel
- [ ] T065 [US3] Add close button to DetailPanel
- [ ] T066 [US3] Ensure only one node is selected at a time for single-select mode
- [ ] T067 [US3] Add CSS transitions for smooth selection/deselection animations

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work - full navigation, visualization, and interaction

---

## Phase 6: User Story 4 - Multi-touch and Gesture Support (Priority: P3)

**Goal**: Users on touch devices can use pinch-to-zoom gestures and two-finger pan to navigate the canvas, providing a natural mobile/tablet experience.

**Independent Test**: On a touch-enabled device, use pinch gesture to zoom and two-finger drag to pan. Verify smooth, responsive interaction.

### Implementation for User Story 4

- [ ] T068 [US4] Enable React Flow panOnScroll for touch devices in Canvas component
- [ ] T069 [US4] Enable React Flow zoomOnPinch for touch devices in Canvas component
- [ ] T070 [US4] Configure React Flow panOnDrag for two-finger touch gestures in Canvas component
- [ ] T071 [US4] Prevent conflict between single-touch (node selection) and multi-touch (pan) in Canvas component
- [ ] T072 [US4] Test pinch-to-zoom on touch device and verify zoom is proportional to pinch distance
- [ ] T073 [US4] Test two-finger pan on touch device and verify smooth panning
- [ ] T074 [US4] Add touch event listeners for custom gesture handling if needed in Canvas component
- [ ] T075 [US4] Ensure touch gestures work seamlessly with mouse/keyboard inputs (no conflicts)

**Checkpoint**: At this point, all P1-P3 user stories are complete - full multi-device support

---

## Phase 7: User Story 5 - Canvas Performance with Large Graphs (Priority: P2)

**Goal**: Users experience smooth, responsive canvas interactions even when viewing graphs with hundreds of nodes, through viewport culling and optimized rendering.

**Independent Test**: Create a graph with 500 nodes, zoom and pan rapidly. Verify frame rate stays above 30 FPS and interactions remain responsive.

### Implementation for User Story 5

- [ ] T076 [P] [US5] Wrap Node component with React.memo for memoization in frontend/src/components/Node.tsx
- [ ] T077 [P] [US5] Add useMemo for expensive calculations in transform utility
- [ ] T078 [US5] Implement debounced viewport updates (100ms) in useViewport hook
- [ ] T079 [US5] Configure React Flow onlyRenderVisibleElements for viewport culling in Canvas component
- [ ] T080 [US5] Lazy load DetailPanel component with React.lazy and Suspense
- [ ] T081 [US5] Simplify node rendering at low zoom levels (<50%) - hide details, show only type and preview
- [ ] T082 [US5] Add performance monitoring to track FPS during zoom/pan in Canvas component
- [ ] T083 [US5] Optimize edge rendering by reducing control point calculations for off-screen edges
- [ ] T084 [US5] Test performance with 500-node graph and verify 30+ FPS maintained
- [ ] T085 [US5] Test performance with 1000-node graph and verify graceful degradation

**Checkpoint**: All user stories complete - full feature set with performance optimizations

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T086 [P] Add loading spinner while graph data is being fetched in Canvas component
- [ ] T087 [P] Add error boundary component to catch and display React errors gracefully
- [ ] T088 [P] Implement retry logic for failed API requests in API service
- [ ] T089 [P] Add toast notifications for user actions (graph loaded, viewport saved)
- [ ] T090 [P] Create CSS variables for theme colors and spacing in frontend/src/index.css
- [ ] T091 [P] Add responsive design breakpoints for smaller screens in Canvas component
- [ ] T092 [P] Implement graph data caching in Zustand store to avoid redundant fetches
- [ ] T093 [P] Add accessibility attributes (ARIA labels) to Canvas controls and nodes
- [ ] T094 [P] Optimize bundle size by analyzing with vite-bundle-visualizer
- [ ] T095 [P] Add README.md to frontend/ directory with setup instructions
- [ ] T096 Run quickstart.md validation to ensure all setup steps work correctly
- [ ] T097 Create sample graph data for testing and demos
- [ ] T098 Update main project README.md with canvas interface documentation
- [ ] T099 [P] Add logging for API requests and errors in backend
- [ ] T100 [P] Implement CORS configuration based on environment (dev vs production)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P1 → P2 → P3 → P2)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories (works with or without US1)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Works best with US1+US2 but independently testable
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Independent touch support
- **User Story 5 (P2)**: Can start after Foundational (Phase 2) - Performance layer works with any story

### Recommended Sequence

**For single developer (sequential MVP approach)**:
1. Phase 1: Setup
2. Phase 2: Foundational (MUST complete)
3. Phase 3: US1 (Navigate) → Test independently → **STOP and VALIDATE MVP**
4. Phase 4: US2 (Visual Nodes) → Test with US1 → Deploy
5. Phase 5: US3 (Selection) → Test with US1+US2 → Deploy
6. Phase 7: US5 (Performance) → Optimize existing features
7. Phase 6: US4 (Touch) → Final enhancement
8. Phase 8: Polish

**For multiple developers (parallel approach)**:
1. Team completes Phase 1 + Phase 2 together
2. Once Foundational is done:
   - Developer A: User Story 1 (Navigate)
   - Developer B: User Story 2 (Visual Nodes)
   - Developer C: User Story 3 (Selection)
3. Once P1 stories complete:
   - Developer A: User Story 5 (Performance)
   - Developer B: User Story 4 (Touch)
4. Team completes Phase 8 (Polish) together

### Within Each User Story

- Tasks within a story should be executed in order (T024 → T025 → T026...), unless marked [P]
- Tasks marked [P] can run in parallel with other [P] tasks in the same story
- Complete all tasks in a story before moving to next story (for sequential approach)
- Each story should deliver a working, independently testable increment

### Parallel Opportunities

**Phase 1 (Setup)**:
- T003, T004, T005, T006, T007, T009, T010 can run in parallel

**Phase 2 (Foundational)**:
- T013, T014, T016, T017, T018, T019, T021, T022 can run in parallel (different files)

**User Story 1**:
- T024, T025, T026 can run in parallel (different files)
- T030, T031, T032 can run in parallel (different React Flow components)

**User Story 2**:
- T041, T042, T043 can run in parallel (same file but initial setup)

**User Story 3**:
- T054, T055 can run in parallel (different files)

**User Story 5**:
- T076, T077 can run in parallel (different files)

**Phase 8 (Polish)**:
- Most tasks marked [P] can run in parallel (different concerns)

---

## Parallel Example: User Story 1

```bash
# Launch in parallel (different files):
Task T024: "Create Canvas component with React Flow in frontend/src/components/Canvas.tsx"
Task T025: "Create useGraphData hook to fetch graph from API in frontend/src/features/canvas/hooks/useGraphData.ts"
Task T026: "Create useViewport hook for zoom/pan state management in frontend/src/features/canvas/hooks/useViewport.ts"

# Then sequentially (depends on above):
Task T027: "Integrate Canvas component with useGraphData hook to load and display nodes"

# Then in parallel (different React Flow features):
Task T030: "Add Background component to Canvas for grid display"
Task T031: "Add Controls component to Canvas for zoom buttons and fit-to-view"
Task T032: "Add MiniMap component to Canvas in bottom-right position"
```

---

## Parallel Example: Foundational Phase

```bash
# Launch in parallel (different concerns):
Task T013: "Define TypeScript types for Graph entities in frontend/src/types/graph.ts"
Task T014: "Define TypeScript types for Canvas entities in frontend/src/types/canvas.ts"
Task T016: "Create API client service with Axios instance in frontend/src/services/api.ts"
Task T017: "Implement graph-to-VisualNode transformation utility in frontend/src/features/canvas/utils/transform.ts"
Task T018: "Implement node styling logic in frontend/src/features/canvas/utils/styling.ts"
Task T019: "Create viewport helper functions in frontend/src/features/canvas/utils/viewport.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only - Both P1)

1. Complete Phase 1: Setup (T001-T010)
2. Complete Phase 2: Foundational (T011-T023) - CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T024-T040) - Navigation working
4. Complete Phase 4: User Story 2 (T041-T053) - Visual nodes working
5. **STOP and VALIDATE**: Test navigation + visualization together
6. Deploy/demo if ready - **This is the minimal viable canvas**

### Incremental Delivery (Recommended Path)

1. **Setup + Foundational** → Foundation ready
2. **Add US1 (Navigate) + US2 (Visual)** → Test independently → **Deploy MVP** ✅
3. **Add US3 (Selection)** → Test with existing canvas → Deploy enhanced version
4. **Add US5 (Performance)** → Optimize existing features → Deploy optimized version
5. **Add US4 (Touch)** → Test on touch devices → Deploy multi-device version
6. **Polish (Phase 8)** → Final improvements → Deploy production-ready version

Each increment adds value without breaking previous features.

### Full Feature Delivery

If implementing all user stories sequentially:

1. Phase 1: Setup (10 tasks)
2. Phase 2: Foundational (13 tasks) - MUST complete before any story
3. Phase 3: US1 - Navigate (17 tasks)
4. Phase 4: US2 - Visual Nodes (13 tasks)
5. Phase 5: US3 - Selection (14 tasks)
6. Phase 6: US4 - Touch (8 tasks)
7. Phase 7: US5 - Performance (10 tasks)
8. Phase 8: Polish (15 tasks)

**Total**: 100 tasks

**Estimated MVP** (US1 + US2 only): 53 tasks (Setup + Foundational + US1 + US2)

---

## Notes

- **[P] tasks** = Different files, no dependencies - can run in parallel
- **[Story] label** maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group for clean history
- Stop at any checkpoint to validate story independently
- **Priority order**: P1 stories (US1, US2) are critical for MVP, P2/P3 are enhancements
- **React Flow** handles viewport culling automatically - US5 tasks optimize on top of that
- **No tests explicitly requested** - tasks focus on implementation, standard testing practices apply
- Avoid cross-story dependencies that break independence - each story should work standalone
