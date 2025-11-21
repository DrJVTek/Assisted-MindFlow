# Data Model: Intelligent Canvas Reorganize

**Feature**: 001-intelligent-reorganize
**Date**: 2025-11-21
**Purpose**: Define data entities, schemas, and relationships for the layout reorganization feature

## Overview

The intelligent reorganize feature introduces two primary data entities:
1. **LayoutConfig** - User preferences for layout behavior (direction, spacing)
2. **ELKGraph** - Intermediate format for elkjs layout computation

No new database tables or API endpoints are required. LayoutConfig is stored in client-side state (Zustand store), and ELKGraph is a transient format used only during layout computation.

---

## Entity 1: LayoutConfig

### Purpose
Stores user preferences for layout behavior per canvas. This configuration controls how the elkjs algorithm organizes nodes.

### Schema

```typescript
interface LayoutConfig {
  direction: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';  // Layout flow direction
  spacing: {
    node: number;      // Minimum space between adjacent nodes (px)
    rank: number;      // Space between hierarchy levels (px)
  };
  algorithm: 'layered' | 'force';  // ELK algorithm type
}
```

### Field Descriptions

| Field | Type | Required | Default | Validation | Description |
|-------|------|----------|---------|------------|-------------|
| `direction` | enum | Yes | `'DOWN'` | One of: 'DOWN', 'UP', 'LEFT', 'RIGHT' | Flow direction for hierarchical layout. Maps to elkjs `elk.direction` option. |
| `spacing.node` | number | Yes | `80` | `>= 40 && <= 200` | Minimum pixels between node boundaries. Maps to elkjs `elk.spacing.nodeNode`. |
| `spacing.rank` | number | Yes | `100` | `>= 60 && <= 300` | Minimum pixels between hierarchy levels. Maps to elkjs `elk.layered.spacing.nodeNodeBetweenLayers`. |
| `algorithm` | enum | Yes | `'layered'` | One of: 'layered', 'force' | Layout algorithm. MVP uses 'layered' only. |

### Validation Rules

From **FR-013** (spec.md:82): Users must be able to choose layout direction via context menu.

**Validation constraints**:
1. Direction must be one of the four cardinal options
2. Spacing values must be positive and within bounds to prevent overlap or excessive whitespace
3. Algorithm must be supported by elkjs (currently only 'layered' is implemented)

### State Transitions

LayoutConfig is immutable per operation:
1. **Load**: Read from canvasStore on canvas mount
2. **Update**: User selects new direction via context menu → new config created
3. **Apply**: Config passed to layoutService.computeLayout()
4. **Persist**: Updated config saved to canvasStore after successful reorganization

### Storage Location

**Frontend**: Zustand canvasStore

```typescript
// Location: frontend/src/stores/canvasStore.ts

interface CanvasStore {
  layoutConfigs: Record<string, LayoutConfig>;  // canvasId -> config
  // ... existing fields (canvases, activeCanvasId, etc.)
}
```

**Backend**: No persistence required. Canvas JSON files only store node positions (existing field).

### Relationships

- **1-to-1 with Canvas**: Each canvas has one LayoutConfig
- **No database relations**: Stored in memory only (client-side)

---

## Entity 2: ELKGraph

### Purpose
Intermediate graph format for communication with elkjs layout engine. This entity is transient - created from ReactFlow nodes/edges, processed by elkjs, then converted back to ReactFlow format.

### Schema

```typescript
interface ELKNode {
  id: string;               // Node identifier (matches ReactFlow node.id)
  width: number;            // Node width in pixels
  height: number;           // Node height in pixels
  children?: ELKNode[];     // Nested nodes (for groups - see Decision 2)
  x?: number;               // Output: computed X position (from elkjs)
  y?: number;               // Output: computed Y position (from elkjs)
}

interface ELKEdge {
  id: string;               // Edge identifier (matches ReactFlow edge.id)
  sources: string[];        // Source node IDs (array for hyperedges)
  targets: string[];        // Target node IDs (array for hyperedges)
}

interface ELKGraph {
  id: string;               // Root graph identifier (always 'root')
  children: ELKNode[];      // Top-level nodes
  edges: ELKEdge[];         // All edges
  layoutOptions?: Record<string, string>;  // elkjs configuration options
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ELKGraph.id` | string | Yes | Root identifier. Always set to 'root'. |
| `ELKGraph.children` | ELKNode[] | Yes | Top-level nodes to layout. Excludes nodes inside groups (see Decision 2). |
| `ELKGraph.edges` | ELKEdge[] | Yes | All edges between nodes. |
| `ELKGraph.layoutOptions` | Record<string, string> | No | elkjs configuration (direction, spacing, algorithm). |
| `ELKNode.id` | string | Yes | Must match ReactFlow node.id for position mapping. |
| `ELKNode.width` | number | Yes | Node width. From ReactFlow node measured width or constant (280px). |
| `ELKNode.height` | number | Yes | Node height. From ReactFlow node measured height or constant (120px). |
| `ELKNode.children` | ELKNode[] | No | Nested nodes for groups. **NOT USED in MVP** per Decision 2 (groups processed separately). |
| `ELKNode.x` | number | No | Output only. Computed X position from elkjs. |
| `ELKNode.y` | number | No | Output only. Computed Y position from elkjs. |
| `ELKEdge.sources` | string[] | Yes | Source node IDs. Single-element array for standard edges. |
| `ELKEdge.targets` | string[] | Yes | Target node IDs. Single-element array for standard edges. |

### Validation Rules

From **FR-002** (spec.md:71): System must apply hierarchical layout that respects node connections.

**Validation constraints**:
1. All edge sources/targets must reference valid node IDs in `children`
2. Node dimensions must be positive (width > 0, height > 0)
3. Node IDs must be unique within the graph
4. Circular edges are allowed (elkjs handles cycles per research.md)

### Data Flow

```
ReactFlow Graph
    ↓ (elkjsAdapter.toELKGraph)
ELKGraph (input)
    ↓ (elk.layout)
ELKGraph (output with x/y)
    ↓ (elkjsAdapter.fromELKGraph)
ReactFlow Graph (updated positions)
```

### Conversion Logic

**ReactFlow → ELK** (elkjsAdapter.toELKGraph):
```typescript
function toELKGraph(
  nodes: Node[],
  edges: Edge[],
  layoutOptions: Record<string, string>
): ELKGraph {
  return {
    id: 'root',
    layoutOptions,
    children: nodes.map(n => ({
      id: n.id,
      width: n.measured?.width || 280,   // NODE_WIDTH from transform.ts
      height: n.measured?.height || 120,
    })),
    edges: edges.map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };
}
```

**ELK → ReactFlow** (elkjsAdapter.fromELKGraph):
```typescript
function fromELKGraph(
  elkGraph: ELKGraph,
  originalNodes: Node[]
): Node[] {
  return elkGraph.children!.map((elkNode) => {
    const original = originalNodes.find(n => n.id === elkNode.id)!;
    return {
      ...original,
      position: { x: elkNode.x!, y: elkNode.y! },
    };
  });
}
```

### Relationships

- **Temporary entity**: Exists only during layout computation
- **Not persisted**: Discarded after positions are extracted
- **1-to-1 mapping**: Each ReactFlow node/edge has corresponding ELK node/edge

---

## Entity 3: GroupLayoutResult

### Purpose
Represents the computed layout for a group and its member nodes. Used during group preservation logic (User Story 2, P2 priority).

### Schema

```typescript
interface GroupLayoutResult {
  groupId: string;              // Group node ID
  groupPosition: { x: number; y: number };  // Top-left position of group container
  groupDimensions: { width: number; height: number };  // Group container size
  memberNodes: Node[];          // Member nodes with updated positions (relative to group)
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `groupId` | string | Yes | ID of the GroupNode container. |
| `groupPosition` | {x, y} | Yes | Top-left position of group container on canvas. |
| `groupDimensions` | {width, height} | Yes | Size of group container (calculated from member bounds + padding). |
| `memberNodes` | Node[] | Yes | Nodes within the group with positions computed by elkjs. |

### Validation Rules

From **FR-004** (spec.md:73): System must preserve group membership when reorganizing.

**Validation constraints**:
1. All member nodes must have positions within group boundaries
2. Group dimensions must be large enough to contain all members plus padding (40px margin per research.md)
3. Group position must account for member positions (calculated as min(member.x) - 40, min(member.y) - 60)

### Computation Logic

**Per Decision 2** (research.md:52): Groups are processed separately from main layout.

```typescript
// Pseudo-code from research.md:72-84
for (const group of groups) {
  const members = nodes.filter(n => group.pinnedNodes.includes(n.id));

  // Layout members independently
  const layoutedMembers = await layoutGraph(members, []);

  // Calculate bounding box
  const bounds = {
    minX: Math.min(...layoutedMembers.map(n => n.position.x)),
    minY: Math.min(...layoutedMembers.map(n => n.position.y)),
    maxX: Math.max(...layoutedMembers.map(n => n.position.x + 280)),
    maxY: Math.max(...layoutedMembers.map(n => n.position.y + 120)),
  };

  // Position group container
  return {
    groupId: group.id,
    groupPosition: { x: bounds.minX - 40, y: bounds.minY - 60 },
    groupDimensions: {
      width: bounds.maxX - bounds.minX + 80,
      height: bounds.maxY - bounds.minY + 120,
    },
    memberNodes: layoutedMembers,
  };
}
```

### Relationships

- **1-to-N with Nodes**: One group contains multiple member nodes
- **Temporary entity**: Exists only during layout computation
- **Not persisted**: Results merged back into main node array

---

## Data Persistence

### What Gets Persisted

**Node Positions** (existing field):
```json
{
  "nodes": [
    {
      "id": "node-1",
      "position": { "x": 120, "y": 80 },  // ← Updated by reorganization
      "data": { ... }
    }
  ]
}
```

Positions are saved via existing graph update API:
```
PUT /api/graphs/{graph_id}
```

**Layout Configuration** (new field in canvasStore):
```typescript
// Stored in memory only (Zustand state)
layoutConfigs: {
  "canvas-123": {
    direction: "DOWN",
    spacing: { node: 80, rank: 100 },
    algorithm: "layered"
  }
}
```

### What Does NOT Get Persisted

- **ELKGraph**: Temporary format, discarded after layout
- **GroupLayoutResult**: Temporary computation, merged into node positions
- **Undo snapshots**: Handled by existing undo/redo system (not persisted to backend)

---

## Type Definitions Location

All types will be defined in:
```
frontend/src/types/layout.ts  # NEW file
```

Import pattern:
```typescript
import type { LayoutConfig, ELKGraph, ELKNode, ELKEdge, GroupLayoutResult } from '@/types/layout';
```

---

## References

- **Decision 2** (research.md:52): Group preservation strategy
- **Decision 5** (research.md:158): ReactFlow state management pattern
- **FR-004** (spec.md:73): Group membership preservation requirement
- **FR-013** (spec.md:82): Layout direction control requirement
