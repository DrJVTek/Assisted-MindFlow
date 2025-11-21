# Feature Specification: Intelligent Canvas Reorganize

**Feature Branch**: `001-intelligent-reorganize`
**Created**: 2025-11-21
**Status**: Draft
**Input**: User description: "faudra rajouter un bouton réorganize intéligent ..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto-Layout Cluttered Canvas (Priority: P1)

A user has been working on a canvas for a while, adding nodes, moving them around, and creating connections. The canvas has become cluttered and hard to read. The user wants to automatically reorganize all nodes into a clean, readable layout with a single click.

**Why this priority**: This is the core value proposition of the feature - users need an easy way to clean up messy canvases without manual repositioning of dozens of nodes.

**Independent Test**: Can be fully tested by creating a canvas with 10+ randomly positioned nodes and connections, clicking the reorganize button, and verifying that nodes are repositioned into a hierarchical layout with proper spacing.

**Acceptance Scenarios**:

1. **Given** a canvas with multiple nodes in random positions, **When** user clicks the "Reorganize" button, **Then** all nodes are repositioned into a hierarchical layout with consistent spacing
2. **Given** a canvas with nodes and edges, **When** auto-layout is applied, **Then** edge crossings are minimized and flow direction is clear
3. **Given** a reorganized canvas, **When** user manually moves a node, **Then** the layout does not automatically re-apply (user retains control)

---

### User Story 2 - Preserve Groups and Comments (Priority: P2)

A user has organized some nodes into groups and added comment boxes to annotate sections. When reorganizing, they want these semantic groupings to be preserved and respected by the layout algorithm.

**Why this priority**: Users invest time in organizing their canvas semantically. The intelligent reorganize should enhance this organization, not destroy it.

**Independent Test**: Can be tested by creating a canvas with 2 groups containing nodes, applying reorganize, and verifying that nodes stay within their groups and groups are positioned to show their relationships.

**Acceptance Scenarios**:

1. **Given** nodes organized into groups, **When** reorganize is applied, **Then** nodes remain within their respective groups and groups are positioned cohesively
2. **Given** comment boxes on the canvas, **When** reorganize is applied, **Then** comments are repositioned to stay near their associated nodes
3. **Given** a mix of grouped and ungrouped nodes, **When** reorganize is applied, **Then** grouped nodes maintain their internal structure while the overall canvas is organized

---

### User Story 3 - Layout Direction Control (Priority: P3)

A user wants to control the direction of the auto-layout (top-to-bottom, left-to-right, etc.) to match their mental model or presentation needs.

**Why this priority**: Different users have different preferences for how they visualize hierarchies and flows. This adds flexibility without changing the core functionality.

**Independent Test**: Can be tested by applying reorganize with different direction settings and verifying that the resulting layout follows the chosen direction while maintaining proper node relationships.

**Acceptance Scenarios**:

1. **Given** a canvas with hierarchical relationships, **When** user selects "top-to-bottom" layout and reorganizes, **Then** root nodes appear at the top with children below
2. **Given** a canvas with hierarchical relationships, **When** user selects "left-to-right" layout and reorganizes, **Then** root nodes appear on the left with children to the right
3. **Given** a canvas with selected direction preference, **When** user reorganizes multiple times, **Then** the preferred direction is remembered

---

### Edge Cases

- What happens when a canvas has only one or two nodes? (Should still work, but minimal visual change)
- How does the system handle circular references in node connections? (Break cycles intelligently, possibly using node creation order)
- What happens if a canvas is extremely large (100+ nodes)? (Should complete within reasonable time with progress indicator)
- How does reorganize handle disconnected subgraphs? (Organize each subgraph separately, position them to use available space efficiently)
- What happens to the current viewport zoom and position? (Viewport maintains current position and zoom level - users can manually pan/zoom to see reorganization results)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a "Reorganize" button accessible from the canvas toolbar
- **FR-002**: System MUST apply hierarchical layout algorithm that respects node connections (parent-child relationships)
- **FR-003**: System MUST maintain consistent spacing between nodes after reorganization (minimum spacing to prevent overlap)
- **FR-004**: System MUST preserve group membership when reorganizing (nodes stay in their assigned groups)
- **FR-005**: System MUST reposition comment boxes to stay near their originally adjacent nodes
- **FR-006**: System MUST minimize edge crossings when possible during reorganization
- **FR-007**: System MUST handle disconnected subgraphs by organizing each independently
- **FR-008**: System MUST complete reorganization for typical canvases (up to 50 nodes) in under 2 seconds
- **FR-009**: Users MUST be able to undo a reorganization operation to restore previous layout
- **FR-010**: System MUST save the new node positions after reorganization (persist changes)
- **FR-011**: System MUST show a visual indicator (progress spinner or animation) while reorganization is in progress
- **FR-012**: System MUST preserve all node data, connections, and properties during reorganization (only positions change)
- **FR-013**: Users MUST be able to choose layout direction via context menu when right-clicking the Reorganize button (top-to-bottom, left-to-right, bottom-to-top, right-to-left)

### Key Entities *(include if feature involves data)*

- **Node Position**: X/Y coordinates on canvas, updated by reorganization algorithm
- **Layout Configuration**: User preferences for layout direction, spacing parameters (stored per user or per canvas)
- **Node Hierarchy**: Parent-child relationships derived from edge directions, used to determine hierarchical structure

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can reorganize a canvas with 20-50 nodes in under 3 seconds
- **SC-002**: Reorganized layouts reduce edge crossings by at least 60% compared to random placement
- **SC-003**: 90% of users can understand the reorganized layout without confusion (based on user testing)
- **SC-004**: Users successfully reorganize cluttered canvases on first attempt without reading documentation
- **SC-005**: Node spacing in reorganized layouts maintains minimum 40-60 pixels between node boundaries for readability
- **SC-006**: Grouped nodes remain within their group boundaries in 100% of reorganization operations

## Assumptions *(optional)*

- The canvas already has an undo/redo system that can capture node position changes
- Node connections have implicit direction (from source to target) that can be used to determine hierarchy
- The existing graph layout library (elkjs, per package.json) will be used for the layout algorithm
- Users will primarily work with DAG (Directed Acyclic Graph) structures, though the system should handle cycles gracefully
- Default layout direction will be top-to-bottom unless user specifies otherwise via context menu
- Viewport maintains current position and zoom level after reorganization (users pan/zoom manually to see results)

## Dependencies *(optional)*

- **Existing Graph Data Model**: Must support reading node positions, edges, groups, and comments
- **Canvas Viewport System**: Must support programmatic zoom and pan operations
- **Undo/Redo System**: Must be able to capture bulk position changes as a single undoable operation
- **elkjs Layout Library**: Already installed (v0.9.3), provides hierarchical and force-directed layout algorithms

## Out of Scope *(optional)*

- Custom layout algorithms beyond what elkjs provides
- Manual layout editing tools (drag-to-organize guides, alignment helpers)
- Automatic continuous re-layout as nodes are added (reorganization is always user-triggered)
- Layout templates or presets (e.g., "org chart style", "flowchart style")
- Animation of nodes moving from old to new positions (could be added later for polish)
- Selective reorganization (reorganizing only a subset of nodes) - always reorganizes entire canvas
