# Feature Specification: Interactive Node Canvas Interface

**Feature Branch**: `002-node-canvas-interface`
**Created**: 2025-11-17
**Status**: Draft
**Input**: User description: "je veux une interface modern un peu facon confyui pour la partie node (on peux zome et se déplacer)"

## User Scenarios & Testing

### User Story 1 - Navigate and Explore Graph Canvas (Priority: P1)

Users can view their reasoning graph on an infinite canvas where they can freely zoom in/out and pan around to explore different areas of their graph, similar to modern node-based editors like ComfyUI.

**Why this priority**: Core navigation is fundamental - without the ability to see and move around the graph, users cannot interact with their nodes at all. This is the foundation for all other interactions.

**Independent Test**: Can be fully tested by creating a graph with 5-10 nodes, then verifying users can zoom from 25% to 400% and pan to view all nodes. Delivers immediate value by making graphs viewable and explorable.

**Acceptance Scenarios**:

1. **Given** a graph with multiple nodes spread across the canvas, **When** user scrolls with mouse wheel, **Then** the canvas zooms in/out smoothly centered on mouse position
2. **Given** a zoomed-in view of the canvas, **When** user clicks and drags on empty space, **Then** the canvas pans to follow the mouse movement
3. **Given** nodes positioned beyond the initial viewport, **When** user pans the canvas, **Then** all nodes remain visible and properly positioned relative to the canvas
4. **Given** a heavily zoomed-in view, **When** user double-clicks on empty space, **Then** the canvas resets to fit all nodes in view
5. **Given** a large graph, **When** user clicks a minimap control, **Then** the viewport jumps to that area of the graph

---

### User Story 2 - Visual Node Representation (Priority: P1)

Users see their reasoning nodes displayed as visual cards on the canvas with clear type indicators, content preview, and connection lines showing parent-child relationships.

**Why this priority**: Visual representation is essential for users to understand their graph structure. Without seeing nodes and connections, the canvas is meaningless.

**Independent Test**: Create a graph with question, answer, and hypothesis nodes connected in a chain. Verify each node type has distinct visual styling and connection lines are clearly visible. Delivers value by making graph structure comprehensible at a glance.

**Acceptance Scenarios**:

1. **Given** a node of type "question", **When** user views it on canvas, **Then** it displays with question-specific styling (icon, color scheme) and shows first 100 characters of content
2. **Given** two connected nodes (parent-child), **When** user views them on canvas, **Then** a clear directional line connects them from parent to child
3. **Given** a node with importance 0.9, **When** user views it, **Then** it displays with visual prominence (bolder border, highlighted background)
4. **Given** a node in "valid" status, **When** user views it, **Then** it shows a status indicator (checkmark, green accent)
5. **Given** multiple nodes of different types, **When** user views the canvas, **Then** each type is immediately distinguishable by its visual design

---

### User Story 3 - Interactive Node Selection and Details (Priority: P2)

Users can click on nodes to select them and view detailed information, with visual feedback showing the current selection and any related nodes.

**Why this priority**: Selection enables deeper interaction - users need to select nodes to edit, delete, or inspect them. This builds on the viewing capability.

**Independent Test**: Click on any node and verify it becomes highlighted, shows full content in a detail panel, and related parent/child nodes are visually indicated. Delivers value by enabling users to inspect and interact with specific nodes.

**Acceptance Scenarios**:

1. **Given** an unselected node, **When** user clicks on it, **Then** the node becomes highlighted with a distinct border and detail panel appears
2. **Given** a selected node with parent and child nodes, **When** user views the canvas, **Then** connection lines to related nodes are emphasized
3. **Given** a selected node, **When** user clicks on empty canvas space, **Then** the node becomes deselected and detail panel closes
4. **Given** multiple nodes, **When** user clicks different nodes sequentially, **Then** only the most recently clicked node remains selected
5. **Given** a selected node, **When** user presses Escape key, **Then** the node becomes deselected

---

### User Story 4 - Multi-touch and Gesture Support (Priority: P3)

Users on touch devices can use pinch-to-zoom gestures and two-finger pan to navigate the canvas, providing a natural mobile/tablet experience.

**Why this priority**: Touch support expands accessibility but is not critical for initial desktop users. Desktop mouse/keyboard navigation works first.

**Independent Test**: On a touch-enabled device, use pinch gesture to zoom and two-finger drag to pan. Verify smooth, responsive interaction. Delivers value by making the interface usable on tablets and touch laptops.

**Acceptance Scenarios**:

1. **Given** a touch-enabled device, **When** user performs pinch gesture, **Then** canvas zooms in/out proportionally to pinch distance
2. **Given** a touch-enabled device, **When** user drags with two fingers, **Then** canvas pans following the gesture
3. **Given** touch and mouse inputs available, **When** user switches between input methods, **Then** both work seamlessly without conflicts

---

### User Story 5 - Canvas Performance with Large Graphs (Priority: P2)

Users experience smooth, responsive canvas interactions even when viewing graphs with hundreds of nodes, through viewport culling and optimized rendering.

**Why this priority**: Performance directly impacts usability - laggy canvas makes the tool frustrating. Important for scalability but P1 features must work first.

**Independent Test**: Create a graph with 500 nodes, zoom and pan rapidly. Verify frame rate stays above 30 FPS and interactions remain responsive. Delivers value by ensuring the tool scales with user needs.

**Acceptance Scenarios**:

1. **Given** a graph with 200+ nodes, **When** user zooms out to view all nodes, **Then** canvas renders within 1 second and remains interactive
2. **Given** a graph with 500+ nodes, **When** user pans rapidly, **Then** only visible nodes are rendered (viewport culling active)
3. **Given** active zoom/pan interaction, **When** user moves continuously, **Then** frame rate maintains 30+ FPS
4. **Given** a large graph, **When** user selects a node, **Then** selection feedback appears within 100ms

---

### Edge Cases

- What happens when user zooms below minimum zoom level (25%)? → System prevents further zoom out and shows visual feedback
- What happens when user zooms above maximum zoom level (400%)? → System prevents further zoom in and shows visual feedback
- How does system handle very long node content (10,000+ characters)? → Content is truncated with ellipsis in canvas view, full content in detail panel
- What happens when user drags canvas boundary beyond graph limits? → Elastic boundary effect, canvas snaps back when released
- How does system handle nodes positioned at exact same coordinates? → Nodes are slightly offset automatically with visual stacking indicator
- What happens when graph has no nodes? → Shows centered welcome message with "Create first node" prompt
- How does system handle extremely wide or tall graphs (10,000px dimensions)? → Minimap shows overview, navigation remains smooth with viewport culling

## Requirements

### Functional Requirements

#### Canvas Viewport and Navigation

- **FR-001**: System MUST support infinite canvas scrolling in all directions (no fixed boundaries)
- **FR-002**: System MUST support zoom levels from 25% to 400% with smooth interpolation
- **FR-003**: Users MUST be able to zoom using mouse wheel, with zoom centered on cursor position
- **FR-004**: Users MUST be able to pan canvas by clicking and dragging on empty space
- **FR-005**: System MUST support keyboard shortcuts for navigation (Arrow keys for pan, +/- for zoom)
- **FR-006**: System MUST provide "Fit to View" function that centers and scales to show all nodes
- **FR-007**: System MUST display current zoom percentage in UI (e.g., "100%", "250%")
- **FR-008**: System MUST preserve zoom and pan state when navigating away and returning

#### Node Visualization

- **FR-009**: System MUST render nodes as visual cards with rounded corners and shadows
- **FR-010**: System MUST display node type through visual indicators (icon, color, border style)
- **FR-011**: System MUST show node content preview (first 100 characters) in canvas view
- **FR-012**: System MUST render parent-child connections as curved lines with directional arrows
- **FR-013**: System MUST visually distinguish node importance (0.0-1.0) through visual weight (border thickness, opacity)
- **FR-014**: System MUST display node status (draft, valid, invalid, final, experimental) with color-coded indicators
- **FR-015**: System MUST show author indicator (human, llm, tool) with distinct icons
- **FR-016**: System MUST render connection lines behind nodes (z-index layering)

#### Node Interaction

- **FR-017**: Users MUST be able to select nodes by clicking on them
- **FR-018**: System MUST provide visual feedback for selected nodes (highlighted border, elevation change)
- **FR-019**: System MUST show detail panel when node is selected, displaying full content and metadata
- **FR-020**: System MUST emphasize connections to/from selected node (thicker lines, brighter colors)
- **FR-021**: Users MUST be able to deselect nodes by clicking empty space or pressing Escape
- **FR-022**: System MUST support hover effects on nodes (subtle highlight, cursor change)
- **FR-023**: System MUST allow selection of multiple nodes via click+drag rectangle selection

#### Performance

- **FR-024**: System MUST render only visible nodes (viewport culling)
- **FR-025**: System MUST maintain 30+ FPS during zoom/pan interactions
- **FR-026**: System MUST handle graphs with up to 1000 nodes without performance degradation
- **FR-027**: System MUST debounce rapid zoom/pan inputs to prevent excessive re-renders

#### Touch Support

- **FR-028**: System MUST support pinch-to-zoom gesture on touch devices
- **FR-029**: System MUST support two-finger pan gesture on touch devices
- **FR-030**: System MUST prevent conflict between touch gestures and single-touch interactions

#### Canvas Controls

- **FR-031**: System MUST provide minimap overlay showing overall graph layout
- **FR-032**: System MUST allow clicking minimap to jump to specific canvas area
- **FR-033**: System MUST provide zoom controls (buttons for +, -, fit-to-view)
- **FR-034**: System MUST display grid or reference markers to aid spatial orientation

### Key Entities

- **Canvas Viewport**: Represents the visible area of the infinite canvas, including zoom level, pan offset (x, y coordinates), and viewport dimensions
- **Visual Node**: The visual representation of a reasoning node on canvas, including position (x, y), dimensions (width, height), visual styling (colors, borders, shadows), and rendered content preview
- **Connection Line**: Visual representation of parent-child relationships, including start/end points, curve path, arrow direction, and style (color, thickness)
- **Selection State**: Tracks currently selected nodes, hover states, and multi-selection rectangle

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can navigate a graph of 50 nodes by zooming and panning within 5 seconds of opening
- **SC-002**: Canvas maintains 30+ FPS when zooming/panning with 500+ nodes visible
- **SC-003**: Users can locate and select any specific node in a 100-node graph within 10 seconds using zoom/pan
- **SC-004**: 90% of users successfully complete "find and select a specific node" task on first attempt without instruction
- **SC-005**: Canvas zoom and pan interactions feel smooth and responsive (measured by input latency under 16ms)
- **SC-006**: Touch device users can perform all navigation tasks without needing mouse/keyboard
- **SC-007**: System renders initial view of 200-node graph in under 2 seconds

## Constraints

- Canvas must work in modern web browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Canvas rendering must be responsive on screens from 1280x720 to 3840x2160 resolution
- Canvas must work on touch devices with screen sizes from 10" tablets to 27" touchscreens
- Canvas viewport state must persist across browser sessions

## Assumptions

- Users have basic computer navigation skills (mouse, keyboard, touch gestures)
- Users understand node-graph metaphors from similar tools (mind maps, flowcharts, node editors)
- Default canvas theme uses light background with dark nodes (dark mode variant assumed for future iteration)
- Node positions (x, y coordinates) are stored in graph data model and provided by backend
- Initial zoom level is "fit to view" showing all nodes on first load
- Minimap is displayed by default but can be toggled off
- Grid/reference markers are subtle and non-intrusive
- Connection lines use Bezier curves for smooth visual appearance

## Dependencies

- Requires access to graph data with node positions (x, y coordinates)
- Requires graph data model providing node types, content, metadata, and parent-child relationships
- Requires existing MindFlow Engine API for graph data retrieval

## Out of Scope

- Node creation/editing functionality (separate feature)
- Node drag-and-drop repositioning (separate feature)
- Multi-user collaboration cursors (future enhancement)
- Canvas themes and customization (future enhancement)
- Export canvas as image/PDF (future enhancement)
- Undo/redo for viewport navigation (not needed - navigation is always reversible)
- Mobile-first responsive layout (optimized for desktop/tablet, mobile considered future enhancement)
