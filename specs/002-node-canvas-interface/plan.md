# Implementation Plan: Interactive Node Canvas Interface

**Branch**: `002-node-canvas-interface` | **Date**: 2025-11-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-node-canvas-interface/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

**Primary Requirement**: Create a modern, ComfyUI-style interactive node canvas interface that allows users to view their MindFlow reasoning graphs with zoom/pan navigation capabilities.

**Technical Approach**: Build a React-based frontend using React Flow for the canvas visualization layer, TypeScript for type safety, and Zustand for lightweight state management. The frontend integrates with the existing MindFlow Engine (Python) via REST API. Node positions are calculated using the Dagre hierarchical layout algorithm. Performance is optimized through viewport culling and component memoization to maintain 30+ FPS with 500+ nodes.

## Technical Context

### Frontend (React Application)

**Language/Version**: TypeScript 5.3+, JavaScript ES2022
**Primary Dependencies**:
- React 18.2+ (UI framework)
- React Flow 11+ (node canvas visualization)
- Zustand 4.5+ (state management)
- Axios 1.6+ (HTTP client)
- Lucide React 0.300+ (icons)
- Vite 5+ (build tool)

**Storage**: localStorage for viewport state and UI preferences (client-side only)
**Testing**: Vitest 1.0+ (unit tests), React Testing Library 14+ (component tests)
**Target Platform**: Modern web browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
**Project Type**: Web application (frontend only for this feature)

### Backend Integration (Python API)

**Language/Version**: Python 3.11+
**Primary Dependencies**:
- FastAPI 0.108+ (REST API framework)
- Uvicorn 0.25+ (ASGI server)
- Pydantic 2.6+ (data validation - existing)
- Pygraphviz 1.11+ (Dagre layout algorithm)

**Storage**: Utilizes existing MindFlow Engine graph storage (from feature 001)
**Testing**: pytest (backend endpoints only)
**Target Platform**: Local development server (Windows/Linux)

### Performance Goals

- **Frame Rate**: Maintain 30+ FPS during zoom/pan with 500+ nodes
- **Initial Load**: Render 200-node graph in <2 seconds
- **Interaction Latency**: Selection feedback within 100ms
- **API Response**: Graph data retrieval <500ms for 500-node graphs

### Constraints

- **Browser Compatibility**: No polyfills for legacy browsers (IE11 not supported)
- **Viewport Rendering**: Only visible nodes rendered (viewport culling mandatory)
- **Memory**: Frontend bundle size <2MB gzipped
- **Network**: API calls minimized (single graph load, no per-node requests)
- **Offline**: Not required (online-only for P1)

### Scale/Scope

- **Supported Graph Sizes**: 100-1000 nodes (graceful degradation beyond 1000)
- **Concurrent Users**: N/A (local-only, single-user for P1)
- **Component Count**: ~15-20 React components
- **API Endpoints**: 3 endpoints (GET /graphs/{id}, GET /graphs/{id}/nodes, POST /graphs/{id}/viewport)
- **UI States**: 5 primary states (loading, loaded, selecting, zooming, panning)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution File Status**: Not yet created for this project

**Manual Review** (following general best practices):

✅ **Separation of Concerns**: Frontend (React) and backend (Python) are cleanly separated with API boundary
✅ **No Hardcoded Values**: All configuration via config files or environment variables (API endpoints, theme colors, zoom limits)
✅ **Testing Requirements**: Both frontend (Vitest) and backend (pytest) testing frameworks defined
✅ **Documentation**: Complete spec, research, data-model, contracts, and quickstart provided
✅ **Performance Targets**: Measurable success criteria defined (30+ FPS, <2s load time)
✅ **Dependency Management**: All dependencies versioned and specified in package.json/pyproject.toml
✅ **Code Standards**: TypeScript for type safety, ESLint/Prettier for formatting, Black/Ruff for Python
✅ **Minimal Root Files**: Frontend project in `frontend/` subdirectory, not at root
✅ **No Simulation Code**: All features implemented with real functionality (no mock/placeholder implementations)
✅ **Platform Support**: Targets modern browsers and local development (Windows/Linux compatible)

**Action Items Before Implementation**:
- [ ] Create project constitution file at `.specify/constitution.md` (recommended for future features)
- [ ] Define project-specific complexity rules (if needed)
- [ ] Document architectural principles (if needed)

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
Assisted MindFlow/
├── src/mindflow/              # Python backend (existing from feature 001)
│   ├── models/                # Pydantic models (Node, Group, Graph - existing)
│   │   ├── node.py
│   │   ├── group.py
│   │   ├── comment.py
│   │   └── graph.py
│   ├── utils/                 # Utilities (existing)
│   │   ├── cycles.py
│   │   ├── tokens.py
│   │   └── validation.py
│   └── api/                   # NEW: REST API endpoints
│       ├── server.py          # FastAPI application
│       ├── routes/            # API route handlers
│       │   ├── graphs.py      # Graph endpoints
│       │   └── viewport.py    # Viewport endpoints
│       └── schemas/           # API request/response models
│           └── viewport.py    # CanvasViewport schema
│
├── frontend/                  # NEW: React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Canvas.tsx     # Main canvas component
│   │   │   ├── Node.tsx       # Custom node renderer
│   │   │   ├── DetailPanel.tsx
│   │   │   ├── Controls.tsx
│   │   │   └── MiniMap.tsx
│   │   ├── features/          # Feature modules
│   │   │   └── canvas/        # Canvas feature
│   │   │       ├── hooks/     # Custom React hooks
│   │   │       │   ├── useGraphData.ts
│   │   │       │   ├── useViewport.ts
│   │   │       │   └── useSelection.ts
│   │   │       └── utils/     # Canvas utilities
│   │   │           ├── transform.ts    # Graph to VisualNode
│   │   │           ├── styling.ts      # Node styling logic
│   │   │           └── viewport.ts     # Viewport helpers
│   │   ├── services/          # API services
│   │   │   └── api.ts         # HTTP client (Axios)
│   │   ├── stores/            # Zustand stores
│   │   │   └── canvasStore.ts # App state management
│   │   ├── types/             # TypeScript type definitions
│   │   │   ├── canvas.ts      # CanvasViewport, VisualNode, etc.
│   │   │   └── graph.ts       # Graph, Node (from backend)
│   │   ├── App.tsx            # Root component
│   │   └── main.tsx           # Entry point
│   ├── public/                # Static assets
│   ├── package.json           # Dependencies
│   ├── tsconfig.json          # TypeScript config
│   ├── vite.config.ts         # Vite config (with API proxy)
│   └── index.html             # HTML entry point
│
├── tests/                     # Python tests (existing)
│   ├── unit/                  # Unit tests
│   │   ├── test_node.py       # (existing)
│   │   ├── test_validation.py # (existing)
│   │   └── test_api.py        # NEW: API endpoint tests
│   └── integration/           # Integration tests
│       └── test_graph_api.py  # NEW: Full API integration
│
├── specs/002-node-canvas-interface/  # This feature's documentation
│   ├── spec.md                # Feature specification
│   ├── plan.md                # This file
│   ├── research.md            # Technical research
│   ├── data-model.md          # Data models
│   ├── quickstart.md          # Developer guide
│   └── contracts/
│       └── api.yaml           # OpenAPI schema
│
├── pyproject.toml             # Python dependencies (updated with FastAPI)
└── README.md                  # Project overview
```

**Structure Decision**: **Web application (frontend + backend)**

This feature introduces a new `frontend/` directory for the React application while extending the existing Python backend (`src/mindflow/`) with a new `api/` module for REST endpoints. The backend structure is preserved from feature 001 (MindFlow Engine), and we're adding API-specific code alongside existing models and utilities.

The frontend is a complete standalone Vite + React project with its own dependencies, build system, and development server. Communication happens via HTTP REST API with JSON payloads.

**Key Additions**:
- `frontend/` - Complete React application (NEW)
- `src/mindflow/api/` - FastAPI REST endpoints (NEW)
- API tests in `tests/unit/test_api.py` (NEW)
- OpenAPI contracts in `specs/002-.../contracts/` (NEW)

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**Status**: ✅ **No violations** - All constitution checks passed

This feature follows standard web application architecture patterns:
- Clean separation between frontend and backend
- Single API boundary with REST endpoints
- No unnecessary abstraction layers
- Direct use of React Flow (battle-tested library) instead of building custom canvas solution
- Minimal state management (Zustand chosen for simplicity over Redux)

**Rejected Alternatives** (documented for transparency):
- **Raw Canvas API**: Would require 3-6 months to build zoom/pan/performance features from scratch
- **Redux**: Overkill for our state needs (Zustand is 1KB vs Redux 45KB)
- **GraphQL**: Unnecessary complexity for 3 simple endpoints
- **WebSocket Live Updates**: Deferred to P3 (not needed for initial MVP)

No complexity violations to justify.
