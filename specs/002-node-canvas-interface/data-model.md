# Data Model: Interactive Node Canvas Interface

**Feature**: 002-node-canvas-interface
**Date**: 2025-11-17
**Status**: Design Phase

## Overview

This document defines the UI-specific data models for the interactive node canvas interface. These models complement the core MindFlow Engine models (Node, Group, Graph) with UI-specific concerns like viewport state, visual styling, and canvas interaction.

---

## UI Entity Models

### CanvasViewport

Represents the current view state of the infinite canvas.

**Purpose**: Track user's current position and zoom level in the canvas space.

**Properties**:
- `zoom: number` - Current zoom level (0.25 to 4.0, representing 25% to 400%)
- `x: number` - X-axis pan offset in canvas coordinates
- `y: number` - Y-axis pan offset in canvas coordinates
- `width: number` - Viewport width in pixels
- `height: number` - Viewport height in pixels

**Constraints**:
- `zoom` must be between 0.25 and 4.0 inclusive
- `x` and `y` can be any number (infinite canvas)
- `width` and `height` must be positive integers

**Example**:
```typescript
{
  zoom: 1.0,
  x: 0,
  y: 0,
  width: 1920,
  height: 1080
}
```

**Persistence**: Saved to localStorage on change, restored on load

---

### VisualNode

The visual representation of a MindFlow Node on the canvas.

**Purpose**: Extend core Node model with UI-specific rendering properties.

**Properties**:
- `nodeId: UUID` - Reference to core Node.id
- `position: Position` - Node position on canvas
  - `x: number` - X coordinate in canvas space
  - `y: number` - Y coordinate in canvas space
- `dimensions: Dimensions` - Rendered node size
  - `width: number` - Node width in pixels (fixed: 280px)
  - `height: number` - Node height in pixels (auto-sized to content, min: 120px, max: 400px)
- `style: NodeStyle` - Visual styling properties
  - `backgroundColor: string` - CSS color based on node type
  - `borderColor: string` - CSS color based on importance/status
  - `borderWidth: number` - Border thickness (1-4px based on importance)
  - `opacity: number` - Opacity value (0.5-1.0 based on importance)
  - `shadow: string` - CSS box-shadow for elevation
- `preview: string` - Truncated content for canvas display (first 100 characters)

**Derived from Core Node**:
- Type → backgroundColor mapping
- Importance (0.0-1.0) → borderWidth, opacity
- Status → borderColor
- Author → icon display
- Content → preview (truncated)

**Type-to-Color Mapping**:
```typescript
{
  "question": "#E3F2FD",      // Light blue
  "answer": "#E8F5E9",        // Light green
  "note": "#FFF9C4",          // Light yellow
  "hypothesis": "#F3E5F5",    // Light purple
  "evaluation": "#FFE0B2",    // Light orange
  "summary": "#E0F2F1",       // Light teal
  "plan": "#FCE4EC",          // Light pink
  "group_meta": "#ECEFF1",    // Light grey
  "comment": "#FFF3E0",       // Light amber
  "stop": "#FFCDD2"           // Light red
}
```

**Example**:
```typescript
{
  nodeId: "a1b2c3d4-...",
  position: { x: 100, y: 200 },
  dimensions: { width: 280, height: 150 },
  style: {
    backgroundColor: "#E3F2FD",
    borderColor: "#1976D2",
    borderWidth: 3,
    opacity: 0.9,
    shadow: "0 2px 8px rgba(0,0,0,0.15)"
  },
  preview: "What are the key considerations for implementing a node canvas interface with..."
}
```

---

### ConnectionLine

Visual representation of parent-child relationships between nodes.

**Purpose**: Render edges connecting nodes on the canvas.

**Properties**:
- `id: string` - Unique identifier (format: `{parentId}-{childId}`)
- `source: UUID` - Parent node ID
- `target: UUID` - Child node ID
- `path: string` - SVG path string for Bezier curve
- `style: EdgeStyle` - Visual styling
  - `stroke: string` - Line color (default: "#90A4AE")
  - `strokeWidth: number` - Line thickness (1-3px, emphasized when selected)
  - `opacity: number` - Line opacity (0.6 default, 1.0 when emphasized)
  - `animated: boolean` - Whether to show flowing animation (false default)
- `markerEnd: string` - Arrow marker reference (SVG marker ID)

**Path Calculation**:
- Uses cubic Bezier curves for smooth appearance
- Control points calculated to create natural flow
- React Flow handles path generation automatically

**Example**:
```typescript
{
  id: "parent123-child456",
  source: "parent123",
  target: "child456",
  path: "M 100,200 C 150,200 150,300 200,300",
  style: {
    stroke: "#90A4AE",
    strokeWidth: 2,
    opacity: 0.6,
    animated: false
  },
  markerEnd: "url(#arrow)"
}
```

---

### SelectionState

Tracks user's current selection and interaction state.

**Purpose**: Manage which nodes are selected, hovered, or being interacted with.

**Properties**:
- `selectedNodeIds: UUID[]` - Currently selected node IDs
- `hoveredNodeId: UUID | null` - Node currently under cursor
- `multiSelectRect: Rectangle | null` - Active multi-selection rectangle
  - `x: number` - Top-left X
  - `y: number` - Top-left Y
  - `width: number` - Rectangle width
  - `height: number` - Rectangle height
- `interactionMode: InteractionMode` - Current interaction type
  - `"select"` - Selecting nodes
  - `"pan"` - Panning canvas
  - `"zoom"` - Zooming (during pinch/wheel)

**Constraints**:
- Only one node can be hovered at a time
- Multiple nodes can be selected simultaneously
- `multiSelectRect` is null when not actively selecting

**Example**:
```typescript
{
  selectedNodeIds: ["node1", "node2"],
  hoveredNodeId: "node3",
  multiSelectRect: null,
  interactionMode: "select"
}
```

---

### UIPreferences

User preferences for canvas display and behavior.

**Purpose**: Store user-customizable UI settings.

**Properties**:
- `minimapVisible: boolean` - Show/hide minimap overlay (default: true)
- `gridVisible: boolean` - Show/hide grid reference markers (default: true)
- `gridSize: number` - Grid cell size in pixels (default: 50)
- `snapToGrid: boolean` - Enable grid snapping for node positions (default: false)
- `theme: "light" | "dark"` - Color theme (default: "light", dark mode future enhancement)
- `autoFitOnLoad: boolean` - Automatically fit all nodes in view on graph load (default: true)

**Persistence**: Saved to localStorage, applied on app initialization

**Example**:
```typescript
{
  minimapVisible: true,
  gridVisible: true,
  gridSize: 50,
  snapToGrid: false,
  theme: "light",
  autoFitOnLoad: true
}
```

---

## Data Flow

### From Backend to UI

1. **Graph Load**:
   ```
   Backend API → Graph JSON (nodes, groups, comments)
   ↓
   Frontend parses Node entities
   ↓
   Transform to VisualNode (add position, style, preview)
   ↓
   Generate ConnectionLines from parent-child relationships
   ↓
   Render on React Flow canvas
   ```

2. **Node Position Calculation**:
   - Backend provides `Node.meta.position: {x, y}` (calculated via Dagre)
   - Frontend uses these coordinates directly
   - If positions missing, frontend triggers auto-layout

### From UI to Backend

1. **Viewport Persistence**:
   ```
   User zooms/pans
   ↓
   CanvasViewport state updates
   ↓
   Debounced save to localStorage (local only, no API call)
   ```

2. **Selection State**:
   ```
   User clicks node
   ↓
   SelectionState updates (selectedNodeIds)
   ↓
   Detail panel fetches full node data from Zustand store
   ↓
   No API call (data already loaded)
   ```

---

## State Management Architecture

### React Flow State (Internal)

React Flow manages:
- `nodes: Node[]` - Array of VisualNode data
- `edges: Edge[]` - Array of ConnectionLine data
- `viewport: {x, y, zoom}` - Current viewport transform
- `selectedElements: string[]` - Selected node/edge IDs

**Access via hooks**:
```typescript
const { nodes, edges } = useReactFlow();
const viewport = useViewport();
```

### Zustand Store (App State)

Manages app-level state outside React Flow:

```typescript
interface CanvasStore {
  // Graph data
  graphData: Graph | null;

  // Detail panel
  detailPanelOpen: boolean;
  selectedNodeId: UUID | null;

  // UI preferences
  preferences: UIPreferences;

  // Actions
  setGraphData: (graph: Graph) => void;
  selectNode: (nodeId: UUID | null) => void;
  toggleDetailPanel: () => void;
  updatePreferences: (prefs: Partial<UIPreferences>) => void;
}
```

---

## Validation Rules

### VisualNode Validation

- `position.x` and `position.y` must be finite numbers
- `dimensions.width` must be exactly 280
- `dimensions.height` must be between 120 and 400
- `style.opacity` must be between 0.5 and 1.0
- `style.borderWidth` must be between 1 and 4
- `preview` must not exceed 100 characters

### CanvasViewport Validation

- `zoom` must be clamped to [0.25, 4.0]
- `width` and `height` must be positive integers
- `x` and `y` can be any finite number

### ConnectionLine Validation

- `source` and `target` must reference existing node IDs
- `source` cannot equal `target` (no self-loops in UI)
- `path` must be valid SVG path syntax
- `style.strokeWidth` must be between 1 and 3

---

## Performance Considerations

### Viewport Culling

Only render VisualNodes within viewport bounds:

```typescript
const visibleNodes = nodes.filter(node => {
  return isNodeInViewport(node.position, node.dimensions, viewport);
});
```

React Flow handles this automatically with virtualization.

### Memoization

Prevent unnecessary re-renders:

```typescript
const NodeComponent = React.memo(({ data }) => {
  return <div>{/* Node rendering */}</div>;
});
```

### Debouncing

Debounce viewport updates to reduce re-render frequency:

```typescript
const debouncedViewportUpdate = useMemo(
  () => debounce((viewport: CanvasViewport) => {
    saveViewportToLocalStorage(viewport);
  }, 100),
  []
);
```

---

## Type Definitions (TypeScript)

```typescript
// Core types
type UUID = string;

// Viewport
interface CanvasViewport {
  zoom: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Visual Node
interface Position {
  x: number;
  y: number;
}

interface Dimensions {
  width: number;
  height: number;
}

interface NodeStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
  shadow: string;
}

interface VisualNode {
  nodeId: UUID;
  position: Position;
  dimensions: Dimensions;
  style: NodeStyle;
  preview: string;
}

// Connection Line
interface EdgeStyle {
  stroke: string;
  strokeWidth: number;
  opacity: number;
  animated: boolean;
}

interface ConnectionLine {
  id: string;
  source: UUID;
  target: UUID;
  path: string;
  style: EdgeStyle;
  markerEnd: string;
}

// Selection
interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

type InteractionMode = "select" | "pan" | "zoom";

interface SelectionState {
  selectedNodeIds: UUID[];
  hoveredNodeId: UUID | null;
  multiSelectRect: Rectangle | null;
  interactionMode: InteractionMode;
}

// Preferences
interface UIPreferences {
  minimapVisible: boolean;
  gridVisible: boolean;
  gridSize: number;
  snapToGrid: boolean;
  theme: "light" | "dark";
  autoFitOnLoad: boolean;
}
```

---

## Relationship to Core Models

**Core Node Model (from MindFlow Engine)**:
```python
class Node(BaseModel):
    id: UUID
    type: NodeType
    author: NodeAuthor
    content: str
    parents: list[UUID]
    children: list[UUID]
    groups: list[UUID]
    meta: NodeMetadata
```

**UI Extension (VisualNode)**:
- Adds: `position`, `dimensions`, `style`, `preview`
- References: Core `Node.id` via `nodeId`
- Derives: Styling from `type`, `author`, `meta.importance`, `meta.status`

**Core Graph Model**:
```python
class Graph(BaseModel):
    id: UUID
    meta: GraphMetadata
    nodes: Dict[UUID, Node]
    groups: Dict[UUID, Group]
    comments: Dict[UUID, Comment]
```

**UI Transformation**:
```typescript
function transformGraphToCanvas(graph: Graph): {
  nodes: VisualNode[];
  edges: ConnectionLine[];
} {
  const nodes = Object.values(graph.nodes).map(node => ({
    nodeId: node.id,
    position: node.meta.position || { x: 0, y: 0 },
    dimensions: calculateNodeDimensions(node),
    style: deriveNodeStyle(node),
    preview: node.content.substring(0, 100) + (node.content.length > 100 ? '...' : '')
  }));

  const edges = Object.values(graph.nodes).flatMap(node =>
    node.children.map(childId => ({
      id: `${node.id}-${childId}`,
      source: node.id,
      target: childId,
      path: '', // React Flow calculates
      style: defaultEdgeStyle,
      markerEnd: 'url(#arrow)'
    }))
  );

  return { nodes, edges };
}
```

---

## Future Extensions

### P2/P3 Enhancements

**Node Editing (Future Feature)**:
- Add `isEditing: boolean` to SelectionState
- Add `editMode: "content" | "metadata"` to track edit type

**Animation State (Future)**:
- Add `AnimationState` model for tracking node transitions
- Support animated node additions/removals

**Dark Mode (Future)**:
- Extend `UIPreferences.theme` with "dark" option
- Define dark mode color mappings for node types

**Collaborative Cursors (Future)**:
- Add `CursorState` model for multi-user presence
- Track `userId`, `position`, `color`

---

**Status**: Design complete. Ready for contract generation.

**Next Step**: Generate `contracts/api.yaml` with OpenAPI schema.
