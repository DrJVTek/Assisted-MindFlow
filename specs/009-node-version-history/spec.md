# Feature Specification: Node Version History with Temporal Timeline UI (Spatio-Temporal System)

**Feature Branch**: `009-node-version-history`
**Created**: 2025-11-21
**Status**: Draft
**Input**: User description: "il faudrait aussi peu etre valider le faire qu'il y a une history sur les nodes et que cela a un impact sur les parents de ses nodes (qui ont heurs aussi un histoiry) et il faut qu'il soit possible de voir tout les version historique temporel de tout ca avec une UI simple sur les nodes (ou global peu etre aussi en fait via un ligne temporel) ce qui fait que notre system au final deviens plus juste multi dimentionnel mais spacio temporel :p"

## Executive Summary

This feature transforms MindFlow from a spatial reasoning system into a **spatio-temporal reasoning system**, adding a time dimension to the existing multi-dimensional graph structure. Users can navigate not just through the spatial hierarchy of nodes (parent-child relationships) but also backwards and forwards through time, viewing any historical state of the graph and understanding how changes propagate through reasoning chains.

**Key Value Propositions**:
- **Complete History**: Every node change is captured as a version, creating an immutable audit trail of reasoning evolution
- **Temporal Navigation**: Users can "travel back in time" to see what the graph looked like at any moment, revealing how ideas evolved
- **Impact Tracking**: When a child node changes, parent nodes automatically record this as a historical marker, showing causality chains
- **Dual-Axis Exploration**: Navigate both space (node hierarchy) AND time (version history) simultaneously, enabling temporal-spatial reasoning
- **Version Comparison**: Side-by-side diff of any two versions reveals what changed and why, accelerating learning and debugging

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Per-Node Version History with Timeline Slider (Priority: P1 - Critical MVP)

Users need to view all historical versions of any node directly on the canvas, with a simple timeline UI that allows quick navigation through past edits, LLM generations, and content changes. Without version history, users cannot understand how their reasoning evolved, cannot recover from mistakes, and lose valuable intermediate thinking that was replaced.

**Why this priority**: This is the foundation of the temporal system. Without per-node version history, there is no time dimension. This delivers immediate value by enabling version recovery and understanding reasoning evolution, which are critical for knowledge work.

**Independent Test**: User creates a question node with content "What is AI?", edits it 3 times with different phrasings, opens version history UI on the node (clicking history icon or right-click "View History"), sees timeline slider showing 4 versions (original + 3 edits), drags slider to version 2, sees content change in preview, clicks "Restore this version", verifies node content reverts to version 2 and creates new version 5 (restoration is not destructive).

**Acceptance Scenarios**:

1. **Given** user clicks the "History" icon on any node, **When** history panel opens, **Then** panel displays timeline slider with version markers (dots/ticks) for each version, version count (e.g., "5 versions"), and current version highlighted
2. **Given** node has 10 versions spanning 3 days, **When** user views timeline, **Then** timeline displays time-scaled axis (earlier versions more spaced if longer time gaps) with hover tooltips showing timestamp and trigger reason
3. **Given** user drags timeline slider to version 3, **When** slider moves, **Then** node content preview updates in real-time showing version 3 content without committing the change (read-only preview mode)
4. **Given** user is previewing version 3 while current version is 10, **When** user clicks "Restore this version", **Then** node content reverts to version 3 content and new version 11 is created with trigger_reason "rollback", preserving all history
5. **Given** user hovers over version marker on timeline, **When** tooltip appears, **Then** tooltip shows: timestamp, author (human/LLM/cascade), trigger reason (manual_edit, parent_cascade, user_regen, rollback), word count, and first 50 characters of content
6. **Given** node was created 5 minutes ago with no edits, **When** user opens history panel, **Then** panel shows "1 version" with single marker and message "No history yet - make changes to create versions"
7. **Given** user compares version 2 vs version 5, **When** user selects both versions and clicks "Compare", **Then** side-by-side diff view appears highlighting additions (green), deletions (red), and unchanged text (grey)
8. **Given** version history panel is open, **When** user closes panel and later reopens it, **Then** panel remembers last viewed version (does not always reset to current version)
9. **Given** node has 100+ versions (power user scenario), **When** user opens history panel, **Then** timeline uses compressed markers (vertical stacking or clustering) and provides date range filter to zoom into specific time periods

**UI Requirements**:
- History icon badge on node (clock icon, subtle, top-right corner)
- Clicking history icon opens modal or side panel (non-blocking, overlay)
- Timeline slider with draggable handle (smooth scrubbing, 60fps animation)
- Version markers as dots/ticks on timeline (size indicates importance: manual edits larger than auto-cascades)
- Content preview area showing current slider position content (read-only, syntax highlighting if applicable)
- Action buttons: "Restore this version", "Compare with current", "Close"
- Version metadata display: timestamp (relative: "2 hours ago" + absolute), author, trigger reason, word count diff (+50, -20)

---

### User Story 2 - Parent Impact Tracking and Cascade History (Priority: P1 - Core Value Proposition)

Users need to see how child node changes impact parent nodes, with parents automatically recording "historical markers" when child versions change, creating a causality chain through the reasoning graph. Without impact tracking, users cannot understand why a parent's reasoning became outdated or what triggered parent regeneration, losing critical context for multi-dimensional analysis.

**Why this priority**: This is what makes the system truly spatio-temporal. It's not enough to track individual node versions - we must track how changes propagate through relationships. This enables understanding causality, debugging reasoning chains, and seeing the ripple effects of edits.

**Independent Test**: User creates parent question node "What is the best programming language?" and child hypothesis node "Python is best for AI". User edits child node content to "Rust is best for AI". User opens parent node history panel, sees new historical marker "Child node updated at 10:30 AM" with link to child version diff. User clicks marker, sees side-by-side comparison of child content before/after change. User decides to regenerate parent node based on this marker, sees parent content update with new reasoning.

**Acceptance Scenarios**:

1. **Given** parent node has child node, **When** child node content is edited (new version created), **Then** parent node history automatically records "child_node_changed" marker with reference to child node ID, child version ID, and timestamp
2. **Given** parent has 5 child nodes, **When** 3 of them are edited within 1 hour, **Then** parent history shows 3 separate child-change markers on timeline, visually distinct from parent's own version markers (different color/shape: diamond vs circle)
3. **Given** user views parent's timeline, **When** user hovers over child-change marker, **Then** tooltip shows: "Child node '[child title]' was updated" with child's trigger reason, timestamp, and preview of child's diff
4. **Given** user clicks on child-change marker, **When** click occurs, **Then** modal opens showing child node's version diff (before/after) with "Jump to child node" button to navigate canvas to child
5. **Given** child node was edited, **When** parent node timeline displays child-change marker, **Then** marker is positioned on timeline at exact timestamp of child change, interwoven chronologically with parent's own version markers
6. **Given** parent node has outdated reasoning due to child changes, **When** user sees multiple child-change markers after parent's last version, **Then** parent node displays visual indicator (orange border or badge) suggesting "Children changed - consider regenerating"
7. **Given** user clicks "Regenerate based on child changes", **When** LLM regenerates parent, **Then** new parent version is created with trigger_reason "parent_cascade" and metadata linking to triggering child version IDs
8. **Given** parent has cascade history (regenerated due to child changes), **When** user views parent's version 5 created by cascade, **Then** version tooltip shows "Triggered by child updates" with clickable list of child nodes that triggered regeneration
9. **Given** deeply nested graph (A→B→C, 3 levels), **When** node C is edited, **Then** node B records child-change marker, and node A records transitive-child-change marker (different visual style: hollow diamond) showing indirect impact

**Impact Marker Types**:
- Direct child change: Solid diamond marker, orange color
- Transitive child change (grandchild): Hollow diamond, amber color
- Multiple children changed simultaneously: Clustered marker showing count (e.g., "3 children")
- Cascade regeneration trigger: Special marker linking child changes to resulting parent version

**Cascade Metadata**:
- Parent versions created by cascade store: triggering_child_versions (list of child version IDs), cascade_depth (1 for direct child, 2 for grandchild, etc.), cascade_timestamp

---

### User Story 3 - Global Timeline View for Entire Graph Evolution (Priority: P2 - Power User Feature)

Users need a bird's-eye view of the entire graph's evolution over time, showing all node changes, cascades, and LLM operations on a single horizontal timeline, enabling them to understand the big picture of how the reasoning graph developed and identify key inflection points.

**Why this priority**: While per-node history is essential, power users analyzing complex reasoning (20+ nodes) need aggregate temporal awareness. This enables identifying patterns like "burst of activity after LLM generation" or "this branch stagnated for 2 hours". It's not critical for basic use but essential for advanced spatio-temporal analysis.

**Independent Test**: User creates graph with 10 nodes, edits various nodes over 2 hours, runs 5 LLM operations at different times. User opens "Global Timeline" panel (button in toolbar or context menu "View Graph History"), sees horizontal timeline spanning 2 hours with vertical event markers for each version across all nodes. User clicks on event marker for node 3's version 2, canvas pans to node 3 and opens its history at version 2. User filters timeline to "Show only LLM generations", sees 5 markers remaining.

**Acceptance Scenarios**:

1. **Given** user clicks "Global Timeline" button in toolbar, **When** timeline panel opens, **Then** horizontal timeline displays spanning graph's entire lifetime from creation to present, with zoom controls to focus on specific time ranges
2. **Given** graph has 50 version events across 10 nodes, **When** user views global timeline, **Then** each event is represented as vertical line/marker at its timestamp, with color coding by event type (edit=blue, LLM=green, cascade=orange, rollback=purple)
3. **Given** multiple events occurred at same timestamp (concurrent LLM operations), **When** user views timeline, **Then** events are vertically stacked or clustered with count indicator (e.g., "5 events at 2:30 PM")
4. **Given** user hovers over event marker, **When** tooltip appears, **Then** tooltip shows: node title (first 30 chars), event type, author, timestamp, and quick action "Jump to node"
5. **Given** user clicks event marker, **When** click occurs, **Then** canvas pans/zooms to that node and opens its version history panel at the specific version
6. **Given** user drags timeline zoom handles, **When** zooming to 1-hour window, **Then** timeline updates to show only events within that hour, with finer time granularity (minute markers instead of hour markers)
7. **Given** user activates timeline playback mode, **When** user clicks "Play" button, **Then** timeline cursor advances automatically (configurable speed: 1x, 5x, 10x) and graph visually updates to show nodes in their historical state at each timestamp
8. **Given** user filters timeline by event type, **When** user toggles "Show only manual edits" filter, **Then** timeline hides LLM/cascade events and displays only human edit events
9. **Given** user filters timeline by node selection, **When** user selects 3 nodes and clicks "Show timeline for selected nodes", **Then** timeline displays only events from those 3 nodes (focused analysis)
10. **Given** user exports timeline, **When** user clicks "Export Timeline", **Then** system generates CSV or JSON with all events (timestamp, node_id, event_type, content_preview) for external analysis

**Timeline Features**:
- Horizontal scrollable timeline (1 hour, 1 day, 1 week, 1 month, all time views)
- Zoom in/out: Mouse wheel or pinch gesture
- Event markers: Vertical lines with tooltip on hover, click to jump to node
- Time cursor: Current time indicator (red line), draggable to "time travel"
- Playback controls: Play, pause, speed (1x to 100x), loop
- Filters: Event type, node selection, date range, author (human vs LLM)
- Export: CSV, JSON, or visual timeline image (screenshot)

**Playback Mode**:
- Timeline cursor advances frame-by-frame (e.g., 1 second of real time = 1 minute of graph time)
- Graph nodes visually revert to historical content at current cursor position
- New versions appear as they occurred chronologically (animated transitions)
- User can pause, scrub backward/forward, or jump to specific events
- "Restore current state" button exits playback and returns to present

---

### User Story 4 - Version Comparison and Diff Visualization (Priority: P2 - Analysis Feature)

Users need to compare any two versions of a node side-by-side, with visual diff highlighting additions, deletions, and changes, enabling them to quickly understand what changed between reasoning iterations and learn from evolution patterns.

**Why this priority**: Version history alone is not enough - users need to understand WHAT changed between versions. Diff visualization makes changes immediately obvious, saving cognitive load and enabling rapid analysis. Essential for debugging reasoning errors and understanding LLM output variations.

**Independent Test**: User opens version history for node with 5 versions, selects version 2 and version 4 (checkboxes), clicks "Compare selected versions", sees side-by-side diff view with version 2 on left and version 4 on right. Added text in version 4 is highlighted green, deleted text (from version 2) is highlighted red with strikethrough, unchanged text is grey. User clicks "Apply changes from left to current" button, sees version 2 content replace current content (creates new version).

**Acceptance Scenarios**:

1. **Given** user is viewing node version history, **When** user selects two versions using checkboxes and clicks "Compare", **Then** diff modal opens showing side-by-side comparison with left=older version, right=newer version
2. **Given** diff view is open, **When** diff algorithm processes, **Then** additions are highlighted in green background with underline, deletions are highlighted in red background with strikethrough, unchanged text has neutral grey background
3. **Given** diff shows large change (500+ word diff), **When** user views diff, **Then** unchanged sections are collapsed with "Show N unchanged lines" button to reduce visual clutter
4. **Given** user views diff, **When** version metadata is displayed, **Then** each side shows: version number, timestamp (relative + absolute), trigger reason, word count, and change delta (+150 words, -30 words)
5. **Given** user wants to restore older version, **When** user clicks "Restore left version" button, **Then** content from left side replaces current node content and creates new version with trigger_reason "rollback"
6. **Given** user wants to cherry-pick changes, **When** user selects specific text in right pane and clicks "Copy to clipboard", **Then** selected text is copied for manual merge
7. **Given** diff contains structural changes (bullet points added, paragraphs split), **When** diff algorithm runs, **Then** algorithm detects paragraph-level changes and shows paragraph reordering as move operations (not delete+add)
8. **Given** user closes diff view, **When** user reopens version history, **Then** previously selected versions remain selected for quick re-comparison (session memory)

**Diff Algorithm**:
- Use Myers diff algorithm or similar for line-by-line comparison
- Highlight changes at word level (not just line level) for precision
- Detect moved paragraphs (not treated as delete+add)
- Collapse large unchanged sections (configurable threshold: 5+ unchanged lines)
- Support inline diff (single pane, interleaved) or side-by-side (two panes)

**Diff Visualizations**:
- Green: Additions (`+ new text`, green background, underline)
- Red: Deletions (`- old text`, red background, strikethrough)
- Yellow: Modifications (text changed, yellow background, show before/after on hover)
- Grey: Unchanged (neutral, low opacity to reduce visual weight)
- Blue: Moved paragraphs (blue badge "Moved from line 10")

---

### User Story 5 - Automatic Version Creation and Smart Throttling (Priority: P3 - System Robustness)

The system needs to automatically create versions on every meaningful node change while intelligently throttling rapid edits to avoid creating 100+ versions during live typing, ensuring version history remains useful without overwhelming users with noise.

**Why this priority**: Automatic version creation is essential for capturing history without user action, but naive implementation (version on every keystroke) creates unusable history. Smart throttling balances completeness with usability. This is system-level functionality that users shouldn't need to think about.

**Independent Test**: User starts typing in node content field, makes 10 keystrokes within 2 seconds, pauses for 3 seconds (no typing), verifies only 1 version was created after pause (throttled). User then makes major edit (delete 50% of content), verifies version is created immediately (threshold-triggered). User runs LLM generation, verifies version is created immediately on completion (LLM operations always create versions).

**Acceptance Scenarios**:

1. **Given** user is actively typing in node content field, **When** user types continuously for 5 seconds, **Then** no versions are created during typing (throttle active)
2. **Given** user stops typing for 3 seconds (inactivity threshold), **When** throttle timer expires, **Then** system creates single version capturing all edits since last version
3. **Given** user makes major change (>30% content change by character count), **When** edit occurs, **Then** system immediately creates version regardless of throttle timer (threshold-triggered)
4. **Given** user pastes large block of text (500+ chars), **When** paste completes, **Then** system immediately creates version (paste is major change)
5. **Given** LLM completes generation, **When** response is written to node, **Then** system immediately creates version with trigger_reason "user_regen" (LLM operations always versioned)
6. **Given** cascade regeneration updates parent node, **When** parent content is updated, **Then** system immediately creates version with trigger_reason "parent_cascade" (cascades always versioned)
7. **Given** user manually triggers "Save version now" action, **When** action is triggered, **Then** system immediately creates version with trigger_reason "manual_edit" bypassing throttle
8. **Given** node has 100 versions (limit reached), **When** new version is created, **Then** system archives oldest version to archive storage (not deleted, but not shown in UI by default) and keeps most recent 100 versions
9. **Given** system detects identical content (no actual change), **When** version creation is attempted, **Then** system skips version creation and logs "No changes detected" (deduplication)

**Throttling Rules**:
- Inactivity threshold: 3 seconds of no typing triggers version save
- Major change threshold: >30% character change triggers immediate version
- Paste/cut operations: Always trigger immediate version
- LLM operations: Always trigger immediate version
- Cascade operations: Always trigger immediate version
- Manual save: User can force version creation via hotkey (Ctrl+Shift+S)
- Version limit per node: 100 versions (configurable), older versions archived

**Version Metadata**:
- Each version stores: content, timestamp, trigger_reason, author (human/LLM), word_count, char_count, parent_version_id (for rollback chains)
- LLM versions also store: llm_provider, model_name, token_count, generation_time_ms, prompt_used
- Cascade versions also store: triggering_child_versions (list), cascade_depth

---

### Edge Cases

- **What happens when user rapidly toggles between versions (timeline scrubbing)?**
  - System should debounce preview updates (max 30fps) to avoid UI thrashing. Load version content lazily only when scrubbing stops for >100ms.

- **How does system handle very large node content (5000+ words) in diff view?**
  - Diff algorithm should process in background worker (non-blocking) and show loading spinner. Collapse large unchanged sections by default. Provide "Show full diff" toggle.

- **What happens when user restores a version while another user is editing the same node (future multi-user scenario)?**
  - Single-user scope for MVP. Future: conflict detection with "Version conflict - merge required" dialog showing both changes.

- **How does system handle circular cascades (A→B→C→A) in impact tracking?**
  - System detects circular dependencies using visited-set algorithm. Cascades stop at depth limit (default: 5) to prevent infinite loops. Log warning "Circular dependency detected" if cycle found.

- **What happens when user deletes a child node that has historical impact markers in parent?**
  - Parent's historical markers remain (immutable history) but display "[Deleted node]" in tooltip with greyed-out appearance. Clicking marker shows "Original node no longer exists" message.

- **How does timeline playback handle concurrent LLM operations (multiple nodes streaming at same timestamp)?**
  - Playback shows all concurrent operations simultaneously. Each node updates independently as timeline cursor advances. May result in 5+ nodes updating at once (system must handle performance).

- **What happens when version storage exceeds 1GB per graph (massive history)?**
  - System implements automatic archiving: versions older than 30 days (configurable) are compressed (gzip) and moved to archive storage. UI provides "Load archived versions" button to access. Hard limit: 10GB per graph with warning.

- **How does global timeline handle graphs with 1000+ nodes and 50,000+ version events?**
  - Timeline uses event aggregation: events within same minute are clustered into single marker showing count. Provides "Load full detail" on-demand. Uses virtual scrolling for event list (only render visible portion).

- **What happens when user exports graph - are versions included?**
  - Export provides options: "Current state only" (no versions, smallest file), "Recent versions" (last 30 days), "Full history" (all versions, largest file). Default: Recent versions.

- **How does system handle version diff for non-text content (future: images, code)?**
  - Text diff for MVP. Future: image diff shows side-by-side with pixel difference overlay, code diff uses syntax-aware diff highlighting.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Version Creation and Storage

- **FR-001**: System MUST automatically create immutable NodeVersion record on every meaningful node content change (edit, LLM generation, cascade, rollback)
- **FR-002**: Each NodeVersion MUST store: version_id (UUID), node_id (parent node), version_number (sequential 1, 2, 3...), content (full snapshot), created_at (timestamp), trigger_reason (enum: manual_edit, parent_cascade, user_regen, rollback), author (human/LLM)
- **FR-003**: System MUST implement smart throttling: no version on every keystroke, create version after 3 seconds of typing inactivity OR on >30% content change threshold OR on LLM/cascade/manual save
- **FR-004**: LLM-generated versions MUST include additional metadata: llm_provider, model_name, token_count, generation_time_ms, prompt_used
- **FR-005**: Cascade-generated versions MUST include additional metadata: triggering_child_versions (list of child version IDs), cascade_depth (1 for direct child, 2 for grandchild, etc.)
- **FR-006**: System MUST enforce version limit per node (default: 100 versions), automatically archiving oldest versions when limit exceeded
- **FR-007**: System MUST detect and skip version creation when content is identical to previous version (deduplication)
- **FR-008**: System MUST persist versions in durable storage (JSON files per node: `data/versions/{node_id}/versions.json`)
- **FR-009**: System MUST support version rollback: restoring previous version creates NEW version (trigger_reason "rollback") preserving full history, never destructive

#### Per-Node History UI

- **FR-010**: Every node MUST display history icon badge (clock icon, subtle, top-right corner) with version count on hover
- **FR-011**: Clicking history icon MUST open version history panel (modal or side panel, non-blocking overlay) showing timeline slider interface
- **FR-012**: Timeline slider MUST display all versions as markers (dots/ticks) on horizontal axis with time scaling (earlier versions spaced proportionally to time gaps)
- **FR-013**: Dragging timeline slider MUST update content preview pane in real-time (60fps smooth animation) showing selected version's content without committing change
- **FR-014**: Version markers MUST display tooltip on hover showing: timestamp (relative: "2 hours ago" + absolute), author, trigger_reason, word count, first 50 characters of content
- **FR-015**: History panel MUST provide "Restore this version" button that reverts node to selected version and creates new version (non-destructive rollback)
- **FR-016**: History panel MUST provide "Compare with current" button that opens diff view comparing selected version to current version
- **FR-017**: History panel MUST support comparing any two versions: user selects two versions via checkboxes, clicks "Compare", sees side-by-side diff
- **FR-018**: Timeline MUST visually distinguish version types using marker size/color: manual edits (large, blue), LLM generations (large, green), cascades (medium, orange), rollbacks (medium, purple), auto-throttled (small, grey)
- **FR-019**: History panel MUST remember last viewed version across open/close cycles (session persistence, not permanent)
- **FR-020**: History panel MUST handle 100+ versions gracefully: use compressed markers with clustering, provide date range filter to zoom into time periods

#### Parent Impact Tracking

- **FR-021**: When child node creates new version, system MUST automatically record "child_change_marker" in parent node's history timeline (not a full version, just a marker)
- **FR-022**: Child change markers MUST store: marker_id, parent_node_id, child_node_id, child_version_id, timestamp, marker_type (enum: direct_child_change, transitive_child_change)
- **FR-023**: Parent timeline MUST display child change markers interwoven chronologically with parent's own version markers, visually distinct (diamond shape vs circle, orange color vs blue)
- **FR-024**: Hovering child change marker MUST display tooltip showing: "Child node '[child title]' was updated", child trigger_reason, timestamp, preview of child's content diff (first 100 chars)
- **FR-025**: Clicking child change marker MUST open modal showing child node's version diff (before/after change) with "Jump to child node" button to navigate canvas to child
- **FR-026**: When child node is edited, parent node MUST display visual indicator (orange border badge or icon) showing "Children changed since last update - consider regenerating"
- **FR-027**: System MUST track cascade regenerations: when parent is regenerated due to child changes, new parent version links to triggering child version IDs in metadata
- **FR-028**: Parent versions created by cascade MUST display special tooltip: "Triggered by child updates" with clickable list of child nodes that triggered regeneration
- **FR-029**: System MUST support transitive impact tracking: when grandchild (C) changes, both parent (B) and grandparent (A) record markers, visually distinct (hollow diamond for transitive, solid for direct)
- **FR-030**: System MUST prevent infinite cascade loops: detect circular dependencies (A→B→C→A), stop cascades at depth limit (default: 5), log warning "Circular dependency detected"

#### Global Timeline View

- **FR-031**: System MUST provide "Global Timeline" view accessible from toolbar button or context menu showing entire graph's evolution over time
- **FR-032**: Global timeline MUST display horizontal timeline spanning graph's lifetime (creation to present) with zoom controls (1 hour, 1 day, 1 week, 1 month, all time)
- **FR-033**: Each version event across all nodes MUST appear as vertical marker at its timestamp, color-coded by event type (edit=blue, LLM=green, cascade=orange, rollback=purple)
- **FR-034**: When multiple events occur at same timestamp, system MUST vertically stack or cluster markers with count indicator (e.g., "5 events at 2:30 PM")
- **FR-035**: Hovering event marker MUST display tooltip: node title (first 30 chars), event type, author, timestamp, "Jump to node" quick action
- **FR-036**: Clicking event marker MUST pan canvas to that node and open its version history panel at specific version
- **FR-037**: Global timeline MUST provide zoom in/out controls: mouse wheel, pinch gesture, or drag zoom handles to focus on specific time range
- **FR-038**: Global timeline MUST provide playback mode: "Play" button advances timeline cursor automatically (configurable speed: 1x, 5x, 10x, 100x) and graph visually updates to show nodes in historical state at each timestamp
- **FR-039**: Playback mode MUST animate version transitions: nodes update content as timeline cursor passes their version events, with smooth fade transitions
- **FR-040**: Global timeline MUST provide filters: event type (show only edits/LLMs/cascades), node selection (show only events from selected nodes), date range, author (human vs LLM)
- **FR-041**: Global timeline MUST support exporting timeline data: CSV or JSON format with all events (timestamp, node_id, event_type, content_preview) for external analysis
- **FR-042**: Global timeline MUST handle 1000+ nodes and 50,000+ events: use event aggregation (cluster events within same minute), virtual scrolling for event list, lazy loading

#### Version Diff and Comparison

- **FR-043**: System MUST provide diff view for comparing any two versions of a node, accessible from version history panel via "Compare" button
- **FR-044**: Diff view MUST display side-by-side comparison (left=older version, right=newer version) with full content of both versions
- **FR-045**: Diff algorithm MUST highlight: additions (green background, underline), deletions (red background, strikethrough), modifications (yellow background), unchanged text (grey, low opacity)
- **FR-046**: Diff view MUST collapse large unchanged sections (threshold: 5+ unchanged lines) with "Show N unchanged lines" expand button to reduce visual clutter
- **FR-047**: Diff view MUST display version metadata for each side: version number, timestamp (relative + absolute), trigger_reason, word count, change delta (+150 words, -30 words)
- **FR-048**: Diff view MUST provide "Restore left version" button to revert current content to left-side version (creates new version with trigger_reason "rollback")
- **FR-049**: Diff view MUST support text selection and "Copy to clipboard" for cherry-picking changes for manual merge
- **FR-050**: Diff algorithm MUST detect paragraph-level changes: moved paragraphs shown as move operations (blue badge "Moved from line 10"), not delete+add
- **FR-051**: Diff algorithm MUST operate at word level (not just line level) for precision in highlighting exact changes
- **FR-052**: System MUST process large diffs (500+ word changes) in background worker (non-blocking) with loading spinner, maintaining UI responsiveness

### Key Entities

- **NodeVersion**: Immutable snapshot of node content at specific point in time
  - version_id (UUID, primary key)
  - node_id (UUID, foreign key to Node)
  - version_number (integer, sequential: 1, 2, 3...)
  - content (string, full content snapshot, max 10,000 chars)
  - created_at (datetime, UTC timestamp)
  - trigger_reason (enum: manual_edit, parent_cascade, user_regen, rollback)
  - author (string: "human" or "LLM")
  - llm_metadata (optional dict: provider, model, tokens, generation_time_ms, prompt)
  - cascade_metadata (optional dict: triggering_child_versions list, cascade_depth integer)
  - parent_version_id (optional UUID, for rollback chains)
  - word_count (integer, cached for performance)
  - char_count (integer, cached for performance)

- **ChildChangeMarker**: Historical marker in parent timeline when child changes
  - marker_id (UUID, primary key)
  - parent_node_id (UUID, foreign key to Node)
  - child_node_id (UUID, foreign key to Node)
  - child_version_id (UUID, foreign key to NodeVersion)
  - timestamp (datetime, when child changed)
  - marker_type (enum: direct_child_change, transitive_child_change)
  - cascade_depth (integer: 1 for direct child, 2 for grandchild, etc.)

- **VersionDiff**: Computed difference between two versions (generated on-demand, not stored)
  - old_version_id (UUID)
  - new_version_id (UUID)
  - additions (list of text spans: {text, start_pos, end_pos})
  - deletions (list of text spans: {text, start_pos, end_pos})
  - modifications (list of text spans: {old_text, new_text, start_pos, end_pos})
  - unchanged (list of text spans: {text, start_pos, end_pos})
  - word_count_delta (integer: +150, -30)
  - char_count_delta (integer)

- **TimelineEvent**: Unified event for global timeline view (aggregates NodeVersions and ChildChangeMarkers)
  - event_id (UUID or derived from version/marker ID)
  - event_type (enum: version_created, child_changed, cascade_triggered)
  - node_id (UUID)
  - node_title (string, cached for performance)
  - timestamp (datetime)
  - author (string)
  - trigger_reason (enum)
  - metadata (dict, flexible for different event types)

- **TimelinePlaybackState**: State for global timeline playback mode
  - current_cursor_position (datetime, where playback is in time)
  - playback_speed (float: 1.0 = realtime, 10.0 = 10x speed)
  - is_playing (boolean)
  - visible_time_range (start_datetime, end_datetime, for zoom)
  - active_filters (dict: event_types list, node_ids list, date_range tuple)

- **VersionArchive**: Archived versions (older than 30 days or beyond 100-version limit)
  - archive_id (UUID)
  - node_id (UUID)
  - archived_versions (list of NodeVersion, compressed/gzipped)
  - archive_date (datetime)
  - archive_reason (enum: age_threshold, count_limit)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view version history for any node in <3 clicks (history icon → see timeline with all versions)
- **SC-002**: Timeline slider scrubbing is smooth at 60fps (frame time <16ms) even with 100 versions displayed
- **SC-003**: Version content preview updates within 100ms of slider drag (real-time responsiveness)
- **SC-004**: System creates versions within 200ms of trigger event (edit pause, LLM completion, cascade)
- **SC-005**: Loading 100-version timeline takes <2 seconds (includes parsing JSON, rendering UI, computing layout)
- **SC-006**: Diff algorithm processes 1000-word comparison in <500ms (background worker, non-blocking)
- **SC-007**: Parent nodes display child change markers within 300ms of child version creation (impact tracking latency)
- **SC-008**: Global timeline loads 1000 events in <3 seconds (includes aggregation, clustering, rendering)
- **SC-009**: Playback mode advances smoothly at 60fps for 1x-10x speed (no dropped frames or lag)
- **SC-010**: Users successfully restore previous version in <5 clicks (open history → select version → restore) with 95% task completion rate in usability testing
- **SC-011**: Version storage uses <10MB per 100 versions (efficient JSON compression, no redundant data)
- **SC-012**: System handles graphs with 50,000 total versions across 500 nodes without UI performance degradation (maintains <100ms interaction latency)

### Qualitative Outcomes

- Users understand how their reasoning evolved over time by viewing version history chronologically
- Users can confidently experiment with edits knowing they can restore any previous version
- Users recognize causality chains by seeing child change markers in parent history
- Power users gain situational awareness of entire graph evolution through global timeline view
- Users trust the system to never lose their work (immutable history, non-destructive rollbacks)
- Version diffs make changes immediately obvious without needing to read full content
- Timeline playback creates "movie of reasoning development" effect, revealing patterns and insights
- Users feel the system has transformed from spatial (graph structure) to spatio-temporal (graph structure + time dimension)

---

## Assumptions *(optional)*

1. **Version Limit**: 100 versions per node is sufficient for typical usage. Power users creating 500+ versions are edge case handled by archiving.
2. **Storage**: JSON file storage is acceptable for MVP. Each node's versions stored in separate JSON file (`data/versions/{node_id}/versions.json`). Future: migrate to database for better query performance.
3. **Single-User**: All versions created by single user (no multi-user collaboration). Author field is "human" or "LLM", not specific user IDs. Future: add user_id when multi-user support added.
4. **Content Size**: Node content max 10,000 characters enforced. Versions inherit this limit. Prevents storage bloat and ensures diff performance.
5. **Diff Algorithm**: Myers diff algorithm (or similar line-based diff) is sufficient for text content. Word-level granularity is acceptable (not character-level). Future: syntax-aware diff for code content.
6. **Timeline UI**: Horizontal timeline is more intuitive than vertical for temporal data (user testing assumption). Future: offer vertical timeline as alternative layout.
7. **Throttling Threshold**: 3-second inactivity and 30% change threshold are reasonable defaults based on typical editing patterns. Future: make user-configurable.
8. **Cascade Depth**: Depth limit of 5 prevents infinite loops and performance issues. Real-world graphs rarely exceed depth 3. Future: make configurable with warning at depth 4.
9. **Archive Strategy**: 30-day age threshold for archiving balances storage efficiency with access needs. Users rarely need versions older than 30 days. Future: make configurable.
10. **Playback Speed**: 1x-100x speed range covers typical use cases (1x for detailed review, 100x for quick overview). Future: add "smart speed" that slows down at important events.

---

## Dependencies *(optional)*

**External Dependencies**:
- None (all functionality implemented using existing libraries)

**Internal Dependencies**:
- **Feature 001**: MindFlow Engine (Node, Graph models provide base entities)
- **Feature 002**: Node Canvas Interface (ReactFlow provides node rendering for visual updates)
- **Feature 003**: Node Editor & LLM Orchestration (LLM operations trigger version creation)
- **Feature 007**: Concurrent LLM Hierarchy (cascade regenerations trigger parent version creation)
- Existing NodeVersion model (already defined in `src/mindflow/models/node_version.py`)
- Existing Graph model (provides node storage and relationships)

**Implementation Considerations**:
- Use Myers diff algorithm for version comparison (well-tested, efficient)
- Use React Timeline component library for global timeline UI (e.g., vis-timeline, react-timelines)
- Use React Slider component for per-node timeline (e.g., rc-slider, react-slider)
- Use DiffMatchPatch or similar library for text diff visualization
- Use Web Workers for background diff computation (non-blocking)
- Use IndexedDB for caching large version histories in browser (performance)

---

## Out of Scope *(optional)*

### Explicitly Excluded from MVP

- **Multi-user collaboration**: Conflict resolution when multiple users edit same node simultaneously (future enhancement)
- **Branch versioning**: Git-like branching where users create parallel version timelines (too complex for MVP)
- **Version tagging**: User-defined labels/tags on important versions (e.g., "Milestone", "Final") (future enhancement)
- **Automated version summarization**: LLM-generated summaries of what changed in each version (too costly, future enhancement)
- **Cross-node version comparison**: Comparing different nodes' versions (current feature only compares same node's versions)
- **Version analytics**: Statistics like "average edits per day", "most active nodes", "LLM vs human edit ratio" (future analytics dashboard)
- **Collaborative version voting**: Team votes on best version to restore (multi-user feature)
- **Version compression algorithms**: Smart compression to reduce storage (simple gzip is sufficient for MVP)
- **Real-time collaborative cursors**: Show where other users are in version history (multi-user feature)
- **Version permissions**: Role-based access control for who can view/restore versions (future security feature)
- **External version control integration**: Git integration to sync versions with external repository (complex, future enhancement)
- **Audio/video recording**: Record user voice notes or screen recording linked to versions (too complex, different scope)

### Future Enhancements

1. **Smart Version Summaries**: Use LLM to generate 1-sentence summary of what changed in each version (shown in timeline tooltip)
2. **Version Search**: Full-text search across all versions to find when specific phrase was introduced or removed
3. **Version Merging**: Manually merge changes from two divergent versions (conflict resolution UI)
4. **Export Version History**: Export entire version history as PDF report or interactive HTML
5. **Version Recommendations**: LLM analyzes versions and suggests "This version (v7) was more coherent than current (v12)"
6. **Heatmap Visualization**: Show which nodes have most version activity (color intensity on canvas)
7. **Version Scheduling**: Automatically save snapshot versions at regular intervals (e.g., every hour) regardless of edits
8. **Diff Presets**: User-defined diff view preferences (inline vs side-by-side, color schemes, font sizes)
9. **Version Annotations**: Users add comments/notes to specific versions explaining rationale
10. **Cross-Graph Version Linking**: Link versions across different graphs (e.g., "This version informed decision in other project")

---

## Notes *(optional)*

### Design Philosophy

**Spatio-Temporal System**: MindFlow evolves from a spatial reasoning tool (navigate node hierarchy) to a spatio-temporal reasoning tool (navigate node hierarchy AND time). Users can think in 4 dimensions:
1. **X-axis**: Horizontal canvas position (spatial)
2. **Y-axis**: Vertical canvas position (spatial)
3. **Z-axis**: Hierarchy depth - parent/child relationships (spatial)
4. **Time-axis**: Version history - evolution over time (temporal)

This transformation enables new reasoning patterns:
- "What was I thinking 2 hours ago when I wrote this hypothesis?"
- "How did this question evolve after the LLM suggested new angles?"
- "When did this parent conclusion become outdated relative to child evidence?"
- "Can I replay my entire thought process like a movie to find where I went wrong?"

### UX Principles

1. **Non-Destructive Everything**: All operations preserve history. Restoring version creates new version (rollback is logged). Deleting node keeps versions. Users can always undo or explore past states.

2. **Time as First-Class Citizen**: Time is not an afterthought (buried in metadata) but a primary navigation dimension alongside space. Timeline UI is always accessible, not hidden in menus.

3. **Causality Visibility**: Parent-child relationships are not just spatial (edges on canvas) but also temporal (child changes trigger parent markers). Users see causality chains explicitly.

4. **Cognitive Load Management**: Timeline UI is simple (slider, not complex calendar). Diff is visual (colors, not text descriptions). Playback is automated (click play, not manual scrubbing).

5. **Performance First**: 60fps animations, <100ms responsiveness, background processing for heavy operations. Temporal features should feel instant despite complexity.

### Technical Considerations (Non-Technical Language)

**Storage Strategy**: Each node's versions stored in dedicated JSON file (`data/versions/{node_id}/versions.json`). This keeps file sizes manageable (<1MB per node with 100 versions) and enables fast per-node loading. Global timeline aggregates across files only when needed.

**Diff Performance**: Text diff is computationally expensive (O(n*m) complexity). System runs diff in background Web Worker to avoid blocking UI. For large diffs (1000+ words), system shows loading spinner for 1-2 seconds - acceptable trade-off.

**Timeline Scaling**: Global timeline uses event aggregation: when zoomed out (viewing entire month), events within same hour are clustered. When zoomed in (viewing single day), full detail shown. This enables handling 50,000+ events without rendering 50,000 DOM elements.

**Parent Impact Detection**: When child version is created, system immediately queries parent relationships from Graph model and writes ChildChangeMarker to parent's history file. This is synchronous operation (<50ms) ensuring markers appear before user can interact with parent.

**Archive Strategy**: Versions older than 30 days are moved to archive file (`data/versions/{node_id}/archive.json.gz`) compressed with gzip (90% size reduction). UI provides "Load archived versions" button - when clicked, system decompresses and displays archived versions in timeline (2-3 second load time).

### User Mental Model

Users should conceptualize MindFlow as:
- **Spatial Canvas**: Nodes arranged in 2D space with hierarchical connections (existing mental model)
- **Time Machine**: Every node has a timeline slider - drag slider to "time travel" and see past states
- **Causality Tracker**: Child changes create ripples in parent history - visible as markers on parent timeline
- **Evolution Recorder**: Global timeline is "movie of my thinking" - press play to watch how ideas developed

**Key User Insight**: "My reasoning is not static. It evolves over time as I learn, as LLMs suggest new angles, as evidence changes. MindFlow now remembers this evolution and lets me navigate it."

### Edge Case Handling Philosophy

- **Graceful Degradation**: When version count exceeds 100, archive oldest (don't delete). When diff takes >3s, show loading spinner (don't freeze UI). When circular cascade detected, stop and log warning (don't crash).
- **User Control**: System makes smart defaults (3s throttle, 100 version limit) but provides manual overrides (force save now, load archived versions).
- **Performance Boundaries**: System has hard limits (10GB per graph, 50,000 events in timeline) but provides warnings before hitting limits, giving users time to export or clean up.

### Future Vision

**Collaborative Temporal Analysis** (Beyond MVP):
- Multiple users viewing same graph's history simultaneously
- User A rewinds timeline to 2 hours ago while User B stays at present
- User A says "Look at version 12 from 2pm - that hypothesis was stronger"
- User B's canvas jumps to version 12, diff appears showing what changed
- Team discusses which version to restore based on collaborative temporal review

**AI-Powered Temporal Insights** (Beyond MVP):
- LLM analyzes entire version history and generates insights:
  - "Your reasoning became more focused after version 7"
  - "This branch stagnated for 2 hours after LLM suggestion - consider revisiting"
  - "Version 12 was closest to your initial question - subsequent edits diverged"
- System suggests optimal version to restore based on user's current goal

**Temporal Patterns** (Beyond MVP):
- System detects patterns across version history:
  - "You tend to make major edits in the morning, minor refinements in evening"
  - "LLM suggestions lead to 3x more cascade regenerations than manual edits"
  - "Nodes with 20+ versions tend to be questions, not hypotheses"
- These patterns inform UI suggestions: "Consider splitting this heavily-edited node into sub-nodes"
