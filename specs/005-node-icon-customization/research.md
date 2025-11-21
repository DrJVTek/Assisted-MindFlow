# Research: Node Icon Customization

**Feature**: Node Icon Customization
**Branch**: `005-node-icon-customization`
**Date**: 2025-11-21

## Research Questions

### 1. Icon Library Integration (lucide-react)

**Question**: How to dynamically load and render lucide-react icons by name string at runtime?

**Research Findings**:
- lucide-react v0.554.0 is already installed in frontend
- Icons are React components, not data files
- Dynamic loading requires mapping icon names to components
- Best practice: Create icon registry mapping string names to components

**Decision**: Create icon registry module that maps icon names (strings) to React components
- Registry maps 'heart' → `<Heart />`, 'star' → `<Star />`, etc.
- Use TypeScript union type for allowed icon names
- Support search/filtering by icon name

**Rationale**:
- Allows storing icon name as string in metadata (serializable)
- Enables dynamic icon selection without bundling all icons
- Type-safe approach with TypeScript

**Alternatives Considered**:
- Dynamic imports: Rejected (requires bundler config, adds complexity)
- SVG string storage: Rejected (defeats purpose of icon library)
- Icon ID numbers: Rejected (not human-readable, breaks on library updates)

### 2. AI Icon Suggestion Implementation

**Question**: What approach for AI to suggest icons based on node content?

**Research Findings**:
- Existing LLM infrastructure in `src/mindflow/services/llm_manager.py`
- LLM already used for node generation, can reuse for suggestions
- Icon suggestion needs fast response (<2s), not full reasoning
- Small prompt with icon list and node context sufficient

**Decision**: Create lightweight icon suggestion endpoint
- Backend: `/api/icons/suggest` POST endpoint
- Input: node type + content (first 200 chars)
- LLM prompt: "Given node type '{type}' and content '{content}', suggest best icon from: {icon_names}. Reply with icon name only."
- Timeout: 3 seconds, fallback to default on failure
- Cache suggestions per content hash for performance

**Rationale**:
- Reuses existing LLM manager infrastructure
- Fast, simple prompts reduce cost and latency
- Caching prevents repeated calls for same content
- Graceful fallback maintains UX if AI fails

**Alternatives Considered**:
- Rule-based keyword matching: Rejected (less flexible, requires maintenance)
- Embeddings + similarity: Rejected (overkill, adds complexity)
- Client-side suggestion: Rejected (requires bundling LLM or API keys)

### 3. Icon Metadata Storage

**Question**: How to extend NodeMetadata without breaking existing graphs?

**Research Findings**:
- Current NodeMetadata in `frontend/src/types/graph.ts` and `src/mindflow/models/graph.py`
- Pydantic models support optional fields with defaults
- TypeScript interfaces support optional properties
- Existing graphs load fine with new optional fields

**Decision**: Add optional fields to NodeMetadata
```python
# Backend: src/mindflow/models/graph.py
class NodeMetadata(BaseModel):
    # ... existing fields ...
    custom_icon: Optional[str] = None  # lucide icon name
    icon_source: Literal['default', 'user', 'ai'] = 'default'
```

```typescript
// Frontend: frontend/src/types/graph.ts
export interface NodeMetadata {
  // ... existing fields ...
  custom_icon?: string | null;
  icon_source?: 'default' | 'user' | 'ai';
}
```

**Rationale**:
- Optional fields maintain backward compatibility
- Existing graphs without these fields use defaults
- No migration script needed
- Schema version already tracked in GraphMetadata

**Alternatives Considered**:
- Separate IconMetadata object: Rejected (adds unnecessary nesting)
- Store in node content as special marker: Rejected (pollutes content)
- Separate icons table: Rejected (over-engineered for simple feature)

### 4. Icon Picker UI Component

**Question**: What UI pattern for icon selection?

**Research Findings**:
- Project uses React 19 + TypeScript + Vite
- No component library (custom components throughout)
- Existing dialogs use inline styles (not CSS modules)
- Similar pattern to emoji pickers in other apps

**Decision**: Create IconPicker component
- Categorized grid layout (Communication, Objects, Symbols, etc.)
- Search input with real-time filtering
- Favorites section (stored in localStorage)
- Virtual scrolling for performance (500+ icons)
- Click-to-select interaction

**Design Pattern**:
```tsx
<IconPicker
  selectedIcon="heart"
  onSelect={(iconName) => setCustomIcon(iconName)}
  onClose={() => setPickerOpen(false)}
  showAISuggestion={aiSuggestedIcon}
  onAcceptAI={() => setCustomIcon(aiSuggestedIcon)}
/>
```

**Rationale**:
- Matches existing component style (inline styles, functional components)
- Familiar pattern (similar to emoji/icon pickers users know)
- Virtual scrolling ensures performance with large icon set
- localStorage for favorites avoids backend complexity

**Alternatives Considered**:
- Full-screen modal: Rejected (too heavy for simple selection)
- Autocomplete input: Rejected (requires knowing icon names)
- External library (react-icons-picker): Rejected (not built for lucide-react)

### 5. Icon Display & Fallback Strategy

**Question**: How to handle missing or invalid icon names?

**Research Findings**:
- Icon names may become invalid if lucide-react updates
- Imported graphs may reference icons not in current version
- Network issues or data corruption could cause problems

**Decision**: Implement fallback hierarchy
1. Try custom_icon if present and valid
2. Fallback to type-based default icon (existing behavior)
3. Log warning for invalid icons (help debugging)
4. Never crash rendering - always show something

**Implementation**:
```tsx
function getNodeIcon(node: Node): React.ReactElement {
  if (node.meta.custom_icon) {
    const CustomIcon = iconRegistry[node.meta.custom_icon];
    if (CustomIcon) return <CustomIcon {...iconProps} />;
    console.warn(`Invalid icon name: ${node.meta.custom_icon}`);
  }
  return getTypeIcon(node.type); // Existing default logic
}
```

**Rationale**:
- Graceful degradation maintains UX
- Warnings help identify data issues without breaking UI
- Backward compatible with nodes without custom icons
- Forward compatible with icon library changes

**Alternatives Considered**:
- Error boundary: Rejected (too heavy, still need fallback)
- Placeholder icon: Rejected (confusing to users)
- Validate icon names on save: Accepted as additional check, not replacement

### 6. Performance Considerations

**Question**: Will icon customization impact canvas rendering performance?

**Research Findings**:
- Canvas already renders 100+ nodes with React Flow
- Icon rendering is lightweight (SVG components)
- Main concern: Icon picker with 500+ icons
- Virtual scrolling standard for large lists

**Decision**: Performance optimizations
- Icon picker: Use react-window or similar for virtual scrolling
- Icon registry: Load once, reuse across all nodes
- Memoize icon components in Node.tsx
- Cache AI suggestions (localStorage or backend)

**Rationale**:
- Prevents performance regression on canvas
- Icon picker remains responsive even with full library
- Caching reduces API calls and improves UX

**Alternatives Considered**:
- Lazy-load icons: Rejected (causes flicker, complexity)
- Limit icon selection to subset: Rejected (reduces user choice)
- Server-side rendering: Rejected (N/A for SPA)

## Technology Stack Summary

**Frontend**:
- React 19.2.0 (functional components, hooks)
- TypeScript 5.9.3 (strict mode)
- lucide-react 0.554.0 (icon library)
- Vite 7.2.2 (bundler)
- Vitest 4.0.10 (testing)

**Backend**:
- Python 3.11+
- FastAPI 0.108.0+ (API framework)
- Pydantic 2.6.0+ (data validation)
- Existing LLMManager for AI suggestions

**Storage**:
- JSON files (existing graph storage)
- localStorage (icon favorites, client-side)

**Testing**:
- Frontend: Vitest + @testing-library/react
- Backend: pytest + pytest-asyncio

## Implementation Approach

**Phase 1: Foundation**
1. Create icon registry module (frontend)
2. Extend NodeMetadata schema (frontend + backend)
3. Update Node component to support custom icons

**Phase 2: Icon Picker UI**
1. Create IconPicker component with search
2. Integrate into node creation/edit dialogs
3. Add favorites functionality (localStorage)

**Phase 3: AI Suggestion**
1. Create `/api/icons/suggest` endpoint (backend)
2. Implement suggestion prompt logic
3. Add AI suggestion UI in IconPicker
4. Add caching for suggestions

**Phase 4: Testing & Polish**
1. Unit tests for icon registry and metadata
2. Component tests for IconPicker
3. Integration tests for AI suggestion endpoint
4. Visual polish and accessibility

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Icon library updates break icon names | Medium | Fallback to type-based icons, validation on save |
| AI suggestion slow/unavailable | Low | 3s timeout, graceful fallback to manual selection |
| Icon picker performance with 500+ icons | Medium | Virtual scrolling, lazy rendering |
| localStorage not available (privacy mode) | Low | Graceful fallback, no favorites but picker still works |
| Custom icons increase bundle size | Low | Icons already in use, no additional bundle cost |

## Open Questions

**None** - All research questions resolved.

## References

- lucide-react documentation: https://lucide.dev/guide/packages/lucide-react
- Existing Node.tsx implementation: `frontend/src/components/Node.tsx`
- Existing NodeMetadata: `frontend/src/types/graph.ts`, `src/mindflow/models/graph.py`
- React Flow performance best practices: Memoization, stable references
