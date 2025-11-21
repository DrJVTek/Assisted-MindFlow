# Implementation Plan: Node Icon Customization

**Branch**: `005-node-icon-customization` | **Date**: 2025-11-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-node-icon-customization/spec.md`

## Summary

This feature enables users to customize node icons beyond the default type-based assignments. Users can manually select icons from the lucide-react library (500+ icons) or accept AI-suggested icons based on node content. Custom icons persist in node metadata and display consistently across all UI components (canvas, lists, history). The feature includes icon search, favorites (localStorage), and graceful fallback to type-based icons for backward compatibility.

**Technical Approach**:
- Frontend: Icon registry mapping string names to React components
- UI: IconPicker component with search, categories, virtual scrolling
- Backend: `/api/icons/suggest` endpoint using existing LLM infrastructure
- Storage: Extend NodeMetadata with optional `custom_icon` field (backward compatible)
- Performance: Virtual scrolling for 500+ icons, caching for AI suggestions

## Technical Context

**Language/Version**:
- Frontend: TypeScript 5.9.3, React 19.2.0
- Backend: Python 3.11+

**Primary Dependencies**:
- Frontend: lucide-react 0.554.0 (already installed), reactflow 11.11.4, zustand 5.0.8, vite 7.2.2
- Backend: FastAPI 0.108.0+, Pydantic 2.6.0+, existing LLMManager

**Storage**:
- JSON files (existing graph storage in `data/graphs/`)
- localStorage (icon favorites, client-side only)

**Testing**:
- Frontend: Vitest 4.0.10 + @testing-library/react 16.3.0
- Backend: pytest 8.0.0+ + pytest-asyncio 0.23.0+

**Target Platform**:
- Web application (multiplatform: Windows/Linux for backend, all modern browsers for frontend)

**Project Type**: Web (frontend + backend)

**Performance Goals**:
- Icon picker: 60fps scrolling with 500+ icons
- Icon suggestion: < 3 second response time
- Node rendering: No performance degradation with custom icons
- Search: < 200ms filter latency for 95% of queries

**Constraints**:
- No custom SVG upload (lucide-react library only)
- AI suggestion timeout: 3 seconds hard limit
- localStorage-based favorites (no backend persistence)
- Backward compatibility: Existing graphs must load without errors

**Scale/Scope**:
- ~500 icons in lucide-react library
- Icon picker component with search/categories
- 3 API endpoints (suggest, registry, validate)
- 2 frontend services (IconRegistry, IconFavorites)
- 1 backend service (IconService)
- Extends 2 existing models (NodeMetadata frontend+backend)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Graph Integrity ✅ PASS

- **Atomic & Reversible**: Icon changes are metadata updates, atomic with node saves
- **Referential Integrity**: No new relationships created, existing parent/child relationships unchanged
- **Circular Dependencies**: N/A (icons don't create graph edges)
- **Data Corruption**: Icon fallback prevents rendering errors on invalid icon names
- **Audit Trail**: `icon_source` field tracks whether icon is user/AI/default

**Compliance**: Icon customization is pure metadata, doesn't affect graph structure.

### II. LLM Provider Agnostic ✅ PASS

- **Unified Interface**: AI suggestion uses existing LLMManager (provider-independent)
- **Swappable Providers**: Icon suggestion works with any LLM provider (Claude, OpenAI, local)
- **No Provider Dependencies**: Core icon functionality (manual selection) works without LLM
- **Capabilities API**: Icon suggestion is optional feature, graceful fallback if unavailable

**Compliance**: AI suggestion reuses existing LLMManager infrastructure.

### III. Explicit Operations, No Magic ✅ PASS

- **Explicit Actions**: User explicitly selects icon or accepts AI suggestion (clear UI)
- **Traceable**: `icon_source` metadata tracks how icon was assigned (user/AI/default)
- **User Control**: AI suggestions are opt-in via "Accept" button, user can always override
- **Logging**: Icon changes logged with node updates, invalid icons logged as warnings
- **Author Tracking**: Icon changes don't modify `author` field (human/llm/tool)

**Compliance**: AI suggestions are presented as options, never auto-applied.

### IV. Test-First for Graph Operations ✅ PASS

- **TDD Required**: Yes - icon registry, metadata validation, suggestion endpoint all testable
- **Unit Tests**: Icon registry lookup, search, validation, favorites persistence
- **Integration Tests**: Icon suggestion API endpoint, timeout handling
- **Component Tests**: IconPicker rendering, search filtering, Node component with custom icons
- **Edge Cases**: Invalid icons, missing icons, LLM timeout, localStorage unavailable

**Compliance**: Feature includes comprehensive test plan in quickstart.md.

### V. Context Transparency ⚠️ PARTIAL (N/A for this feature)

- **Context Visibility**: Icon suggestion uses minimal context (node type + 200 chars content)
- **Token Count**: Icon suggestion uses ~100 tokens (simple prompt), no need for UI display
- **Strategy Selection**: N/A (icon suggestion is single-purpose, no strategy options)
- **Manual Override**: User can always reject AI suggestion and select manually

**Compliance**: Feature uses LLM minimally (suggestions only), no complex context building.

### VI. Multiplatform Support ✅ PASS

- **Platform-Agnostic**: Frontend (browser) and backend (Python) both cross-platform
- **Path Handling**: No new file operations (icons are React components, not files)
- **Testing**: Existing CI/CD tests on Windows + Linux
- **Case Sensitivity**: Icon names normalized to lowercase, consistent across platforms

**Compliance**: No platform-specific code introduced.

### VII. No Simulation or Hardcoded Data ✅ PASS

- **Real Implementation**: Icon registry uses actual lucide-react components, no mocks
- **No Hardcoding**: Icon names stored as strings in metadata, configurable
- **No Shortcuts**: Full icon picker UI, real LLM integration for suggestions
- **Testing Before Claims**: Feature follows TDD with test checklist in quickstart.md

**Compliance**: All functionality is real, not simulated.

### Data Persistence and Durability ✅ PASS

- **Process Restart**: Custom icons persist in JSON graph files (existing storage)
- **Human-Readable**: Icon names are strings ("heart", "star") in JSON metadata
- **Performance**: No additional load/save time (optional metadata fields)
- **Concurrent Modifications**: Uses existing graph save mechanism (atomic writes)
- **Backup/Export**: Custom icons included in graph JSON exports

**Compliance**: Leverages existing graph persistence mechanism.

### Security and Privacy ✅ PASS

- **API Keys**: LLM API keys already managed by existing config (no new secrets)
- **Content Logging**: Node content truncated to 200 chars for AI suggestions, not logged
- **Local LLMs**: Icon suggestions work with Ollama (local provider)
- **Cloud Warnings**: Existing LLM manager handles provider warnings
- **Offline Mode**: Icon selection works offline (AI suggestions require LLM)

**Compliance**: No new security concerns, reuses existing LLM security model.

### Performance Standards ✅ PASS

- **Graph Operations**: Icon changes are metadata updates (<100ms, existing perf)
- **UI Updates**: Icon picker opens <500ms, selection updates <100ms
- **Context Building**: Icon suggestion uses 200 char content (instant, <1ms)
- **LLM Response**: 3 second timeout enforced for suggestions
- **Memory**: Icon registry ~1MB (loaded once), no leaks

**Compliance**: Performance targets defined and achievable.

### Development Workflow ✅ PASS

**Code Organization**:
- Frontend: `frontend/src/components/icons/` (IconPicker, registry)
- Backend: `src/mindflow/api/routes/icons.py`, `src/mindflow/services/icon_service.py`
- Tests: `frontend/tests/components/icons/`, `tests/unit/test_icon_service.py`
- Docs: `specs/005-node-icon-customization/` (this directory)

**Testing Requirements**:
- 80% code coverage target
- Unit tests for icon registry, search, validation
- Integration tests for suggestion API
- Component tests for IconPicker

**Minimal Root Files**: All new files in appropriate subdirectories (no root pollution)

**Compliance**: Follows project organization standards.

### Constitution Summary

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Graph Integrity | ✅ PASS | Metadata-only changes, no graph structure impact |
| II. LLM Provider Agnostic | ✅ PASS | Uses existing LLMManager |
| III. Explicit Operations | ✅ PASS | User-controlled icon selection |
| IV. Test-First | ✅ PASS | Comprehensive test plan included |
| V. Context Transparency | ⚠️ PARTIAL | Minimal LLM usage (suggestions only) |
| VI. Multiplatform | ✅ PASS | Cross-platform compatible |
| VII. No Simulation | ✅ PASS | Real implementation throughout |
| Data Persistence | ✅ PASS | Uses existing JSON storage |
| Security/Privacy | ✅ PASS | Reuses existing LLM security |
| Performance | ✅ PASS | Targets defined and achievable |
| Development Workflow | ✅ PASS | Follows project standards |

**Overall**: ✅ **CONSTITUTION COMPLIANT** - No violations, ready to proceed.

## Project Structure

### Documentation (this feature)

```text
specs/005-node-icon-customization/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output (technology decisions)
├── data-model.md        # Phase 1 output (entity schemas)
├── quickstart.md        # Phase 1 output (developer guide)
├── contracts/           # Phase 1 output (API contracts)
│   └── api-icons.yaml   # OpenAPI spec for icon endpoints
├── checklists/
│   └── requirements.md  # Spec quality validation
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT YET CREATED)
```

### Source Code (repository root)

```text
# Frontend (React + TypeScript)
frontend/
├── src/
│   ├── components/
│   │   ├── icons/                      # NEW: Icon system
│   │   │   ├── IconPicker.tsx         # Icon selection UI
│   │   │   ├── IconRegistry.ts        # Icon name → component mapping
│   │   │   └── IconFavorites.ts       # localStorage favorites management
│   │   ├── Node.tsx                    # MODIFIED: Add custom icon support
│   │   └── Canvas.tsx                  # MODIFIED: Pass custom icons to nodes
│   ├── types/
│   │   └── graph.ts                    # MODIFIED: Add custom_icon to NodeMetadata
│   └── services/
│       └── api.ts                      # MODIFIED: Add icon suggestion endpoint
└── tests/
    ├── components/
    │   └── icons/                      # NEW: Icon component tests
    │       ├── IconPicker.test.tsx
    │       ├── IconRegistry.test.ts
    │       └── IconFavorites.test.ts
    └── integration/
        └── iconSuggestion.test.ts      # NEW: API integration tests

# Backend (Python + FastAPI)
src/mindflow/
├── api/
│   └── routes/
│       └── icons.py                    # NEW: Icon API endpoints
├── services/
│   └── icon_service.py                 # NEW: Icon suggestion logic
└── models/
    └── graph.py                        # MODIFIED: Add custom_icon to NodeMetadata

tests/
├── unit/
│   └── test_icon_service.py           # NEW: Icon service tests
└── integration/
    └── test_icons_api.py               # NEW: Icon API tests
```

**Structure Decision**: Web application structure (frontend + backend) is already established. This feature extends existing components and adds new icon-specific modules in appropriate locations. No new top-level directories created.

**Modified Files**: 4 files (Node.tsx, Canvas.tsx, graph.ts frontend+backend)
**New Files**: 10 files (IconPicker, IconRegistry, IconFavorites, icons.py, icon_service.py, + 5 test files)

## Complexity Tracking

> **No constitutional violations - this section is empty.**

No additional complexity introduced beyond feature requirements. All design decisions align with constitution principles.

---

## Phase 0 Artifacts

✅ **research.md** - Technology decisions and unknowns resolved
- Icon registry approach (string names → React components)
- AI suggestion implementation (reuse LLMManager)
- Metadata storage (optional fields, backward compatible)
- Icon picker UI pattern (categorized grid + search)
- Fallback strategy (invalid icons → type-based defaults)
- Performance optimizations (virtual scrolling, caching)

## Phase 1 Artifacts

✅ **data-model.md** - Entity schemas and relationships
- NodeMetadata extension (custom_icon, icon_source)
- IconRegistry (frontend mapping)
- IconPickerState (UI state)
- IconSuggestionRequest/Response (API contracts)
- IconFavorites (localStorage schema)

✅ **contracts/api-icons.yaml** - OpenAPI specification
- POST /api/icons/suggest (AI suggestions)
- GET /api/icons/registry (icon metadata)
- POST /api/icons/validate (icon name validation)

✅ **quickstart.md** - Developer onboarding guide
- Component overview and usage examples
- Implementation phases (Foundation, UI, AI, Testing)
- Testing checklist and benchmarks
- Common issues and solutions

## Next Steps

**Phase 2**: Run `/speckit.tasks` to generate actionable task breakdown

The implementation plan is complete and ready for task generation. All design artifacts have been created:
- ✅ Research decisions documented
- ✅ Data models defined
- ✅ API contracts specified
- ✅ Quickstart guide written
- ✅ Constitution compliance verified

**Ready for**: `/speckit.tasks` command to break down into actionable tasks with TDD workflow.
