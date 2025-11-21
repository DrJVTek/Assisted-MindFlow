# Tasks: Node Version History with Temporal Timeline UI

**Feature Branch**: `009-node-version-history`
**Created**: 2025-11-21
**Status**: Ready for Implementation

---

## Overview

This feature transforms MindFlow from a spatial reasoning system into a **spatio-temporal reasoning system**, adding complete version history tracking for nodes with temporal timeline UI. This task breakdown follows dependency order and includes all user stories from spec.md.

**Total Tasks**: 96
**Estimated Effort**: 6 weeks
**MVP Scope**: US1 (Per-Node Version History) + US2 (Parent Impact Tracking) = P1 stories

---

## Task Legend

- `[P1]` = Critical for MVP (US1, US2)
- `[P2]` = Important but not blocking (US3, US4)
- `[P3]` = Nice to have (US5)
- `[P]` = Can be parallelized with other `[P]` tasks
- File paths are absolute or relative to project root

---

## Phase 0: Setup & Preparation (Week 0)

### Setup Tasks

- [ ] [SETUP-001] [P1] Create feature branch `009-node-version-history` from main
  - `git checkout -b 009-node-version-history`
  - Verify branch created successfully

- [ ] [SETUP-002] [P1] Install backend dependencies for version history
  - No new dependencies needed (using built-in difflib, gzip)
  - Verify Python 3.11+ available
  - File: `requirements.txt` (no changes needed)

- [ ] [SETUP-003] [P1] Install frontend dependencies for timeline UI
  - `cd frontend && npm install rc-slider@~10.5.0`
  - `npm install react-window@~1.8.10`
  - File: `frontend/package.json`
  - Verify dependencies installed successfully

- [ ] [SETUP-004] [P1] Create directory structure for version history code
  - Backend: `src/mindflow/services/` (already exists)
  - Backend: `src/mindflow/models/` (already exists)
  - Frontend: `frontend/src/components/` (already exists)
  - Frontend: `frontend/src/features/versions/` (new)
  - Frontend: `frontend/src/hooks/` (already exists)
  - Verify directories created

---

## Phase 1: Core Infrastructure - Version Storage (Week 1)

### Backend: Database Schema & Models

- [ ] [P1-001] [P1] [US1] Create PostgreSQL migration for `node_versions` table
  - File: `migrations/2025-11-21_add_node_versions_table.sql`
  - Schema: version_id, node_id, version_number, content, created_at, trigger_reason, author, llm_metadata (JSONB), cascade_metadata (JSONB), parent_version_id
  - Constraints: UNIQUE(node_id, version_number), CHECK(version_number > 0), CHECK(LENGTH(content) <= 10000)
  - Indexes: idx_versions_node_id, idx_versions_created_at, idx_versions_trigger, idx_versions_node_recent (partial)
  - Test: Run migration, verify table created with all columns and indexes

- [ ] [P1-002] [P1] [US2] Create PostgreSQL migration for `child_change_markers` table
  - File: `migrations/2025-11-21_add_child_markers_table.sql`
  - Schema: marker_id, parent_node_id, child_node_id, child_version_id, timestamp, marker_type, cascade_depth, child_node_title, child_content_preview
  - Foreign keys: parent_node_id → nodes(id), child_node_id → nodes(id), child_version_id → node_versions(version_id)
  - Indexes: idx_child_markers_parent, idx_child_markers_child
  - Test: Run migration, verify table created with foreign keys and indexes

- [ ] [P1-003] [P1] [US1] Define NodeVersion Pydantic model
  - File: `src/mindflow/models/version.py` (new)
  - Fields: version_id, node_id, version_number, content, word_count, char_count, created_at, trigger_reason, author, llm_metadata, cascade_metadata, parent_version_id
  - Enums: TriggerReason, Author (as defined in data-model.md)
  - Validation: content max 10,000 chars, version_number >= 1
  - Test: Create instance, validate constraints, verify JSON serialization

- [ ] [P1-004] [P1] [US2] Define ChildChangeMarker Pydantic model
  - File: `src/mindflow/models/version.py`
  - Fields: marker_id, parent_node_id, child_node_id, child_version_id, timestamp, marker_type, cascade_depth, child_node_title, child_content_preview
  - Enum: MarkerType (direct_child_change, transitive_child_change)
  - Validation: cascade_depth >= 1
  - Test: Create instance, validate fields

- [ ] [P1-005] [P1] [US4] Define VersionDiff Pydantic model (computed, not stored)
  - File: `src/mindflow/models/version.py`
  - Fields: old_version_id, new_version_id, changes (List[DiffChange]), word_count_delta, char_count_delta, additions_count, deletions_count, modifications_count, computed_at, computation_time_ms
  - DiffChange: type, text, old_text, new_text, start_pos, end_pos
  - Test: Create instance, verify structure

- [ ] [P1-006] [P2] [US3] Define TimelineEvent Pydantic model (for global timeline)
  - File: `src/mindflow/models/version.py`
  - Fields: event_id, event_type, node_id, node_title, timestamp, author, trigger_reason, content_preview, metadata
  - Enum: EventType (version_created, child_changed, cascade_triggered)
  - Test: Create instance, verify fields

### Backend: Version Storage Service

- [ ] [P1-007] [P1] [US5] Implement VersionService core class with throttling
  - File: `src/mindflow/services/version_service.py` (new)
  - Methods: create_version(), get_version(), list_versions(), restore_version()
  - Throttling logic: 3-second inactivity OR 30% content change threshold
  - Bypass throttle for: user_regen, parent_cascade, rollback, manual_save
  - Test: Create version with throttling enabled, verify throttling rules enforced

- [ ] [P1-008] [P1] [US5] Implement content change threshold detection
  - File: `src/mindflow/services/version_service.py`
  - Method: _exceeds_change_threshold(old_content, new_content) -> bool
  - Logic: Calculate character count delta, return True if >30%
  - Test: 100 chars → 135 chars (35% change) = True, 100 → 120 (20%) = False

- [ ] [P1-009] [P1] [US5] Implement version deduplication (skip if content identical)
  - File: `src/mindflow/services/version_service.py`
  - Logic: Before creating version, compare content with last version
  - Test: Attempt to create version with identical content, verify skipped

- [ ] [P1-010] [P1] [US1] Implement version creation with sequential version numbers
  - File: `src/mindflow/services/version_service.py`
  - Logic: Query max(version_number) for node, increment by 1
  - Transaction: Use database transaction for atomic version creation
  - Test: Create 5 versions for node, verify sequential numbers 1, 2, 3, 4, 5

- [ ] [P1-011] [P1] [US1] Implement version retrieval by version_id and version_number
  - File: `src/mindflow/services/version_service.py`
  - Methods: get_version_by_id(version_id), get_version_by_number(node_id, version_number)
  - Test: Retrieve version 3 for node, verify correct content returned

- [ ] [P1-012] [P1] [US1] Implement list_versions with pagination
  - File: `src/mindflow/services/version_service.py`
  - Method: list_versions(node_id, limit=100, offset=0, include_archived=False)
  - Query: SELECT * FROM node_versions WHERE node_id = ? ORDER BY version_number DESC LIMIT ? OFFSET ?
  - Test: Create 50 versions, list with limit=10, verify correct 10 returned

- [ ] [P1-013] [P1] [US1] Implement non-destructive version restore (rollback)
  - File: `src/mindflow/services/version_service.py`
  - Method: restore_version(node_id, version_number)
  - Logic: Get old version content, create new version with trigger_reason='rollback', set parent_version_id to old version
  - Test: Create versions 1-5, restore version 2, verify version 6 created with content from version 2

### Backend: Parent Impact Tracking

- [ ] [P1-014] [P1] [US2] Implement automatic ChildChangeMarker creation on child version
  - File: `src/mindflow/services/version_service.py`
  - Method: _create_parent_markers(child_node_id, child_version_id)
  - Logic: Query parent nodes from graph edges, create marker for each parent
  - Test: Create parent+child, edit child, verify marker created in child_change_markers table

- [ ] [P1-015] [P1] [US2] Implement get parent nodes for child marker creation
  - File: `src/mindflow/services/version_service.py`
  - Method: _get_parent_nodes(child_node_id) -> List[Node]
  - Query: SELECT * FROM nodes WHERE id IN (SELECT parent_id FROM edges WHERE child_id = ?)
  - Test: Create parent→child edge, verify parent retrieved correctly

- [ ] [P1-016] [P1] [US2] Implement child marker retrieval for parent timeline
  - File: `src/mindflow/services/version_service.py`
  - Method: get_child_markers(parent_node_id) -> List[ChildChangeMarker]
  - Query: SELECT * FROM child_change_markers WHERE parent_node_id = ? ORDER BY timestamp DESC
  - Test: Create 3 child markers for parent, retrieve, verify all returned in chronological order

### Backend: Archive Service

- [ ] [P1-017] [P3] [US5] Implement version archiving for versions >30 days old
  - File: `src/mindflow/services/archive_service.py` (new)
  - Method: archive_old_versions(node_id, threshold_days=30)
  - Logic: Query versions older than threshold, write to gzip-compressed JSON file, delete from database
  - Archive path: `data/versions/{node_id}/archive.json.gz`
  - Test: Create versions with old timestamps, run archiving, verify moved to file and deleted from DB

- [ ] [P1-018] [P3] [US5] Implement version limit enforcement (100 versions per node)
  - File: `src/mindflow/services/version_service.py`
  - Method: _enforce_version_limit(node_id, limit=100)
  - Logic: Count versions for node, if >100, archive oldest (count - 100) versions
  - Test: Create 105 versions, verify oldest 5 archived automatically

- [ ] [P1-019] [P3] [US5] Implement archived version loading on-demand
  - File: `src/mindflow/services/archive_service.py`
  - Method: load_archived_versions(node_id) -> List[NodeVersion]
  - Logic: Read and decompress gzip file, parse JSON, return list of versions
  - Test: Load archived versions, verify decompressed correctly, cache in memory

---

## Phase 2: API Endpoints (Week 1-2)

### Version Management Endpoints

- [ ] [P1-020] [P1] [US1] Create POST /api/nodes/{id}/versions endpoint
  - File: `src/mindflow/api/routes/versions.py` (new)
  - Request: CreateVersionRequest (content, trigger_reason, llm_metadata, cascade_metadata, bypass_throttle)
  - Response: NodeVersion (201 Created) or Error (400 Throttled)
  - Call: VersionService.create_version()
  - Test: POST with valid request, verify version created and returned

- [ ] [P1-021] [P1] [US1] Create GET /api/nodes/{id}/versions endpoint
  - File: `src/mindflow/api/routes/versions.py`
  - Query params: include_archived (bool), limit (int), offset (int)
  - Response: VersionListResponse (versions, total_count, has_archived)
  - Call: VersionService.list_versions()
  - Test: GET with limit=10, verify 10 versions returned

- [ ] [P1-022] [P1] [US1] Create GET /api/nodes/{id}/versions/{num} endpoint
  - File: `src/mindflow/api/routes/versions.py`
  - Path params: node_id (UUID), version_number (int)
  - Response: NodeVersion (200 OK) or Error (404 Not Found)
  - Call: VersionService.get_version_by_number()
  - Test: GET version 3, verify correct version returned

- [ ] [P1-023] [P1] [US1] Create POST /api/nodes/{id}/versions/{num}/restore endpoint
  - File: `src/mindflow/api/routes/versions.py`
  - Path params: node_id (UUID), version_number (int)
  - Response: NodeVersion (201 Created) - new rollback version
  - Call: VersionService.restore_version()
  - Test: POST restore version 2, verify new version created with rollback trigger

- [ ] [P1-024] [P1] [US1] Register version routes in FastAPI server
  - File: `src/mindflow/api/server.py`
  - Import: from .routes.versions import router as versions_router
  - Register: app.include_router(versions_router, prefix="/api")
  - Test: Start server, verify /api/nodes/{id}/versions endpoint accessible

### Diff & Timeline Endpoints

- [ ] [P1-025] [P2] [US4] Create POST /api/nodes/{id}/versions/diff endpoint
  - File: `src/mindflow/api/routes/diff.py` (new)
  - Request: DiffRequest (version_a_number, version_b_number)
  - Response: DiffResponse (diff, version_a, version_b)
  - Call: DiffService.compute_diff()
  - Test: POST diff request, verify diff computed and returned

- [ ] [P1-026] [P1] [US2] Create GET /api/nodes/{id}/timeline endpoint
  - File: `src/mindflow/api/routes/timeline.py` (new)
  - Query params: include_child_markers (bool, default=true)
  - Response: NodeTimelineResponse (versions, child_markers, total_version_count, has_archived)
  - Call: VersionService.list_versions() + VersionService.get_child_markers()
  - Test: GET timeline, verify versions and child markers returned

- [ ] [P1-027] [P2] [US3] Create GET /api/graphs/{id}/timeline endpoint
  - File: `src/mindflow/api/routes/timeline.py`
  - Query params: start_date, end_date, event_types, node_ids, limit
  - Response: TimelineEventsResponse (events, total_count, aggregated, cluster_window_ms)
  - Call: TimelineService.get_global_timeline()
  - Test: GET global timeline, verify events from all nodes returned

- [ ] [P1-028] [P1] Register diff and timeline routes in FastAPI server
  - File: `src/mindflow/api/server.py`
  - Import: from .routes.diff import router as diff_router
  - Import: from .routes.timeline import router as timeline_router
  - Register: app.include_router(diff_router), app.include_router(timeline_router)
  - Test: Verify endpoints accessible

---

## Phase 3: Diff Service (Week 2)

### Myers Diff Implementation

- [ ] [P1-029] [P2] [US4] Implement DiffService core class
  - File: `src/mindflow/services/diff_service.py` (new)
  - Method: compute_diff(version_a_id, version_b_id) -> VersionDiff
  - Use: Python built-in difflib library (Myers algorithm)
  - Test: Create instance, verify methods available

- [ ] [P1-030] [P2] [US4] Implement word-level Myers diff algorithm
  - File: `src/mindflow/services/diff_service.py`
  - Logic: Split content into words, use difflib.SequenceMatcher, process opcodes
  - Opcodes: 'replace' → modification, 'delete' → deletion, 'insert' → addition, 'equal' → unchanged
  - Test: Compare "hello world" vs "hello planet", verify "world" deleted and "planet" added

- [ ] [P1-031] [P2] [US4] Implement collapsed unchanged sections (>5 unchanged words)
  - File: `src/mindflow/services/diff_service.py`
  - Logic: For 'equal' opcodes with length >5, create collapsed_unchanged change
  - Test: Compare with 100 unchanged words, verify collapsed section created

- [ ] [P1-032] [P2] [US4] Implement diff statistics calculation
  - File: `src/mindflow/services/diff_service.py`
  - Calculate: word_count_delta, char_count_delta, additions_count, deletions_count, modifications_count
  - Test: Compare versions, verify statistics accurate

- [ ] [P1-033] [P2] [US4] Implement background worker for large diffs (>5000 words)
  - File: `src/mindflow/services/diff_service.py`
  - Use: asyncio.get_event_loop().run_in_executor() with ThreadPoolExecutor
  - Logic: If word count >5000, run diff in background thread
  - Test: Compare 10,000-word versions, verify non-blocking execution (<1s total)

---

## Phase 4: Frontend - Per-Node Timeline UI (Week 2-3)

### Timeline Component

- [ ] [P1-034] [P1] [US1] Create VersionTimeline React component
  - File: `frontend/src/components/VersionTimeline.tsx` (new)
  - Props: nodeId (string)
  - State: versions (NodeVersion[]), selectedVersion (number), loading (bool)
  - Test: Render component, verify UI displays

- [ ] [P1-035] [P1] [US1] Implement version fetching on component mount
  - File: `frontend/src/components/VersionTimeline.tsx`
  - useEffect: fetch(`/api/nodes/${nodeId}/versions`)
  - Update state: setVersions(data.versions), setSelectedVersion(latest)
  - Test: Mount component, verify API called and versions loaded

- [ ] [P1-036] [P1] [US1] Integrate rc-slider for timeline slider UI
  - File: `frontend/src/components/VersionTimeline.tsx`
  - Import: import Slider from 'rc-slider'
  - Props: min=0, max=versions.length-1, value=selectedVersion, onChange=setSelectedVersion
  - Test: Render slider, drag handle, verify selectedVersion updates

- [ ] [P1-037] [P1] [US1] Implement version markers on timeline slider
  - File: `frontend/src/components/VersionTimeline.tsx`
  - Marks: Object.fromEntries(versions.map((v, idx) => [idx, { label: marker, style: color }]))
  - Marker types: ● (manual_edit, blue), ● (user_regen, green), ○ (parent_cascade, orange), ◐ (rollback, purple)
  - Test: Render timeline, verify markers displayed with correct colors and sizes

- [ ] [P1-038] [P1] [US1] Implement real-time content preview on slider drag
  - File: `frontend/src/components/VersionTimeline.tsx`
  - Content preview div: Display versions[selectedVersion].content
  - Update on slider change: setSelectedVersion triggers re-render
  - Test: Drag slider, verify content preview updates instantly

- [ ] [P1-039] [P1] [US1] Implement version metadata display (timestamp, author, trigger reason)
  - File: `frontend/src/components/VersionTimeline.tsx`
  - Display: version number, timestamp (relative + absolute), author, trigger_reason badge, word count
  - Formatting: formatDate() for "2 hours ago" or "Nov 21, 2025"
  - Test: Render metadata, verify all fields displayed correctly

- [ ] [P1-040] [P1] [US1] Implement "Restore this version" button
  - File: `frontend/src/components/VersionTimeline.tsx`
  - onClick: POST /api/nodes/{nodeId}/versions/{versionNum}/restore
  - After restore: Reload versions to show new rollback version
  - Disable: If selectedVersion is already current version
  - Test: Click restore, verify node content reverts and new version created

- [ ] [P1-041] [P2] [US4] Implement "Compare with current" button
  - File: `frontend/src/components/VersionTimeline.tsx`
  - onClick: Open VersionDiff modal with selectedVersion vs current version
  - POST: /api/nodes/{nodeId}/versions/diff
  - Test: Click compare, verify diff modal opens with comparison

- [ ] [P1-042] [P1] [US1] Add history icon to Node component
  - File: `frontend/src/components/Node.tsx` (modify existing)
  - Icon: Clock icon (⏰ or SVG) in top-right corner of node
  - onClick: Open VersionTimeline modal/panel for this node
  - Badge: Show version count on hover
  - Test: Click history icon, verify timeline panel opens

### Timeline Panel UI/UX

- [ ] [P1-043] [P1] [US1] Implement timeline panel modal/overlay
  - File: `frontend/src/components/VersionTimeline.tsx`
  - Layout: Modal overlay (non-blocking) or side panel
  - Close button: X button to close panel
  - Test: Open/close panel, verify overlay behavior

- [ ] [P1-044] [P1] [US1] Implement smooth slider animation (60fps)
  - File: `frontend/src/components/VersionTimeline.tsx`
  - CSS: transition: all 0.1s ease-out
  - Debounce: Preview updates debounced to 100ms to avoid thrashing
  - Test: Drag slider rapidly, verify smooth animation without frame drops

- [ ] [P1-045] [P1] [US1] Implement session persistence for last viewed version
  - File: `frontend/src/components/VersionTimeline.tsx`
  - State: Use React state (not localStorage) for session memory
  - Logic: When panel closes, keep selectedVersion in component state
  - Test: View version 3, close panel, reopen, verify still at version 3

- [ ] [P1-046] [P1] [US1] Implement "No history yet" placeholder
  - File: `frontend/src/components/VersionTimeline.tsx`
  - Condition: if (versions.length === 0)
  - Display: "No history yet - make changes to create versions"
  - Test: Open timeline for brand-new node, verify placeholder shown

### Child Markers in Timeline

- [ ] [P1-047] [P1] [US2] Fetch child markers from timeline endpoint
  - File: `frontend/src/components/VersionTimeline.tsx`
  - useEffect: fetch(`/api/nodes/${nodeId}/timeline?include_child_markers=true`)
  - State: childMarkers (ChildChangeMarker[])
  - Test: Fetch timeline data, verify child markers included

- [ ] [P1-048] [P1] [US2] Display child markers on timeline (diamond icons)
  - File: `frontend/src/components/VersionTimeline.tsx`
  - Render: Orange diamond markers (◆) interwoven with version markers
  - Position: Based on marker timestamp (chronological order)
  - Test: Render timeline with child markers, verify diamonds displayed at correct positions

- [ ] [P1-049] [P1] [US2] Implement child marker tooltips
  - File: `frontend/src/components/VersionTimeline.tsx`
  - Tooltip: "Child node '[title]' was updated" + timestamp + trigger reason + preview
  - Show on hover: CSS :hover or onMouseEnter event
  - Test: Hover over child marker, verify tooltip displays

- [ ] [P1-050] [P1] [US2] Implement click child marker → show child diff modal
  - File: `frontend/src/components/VersionTimeline.tsx`
  - onClick: Fetch child version diff (before/after change)
  - Modal: Display child node title, diff content, "Jump to child" button
  - Test: Click child marker, verify child diff modal opens

- [ ] [P1-051] [P1] [US2] Implement "Jump to child node" button
  - File: `frontend/src/components/VersionTimeline.tsx`
  - onClick: Pan canvas to child node, open child's version history
  - Use: ReactFlow panTo() method or similar canvas navigation
  - Test: Click "Jump to child", verify canvas navigates to child node

---

## Phase 5: Frontend - Version Diff UI (Week 3-4)

### Diff Component

- [ ] [P1-052] [P2] [US4] Create VersionDiff React component
  - File: `frontend/src/components/VersionDiff.tsx` (new)
  - Props: diff (VersionDiff), versionA (NodeVersion), versionB (NodeVersion)
  - Test: Render component with mock diff data

- [ ] [P1-053] [P2] [US4] Implement side-by-side diff layout
  - File: `frontend/src/components/VersionDiff.tsx`
  - Layout: Two columns (left=older version, right=newer version)
  - Header: Version metadata (number, timestamp, word count)
  - Test: Render diff, verify two-column layout

- [ ] [P1-054] [P2] [US4] Implement diff change highlighting
  - File: `frontend/src/components/VersionDiff.tsx`
  - Component: DiffChangeBlock({ change })
  - Styles: addition (green background, underline), deletion (red, strikethrough), modification (yellow), unchanged (grey)
  - Test: Render diff with all change types, verify colors correct

- [ ] [P1-055] [P2] [US4] Implement collapsed unchanged sections
  - File: `frontend/src/components/VersionDiff.tsx`
  - Render: <details> element with summary "... N unchanged words ..."
  - Expand: Click to show full unchanged section
  - Test: Render diff with collapsed section, click to expand

- [ ] [P1-056] [P2] [US4] Implement diff statistics display
  - File: `frontend/src/components/VersionDiff.tsx`
  - Display: +20 additions, -5 deletions, ~3 modifications, net +15 words
  - Position: Below version headers, above diff content
  - Test: Render statistics, verify accurate counts

- [ ] [P1-057] [P2] [US4] Implement "Restore left version" button in diff view
  - File: `frontend/src/components/VersionDiff.tsx`
  - onClick: POST /api/nodes/{nodeId}/versions/{versionA.version_number}/restore
  - After restore: Close diff modal, reload timeline
  - Test: Click restore, verify version restored

- [ ] [P1-058] [P2] [US4] Implement text selection for cherry-picking
  - File: `frontend/src/components/VersionDiff.tsx`
  - Feature: User can select text in diff panes
  - Copy button: "Copy selected text" button
  - Test: Select text, click copy, verify copied to clipboard

### Diff Modal Integration

- [ ] [P1-059] [P2] [US4] Create VersionDiffModal wrapper component
  - File: `frontend/src/components/VersionDiffModal.tsx` (new)
  - Props: isOpen (bool), onClose (func), nodeId (string), versionA (number), versionB (number)
  - State: diff (VersionDiff), loading (bool)
  - Test: Open modal, verify overlay and close button work

- [ ] [P1-060] [P2] [US4] Implement diff fetching in modal
  - File: `frontend/src/components/VersionDiffModal.tsx`
  - useEffect: POST /api/nodes/{nodeId}/versions/diff
  - Loading state: Show spinner while computing diff
  - Test: Open modal, verify diff fetched and displayed

- [ ] [P1-061] [P2] [US4] Add "Compare versions" feature to timeline
  - File: `frontend/src/components/VersionTimeline.tsx`
  - UI: Checkboxes on version markers to select two versions
  - Button: "Compare selected" (enabled when 2 versions selected)
  - Test: Select versions 2 and 5, click compare, verify diff modal opens

---

## Phase 6: Frontend - Global Timeline (Week 4-5)

### Global Timeline Component

- [ ] [P1-062] [P2] [US3] Create GlobalTimeline React component
  - File: `frontend/src/components/GlobalTimeline.tsx` (new)
  - Props: graphId (string)
  - State: events (TimelineEvent[]), timeRange (start, end), filters (event types, node IDs)
  - Test: Render component, verify UI displays

- [ ] [P1-063] [P2] [US3] Implement global timeline data fetching
  - File: `frontend/src/components/GlobalTimeline.tsx`
  - useEffect: fetch(`/api/graphs/${graphId}/timeline`)
  - State: setEvents(data.events), total_count, aggregated flag
  - Test: Fetch timeline, verify events loaded

- [ ] [P1-064] [P2] [US3] Implement horizontal timeline canvas
  - File: `frontend/src/components/GlobalTimeline.tsx`
  - Layout: Horizontal scrollable div with time axis
  - Event markers: Vertical lines at timestamp positions
  - Test: Render timeline, verify events positioned chronologically

- [ ] [P1-065] [P2] [US3] Implement event markers with color coding
  - File: `frontend/src/components/GlobalTimeline.tsx`
  - Colors: edit=blue, LLM=green, cascade=orange, rollback=purple
  - Shapes: Vertical lines with circles/dots
  - Test: Render events, verify colors correct

- [ ] [P1-066] [P2] [US3] Implement event tooltips on hover
  - File: `frontend/src/components/GlobalTimeline.tsx`
  - Tooltip: node title, event type, author, timestamp, "Jump to node" action
  - Show on hover: CSS or onMouseEnter
  - Test: Hover over event, verify tooltip displays

- [ ] [P1-067] [P2] [US3] Implement click event → jump to node
  - File: `frontend/src/components/GlobalTimeline.tsx`
  - onClick: Pan canvas to node, open version history at specific version
  - Test: Click event, verify canvas jumps to node

- [ ] [P1-068] [P2] [US3] Implement zoom controls (hour/day/week/month views)
  - File: `frontend/src/components/GlobalTimeline.tsx`
  - Buttons: 1h, 1d, 1w, 1m, all time
  - Logic: Filter events by date range, adjust axis scale
  - Test: Click "1 day", verify only today's events shown

- [ ] [P1-069] [P2] [US3] Implement event clustering for concurrent events
  - File: `frontend/src/components/GlobalTimeline.tsx`
  - Logic: If multiple events at same timestamp, stack vertically
  - Badge: Show count "5 events at 2:30 PM"
  - Test: Create concurrent events, verify clustering

### Timeline Filters

- [ ] [P1-070] [P2] [US3] Implement filter by event type
  - File: `frontend/src/components/GlobalTimeline.tsx`
  - UI: Checkboxes for "Edits", "LLM", "Cascades", "Rollbacks"
  - Logic: Filter events array by event_type
  - Test: Toggle "Show only LLM", verify only LLM events displayed

- [ ] [P1-071] [P2] [US3] Implement filter by node selection
  - File: `frontend/src/components/GlobalTimeline.tsx`
  - UI: Node picker or "Show selected nodes only" button
  - Logic: Filter events where node_id in selected_node_ids
  - Test: Select 3 nodes, verify only their events shown

- [ ] [P1-072] [P2] [US3] Implement date range filter
  - File: `frontend/src/components/GlobalTimeline.tsx`
  - UI: Date picker (start date, end date)
  - Logic: Filter events where timestamp between start and end
  - Test: Set range to last 7 days, verify only recent events shown

- [ ] [P1-073] [P2] [US3] Implement global timeline in toolbar/menu
  - File: `frontend/src/components/Toolbar.tsx` or similar (modify existing)
  - Button: "Global Timeline" icon/button
  - onClick: Open GlobalTimeline modal/panel
  - Test: Click button, verify global timeline opens

---

## Phase 7: Timeline Aggregation Service (Week 5)

### Backend Aggregation

- [ ] [P1-074] [P2] [US3] Create TimelineService class
  - File: `src/mindflow/services/timeline_service.py` (new)
  - Method: get_global_timeline(graph_id, filters) -> List[TimelineEvent]
  - Test: Create instance, verify methods available

- [ ] [P1-075] [P2] [US3] Implement event aggregation from versions + markers
  - File: `src/mindflow/services/timeline_service.py`
  - Logic: UNION query node_versions and child_change_markers, order by timestamp
  - Convert to TimelineEvent: Map version → version_created event, marker → child_changed event
  - Test: Query timeline, verify events from both tables combined

- [ ] [P1-076] [P2] [US3] Implement event clustering for performance (>1000 events)
  - File: `src/mindflow/services/timeline_service.py`
  - Method: _cluster_events(events, window_ms=60000) -> List[TimelineEvent]
  - Logic: Group events within same time window, return cluster representatives
  - Test: Create 50,000 events, cluster, verify reduced to ~500 clusters

- [ ] [P1-077] [P2] [US3] Implement event filtering by type, date range, nodes
  - File: `src/mindflow/services/timeline_service.py`
  - SQL WHERE clauses: event_type IN (?), timestamp BETWEEN ? AND ?, node_id IN (?)
  - Test: Filter by "LLM only" and "last 7 days", verify correct subset returned

---

## Phase 8: Performance Optimization (Week 5-6)

### Virtual Scrolling

- [ ] [P1-078] [P2] [US5] Implement virtual scrolling for version lists (100+ versions)
  - File: `frontend/src/components/VersionTimeline.tsx`
  - Library: react-window FixedSizeList
  - Props: height=400, itemCount=versions.length, itemSize=50
  - Test: Create 100 versions, render, verify only visible items rendered (~20 DOM elements)

- [ ] [P1-079] [P2] [US3] Implement virtual scrolling for global timeline events
  - File: `frontend/src/components/GlobalTimeline.tsx`
  - Use: react-window or custom virtual scrolling
  - Test: Load 1000 events, verify smooth scrolling without lag

### Caching & Lazy Loading

- [ ] [P1-080] [P2] [US5] Implement LRU cache for archived versions
  - File: `src/mindflow/services/archive_service.py`
  - Class: VersionArchiveCache with get(), evict_lru()
  - Max size: 100MB in-memory cache
  - Test: Load same archive twice, verify second load is instant (cached)

- [ ] [P1-081] [P1] [US1] Implement lazy loading for version timeline (load on open, not on page load)
  - File: `frontend/src/components/VersionTimeline.tsx`
  - Logic: Fetch versions in useEffect only when panel opens (not on component mount)
  - Test: Open page with many nodes, verify versions not fetched until history icon clicked

- [ ] [P1-082] [P2] [US3] Implement pagination for large version lists
  - File: `frontend/src/components/VersionTimeline.tsx`
  - Logic: Load 50 versions at a time, "Load more" button for older versions
  - Test: Create 200 versions, verify initial load shows 50, click "Load more" loads next 50

### Performance Testing

- [ ] [P1-083] [P2] [US5] Create load test for 50,000 versions across 500 nodes
  - File: `tests/load/test_50k_versions.py` (new)
  - Logic: Create 500 nodes, 100 versions each, measure query performance
  - Targets: Load 100 versions <500ms, global timeline <2s
  - Test: Run load test, verify all targets met

- [ ] [P1-084] [P2] [US4] Create performance test for large diff computation
  - File: `tests/load/test_diff_performance.py` (new)
  - Test: Compare 1000-word versions (<100ms), 10,000-word versions (<1s)
  - Verify: Background worker non-blocking
  - Test: Run performance test, verify targets met

---

## Phase 9: Integration & Node Content Updates (Week 6)

### Node Update Integration

- [ ] [P1-085] [P1] [US1] Integrate version creation on node content update
  - File: `frontend/src/components/NodeEditor.tsx` or similar (modify existing)
  - Logic: On content change, debounce 3 seconds, then POST /api/nodes/{id}/versions
  - Test: Edit node content, wait 3s, verify version created automatically

- [ ] [P1-086] [P1] [US5] Implement manual "Save version now" button
  - File: `frontend/src/components/NodeEditor.tsx`
  - Button: "Save version" with hotkey Ctrl+Shift+S
  - onClick: POST /api/nodes/{id}/versions with bypass_throttle=true
  - Test: Edit content, click "Save version", verify version created immediately

- [ ] [P1-087] [P1] [US1] Integrate version creation on LLM completion
  - File: `src/mindflow/services/llm_service.py` (modify existing)
  - Logic: After LLM generates response, call VersionService.create_version() with trigger_reason='user_regen'
  - Include: llm_metadata (provider, model, tokens, generation_time_ms, prompt_used)
  - Test: Run LLM generation, verify version created with LLM metadata

- [ ] [P1-088] [P1] [US2] Integrate cascade version creation on parent regeneration
  - File: `src/mindflow/utils/cascade.py` or similar (modify existing)
  - Logic: When parent regenerated due to child changes, call VersionService.create_version() with trigger_reason='parent_cascade'
  - Include: cascade_metadata (triggering_child_versions, cascade_depth)
  - Test: Edit child, regenerate parent, verify parent version created with cascade metadata

---

## Phase 10: Testing (Week 6)

### Unit Tests

- [ ] [P1-089] [P1] Write unit tests for VersionService throttling
  - File: `tests/unit/test_version_service.py` (new)
  - Tests: test_inactivity_throttle(), test_content_change_threshold(), test_bypass_throttle()
  - Coverage: 80%+ for version_service.py
  - Test: Run pytest, verify all tests pass

- [ ] [P1-090] [P2] Write unit tests for DiffService Myers algorithm
  - File: `tests/unit/test_diff_service.py` (new)
  - Tests: test_word_diff_accuracy(), test_collapsed_sections(), test_diff_statistics()
  - Coverage: 80%+ for diff_service.py
  - Test: Run pytest, verify diff accuracy

- [ ] [P1-091] [P3] Write unit tests for ArchiveService compression
  - File: `tests/unit/test_archive_service.py` (new)
  - Tests: test_archive_creation(), test_archive_loading(), test_compression_ratio()
  - Coverage: 80%+ for archive_service.py
  - Test: Run pytest, verify archive functionality

### Integration Tests

- [ ] [P1-092] [P1] Write integration tests for version API endpoints
  - File: `tests/integration/test_version_api.py` (new)
  - Tests: test_create_version(), test_list_versions(), test_restore_version()
  - Coverage: All 5 version endpoints
  - Test: Run pytest, verify API endpoints work end-to-end

- [ ] [P1-093] [P2] Write integration tests for diff API endpoint
  - File: `tests/integration/test_diff_api.py` (new)
  - Tests: test_compute_diff(), test_diff_accuracy()
  - Test: POST diff request, verify response structure and content

- [ ] [P1-094] [P1] Write integration tests for timeline API endpoints
  - File: `tests/integration/test_timeline_api.py` (new)
  - Tests: test_node_timeline(), test_global_timeline(), test_timeline_filters()
  - Test: GET timeline endpoints, verify events returned correctly

### Manual Testing Checklist

- [ ] [P1-095] [P1] Manual test: Complete version lifecycle workflow
  - Steps: Create node → type content → wait 3s → verify version → open history → drag slider → restore version → verify rollback
  - Expected: All steps work smoothly, UI responsive
  - Document: Any bugs or UX issues

- [ ] [P1-096] [P1] Manual test: Parent impact tracking workflow
  - Steps: Create parent+child → edit child → verify marker in parent → click marker → verify child diff displayed → regenerate parent → verify cascade version
  - Expected: Causality chain visible and clear
  - Document: Any bugs or UX issues

---

## Completion Criteria

### MVP (P1) Completion

- [ ] All P1 tasks completed (US1 + US2)
- [ ] Unit test coverage ≥80% for core services
- [ ] Integration tests pass for all API endpoints
- [ ] Manual testing checklist complete with no blocking issues
- [ ] Performance targets met:
  - Load 100 versions: <500ms
  - Compute diff (1000 words): <100ms
  - Timeline scrubbing: 60fps smooth

### Full Feature Completion

- [ ] All P1 + P2 + P3 tasks completed (US1-US5)
- [ ] Global timeline handles 50,000 events: <2s load time
- [ ] Version archiving working: versions >30 days compressed and retrievable
- [ ] All edge cases handled: circular cascades, deleted children, large diffs
- [ ] Documentation updated: user guide, API docs, developer onboarding

---

## Dependencies & Prerequisites

**External Dependencies:**
- ✅ PostgreSQL 15+ (already in project)
- ✅ Python 3.11+ (already in project)
- ✅ React 19 (already in project)
- 🆕 rc-slider ~10.5.0 (to be installed in SETUP-003)
- 🆕 react-window ~1.8.10 (to be installed in SETUP-003)

**Internal Dependencies:**
- Feature 001: MindFlow Engine (Node, Graph models)
- Feature 002: Node Canvas Interface (ReactFlow for navigation)
- Feature 003: Node Editor & LLM Orchestration (LLM version triggers)
- Feature 007: Concurrent LLM Hierarchy (cascade triggers)

**Task Dependencies:**
- P1-001 (database schema) must complete before P1-007 (VersionService)
- P1-020 to P1-024 (API endpoints) depend on P1-007 to P1-019 (services)
- P1-034 to P1-051 (frontend timeline) depend on P1-020 to P1-028 (backend API)
- P1-052 to P1-061 (diff UI) depend on P1-029 to P1-033 (diff service)

---

## Risk Mitigation

**Risk: Large diffs block UI**
- Mitigation: P1-033 (background worker for >5000 words)

**Risk: 50k events freeze timeline**
- Mitigation: P1-076 (event aggregation/clustering)

**Risk: Users lose versions due to throttling**
- Mitigation: P1-086 (manual save button), configurable thresholds

**Risk: Archive corruption**
- Mitigation: Use gzip built-in (reliable), test archiving (P1-091)

**Risk: Circular cascade loops**
- Mitigation: Depth limit = 5, detect cycles in cascade logic

---

## Git Commit Strategy

**Commit Message Format:**
```
[009-TASKID] Brief description

- Detailed change 1
- Detailed change 2

Addresses: US# (User Story #)
```

**Example:**
```
[009-P1-001] Add PostgreSQL schema for node_versions table

- Create migration file with version_id, node_id, version_number, content fields
- Add indexes for node_id and created_at
- Add constraints for version_number sequence and content length

Addresses: US1 (Per-Node Version History)
```

**Branch Strategy:**
- Feature branch: `009-node-version-history`
- All commits to feature branch
- PR to main after MVP completion (all P1 tasks)

---

## Notes

- **Parallel Tasks**: Tasks marked `[P]` can be worked on simultaneously by multiple developers
- **Incremental Delivery**: Complete MVP (P1) first before starting P2/P3 tasks
- **Testing Throughout**: Don't defer testing to end - write tests alongside implementation
- **Performance First**: Measure performance early, optimize before scaling
- **User Feedback**: After P1 completion, get user feedback on timeline UI before implementing P2/P3

**Estimated Timeline:**
- Week 1: Phase 1 (Backend storage) + Phase 2 (API endpoints)
- Week 2: Phase 3 (Diff service) + Phase 4 start (Timeline UI)
- Week 3: Phase 4 complete (Timeline UI) + Phase 5 start (Diff UI)
- Week 4: Phase 5 complete (Diff UI) + Phase 6 (Global timeline)
- Week 5: Phase 7 (Aggregation) + Phase 8 (Performance)
- Week 6: Phase 9 (Integration) + Phase 10 (Testing) + Polish

Total: **96 tasks** across **6 weeks** with **MVP at Week 3** (P1 tasks complete)
