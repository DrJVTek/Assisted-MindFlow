# Implementation Plan: Node Version History with Temporal Timeline UI

**Branch**: `009-node-version-history` | **Date**: 2025-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-node-version-history/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

MindFlow transforms from a spatial reasoning system into a **spatio-temporal reasoning system**, enabling users to navigate both node hierarchy (spatial dimension) and version history (temporal dimension). Every node content change is captured as an immutable version snapshot, with per-node timeline UI for navigation, parent impact tracking through child change markers, global timeline view for entire graph evolution, and Myers diff algorithm for version comparison.

**Technical Approach**: Hybrid storage strategy (PostgreSQL for recent versions <30 days + gzip-compressed file archives for older versions), word-level Myers diff algorithm for accurate change detection, custom React timeline component with rc-slider for UI, smart version throttling (3-second inactivity or 30% content change threshold), lazy loading + virtual scrolling + event aggregation for 50,000+ version performance, and child change marker system for causality tracking without full version duplication.

## Technical Context

**Language/Version**: Python 3.11+ (backend) + TypeScript 5.9.3 (frontend)

**Primary Dependencies**:
- Backend: FastAPI, asyncpg (PostgreSQL), pydantic, difflib (built-in Myers diff), gzip (built-in compression)
- Frontend: React 19, rc-slider (~20KB, timeline slider), react-window (~10KB, virtual scrolling), Tailwind CSS (existing)

**Storage**:
- PostgreSQL 15+ (primary storage for recent versions, child markers, metadata)
- File system (gzip-compressed JSON archives for versions >30 days old)
- Pattern: `data/versions/{node_id}/archive.json.gz`

**Testing**: pytest (backend unit/integration), vitest (frontend unit), @testing-library/react (React components)

**Target Platform**: Web application (multiplatform: Windows/Linux backend, modern browsers frontend)

**Project Type**: web (frontend + backend microservices)

**Performance Goals**:
- Load 100 versions per node: <500ms
- Compute diff (1,000 words): <100ms
- Compute diff (10,000 words): <1s (background worker)
- Global timeline (50,000 events): <2s (with aggregation)
- Timeline scrubbing: 60 FPS smooth animation
- Version restore: <500ms

**Constraints**:
- Max 10,000 characters per node content (enforced at application layer)
- Version limit per node: 100 active versions (older ones archived automatically)
- Archive threshold: 30 days (versions older than 30 days moved to compressed files)
- Throttling rules: 3-second inactivity OR 30% content change threshold
- Max cascade depth: 5 levels (prevent infinite loops in parent impact tracking)

**Scale/Scope**:
- 500 nodes per graph (typical usage)
- 100 versions per node (active, non-archived)
- 50,000 total versions across graph (stress test scenario)
- 5 API endpoints (create version, list versions, restore, diff, timeline)
- Single-user focus (no multi-user collaboration in MVP)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**I. Graph Integrity** ✅ PASS
- Immutable version snapshots (never modify existing versions, only create new ones)
- Node content changes update node.content + create NodeVersion record
- Parent-child relationships preserved (markers reference node IDs, not duplicated)
- Version restoration creates new version (non-destructive)

**II. LLM Provider Agnostic** ✅ PASS
- LLM metadata stored generically (provider, model, tokens) without provider-specific dependencies
- Version system works independently of LLM operations
- No coupling to specific LLM APIs

**III. Explicit Operations** ✅ PASS
- Version creation user-initiated (typing + pause) or LLM-triggered (explicit regeneration)
- Throttling transparent to user (can see version count, manual save button to bypass)
- Timeline navigation explicit (user drags slider)
- Restore requires explicit user action (button click with confirmation)

**IV. Test-First** ✅ PASS
- Comprehensive test plan in quickstart.md (6 phases with unit + integration tests)
- Unit tests for throttling logic, diff algorithm, archiving
- Integration tests for API endpoints, version lifecycle
- Performance tests for 50,000 version scenario

**V. Context Transparency** ✅ PASS
- Version content stored as-is (no hidden transformations)
- Diff algorithm transparent (Myers diff, well-documented)
- Timeline displays all version metadata (trigger reason, author, timestamp)

**VI. Multiplatform** ✅ PASS
- Python 3.11 backend compatible with Windows/Linux
- React frontend runs in all modern browsers
- File paths use os.path.join for cross-platform compatibility

**VII. No Simulation** ✅ PASS
- Real version storage in PostgreSQL + file system
- Actual Myers diff algorithm (difflib library)
- Real compression with gzip
- No mock/stub operations

**VIII. Data Persistence** ✅ PASS
- PostgreSQL: durable storage for active versions, child markers
- File archives: long-term storage with gzip compression
- Atomic version creation (database transactions)
- Survives server restart (persistent storage)

**IX. Security/Privacy** ✅ PASS
- Version content may contain sensitive data (handled same as node content)
- Access control: graph-level permissions apply to all versions
- No cross-user version queries
- Audit trail: all versions logged with timestamps and trigger reasons

**X. Performance** ✅ PASS
- <500ms node version list (indexed queries)
- <100ms small diff, <1s large diff (background worker)
- <2s global timeline with 50,000 events (aggregation)
- Virtual scrolling prevents rendering 100+ DOM elements

**XI. Development Workflow** ✅ PASS
- Modular design (VersionService, DiffService, separate concerns)
- Clear API contracts (OpenAPI spec in contracts/api-version-history.yaml)
- Comprehensive documentation (research.md, data-model.md, quickstart.md)
- No hardcoded values (configurable throttling, archive thresholds)

## Project Structure

### Documentation (this feature)

```text
specs/009-node-version-history/
├── plan.md                         # This file (/speckit.plan command output)
├── spec.md                         # Feature specification (complete)
├── research.md                     # Phase 0 output (complete - storage, diff, UI, performance)
├── data-model.md                   # Phase 1 output (complete - NodeVersion, ChildChangeMarker, VersionDiff)
├── quickstart.md                   # Phase 1 output (complete - developer guide, 6 phases)
├── contracts/
│   └── api-version-history.yaml    # Phase 1 output (complete - OpenAPI spec)
└── tasks.md                        # Phase 2 output (to be generated by /speckit.tasks)
```

### Source Code (repository root)

#### Web Application Structure

**Backend Structure:**
```text
src/mindflow/
├── api/
│   ├── routes/
│   │   ├── versions.py                # NEW: POST/GET /nodes/{id}/versions
│   │   ├── diff.py                    # NEW: POST /nodes/{id}/versions/diff
│   │   ├── timeline.py                # NEW: GET /nodes/{id}/timeline, /graphs/{id}/timeline
│   │   ├── graphs.py                  # MODIFIED: integrate version history
│   │   └── nodes.py                   # MODIFIED: version creation on node update
│   └── server.py                      # MODIFIED: register new routes
│
├── services/
│   ├── version_service.py             # NEW: VersionService (throttling, archiving)
│   ├── diff_service.py                # NEW: DiffService (Myers diff computation)
│   ├── timeline_service.py            # NEW: TimelineService (aggregation, clustering)
│   ├── archive_service.py             # NEW: ArchiveService (gzip compression, file I/O)
│   └── llm_service.py                 # MODIFIED: trigger version creation on LLM completion
│
├── models/
│   ├── graph.py                       # MODIFIED: add NodeVersion, ChildChangeMarker entities
│   ├── version.py                     # NEW: NodeVersion, VersionDiff, TimelineEvent schemas
│   └── node_version.py                # Existing (may extend if needed)
│
└── utils/
    ├── throttle.py                    # NEW: Throttling logic (inactivity, content change)
    └── diff_utils.py                  # NEW: Myers diff helpers, collapse unchanged

tests/
├── unit/
│   ├── test_version_service.py        # NEW: Throttling, archiving tests
│   ├── test_diff_service.py           # NEW: Myers diff accuracy tests
│   ├── test_throttle.py               # NEW: Throttling rules validation
│   └── test_archive_service.py        # NEW: Compression, file I/O tests
│
├── integration/
│   ├── test_version_api.py            # NEW: Version CRUD endpoints
│   ├── test_diff_api.py               # NEW: Diff computation endpoint
│   ├── test_timeline_api.py           # NEW: Timeline retrieval endpoints
│   └── test_version_lifecycle.py     # NEW: Create → restore → diff workflow
│
└── load/
    └── test_50k_versions.py           # NEW: Performance with 50,000 versions

Database (migrations):
└── migrations/
    ├── 2025-11-21_add_node_versions_table.sql      # NEW: NodeVersion schema
    └── 2025-11-21_add_child_markers_table.sql      # NEW: ChildChangeMarker schema
```

**Frontend Structure:**
```text
frontend/src/
├── stores/
│   └── versionHistoryStore.ts        # NEW: Zustand store for timeline state
│
├── hooks/
│   ├── useVersionHistory.ts          # NEW: Hook for version operations
│   ├── useVersionDiff.ts             # NEW: Hook for diff computation
│   └── useTimeline.ts                # NEW: Hook for timeline data fetching
│
├── components/
│   ├── VersionTimeline.tsx           # NEW: Per-node timeline slider UI
│   ├── VersionDiff.tsx               # NEW: Side-by-side diff visualization
│   ├── GlobalTimeline.tsx            # NEW: Graph-wide timeline view
│   ├── ChildMarker.tsx               # NEW: Child change marker display
│   ├── VersionTooltip.tsx            # NEW: Hover tooltip for version markers
│   └── Node.tsx                      # MODIFIED: add history icon button
│
└── features/
    └── versions/
        ├── utils/
        │   ├── diffRenderer.ts        # NEW: Render diff changes with colors
        │   ├── timelineAggregation.ts # NEW: Client-side event clustering
        │   └── versionFormatter.ts    # NEW: Format timestamps, trigger reasons
        │
        └── services/
            └── versionService.ts      # NEW: API client for version operations

frontend/tests/
├── unit/
│   ├── versionHistoryStore.test.ts   # NEW: Zustand store state management
│   ├── diffRenderer.test.ts          # NEW: Diff visualization rendering
│   └── timelineAggregation.test.ts   # NEW: Event clustering logic
│
└── integration/
    ├── versionTimeline.test.tsx      # NEW: Timeline UI interactions
    └── versionDiff.test.tsx           # NEW: Diff display and comparison
```

**Structure Decision**: Web application structure selected. Backend Python (FastAPI) handles version storage, diff computation, and timeline aggregation. Frontend React/TypeScript handles UI visualization with Zustand state management. Clear separation: backend = persistence/computation, frontend = visualization/interaction. Hybrid storage (PostgreSQL + files) balances query performance (database) with long-term storage efficiency (compressed archives).

## Complexity Tracking

> **Note**: All architectural requirements satisfied. No constitutional violations requiring justification.

(No violations - all design choices align with project principles)

## Phase 0 Artifacts

**Status**: ✅ COMPLETE

- ✅ **research.md**: Comprehensive technical research (4 key tasks)
  - Task 1: Version Storage Strategy - Hybrid (PostgreSQL + file archive) selected
  - Task 2: Diff Algorithm Selection - Word-level Myers diff chosen
  - Task 3: Timeline UI Framework - Custom React with rc-slider selected
  - Task 4: Performance Optimization - Lazy loading, virtual scrolling, event aggregation strategies
  - Task 5: Smart Version Throttling - 3s inactivity + 30% change threshold + operation-based versioning
  - Implementation roadmap: 6 weeks across 5 phases
  - Risk analysis and mitigation strategies documented

## Phase 1 Artifacts

**Status**: ✅ COMPLETE

- ✅ **data-model.md**: Entity definitions and relationships
  - NodeVersion (core entity: version_id, node_id, content, trigger_reason, metadata)
  - ChildChangeMarker (parent impact tracking: marker_id, parent_node_id, child_version_id)
  - VersionDiff (computed, not stored: changes list, word_count_delta, statistics)
  - TimelineEvent (aggregated view: version + marker events for global timeline)
  - VersionArchive (file-based: compressed JSON for old versions)
  - PostgreSQL schema with indexes, validation rules, relationships
  - Memory estimates: 50MB for 50,000 versions (database + archives)

- ✅ **contracts/api-version-history.yaml**: OpenAPI specification
  - POST /nodes/{id}/versions: Create version with throttling
  - GET /nodes/{id}/versions: List versions (with archived flag)
  - GET /nodes/{id}/versions/{num}: Get specific version
  - POST /nodes/{id}/versions/{num}/restore: Restore previous version
  - POST /nodes/{id}/versions/diff: Compute Myers diff
  - GET /nodes/{id}/timeline: Per-node timeline with child markers
  - GET /graphs/{id}/timeline: Global timeline with aggregation
  - Request/response schemas with examples

- ✅ **quickstart.md**: Developer onboarding guide
  - Quick demo scenarios (version navigation, parent impact, global timeline)
  - Key components (VersionService, DiffService, VersionTimeline, VersionDiff)
  - 6 implementation phases with deliverables
  - Testing checklist (unit, integration, manual tests)
  - Common issues and solutions
  - API reference with examples

## Next Steps

**Action**: Run `/speckit.tasks` to generate task breakdown (`tasks.md`) with:
- Specific actionable tasks in dependency order
- Estimated complexity and effort (small: <4h, medium: 4-8h, large: >8h)
- Assigned owners (if applicable)
- Testing acceptance criteria for each task
- Git commit message templates

**Acceptance Gate**: tasks.md must decompose all requirements into <8-hour implementation tasks (ideally <4-hour), each with clear completion criteria, test coverage targets (80%+ unit tests), and dependencies explicitly stated.

---

## Reference Information

**Key Metrics from Research**:
- Version throttling: 3-second inactivity OR 30% content change threshold
- Version limit per node: 100 active (older archived)
- Archive threshold: 30 days (compressed with gzip, 90% size reduction)
- Diff performance: <100ms for 1,000 words, <1s for 10,000 words
- Timeline performance: <2s for 50,000 events (with aggregation)
- Storage: ~1KB per version (database), ~100 bytes compressed (archive)

**Critical Implementation Requirements**:
1. Version immutability: never modify existing versions, only create new
2. Non-destructive rollback: restore creates new version pointing to old (parent_version_id)
3. Atomic version creation: database transaction ensures consistency
4. Child markers separate from versions: lightweight tracking without content duplication
5. Smart throttling: bypass for LLM operations, cascades, manual saves

**Testing Coverage Target**: 80%+ code coverage
- 12+ new test files (unit + integration + load)
- Throttling scenarios (rapid typing, long pauses, 30% threshold)
- Diff accuracy (additions, deletions, modifications, collapsed sections)
- Timeline aggregation (50,000 events → ~500 clusters)
- Performance (100 versions in <500ms, 50k timeline in <2s)

**Estimated Implementation Effort**: 6 weeks
- Phase 1: Core infrastructure (version storage, throttling) - Week 1
- Phase 2: Timeline UI & navigation (slider, preview, restore) - Week 2
- Phase 3: Parent impact tracking (child markers, causality) - Week 3
- Phase 4: Diff visualization (Myers algorithm, side-by-side UI) - Week 4
- Phase 5: Global timeline (aggregation, filtering, events) - Week 5
- Phase 6: Performance & polish (archiving, virtual scrolling, optimization) - Week 6

**Reference Artifacts**:
- Feature 007 (concurrent-llm-hierarchy) served as implementation pattern reference
- Myers diff algorithm (difflib library documentation)
- rc-slider component library (timeline slider UI)
- PostgreSQL partial indexes (recent versions optimization)
- gzip compression (Python built-in, 90% size reduction)

**Key Design Decisions Rationale**:
1. **Hybrid storage** (PostgreSQL + files): Recent versions in database (fast queries), old versions in files (space-efficient)
2. **Word-level Myers diff**: Better for prose than line-level, proven algorithm (40+ years)
3. **Custom React timeline**: Minimal dependencies (vs 150KB vis-timeline), full control
4. **Smart throttling**: Balance completeness (capture all changes) with usability (avoid version spam)
5. **Child markers (not full versions)**: Lightweight causality tracking, no content duplication
6. **Event aggregation**: 50,000 events → ~500 clusters (100x reduction) for global timeline performance
