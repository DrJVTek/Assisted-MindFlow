# Quickstart Guide: Node Export Feature

**Feature**: 006-node-export
**Created**: 2025-11-21
**Target Audience**: Developers implementing the export feature

---

## Table of Contents

1. [Overview](#overview)
2. [5-Minute Setup](#5-minute-setup)
3. [Key Components](#key-components)
4. [Implementation Phases](#implementation-phases)
5. [Quick Reference](#quick-reference)
6. [Testing Checklist](#testing-checklist)
7. [Common Issues](#common-issues)
8. [Next Steps](#next-steps)

---

## Overview

### What This Feature Does

Allows users to export single nodes or entire reasoning trees to **Markdown**, **HTML**, or **PDF** formats with customizable styling and metadata.

**User Flow**:
```
User right-clicks node
  → Select "Export"
  → Choose format (MD/HTML/PDF)
  → Choose scope (single/ancestors/descendants/full tree)
  → Optional: Customize appearance
  → Click "Export"
  → File downloads automatically
```

### Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Backend** | Python 3.11, FastAPI | API endpoints, export generation |
| **PDF Generation** | WeasyPrint | HTML-to-PDF conversion |
| **Markdown** | Python-Markdown | Markdown formatting |
| **HTML Templates** | Jinja2 | HTML generation |
| **Frontend** | React, TypeScript | Export dialog, file download |
| **Testing** | Pytest, Vitest | Unit/integration tests |

### Key Files

```
Backend:
  src/mindflow/models/export_models.py          # Data models
  src/mindflow/services/export_service.py       # Business logic
  src/mindflow/services/markdown_export.py      # Markdown generation
  src/mindflow/services/html_export.py          # HTML generation
  src/mindflow/services/pdf_export.py           # PDF generation
  src/mindflow/utils/tree_traversal.py          # Tree traversal
  src/mindflow/api/routes/exports.py            # API endpoints

Frontend:
  frontend/src/types/export.ts                  # TypeScript types
  frontend/src/components/ExportDialog.tsx      # Export UI
  frontend/src/services/exportService.ts        # API client
  frontend/src/utils/fileDownload.ts            # Download utilities

Tests:
  tests/unit/test_markdown_export.py
  tests/unit/test_pdf_export.py
  tests/unit/test_html_export.py
  tests/unit/test_tree_traversal.py
  tests/integration/test_export_api.py
  frontend/src/components/__tests__/ExportDialog.test.tsx
```

---

## 5-Minute Setup

### Prerequisites

```bash
# Backend dependencies
pip install weasyprint markdown pymdown-extensions jinja2 pypdf2

# Frontend dependencies (already have what we need)
# axios, react, typescript
```

### Quick Start Commands

```bash
# 1. Create necessary directories
mkdir -p src/mindflow/services/templates
mkdir -p tests/unit
mkdir -p tests/integration

# 2. Run backend tests
pytest tests/unit/test_*_export.py -v

# 3. Run frontend tests
cd frontend
npm run test export

# 4. Start development servers
# Terminal 1: Backend
uvicorn src.mindflow.api.server:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev

# 5. Test export endpoint
curl -X POST http://localhost:8000/api/exports \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "test-node",
    "format": "markdown",
    "scope": "single"
  }'
```

### Verify Setup

1. **Backend Check**:
   ```bash
   python -c "import weasyprint; print('WeasyPrint:', weasyprint.__version__)"
   python -c "import markdown; print('Markdown:', markdown.__version__)"
   ```

2. **Frontend Check**:
   ```bash
   cd frontend
   npm list axios react typescript
   ```

3. **API Check**:
   ```bash
   curl http://localhost:8000/docs
   # Should show OpenAPI docs with /api/exports endpoints
   ```

---

## Key Components

### 1. Export Dialog (Frontend)

**Purpose**: UI for selecting export options

**Location**: `frontend/src/components/ExportDialog.tsx`

**Key Features**:
- Format selection (Markdown/HTML/PDF radio buttons)
- Scope selection (single/ancestors/descendants/full tree)
- Options panel (theme, metadata, depth limit)
- Size estimate display
- Progress indicator for large exports
- Error handling

**Usage**:
```tsx
import { ExportDialog } from './components/ExportDialog';

function Canvas() {
  const [exportNodeId, setExportNodeId] = useState<string | null>(null);

  const handleContextMenu = (nodeId: string) => {
    // ... other menu items
    if (action === 'export') {
      setExportNodeId(nodeId);
    }
  };

  return (
    <>
      {/* Canvas content */}
      {exportNodeId && (
        <ExportDialog
          nodeId={exportNodeId}
          onClose={() => setExportNodeId(null)}
        />
      )}
    </>
  );
}
```

### 2. Export Service (Backend)

**Purpose**: Orchestrate export generation

**Location**: `src/mindflow/services/export_service.py`

**Key Responsibilities**:
1. Validate export request
2. Collect nodes using traversal strategy
3. Delegate to format-specific exporter
4. Return generated document

**Code Skeleton**:
```python
class ExportService:
    def __init__(self, graph_service):
        self.graph_service = graph_service
        self.markdown_exporter = MarkdownExporter()
        self.html_exporter = HTMLExporter()
        self.pdf_exporter = PDFExporter()

    async def export_nodes(
        self,
        request: ExportCreateRequest
    ) -> ExportedDocument:
        # 1. Get node data
        nodes = await self._collect_nodes(request)

        # 2. Generate content
        if request.format == ExportFormat.MARKDOWN:
            content = self.markdown_exporter.export(nodes, request.options)
        elif request.format == ExportFormat.HTML:
            content = self.html_exporter.export(nodes, request.options)
        elif request.format == ExportFormat.PDF:
            content = self.pdf_exporter.export(nodes, request.options)

        # 3. Create document
        document = ExportedDocument.create_from_content(
            request_id=str(uuid.uuid4()),
            content=content,
            format=request.format,
            nodes=nodes,
            options=request.options
        )

        return document

    async def _collect_nodes(
        self,
        request: ExportCreateRequest
    ) -> List[Dict]:
        # Get all nodes from graph
        all_nodes = await self.graph_service.get_all_nodes()

        # Use traversal strategy
        factory = TraversalStrategyFactory()
        strategy = factory.create(request.scope, all_nodes)

        return strategy.collect(
            request.node_id,
            request.options.max_depth if request.options else None
        )
```

### 3. Tree Traversal (Backend)

**Purpose**: Collect nodes based on scope

**Location**: `src/mindflow/utils/tree_traversal.py`

**Strategies**:
- `SingleNodeStrategy`: Just the selected node
- `AncestorChainStrategy`: Root → ... → Parent → Node
- `DescendantDFSStrategy`: Node → Children → Grandchildren → ...
- `FullTreeStrategy`: Ancestors + Node + Descendants

**Usage**:
```python
from mindflow.utils.traversal_factory import TraversalStrategyFactory

# Get nodes for export
factory = TraversalStrategyFactory()
strategy = factory.create(ExportScope.WITH_DESCENDANTS, nodes_dict)
collected_nodes = strategy.collect(node_id, max_depth=5)
```

### 4. Format Exporters (Backend)

#### Markdown Exporter

**Location**: `src/mindflow/services/markdown_export.py`

**Output**:
```markdown
---
title: Export Title
exported: 2025-11-21T14:30:00
node_count: 3
---

# Export Title

## 1. Question: How to implement PDF export?

**Author:** alice@example.com | **Created:** 2025-11-21

How should we implement PDF export functionality?

## 2. Answer: Use WeasyPrint

**Author:** bob@example.com | **Created:** 2025-11-21

After research, WeasyPrint is the best choice...
```

#### HTML Exporter

**Location**: `src/mindflow/services/html_export.py`

**Features**:
- Embedded CSS (no external dependencies)
- Collapsible sections for large trees
- Table of contents with anchor links
- Theme support (light/dark/minimal)
- Syntax highlighting for code blocks

#### PDF Exporter

**Location**: `src/mindflow/services/pdf_export.py`

**Features**:
- Page headers/footers
- Page numbers
- Automatic pagination
- Professional typography
- Theme support

### 5. API Endpoints (Backend)

**Location**: `src/mindflow/api/routes/exports.py`

**Endpoints**:

```python
# Synchronous export (for small exports)
POST /api/exports
Body: { node_id, format, scope, options }
Returns: File (binary) with Content-Disposition header

# Size estimate (before export)
POST /api/exports/estimate
Body: { node_id, scope, format, max_depth }
Returns: { node_count, estimated_file_size_kb, warnings }

# Async export (for large exports)
POST /api/exports/async
Body: { node_id, format, scope, options }
Returns: { request_id, status, estimated_time_seconds }

# Check status
GET /api/exports/{request_id}/status
Returns: { status, progress_percent, download_url }

# Download
GET /api/exports/{request_id}/download
Returns: File (binary)

# Cancel
POST /api/exports/{request_id}/cancel
Returns: { message: "Export cancelled" }
```

---

## Implementation Phases

### Phase 1: Core Export (Week 1)

**Goal**: Single node export working in all formats

**Tasks**:
1. **Backend Models** (2 hours)
   - [ ] Create `export_models.py` with all Pydantic models
   - [ ] Add validation rules
   - [ ] Write model unit tests

2. **Tree Traversal** (3 hours)
   - [ ] Implement `SingleNodeStrategy`
   - [ ] Implement `AncestorChainStrategy`
   - [ ] Implement `DescendantDFSStrategy`
   - [ ] Add cycle detection
   - [ ] Write traversal tests

3. **Markdown Export** (4 hours)
   - [ ] Create `MarkdownExporter` class
   - [ ] Implement basic formatting
   - [ ] Add metadata rendering
   - [ ] Handle code blocks
   - [ ] Write markdown export tests

4. **HTML Export** (4 hours)
   - [ ] Create Jinja2 template
   - [ ] Create `HTMLExporter` class
   - [ ] Implement theme support
   - [ ] Add embedded CSS
   - [ ] Write HTML export tests

5. **PDF Export** (5 hours)
   - [ ] Install and configure WeasyPrint
   - [ ] Create `PDFExporter` class
   - [ ] Implement page headers/footers
   - [ ] Add pagination
   - [ ] Write PDF export tests

6. **API Endpoints** (4 hours)
   - [ ] Create `exports.py` routes file
   - [ ] Implement POST /api/exports
   - [ ] Add request validation
   - [ ] Add error handling
   - [ ] Write API integration tests

7. **Frontend Export Dialog** (6 hours)
   - [ ] Create `ExportDialog.tsx` component
   - [ ] Add format selection
   - [ ] Add scope selection
   - [ ] Implement file download
   - [ ] Write component tests

**Success Criteria**:
- ✓ User can export single node to MD/HTML/PDF
- ✓ Files download correctly in browser
- ✓ All tests pass
- ✓ API documented in OpenAPI spec

**Time Estimate**: 28 hours (~1 week)

### Phase 2: Tree Export (Week 2)

**Goal**: Export with ancestors/descendants working

**Tasks**:
1. **Traversal Strategies** (3 hours)
   - [ ] Implement `FullTreeStrategy`
   - [ ] Add depth limiting
   - [ ] Optimize for large trees
   - [ ] Write strategy tests

2. **Hierarchy Rendering** (4 hours)
   - [ ] Add indentation in markdown
   - [ ] Add tree visualization in HTML
   - [ ] Handle parent-child links
   - [ ] Show hierarchy in PDF

3. **Size Estimation** (3 hours)
   - [ ] Implement POST /api/exports/estimate
   - [ ] Add size warnings
   - [ ] Calculate processing time
   - [ ] Write estimation tests

4. **Frontend Tree Options** (4 hours)
   - [ ] Add ancestor/descendant checkboxes
   - [ ] Add depth limit slider
   - [ ] Show size estimate
   - [ ] Display warnings

5. **Integration Testing** (4 hours)
   - [ ] Test small trees (5-10 nodes)
   - [ ] Test medium trees (50-100 nodes)
   - [ ] Test large trees (500+ nodes)
   - [ ] Test circular references

**Success Criteria**:
- ✓ User can export full reasoning chains
- ✓ Hierarchy clearly represented
- ✓ Depth limiting works correctly
- ✓ Size estimates accurate

**Time Estimate**: 18 hours (~1 week)

### Phase 3: Polish & Optimization (Week 3)

**Goal**: Production-ready with customization

**Tasks**:
1. **Async Exports** (5 hours)
   - [ ] Implement POST /api/exports/async
   - [ ] Add progress tracking
   - [ ] Implement status endpoint
   - [ ] Add cancellation support

2. **Theme Customization** (4 hours)
   - [ ] Implement theme selector
   - [ ] Add dark theme CSS
   - [ ] Add minimal theme CSS
   - [ ] Test theme rendering

3. **Advanced Options** (4 hours)
   - [ ] Add metadata toggle
   - [ ] Add TOC toggle
   - [ ] Add font size selector
   - [ ] Remember user preferences

4. **Performance Optimization** (4 hours)
   - [ ] Profile large exports
   - [ ] Optimize PDF generation
   - [ ] Add streaming for huge exports
   - [ ] Cache common exports

5. **Documentation** (3 hours)
   - [ ] API documentation
   - [ ] User guide
   - [ ] Developer guide
   - [ ] Troubleshooting guide

6. **Final Testing** (4 hours)
   - [ ] Cross-browser testing
   - [ ] Large export testing
   - [ ] Error scenario testing
   - [ ] Performance benchmarking

**Success Criteria**:
- ✓ All customization options work
- ✓ Large exports (500+ nodes) complete in < 30s
- ✓ 90%+ test coverage
- ✓ Complete documentation

**Time Estimate**: 24 hours (~1 week)

---

## Quick Reference

### Export Request Example

```typescript
// Frontend: Trigger export
const request: ExportCreateRequest = {
  node_id: 'n-123e4567',
  format: ExportFormat.PDF,
  scope: ExportScope.WithDescendants,
  options: {
    theme: ExportTheme.Light,
    max_depth: 5,
    include_metadata: true,
    page_breaks: true
  }
};

const response = await exportService.exportNode(request);
// File downloads automatically
```

### Backend Export Example

```python
# Backend: Handle export request
@router.post("/api/exports")
async def create_export(request: ExportCreateRequest):
    # Validate
    validator = ExportValidator()
    is_valid, error = validator.validate_request(request)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Generate export
    service = ExportService(graph_service)
    document = await service.export_nodes(request)

    # Return file
    return Response(
        content=document.content,
        media_type=document.mime_type,
        headers=document.get_download_headers()
    )
```

### Common Code Patterns

#### 1. Adding New Export Format

```python
# 1. Add enum value
class ExportFormat(str, Enum):
    MARKDOWN = "markdown"
    HTML = "html"
    PDF = "pdf"
    DOCX = "docx"  # New format

# 2. Create exporter class
class DocxExporter:
    def export(self, nodes: List[Dict], options: ExportOptions) -> bytes:
        # Implementation
        pass

# 3. Add to service
class ExportService:
    def __init__(self):
        self.exporters = {
            ExportFormat.MARKDOWN: MarkdownExporter(),
            ExportFormat.HTML: HTMLExporter(),
            ExportFormat.PDF: PDFExporter(),
            ExportFormat.DOCX: DocxExporter()  # New
        }
```

#### 2. Adding Custom Traversal Strategy

```python
# 1. Create strategy class
class BreadthFirstStrategy(TraversalStrategy):
    def collect(self, node_id: str, max_depth: int = None) -> List[Dict]:
        # BFS implementation
        pass

# 2. Add to factory
class TraversalStrategyFactory:
    @staticmethod
    def create(scope: ExportScope, nodes: Dict) -> TraversalStrategy:
        strategies = {
            ExportScope.SINGLE: SingleNodeStrategy,
            ExportScope.BREADTH_FIRST: BreadthFirstStrategy  # New
        }
        return strategies[scope](nodes)
```

#### 3. Adding Export Option

```python
# 1. Add field to ExportOptions
class ExportOptions(BaseModel):
    # ... existing fields
    include_images: bool = Field(default=True)  # New option

# 2. Use in exporter
class MarkdownExporter:
    def export(self, nodes, options):
        if options.include_images:
            # Embed images
            pass
```

---

## Testing Checklist

### Unit Tests

- [ ] **Export Models**
  - [ ] ExportRequest validation
  - [ ] ExportOptions defaults
  - [ ] ExportedDocument creation
  - [ ] Enum value validation

- [ ] **Tree Traversal**
  - [ ] Single node collection
  - [ ] Ancestor chain (root to leaf)
  - [ ] Descendant tree (DFS order)
  - [ ] Full tree (ancestors + descendants)
  - [ ] Cycle detection
  - [ ] Depth limiting

- [ ] **Markdown Export**
  - [ ] Basic formatting
  - [ ] Metadata rendering
  - [ ] Code block formatting
  - [ ] Table of contents generation
  - [ ] Special character escaping

- [ ] **HTML Export**
  - [ ] Valid HTML structure
  - [ ] Embedded CSS
  - [ ] Theme rendering
  - [ ] Collapsible sections
  - [ ] Anchor links

- [ ] **PDF Export**
  - [ ] Valid PDF generation
  - [ ] Page headers/footers
  - [ ] Page numbers
  - [ ] Proper pagination
  - [ ] Theme support

### Integration Tests

- [ ] **API Endpoints**
  - [ ] POST /api/exports (success)
  - [ ] POST /api/exports (node not found)
  - [ ] POST /api/exports (validation error)
  - [ ] POST /api/exports/estimate
  - [ ] GET /api/exports/{id}/status
  - [ ] GET /api/exports/{id}/download

- [ ] **End-to-End**
  - [ ] Export single node → download file
  - [ ] Export with ancestors → verify hierarchy
  - [ ] Export with descendants → verify all children
  - [ ] Export large tree → check performance
  - [ ] Cancel export → verify cancellation

### Frontend Tests

- [ ] **ExportDialog Component**
  - [ ] Renders correctly
  - [ ] Format selection works
  - [ ] Scope selection works
  - [ ] Options panel works
  - [ ] Shows errors
  - [ ] Triggers download

- [ ] **Export Service**
  - [ ] API calls work
  - [ ] Error handling
  - [ ] Progress tracking
  - [ ] File download

### Manual Testing

- [ ] **Browser Compatibility**
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge

- [ ] **File Downloads**
  - [ ] Markdown opens in text editor
  - [ ] HTML opens in browser
  - [ ] PDF opens in PDF reader

- [ ] **Visual Quality**
  - [ ] Markdown is readable
  - [ ] HTML renders correctly
  - [ ] PDF looks professional

- [ ] **Edge Cases**
  - [ ] Empty nodes
  - [ ] Very long content (10,000+ words)
  - [ ] Special characters in content
  - [ ] Circular references in graph
  - [ ] Trees with 500+ nodes

---

## Common Issues

### Issue 1: WeasyPrint Installation Fails

**Symptom**: `pip install weasyprint` fails with C library errors

**Cause**: WeasyPrint requires system libraries (Pango, Cairo)

**Solution**:

Windows:
```bash
# Download GTK3 runtime from https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer
# Install, then:
pip install weasyprint
```

Linux (Ubuntu/Debian):
```bash
sudo apt-get install python3-dev libpango1.0-dev libcairo2-dev
pip install weasyprint
```

macOS:
```bash
brew install cairo pango gdk-pixbuf libffi
pip install weasyprint
```

**Alternative**: Use `pdfkit` with `wkhtmltopdf` (requires separate binary)

### Issue 2: PDF Generation Timeout

**Symptom**: PDF export hangs or times out for large documents

**Cause**: WeasyPrint is slow for complex layouts

**Solutions**:
1. **Increase timeout**: Set longer timeout for PDF generation
2. **Simplify layout**: Use simpler CSS (avoid complex flexbox/grid)
3. **Paginate**: Break large exports into multiple PDFs
4. **Use async**: Move to async export for large documents

```python
# Increase timeout
HTML(string=html).write_pdf('output.pdf', timeout=300)  # 5 minutes

# Or use async
@router.post("/api/exports/async")
async def create_async_export(request):
    # Process in background
    background_tasks.add_task(generate_pdf, request)
```

### Issue 3: Special Characters Break Markdown

**Symptom**: Markdown contains raw HTML or breaks formatting

**Cause**: Node content contains markdown special characters (`, *, #, etc.)

**Solution**: Properly escape content

```python
import html

def escape_markdown(text: str) -> str:
    """Escape markdown special characters."""
    # For code blocks, use fences
    if '```' not in text:
        text = text.replace('`', '\\`')

    # Escape other special chars in normal text
    for char in ['*', '_', '#', '[', ']']:
        text = text.replace(char, '\\' + char)

    return text
```

### Issue 4: File Download Doesn't Work in Browser

**Symptom**: Export API returns data but file doesn't download

**Cause**: Missing or incorrect Content-Disposition header

**Solution**: Ensure proper headers

```python
# Backend
return Response(
    content=pdf_bytes,
    media_type='application/pdf',
    headers={
        'Content-Disposition': 'attachment; filename="export.pdf"',
        'Content-Type': 'application/pdf'
    }
)

# Frontend
const response = await axios.post('/api/exports', request, {
    responseType: 'blob'  // IMPORTANT: Tell axios to expect binary data
});

// Create download
const url = URL.createObjectURL(response.data);
const link = document.createElement('a');
link.href = url;
link.download = 'export.pdf';
link.click();
URL.revokeObjectURL(url);
```

### Issue 5: Large Tree Export Crashes

**Symptom**: Browser or server crashes when exporting 500+ nodes

**Cause**: Memory exhaustion from loading all nodes at once

**Solutions**:

1. **Add node limit**:
```python
MAX_EXPORT_NODES = 1000

if node_count > MAX_EXPORT_NODES:
    raise HTTPException(
        status_code=413,
        detail=f"Export exceeds limit ({MAX_EXPORT_NODES} nodes)"
    )
```

2. **Use streaming**:
```python
@router.get("/api/exports/{id}/stream")
async def stream_export(id: str):
    async def generate():
        for chunk in get_export_chunks(id):
            yield chunk

    return StreamingResponse(generate(), media_type="text/markdown")
```

3. **Enforce depth limits**:
```python
if scope in [ExportScope.WITH_DESCENDANTS, ExportScope.FULL_TREE]:
    if not options.max_depth:
        options.max_depth = 10  # Default limit
```

### Issue 6: HTML Export Styles Not Working

**Symptom**: HTML file displays unstyled content

**Cause**: CSS not embedded or external stylesheet not found

**Solution**: Ensure CSS is inline

```python
# Bad: External stylesheet
<link rel="stylesheet" href="styles.css">

# Good: Embedded CSS
<style>
  /* All CSS here */
  body { font-family: sans-serif; }
</style>
```

---

## Next Steps

### After Implementation

1. **Performance Testing**
   - Benchmark export times for various sizes
   - Profile memory usage
   - Optimize bottlenecks

2. **User Feedback**
   - Beta test with real users
   - Collect feedback on UI/UX
   - Iterate on design

3. **Documentation**
   - Write user guide with screenshots
   - Create video tutorials
   - Document API thoroughly

4. **Monitoring**
   - Add export metrics (count, format distribution, sizes)
   - Monitor error rates
   - Track performance over time

### Future Enhancements (Not in MVP)

1. **Batch Export**: Export multiple nodes at once
2. **Export Templates**: Pre-configured styles (academic, business, etc.)
3. **Cloud Storage**: Save directly to Dropbox/Google Drive
4. **Email Sharing**: Email exported files directly
5. **Export Scheduling**: Automated periodic exports
6. **LaTeX Export**: For academic papers
7. **Word Export**: .docx format
8. **Print Preview**: Preview before exporting

---

## Additional Resources

### Documentation

- [research.md](./research.md) - Detailed technical research
- [data-model.md](./data-model.md) - Complete data model specifications
- [contracts/api-export.yaml](./contracts/api-export.yaml) - API contract
- [spec.md](./spec.md) - Feature specification

### External References

- [WeasyPrint Docs](https://doc.courtbouillon.org/weasyprint/stable/)
- [Python-Markdown Docs](https://python-markdown.github.io/)
- [Jinja2 Docs](https://jinja.palletsprojects.com/)
- [FastAPI Response Docs](https://fastapi.tiangolo.com/advanced/custom-response/)
- [MDN Blob API](https://developer.mozilla.org/en-US/docs/Web/API/Blob)

### Support

For questions or issues:
1. Check this quickstart guide
2. Review research.md for technical details
3. Check common issues section above
4. Consult API documentation
5. Ask team for help

---

**Quickstart Guide Version**: 1.0
**Last Updated**: 2025-11-21
**Status**: Ready for implementation
