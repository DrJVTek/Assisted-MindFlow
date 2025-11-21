# Quickstart: Node Icon Customization

**Feature**: Node Icon Customization
**Branch**: `005-node-icon-customization`
**Estimated Time**: 30 minutes to understand + implement basic usage

## Overview

This feature allows users to customize node icons beyond the default type-based icons. Users can:
- **Manually select** icons from lucide-react library (500+ icons)
- **Get AI suggestions** for contextually relevant icons
- **Search and favorite** icons for quick access
- **Display custom icons** consistently across all UI components

## Quick Demo (What Users Will See)

### Before (Current Behavior)
```
Node Type: question → Icon: MessageCircleQuestion (hardcoded)
Node Type: answer   → Icon: MessageCircleReply (hardcoded)
```

### After (With Icon Customization)
```
User creates "What are the performance metrics?" question
→ Icon picker opens with AI suggestion: "gauge" (✨ AI suggested)
→ User can accept AI suggestion or choose "chart-bar", "activity", etc.
→ Node displays with custom icon across canvas, lists, history
```

## Key Components

### 1. Icon Registry (Frontend)

Maps icon names (strings) to React components for dynamic rendering.

**Location**: `frontend/src/components/icons/registry.ts`

**Usage**:
```typescript
import { getIcon, searchIcons } from './components/icons/registry';

// Get icon by name
const heartIcon = getIcon('heart');  // Returns IconDefinition

// Search icons
const chartIcons = searchIcons('chart');  // Returns array of matching icons
```

### 2. Icon Picker Component (Frontend)

UI component for selecting icons with search, categories, and favorites.

**Location**: `frontend/src/components/icons/IconPicker.tsx`

**Usage**:
```tsx
import { IconPicker } from './components/icons/IconPicker';

function NodeEditDialog() {
  const [customIcon, setCustomIcon] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <button onClick={() => setPickerOpen(true)}>
        Choose Icon
      </button>

      {pickerOpen && (
        <IconPicker
          selectedIcon={customIcon}
          onSelect={(iconName) => {
            setCustomIcon(iconName);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
          aiSuggestion="gauge"  // Optional AI suggestion
        />
      )}
    </>
  );
}
```

### 3. Node Component (Frontend)

Renders nodes with custom icons or falls back to type-based defaults.

**Location**: `frontend/src/components/Node.tsx` (modified)

**Changes**:
```typescript
// OLD: Hardcoded type-based icons
function getTypeIcon(type: NodeType) {
  switch (type) {
    case 'question': return <MessageCircleQuestion />;
    // ...
  }
}

// NEW: Custom icon with fallback
function getNodeIcon(node: Node) {
  if (node.meta.custom_icon) {
    const CustomIcon = getIcon(node.meta.custom_icon);
    if (CustomIcon) return <CustomIcon.component />;
  }
  return getTypeIcon(node.type);  // Fallback to default
}
```

### 4. Icon Suggestion API (Backend)

AI endpoint for suggesting contextually relevant icons.

**Location**: `src/mindflow/api/routes/icons.py` (new)

**Endpoint**: `POST /api/icons/suggest`

**Request**:
```json
{
  "node_type": "question",
  "content": "What are the key performance metrics?",
  "current_icon": null
}
```

**Response**:
```json
{
  "suggested_icon": "gauge",
  "confidence": 0.85,
  "reasoning": "Performance metrics commonly represented by gauge/meter icons"
}
```

**Implementation**:
```python
from fastapi import APIRouter
from src.mindflow.services.icon_service import IconService

router = APIRouter()

@router.post("/api/icons/suggest")
async def suggest_icon(request: IconSuggestionRequest):
    service = IconService()
    return await service.suggest_icon(
        node_type=request.node_type,
        content=request.content[:200]  # Truncate for LLM prompt
    )
```

## Implementation Phases

### Phase 1: Foundation (2-3 hours)
**Goal**: Basic custom icon support without AI

1. **Update data models**:
   - Add `custom_icon` and `icon_source` to NodeMetadata
   - Update frontend TypeScript types
   - Update backend Pydantic models

2. **Create icon registry**:
   - Map all lucide-react icons to registry
   - Add categories and keywords
   - Implement lookup/search functions

3. **Modify Node component**:
   - Check for custom_icon in metadata
   - Fallback to type-based icon if missing
   - Add error handling for invalid icons

**Test**: Create node with custom icon manually (bypass UI), verify it displays

### Phase 2: Icon Picker UI (3-4 hours)
**Goal**: User can select icons via UI

1. **Create IconPicker component**:
   - Grid layout with categories
   - Search input with filtering
   - Click-to-select interaction
   - Close on outside click

2. **Integrate into node dialogs**:
   - Add icon selector to node creation dialog
   - Add icon selector to node edit dialog
   - Show current icon preview

3. **Add favorites functionality**:
   - localStorage persistence
   - Star/unstar icons
   - Favorites section in picker

**Test**: Create/edit node, select custom icon, verify it saves and displays

### Phase 3: AI Suggestion (2-3 hours)
**Goal**: AI suggests relevant icons

1. **Create backend endpoint**:
   - `/api/icons/suggest` route
   - LLM prompt for icon suggestion
   - 3-second timeout handling

2. **Create IconService**:
   - Build icon suggestion prompt
   - Call LLM via LLMManager
   - Parse response and validate icon name

3. **Integrate AI into IconPicker**:
   - Fetch suggestion on picker open
   - Display "✨ AI suggested" badge
   - Accept/reject suggestion

**Test**: Create node, verify AI suggests appropriate icon, accept suggestion

### Phase 4: Testing & Polish (2 hours)
**Goal**: Production-ready

1. **Write tests**:
   - Unit tests for icon registry
   - Component tests for IconPicker
   - Integration tests for suggestion API

2. **Performance optimization**:
   - Virtual scrolling in icon picker
   - Memoize icon components
   - Cache AI suggestions

3. **Accessibility**:
   - Keyboard navigation in picker
   - Screen reader support
   - ARIA labels

**Test**: Run full test suite, verify 80%+ coverage

## Testing the Feature

### Manual Testing Checklist

1. **Custom icon selection**:
   - [ ] Create node → Icon picker opens
   - [ ] Search for "heart" → Heart icon appears
   - [ ] Select heart → Node shows heart icon
   - [ ] Edit node → Current icon displayed
   - [ ] Change icon → New icon saves

2. **AI suggestions**:
   - [ ] Create "What is the database schema?" question
   - [ ] AI suggests "database" icon
   - [ ] Accept suggestion → Icon applied
   - [ ] Create "How fast is the API?" question
   - [ ] AI suggests "gauge" or "zap" icon

3. **Favorites**:
   - [ ] Star 3 icons in picker
   - [ ] Close and reopen picker
   - [ ] Favorites section shows starred icons
   - [ ] Unstar icon → Removed from favorites

4. **Fallback behavior**:
   - [ ] Node without custom icon → Type-based icon displays
   - [ ] Invalid icon name → Fallback to type-based
   - [ ] AI suggestion fails → Manual selection still works

### Automated Testing

```bash
# Frontend tests
cd frontend
npm test -- icons

# Backend tests
pytest tests/unit/test_icon_service.py
pytest tests/integration/test_icons_api.py
```

## Common Issues & Solutions

### Issue: Icons not displaying
**Cause**: Icon name mismatch or registry not loaded
**Solution**: Check console for warnings, verify icon name exists in lucide-react

### Issue: AI suggestion slow/timeout
**Cause**: LLM service slow or unavailable
**Solution**: 3s timeout is intentional, user can select manually

### Issue: Favorites not persisting
**Cause**: localStorage disabled (privacy mode)
**Solution**: Graceful degradation - picker still works, just no favorites

### Issue: Search not finding icons
**Cause**: Keywords incomplete or search logic broken
**Solution**: Verify searchIcons() implementation, add more keywords to registry

## Performance Benchmarks

| Operation | Target | Actual |
|-----------|--------|--------|
| Icon picker open | < 500ms | TBD |
| Search filter | < 200ms | TBD |
| AI suggestion | < 3s | TBD |
| Node render with custom icon | < 100ms | TBD |
| Icon registry load | < 1s | TBD |

## API Reference

### Icon Suggestion Endpoint

**POST** `/api/icons/suggest`

**Request**:
```typescript
interface IconSuggestionRequest {
  node_type: NodeType;
  content: string;        // Max 500 chars
  current_icon?: string;  // Optional
}
```

**Response**:
```typescript
interface IconSuggestionResponse {
  suggested_icon: string;
  confidence: number;     // 0.0 to 1.0
  reasoning?: string;     // Optional explanation
}
```

**Status Codes**:
- 200: Success
- 400: Invalid request (bad node_type, etc.)
- 408: Timeout (LLM took >3s)
- 500: Internal error (LLM unavailable)

## Next Steps

After completing this feature:

1. **Extend to groups/comments**: Allow custom icons for GroupNode and CommentNode
2. **Icon templates**: Save commonly used icon sets as templates
3. **Team sharing**: Share custom icon configurations across team
4. **Icon analytics**: Track which icons are most popular
5. **Custom icon upload**: Allow SVG upload (future enhancement)

## Resources

- [lucide-react documentation](https://lucide.dev/guide/packages/lucide-react)
- [Icon registry implementation](../../frontend/src/components/icons/registry.ts)
- [Icon picker component](../../frontend/src/components/icons/IconPicker.tsx)
- [API contracts](./contracts/api-icons.yaml)
- [Data model](./data-model.md)
