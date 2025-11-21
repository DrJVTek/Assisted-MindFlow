# Tasks: Advanced Canvas Features

**Input**: Design documents from `/specs/004-advanced-canvas-features/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests NOT requested in specification - implementation tasks only

**Organization**: Tasks grouped by user story to enable independent implementation and testing

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US6)
- Include exact file paths in descriptions

## Path Conventions

Web application structure:
- Backend: `mindflow/` (Python/FastAPI)
- Frontend: `frontend/src/` (TypeScript/React)
- Tests: `tests/` (backend), `frontend/src/__tests__/` (frontend)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create directory structure

- [ ] T001 Install elkjs dependency in frontend with `npm install elkjs@^0.9.0`
- [ ] T002 [P] Create data storage directories: `data/canvases/`, `data/subgraphs/`, `data/users/`
- [ ] T003 [P] Create backend model directory structure: `mindflow/models/` for canvas.py, subgraph.py, preferences.py
- [ ] T004 [P] Create backend API routes directory: `mindflow/api/routes/` for canvases.py, subgraphs.py
- [ ] T005 [P] Create frontend feature directory: `frontend/src/features/canvas/` with subdirs: components/, hooks/, services/
- [ ] T006 [P] Create frontend types directory files: `frontend/src/types/canvas.ts`, `frontend/src/types/subgraph.ts`, `frontend/src/types/preferences.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 Create base Canvas model in `mindflow/models/canvas.py` with Pydantic schema (id, name, description, graph_id, timestamps, is_subgraph, owner_id)
- [ ] T008 Create canvas persistence service in `mindflow/services/canvas_service.py` with JSON file storage (save, load, list, delete)
- [ ] T009 Update Graph model in `mindflow/models/graph.py` to add subgraph_instances dict and complexity_score field
- [ ] T010 Create base API router registration in `mindflow/api/server.py` for canvases and subgraphs routes

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Multi-Canvas Workspace Navigation (Priority: P1) 🎯 MVP

**Goal**: Users can create, name, rename, delete, and switch between multiple named canvases from a left navigation panel

**Independent Test**: Create 3 named canvases ("Project A", "Project B", "Research Notes"), switch between them, rename "Project A" to "Alpha", delete "Research Notes", verify each canvas retains its unique nodes and state

### Implementation for User Story 1

#### Backend (Canvas CRUD API)

- [ ] T011 [P] [US1] Implement GET /api/canvases endpoint in `mindflow/api/routes/canvases.py` with pagination (limit, offset) and search filter
- [ ] T012 [P] [US1] Implement POST /api/canvases endpoint in `mindflow/api/routes/canvases.py` to create new canvas with auto-generated graph
- [ ] T013 [P] [US1] Implement GET /api/canvases/{canvas_id} endpoint in `mindflow/api/routes/canvases.py` to fetch canvas details
- [ ] T014 [P] [US1] Implement PUT /api/canvases/{canvas_id} endpoint in `mindflow/api/routes/canvases.py` for rename and metadata updates
- [ ] T015 [P] [US1] Implement DELETE /api/canvases/{canvas_id} endpoint in `mindflow/api/routes/canvases.py` with cascade delete of associated graph
- [ ] T016 [P] [US1] Implement POST /api/canvases/{canvas_id}/duplicate endpoint in `mindflow/api/routes/canvases.py` for canvas duplication
- [ ] T017 [US1] Add canvas validation in `mindflow/services/canvas_service.py`: name uniqueness per user, name length 1-200 chars, graph_id existence check
- [ ] T018 [US1] Add error handling in canvases.py for 400 (invalid name), 404 (not found), 409 (name conflict, deletion conflict)

#### Frontend (Canvas Navigator UI)

- [ ] T019 [US1] Create CanvasNavigator component in `frontend/src/features/canvas/components/CanvasNavigator.tsx` with left sidebar (250px, collapsible)
- [ ] T020 [US1] Add canvas list rendering in CanvasNavigator with icons, names, last-modified timestamps, active highlighting
- [ ] T021 [US1] Implement "+ New Canvas" button in CanvasNavigator that creates canvas with default name "Untitled Canvas N"
- [ ] T022 [US1] Add canvas rename functionality with double-click to edit, inline text input, save on Enter/blur
- [ ] T023 [US1] Add canvas context menu in CanvasNavigator with options: Rename, Duplicate, Delete, Export
- [ ] T024 [US1] Add canvas deletion with confirmation dialog warning about data loss
- [ ] T025 [US1] Add search/filter input in CanvasNavigator (shows when canvas count > 10) with case-insensitive name filtering
- [ ] T026 [US1] Implement canvas switching logic: onClick switches active canvas, loads graph via API, restores viewport state (zoom, pan)

#### Frontend (State Management)

- [ ] T027 [US1] Create canvasStore in `frontend/src/stores/canvasStore.ts` with Zustand: canvases list, activeCanvasId, CRUD actions
- [ ] T028 [US1] Add canvas service in `frontend/src/features/canvas/services/canvasService.ts` with API calls: fetchCanvases, createCanvas, updateCanvas, deleteCanvas, duplicateCanvas
- [ ] T029 [US1] Integrate canvasStore with existing graph store to sync canvas switches with graph data loading
- [ ] T030 [US1] Add viewport state persistence per canvas in canvasStore: save zoom/pan on change, restore on switch

#### Frontend (Integration)

- [ ] T031 [US1] Update main Canvas component in `frontend/src/components/Canvas.tsx` to render CanvasNavigator sidebar
- [ ] T032 [US1] Add keyboard shortcut Ctrl+N to create new canvas in Canvas.tsx
- [ ] T033 [US1] Add performance optimization: keep 3 most recent canvases in memory, lazy load others

**Checkpoint**: User Story 1 complete - users can manage multiple canvases with full CRUD operations

---

## Phase 4: User Story 2 - Copy/Cut/Paste Operations (Priority: P2)

**Goal**: Users can copy, cut, and paste nodes using keyboard shortcuts (Ctrl+C/X/V/D) and context menu, including cross-canvas paste

**Independent Test**: Create 3 nodes, select them, copy (Ctrl+C), paste (Ctrl+V) at new location, verify duplicates have unique IDs with " (copy)" suffix, cut (Ctrl+X) original nodes, paste elsewhere, verify nodes moved (not duplicated)

### Implementation for User Story 2

#### Frontend (Clipboard State)

- [ ] T034 [P] [US2] Add clipboard state to canvasStore in `frontend/src/stores/canvasStore.ts`: items (Node[]), mode ('copy'|'cut'), sourceCanvasId, timestamp
- [ ] T035 [P] [US2] Create clipboard utilities in `frontend/src/features/canvas/utils/clipboard.ts`: copyToClipboard, cutToClipboard, pasteFromClipboard functions
- [ ] T036 [US2] Implement copy operation in clipboard.ts: store selected nodes in clipboard state, set mode='copy', attempt browser clipboard write (best-effort)
- [ ] T037 [US2] Implement cut operation in clipboard.ts: store selected nodes, set mode='cut', dim nodes visually (opacity 0.4)
- [ ] T038 [US2] Implement paste operation in clipboard.ts: generate new UUIDs for nodes, preserve parent-child relationships with new IDs, add " (copy)" suffix to titles

#### Frontend (Paste Positioning Logic)

- [ ] T039 [US2] Add paste positioning logic in clipboard.ts: if cursor over canvas → paste at cursor position, else → paste at viewport center, if same location → offset by 20px
- [ ] T040 [US2] Implement incremental copy suffix in clipboard.ts: " (copy)", " (copy 2)", " (copy 3)" on repeated pastes
- [ ] T041 [US2] Add cut cleanup logic: on paste after cut, remove original nodes from source canvas (moves nodes instead of duplicating)
- [ ] T042 [US2] Implement cross-canvas paste: check if sourceCanvasId ≠ activeCanvasId, allow paste into different canvas

#### Frontend (Keyboard Shortcuts)

- [ ] T043 [P] [US2] Add keyboard event handler in Canvas.tsx for copy (Ctrl+C / Cmd+C)
- [ ] T044 [P] [US2] Add keyboard event handler in Canvas.tsx for cut (Ctrl+X / Cmd+X)
- [ ] T045 [P] [US2] Add keyboard event handler in Canvas.tsx for paste (Ctrl+V / Cmd+V)
- [ ] T046 [P] [US2] Add keyboard event handler in Canvas.tsx for duplicate (Ctrl+D / Cmd+D - shortcut for copy+paste in place)
- [ ] T047 [US2] Add multi-selection handling in Canvas.tsx using ReactFlow's selection API (Ctrl+Click to multi-select)

#### Frontend (Context Menu)

- [ ] T048 [US2] Add context menu items to Node component in `frontend/src/components/Node.tsx`: Copy, Cut, Duplicate options
- [ ] T049 [US2] Wire context menu actions to clipboard operations from clipboard.ts
- [ ] T050 [US2] Add visual feedback toast notification on copy/cut: "2 items copied", "3 items cut"

#### Frontend (Sub-Graph Handling)

- [ ] T051 [US2] Add special handling for sub-graph instances in clipboard.ts: on paste, create new instance referencing same template (not localized copy)
- [ ] T052 [US2] Preserve sub-graph port connections when pasting: re-map port connection IDs to new instance

**Checkpoint**: User Story 2 complete - full copy/cut/paste functionality with keyboard shortcuts and cross-canvas support

---

## Phase 5: User Story 3 - Auto-Layout Algorithm (Priority: P3)

**Goal**: Users can automatically arrange nodes in readable hierarchical layout with <500ms computation time for 100 nodes, minimizing edge crossings

**Independent Test**: Create 30 nodes in random overlapping positions with various parent-child relationships, click "Auto-Layout" button, verify all nodes positioned in clear hierarchical layers with no overlaps, parent nodes above children, <500ms execution time

### Implementation for User Story 3

#### Frontend (ELK.js Integration)

- [ ] T053 [P] [US3] Create layout service in `frontend/src/features/canvas/services/layoutService.ts` with ELK.js web worker initialization
- [ ] T054 [P] [US3] Create LayoutConfig type in `frontend/src/types/canvas.ts`: algorithm, direction (DOWN|UP|LEFT|RIGHT), nodeSpacing, layerSpacing, edgeRouting
- [ ] T055 [US3] Implement graph-to-ELK conversion in layoutService.ts: convert ReactFlow nodes/edges to ELK graph format with node dimensions
- [ ] T056 [US3] Implement ELK-to-ReactFlow conversion in layoutService.ts: extract computed node positions from ELK result, map to ReactFlow format
- [ ] T057 [US3] Add web worker for ELK computation in `frontend/public/elk.worker.js` to prevent UI blocking during layout
- [ ] T058 [US3] Add cancellable promise wrapper in layoutService.ts for layout computation with abort signal

#### Frontend (Layout Execution)

- [ ] T059 [US3] Create AutoLayoutButton component in `frontend/src/features/canvas/components/AutoLayoutButton.tsx` in toolbar
- [ ] T060 [US3] Implement layout trigger in Canvas.tsx: onClick AutoLayoutButton → call layoutService → receive new positions → animate nodes
- [ ] T061 [US3] Add smooth layout animation in Canvas.tsx using ReactFlow's animated transitions (1 second duration, configurable)
- [ ] T062 [US3] Add auto-zoom to fit after layout: if graph wider than viewport → zoom to fit all nodes within view

#### Frontend (Layout Configuration)

- [ ] T063 [US3] Add layout preferences in `frontend/src/types/preferences.ts`: default spacing (nodeSpacing: 50px, layerSpacing: 80px), animation duration, edgeRouting style
- [ ] T064 [US3] Create layout settings panel in Settings component for users to configure spacing parameters
- [ ] T065 [US3] Persist layout preferences per user in backend preferences.json

#### Frontend (Performance & Edge Cases)

- [ ] T066 [US3] Add progress indicator for large graphs (>200 nodes): show loading overlay with cancel button during layout computation
- [ ] T067 [US3] Add performance check in layoutService.ts: if >200 nodes, show warning "Large graph - may take >1s", allow user to proceed or cancel
- [ ] T068 [US3] Add graceful handling of cycles (feedback loops) in layoutService.ts: ELK.js cycle breaker algorithm
- [ ] T069 [US3] Add empty canvas check in AutoLayoutButton: if <2 nodes, show toast "Nothing to arrange"
- [ ] T070 [US3] Implement grouped node handling: groups move as single units, maintain internal relative positions during layout

**Checkpoint**: User Story 3 complete - auto-layout with ELK.js, web worker, smooth animation, configurable spacing

---

## Phase 6: User Story 4 - Reusable Sub-Graphs with I/O Ports (Priority: P4)

**Goal**: Users can save any canvas as a reusable sub-graph template with defined input/output ports, drag-and-drop instances into other canvases, and localize copies for instance-specific edits

**Independent Test**: Create canvas "Hypothesis Testing Template" with 2 input ports ("Problem Statement", "Prior Evidence") and 1 output port ("Conclusion"), save as sub-graph, open new canvas "Research Project", drag template from library onto canvas, verify sub-graph node appears with port handles, connect parent nodes to input ports, expand instance to view internals, localize copy, edit localized version, verify original template unchanged

### Implementation for User Story 4

#### Backend (Sub-Graph Models)

- [ ] T071 [P] [US4] Create SubGraphTemplate model in `mindflow/models/subgraph.py`: id, name, description, version, canvas_id, input_ports (name, type_hint), output_ports (name, type_hint), thumbnail, usage_count
- [ ] T072 [P] [US4] Create SubGraphInstance model in `mindflow/models/subgraph.py`: id, template_id, parent_canvas_id, position, is_localized, port_connections (mapping to parent graph nodes)
- [ ] T073 [P] [US4] Create SubGraphPort model in `mindflow/models/subgraph.py`: port_id, port_name, port_type (input|output), data_type_hint, mapped_node_id (internal canvas node)
- [ ] T074 [US4] Add sub-graph complexity validation in subgraph.py: calculate complexity_score = total_nodes × max_nesting_level, warn at >1000, hard limit at 5000
- [ ] T075 [US4] Implement circular dependency detection in subgraph.py: traverse sub-graph tree, detect if template A contains B contains A, prevent save with error

#### Backend (Sub-Graph API)

- [ ] T076 [P] [US4] Implement GET /api/subgraphs endpoint in `mindflow/api/routes/subgraphs.py` with filters: tags, sort (usage|recent|name)
- [ ] T077 [P] [US4] Implement POST /api/subgraphs endpoint in `mindflow/api/routes/subgraphs.py` to create template from canvas_id with port definitions
- [ ] T078 [P] [US4] Implement POST /api/canvases/{canvas_id}/subgraph-instances endpoint in `mindflow/api/routes/subgraphs.py` to instantiate template on canvas
- [ ] T079 [P] [US4] Implement POST /api/subgraph-instances/{instance_id}/localize endpoint in `mindflow/api/routes/subgraphs.py` to convert instance to independent copy
- [ ] T080 [P] [US4] Implement PUT /api/subgraphs/{template_id} endpoint in `mindflow/api/routes/subgraphs.py` for template metadata updates
- [ ] T081 [US4] Add subgraph persistence service in `mindflow/services/subgraph_service.py` with JSON storage in `data/subgraphs/`
- [ ] T082 [US4] Implement template propagation logic in subgraph_service.py: when template updated, update all non-localized instances across all canvases

#### Frontend (Sub-Graph Library UI)

- [ ] T083 [US4] Create SubGraphLibrary component in `frontend/src/features/canvas/components/SubGraphLibrary.tsx` as collapsible right sidebar panel
- [ ] T084 [US4] Implement sub-graph list rendering in SubGraphLibrary: thumbnail previews, names, usage counts, drag handles
- [ ] T085 [US4] Add drag-and-drop from SubGraphLibrary to Canvas using HTML5 drag API: onDragStart → onDrop → instantiate sub-graph at drop position
- [ ] T086 [US4] Add sub-graph search/filter in SubGraphLibrary by name and tags
- [ ] T087 [US4] Add sort options in SubGraphLibrary: most used, recently created, alphabetical

#### Frontend (Sub-Graph Editor)

- [ ] T088 [US4] Add "Convert to Sub-Graph" button in canvas settings menu (only visible when viewing canvas, not sub-graph instance)
- [ ] T089 [US4] Create SubGraphConfigDialog component in `frontend/src/features/canvas/components/SubGraphConfigDialog.tsx` for port definition
- [ ] T090 [US4] Implement port editor in SubGraphConfigDialog: "+ Add Input Port" / "+ Add Output Port" buttons, port name input, data type hint dropdown
- [ ] T091 [US4] Add node selector in SubGraphConfigDialog to map ports to specific internal nodes (dropdown filtered by node type for input vs output)
- [ ] T092 [US4] Implement sub-graph save flow: validate port mappings → call POST /api/subgraphs → add to library → mark canvas as is_subgraph=true

#### Frontend (Sub-Graph Instance UI)

- [ ] T093 [US4] Create custom SubGraphNode component in `frontend/src/features/canvas/components/SubGraphNode.tsx` with port handles (ReactFlow custom node)
- [ ] T094 [US4] Render input ports on SubGraphNode left side, output ports on right side, display port names on hover
- [ ] T095 [US4] Add "Expand" button on SubGraphNode to open internal canvas in modal overlay
- [ ] T096 [US4] Create SubGraphModal component in `frontend/src/features/canvas/components/SubGraphModal.tsx` displaying internal canvas in read-only OR edit mode
- [ ] T097 [US4] Add "Edit Template" option in SubGraphNode context menu (opens template canvas for editing)
- [ ] T098 [US4] Add "Localize Copy" option in SubGraphNode context menu: calls POST /api/subgraph-instances/{id}/localize → converts to independent canvas
- [ ] T099 [US4] Add visual indicator on localized instances: badge or icon showing "Localized" status

#### Frontend (Sub-Graph Data Flow)

- [ ] T100 [US4] Implement port connection logic in Canvas.tsx: when connecting edge to sub-graph input port → store connection in instance port_connections
- [ ] T101 [US4] Add data flow propagation: when parent node updates → propagate data to connected input port → update mapped internal node content
- [ ] T102 [US4] Add output data flow: when internal output node updates → propagate to sub-graph output port → update connected downstream nodes in parent graph
- [ ] T103 [US4] Add port type mismatch warning: if connecting text output to number input → show warning badge on connection, allow connection, log type mismatch

#### Frontend (State Management)

- [ ] T104 [US4] Add subgraph state to canvasStore: templates list, instances per canvas, active template being edited
- [ ] T105 [US4] Create subgraph service in `frontend/src/features/canvas/services/subgraphService.ts` with API calls: fetchTemplates, createTemplate, instantiateTemplate, localizeInstance
- [ ] T106 [US4] Add sub-graph instance tracking in graph store: store instance metadata, track nesting level, update complexity score

**Checkpoint**: User Story 4 complete - full sub-graph functionality with templates, instances, I/O ports, localization, circular dependency detection

---

## Phase 7: User Story 5 - Customizable Node Icons (Priority: P5)

**Goal**: Users can customize node type icons from Lucide Icons library, emoji picker, or custom SVG/PNG uploads, with changes applying globally to all nodes of that type

**Independent Test**: Open Settings > Node Appearance, select "hypothesis" node type, choose lightbulb emoji 💡, create new hypothesis node, verify it displays 💡 instead of default icon, upload custom SVG icon, assign to "plan" type, verify all plan nodes update instantly

### Implementation for User Story 5

#### Backend (Icon Preferences Model)

- [ ] T107 [P] [US5] Create IconPreferences model in `mindflow/models/preferences.py`: user_id, node_type_icons (dict mapping NodeType to IconConfig), custom_icons (list of uploaded icons)
- [ ] T108 [P] [US5] Create IconConfig type in preferences.py: source ('lucide'|'emoji'|'custom'), identifier (icon name or emoji char or custom ID), color_override, size_preference
- [ ] T109 [US5] Add icon validation in preferences.py: max 20 custom icons per user, individual file <512KB, total custom icon data <10MB per user
- [ ] T110 [US5] Add custom icon storage in `mindflow/services/preferences_service.py`: store as base64 in preferences.json, handle SVG/PNG conversion

#### Backend (Icon Preferences API)

- [ ] T111 [P] [US5] Implement GET /api/users/preferences endpoint in `mindflow/api/routes/preferences.py` to fetch icon preferences
- [ ] T112 [P] [US5] Implement PUT /api/users/preferences endpoint in `mindflow/api/routes/preferences.py` to update icon preferences
- [ ] T113 [P] [US5] Implement POST /api/users/preferences/icons/upload endpoint in `mindflow/api/routes/preferences.py` for custom icon upload with file size validation
- [ ] T114 [US5] Add error handling: 400 for oversized files, 409 for custom icon limit exceeded

#### Frontend (Icon Picker UI)

- [ ] T115 [US5] Create IconPickerDialog component in `frontend/src/features/canvas/components/IconPickerDialog.tsx` with tabs: Lucide Icons, Emoji, Custom Upload
- [ ] T116 [US5] Implement Lucide Icons tab in IconPickerDialog: grid of ~1000 icons, search filter, category selection, icon preview on hover
- [ ] T117 [US5] Implement Emoji tab in IconPickerDialog: native emoji picker or emoji-mart library with categories (smileys, objects, symbols, etc.)
- [ ] T118 [US5] Implement Custom Upload tab in IconPickerDialog: file input for SVG/PNG, preview uploaded icon, max 512KB validation, list of user's custom icons
- [ ] T119 [US5] Add icon selection handler in IconPickerDialog: on click → return selected IconConfig → close dialog

#### Frontend (Settings Integration)

- [ ] T120 [US5] Add "Node Appearance" section to Settings component in `frontend/src/components/Settings.tsx`
- [ ] T121 [US5] Render node type list in Node Appearance section: each type shows current icon with "Change Icon" button
- [ ] T122 [US5] Wire "Change Icon" button to open IconPickerDialog for selected node type
- [ ] T123 [US5] Implement icon change flow: user selects icon → update iconPreferences in preferences store → call PUT /api/users/preferences → propagate to all nodes of that type
- [ ] T124 [US5] Add "Reset to Defaults" button in Node Appearance: reverts all node types to original Lucide icons

#### Frontend (Icon Rendering)

- [ ] T125 [US5] Update Node component icon rendering in `frontend/src/components/Node.tsx`: check iconPreferences, render Lucide icon OR emoji span OR custom image based on source
- [ ] T126 [US5] Add icon fallback logic in Node.tsx: if custom icon fails to load → show default Lucide icon, log error to console
- [ ] T127 [US5] Add icon size application: apply user's size preference (Small 16px, Medium 18px, Large 24px) to all icons
- [ ] T128 [US5] Add icon color override: if user set custom color → apply to icon element, else inherit from node type color

#### Frontend (State Management)

- [ ] T129 [US5] Create preferences store in `frontend/src/stores/preferencesStore.ts` with Zustand: iconPreferences, customIcons, actions: fetchPreferences, updateIconPreference, uploadCustomIcon
- [ ] T130 [US5] Create preferences service in `frontend/src/features/canvas/services/preferencesService.ts` with API calls: getPreferences, updatePreferences, uploadIcon
- [ ] T131 [US5] Add preferences initialization in App.tsx: fetch user preferences on app load, populate preferences store

**Checkpoint**: User Story 5 complete - full icon customization with Lucide, emoji, custom uploads, global propagation

---

## Phase 8: User Story 6 - Importance Ratio Weighting (Priority: P6)

**Goal**: Users can assign decimal importance weights (0.00-1.00) instead of integer levels, with visual mapping to border width, opacity, shadow, and filtering by importance range

**Independent Test**: Create 5 nodes with importance weights 0.2, 0.4, 0.6, 0.8, 1.0, verify visual distinction (border thickness 2.4px, 2.8px, 3.2px, 3.6px, 4px), opacity (0.68, 0.76, 0.84, 0.92, 1.0), shadow increases, apply filter "Importance > 0.5" shows only 0.6, 0.8, 1.0 nodes

### Implementation for User Story 6

#### Backend (Data Migration)

- [ ] T132 [US6] Add importance data migration in `mindflow/services/graph_service.py`: check if Node.meta.importance is int (0-10) → convert to float by dividing by 10
- [ ] T133 [US6] Update Node model validation in `mindflow/models/graph.py`: accept both int and float for importance field, Pydantic coercion to float
- [ ] T134 [US6] Add migration script in `mindflow/scripts/migrate_importance.py` to batch convert existing graphs (run once on deployment)

#### Frontend (Importance Input UI)

- [ ] T135 [US6] Update node edit form in Node Editor component: replace importance integer input with dual controls: slider (0.00-1.00 with step 0.01) + numeric input
- [ ] T136 [US6] Add percentage display in importance slider: show "75%" instead of "0.75" for user familiarity
- [ ] T137 [US6] Add keyboard shortcuts in importance input: Arrow Up/Down to increment/decrement by 0.05

#### Frontend (Visual Mapping)

- [ ] T138 [US6] Update getNodeStyle function in `frontend/src/features/canvas/utils/styling.ts` to use decimal importance
- [ ] T139 [US6] Implement border width mapping in styling.ts: borderWidth = 2 + (importance × 2) → range 2-4px
- [ ] T140 [US6] Implement opacity mapping in styling.ts: opacity = 0.6 + (importance × 0.4) → range 0.6-1.0
- [ ] T141 [US6] Implement shadow mapping in styling.ts: boxShadow = `0 ${importance * 8}px ${importance * 16}px rgba(0,0,0,0.1)` → range 0-8px blur
- [ ] T142 [US6] Add optional saturation mapping in styling.ts (configurable): increase color saturation with importance (0.5 + importance × 0.5)

#### Frontend (Importance Filtering)

- [ ] T143 [US6] Add importance filter controls in Canvas toolbar: range slider (min-max importance), text inputs for precise values
- [ ] T144 [US6] Implement importance filtering logic in Canvas.tsx: filter nodes by importance range, hide edges connected to hidden nodes
- [ ] T145 [US6] Add filter presets: buttons for "High Priority (>0.7)", "Medium (0.3-0.7)", "Low (<0.3)", "All"
- [ ] T146 [US6] Add visual indicator showing active filter: badge in toolbar displaying "Filtered: 12 of 30 nodes"

#### Frontend (Analytics)

- [ ] T147 [US6] Create importance analytics panel in graph statistics: average importance, median, distribution histogram
- [ ] T148 [US6] Add weighted centrality calculation: combine graph centrality with importance weights for prioritized node ranking
- [ ] T149 [US6] Add importance distribution chart using chart library (recharts or visx): histogram showing node count per importance range

**Checkpoint**: User Story 6 complete - decimal importance with visual mapping, filtering, analytics

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final quality checks

- [ ] T150 [P] Update user documentation in `docs/user-guide.md` with multi-canvas, copy/paste, auto-layout, sub-graphs, icon customization, importance weighting sections
- [ ] T151 [P] Update API documentation in `docs/api-reference.md` with new canvas and subgraph endpoints
- [ ] T152 [P] Add keyboard shortcuts reference in Help menu: list all shortcuts (Ctrl+C/X/V/D, Ctrl+N, etc.)
- [ ] T153 Performance optimization: implement canvas thumbnail generation for faster navigation panel rendering
- [ ] T154 Add error boundary components in frontend to gracefully handle ELK.js worker failures, icon load errors, API failures
- [ ] T155 Add accessibility improvements: keyboard navigation in CanvasNavigator, ARIA labels on all buttons, focus management in dialogs
- [ ] T156 Security hardening: sanitize custom icon SVG uploads to prevent XSS, validate all user inputs server-side
- [ ] T157 Run quickstart.md validation: follow all setup steps, execute manual smoke tests, verify all features work
- [ ] T158 Code cleanup: remove console.logs, add JSDoc comments to complex functions, ensure TypeScript strict mode passes
- [ ] T159 Cross-browser testing: verify features work in Chrome, Firefox, Safari, Edge (especially clipboard operations, drag-drop)
- [ ] T160 Performance benchmarking: measure canvas switch time (<100ms target), auto-layout time (<500ms for 100 nodes), icon change propagation (<100ms)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - Can proceed in parallel if multiple developers
  - OR sequentially in priority order: US1 → US2 → US3 → US4 → US5 → US6
- **Polish (Phase 9)**: Depends on completion of desired user stories (recommend at least US1-US3 for MVP)

### User Story Dependencies

- **US1 (Multi-Canvas) - P1**: Can start after Foundational - No dependencies on other stories ✅ MVP
- **US2 (Copy/Paste) - P2**: Can start after Foundational - No dependencies, but more useful after US1 exists
- **US3 (Auto-Layout) - P3**: Can start after Foundational - No dependencies
- **US4 (Sub-Graphs) - P4**: Requires US1 (multi-canvas management for sub-graph library navigation)
- **US5 (Icons) - P5**: Can start after Foundational - No dependencies
- **US6 (Importance) - P6**: Can start after Foundational - No dependencies (extends existing importance feature)

### Within Each User Story

- Backend models before API routes
- API routes before frontend services
- Frontend services before UI components
- UI components before integration
- Core implementation before edge cases and polish

### Parallel Opportunities

**Phase 1 (Setup)**: All tasks (T001-T006) can run in parallel

**Phase 2 (Foundational)**: Tasks within this phase can run somewhat in parallel, but T010 depends on T007

**User Story 1**:
- Backend API endpoints (T011-T016) can all run in parallel
- Frontend components (T019-T026) can run after T027-T029 are done
- State management (T027-T029) can run in parallel

**User Story 2**:
- Clipboard state (T034-T035) first, then all implementation tasks (T036-T052) can run in parallel
- Keyboard shortcuts (T043-T046) can all run in parallel

**User Story 3**:
- Layout service (T053-T058) can run in parallel
- UI components (T059-T062) can run after layout service
- Configuration (T063-T065) can run in parallel
- Performance tasks (T066-T070) can run in parallel

**User Story 4**:
- Backend models (T071-T073) can run in parallel
- Backend API endpoints (T076-T080) can run in parallel
- Frontend UI tasks have sequential dependencies but within groups can parallelize

**User Story 5**:
- Backend models/API (T107-T114) can run in parallel
- Frontend picker (T115-T119) can run in parallel
- Frontend rendering (T125-T128) can run in parallel

**User Story 6**:
- Backend migration (T132-T134) can run in parallel
- Frontend visual mapping (T138-T142) can run in parallel
- Frontend filtering (T143-T146) can run in parallel

**Phase 9 (Polish)**: Tasks T150-T152 can run in parallel, others sequential

---

## Parallel Example: User Story 1 Backend

```bash
# Launch all backend API endpoint tasks together:
Task T011: "Implement GET /api/canvases endpoint"
Task T012: "Implement POST /api/canvases endpoint"
Task T013: "Implement GET /api/canvases/{canvas_id} endpoint"
Task T014: "Implement PUT /api/canvases/{canvas_id} endpoint"
Task T015: "Implement DELETE /api/canvases/{canvas_id} endpoint"
Task T016: "Implement POST /api/canvases/{canvas_id}/duplicate endpoint"
# These all work on the same file but different functions, can be done in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1-2 Only)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T010) - CRITICAL BLOCKER
3. Complete Phase 3: User Story 1 (T011-T033) - Multi-canvas navigation
4. Complete Phase 4: User Story 2 (T034-T052) - Copy/paste operations
5. **STOP and VALIDATE**: Test US1+US2 independently, verify full workflow
6. Run subset of Phase 9 polish (docs, error handling)
7. Deploy/demo if ready

### Incremental Delivery Roadmap

1. **Foundation** (Phase 1+2) → Project ready for features
2. **MVP v1** (US1: Multi-Canvas) → Users can organize multiple projects
3. **MVP v2** (US2: Copy/Paste) → Productivity boost with duplication
4. **v3** (US3: Auto-Layout) → Visual organization improvement
5. **v4** (US4: Sub-Graphs) → Modularity and reusability
6. **v5** (US5+US6: Customization) → Personalization features

Each increment adds value without breaking previous functionality.

### Parallel Team Strategy

With 3 developers after Foundational phase completes:

- **Developer A**: US1 (Multi-Canvas) - 2 days
- **Developer B**: US2 (Copy/Paste) - 2 days
- **Developer C**: US3 (Auto-Layout) - 2 days

Then sequentially:
- **Developer A**: US4 (Sub-Graphs) - 3 days (requires US1)
- **Developer B**: US5 (Icons) - 1.5 days
- **Developer C**: US6 (Importance) - 1 day

Total: ~6 days with 3 devs vs 11-12 days solo

---

## Task Summary

**Total Tasks**: 160 tasks across 9 phases
- **Phase 1 (Setup)**: 6 tasks
- **Phase 2 (Foundational)**: 4 tasks (BLOCKING)
- **Phase 3 (US1 - Multi-Canvas)**: 23 tasks
- **Phase 4 (US2 - Copy/Paste)**: 19 tasks
- **Phase 5 (US3 - Auto-Layout)**: 18 tasks
- **Phase 6 (US4 - Sub-Graphs)**: 36 tasks (largest story)
- **Phase 7 (US5 - Icons)**: 17 tasks
- **Phase 8 (US6 - Importance)**: 18 tasks
- **Phase 9 (Polish)**: 11 tasks

**Parallel Opportunities**: ~40% of tasks marked [P] can run concurrently

**MVP Scope**: Recommend implementing US1-US2 only (52 tasks) for initial release, adds multi-canvas management and copy/paste - core productivity features

**Full Feature**: All 6 user stories + polish = 160 tasks total

---

## Notes

- All tasks follow strict checklist format: `- [ ] [ID] [P?] [Story] Description with file path`
- [P] marker indicates parallelizable tasks (different files, no dependencies)
- [Story] label (US1-US6) maps each task to its user story for independent implementation
- Tests NOT included per specification (can add later if TDD requested)
- File paths use project structure from plan.md (backend: mindflow/, frontend: frontend/src/)
- Each user story checkpoint enables independent testing and validation
- Commit frequently after each task or logical task group
- Refer to design docs for detailed entity schemas and API contracts
