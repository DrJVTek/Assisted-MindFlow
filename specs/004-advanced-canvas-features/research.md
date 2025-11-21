# Research: Advanced Canvas Features

**Feature**: 004-advanced-canvas-features  
**Date**: 2025-11-18  
**Status**: Complete

## Purpose

This document captures technical research and decision rationale for implementing advanced canvas features including multi-canvas management, auto-layout, sub-graphs, copy/paste, and customization.

---

## 1. Multi-Canvas Management

### Research Question
How should we architect multi-canvas storage and state management?

### Options Evaluated

**Option A: Single Graph with Canvas Metadata**
- Store all canvases as separate Graph instances
- Backend manages collection of graphs per user
- Each canvas is independent Graph entity

**Option B: Canvas as Graph View**
- Canvas is a "viewport" on subset of single master graph
- Nodes can appear on multiple canvases
- More complex query logic

**Decision: Option A** - Each canvas is a separate Graph instance

**Rationale**:
- Aligns with existing Graph model architecture (already designed as independent entity)
- Simpler mental model: 1 canvas = 1 graph
- Cleaner data isolation (no cross-canvas node dependencies for v1)
- Easier to implement export/import per canvas
- Future enhancement can add "linked canvases" if needed

---

## 2. Auto-Layout Algorithm

### Research Question
Which graph layout library best fits hierarchical reasoning graphs?

### Options Evaluated

#### Option A: Dagre.js
- **Pros**: Proven, stable library, fast for graphs <200 nodes, built-in hierarchical layout
- **Cons**: No active maintenance since 2020, limited customization, poor cycle handling

#### Option B: ELK.js (Eclipse Layout Kernel)
- **Pros**: Modern, actively maintained, superior edge crossing handling, highly configurable, web worker support
- **Cons**: Larger bundle size (~200KB vs 50KB), more complex API

#### Option C: Custom Force-Directed Layout (D3-force)
- **Pros**: Beautiful organic layouts
- **Cons**: Not suitable for reasoning chains (hierarchy is important), non-deterministic

**Decision: ELK.js** with web worker for layout calculation

**Rationale**:
- Better future-proofing (active maintenance)
- Superior handling of reasoning graph complexity (cycles, feedback loops)
- Web worker support prevents UI blocking during layout
- Configuration flexibility matches "customizable spacing" requirement from spec
- Performance acceptable for target use case (100-200 nodes)

### Performance Targets
- <500ms for 100 nodes (spec requirement)
- <1000ms for 200 nodes (graceful degradation)
- Progress indicator for >200 nodes with cancel option

---

## 3. Copy/Paste & Clipboard API

### Research Question
How to implement copy/paste across canvases given browser security limitations?

### Browser Clipboard API Constraints
- **Async Clipboard API** (navigator.clipboard): Requires user gesture, HTTPS
- **ClipboardEvent**: Only works within same document
- **Cross-tab paste**: NOT possible (browser security)
- **Cross-canvas paste**: Possible (same application session)

### Implementation Strategy

**In-Memory Clipboard State** (primary)
- Store clipboard in Zustand state
- Contains: items (Node[]), mode ('copy' | 'cut'), sourceCanvasId, timestamp

**Browser Clipboard API** (secondary, best-effort)
- Attempt to write JSON to system clipboard on copy
- Fallback gracefully if permissions denied
- Allows paste into external tools (nice-to-have)

### Cut vs Copy Behavior
- **Copy**: Clipboard items remain in source location
- **Cut**: Nodes dimmed (opacity 0.4), actually removed on paste
- **Paste after Cut**: Moves nodes, does not duplicate

---

## 4. Sub-Graph Architecture

### Research Question
How should sub-graphs be represented: as templates or instances?

### Design Decision: **Template + Instance Model**

**SubGraphTemplate**: Reusable sub-graph definition
- References a Canvas that serves as template
- Defines input/output ports with data type hints
- Tracks version and usage count

**SubGraphInstance**: Embedded instance in a canvas
- References template
- Can be localized (creates independent copy)
- Stores port connections to parent graph

### Data Flow Architecture

**Template Editing**:
- Changes to template canvas propagate to all instances
- Frontend shows warning: "X instances will be updated"
- Versioning tracks major changes

**Localized Copies**:
- Right-click instance → "Localize Copy"
- Creates new Graph with copied nodes
- Edits isolated from template

**Nested Sub-Graphs**:
- Sub-graph canvas can contain other sub-graph instances
- Complexity score = total_nodes × max_nesting_level
- Warning at score > 1000, hard limit at 5000

---

## 5. Icon Customization

### Research Question
How to support custom icons while keeping bundle size reasonable?

### Approach: Tiered Icon System

**Tier 1: Lucide Icons (Built-in)**
- Already dependency in package.json
- Tree-shakeable (only import used icons)
- ~1000 icons available

**Tier 2: Emoji**
- Native Unicode emoji picker
- Zero bundle cost
- Universal cross-platform support

**Tier 3: Custom Upload**
- SVG preferred (scalable, small file size)
- PNG supported (max 512x512, auto-downscale)
- Max file size: 512KB
- Stored as base64 in user preferences
- Limit: 20 custom icons per user

### Storage Strategy
- Stored in user profile, not in graph data (icons are presentation layer)
- IconPreferences stored per-user in backend

---

## 6. Importance Ratio Migration

### Research Question
How to migrate existing integer importance (0-10) to decimal (0.0-1.0)?

### Migration Strategy

**Data Migration**: Convert integer to decimal by dividing by 10

**Backward Compatibility**:
- API accepts both int and float
- Pydantic coercion handles conversion
- Frontend displays as percentage for familiarity

**Visual Mapping**:
- Border width: 2 + (importance × 2) = 2-4px
- Opacity: 0.6 + (importance × 0.4) = 0.6-1.0
- Shadow: 0-8px blur based on importance

---

## 7. Performance Considerations

### Canvas Switching
- **Target**: <100ms switch time
- **Strategy**: Keep 3 most recent canvases in memory, lazy load others

### Auto-Layout
- **Target**: <500ms for 100 nodes
- **Strategy**: Web worker for layout computation, cancellable promise

### Sub-Graph Rendering
- **Strategy**: Lazy expansion, virtual scrolling for library, thumbnail caching

---

## Dependencies & Third-Party Libraries

| Library | Purpose | Version | Bundle Size | License |
|---------|---------|---------|-------------|---------|
| elkjs | Auto-layout algorithm | ^0.9.0 | ~200KB | EPL-2.0 |
| lucide-react | Icon library | ^0.554.0 (existing) | Tree-shaken | ISC |
| zustand | State management | ^5.0.8 (existing) | ~3KB | MIT |

All licenses compatible with project requirements.

---

## Conclusion

Technical research complete. All major architectural decisions documented with rationale. Ready to proceed to Phase 1 (Design & Contracts).
