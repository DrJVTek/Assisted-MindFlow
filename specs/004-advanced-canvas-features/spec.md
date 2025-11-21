# Feature Specification: Advanced Canvas Features

**Feature Branch**: `004-advanced-canvas-features`
**Created**: 2025-11-18
**Status**: Draft
**Input**: User description: "Advanced canvas features: customizable node icons, importance ratio system, auto-layout algorithm, left navigation panel for managing multiple canvases with naming, reusable sub-graphs that can be embedded as blocks in other graphs with input/output connection points, and drag-and-drop functionality to add existing canvases as sub-blocks."

## Executive Summary

This feature transforms MindFlow from a single-canvas tool into a multi-workspace platform with advanced organization and reusability capabilities. Users can manage multiple reasoning graphs, automatically arrange nodes, customize visual appearance, and create reusable sub-graphs that function as modular components across different canvases.

**Key Value Propositions**:
- **Workspace Management**: Navigate between multiple reasoning sessions with dedicated canvas management
- **Visual Organization**: Auto-layout eliminates manual node positioning tedium
- **Modularity**: Reusable sub-graphs enable building complex reasoning from proven patterns
- **Customization**: Personalized icons and importance weighting adapt to user workflow

---

## User Scenarios & Testing

### User Story 1 - Multi-Canvas Workspace Navigation (Priority: P1)

**As a user**, I want to create, name, and switch between multiple reasoning canvases from a navigation panel, **so that** I can organize different projects or thought processes separately.

**Why this priority**: Foundation for all other features - without multiple canvases, sub-graphs and advanced organization have no context. Delivers immediate value by enabling project separation.

**Independent Test**: Can be fully tested by creating 3 named canvases, switching between them, renaming one, deleting one, and verifying each canvas retains its unique nodes and state.

**Acceptance Scenarios**:

1. **Given** I'm on the main interface, **When** I click "+ New Canvas" in the left panel, **Then** a new blank canvas is created with default name "Untitled Canvas 1" and becomes active
2. **Given** I have 5 canvases in the navigation panel, **When** I click on "Project Alpha" canvas, **Then** the canvas area switches to display "Project Alpha" nodes and connections
3. **Given** I'm viewing a canvas named "Untitled Canvas 3", **When** I double-click the name and type "Brainstorm Session", **Then** the canvas is renamed and the new name appears in navigation
4. **Given** I have a canvas selected in navigation, **When** I right-click and select "Delete Canvas", **Then** a confirmation dialog appears warning about data loss
5. **Given** I confirm canvas deletion, **When** the dialog closes, **Then** the canvas is removed from navigation and the previous canvas becomes active
6. **Given** I have 10 canvases, **When** I scroll the navigation panel, **Then** all canvases remain accessible with smooth scrolling
7. **Given** I switch between canvases, **When** I return to a previous canvas, **Then** all nodes, positions, zoom level, and pan state are restored exactly as left

**UI Requirements**:
- Left sidebar panel (collapsible, 250px default width)
- Canvas list with icons, names, last-modified timestamps
- "+ New Canvas" button at top
- Context menu: Rename, Duplicate, Delete, Export
- Active canvas highlighted with accent color
- Search/filter input for canvases with >10 items

---

### User Story 2 - Copy/Cut/Paste Operations (Priority: P2)

**As a user**, I want to copy, cut, and paste nodes and groups using keyboard shortcuts and context menu, **so that** I can efficiently duplicate patterns and reorganize graph structures.

**Why this priority**: Core editing functionality expected in all visual editors. Enables rapid prototyping by duplicating node structures. Essential for productivity.

**Independent Test**: Create 3 nodes, select them, copy (Ctrl+C), paste (Ctrl+V) to new location, verify duplicates have unique IDs but identical content, cut (Ctrl+X) original nodes, paste elsewhere, verify nodes moved.

**Acceptance Scenarios**:

1. **Given** I have selected 2 nodes, **When** I press Ctrl+C (or Cmd+C on Mac), **Then** nodes are copied to clipboard and a "2 items copied" toast appears
2. **Given** I have nodes in clipboard, **When** I press Ctrl+V, **Then** duplicate nodes appear at cursor position with suffix " (copy)" in title
3. **Given** I select 3 nodes, **When** I press Ctrl+X, **Then** nodes are cut (visually dimmed) and moved to clipboard
4. **Given** I have cut nodes, **When** I paste them, **Then** original nodes are removed from old location and appear at new location (not duplicated)
5. **Given** I copy a node with children, **When** I paste, **Then** entire subtree is duplicated with all parent-child relationships preserved
6. **Given** I right-click a node, **When** I select "Copy" from context menu, **Then** same behavior as Ctrl+C
7. **Given** I copy nodes from Canvas A and switch to Canvas B, **When** I paste, **Then** nodes are duplicated in Canvas B (cross-canvas paste)
8. **Given** I paste nodes multiple times, **When** each paste occurs, **Then** new duplicates are created with incremented suffixes " (copy 2)", " (copy 3)", etc.
9. **Given** I have copied a sub-graph instance, **When** I paste, **Then** a new instance of the same sub-graph template is created (not a localized copy)

**Keyboard Shortcuts**:
- Copy: Ctrl+C (Windows/Linux), Cmd+C (Mac)
- Cut: Ctrl+X (Windows/Linux), Cmd+X (Mac)
- Paste: Ctrl+V (Windows/Linux), Cmd+V (Mac)
- Duplicate: Ctrl+D (Windows/Linux), Cmd+D (Mac) - shortcut for copy+paste in place

**Clipboard Behavior**:
- Clipboard persists across canvas switches within same session
- Clipboard clears on browser refresh (browser limitation)
- Clipboard format: JSON structure with node data + relationships
- Cross-tab paste not supported (browser security limitation)

**Paste Positioning**:
- Paste at cursor position if cursor is over canvas
- Paste at viewport center if no cursor position available
- Offset by 20px from original if pasting in same location (prevent overlap)

**ID Generation**:
- Copied nodes get new UUIDs to prevent conflicts
- Parent-child relationships are preserved using new IDs
- Tags and metadata are duplicated exactly

---

### User Story 3 - Auto-Layout Algorithm (Priority: P3)

**As a user**, I want to automatically arrange nodes in a readable hierarchy, **so that** I can focus on content instead of manual positioning and quickly understand graph structure.

**Why this priority**: High-impact UX improvement that saves time on every canvas. Particularly valuable for large graphs (>20 nodes) where manual layout becomes tedious.

**Independent Test**: Create a graph with 30 nodes in random positions, trigger auto-layout, verify all nodes are positioned in clear hierarchical layers with no overlaps, and parent-child relationships are visually obvious.

**Acceptance Scenarios**:

1. **Given** I have a messy canvas with overlapping nodes, **When** I click "Auto-Layout" button in toolbar, **Then** all nodes smoothly animate to hierarchical positions over 1 second
2. **Given** auto-layout has positioned nodes, **When** I inspect parent-child connections, **Then** parent nodes are always positioned above their children with consistent vertical spacing
3. **Given** nodes are at the same hierarchy level, **When** auto-layout runs, **Then** siblings are spaced horizontally with equal gaps (minimum 50px between node borders)
4. **Given** I have a wide graph (>10 top-level nodes), **When** auto-layout executes, **Then** the canvas auto-zooms to fit the entire layout within viewport
5. **Given** I manually adjust a node position after auto-layout, **When** I drag the node, **Then** only that node moves (layout doesn't re-trigger automatically)
6. **Given** I want to preserve manual tweaks, **When** I add a new node, **Then** existing nodes keep their positions and only the new branch is auto-arranged
7. **Given** I have grouped nodes, **When** auto-layout runs, **Then** groups move as single units maintaining internal relative positions

**Algorithm Requirements**:
- Hierarchical top-down layout (like Dagre or Sugiyama)
- Minimize edge crossings
- Respect node dimensions (variable height based on content)
- Handle cycles gracefully (feedback loops in reasoning)
- Configurable spacing parameters (user preference)

**Performance**:
- Layout calculation completes in <500ms for graphs up to 100 nodes
- Animation runs at 60fps
- Option to disable animation for accessibility

---

### User Story 4 - Reusable Sub-Graphs with I/O Ports (Priority: P4)

**As a user**, I want to save a canvas as a reusable sub-graph with defined inputs and outputs, **so that** I can embed proven reasoning patterns into other projects without duplication.

**Why this priority**: Unlocks modularity and knowledge reuse - enables building complex reasoning from tested components. Requires workspace navigation (P1) as foundation.

**Independent Test**: Create a canvas "Hypothesis Testing Template" with 2 input ports and 1 output port, embed it into a new canvas "Research Project", connect parent nodes to input ports, verify sub-graph processes data internally and outputs to parent graph.

**Acceptance Scenarios**:

1. **Given** I'm editing a canvas "Decision Framework", **When** I click "Convert to Sub-Graph" in canvas settings, **Then** a sub-graph configuration dialog appears
2. **Given** the sub-graph dialog is open, **When** I click "+ Add Input Port" and name it "Problem Statement", **Then** the port is added to the sub-graph definition
3. **Given** I've defined 2 input ports and 1 output port, **When** I click "Save as Sub-Graph", **Then** the canvas is marked as a sub-graph and appears in sub-graph library
4. **Given** I'm on a different canvas, **When** I drag "Decision Framework" sub-graph from library onto canvas, **Then** a sub-graph node appears showing input/output ports as connection handles
5. **Given** a sub-graph node is on canvas, **When** I click its "Expand" button, **Then** the internal canvas opens in a modal overlay showing all internal nodes
6. **Given** I'm viewing sub-graph internals, **When** I modify a node, **Then** changes are reflected in all instances of that sub-graph across all canvases
7. **Given** I want instance-specific behavior, **When** I right-click sub-graph and select "Localize Copy", **Then** a new independent copy is created that can be edited without affecting other instances
8. **Given** I connect a parent node to a sub-graph input port, **When** the sub-graph processes, **Then** the input data flows to the designated input node inside the sub-graph
9. **Given** the sub-graph completes processing, **When** output nodes generate results, **Then** data flows to the output port and connects to downstream nodes in parent graph

**Sub-Graph Properties**:
- Name, description, version number
- Input ports: name, data type hint (text, number, list, etc.)
- Output ports: name, data type hint
- Icon/thumbnail preview
- Author, last modified date
- Usage count across all canvases

**Data Flow**:
- Input ports map to specific nodes inside sub-graph (marked as "Input Node")
- Output ports map to specific nodes inside sub-graph (marked as "Output Node")
- Data passing uses same mechanism as regular node connections
- Sub-graphs can contain other sub-graphs (nested composition)

---

### User Story 5 - Customizable Node Icons (Priority: P5)

**As a user**, I want to change node type icons to match my personal workflow, **so that** I can quickly identify node purposes at a glance using familiar symbols.

**Why this priority**: Nice-to-have personalization that improves visual scanning but not critical for core functionality. Can be added after foundational features.

**Independent Test**: Open icon customization settings, select "question" node type, choose a new icon from library, create a new question node, and verify it displays the custom icon instead of default.

**Acceptance Scenarios**:

1. **Given** I'm in Settings > Node Appearance, **When** I see the list of node types, **Then** each type shows current icon with "Change Icon" button
2. **Given** I click "Change Icon" for "hypothesis" type, **When** an icon picker dialog opens, **Then** I see categories: Lucide Icons, Emoji, Custom Upload
3. **Given** I select a lightbulb emoji 💡, **When** I click "Apply", **Then** all "hypothesis" nodes update to show 💡 instead of the default icon
4. **Given** I upload a custom SVG icon, **When** the upload succeeds, **Then** the icon appears in "Custom" section and can be assigned to node types
5. **Given** I've customized multiple icons, **When** I click "Reset to Defaults", **Then** all node types revert to original Lucide icons
6. **Given** I export a canvas, **When** another user imports it, **Then** nodes display using their local icon preferences (not hardcoded from export)

**Icon Sources**:
- Lucide Icons (full library, ~1000 icons)
- Emoji picker (Unicode emoji, categorized)
- Custom upload: SVG, PNG (max 512x512px, auto-resized)

**Appearance Settings**:
- Icon size: Small (16px), Medium (18px), Large (24px)
- Icon color: Inherit from node type color OR custom override
- Fallback: If custom icon fails to load, show default

---

### User Story 5 - Importance Ratio Weighting (Priority: P5)

**As a user**, I want to assign decimal importance weights (0.0-1.0) instead of integer levels, **so that** I can precisely balance node priorities in complex graphs.

**Why this priority**: Refinement of existing feature for power users. Current integer levels (0-10) work for most cases, but advanced users need finer control.

**Independent Test**: Create 5 nodes with weights 0.2, 0.4, 0.6, 0.8, 1.0, verify visual distinction (border thickness, opacity) increases proportionally, and filter by weight range shows correct subset.

**Acceptance Scenarios**:

1. **Given** I'm editing a node, **When** I see the Importance field, **Then** it's a slider with decimal precision (0.00 - 1.00) and numeric input
2. **Given** I set importance to 0.75, **When** I save the node, **Then** the border thickness is 75% of maximum (3px vs 4px max) and opacity is proportionally adjusted
3. **Given** I have nodes with weights 0.1, 0.5, 0.9, **When** I apply "Filter by Importance > 0.5", **Then** only nodes with 0.5 and 0.9 remain visible
4. **Given** I use auto-layout, **When** layout algorithm runs, **Then** higher-weight nodes are positioned more centrally/prominently
5. **Given** I export graph analytics, **When** I view statistics, **Then** average importance, weighted centrality, and importance distribution graph are shown

**Visual Mapping**:
- Border width: `2px + (importance * 2px)` → range 2-4px
- Opacity: `0.6 + (importance * 0.4)` → range 0.6-1.0
- Shadow: Higher importance = stronger shadow (0-8px blur)
- Optional: Color intensity (saturation increases with importance)

**Backward Compatibility**:
- Existing nodes with integer levels (0-10) auto-convert to decimal (divide by 10)
- UI can still display as percentage (75% instead of 0.75) for user familiarity

---

### Edge Cases

- **Empty Canvas**: Auto-layout on canvas with 0 or 1 node should show friendly message "Nothing to arrange"
- **Circular Dependencies**: Sub-graph A contains sub-graph B which contains sub-graph A → detect cycle, show error "Circular sub-graph dependency detected", prevent save
- **Deleted Sub-Graph**: Instance of sub-graph exists on canvas, but original is deleted → show broken link indicator, option to "Convert to Regular Nodes" (flatten)
- **Concurrent Edits**: Single-user scope for v1 - concurrent edits not supported. Future enhancement: multi-user collaboration with conflict resolution (designed for extensibility)
- **Large Graphs**: Auto-layout with >200 nodes → show progress indicator, allow cancel mid-calculation
- **Custom Icon Load Failure**: Uploaded icon URL becomes inaccessible → fall back to default icon, log error, show warning in settings
- **Port Type Mismatch**: Connect text output port to number input port → show warning badge on connection, allow connection to proceed (user decides), log type mismatch for debugging
- **Nested Sub-Graph Depth**: Dynamic limit based on total node count - system calculates complexity score (nodes × nesting level). Warning shown when score exceeds threshold, hard limit prevents infinite recursion

---

## Requirements

### Functional Requirements

#### Canvas Management
- **FR-001**: System MUST allow users to create unlimited named canvases within a workspace
- **FR-002**: System MUST persist canvas state (nodes, edges, zoom, pan) independently for each canvas
- **FR-003**: System MUST enable users to rename, duplicate, and delete canvases from navigation panel
- **FR-004**: System MUST display last-modified timestamp for each canvas in navigation list
- **FR-005**: System MUST provide search/filter functionality when canvas count exceeds 10

#### Auto-Layout
- **FR-006**: System MUST arrange nodes hierarchically based on parent-child relationships
- **FR-007**: System MUST minimize edge crossings during auto-layout computation
- **FR-008**: System MUST respect node dimensions (variable height/width) in layout calculations
- **FR-009**: System MUST complete auto-layout in <500ms for graphs up to 100 nodes
- **FR-010**: System MUST animate layout transitions smoothly over configurable duration (default 1 second)
- **FR-011**: System MUST preserve manual position adjustments when user explicitly moves nodes after auto-layout

#### Sub-Graphs
- **FR-012**: System MUST allow users to designate any canvas as a reusable sub-graph
- **FR-013**: System MUST enable defining named input and output ports for sub-graphs
- **FR-014**: System MUST support drag-and-drop of sub-graphs from library onto active canvas
- **FR-015**: System MUST allow users to expand/collapse sub-graph internals in modal view
- **FR-016**: System MUST propagate changes to sub-graph template across all instances
- **FR-017**: System MUST support creating localized copies of sub-graphs for instance-specific modifications
- **FR-018**: System MUST detect circular sub-graph dependencies and prevent save
- **FR-019**: System MUST support nested sub-graphs with dynamic complexity limit (complexity score = total nodes × nesting level), show warning when threshold approached, prevent recursion beyond hard limit

#### Icon Customization
- **FR-020**: System MUST provide icon picker with Lucide Icons library (~1000 icons)
- **FR-021**: System MUST support emoji selection for node type icons
- **FR-022**: System MUST allow custom icon upload (SVG, PNG, max 512KB file size)
- **FR-023**: System MUST apply icon changes globally to all nodes of selected type
- **FR-024**: System MUST persist icon preferences per user across sessions
- **FR-025**: System MUST fall back to default icon if custom icon fails to load

#### Importance Weighting
- **FR-026**: System MUST accept decimal importance values from 0.00 to 1.00
- **FR-027**: System MUST map importance to visual properties (border width, opacity, shadow)
- **FR-028**: System MUST support filtering nodes by importance range
- **FR-029**: System MUST migrate existing integer importance values (0-10) to decimal (0.0-1.0)
- **FR-030**: System MUST display importance as percentage in UI for user familiarity

### Key Entities

- **Canvas**: Represents a reasoning workspace
  - Attributes: ID, name, created date, last modified, owner, nodes collection, edges collection, viewport state (zoom, pan), settings
  - Relationships: Contains many Nodes, may reference Sub-Graphs

- **Sub-Graph**: A reusable canvas template with defined interface
  - Attributes: ID, name, description, version, input ports (name, type), output ports (name, type), internal canvas reference, thumbnail, usage count
  - Relationships: References a Canvas, can be instantiated multiple times across Canvases

- **Sub-Graph Instance**: An embedded instance of a sub-graph in a parent canvas
  - Attributes: ID, sub-graph template reference, position, localized (boolean), port connections
  - Relationships: References Sub-Graph template, belongs to parent Canvas

- **Node Icon Configuration**: User preferences for node type appearance
  - Attributes: Node type, icon source (lucide/emoji/custom), icon identifier, color override, size preference
  - Relationships: Linked to User preferences

- **Importance Weight**: Precision node priority value
  - Attributes: Decimal value (0.00-1.00), visual mapping rules
  - Part of: Node metadata

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can create and switch between 10 canvases in under 30 seconds with zero lag
- **SC-002**: Auto-layout arranges 50-node graphs in under 300ms with <5% edge crossings
- **SC-003**: 80% of users successfully create and reuse a sub-graph on first attempt (measured via analytics)
- **SC-004**: Custom icon changes apply instantly (<100ms) across all nodes of that type
- **SC-005**: Importance ratio filtering returns results within 50ms for graphs up to 200 nodes
- **SC-006**: Sub-graph library supports at least 50 templates without UI performance degradation
- **SC-007**: Users save at least 60% of time organizing large graphs (>30 nodes) compared to manual layout (measured via time-tracking)

---

## Assumptions

1. **Single-User Scope**: This feature assumes single-user environments. Multi-user collaborative editing of canvases/sub-graphs is out of scope unless explicitly clarified.
2. **Local Storage**: Canvas data persists in backend database, not browser localStorage (scalability).
3. **Icon Library**: Lucide Icons library is already available in project dependencies (verified in existing codebase).
4. **Layout Algorithm**: Will use Dagre.js or ELK.js (both proven open-source solutions for graph layout).
5. **Data Flow Model**: Sub-graph I/O ports pass data as serialized JSON objects compatible with existing node content model.
6. **Import/Export**: Canvas import/export includes sub-graph definitions but does not embed icons (icons remain user preferences).

---

## Dependencies

- **Feature 002**: Node Canvas Interface (provides base canvas rendering infrastructure)
- **Feature 003**: Node Editor & LLM Orchestration (node CRUD operations required for sub-graph manipulation)
- Dagre.js or ELK.js library for auto-layout algorithm
- Lucide Icons React library (already present in frontend)

---

## Future Enhancements (Out of Scope for v1)

- **Canvas Templates**: Predefined canvas structures for common workflows (e.g., "SWOT Analysis", "Decision Tree")
- **Collaborative Editing**: Real-time multi-user collaboration on shared canvases
- **Version Control**: Git-like versioning for canvases and sub-graphs with diff/merge
- **Canvas Analytics**: Insights into canvas usage patterns, most-used sub-graphs, complexity metrics
- **Smart Suggestions**: AI-powered suggestions for sub-graphs based on current canvas context
- **Theme System**: Full UI themes that apply consistent color schemes across all canvases
- **3D Layout**: Alternative layout algorithm for very large graphs (>500 nodes) using 3D space
