# Tasks: Node Export to Multiple Formats

**Feature Branch**: `006-node-export`
**Created**: 2025-11-21
**Status**: Ready for Implementation

---

## Overview

This document contains all implementation tasks for Feature 006: Node Export to Multiple Formats, organized into 7 phases with dependency tracking.

**Total Tasks**: 98
**Estimated Duration**: 3 weeks (70 hours)

**Task Format**: `- [ ] [TaskID] [P?] [Story?] Description`
- `[P]` = Can be parallelized with other [P] tasks in the same phase
- `[Story]` = US1, US2, US3, US4 (User Story number from spec.md)

---

## Dependencies

**User Story Dependencies**:
- **MVP**: US1 + US2 (single node export in all 3 formats)
- **US1** (P1) → **US2** (P1): Single node markdown must work before adding PDF/HTML
- **US1 + US2** → **US3** (P2): Tree export requires single node export working
- **US1 + US2 + US3** → **US4** (P2): Advanced options require base export working

**Phase Dependencies**:
- Phase 1 (Setup) → Phase 2 (Foundational)
- Phase 2 (Foundational) → Phase 3 (US1)
- Phase 3 (US1) → Phase 4 (US2)
- Phase 3 + Phase 4 → Phase 5 (US3)
- Phase 3 + Phase 4 + Phase 5 → Phase 6 (US4)
- All phases → Phase 7 (Polish & Cross-Cutting)

---

## Phase 1: Setup (6 tasks)

**Goal**: Install dependencies and create directory structure
**Duration**: 2 hours

- [ ] [T001] [P] Install Python backend dependencies (weasyprint>=60.0, markdown>=3.5, pymdown-extensions>=10.7, pypdf2>=3.0) via pip and verify imports
- [ ] [T002] [P] Create backend directory structure: src/mindflow/models/export.py, src/mindflow/services/export_service.py, src/mindflow/utils/exporters/, src/mindflow/utils/tree_traversal.py, src/mindflow/api/routes/exports.py
- [ ] [T003] [P] Create backend templates directory: src/mindflow/templates/export/ for Jinja2 HTML templates and CSS files
- [ ] [T004] [P] Create frontend directory structure: frontend/src/components/export/, frontend/src/hooks/useExport.ts, frontend/src/utils/fileDownload.ts, frontend/src/types/export.ts
- [ ] [T005] [P] Create test directory structure: tests/unit/test_export_models.py, tests/unit/test_markdown_exporter.py, tests/unit/test_html_exporter.py, tests/unit/test_pdf_exporter.py, tests/unit/test_tree_traversal.py, tests/integration/test_export_api.py
- [ ] [T006] Test WeasyPrint installation on both Windows and Linux, document any platform-specific installation issues in quickstart.md

---

## Phase 2: Foundational (15 tasks)

**Goal**: Core data models, types, and tree traversal utilities
**Duration**: 8 hours

### Backend Data Models (4 tasks)

- [ ] [T007] [P] Create ExportScope, ExportFormat, ExportStatus enums in src/mindflow/models/export.py
- [ ] [T008] [P] Create ExportRequest Pydantic model with validation, state transitions (mark_processing, mark_completed, mark_failed) in src/mindflow/models/export.py
- [ ] [T009] [P] Create ExportOptions Pydantic model with ExportTheme, FontSize enums, metadata toggles, and helper methods (should_include_toc, get_base_font_size_pt) in src/mindflow/models/export.py
- [ ] [T010] Create ExportedDocument Pydantic model with ExportMetadata, factory method (create_from_content), expiration logic (is_expired), download headers (get_download_headers) in src/mindflow/models/export.py

### Frontend TypeScript Types (3 tasks)

- [ ] [T011] [P] Create frontend enums (ExportScope, ExportFormat, ExportStatus, ExportTheme, FontSize) in frontend/src/types/export.ts
- [ ] [T012] [P] Create frontend interfaces (ExportRequest, ExportOptions, ExportedDocument, ExportMetadata, ExportCreateRequest, ExportResponse, ExportStatusResponse, ExportSizeEstimate) in frontend/src/types/export.ts
- [ ] [T013] Create frontend constants (DEFAULT_EXPORT_OPTIONS, EXPORT_FORMAT_LABELS, EXPORT_SCOPE_LABELS, EXPORT_THEME_LABELS) and helper functions (isExportCompleted, isExportFailed, isExportInProgress) in frontend/src/types/export.ts

### Tree Traversal (5 tasks)

- [ ] [T014] Create TraversalStrategy abstract base class with collect() method signature and visited set tracking in src/mindflow/utils/tree_traversal.py
- [ ] [T015] [P] Implement SingleNodeStrategy (returns only specified node) in src/mindflow/utils/tree_traversal.py
- [ ] [T016] [P] Implement AncestorChainStrategy with cycle detection (walk parent chain from node to root, return in root-first order) in src/mindflow/utils/tree_traversal.py
- [ ] [T017] [P] Implement DescendantDFSStrategy with depth limiting and cycle detection (pre-order DFS traversal of children) in src/mindflow/utils/tree_traversal.py
- [ ] [T018] Implement FullTreeStrategy (combines ancestors + descendants, removes duplicate start node) and TraversalStrategyFactory in src/mindflow/utils/tree_traversal.py

### Storage & Validation (3 tasks)

- [ ] [T019] [P] Create ExportStorage class for in-memory caching with 24h TTL (save_request, get_request, save_document, get_document, cleanup_expired) in src/mindflow/storage/export_storage.py
- [ ] [T020] [P] Create ExportValidator with validation rules (node exists, node count limits, depth limits, content validation) in src/mindflow/validators/export_validator.py
- [ ] [T021] Create API request/response models (ExportCreateRequest, ExportResponse, ExportStatusResponse, ExportSizeEstimate) in src/mindflow/models/export.py

---

## Phase 3: US1 - Single Node Markdown Export (P1 - MVP) (12 tasks)

**Goal**: Users can export a single node to Markdown format
**Duration**: 8 hours
**Independent Test**: Right-click node → Export → Select Markdown → Download .md file

### Markdown Exporter (3 tasks)

- [ ] [T022] Create MarkdownExporter base class with format_node() method signature in src/mindflow/utils/exporters/base_exporter.py
- [ ] [T023] [US1] Implement MarkdownExporter.export_single_node() with YAML front matter (title, author, date, tags), node type heading, content rendering in src/mindflow/utils/exporters/markdown_exporter.py
- [ ] [T024] [US1] Add special character escaping for Markdown (escape #, *, _, `, etc.) and code block formatting with syntax highlighting markers in src/mindflow/utils/exporters/markdown_exporter.py

### API Endpoint (3 tasks)

- [ ] [T025] [US1] Create POST /api/exports endpoint with request validation (node_id required, format validation) in src/mindflow/api/routes/exports.py
- [ ] [T026] [US1] Implement synchronous export flow: validate request → collect nodes (SingleNodeStrategy) → call MarkdownExporter → return file response with proper MIME type and headers in src/mindflow/api/routes/exports.py
- [ ] [T027] [US1] Add error handling for export failures (node not found, invalid format, export generation errors) with clear error messages in src/mindflow/api/routes/exports.py

### Frontend Components (5 tasks)

- [ ] [T028] [US1] [P] Create ExportDialog component with modal UI, format selector (radio buttons for MD/HTML/PDF), scope selector, export button in frontend/src/components/export/ExportDialog.tsx
- [ ] [T029] [US1] [P] Create FormatSelector component with format descriptions (Markdown: "Plain text, version control friendly", HTML: "Interactive, self-contained", PDF: "Print-ready, professional") in frontend/src/components/export/FormatSelector.tsx
- [ ] [T030] [US1] [P] Create file download utility using Blob API and temporary anchor element with proper filename generation (mindflow-{node-title}-{date}.md) in frontend/src/utils/fileDownload.ts
- [ ] [T031] [US1] Create export API service with POST /api/exports method using axios, proper error handling, and response type conversion in frontend/src/services/exportService.ts
- [ ] [T032] [US1] Integrate ExportDialog into node context menu (right-click) with "Export Node" option and proper state management (open/close dialog, selected node ID) in frontend/src/components/ContextMenu.tsx

### Testing (1 task)

- [ ] [T033] [US1] Test single node Markdown export end-to-end: create node → right-click → export Markdown → verify downloaded file has YAML front matter, proper heading, content, and valid Markdown syntax (run through markdownlint)

---

## Phase 4: US2 - Single Node PDF/HTML Export (P1 - MVP) (14 tasks)

**Goal**: Users can export single node to PDF and HTML formats
**Duration**: 10 hours
**Independent Test**: Export node to PDF → verify rendering, Export to HTML → verify styling

### HTML Exporter (4 tasks)

- [ ] [T034] [US2] [P] Create Jinja2 base template (node.html.j2) with HTML5 structure, embedded CSS, responsive layout, print media queries in src/mindflow/templates/export/node.html.j2
- [ ] [T035] [US2] [P] Create light theme CSS with professional styling (serif fonts for PDF, sans-serif for web, proper spacing, syntax highlighting for code blocks) in src/mindflow/templates/export/themes/light.css
- [ ] [T036] [US2] Implement HTMLExporter.export_single_node() with Jinja2 rendering, theme application, auto-escaping for HTML content in src/mindflow/utils/exporters/html_exporter.py
- [ ] [T037] [US2] Add metadata rendering in HTML template (author badge, timestamp, tags as pills, node type indicator) with conditional display based on options in src/mindflow/templates/export/node.html.j2

### PDF Exporter (4 tasks)

- [ ] [T038] [US2] Implement PDFExporter.export_single_node() using WeasyPrint with HTML-to-PDF conversion in src/mindflow/utils/exporters/pdf_exporter.py
- [ ] [T039] [US2] Add PDF-specific CSS with page setup (@page rules), headers/footers using CSS generated content (::before/::after), page numbers, margins in src/mindflow/templates/export/themes/pdf.css
- [ ] [T040] [US2] Implement professional typography for PDF (proper font sizes, line heights, orphan/widow control, hyphenation) in src/mindflow/templates/export/themes/pdf.css
- [ ] [T041] [US2] Add PDF metadata (document title, author, subject, creation date) using WeasyPrint API in src/mindflow/utils/exporters/pdf_exporter.py

### API Updates (2 tasks)

- [ ] [T042] [US2] Update POST /api/exports endpoint to support HTML and PDF formats with proper MIME types (text/html, application/pdf) and Content-Disposition headers in src/mindflow/api/routes/exports.py
- [ ] [T043] [US2] Add format-specific response handling (binary for PDF, text for HTML/Markdown) with proper encoding and byte conversion in src/mindflow/api/routes/exports.py

### Frontend Updates (2 tasks)

- [ ] [T044] [US2] Update FormatSelector component to include HTML and PDF options with icons and descriptions in frontend/src/components/export/FormatSelector.tsx
- [ ] [T045] [US2] Update file download utility to handle binary data (PDF) vs text data (Markdown/HTML) with proper Blob type detection in frontend/src/utils/fileDownload.ts

### Testing (2 tasks)

- [ ] [T046] [US2] Test single node HTML export: verify standalone file (no external dependencies), CSS embedded, opens correctly in Chrome/Firefox/Safari/Edge, proper styling applied
- [ ] [T047] [US2] Test single node PDF export on Windows and Linux: verify WeasyPrint generates valid PDF, headers/footers present, page numbers correct, opens in Adobe Reader/browser PDF viewer, content properly paginated

---

## Phase 5: US3 - Tree Export (P2) (16 tasks)

**Goal**: Users can export node trees (ancestors + descendants) in all formats
**Duration**: 12 hours
**Independent Test**: Right-click parent node → Export Tree → Select "Full tree" → Verify hierarchy in output

### Tree Traversal Enhancements (3 tasks)

- [ ] [T048] [US3] Add depth limiting to DescendantDFSStrategy (stop traversal when max_depth reached) and FullTreeStrategy with proper depth tracking in src/mindflow/utils/tree_traversal.py
- [ ] [T049] [US3] Enhance cycle detection with visited path tracking to identify and report circular references in export warnings in src/mindflow/utils/tree_traversal.py
- [ ] [T050] [US3] Add node ordering logic to preserve sibling order (use child_ids order from graph) and maintain stable tree structure in src/mindflow/utils/tree_traversal.py

### Size Estimation (3 tasks)

- [ ] [T051] [US3] Implement ExportSizeEstimate.estimate() with node count calculation, file size estimation (1KB/node for MD, 3KB for HTML, 10KB for PDF), processing time estimation in src/mindflow/models/export.py
- [ ] [T052] [US3] Add warning generation logic: large export warnings (>500 nodes), recommended depth limits (suggest depth=5 for >1000 nodes), format-specific warnings (PDF slow for >200 nodes) in src/mindflow/models/export.py
- [ ] [T053] [US3] Create POST /api/exports/estimate endpoint that runs traversal strategy, counts nodes, returns ExportSizeEstimate with warnings in src/mindflow/api/routes/exports.py

### Hierarchical Markdown Rendering (3 tasks)

- [ ] [T054] [US3] Implement hierarchical Markdown export with heading levels (# root, ## children, ### grandchildren) limited to 6 levels (h1-h6) in src/mindflow/utils/exporters/markdown_exporter.py
- [ ] [T055] [US3] Add automatic table of contents generation for Markdown exports with 10+ nodes using anchor links ([text](#anchor)) at document beginning in src/mindflow/utils/exporters/markdown_exporter.py
- [ ] [T056] [US3] Implement indentation for descendant trees as alternative to headings (configurable option) with proper nesting (2 spaces per level) in src/mindflow/utils/exporters/markdown_exporter.py

### Hierarchical HTML Rendering (3 tasks)

- [ ] [T057] [US3] Implement hierarchical HTML export with nested <section> elements, collapsible sections using <details>/<summary> tags in src/mindflow/utils/exporters/html_exporter.py
- [ ] [T058] [US3] Add table of contents generation for HTML with anchor navigation (<nav> with links to section IDs) and smooth scrolling CSS in src/mindflow/templates/export/node.html.j2
- [ ] [T059] [US3] Add visual hierarchy indicators in HTML (parent-child connectors, indentation, background shading for levels) using CSS in src/mindflow/templates/export/themes/light.css

### Hierarchical PDF Rendering (2 tasks)

- [ ] [T060] [US3] Implement hierarchical PDF export with bookmarks/outline using WeasyPrint bookmark API (target each heading as bookmark) in src/mindflow/utils/exporters/pdf_exporter.py
- [ ] [T061] [US3] Add page break controls for PDF (page-break-before for major sections, page-break-inside: avoid for nodes) in src/mindflow/templates/export/themes/pdf.css

### Frontend Tree Options (2 tasks)

- [ ] [T062] [US3] Create ExportOptionsPanel component with scope selector (radio buttons: Single/Ancestors/Descendants/Full Tree), depth slider (1-20 with labels), size estimate display in frontend/src/components/export/ExportOptionsPanel.tsx
- [ ] [T063] [US3] Integrate size estimation API call: when user changes scope/depth → call POST /api/exports/estimate → display warnings prominently (yellow warning box for >500 nodes) in frontend/src/components/export/ExportDialog.tsx

---

## Phase 6: US4 - Advanced Export Options (P2) (13 tasks)

**Goal**: Users can customize exports with themes, metadata toggles, font sizes
**Duration**: 10 hours
**Independent Test**: Export with dark theme → verify styling, Toggle off metadata → verify excluded from output

### Theme System (4 tasks)

- [ ] [T064] [US4] [P] Create dark theme CSS with dark background (#1e1e1e), light text (#e0e0e0), syntax highlighting for dark mode, reduced contrast for print in src/mindflow/templates/export/themes/dark.css
- [ ] [T065] [US4] [P] Create minimal theme CSS with no metadata rendering, simple typography, no decorations, optimized for content-only exports in src/mindflow/templates/export/themes/minimal.css
- [ ] [T066] [US4] Update HTMLExporter and PDFExporter to accept theme parameter and dynamically load corresponding CSS file in src/mindflow/utils/exporters/html_exporter.py and pdf_exporter.py
- [ ] [T067] [US4] Add theme selector to frontend with visual preview (light/dark/minimal with sample rendering) in frontend/src/components/export/ExportOptionsPanel.tsx

### Metadata Toggles (3 tasks)

- [ ] [T068] [US4] Implement metadata toggle controls in ExportOptions: include_metadata (master toggle), include_timestamps, include_author, include_tags in src/mindflow/models/export.py
- [ ] [T069] [US4] Update all exporters (Markdown, HTML, PDF) to conditionally render metadata based on ExportOptions toggles in src/mindflow/utils/exporters/
- [ ] [T070] [US4] Add metadata toggle UI with checkboxes (Master: Include Metadata, Sub: Timestamps, Author, Tags) with hierarchical disabling in frontend/src/components/export/ExportOptionsPanel.tsx

### Font Size Customization (2 tasks)

- [ ] [T071] [US4] Implement font size variants in CSS (small: 10pt base, medium: 11pt, large: 13pt) with scaling for all text elements (headings 1.5x-2.5x base) in src/mindflow/templates/export/themes/
- [ ] [T072] [US4] Add font size selector to frontend (radio buttons: Small/Medium/Large) with live preview indicator in frontend/src/components/export/ExportOptionsPanel.tsx

### Options Persistence (2 tasks)

- [ ] [T073] [US4] Implement localStorage persistence for export preferences (format, theme, font_size, metadata toggles) using JSON serialization in frontend/src/stores/exportStore.ts
- [ ] [T074] [US4] Add "Reset to Defaults" button in ExportOptionsPanel that clears localStorage and restores DEFAULT_EXPORT_OPTIONS in frontend/src/components/export/ExportOptionsPanel.tsx

### Advanced UI Polish (2 tasks)

- [ ] [T075] [US4] Add collapsible sections in ExportDialog for advanced options (initially collapsed, expand with "Advanced Options" button) in frontend/src/components/export/ExportDialog.tsx
- [ ] [T076] [US4] Create export preview mode (optional): show first 500 characters of generated content before download in modal preview pane in frontend/src/components/export/ExportDialog.tsx

---

## Phase 7: Polish & Cross-Cutting (22 tasks)

**Goal**: Production-ready with async exports, comprehensive error handling, security, performance
**Duration**: 20 hours

### Async Export for Large Documents (5 tasks)

- [ ] [T077] Create POST /api/exports/async endpoint that creates ExportRequest, stores in ExportStorage with status=PENDING, returns request_id immediately in src/mindflow/api/routes/exports.py
- [ ] [T078] Implement background task execution using FastAPI BackgroundTasks: mark_processing → run export → save to storage → mark_completed in src/mindflow/api/routes/exports.py
- [ ] [T079] Create GET /api/exports/{id}/status endpoint that returns ExportStatusResponse with progress_percent, status, download_url when completed in src/mindflow/api/routes/exports.py
- [ ] [T080] Create GET /api/exports/{id}/download endpoint that retrieves document from storage, returns file with proper headers, cleans up expired documents in src/mindflow/api/routes/exports.py
- [ ] [T081] Add POST /api/exports/{id}/cancel endpoint that marks request as CANCELLED and stops background task if possible in src/mindflow/api/routes/exports.py

### Error Handling & Validation (4 tasks)

- [ ] [T082] Implement comprehensive error handling: catch WeasyPrint errors (CSS rendering failures, font issues), Jinja2 errors (template syntax), file system errors (disk full, permissions) in src/mindflow/services/export_service.py
- [ ] [T083] Add input validation and sanitization: escape user-provided content for HTML injection prevention, validate file paths for path traversal attacks, enforce file size limits (max 50MB) in src/mindflow/validators/export_validator.py
- [ ] [T084] Create user-friendly error messages with suggested actions: "Node not found" → "Select a different node", "Export too large" → "Limit depth to 5 levels", "PDF rendering failed" → "Try HTML format instead" in frontend/src/components/export/ExportDialog.tsx
- [ ] [T085] Add export failure logging with full context (node_id, scope, format, error stack trace, timestamp) for debugging in src/mindflow/services/export_service.py

### Performance Optimization (4 tasks)

- [ ] [T086] Profile large exports (500+ nodes) to identify bottlenecks: measure time spent in traversal vs rendering vs PDF generation, optimize slowest operations in src/mindflow/services/export_service.py
- [ ] [T087] Optimize PDF generation: simplify CSS (remove unused rules), reduce image sizes (compress inline images), use faster fonts (system fonts instead of custom fonts) in src/mindflow/templates/export/themes/pdf.css
- [ ] [T088] Add export result caching: store export hash (MD5 of node_id + scope + options) → reuse cached document if same request within 1 hour in src/mindflow/storage/export_storage.py
- [ ] [T089] Implement streaming for large documents: use StreamingResponse for files >10MB to reduce memory usage in src/mindflow/api/routes/exports.py

### Security & Compliance (3 tasks)

- [ ] [T090] Add security headers to export responses: X-Content-Type-Options: nosniff, Content-Security-Policy for HTML exports (prevent script execution) in src/mindflow/api/routes/exports.py
- [ ] [T091] Implement file size limits and rate limiting: max 1000 nodes per export, max 5 exports per minute per user, return HTTP 429 if exceeded in src/mindflow/api/routes/exports.py
- [ ] [T092] Add copyright disclaimer footer to all exports: "Generated by MindFlow. AI-generated content - user responsible for copyright compliance." in all exporter templates

### Documentation (3 tasks)

- [ ] [T093] Complete API documentation: add docstrings to all public methods, update OpenAPI schema with examples, document error codes and status codes in src/mindflow/api/routes/exports.py
- [ ] [T094] Write user guide: create docs/user-guides/export-guide.md with screenshots showing how to export single node, tree export with depth limiting, customizing themes, troubleshooting common issues
- [ ] [T095] Write developer guide: create docs/developer-guides/export-architecture.md explaining exporter pattern, traversal strategies, adding new formats, extending themes

### Testing & Quality (3 tasks)

- [ ] [T096] Cross-browser testing: verify file downloads work in Chrome, Firefox, Safari, Edge on Windows/Mac, test various file sizes (1KB, 1MB, 10MB), test error scenarios (network failure mid-download)
- [ ] [T097] Integration testing: create tests/integration/test_export_flows.py with complete export flows (single node all formats, tree export all scopes, async export flow, size estimation accuracy, cancellation works)
- [ ] [T098] Performance benchmarking: measure and document export times (single node <2s, 100 nodes <10s, 500 nodes <30s), memory usage (<100MB for 500 nodes), file size accuracy (estimates within 20% of actual)

---

## Summary

**Total Tasks**: 98
**By Phase**:
- Phase 1 (Setup): 6 tasks
- Phase 2 (Foundational): 15 tasks
- Phase 3 (US1 - Markdown): 12 tasks
- Phase 4 (US2 - PDF/HTML): 14 tasks
- Phase 5 (US3 - Tree Export): 16 tasks
- Phase 6 (US4 - Advanced Options): 13 tasks
- Phase 7 (Polish): 22 tasks

**By User Story**:
- US1 (P1 - Single Node Markdown): 12 tasks (Phase 3)
- US2 (P1 - Single Node PDF/HTML): 14 tasks (Phase 4)
- US3 (P2 - Tree Export): 16 tasks (Phase 5)
- US4 (P2 - Advanced Options): 13 tasks (Phase 6)
- Cross-cutting/Setup: 43 tasks (Phases 1, 2, 7)

**Parallelization Opportunities**: 31 tasks marked [P] can be worked on in parallel within their phase

**Critical Path**: Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (Polish)

**MVP Completion**: After Phase 4 (US1 + US2 = single node export in all 3 formats)

---

## Implementation Notes

1. **Always Read Existing Code First**: Before creating any new file, use Glob/Grep to check if similar functionality exists
2. **Test Before Claiming Success**: All tasks must be tested with real output before marking complete
3. **No Hardcoded Paths**: Use pathlib.Path and configuration for all file paths
4. **Cross-Platform Support**: Test all file operations on both Windows and Linux
5. **Error Handling Required**: Every API endpoint and exporter must handle errors gracefully
6. **Type Safety**: Use Pydantic models (backend) and TypeScript types (frontend) for all data structures
7. **Documentation**: Update docstrings and comments as you implement each task

---

**Next Steps**:
1. Create feature branch: `git checkout -b 006-node-export`
2. Start with Phase 1 (Setup) tasks
3. Follow TDD approach for tree traversal (write tests first)
4. Refer to quickstart.md for detailed implementation guidance

**For Questions**: See spec.md, plan.md, data-model.md, or contracts/api-export.yaml for technical details.
