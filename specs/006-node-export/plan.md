# Implementation Plan: Node Export to Multiple Formats

**Branch**: `006-node-export` | **Date**: 2025-11-21 | **Spec**: [spec.md](./spec.md)

## Summary

Enable users to export single nodes or entire reasoning trees to **Markdown**, **HTML**, and **PDF** formats with customizable styling, metadata inclusion, and hierarchy preservation. The implementation uses WeasyPrint for PDF generation (pure Python, excellent CSS support), Python-Markdown for Markdown formatting, and Jinja2 for HTML templating. Tree traversal uses depth-first search with cycle detection for safe navigation of the DAG structure.

**Timeline**: 3 weeks (70 hours)
**Risk Level**: Medium (new dependencies, PDF rendering complexity)
**Priority**: P1 (high user value, enables documentation workflows)

## Technical Context

**Language/Version**: Python 3.11, TypeScript 5.9.3
**Primary Dependencies**:
- Backend: FastAPI 0.121.2, WeasyPrint 60.0+, Python-Markdown 3.5+, Jinja2 3.1+, Pydantic 2.12.4
- Frontend: React 19.2.0, Axios 1.13.2, Zustand 5.0.8

**Storage**: In-memory storage with 24h TTL for cached exports (upgrade to DB optional in future)
**Testing**: Pytest (backend), Vitest + React Testing Library (frontend)
**Target Platform**: Cross-platform (Windows + Linux), all major browsers
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Single node export < 2s, 100-node tree export < 10s, 500-node tree < 30s
**Constraints**: Maximum 1000 nodes per export, PDF generation timeout 5 minutes, CORS configured for development
**Scale/Scope**: Typical use: 1-50 nodes per export, occasional large exports (100-500 nodes)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Graph Integrity (NON-NEGOTIABLE)

**Status**: ✅ COMPLIANT

**How**:
- Export operations are **read-only** - no graph modifications
- Cycle detection prevents infinite loops during tree traversal
- All exports are immutable snapshots
- Failed exports do not affect graph state

### II. LLM Provider Agnostic

**Status**: ✅ COMPLIANT

**How**:
- Export feature is **independent of LLM providers**
- Works with any node content (human-created or LLM-generated)
- No LLM API calls required
- Content treated as opaque data

### III. Explicit Operations, No Magic (NON-NEGOTIABLE)

**Status**: ✅ COMPLIANT

**How**:
- User explicitly triggers export via context menu
- All options visible and configurable in dialog
- Size estimate/preview available before generation
- No automatic or hidden exports

### IV. Test-First for Graph Operations (NON-NEGOTIABLE)

**Status**: ✅ COMPLIANT

**How**:
- TDD approach for tree traversal (critical for correctness)
- Unit tests for each export format
- Integration tests for API endpoints
- Target: 85%+ coverage

**Test Order**:
1. Write traversal tests (cycle detection, depth limiting)
2. Implement traversal strategies
3. Write exporter tests (format validation)
4. Implement exporters
5. Write API tests
6. Implement API endpoints

### V. Context Transparency

**Status**: ✅ COMPLIANT

**How**:
- Export shows node count and size estimate before generation
- Warnings displayed for large exports
- No hidden content filtering
- Clear indication of what will be exported

### VI. Multiplatform Support (NON-NEGOTIABLE)

**Status**: ✅ COMPLIANT

**How**:
- WeasyPrint is pure Python (works on Windows + Linux)
- File paths via `pathlib.Path` (platform-agnostic)
- MIME types and headers are standard
- Tests run on both platforms

### VII. No Simulation or Hardcoded Data

**Status**: ✅ COMPLIANT

**How**:
- All exports from real node data (no mocks in production)
- No demo mode
- Configuration via config files (not hardcoded)
- Must test before claiming success

## Project Structure

### Documentation (this feature)

```text
specs/006-node-export/
├── spec.md              # Feature specification (user scenarios, requirements)
├── plan.md              # This file (implementation plan)
├── research.md          # Phase 0: Technical research (1500+ lines)
├── data-model.md        # Phase 0: Data models (1000+ lines)
├── quickstart.md        # Phase 0: Developer guide (1200+ lines)
├── contracts/           # Phase 0: API contracts
│   └── api-export.yaml  # OpenAPI 3.0 specification
└── tasks.md             # Phase 2: NOT yet created (use /speckit.tasks)
```

### Source Code (repository root)

**Web Application Structure** (backend + frontend):

```text
src/mindflow/                          # Backend
├── models/
│   ├── export_request.py              [NEW] Pydantic model for export requests
│   ├── export_options.py              [NEW] Export configuration options
│   ├── exported_document.py           [NEW] Generated document model
│   └── export_models.py               [NEW] Aggregate exports module
├── services/
│   ├── export_service.py              [NEW] Orchestration service
│   ├── markdown_export.py             [NEW] Markdown format exporter
│   ├── html_export.py                 [NEW] HTML format exporter
│   ├── pdf_export.py                  [NEW] PDF format exporter (WeasyPrint)
│   └── templates/
│       └── node_export.html           [NEW] Jinja2 template for HTML exports
├── utils/
│   ├── tree_traversal.py              [NEW] Tree traversal strategies (DFS/BFS)
│   └── traversal_factory.py           [NEW] Strategy factory pattern
├── validators/
│   └── export_validator.py            [NEW] Request validation logic
├── storage/
│   └── export_storage.py              [NEW] In-memory export cache
└── api/
    └── routes/
        └── exports.py                 [NEW] Export API endpoints

frontend/src/                          # Frontend
├── types/
│   └── export.ts                      [NEW] TypeScript type definitions
├── components/
│   └── ExportDialog.tsx               [NEW] Export configuration UI
├── services/
│   └── exportService.ts               [NEW] API client for export endpoints
├── utils/
│   └── fileDownload.ts                [NEW] Browser download utilities
└── stores/
    └── exportStore.ts                 [NEW] Zustand state management

tests/                                 # Backend tests
├── unit/
│   ├── test_export_models.py          [NEW] Model validation tests
│   ├── test_markdown_export.py        [NEW] Markdown format tests
│   ├── test_html_export.py            [NEW] HTML format tests
│   ├── test_pdf_export.py             [NEW] PDF generation tests
│   └── test_tree_traversal.py         [NEW] Traversal algorithm tests
└── integration/
    └── test_export_api.py             [NEW] API endpoint tests

frontend/src/components/__tests__/    # Frontend tests
└── ExportDialog.test.tsx              [NEW] Component tests
```

**Structure Decision**: Web application structure chosen because feature spans both backend (export generation) and frontend (user interface). Backend handles document generation, frontend provides user-facing dialog and file downloads.

## Phase 0: Planning & Design

**Status**: ✅ COMPLETE (2025-11-21)

### Artifacts Created

All Phase 0 documentation complete:

1. ✅ **research.md** (1500+ lines)
   - Export format research (MD/HTML/PDF comparison)
   - PDF generation libraries (WeasyPrint vs ReportLab vs pdfkit)
   - Markdown formatting with Python-Markdown
   - HTML export with Jinja2 templates
   - Tree traversal algorithms (DFS with cycle detection)
   - File download in React (Blob API)
   - Large document optimization (streaming, pagination)
   - Testing strategies

2. ✅ **data-model.md** (1000+ lines)
   - ExportRequest entity (node_id, format, scope, options)
   - ExportOptions entity (theme, metadata toggles, depth limit)
   - ExportedDocument entity (content, metadata, file info)
   - TreeTraversal strategies (single/ancestors/descendants/full)
   - Backend Pydantic models
   - Frontend TypeScript types
   - Validation rules
   - State management (Zustand)

3. ✅ **contracts/api-export.yaml**
   - Complete OpenAPI 3.0 specification
   - All endpoints documented:
     - POST /api/exports (sync export)
     - POST /api/exports/estimate (size estimation)
     - POST /api/exports/async (async for large exports)
     - GET /api/exports/{id}/status (progress check)
     - GET /api/exports/{id}/download (file download)
     - POST /api/exports/{id}/cancel (cancel export)
   - Request/response schemas
   - Error handling

4. ✅ **quickstart.md** (1200+ lines)
   - 5-minute setup guide
   - Key components overview
   - Implementation phases (3 weeks)
   - Quick reference (code snippets)
   - Testing checklist
   - Common issues and solutions
   - Next steps

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **PDF Library** | WeasyPrint | Pure Python, excellent CSS support, no external dependencies, works cross-platform |
| **Markdown Library** | Python-Markdown + pymdown-extensions | Feature-rich (tables, TOC, syntax highlighting), extensible |
| **HTML Templates** | Jinja2 | Already in FastAPI ecosystem, powerful, secure auto-escaping |
| **File Storage** | In-memory (24h TTL) | Simple for MVP, can upgrade to DB later if needed |
| **Traversal Algorithm** | Depth-first search (DFS) | Natural for hierarchical exports, easy to implement cycle detection |
| **Frontend State** | Zustand | Consistent with existing codebase, lightweight |

## Phase 1: Core Export

**Goal**: Single node export working in all formats (Markdown/HTML/PDF)

**Duration**: 1 week (28 hours)
**Priority**: P0 (blocking for other phases)

### Tasks

1. **Backend Data Models** (4 hours)
   - Create ExportRequest, ExportOptions, ExportedDocument models
   - Add validation rules (Pydantic)
   - Write unit tests (model validation, state transitions)
   - **Acceptance**: All models with complete type hints, validation enforced, tests pass with 100% coverage

2. **Tree Traversal** (5 hours)
   - Implement TraversalStrategy base class
   - Create SingleNodeStrategy, AncestorChainStrategy, DescendantDFSStrategy
   - Add cycle detection (visited set tracking)
   - Create TraversalStrategyFactory
   - Write comprehensive tests (edge cases: cycles, depth limits, empty graphs)
   - **Acceptance**: All strategies work correctly, cycle detection prevents infinite loops, depth limiting functional

3. **Markdown Export** (4 hours)
   - Create MarkdownExporter class
   - Implement YAML front matter, TOC generation, node rendering
   - Handle code blocks, special characters
   - Write tests (valid markdown, formatting preserved, TOC for 10+ nodes)
   - **Acceptance**: Valid markdown output, front matter included, code blocks properly formatted

4. **HTML Export** (4 hours)
   - Create Jinja2 template (`templates/node_export.html`)
   - Implement HTMLExporter class with theme support
   - Embed CSS (no external dependencies)
   - Write tests (valid HTML5, theme switching, standalone file)
   - **Acceptance**: Valid HTML structure, all CSS embedded, themes work, opens in any browser

5. **PDF Export** (5 hours)
   - Install and configure WeasyPrint
   - Create PDFExporter class
   - Implement page headers/footers, pagination
   - Write tests (PDF validation with PyPDF2, page count, content extraction)
   - **Acceptance**: Valid PDF generated, headers/footers included, professional typography

6. **API Endpoints** (4 hours)
   - Create ExportService orchestration class
   - Implement POST /api/exports endpoint
   - Add request validation, error handling
   - Register routes in server.py
   - Write integration tests (all formats, error cases)
   - **Acceptance**: API works for all formats, proper MIME types/headers, error handling complete

7. **Frontend Export Dialog** (6 hours)
   - Create TypeScript types (`types/export.ts`)
   - Implement file download utility (`utils/fileDownload.ts`)
   - Create export API service (`services/exportService.ts`)
   - Create Zustand store (`stores/exportStore.ts`)
   - Build ExportDialog component (format selector, scope selector, options panel)
   - Write component tests
   - **Acceptance**: Dialog renders, format selection works, export triggers file download, error handling displays messages

### Deliverables

- ✅ All models implemented and tested
- ✅ Tree traversal with cycle detection
- ✅ All three export formats (MD/HTML/PDF)
- ✅ API endpoints functional
- ✅ Frontend dialog complete
- ✅ Integration tests passing
- ✅ Code coverage > 80%

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WeasyPrint installation issues on Windows | Medium | High | Document installation steps, test early, provide alternatives if needed |
| PDF rendering slow for large documents | Low | Medium | Profile early, optimize CSS, add async option |
| File download blocked by browser security | Low | Medium | Test on all major browsers early in phase |

## Phase 2: Tree Export

**Goal**: Export with ancestors/descendants working correctly

**Duration**: 1 week (18 hours)
**Priority**: P1 (core feature extension)

### Tasks

1. **Full Tree Strategy** (3 hours)
   - Implement FullTreeStrategy (ancestors + descendants)
   - Add depth limiting logic
   - Write comprehensive tests (no duplicates, correct hierarchy)
   - **Acceptance**: Full tree includes ancestors + descendants, depth limiting works, no duplicate nodes

2. **Hierarchy Rendering** (4 hours)
   - Add indentation to markdown exports
   - Add collapsible sections to HTML exports
   - Add tree visualization to PDF exports
   - **Acceptance**: Hierarchy visually clear in all formats, parent-child relationships preserved

3. **Size Estimation** (3 hours)
   - Create estimation algorithm (count nodes, estimate file size)
   - Implement POST /api/exports/estimate endpoint
   - Write tests (estimates within 20% of actual)
   - **Acceptance**: Estimates accurate, warnings for large exports, recommended depth calculated

4. **Frontend Tree Options** (4 hours)
   - Add ancestor/descendant checkboxes to dialog
   - Add depth slider (1-20)
   - Integrate size estimation API
   - Display warnings prominently
   - **Acceptance**: Tree options UI intuitive, size estimate updates in real-time, warnings clear

5. **Integration Testing** (4 hours)
   - Test small trees (5-10 nodes)
   - Test medium trees (50-100 nodes)
   - Test large trees (500+ nodes)
   - Test circular references
   - **Acceptance**: All tree sizes work, performance acceptable (< 10s for 100 nodes), circular refs handled

### Deliverables

- ✅ Full tree export functional
- ✅ Hierarchy rendering in all formats
- ✅ Size estimation working
- ✅ Frontend tree options complete
- ✅ Integration tests passing

## Phase 3: Polish & Optimization

**Goal**: Production-ready with customization and optimization

**Duration**: 1 week (24 hours)
**Priority**: P2 (enhancement)

### Tasks

1. **Async Exports** (5 hours)
   - Add export_storage.py (in-memory cache)
   - Implement POST /api/exports/async endpoint
   - Add GET /api/exports/{id}/status endpoint
   - Add progress tracking mechanism
   - **Acceptance**: Large exports don't block API, progress tracking works, cancellation supported

2. **Theme Customization** (4 hours)
   - Implement theme selector in UI (light/dark/minimal)
   - Add dark theme CSS to all formats
   - Add minimal theme CSS (no metadata, simple styling)
   - **Acceptance**: All themes render correctly in all formats

3. **Advanced Options** (4 hours)
   - Add metadata toggle controls
   - Add font size selector (small/medium/large)
   - Implement preferences persistence (localStorage)
   - **Acceptance**: All options functional, preferences saved across sessions

4. **Performance Optimization** (4 hours)
   - Profile large exports (identify bottlenecks)
   - Optimize PDF generation (simplify CSS, reduce complexity)
   - Add caching for common exports
   - **Acceptance**: 500-node exports complete in < 30s, memory usage acceptable

5. **Documentation** (3 hours)
   - Complete API documentation (docstrings, OpenAPI annotations)
   - Write user guide (with screenshots)
   - Write developer guide (setup, architecture, testing)
   - **Acceptance**: All public APIs documented, guides complete

6. **Final Testing** (4 hours)
   - Cross-browser testing (Chrome, Firefox, Safari, Edge)
   - Large export testing (500+ nodes)
   - Error scenario testing (network failures, invalid data)
   - Performance benchmarking
   - **Acceptance**: Works on all browsers, all error scenarios handled, benchmarks met

### Deliverables

- ✅ Async exports for large documents
- ✅ Theme customization complete
- ✅ Advanced options functional
- ✅ Performance optimized
- ✅ Complete documentation
- ✅ 90%+ test coverage

## Testing Strategy

### Test Coverage Targets

| Component | Target Coverage | Test Types |
|-----------|----------------|------------|
| Backend Models | 100% | Unit (Pydantic validation) |
| Tree Traversal | 95%+ | Unit (DFS, cycle detection, edge cases) |
| Export Formatters | 90%+ | Unit (output validation, formatting) |
| API Endpoints | 85%+ | Integration (request/response, errors) |
| Frontend Components | 80%+ | Unit (React Testing Library) |
| End-to-End Flows | Key paths | Integration (full export workflow) |

### Test Commands

```bash
# Backend unit tests
pytest tests/unit/ -v --cov=src/mindflow --cov-report=html

# Backend integration tests
pytest tests/integration/ -v

# Frontend tests
cd frontend && npm run test

# Frontend with coverage
cd frontend && npm run test -- --coverage

# All tests
pytest tests/ -v && cd frontend && npm run test
```

### Manual Testing Checklist

Before marking feature complete:

- [ ] Export single node (all formats: MD/HTML/PDF)
- [ ] Export with ancestors (verify parent chain)
- [ ] Export with descendants (verify all children)
- [ ] Export full tree (ancestors + descendants)
- [ ] Depth limiting works (try 1, 5, 10 levels)
- [ ] File downloads in Chrome
- [ ] File downloads in Firefox
- [ ] File downloads in Safari
- [ ] File downloads in Edge
- [ ] Markdown opens in text editor
- [ ] HTML renders correctly in browser
- [ ] PDF opens in PDF reader
- [ ] Themes render correctly (light/dark/minimal)
- [ ] Large export (500+ nodes) completes
- [ ] Circular reference handled gracefully
- [ ] Error messages display correctly
- [ ] Size estimates are accurate

## Deployment Plan

### Pre-Deployment Checklist

- [ ] All tests passing (unit + integration)
- [ ] Code coverage > 85%
- [ ] API documentation complete (OpenAPI spec)
- [ ] Frontend build succeeds (`npm run build`)
- [ ] Manual testing complete (all browsers)
- [ ] Performance benchmarks met (< 2s single node, < 10s for 100 nodes)
- [ ] Security review (input sanitization, file size limits)
- [ ] Constitution compliance verified

### Deployment Steps

1. **Install Dependencies**
```bash
# Backend
pip install weasyprint markdown pymdown-extensions pypdf2

# Verify installations
python -c "import weasyprint; print('WeasyPrint OK')"
python -c "import markdown; print('Markdown OK')"
```

2. **Run Final Tests**
```bash
# Backend tests
pytest tests/ -v --cov=src/mindflow

# Frontend tests
cd frontend && npm run test && npm run build

# Integration smoke test
curl -X POST http://localhost:8000/api/exports/estimate \
  -H "Content-Type: application/json" \
  -d '{"node_id":"test","scope":"single","format":"markdown"}'
```

3. **Merge to Main**
```bash
git checkout 006-node-export
git pull origin main
git merge main
# Resolve conflicts if any
git push

# Create PR
gh pr create --title "feat: Node export to multiple formats (MD/HTML/PDF)" \
  --body "Implements feature 006-node-export. See specs/006-node-export/ for documentation."
```

4. **Restart Services**
```bash
# Use project restart script
./restart.sh  # or restart.bat on Windows

# Verify backend
curl http://localhost:8000/docs  # Check /api/exports endpoints

# Verify frontend
curl http://localhost:5173  # Check frontend loads
```

### Rollback Plan

If critical issues detected after deployment:

1. **Immediate**: Revert PR
```bash
git revert <commit-hash>
git push
./restart.sh
```

2. **Hotfix**: Fix issue in new branch, fast-track review
3. **Disable Feature**: Add feature flag to hide export menu option (if needed)

### Monitoring

After deployment, track:
- Export success rate (target: > 98%)
- Export latency by format (MD < 1s, HTML < 2s, PDF < 5s)
- Error rates by format
- Most used formats (prioritize optimizations)
- User feedback on quality

## Risk Assessment

### High Priority Risks

| Risk | Likelihood | Impact | Mitigation | Status |
|------|------------|--------|------------|--------|
| WeasyPrint fails on Windows | Medium | High | Test early on Windows, document installation, have pdfkit as backup | Monitor |
| Large exports crash browser | Low | High | Implement size limits (1000 nodes), async exports, streaming | Mitigated |
| PDF rendering too slow | Medium | Medium | Profile early, optimize CSS, consider caching | Monitor |

### Medium Priority Risks

| Risk | Likelihood | Impact | Mitigation | Status |
|------|------------|--------|------------|--------|
| Special characters break formatting | Medium | Medium | Comprehensive escaping, test edge cases | Mitigated |
| Circular references cause issues | Low | Medium | Cycle detection in traversal, tests for cycles | Mitigated |
| File download blocked by browser | Low | Medium | Test all browsers, ensure proper headers | Monitor |

### Low Priority Risks

| Risk | Likelihood | Impact | Mitigation | Status |
|------|------------|--------|------------|--------|
| Markdown not perfectly compatible | Low | Low | Use CommonMark standard, test with validators | Accepted |
| HTML not rendering in old browsers | Low | Low | Document browser requirements (modern browsers only) | Accepted |

## Reference Information

### Phase 0 Artifacts Summary

All research and design completed:

| Artifact | Lines | Status | Purpose |
|----------|-------|--------|---------|
| research.md | 1500+ | ✅ Complete | Technical research (PDF libs, tree traversal, optimization) |
| data-model.md | 1000+ | ✅ Complete | Complete data models (Python + TypeScript) |
| contracts/api-export.yaml | 400+ | ✅ Complete | OpenAPI 3.0 API specification |
| quickstart.md | 1200+ | ✅ Complete | Developer implementation guide |
| plan.md | 1400+ | ✅ Complete | This document (implementation roadmap) |

### Dependencies

**New Dependencies to Install**:

```bash
# Backend (add to pyproject.toml)
pip install weasyprint>=60.0       # PDF generation
pip install markdown>=3.5          # Markdown parsing
pip install pymdown-extensions>=10.7  # Markdown extensions
pip install pypdf2>=3.0            # PDF validation (dev only)

# Frontend (no new dependencies needed)
# Already have: axios, react, typescript, zustand
```

### Key Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Export Success Rate | > 98% | Log export outcomes, track failures |
| Single Node Export Time | < 2s | Backend timing logs |
| Large Export Time (100 nodes) | < 10s | Backend timing logs |
| PDF Export Time (100 nodes) | < 30s | Backend timing logs |
| Test Coverage | > 85% | `pytest --cov` + `npm run test -- --coverage` |
| API Response Time (p95) | < 500ms | API monitoring/logging |

### Timeline Summary

```
Week 1: Phase 1 - Core Export
├─ Day 1-2: Models + traversal (9h)
├─ Day 3: Markdown export (4h)
├─ Day 4: HTML + PDF export (9h)
└─ Day 5: API + frontend (10h)

Week 2: Phase 2 - Tree Export
├─ Day 1-2: Full tree + hierarchy (7h)
├─ Day 3: Size estimation (3h)
├─ Day 4: Frontend tree options (4h)
└─ Day 5: Integration testing (4h)

Week 3: Phase 3 - Polish
├─ Day 1-2: Async + themes (9h)
├─ Day 3: Options + optimization (8h)
└─ Day 4-5: Docs + testing (7h)
```

**Total Effort**: 70 hours over 3 weeks

## Complexity Tracking

> No constitution violations requiring justification.

All constitution principles are satisfied without additional complexity:
- Graph integrity maintained (read-only exports)
- LLM provider agnostic (no LLM dependencies)
- Explicit operations (user-triggered, visible options)
- Test-first approach (TDD for tree traversal)
- Context transparency (size estimates, warnings)
- Multiplatform support (WeasyPrint is pure Python)
- No simulation (real exports from real data)

## Next Steps

1. **Begin Phase 1**: Start with backend data models
2. **Install Dependencies**: WeasyPrint, Markdown, pymdown-extensions
3. **Create Branch**: `git checkout -b 006-node-export`
4. **Follow TDD**: Write tests first, then implement
5. **Refer to quickstart.md**: For detailed implementation guidance

**For Questions**: See quickstart.md, research.md, or data-model.md for technical details.

---

**Plan Status**: ✅ COMPLETE - Ready for Implementation
**Branch**: `006-node-export`
**Estimated Completion**: 3 weeks from start date
**Constitution Compliance**: ✅ All principles satisfied
