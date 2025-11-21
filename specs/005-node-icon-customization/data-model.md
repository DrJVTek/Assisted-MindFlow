# Data Model: Node Icon Customization

**Feature**: Node Icon Customization
**Branch**: `005-node-icon-customization`
**Date**: 2025-11-21

## Entities

### 1. NodeMetadata (Extended)

**Purpose**: Store custom icon information for each node

**Location**:
- Frontend: `frontend/src/types/graph.ts`
- Backend: `src/mindflow/models/graph.py`

**Schema**:

```typescript
// Frontend TypeScript
export interface NodeMetadata {
  // ... existing fields (position, created_at, updated_at, importance, tags, status, stop) ...

  // NEW FIELDS
  custom_icon?: string | null;           // lucide icon name (e.g., "heart", "star")
  icon_source?: 'default' | 'user' | 'ai';  // How icon was assigned
}
```

```python
# Backend Python
class NodeMetadata(BaseModel):
    # ... existing fields ...

    # NEW FIELDS
    custom_icon: Optional[str] = None  # lucide icon name
    icon_source: Literal['default', 'user', 'ai'] = 'default'
```

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `custom_icon` | string \| null | No | null | Name of lucide-react icon (e.g., "heart", "star", "database"). Null means use type-based default. |
| `icon_source` | enum | No | 'default' | Source of icon assignment: 'default' (type-based), 'user' (manual selection), 'ai' (AI suggestion) |

**Validation Rules**:
- `custom_icon` must be valid lucide-react icon name or null
- `custom_icon` max length: 50 characters
- `custom_icon` pattern: `^[a-z][a-z0-9-]*$` (lowercase, alphanumeric, hyphens)
- `icon_source` must be one of: 'default', 'user', 'ai'

**State Transitions**:
```
default → user (user manually selects icon)
default → ai (AI suggests icon, user accepts)
user → ai (user requests AI suggestion on existing custom icon)
ai → user (user changes AI-suggested icon manually)
user/ai → default (user clears custom icon, reverts to type-based)
```

**Relationships**:
- Belongs to: Node (one-to-one)
- No new relationships created

---

### 2. IconRegistry (Frontend Only)

**Purpose**: Map icon names (strings) to React components for dynamic rendering

**Location**: `frontend/src/components/icons/registry.ts` (new file)

**Schema**:

```typescript
import * as LucideIcons from 'lucide-react';

export type IconName =
  | 'heart'
  | 'star'
  | 'database'
  | 'message-circle-question'
  // ... all lucide icon names (500+)

export interface IconDefinition {
  name: IconName;
  component: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  category: IconCategory;
  keywords: string[];  // For search
}

export type IconCategory =
  | 'communication'
  | 'objects'
  | 'symbols'
  | 'interface'
  | 'media'
  | 'nature'
  | 'people'
  | 'other';

export const iconRegistry: Record<IconName, IconDefinition> = {
  'heart': {
    name: 'heart',
    component: LucideIcons.Heart,
    category: 'symbols',
    keywords: ['love', 'like', 'favorite', 'heart'],
  },
  // ... all icons
};
```

**Operations**:
- `getIcon(name: IconName): IconDefinition | null` - Get icon by name
- `searchIcons(query: string): IconDefinition[]` - Search by keywords
- `getIconsByCategory(category: IconCategory): IconDefinition[]` - Filter by category
- `getAllIcons(): IconDefinition[]` - Get all available icons

**Validation**:
- Icon name must exist in registry
- Component must be valid React component
- Category must be valid IconCategory

---

### 3. IconPickerState (Frontend UI State)

**Purpose**: Manage icon picker component state

**Location**: `frontend/src/components/icons/IconPicker.tsx` (component state)

**Schema**:

```typescript
interface IconPickerState {
  selectedIcon: IconName | null;
  searchQuery: string;
  activeCategory: IconCategory | 'all' | 'favorites';
  favorites: IconName[];  // Stored in localStorage
  aiSuggestion: IconName | null;
  isLoadingSuggestion: boolean;
}
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `selectedIcon` | IconName \| null | Currently selected icon in picker |
| `searchQuery` | string | User's search input (filters icons) |
| `activeCategory` | string | Active category filter or 'all'/'favorites' |
| `favorites` | IconName[] | User's favorite icons (persisted in localStorage) |
| `aiSuggestion` | IconName \| null | AI-suggested icon (if available) |
| `isLoadingSuggestion` | boolean | True while fetching AI suggestion |

**Persistence**:
- `favorites` persisted to localStorage key: `mindflow:icon-favorites`
- Other fields are ephemeral (component state only)

**Operations**:
- `setSearchQuery(query: string)` - Update search filter
- `setActiveCategory(category: string)` - Change category filter
- `toggleFavorite(icon: IconName)` - Add/remove from favorites
- `selectIcon(icon: IconName)` - Select icon and close picker
- `loadAISuggestion(nodeContent: string)` - Fetch AI suggestion

---

### 4. IconSuggestionRequest (API Request)

**Purpose**: Request AI icon suggestion from backend

**Location**: Backend API endpoint `/api/icons/suggest`

**Request Schema**:

```python
class IconSuggestionRequest(BaseModel):
    node_type: NodeType  # question, answer, hypothesis, etc.
    content: str  # Node content (first 200 chars)
    current_icon: Optional[str] = None  # For refinement suggestions
```

**Response Schema**:

```python
class IconSuggestionResponse(BaseModel):
    suggested_icon: str  # Icon name from lucide-react
    confidence: float  # 0.0 to 1.0 (LLM confidence)
    reasoning: Optional[str] = None  # Why this icon (optional)
```

**Validation**:
- `node_type` must be valid NodeType enum
- `content` max length: 500 characters (truncated)
- `current_icon` must be valid icon name or null
- `suggested_icon` must be valid lucide icon name
- `confidence` must be between 0.0 and 1.0

---

### 5. IconFavorites (LocalStorage)

**Purpose**: Persist user's favorite icons across sessions

**Location**: Browser localStorage

**Schema**:

```typescript
interface IconFavoritesStorage {
  version: number;  // Schema version for migrations
  favorites: IconName[];
  updated_at: string;  // ISO 8601
}
```

**Storage Key**: `mindflow:icon-favorites`

**Operations**:
- `loadFavorites(): IconName[]` - Load from localStorage
- `saveFavorites(favorites: IconName[])` - Save to localStorage
- `addFavorite(icon: IconName)` - Add to favorites
- `removeFavorite(icon: IconName)` - Remove from favorites
- `clearFavorites()` - Clear all favorites

**Validation**:
- Version must match current schema (migration if different)
- Favorites must be array of valid icon names
- Max favorites: 50 icons (prevent unbounded growth)

---

## Entity Relationships

```
Node (1) ──> (1) NodeMetadata
                    │
                    └─ custom_icon (string) ─────┐
                                                  │
                                                  ▼
                                         IconRegistry (lookup)
                                                  │
                                                  └─ IconDefinition
                                                        │
                                                        └─ React Component

IconPicker (UI) ───> IconRegistry (lookup)
                └──> IconFavorites (localStorage)
                └──> IconSuggestionRequest (API)
                        │
                        ▼
                   Backend LLM Service
                        │
                        └──> IconSuggestionResponse
```

## Database Schema Changes

**No database changes required** - this feature uses existing JSON file storage for graphs.

**Graph JSON format** (no breaking changes):

```json
{
  "id": "graph-uuid",
  "nodes": {
    "node-uuid": {
      "id": "node-uuid",
      "type": "question",
      "content": "What is the capital of France?",
      "meta": {
        "custom_icon": "map-pin",
        "icon_source": "ai",
        "position": { "x": 100, "y": 200 },
        "created_at": "2025-11-21T10:00:00Z",
        "updated_at": "2025-11-21T10:05:00Z",
        "importance": 0.8,
        "tags": [],
        "status": "valid",
        "stop": false
      }
    }
  }
}
```

**Backward Compatibility**:
- Existing graphs without `custom_icon` field load successfully
- Missing fields default to null/'default' per Pydantic/TypeScript defaults
- No migration script needed

---

## Validation Rules Summary

### Icon Names
- Must match pattern: `^[a-z][a-z0-9-]*$`
- Must exist in lucide-react icon registry
- Max length: 50 characters
- Case: lowercase only (normalized on save)

### Icon Source
- Must be one of: 'default', 'user', 'ai'
- Defaults to 'default' if not specified

### Icon Favorites
- Max 50 favorites per user
- Favorites stored in localStorage
- Invalid icon names removed on load

### AI Suggestions
- Content truncated to 200 chars for prompt
- Suggestion timeout: 3 seconds
- Fallback to null on error (user selects manually)

---

## Performance Considerations

### Icon Registry
- **Size**: ~500 icons × 2KB metadata = ~1MB
- **Loading**: Load once at app start, reuse across all nodes
- **Memory**: Single instance shared across components

### Icon Picker
- **Rendering**: Virtual scrolling for 500+ icons (60fps)
- **Search**: Debounced input (300ms delay) + indexed keywords
- **Caching**: Search results cached per query

### AI Suggestions
- **Latency**: 3s timeout, non-blocking UI
- **Caching**: Cache suggestions by content hash (localStorage)
- **Batch**: No batching (suggestions on-demand)

---

## Data Migration

**None required** - new optional fields with defaults ensure backward compatibility.

**Future migrations** (if icon library changes):
1. Detect icon names no longer in registry
2. Log warnings for invalid icons
3. Fallback to type-based icons
4. Optionally suggest replacement icons

---

## Testing Scenarios

### Unit Tests
- NodeMetadata validation (valid/invalid icon names)
- Icon registry lookup (existing/missing icons)
- Icon search (keyword matching, category filtering)
- Favorites persistence (localStorage operations)

### Integration Tests
- Icon suggestion endpoint (valid request → valid response)
- Icon suggestion timeout (3s limit enforced)
- Icon suggestion caching (duplicate requests cached)

### Component Tests
- IconPicker renders all icons
- IconPicker search filters correctly
- IconPicker favorites persist across sessions
- Node component displays custom icon
- Node component fallback on invalid icon

### Contract Tests
- NodeMetadata schema matches frontend/backend
- IconSuggestionRequest/Response match API contract
