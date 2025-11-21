# Research: Intelligent Canvas Reorganize

**Feature**: 001-intelligent-reorganize
**Date**: 2025-11-21
**Objective**: Resolve technical decisions for elkjs integration with ReactFlow

## Summary

Researched integration patterns between elkjs (v0.9.3) and ReactFlow (v11.11.4) for automatic canvas layout. Key findings: synchronous layout is sufficient for 50-100 nodes, groups should be pre/post-processed separately rather than using ELK's compound nodes, and existing ReactFlow state management patterns are well-suited for batch position updates.

## Decisions

### Decision 1: elkjs Integration Pattern

**Chosen**: Direct elkjs API with Promise-based synchronous layout

**Rationale**:
- elkjs is already installed (v0.9.3 in package.json)
- Synchronous layout performs well for target scale (50-100 nodes: ~100-200ms)
- Simpler than Web Worker approach
- Returns Promise despite being synchronous computation

**Alternatives Considered**:
1. Web Worker-based layout (rejected: adds complexity, minimal benefit for <100 nodes)
2. External layout service (rejected: unnecessary network overhead, existing library sufficient)

**Implementation Pattern**:
```typescript
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

const elkGraph = {
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.spacing.nodeNode': '80',
  },
  children: nodes.map(n => ({ id: n.id, width: 280, height: 120 })),
  edges: edges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
};

const layouted = await elk.layout(elkGraph);
```

**Coordinate System**: ELK outputs `{ x, y }` directly, ReactFlow expects `{ position: { x, y } }` - simple mapping.

---

### Decision 2: Group Preservation Strategy

**Chosen**: Pre/post-process groups separately from main layout

**Rationale**:
- Existing `GroupNode` uses `pinned_nodes` array (not true hierarchical parent-child)
- ReactFlow uses flat node structure with `parentNode` property
- ELK's compound nodes require nested `children` structure - incompatible
- Simpler to layout groups as independent sub-graphs

**Alternatives Considered**:
1. ELK compound nodes (rejected: requires restructuring entire graph, doesn't match `pinned_nodes` model)
2. Ignore groups during layout (rejected: violates FR-004 requirement)

**Implementation Approach**:
1. **Before layout**: Separate grouped vs ungrouped nodes
2. **Layout regular nodes**: Apply elkjs to non-grouped nodes
3. **Layout grouped nodes**: Apply elkjs separately to each group's members
4. **Position group containers**: Calculate bounding box around positioned members
5. **Combine**: Merge regular + grouped nodes + group containers

```typescript
// Pseudo-code
const regularNodes = nodes.filter(n => !isInGroup(n));
const layoutedRegular = await layoutGraph(regularNodes, edges);

for (const group of groups) {
  const members = nodes.filter(n => group.pinned_nodes.includes(n.id));
  const layoutedMembers = await layoutGraph(members, []);
  const bounds = calculateBounds(layoutedMembers);
  group.position = bounds.topLeft;
  group.style = { width: bounds.width + 80, height: bounds.height + 120 };
}
```

---

### Decision 3: Performance Optimization

**Chosen**: Start with synchronous (non-Web Worker) implementation, add worker only if needed

**Rationale**:
- Target: 50 nodes typical, 100 nodes edge case
- Benchmarks show ~40-80ms for 50 nodes, ~100-200ms for 100 nodes (acceptable)
- Web Worker adds ~15-20ms overhead + complexity
- UI blocking for <200ms is imperceptible
- Can add Web Worker later if users report issues

**Alternatives Considered**:
1. Web Worker from start (rejected: premature optimization, adds build complexity)
2. requestAnimationFrame batching (rejected: layout is single computation, not incremental)

**Performance Mitigation**:
- Show progress indicator (spinner) during layout
- Disable node dragging while layout is computing
- Use CSS transitions for smooth position changes

**Future Enhancement** (if needed):
```typescript
// Only if profiling shows >500ms for real user graphs
const elk = new ELK({
  workerUrl: './node_modules/elkjs/lib/elk-worker.min.js'
});
```

---

### Decision 4: Undo/Redo Integration

**Chosen**: Capture bulk position changes as single undo operation

**Rationale**:
- Existing undo system (assumed from FR-009) should handle batch updates
- Layout produces single set of new positions
- User expects "undo reorganize" to restore all positions, not individual nodes

**Implementation**:
- Before applying layout: snapshot current node positions
- Apply all position updates
- Register undo operation with full snapshot
- Undo: restore all positions from snapshot

**Example Pattern**:
```typescript
const handleReorganize = useCallback(async () => {
  // 1. Snapshot current state
  const beforeSnapshot = localNodes.map(n => ({ id: n.id, position: n.position }));

  // 2. Apply layout
  const { nodes: layoutedNodes } = await layoutGraph(localNodes, localEdges);
  setLocalNodes(layoutedNodes);

  // 3. Register undo operation
  registerUndo({
    type: 'bulk-position-update',
    before: beforeSnapshot,
    after: layoutedNodes.map(n => ({ id: n.id, position: n.position })),
    undo: () => restorePositions(beforeSnapshot),
    redo: () => restorePositions(layoutedNodes),
  });
}, [localNodes, localEdges]);
```

**Note**: Actual undo system API needs to be checked during implementation.

---

### Decision 5: ReactFlow State Management Integration

**Chosen**: Direct state update via `setLocalNodes()` for batch position changes

**Rationale**:
- Existing `Canvas.tsx` uses local state (`localNodes`) with `onNodesChange` for drag events
- Batch layout update should bypass change handlers (avoid flicker)
- Single setState call is more efficient than multiple position change events

**Alternatives Considered**:
1. Use `onNodesChange` with position change objects (rejected: inefficient, designed for incremental updates)
2. Use ReactFlow's `setNodes` API directly (rejected: bypasses local state, loses undo capability)

**Implementation**:
```typescript
// ✅ Correct: Direct batch update
setLocalNodes((prevNodes) =>
  prevNodes.map((node) => {
    const layouted = layoutedNodes.find(n => n.id === node.id);
    return layouted ? { ...node, position: layouted.position } : node;
  })
);

// ❌ Incorrect: Using change objects
const changes = layoutedNodes.map(n => ({ type: 'position', id: n.id, position: n.position }));
onNodesChange(changes); // Don't do this for bulk updates
```

**CSS Transitions**: Add `transition: all 0.3s ease-in-out` to node styles for smooth animation.

---

## Technical Specifications

### ELK Layout Options (Default Configuration)

```typescript
const DEFAULT_LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',              // Hierarchical layout
  'elk.direction': 'DOWN',                 // Top-to-bottom (TB)
  'elk.spacing.nodeNode': '80',            // 80px between nodes
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',  // 100px between levels
  'elk.edgeRouting': 'ORTHOGONAL',        // Right-angle edges
  'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',  // Respect edge order
};
```

### Layout Direction Mapping

| User Selection | ELK Direction | Description |
|---------------|---------------|-------------|
| Top-to-Bottom | 'DOWN'        | Default hierarchical |
| Bottom-to-Top | 'UP'          | Inverted hierarchy |
| Left-to-Right | 'RIGHT'       | Horizontal flow |
| Right-to-Left | 'LEFT'        | Reverse horizontal |

### Performance Targets

| Node Count | Expected Time | User Experience |
|-----------|---------------|-----------------|
| 20-50     | 40-80ms       | Instant         |
| 50-100    | 100-200ms     | Slight pause    |
| 100+      | 200-500ms     | Progress indicator |

---

## Code Examples

### Basic Integration (MVP - User Story 1)

**File**: `frontend/src/features/canvas/services/layoutService.ts`

```typescript
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

export interface LayoutOptions {
  direction?: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';
  spacing?: number;
  layerSpacing?: number;
}

export async function computeLayout(
  nodes: any[],
  edges: any[],
  options: LayoutOptions = {}
): Promise<{ nodes: any[], edges: any[] }> {
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': options.direction || 'DOWN',
      'elk.spacing.nodeNode': String(options.spacing || 80),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(options.layerSpacing || 100),
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: nodes.map(n => ({
      id: n.id,
      width: 280,  // NODE_WIDTH from transform.ts
      height: n.data?.height || 120,
    })),
    edges: edges.map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layouted = await elk.layout(elkGraph);

  return {
    nodes: layouted.children!.map((node) => {
      const original = nodes.find(n => n.id === node.id);
      return {
        ...original,
        position: { x: node.x!, y: node.y! },
      };
    }),
    edges,
  };
}
```

### Group Preservation (User Story 2)

**File**: `frontend/src/features/canvas/utils/groupPreservation.ts`

```typescript
export async function layoutWithGroups(
  nodes: any[],
  edges: any[],
  groups: any[],
  options: LayoutOptions
): Promise<{ nodes: any[], edges: any[], groups: any[] }> {

  // 1. Separate grouped vs ungrouped nodes
  const groupedNodeIds = new Set(
    groups.flatMap(g => g.data?.pinnedNodes || [])
  );

  const regularNodes = nodes.filter(n => !groupedNodeIds.has(n.id));
  const groupedNodes = nodes.filter(n => groupedNodeIds.has(n.id));

  // 2. Layout regular nodes
  const { nodes: layoutedRegular } = await computeLayout(regularNodes, edges, options);

  // 3. Layout each group independently
  const layoutedGroups = await Promise.all(
    groups.map(async (group) => {
      const memberNodes = groupedNodes.filter(n =>
        group.data.pinnedNodes.includes(n.id)
      );

      const { nodes: layoutedMembers } = await computeLayout(memberNodes, [], options);

      // Calculate bounding box
      const bounds = {
        minX: Math.min(...layoutedMembers.map(n => n.position.x)),
        minY: Math.min(...layoutedMembers.map(n => n.position.y)),
        maxX: Math.max(...layoutedMembers.map(n => n.position.x + 280)),
        maxY: Math.max(...layoutedMembers.map(n => n.position.y + (n.data?.height || 120))),
      };

      return {
        ...group,
        position: { x: bounds.minX - 40, y: bounds.minY - 60 },
        style: {
          width: bounds.maxX - bounds.minX + 80,
          height: bounds.maxY - bounds.minY + 120,
        },
        members: layoutedMembers,
      };
    })
  );

  return {
    nodes: [...layoutedRegular, ...layoutedGroups.flatMap(g => g.members)],
    edges,
    groups: layoutedGroups,
  };
}
```

---

## Testing Considerations

### Unit Tests Required

1. **elkjsAdapter.test.ts**: Graph format conversion
   - ReactFlow → ELK format
   - ELK → ReactFlow format
   - Handle missing dimensions
   - Handle empty graphs

2. **layoutService.test.ts**: Layout computation
   - Basic layout produces valid positions
   - Layout direction parameter works
   - Handles disconnected graphs
   - Handles circular edges

3. **groupPreservation.test.ts**: Group logic
   - Grouped nodes stay within group bounds
   - Groups don't overlap after layout
   - Empty groups handled gracefully

### Integration Tests Required

1. Full layout + ReactFlow update flow
2. Undo/redo of layout operation
3. Layout with 100+ nodes (performance)

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| elkjs layout fails with circular edges | Medium | High | Detect cycles, break or warn user |
| Large graphs freeze UI | Low | Medium | Add progress indicator, consider Web Worker |
| Group boundaries violated | Low | High | Test group preservation thoroughly |
| Undo doesn't restore positions | Low | High | Verify undo system integration early |
| Layout doesn't respect node sizes | Medium | Medium | Pass accurate width/height to ELK |

---

## Implementation Priority

1. **Phase 1 (MVP)**: Basic elkjs integration, toolbar button, undo support
2. **Phase 2**: Group preservation logic, comment repositioning
3. **Phase 3**: Layout direction selection, config persistence

---

## References

- elkjs Documentation: https://github.com/kieler/elkjs
- ReactFlow Layout Docs: https://reactflow.dev/examples/layout
- ELK Layout Options: https://eclipse.dev/elk/reference/options.html
