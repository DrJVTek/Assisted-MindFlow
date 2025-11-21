# Research Document: Node Export to Multiple Formats

**Feature**: 006-node-export
**Created**: 2025-11-21
**Last Updated**: 2025-11-21
**Status**: Phase 0 - Research Complete

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Export Format Research](#export-format-research)
3. [PDF Generation in Python](#pdf-generation-in-python)
4. [Markdown Formatting](#markdown-formatting)
5. [HTML Export with CSS](#html-export-with-css)
6. [Tree Traversal Algorithms](#tree-traversal-algorithms)
7. [File Download in React](#file-download-in-react)
8. [Large Document Optimization](#large-document-optimization)
9. [Testing Export Formats](#testing-export-formats)
10. [Security Considerations](#security-considerations)
11. [Technology Recommendations](#technology-recommendations)
12. [Implementation Strategy](#implementation-strategy)

---

## Executive Summary

This research document provides comprehensive analysis for implementing node export functionality in the MindFlow application. The feature enables users to export single nodes or entire reasoning trees to Markdown, PDF, and HTML formats with proper formatting, navigation, and metadata preservation.

**Key Findings**:
- **PDF Generation**: WeasyPrint recommended for HTML-to-PDF conversion (CSS Paged Media support)
- **Markdown**: Python-Markdown with extensions for tables, code blocks, and TOC generation
- **HTML**: Jinja2 templating with embedded CSS for standalone files
- **Tree Traversal**: Depth-first with cycle detection for DAG-based graph structures
- **File Downloads**: Blob URLs with Content-Disposition headers for browser downloads
- **Performance**: Streaming responses for large documents (500+ nodes)

**Technology Stack**:
- Backend: Python 3.11, FastAPI, WeasyPrint, Jinja2, Python-Markdown
- Frontend: React, TypeScript, Axios, Blob API
- Testing: Pytest, Vitest, PDF validators

---

## Export Format Research

### Overview

Export functionality requires three distinct output formats, each serving different use cases:

| Format | Primary Use Case | Advantages | Limitations |
|--------|------------------|------------|-------------|
| **Markdown** | Technical documentation, version control | Plain text, portable, editable | Limited styling, no complex layouts |
| **PDF** | Presentations, formal reports, printing | Professional appearance, fixed layout | Not editable, larger file size |
| **HTML** | Interactive viewing, web sharing | Rich interactivity, hyperlinks, collapsible sections | Requires browser to view |

### Format Selection Criteria

**Markdown Best For**:
- Developers and technical users
- Content that will be version-controlled
- Simple documentation without complex formatting
- Scenarios where editability is important
- Integration with wikis or documentation systems

**PDF Best For**:
- Stakeholder presentations
- Formal business reports
- Printed materials
- Distribution to non-technical audiences
- Legal or compliance documentation (immutable records)

**HTML Best For**:
- Complex non-linear tree structures
- Interactive navigation (collapsible sections, anchor links)
- Self-contained sharing (single file with embedded assets)
- Rich media content (images, videos, interactive elements)

### Format Comparison: Technical Details

#### File Size Considerations

```python
# Typical file sizes for 100-node export
MARKDOWN_SIZE = "50-100 KB"   # Plain text, minimal overhead
HTML_SIZE = "200-500 KB"       # Includes CSS, JavaScript
PDF_SIZE = "500 KB - 2 MB"     # Embedded fonts, rendered graphics
```

#### Content Preservation

| Feature | Markdown | HTML | PDF |
|---------|----------|------|-----|
| Text formatting | Partial (bold, italic, code) | Full | Full |
| Hyperlinks | Yes (clickable) | Yes (clickable) | Yes (clickable in viewers) |
| Images | Linked or base64 | Embedded base64 | Embedded |
| Tables | Yes (limited) | Yes (full CSS) | Yes (full layout) |
| Code syntax highlighting | Partial | Yes (with libraries) | Yes (rendered) |
| Interactive elements | No | Yes (JS) | No |
| Page breaks | No | Yes (CSS page-break) | Yes |
| Table of contents | Manual | Auto-generated (JS) | Auto-generated (bookmarks) |

---

## PDF Generation in Python

### Library Comparison

#### 1. WeasyPrint (RECOMMENDED)

**Overview**: Converts HTML/CSS to PDF using W3C standards for CSS Paged Media.

**Advantages**:
- Standards-compliant CSS support (Flexbox, Grid)
- Excellent typography (font embedding, ligatures)
- CSS Paged Media Module support (page breaks, headers/footers)
- Pure Python implementation (no system dependencies for basic use)
- Actively maintained

**Disadvantages**:
- Slower than native libraries (acceptable for typical use cases)
- Memory usage scales with document complexity
- Limited JavaScript support (static rendering only)

**Installation**:
```bash
pip install weasyprint
```

**Basic Usage**:
```python
from weasyprint import HTML, CSS

# From HTML string
html_content = "<html><body><h1>Node Export</h1></body></html>"
HTML(string=html_content).write_pdf(
    'output.pdf',
    stylesheets=[CSS(string='@page { size: A4; margin: 2cm }')]
)

# From HTML file
HTML('template.html').write_pdf('output.pdf')

# With custom fonts
from weasyprint.text.fonts import FontConfiguration
font_config = FontConfiguration()
css = CSS(string='''
    @font-face {
        font-family: 'Custom';
        src: url('fonts/custom.ttf');
    }
    body { font-family: 'Custom', sans-serif; }
''', font_config=font_config)
HTML(string=html_content).write_pdf('output.pdf', stylesheets=[css])
```

**Advanced Features**:
```python
# Page headers and footers
css_paged = CSS(string='''
    @page {
        size: A4;
        margin: 2cm 1.5cm;
        @top-center {
            content: "MindFlow Export - " string(title);
            font-size: 10pt;
            color: #666;
        }
        @bottom-right {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 9pt;
        }
    }

    @page :first {
        @top-center { content: none; }
    }

    /* Prevent breaks inside elements */
    .node-content {
        page-break-inside: avoid;
    }

    /* Force breaks before major sections */
    h1 {
        page-break-before: always;
    }

    /* Keep headings with following content */
    h2, h3 {
        page-break-after: avoid;
    }
''')
```

**Performance Optimization**:
```python
from weasyprint import HTML, CSS
from io import BytesIO

# Generate to memory buffer (faster than file I/O)
buffer = BytesIO()
HTML(string=html_content).write_pdf(buffer, stylesheets=[css])
pdf_bytes = buffer.getvalue()

# For large documents, consider chunking
def generate_pdf_chunked(nodes, chunk_size=50):
    """Generate PDF in chunks to manage memory."""
    chunks = [nodes[i:i+chunk_size] for i in range(0, len(nodes), chunk_size)]
    pdf_parts = []

    for chunk in chunks:
        html = render_nodes_to_html(chunk)
        buffer = BytesIO()
        HTML(string=html).write_pdf(buffer)
        pdf_parts.append(buffer.getvalue())

    # Merge PDFs (requires PyPDF2 or similar)
    return merge_pdfs(pdf_parts)
```

#### 2. ReportLab

**Overview**: Low-level PDF generation library with fine-grained control.

**Advantages**:
- Very fast rendering
- Precise control over layout
- Low memory footprint
- Good for programmatic generation (charts, reports)

**Disadvantages**:
- Requires manual layout management (no HTML/CSS)
- Steeper learning curve
- More code for complex documents

**Use Case**: Best for structured reports with fixed layouts (not ideal for markdown-like content).

```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

# Manual layout required
doc = SimpleDocTemplate("output.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = []

story.append(Paragraph("Node Title", styles['Heading1']))
story.append(Spacer(1, 12))
story.append(Paragraph("Node content...", styles['BodyText']))

doc.build(story)
```

**Verdict**: Too low-level for our use case. WeasyPrint's HTML-to-PDF is more maintainable.

#### 3. pdfkit (wkhtmltopdf wrapper)

**Overview**: Python wrapper for wkhtmltopdf (WebKit-based HTML-to-PDF).

**Advantages**:
- Excellent CSS/JavaScript support
- Fast rendering
- Mature and stable

**Disadvantages**:
- Requires external system dependency (wkhtmltopdf binary)
- wkhtmltopdf is no longer actively maintained
- Cross-platform installation complexity
- Not Python-native (harder to deploy)

**Installation**:
```bash
# Install system dependency first
# Ubuntu: sudo apt-get install wkhtmltopdf
# Windows: Download from wkhtmltopdf.org
# macOS: brew install wkhtmltopdf

pip install pdfkit
```

**Usage**:
```python
import pdfkit

# From HTML string
pdfkit.from_string('<h1>Title</h1>', 'output.pdf')

# With options
options = {
    'page-size': 'A4',
    'margin-top': '0.75in',
    'margin-right': '0.75in',
    'margin-bottom': '0.75in',
    'margin-left': '0.75in',
    'encoding': "UTF-8",
    'no-outline': None,
    'enable-local-file-access': None
}
pdfkit.from_string(html, 'output.pdf', options=options)
```

**Verdict**: External dependency violates project principles (prefer pure Python). WeasyPrint is better choice.

### Recommended Approach: WeasyPrint

**Rationale**:
1. Pure Python (no system dependencies for basic usage)
2. Excellent CSS support (modern standards)
3. Good documentation and active maintenance
4. Meets performance requirements (< 10s for 100 nodes)
5. Works cross-platform (Windows + Linux)

**Implementation Pattern**:
```python
# src/mindflow/services/pdf_export.py
from weasyprint import HTML, CSS
from typing import List, Dict, Any
from io import BytesIO

class PDFExporter:
    """Generate PDF exports from node data."""

    BASE_CSS = CSS(string='''
        @page {
            size: A4;
            margin: 2.5cm 2cm;
            @top-center {
                content: "MindFlow Reasoning Export";
                font-size: 10pt;
                color: #666;
            }
            @bottom-right {
                content: "Page " counter(page);
                font-size: 9pt;
            }
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
        }

        h1 {
            color: #2c3e50;
            font-size: 20pt;
            margin-top: 24pt;
            page-break-after: avoid;
        }

        h2 {
            color: #34495e;
            font-size: 16pt;
            margin-top: 18pt;
            page-break-after: avoid;
        }

        h3 {
            color: #546e7a;
            font-size: 14pt;
            margin-top: 14pt;
            page-break-after: avoid;
        }

        .node-content {
            page-break-inside: avoid;
            margin-bottom: 12pt;
            padding: 8pt;
            border-left: 3px solid #3498db;
            background-color: #f8f9fa;
        }

        .metadata {
            font-size: 9pt;
            color: #7f8c8d;
            font-style: italic;
            margin-bottom: 6pt;
        }

        code {
            font-family: 'Consolas', 'Monaco', monospace;
            background-color: #ecf0f1;
            padding: 2pt 4pt;
            border-radius: 3pt;
            font-size: 10pt;
        }

        pre {
            background-color: #2c3e50;
            color: #ecf0f1;
            padding: 12pt;
            border-radius: 4pt;
            overflow-x: auto;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 9pt;
            page-break-inside: avoid;
        }

        .node-tree {
            margin-left: 20pt;
            border-left: 2px solid #bdc3c7;
            padding-left: 12pt;
        }
    ''')

    def export_nodes(
        self,
        nodes: List[Dict[str, Any]],
        title: str = "Node Export",
        theme: str = "light"
    ) -> bytes:
        """
        Export nodes to PDF format.

        Args:
            nodes: List of node dictionaries with content and metadata
            title: Document title
            theme: Visual theme (light, dark, minimal)

        Returns:
            PDF file content as bytes
        """
        html_content = self._render_html(nodes, title, theme)
        css = self._get_theme_css(theme)

        # Generate PDF to memory buffer
        buffer = BytesIO()
        HTML(string=html_content).write_pdf(
            buffer,
            stylesheets=[self.BASE_CSS, css]
        )

        return buffer.getvalue()

    def _render_html(
        self,
        nodes: List[Dict[str, Any]],
        title: str,
        theme: str
    ) -> str:
        """Render nodes to HTML structure."""
        # Implementation in HTML Export section
        pass

    def _get_theme_css(self, theme: str) -> CSS:
        """Get CSS for specified theme."""
        if theme == "dark":
            return CSS(string='''
                body { background-color: #1e1e1e; color: #d4d4d4; }
                h1, h2, h3 { color: #569cd6; }
                .node-content {
                    background-color: #252526;
                    border-left-color: #569cd6;
                }
            ''')
        elif theme == "minimal":
            return CSS(string='''
                .metadata { display: none; }
                .node-content {
                    border: none;
                    background-color: transparent;
                    padding: 0;
                }
            ''')
        return CSS(string='')  # Default (light theme)
```

---

## Markdown Formatting

### Markdown Specification

**CommonMark vs GitHub Flavored Markdown (GFM)**:

| Feature | CommonMark | GFM | Choice |
|---------|------------|-----|--------|
| Basic syntax | ✓ | ✓ | Use GFM |
| Tables | ✗ | ✓ | Need tables |
| Task lists | ✗ | ✓ | Not needed |
| Strikethrough | ✗ | ✓ | Nice to have |
| Autolinks | Limited | ✓ | Useful |
| Fenced code blocks | ✓ | ✓ | Essential |

**Recommendation**: Use **GitHub Flavored Markdown (GFM)** for maximum compatibility and feature richness.

### Python-Markdown Library

**Installation**:
```bash
pip install markdown
pip install pymdown-extensions  # Additional extensions
```

**Basic Usage**:
```python
import markdown

md = markdown.Markdown(extensions=['extra', 'codehilite', 'toc'])
html = md.convert('# Hello\n\nThis is **markdown**.')
```

**Recommended Extensions**:
```python
import markdown

MARKDOWN_EXTENSIONS = [
    'markdown.extensions.extra',        # Tables, footnotes, definition lists
    'markdown.extensions.codehilite',   # Syntax highlighting
    'markdown.extensions.toc',          # Table of contents generation
    'markdown.extensions.meta',         # Metadata in front matter
    'markdown.extensions.nl2br',        # Newline to <br>
    'markdown.extensions.sane_lists',   # Better list handling
    'markdown.extensions.smarty',       # Smart quotes and dashes
    'pymdownx.superfences',             # Better code fences
    'pymdownx.magiclink',               # Auto-link URLs
    'pymdownx.betterem',                # Better emphasis handling
]

md = markdown.Markdown(extensions=MARKDOWN_EXTENSIONS)
```

### Markdown Export Implementation

```python
# src/mindflow/services/markdown_export.py
from typing import List, Dict, Any, Optional
from datetime import datetime
import re

class MarkdownExporter:
    """Generate Markdown exports from node data."""

    def export_nodes(
        self,
        nodes: List[Dict[str, Any]],
        title: str = "Node Export",
        include_metadata: bool = True,
        include_toc: bool = True
    ) -> str:
        """
        Export nodes to Markdown format.

        Args:
            nodes: List of node dictionaries
            title: Document title
            include_metadata: Include node metadata (author, timestamps)
            include_toc: Generate table of contents for multi-node exports

        Returns:
            Markdown-formatted string
        """
        parts = []

        # Front matter
        parts.append(self._generate_frontmatter(title, nodes))

        # Title
        parts.append(f"# {title}\n")

        # Metadata
        if include_metadata:
            parts.append(self._generate_document_metadata(nodes))

        # Table of contents (for large exports)
        if include_toc and len(nodes) >= 10:
            parts.append(self._generate_toc(nodes))

        # Node content
        for i, node in enumerate(nodes, 1):
            parts.append(self._render_node(node, i, include_metadata))

        # Footer
        parts.append(self._generate_footer())

        return '\n\n'.join(parts)

    def _generate_frontmatter(self, title: str, nodes: List[Dict]) -> str:
        """Generate YAML front matter."""
        return f"""---
title: {title}
exported: {datetime.now().isoformat()}
node_count: {len(nodes)}
generator: MindFlow v1.0.0
---"""

    def _generate_document_metadata(self, nodes: List[Dict]) -> str:
        """Generate document-level metadata."""
        authors = set(n.get('author', 'Unknown') for n in nodes)
        node_types = set(n.get('type', 'node') for n in nodes)

        return f"""**Export Information:**
- Nodes: {len(nodes)}
- Authors: {', '.join(sorted(authors))}
- Node Types: {', '.join(sorted(node_types))}
- Export Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

    def _generate_toc(self, nodes: List[Dict]) -> str:
        """Generate table of contents."""
        toc_lines = ["## Table of Contents\n"]

        for i, node in enumerate(nodes, 1):
            node_type = node.get('type', 'node')
            content_preview = self._get_content_preview(node.get('content', ''))
            anchor = self._create_anchor(i, content_preview)

            toc_lines.append(f"{i}. [{node_type.capitalize()}: {content_preview}](#{anchor})")

        return '\n'.join(toc_lines)

    def _render_node(
        self,
        node: Dict[str, Any],
        index: int,
        include_metadata: bool
    ) -> str:
        """Render a single node to markdown."""
        parts = []

        # Node header
        node_type = node.get('type', 'node')
        content_preview = self._get_content_preview(node.get('content', ''))
        parts.append(f"## {index}. {node_type.capitalize()}: {content_preview}")

        # Node metadata
        if include_metadata:
            metadata = []
            if 'author' in node:
                metadata.append(f"**Author:** {node['author']}")
            if 'created_at' in node:
                metadata.append(f"**Created:** {node['created_at']}")
            if 'tags' in node and node['tags']:
                metadata.append(f"**Tags:** {', '.join(node['tags'])}")
            if 'importance' in node:
                metadata.append(f"**Importance:** {node['importance']}/5")

            if metadata:
                parts.append('_' + ' | '.join(metadata) + '_')

        # Node content
        content = node.get('content', '')
        # Escape markdown special characters if needed
        content = self._process_content(content)
        parts.append(content)

        # Node relationships (if exporting tree)
        if 'children' in node and node['children']:
            parts.append(f"**Children:** {len(node['children'])} nodes")
        if 'parent' in node and node['parent']:
            parts.append(f"**Parent:** Node {node['parent']}")

        return '\n\n'.join(parts)

    def _get_content_preview(self, content: str, max_length: int = 50) -> str:
        """Get short preview of content for headings."""
        # Remove markdown formatting
        preview = re.sub(r'[#*_\[\]`]', '', content)
        # Take first line
        preview = preview.split('\n')[0].strip()
        # Truncate
        if len(preview) > max_length:
            preview = preview[:max_length] + '...'
        return preview or 'Untitled'

    def _create_anchor(self, index: int, content_preview: str) -> str:
        """Create markdown anchor from content."""
        # GitHub-style anchor creation
        anchor = content_preview.lower()
        anchor = re.sub(r'[^\w\s-]', '', anchor)
        anchor = re.sub(r'[\s]+', '-', anchor)
        return f"{index}-{anchor}"

    def _process_content(self, content: str) -> str:
        """Process node content for markdown export."""
        # Already markdown-formatted content can pass through
        # Add any necessary escaping here

        # Ensure code blocks are properly fenced
        content = self._ensure_code_fences(content)

        return content

    def _ensure_code_fences(self, content: str) -> str:
        """Ensure code blocks use proper fencing."""
        # Convert indented code blocks to fenced blocks if needed
        # This is optional - depends on source content format
        return content

    def _generate_footer(self) -> str:
        """Generate export footer."""
        return f"""---

*Exported from MindFlow at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*

*This document was automatically generated. Do not edit directly - regenerate from source.*
"""


# Example usage:
def example_export():
    nodes = [
        {
            'id': 'n1',
            'type': 'question',
            'content': 'How should we implement PDF export?',
            'author': 'alice@example.com',
            'created_at': '2025-11-21T10:00:00Z',
            'tags': ['export', 'pdf'],
            'importance': 4
        },
        {
            'id': 'n2',
            'type': 'answer',
            'content': '''After researching options, WeasyPrint is the best choice:

- Pure Python (no external dependencies)
- Excellent CSS support
- Good performance

```python
from weasyprint import HTML
HTML(string=html).write_pdf('output.pdf')
```

This meets all our requirements.''',
            'author': 'bob@example.com',
            'created_at': '2025-11-21T10:15:00Z',
            'parent': 'n1',
            'tags': ['export', 'pdf', 'weasyprint']
        }
    ]

    exporter = MarkdownExporter()
    markdown = exporter.export_nodes(
        nodes,
        title="PDF Export Research",
        include_metadata=True,
        include_toc=False
    )

    print(markdown)
```

**Expected Output**:
```markdown
---
title: PDF Export Research
exported: 2025-11-21T14:30:00
node_count: 2
generator: MindFlow v1.0.0
---

# PDF Export Research

**Export Information:**
- Nodes: 2
- Authors: alice@example.com, bob@example.com
- Node Types: answer, question
- Export Date: 2025-11-21 14:30:00

## 1. Question: How should we implement PDF export?

_**Author:** alice@example.com | **Created:** 2025-11-21T10:00:00Z | **Tags:** export, pdf | **Importance:** 4/5_

How should we implement PDF export?

**Children:** 1 nodes

## 2. Answer: After researching options, WeasyPrint is the ...

_**Author:** bob@example.com | **Created:** 2025-11-21T10:15:00Z | **Tags:** export, pdf, weasyprint_

After researching options, WeasyPrint is the best choice:

- Pure Python (no external dependencies)
- Excellent CSS support
- Good performance

```python
from weasyprint import HTML
HTML(string=html).write_pdf('output.pdf')
```

This meets all our requirements.

**Parent:** Node n1

---

*Exported from MindFlow at 2025-11-21 14:30:00*

*This document was automatically generated. Do not edit directly - regenerate from source.*
```

### Advanced Markdown Features

#### Syntax Highlighting in Code Blocks

```python
# Add language identifiers to code blocks
def format_code_block(code: str, language: str = '') -> str:
    """Format code with syntax highlighting."""
    return f"```{language}\n{code}\n```"

# Example:
python_code = "def hello():\n    print('world')"
formatted = format_code_block(python_code, 'python')
```

#### Collapsible Sections (HTML in Markdown)

```python
def create_collapsible_section(title: str, content: str) -> str:
    """Create collapsible section using HTML details tag."""
    return f"""<details>
<summary>{title}</summary>

{content}

</details>"""

# Use for large tree exports to keep readable
```

#### Inline Images (Base64 Encoding)

```python
import base64

def embed_image_base64(image_path: str) -> str:
    """Embed image as base64 in markdown."""
    with open(image_path, 'rb') as f:
        img_data = base64.b64encode(f.read()).decode()

    ext = image_path.split('.')[-1]
    mime_type = f"image/{ext}"

    return f"![Image](data:{mime_type};base64,{img_data})"
```

---

## HTML Export with CSS

### Template Engine: Jinja2

**Why Jinja2**:
- Already available in FastAPI ecosystem
- Powerful templating with inheritance
- Good security (auto-escaping)
- Easy to maintain separate templates for different layouts

**Installation**:
```bash
pip install jinja2
```

### HTML Export Implementation

```python
# src/mindflow/services/html_export.py
from jinja2 import Environment, FileSystemLoader, select_autoescape
from typing import List, Dict, Any
from pathlib import Path
import base64

class HTMLExporter:
    """Generate HTML exports from node data."""

    def __init__(self, template_dir: str = None):
        """Initialize with template directory."""
        if template_dir is None:
            template_dir = Path(__file__).parent / 'templates'

        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(['html', 'xml'])
        )

        # Register custom filters
        self.env.filters['markdown'] = self._markdown_filter
        self.env.filters['format_date'] = self._format_date_filter

    def export_nodes(
        self,
        nodes: List[Dict[str, Any]],
        title: str = "Node Export",
        theme: str = "light",
        interactive: bool = True
    ) -> str:
        """
        Export nodes to standalone HTML.

        Args:
            nodes: List of node dictionaries
            title: Document title
            theme: Visual theme (light, dark, minimal)
            interactive: Include JavaScript for collapsible sections

        Returns:
            Complete HTML document as string
        """
        template = self.env.get_template('node_export.html')

        return template.render(
            title=title,
            nodes=nodes,
            theme=theme,
            interactive=interactive,
            export_date=datetime.now(),
            node_count=len(nodes)
        )

    def _markdown_filter(self, text: str) -> str:
        """Convert markdown to HTML."""
        import markdown
        md = markdown.Markdown(extensions=['extra', 'codehilite'])
        return md.convert(text)

    def _format_date_filter(self, date_str: str) -> str:
        """Format date string."""
        try:
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return dt.strftime('%B %d, %Y at %I:%M %p')
        except:
            return date_str
```

### HTML Template Structure

```html
<!-- src/mindflow/services/templates/node_export.html -->
<!DOCTYPE html>
<html lang="en" data-theme="{{ theme }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }} - MindFlow Export</title>

    <style>
        /* CSS Variables for theming */
        :root[data-theme="light"] {
            --bg-primary: #ffffff;
            --bg-secondary: #f8f9fa;
            --bg-code: #f4f4f4;
            --text-primary: #2c3e50;
            --text-secondary: #7f8c8d;
            --border-color: #dee2e6;
            --accent-color: #3498db;
            --link-color: #2980b9;
        }

        :root[data-theme="dark"] {
            --bg-primary: #1e1e1e;
            --bg-secondary: #252526;
            --bg-code: #2d2d30;
            --text-primary: #d4d4d4;
            --text-secondary: #a0a0a0;
            --border-color: #3c3c3c;
            --accent-color: #569cd6;
            --link-color: #4fc3f7;
        }

        :root[data-theme="minimal"] {
            --bg-primary: #ffffff;
            --bg-secondary: #ffffff;
            --bg-code: #f9f9f9;
            --text-primary: #000000;
            --text-secondary: #666666;
            --border-color: #e0e0e0;
            --accent-color: #000000;
            --link-color: #000000;
        }

        /* Reset and base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
                         Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background-color: var(--bg-primary);
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
        }

        /* Header */
        header {
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 1.5rem;
            margin-bottom: 2rem;
        }

        h1 {
            font-size: 2.5rem;
            color: var(--text-primary);
            margin-bottom: 0.5rem;
        }

        .export-meta {
            color: var(--text-secondary);
            font-size: 0.9rem;
        }

        /* Table of Contents */
        .toc {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 1.5rem;
            margin: 2rem 0;
        }

        .toc h2 {
            font-size: 1.5rem;
            margin-bottom: 1rem;
            color: var(--text-primary);
        }

        .toc ul {
            list-style: none;
            padding-left: 1rem;
        }

        .toc li {
            margin: 0.5rem 0;
        }

        .toc a {
            color: var(--link-color);
            text-decoration: none;
            transition: color 0.2s;
        }

        .toc a:hover {
            color: var(--accent-color);
            text-decoration: underline;
        }

        /* Node cards */
        .node {
            background-color: var(--bg-secondary);
            border-left: 4px solid var(--accent-color);
            border-radius: 8px;
            padding: 1.5rem;
            margin: 2rem 0;
            transition: box-shadow 0.2s;
        }

        .node:hover {
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .node-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
        }

        .node-title {
            font-size: 1.5rem;
            color: var(--text-primary);
            margin-bottom: 0.5rem;
        }

        .node-type {
            background-color: var(--accent-color);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .node-metadata {
            color: var(--text-secondary);
            font-size: 0.85rem;
            margin-bottom: 1rem;
            padding: 0.5rem;
            background-color: var(--bg-primary);
            border-radius: 4px;
        }

        .node-content {
            color: var(--text-primary);
            line-height: 1.8;
        }

        .node-content h1,
        .node-content h2,
        .node-content h3 {
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
        }

        .node-content p {
            margin: 0.75rem 0;
        }

        .node-content ul,
        .node-content ol {
            margin: 0.75rem 0;
            padding-left: 2rem;
        }

        .node-content code {
            background-color: var(--bg-code);
            color: var(--text-primary);
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.9em;
        }

        .node-content pre {
            background-color: var(--bg-code);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 1rem;
            overflow-x: auto;
            margin: 1rem 0;
        }

        .node-content pre code {
            background-color: transparent;
            padding: 0;
        }

        /* Tree structure for hierarchical exports */
        .node-tree {
            margin-left: 2rem;
            border-left: 2px dashed var(--border-color);
            padding-left: 1rem;
        }

        /* Collapsible sections */
        details {
            margin: 1rem 0;
        }

        summary {
            cursor: pointer;
            font-weight: 600;
            color: var(--accent-color);
            padding: 0.5rem;
            background-color: var(--bg-secondary);
            border-radius: 4px;
            user-select: none;
        }

        summary:hover {
            background-color: var(--border-color);
        }

        /* Footer */
        footer {
            border-top: 2px solid var(--border-color);
            padding-top: 1.5rem;
            margin-top: 3rem;
            text-align: center;
            color: var(--text-secondary);
            font-size: 0.9rem;
        }

        /* Print styles */
        @media print {
            body {
                max-width: 100%;
                padding: 0;
            }

            .node {
                page-break-inside: avoid;
                box-shadow: none;
            }

            summary {
                display: none;
            }

            details {
                display: block;
            }

            details[open] {
                display: block;
            }
        }
    </style>

    {% if interactive %}
    <script>
        // Interactive features
        document.addEventListener('DOMContentLoaded', function() {
            // Add collapse/expand all buttons
            addCollapseButtons();

            // Add copy buttons to code blocks
            addCopyButtons();

            // Add smooth scrolling
            addSmoothScrolling();
        });

        function addCollapseButtons() {
            const toc = document.querySelector('.toc');
            if (!toc) return;

            const buttonContainer = document.createElement('div');
            buttonContainer.style.marginTop = '1rem';

            const expandBtn = createButton('Expand All', () => {
                document.querySelectorAll('details').forEach(d => d.open = true);
            });

            const collapseBtn = createButton('Collapse All', () => {
                document.querySelectorAll('details').forEach(d => d.open = false);
            });

            buttonContainer.appendChild(expandBtn);
            buttonContainer.appendChild(collapseBtn);
            toc.appendChild(buttonContainer);
        }

        function createButton(text, onClick) {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.onclick = onClick;
            btn.style.cssText = `
                padding: 0.5rem 1rem;
                margin: 0.25rem;
                background-color: var(--accent-color);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9rem;
            `;
            return btn;
        }

        function addCopyButtons() {
            document.querySelectorAll('pre code').forEach(block => {
                const btn = document.createElement('button');
                btn.textContent = 'Copy';
                btn.style.cssText = `
                    position: absolute;
                    top: 0.5rem;
                    right: 0.5rem;
                    padding: 0.25rem 0.5rem;
                    background-color: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8rem;
                `;

                const pre = block.parentElement;
                pre.style.position = 'relative';
                pre.appendChild(btn);

                btn.onclick = () => {
                    navigator.clipboard.writeText(block.textContent);
                    btn.textContent = 'Copied!';
                    setTimeout(() => btn.textContent = 'Copy', 2000);
                };
            });
        }

        function addSmoothScrolling() {
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function(e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });
        }
    </script>
    {% endif %}
</head>
<body>
    <header>
        <h1>{{ title }}</h1>
        <div class="export-meta">
            <span>Exported: {{ export_date | format_date }}</span> |
            <span>{{ node_count }} nodes</span> |
            <span>Generated by MindFlow</span>
        </div>
    </header>

    {% if nodes|length >= 5 %}
    <nav class="toc">
        <h2>Table of Contents</h2>
        <ul>
            {% for node in nodes %}
            <li>
                <a href="#node-{{ loop.index }}">
                    {{ loop.index }}. {{ node.type|capitalize }}:
                    {{ node.content[:50] }}{% if node.content|length > 50 %}...{% endif %}
                </a>
            </li>
            {% endfor %}
        </ul>
    </nav>
    {% endif %}

    <main>
        {% for node in nodes %}
        <article class="node" id="node-{{ loop.index }}">
            <div class="node-header">
                <h2 class="node-title">
                    {{ loop.index }}. {{ node.content[:50] }}{% if node.content|length > 50 %}...{% endif %}
                </h2>
                <span class="node-type">{{ node.type }}</span>
            </div>

            {% if theme != 'minimal' %}
            <div class="node-metadata">
                {% if node.author %}
                <span>Author: {{ node.author }}</span> |
                {% endif %}
                {% if node.created_at %}
                <span>Created: {{ node.created_at | format_date }}</span>
                {% endif %}
                {% if node.tags %}
                | <span>Tags: {{ node.tags|join(', ') }}</span>
                {% endif %}
            </div>
            {% endif %}

            <div class="node-content">
                {{ node.content | markdown | safe }}
            </div>

            {% if node.children and node.children|length > 0 %}
            <details open>
                <summary>Children ({{ node.children|length }})</summary>
                <div class="node-tree">
                    {% for child in node.children %}
                    <div style="margin: 0.5rem 0;">
                        <a href="#node-{{ child.index }}">→ {{ child.type|capitalize }}: {{ child.preview }}</a>
                    </div>
                    {% endfor %}
                </div>
            </details>
            {% endif %}
        </article>
        {% endfor %}
    </main>

    <footer>
        <p>This document was automatically generated by MindFlow.</p>
        <p>Do not edit directly - regenerate from source to preserve changes.</p>
    </footer>
</body>
</html>
```

### Standalone HTML Requirements

**Self-Contained File**:
- All CSS embedded in `<style>` tag (no external stylesheets)
- All JavaScript embedded in `<script>` tag (no external scripts)
- Images embedded as base64 data URIs (no external image files)
- No external font dependencies (use system fonts)

**Benefits**:
- Single file can be shared/emailed
- Works offline
- No broken links or missing assets
- Opens directly in any browser

---

## Tree Traversal Algorithms

### Graph Structure in MindFlow

MindFlow uses a DAG (Directed Acyclic Graph) structure, but circular references may exist:

```python
# Node structure
class Node:
    id: str
    type: str  # question, answer, hypothesis, etc.
    content: str
    parent_id: Optional[str]  # Single parent (for tree structure)
    child_ids: List[str]       # Multiple children
    edge_ids: List[str]        # Manual edges (may create cycles)
```

### Traversal Algorithms

#### 1. Depth-First Search (DFS) - Recommended

**Use Cases**:
- Export node with all ancestors (linear chain)
- Export node with all descendants (full subtree)
- Natural for hierarchical representation

**Implementation with Cycle Detection**:
```python
# src/mindflow/utils/tree_traversal.py
from typing import List, Dict, Set, Optional, Callable
from collections import defaultdict

class TreeTraverser:
    """Traverse graph structures with cycle detection."""

    def __init__(self, nodes: Dict[str, Dict]):
        """
        Initialize traverser with node data.

        Args:
            nodes: Dictionary mapping node_id -> node_dict
        """
        self.nodes = nodes
        self.visited: Set[str] = set()
        self.path: List[str] = []  # Current path (for cycle detection)

    def get_ancestors(self, node_id: str) -> List[Dict]:
        """
        Get all ancestors from node to root (linear chain).

        Returns nodes in order: [root, ..., parent, current_node]
        """
        ancestors = []
        current_id = node_id
        visited = set()

        while current_id and current_id not in visited:
            if current_id not in self.nodes:
                break

            node = self.nodes[current_id]
            ancestors.append(node)
            visited.add(current_id)

            # Move to parent
            current_id = node.get('parent_id')

        # Reverse to get root-to-leaf order
        return list(reversed(ancestors))

    def get_descendants_dfs(
        self,
        node_id: str,
        max_depth: Optional[int] = None
    ) -> List[Dict]:
        """
        Get all descendants using depth-first search.

        Args:
            node_id: Starting node
            max_depth: Maximum depth to traverse (None = unlimited)

        Returns:
            List of nodes in DFS order (pre-order traversal)
        """
        result = []
        self.visited = set()
        self._dfs_descendants(node_id, result, depth=0, max_depth=max_depth)
        return result

    def _dfs_descendants(
        self,
        node_id: str,
        result: List[Dict],
        depth: int,
        max_depth: Optional[int]
    ):
        """Recursive DFS helper."""
        # Check max depth
        if max_depth is not None and depth > max_depth:
            return

        # Check if already visited (cycle detection)
        if node_id in self.visited:
            return

        # Check if node exists
        if node_id not in self.nodes:
            return

        # Mark as visited
        self.visited.add(node_id)
        node = self.nodes[node_id]
        result.append(node)

        # Recurse on children
        for child_id in node.get('child_ids', []):
            self._dfs_descendants(child_id, result, depth + 1, max_depth)

    def get_full_tree(
        self,
        node_id: str,
        max_depth: Optional[int] = None
    ) -> List[Dict]:
        """
        Get ancestors + node + descendants (full reasoning tree).

        Returns nodes in hierarchical order maintaining tree structure.
        """
        # Get ancestors
        ancestors = self.get_ancestors(node_id)

        # Get descendants (starting from current node)
        descendants = self.get_descendants_dfs(node_id, max_depth)

        # Combine (removing duplicate of current node)
        full_tree = ancestors[:-1] + descendants

        return full_tree

    def detect_cycles(self) -> List[List[str]]:
        """
        Detect all cycles in the graph.

        Returns:
            List of cycles, where each cycle is a list of node IDs
        """
        cycles = []
        visited = set()
        rec_stack = set()  # Recursion stack for cycle detection

        def dfs_cycle_detection(node_id: str, path: List[str]):
            visited.add(node_id)
            rec_stack.add(node_id)
            path.append(node_id)

            if node_id not in self.nodes:
                rec_stack.remove(node_id)
                return

            for child_id in self.nodes[node_id].get('child_ids', []):
                if child_id not in visited:
                    dfs_cycle_detection(child_id, path[:])
                elif child_id in rec_stack:
                    # Found cycle
                    cycle_start = path.index(child_id)
                    cycle = path[cycle_start:] + [child_id]
                    cycles.append(cycle)

            rec_stack.remove(node_id)

        # Check all nodes (graph may be disconnected)
        for node_id in self.nodes:
            if node_id not in visited:
                dfs_cycle_detection(node_id, [])

        return cycles


# Example usage
def example_traversal():
    # Sample graph
    nodes = {
        'root': {
            'id': 'root',
            'type': 'question',
            'content': 'What is the problem?',
            'parent_id': None,
            'child_ids': ['n1', 'n2']
        },
        'n1': {
            'id': 'n1',
            'type': 'hypothesis',
            'content': 'Maybe it is X',
            'parent_id': 'root',
            'child_ids': ['n3']
        },
        'n2': {
            'id': 'n2',
            'type': 'hypothesis',
            'content': 'Maybe it is Y',
            'parent_id': 'root',
            'child_ids': []
        },
        'n3': {
            'id': 'n3',
            'type': 'evaluation',
            'content': 'Testing hypothesis X',
            'parent_id': 'n1',
            'child_ids': []
        }
    }

    traverser = TreeTraverser(nodes)

    # Get ancestors of n3
    ancestors = traverser.get_ancestors('n3')
    print("Ancestors of n3:", [n['id'] for n in ancestors])
    # Output: ['root', 'n1', 'n3']

    # Get descendants of root
    descendants = traverser.get_descendants_dfs('root')
    print("Descendants of root:", [n['id'] for n in descendants])
    # Output: ['root', 'n1', 'n3', 'n2']

    # Get full tree from n1
    full_tree = traverser.get_full_tree('n1')
    print("Full tree from n1:", [n['id'] for n in full_tree])
    # Output: ['root', 'n1', 'n3']

    # Detect cycles (none in this example)
    cycles = traverser.detect_cycles()
    print("Cycles:", cycles)
    # Output: []
```

#### 2. Breadth-First Search (BFS)

**Use Cases**:
- Level-by-level export (show all siblings before children)
- Better for wide shallow trees
- Useful for generating table of contents

**Implementation**:
```python
from collections import deque

def get_descendants_bfs(
    nodes: Dict[str, Dict],
    node_id: str,
    max_depth: Optional[int] = None
) -> List[Dict]:
    """Get all descendants using breadth-first search."""
    result = []
    visited = set()
    queue = deque([(node_id, 0)])  # (node_id, depth)

    while queue:
        current_id, depth = queue.popleft()

        # Check max depth
        if max_depth is not None and depth > max_depth:
            continue

        # Check if already visited
        if current_id in visited:
            continue

        # Check if node exists
        if current_id not in nodes:
            continue

        # Process node
        visited.add(current_id)
        node = nodes[current_id]
        result.append(node)

        # Add children to queue
        for child_id in node.get('child_ids', []):
            if child_id not in visited:
                queue.append((child_id, depth + 1))

    return result
```

### Hierarchical Representation

For tree exports, maintain hierarchy information:

```python
from typing import TypedDict

class HierarchicalNode(TypedDict):
    """Node with hierarchy metadata."""
    node: Dict
    depth: int
    parent_index: Optional[int]
    child_indices: List[int]

def build_hierarchical_structure(
    nodes: List[Dict]
) -> List[HierarchicalNode]:
    """
    Build hierarchical structure from flat node list.

    Adds depth and index information for rendering.
    """
    node_index = {node['id']: i for i, node in enumerate(nodes)}
    hierarchy = []

    for i, node in enumerate(nodes):
        parent_id = node.get('parent_id')
        parent_index = node_index.get(parent_id) if parent_id else None

        child_indices = [
            node_index[cid]
            for cid in node.get('child_ids', [])
            if cid in node_index
        ]

        # Calculate depth
        depth = 0
        current = node
        while current.get('parent_id'):
            depth += 1
            parent = nodes[node_index[current['parent_id']]]
            current = parent

        hierarchy.append({
            'node': node,
            'depth': depth,
            'parent_index': parent_index,
            'child_indices': child_indices
        })

    return hierarchy


# Use in exports:
def render_with_hierarchy(nodes: List[Dict]) -> str:
    """Render nodes with indentation based on hierarchy."""
    hierarchy = build_hierarchical_structure(nodes)
    lines = []

    for item in hierarchy:
        indent = '  ' * item['depth']
        node = item['node']
        lines.append(f"{indent}- {node['type']}: {node['content'][:50]}")

    return '\n'.join(lines)
```

---

## File Download in React

### Browser Download Mechanisms

#### 1. Blob URLs (Recommended for Generated Content)

**Advantages**:
- Works for any file type
- No server round-trip needed
- Good for dynamically generated content

**Implementation**:
```typescript
// frontend/src/utils/fileDownload.ts

/**
 * Download file from string content using Blob API
 */
export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string = 'text/plain'
): void {
  // Create blob from content
  const blob = new Blob([content], { type: mimeType });

  // Create temporary URL
  const url = URL.createObjectURL(blob);

  // Create hidden link and click it
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download binary file from ArrayBuffer
 */
export function downloadBinaryFile(
  data: ArrayBuffer,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * MIME types for different export formats
 */
export const EXPORT_MIME_TYPES = {
  markdown: 'text/markdown',
  html: 'text/html',
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain'
} as const;

/**
 * Generate appropriate filename with timestamp
 */
export function generateExportFilename(
  nodeTitle: string,
  format: 'markdown' | 'html' | 'pdf',
  includeTimestamp: boolean = true
): string {
  // Sanitize title
  const sanitized = nodeTitle
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);

  // Add timestamp
  const timestamp = includeTimestamp
    ? `-${new Date().toISOString().split('T')[0]}`
    : '';

  // File extension
  const extensions = { markdown: 'md', html: 'html', pdf: 'pdf' };
  const ext = extensions[format];

  return `${sanitized}${timestamp}.${ext}`;
}

// Example usage:
// downloadTextFile(markdown, 'export.md', EXPORT_MIME_TYPES.markdown);
```

#### 2. Server Response with Content-Disposition

**Advantages**:
- Handles large files better (streaming)
- Server can optimize generation
- Better for complex formats (PDF)

**Backend Implementation**:
```python
# src/mindflow/api/routes/exports.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, StreamingResponse
from typing import Literal
import io

router = APIRouter(prefix="/api/exports", tags=["exports"])

@router.post("/nodes/{node_id}/export")
async def export_node(
    node_id: str,
    format: Literal["markdown", "html", "pdf"],
    include_ancestors: bool = False,
    include_descendants: bool = False,
    max_depth: Optional[int] = None
) -> Response:
    """
    Export node to specified format.

    Returns file content with appropriate Content-Disposition header.
    """
    # Get node data
    nodes = await get_export_nodes(
        node_id,
        include_ancestors,
        include_descendants,
        max_depth
    )

    if not nodes:
        raise HTTPException(status_code=404, detail="Node not found")

    # Generate export
    if format == "markdown":
        content = generate_markdown(nodes)
        media_type = "text/markdown"
        extension = "md"
    elif format == "html":
        content = generate_html(nodes)
        media_type = "text/html"
        extension = "html"
    elif format == "pdf":
        content = generate_pdf(nodes)  # Returns bytes
        media_type = "application/pdf"
        extension = "pdf"
    else:
        raise HTTPException(status_code=400, detail="Invalid format")

    # Generate filename
    node_title = nodes[0].get('content', 'export')[:30]
    filename = f"mindflow-{node_title}-{node_id[:8]}.{extension}"

    # Return with download headers
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.get("/nodes/{node_id}/export/stream")
async def export_node_stream(
    node_id: str,
    format: Literal["markdown", "html", "pdf"]
) -> StreamingResponse:
    """
    Stream large exports.

    Useful for very large trees (500+ nodes).
    """
    async def generate_chunks():
        nodes = await get_export_nodes(node_id, True, True)

        if format == "markdown":
            async for chunk in stream_markdown(nodes):
                yield chunk
        elif format == "html":
            async for chunk in stream_html(nodes):
                yield chunk
        # PDF is harder to stream - generate in memory

    return StreamingResponse(
        generate_chunks(),
        media_type="text/markdown" if format == "markdown" else "text/html"
    )
```

**Frontend Implementation**:
```typescript
// frontend/src/services/exportService.ts
import axios from 'axios';
import { downloadBinaryFile, generateExportFilename } from '../utils/fileDownload';

export interface ExportOptions {
  format: 'markdown' | 'html' | 'pdf';
  includeAncestors: boolean;
  includeDescendants: boolean;
  maxDepth?: number;
}

export async function exportNode(
  nodeId: string,
  options: ExportOptions
): Promise<void> {
  try {
    const response = await axios.post(
      `/api/exports/nodes/${nodeId}/export`,
      {
        format: options.format,
        include_ancestors: options.includeAncestors,
        include_descendants: options.includeDescendants,
        max_depth: options.maxDepth
      },
      {
        responseType: 'blob'  // Important for binary data
      }
    );

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'];
    let filename = generateExportFilename('export', options.format);

    if (contentDisposition) {
      const matches = /filename="([^"]+)"/.exec(contentDisposition);
      if (matches && matches[1]) {
        filename = matches[1];
      }
    }

    // Download file
    const blob = response.data;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Export failed:', error);
    throw new Error('Failed to export node');
  }
}

// With progress tracking
export async function exportNodeWithProgress(
  nodeId: string,
  options: ExportOptions,
  onProgress: (progress: number) => void
): Promise<void> {
  try {
    const response = await axios.post(
      `/api/exports/nodes/${nodeId}/export`,
      {
        format: options.format,
        include_ancestors: options.includeAncestors,
        include_descendants: options.includeDescendants,
        max_depth: options.maxDepth
      },
      {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        }
      }
    );

    // Download logic...

  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}
```

### React Component Implementation

```typescript
// frontend/src/components/ExportDialog.tsx
import React, { useState } from 'react';
import { exportNode, ExportOptions } from '../services/exportService';

interface ExportDialogProps {
  nodeId: string;
  onClose: () => void;
}

export function ExportDialog({ nodeId, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'markdown' | 'html' | 'pdf'>('markdown');
  const [includeAncestors, setIncludeAncestors] = useState(false);
  const [includeDescendants, setIncludeDescendants] = useState(false);
  const [maxDepth, setMaxDepth] = useState<number | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      await exportNode(nodeId, {
        format,
        includeAncestors,
        includeDescendants,
        maxDepth
      });

      onClose();
    } catch (err) {
      setError('Export failed. Please try again.');
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-dialog">
      <h2>Export Node</h2>

      <div className="form-group">
        <label>Format:</label>
        <select value={format} onChange={(e) => setFormat(e.target.value as any)}>
          <option value="markdown">Markdown (.md)</option>
          <option value="html">HTML (.html)</option>
          <option value="pdf">PDF (.pdf)</option>
        </select>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={includeAncestors}
            onChange={(e) => setIncludeAncestors(e.target.checked)}
          />
          Include ancestors (parent chain)
        </label>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={includeDescendants}
            onChange={(e) => setIncludeDescendants(e.target.checked)}
          />
          Include descendants (children)
        </label>
      </div>

      {includeDescendants && (
        <div className="form-group">
          <label>Max depth (leave empty for unlimited):</label>
          <input
            type="number"
            min="1"
            value={maxDepth || ''}
            onChange={(e) => setMaxDepth(e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <div className="dialog-actions">
        <button onClick={onClose} disabled={isExporting}>
          Cancel
        </button>
        <button onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
    </div>
  );
}
```

---

## Large Document Optimization

### Performance Challenges

**Large Exports (500+ nodes)**:
- Memory usage during generation
- Browser download size limits
- User experience (long wait times)
- PDF rendering performance

### Optimization Strategies

#### 1. Pagination

```python
# Backend pagination
def export_large_tree_paginated(
    nodes: List[Dict],
    page_size: int = 100
) -> List[bytes]:
    """
    Generate export in pages.

    Returns list of page contents (can be combined or downloaded separately).
    """
    pages = []

    for i in range(0, len(nodes), page_size):
        page_nodes = nodes[i:i + page_size]
        page_content = generate_pdf(page_nodes)
        pages.append(page_content)

    return pages
```

#### 2. Streaming Responses

```python
from fastapi.responses import StreamingResponse
import asyncio

async def stream_markdown_export(nodes: List[Dict]):
    """Stream markdown content incrementally."""
    # Header
    yield "# Export\n\n"

    # Nodes one by one
    for i, node in enumerate(nodes):
        content = render_node_markdown(node)
        yield content
        yield "\n\n---\n\n"

        # Allow other tasks to run
        if i % 10 == 0:
            await asyncio.sleep(0)

@router.get("/export/stream")
async def export_stream(node_id: str):
    nodes = await get_nodes(node_id)
    return StreamingResponse(
        stream_markdown_export(nodes),
        media_type="text/markdown"
    )
```

#### 3. Client-Side Chunking

```typescript
// Download large exports in chunks
async function downloadLargeExport(
  nodeId: string,
  format: string,
  onProgress: (percent: number) => void
) {
  const response = await fetch(`/api/exports/${nodeId}/info`);
  const info = await response.json();

  if (info.node_count < 500) {
    // Small export - download directly
    return await exportNode(nodeId, { format });
  }

  // Large export - download in chunks
  const totalChunks = Math.ceil(info.node_count / 100);
  const chunks: Blob[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunkResponse = await axios.get(
      `/api/exports/${nodeId}/chunk/${i}`,
      { responseType: 'blob' }
    );

    chunks.push(chunkResponse.data);
    onProgress(((i + 1) / totalChunks) * 100);
  }

  // Combine chunks
  const combined = new Blob(chunks, { type: 'application/pdf' });
  downloadBinaryFile(combined, 'export.pdf', 'application/pdf');
}
```

#### 4. Depth Limiting

```python
def warn_large_export(node_id: str, max_depth: Optional[int]) -> Dict:
    """
    Warn user about large exports and suggest depth limit.

    Returns size estimate and recommendation.
    """
    # Count descendants
    total_nodes = count_descendants(node_id, max_depth)

    if total_nodes > 500:
        recommended_depth = calculate_optimal_depth(node_id, max_nodes=200)
        return {
            'warning': True,
            'total_nodes': total_nodes,
            'estimated_size_mb': total_nodes * 0.01,  # Rough estimate
            'recommended_depth': recommended_depth,
            'message': f'This export will include {total_nodes} nodes. Consider limiting depth to {recommended_depth}.'
        }

    return {'warning': False}
```

#### 5. Lazy Loading in HTML Exports

```html
<!-- HTML with lazy-loaded sections -->
<script>
document.addEventListener('DOMContentLoaded', () => {
    // Initially hide large sections
    const nodes = document.querySelectorAll('.node');
    nodes.forEach((node, index) => {
        if (index > 50) {
            node.style.display = 'none';
            node.dataset.lazy = 'true';
        }
    });

    // Show "Load More" button
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.textContent = 'Load More Nodes';
    loadMoreBtn.onclick = () => {
        const hidden = document.querySelectorAll('.node[data-lazy="true"]');
        Array.from(hidden).slice(0, 50).forEach(node => {
            node.style.display = 'block';
            node.removeAttribute('data-lazy');
        });

        if (document.querySelectorAll('.node[data-lazy="true"]').length === 0) {
            loadMoreBtn.remove();
        }
    };

    document.querySelector('main').appendChild(loadMoreBtn);
});
</script>
```

---

## Testing Export Formats

### Unit Tests

```python
# tests/unit/test_markdown_export.py
import pytest
from mindflow.services.markdown_export import MarkdownExporter

def test_single_node_export():
    """Test exporting a single node."""
    exporter = MarkdownExporter()
    nodes = [{
        'id': 'n1',
        'type': 'question',
        'content': 'Test question?',
        'author': 'test@example.com',
        'created_at': '2025-11-21T10:00:00Z'
    }]

    result = exporter.export_nodes(nodes, title="Test Export")

    assert '# Test Export' in result
    assert 'Test question?' in result
    assert 'test@example.com' in result

def test_markdown_escaping():
    """Test that special characters are properly escaped."""
    exporter = MarkdownExporter()
    nodes = [{
        'id': 'n1',
        'content': 'Text with # and * and _underscores_'
    }]

    result = exporter.export_nodes(nodes)
    # Verify proper escaping
    assert 'Text with # and * and _underscores_' in result

def test_table_of_contents_generation():
    """Test TOC is generated for large exports."""
    exporter = MarkdownExporter()
    nodes = [{'id': f'n{i}', 'content': f'Node {i}'} for i in range(15)]

    result = exporter.export_nodes(nodes, include_toc=True)

    assert '## Table of Contents' in result
    assert '[' in result  # Markdown links

# tests/unit/test_pdf_export.py
import pytest
from mindflow.services.pdf_export import PDFExporter

def test_pdf_generation():
    """Test that PDF is generated successfully."""
    exporter = PDFExporter()
    nodes = [{
        'id': 'n1',
        'type': 'question',
        'content': 'Test PDF export'
    }]

    pdf_bytes = exporter.export_nodes(nodes)

    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b'%PDF')  # PDF magic number
    assert len(pdf_bytes) > 0

def test_pdf_page_breaks():
    """Test that large exports have proper page breaks."""
    exporter = PDFExporter()
    # Create many nodes to force multiple pages
    nodes = [
        {'id': f'n{i}', 'content': 'x' * 1000}
        for i in range(20)
    ]

    pdf_bytes = exporter.export_nodes(nodes)

    # Verify multi-page PDF (this is tricky - may need PDF library)
    # For now, just check size
    assert len(pdf_bytes) > 10000  # Reasonably large

# tests/unit/test_html_export.py
import pytest
from mindflow.services.html_export import HTMLExporter

def test_html_structure():
    """Test HTML has correct structure."""
    exporter = HTMLExporter()
    nodes = [{'id': 'n1', 'content': 'Test'}]

    result = exporter.export_nodes(nodes)

    assert '<!DOCTYPE html>' in result
    assert '<html' in result
    assert '</html>' in result
    assert 'Test' in result

def test_html_theming():
    """Test different themes produce different CSS."""
    exporter = HTMLExporter()
    nodes = [{'id': 'n1', 'content': 'Test'}]

    light = exporter.export_nodes(nodes, theme='light')
    dark = exporter.export_nodes(nodes, theme='dark')

    assert 'data-theme="light"' in light
    assert 'data-theme="dark"' in dark
    assert light != dark

# tests/unit/test_tree_traversal.py
import pytest
from mindflow.utils.tree_traversal import TreeTraverser

def test_get_ancestors():
    """Test ancestor retrieval."""
    nodes = {
        'root': {'id': 'root', 'parent_id': None, 'child_ids': ['n1']},
        'n1': {'id': 'n1', 'parent_id': 'root', 'child_ids': ['n2']},
        'n2': {'id': 'n2', 'parent_id': 'n1', 'child_ids': []}
    }

    traverser = TreeTraverser(nodes)
    ancestors = traverser.get_ancestors('n2')

    assert len(ancestors) == 3
    assert [n['id'] for n in ancestors] == ['root', 'n1', 'n2']

def test_get_descendants():
    """Test descendant retrieval."""
    nodes = {
        'root': {'id': 'root', 'parent_id': None, 'child_ids': ['n1', 'n2']},
        'n1': {'id': 'n1', 'parent_id': 'root', 'child_ids': []},
        'n2': {'id': 'n2', 'parent_id': 'root', 'child_ids': ['n3']},
        'n3': {'id': 'n3', 'parent_id': 'n2', 'child_ids': []}
    }

    traverser = TreeTraverser(nodes)
    descendants = traverser.get_descendants_dfs('root')

    assert len(descendants) == 4
    assert descendants[0]['id'] == 'root'

def test_cycle_detection():
    """Test that cycles are detected."""
    nodes = {
        'n1': {'id': 'n1', 'child_ids': ['n2']},
        'n2': {'id': 'n2', 'child_ids': ['n3']},
        'n3': {'id': 'n3', 'child_ids': ['n1']}  # Cycle!
    }

    traverser = TreeTraverser(nodes)
    cycles = traverser.detect_cycles()

    assert len(cycles) > 0
    assert 'n1' in cycles[0]
    assert 'n2' in cycles[0]
    assert 'n3' in cycles[0]

def test_max_depth_limiting():
    """Test depth limiting works."""
    nodes = {
        'root': {'id': 'root', 'child_ids': ['n1']},
        'n1': {'id': 'n1', 'child_ids': ['n2']},
        'n2': {'id': 'n2', 'child_ids': ['n3']},
        'n3': {'id': 'n3', 'child_ids': []}
    }

    traverser = TreeTraverser(nodes)
    descendants = traverser.get_descendants_dfs('root', max_depth=2)

    # Should get root, n1, n2 (depth 0, 1, 2) but not n3 (depth 3)
    assert len(descendants) == 3
```

### Integration Tests

```python
# tests/integration/test_export_endpoints.py
import pytest
from fastapi.testclient import TestClient
from mindflow.api.server import app

client = TestClient(app)

def test_export_markdown_endpoint():
    """Test markdown export endpoint."""
    # Create test node
    response = client.post('/api/nodes', json={
        'type': 'question',
        'content': 'Test question'
    })
    node_id = response.json()['id']

    # Export node
    response = client.post(f'/api/exports/nodes/{node_id}/export', json={
        'format': 'markdown',
        'include_ancestors': False,
        'include_descendants': False
    })

    assert response.status_code == 200
    assert 'text/markdown' in response.headers['content-type']
    assert 'Content-Disposition' in response.headers
    assert 'Test question' in response.text

def test_export_pdf_endpoint():
    """Test PDF export endpoint."""
    # Create test node
    response = client.post('/api/nodes', json={
        'type': 'answer',
        'content': 'Test answer'
    })
    node_id = response.json()['id']

    # Export node
    response = client.post(f'/api/exports/nodes/{node_id}/export', json={
        'format': 'pdf'
    })

    assert response.status_code == 200
    assert 'application/pdf' in response.headers['content-type']
    assert response.content.startswith(b'%PDF')

def test_export_tree_with_depth():
    """Test exporting tree with depth limit."""
    # Create tree: root -> n1 -> n2 -> n3
    root = client.post('/api/nodes', json={'content': 'Root'}).json()
    n1 = client.post('/api/nodes', json={'content': 'N1', 'parent_id': root['id']}).json()
    n2 = client.post('/api/nodes', json={'content': 'N2', 'parent_id': n1['id']}).json()
    n3 = client.post('/api/nodes', json={'content': 'N3', 'parent_id': n2['id']}).json()

    # Export with depth limit
    response = client.post(f'/api/exports/nodes/{root["id"]}/export', json={
        'format': 'markdown',
        'include_descendants': True,
        'max_depth': 2
    })

    content = response.text
    assert 'Root' in content
    assert 'N1' in content
    assert 'N2' in content
    assert 'N3' not in content  # Excluded by depth limit
```

### Frontend Tests

```typescript
// frontend/src/components/__tests__/ExportDialog.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportDialog } from '../ExportDialog';
import * as exportService from '../../services/exportService';

jest.mock('../../services/exportService');

describe('ExportDialog', () => {
  it('renders export format options', () => {
    render(<ExportDialog nodeId="test-node" onClose={() => {}} />);

    expect(screen.getByLabelText(/format/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /markdown/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /html/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /pdf/i })).toBeInTheDocument();
  });

  it('calls export service with correct options', async () => {
    const mockExport = jest.spyOn(exportService, 'exportNode').mockResolvedValue();
    const onClose = jest.fn();

    render(<ExportDialog nodeId="test-node" onClose={onClose} />);

    // Select options
    fireEvent.change(screen.getByLabelText(/format/i), { target: { value: 'pdf' } });
    fireEvent.click(screen.getByLabelText(/include ancestors/i));

    // Click export
    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledWith('test-node', {
        format: 'pdf',
        includeAncestors: true,
        includeDescendants: false,
        maxDepth: undefined
      });
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('shows error on export failure', async () => {
    jest.spyOn(exportService, 'exportNode').mockRejectedValue(new Error('Export failed'));

    render(<ExportDialog nodeId="test-node" onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    await waitFor(() => {
      expect(screen.getByText(/export failed/i)).toBeInTheDocument();
    });
  });
});
```

### PDF Validation

```python
# tests/validation/test_pdf_validation.py
import pytest
from PyPDF2 import PdfReader
from io import BytesIO

def test_pdf_is_valid(pdf_bytes: bytes):
    """Test that generated PDF is valid."""
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
        assert len(reader.pages) > 0

        # Test first page has content
        first_page = reader.pages[0]
        text = first_page.extract_text()
        assert len(text) > 0

    except Exception as e:
        pytest.fail(f"PDF is invalid: {e}")

def test_pdf_metadata(pdf_bytes: bytes):
    """Test PDF metadata is set correctly."""
    reader = PdfReader(BytesIO(pdf_bytes))
    metadata = reader.metadata

    assert metadata.get('/Producer') == 'WeasyPrint'
    # Could also check /Title, /Author if set
```

---

## Security Considerations

### Input Sanitization

```python
import bleach
import html

def sanitize_content(content: str, format: str) -> str:
    """
    Sanitize user content for export.

    Args:
        content: Raw user content
        format: Target format (markdown, html, pdf)

    Returns:
        Sanitized content safe for export
    """
    if format == 'html':
        # Allow safe HTML tags only
        allowed_tags = [
            'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3',
            'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'a'
        ]
        allowed_attributes = {
            'a': ['href', 'title'],
            'code': ['class']
        }
        return bleach.clean(
            content,
            tags=allowed_tags,
            attributes=allowed_attributes,
            strip=True
        )

    elif format == 'markdown':
        # Escape HTML in markdown to prevent XSS
        return html.escape(content)

    elif format == 'pdf':
        # PDF rendering via HTML, so apply HTML sanitization
        return sanitize_content(content, 'html')

    return content
```

### File Size Limits

```python
MAX_EXPORT_NODES = 1000
MAX_EXPORT_SIZE_MB = 50

def validate_export_request(
    node_count: int,
    estimated_size_mb: float
) -> None:
    """Validate export doesn't exceed limits."""
    if node_count > MAX_EXPORT_NODES:
        raise ValueError(
            f'Export exceeds maximum node limit ({MAX_EXPORT_NODES}). '
            f'Use depth limiting or export smaller subtrees.'
        )

    if estimated_size_mb > MAX_EXPORT_SIZE_MB:
        raise ValueError(
            f'Export exceeds maximum size limit ({MAX_EXPORT_SIZE_MB}MB). '
            f'Consider exporting in multiple parts.'
        )
```

### Path Traversal Prevention

```python
import os
from pathlib import Path

def safe_filename(filename: str) -> str:
    """
    Ensure filename is safe (no path traversal).

    Args:
        filename: User-provided or generated filename

    Returns:
        Sanitized filename safe for file system
    """
    # Remove path components
    filename = os.path.basename(filename)

    # Remove dangerous characters
    dangerous_chars = ['..', '/', '\\', '\x00']
    for char in dangerous_chars:
        filename = filename.replace(char, '')

    # Ensure reasonable length
    name, ext = os.path.splitext(filename)
    name = name[:200]  # Max 200 chars

    # Ensure not empty
    if not name:
        name = 'export'

    return f"{name}{ext}"
```

### Rate Limiting

```python
from fastapi import HTTPException, Request
from collections import defaultdict
from datetime import datetime, timedelta

# Simple in-memory rate limiter
export_requests = defaultdict(list)

async def check_rate_limit(request: Request) -> None:
    """
    Rate limit export requests per IP.

    Limit: 10 exports per minute per IP
    """
    client_ip = request.client.host
    now = datetime.now()

    # Clean old requests
    export_requests[client_ip] = [
        req_time for req_time in export_requests[client_ip]
        if now - req_time < timedelta(minutes=1)
    ]

    # Check limit
    if len(export_requests[client_ip]) >= 10:
        raise HTTPException(
            status_code=429,
            detail="Too many export requests. Please wait a minute."
        )

    # Record this request
    export_requests[client_ip].append(now)
```

---

## Technology Recommendations

### Backend

| Component | Recommended Technology | Rationale |
|-----------|----------------------|-----------|
| PDF Generation | **WeasyPrint** | Pure Python, excellent CSS support, no external deps |
| HTML Templates | **Jinja2** | Already in FastAPI ecosystem, powerful, secure |
| Markdown Parsing | **Python-Markdown** + **pymdown-extensions** | Feature-rich, extensible, well-maintained |
| Tree Traversal | **Custom implementation** | Graph structure is specific to MindFlow |
| File Streaming | **FastAPI StreamingResponse** | Built-in, efficient for large files |

### Frontend

| Component | Recommended Technology | Rationale |
|-----------|----------------------|-----------|
| HTTP Client | **Axios** | Already in project, good blob support |
| File Downloads | **Blob API** | Native browser API, no dependencies |
| UI Components | **React components** | Consistent with existing codebase |
| Progress Tracking | **Axios interceptors** | Built-in progress event support |

### Testing

| Type | Technology | Rationale |
|------|-----------|-----------|
| Backend Unit | **Pytest** | Already in project, excellent fixtures |
| Frontend Unit | **Vitest** + **@testing-library/react** | Already in project, fast |
| Integration | **FastAPI TestClient** | Built-in, simulates real requests |
| PDF Validation | **PyPDF2** | Read PDFs programmatically |

### Dependencies to Add

```bash
# Backend
pip install weasyprint
pip install markdown
pip install pymdown-extensions
pip install jinja2
pip install pypdf2  # For testing

# Frontend (already have what we need)
# - axios
# - react
# - typescript
```

---

## Implementation Strategy

### Phase 1: Core Export (Week 1)

**Goals**:
- Single node export (all formats)
- Basic formatting and metadata
- File download working

**Tasks**:
1. Create export service classes (MarkdownExporter, PDFExporter, HTMLExporter)
2. Implement tree traversal utilities (TreeTraverser)
3. Create export API endpoints (POST /api/exports/nodes/{id}/export)
4. Build ExportDialog React component
5. Implement file download utility functions
6. Write unit tests for exporters

**Success Criteria**:
- User can export single node to MD/HTML/PDF
- Exported files contain node content and metadata
- Downloads work in all major browsers

### Phase 2: Tree Export (Week 2)

**Goals**:
- Export with ancestors
- Export with descendants
- Depth limiting
- Cycle detection

**Tasks**:
1. Implement ancestor/descendant traversal in TreeTraverser
2. Add export scope options to API
3. Update ExportDialog with tree options
4. Add hierarchy visualization in exports
5. Implement cycle detection
6. Write integration tests for tree exports

**Success Criteria**:
- User can export full reasoning chains
- Hierarchy is clearly represented in all formats
- Circular references handled gracefully

### Phase 3: Polish & Optimization (Week 3)

**Goals**:
- Large export optimization
- Theme customization
- Advanced formatting
- Performance tuning

**Tasks**:
1. Add streaming for large exports
2. Implement theme selection (light/dark/minimal)
3. Add interactive features to HTML exports
4. Optimize PDF generation performance
5. Add export size warnings
6. Complete test coverage
7. Documentation

**Success Criteria**:
- Exports with 500+ nodes complete in < 30s
- Users can customize appearance
- 90%+ test coverage
- All edge cases handled

---

## References

### Documentation

- [WeasyPrint Documentation](https://doc.courtbouillon.org/weasyprint/stable/)
- [Python-Markdown Documentation](https://python-markdown.github.io/)
- [Jinja2 Documentation](https://jinja.palletsprojects.com/)
- [FastAPI Responses](https://fastapi.tiangolo.com/advanced/custom-response/)
- [MDN Blob API](https://developer.mozilla.org/en-US/docs/Web/API/Blob)

### Specifications

- [CommonMark Spec](https://spec.commonmark.org/)
- [GitHub Flavored Markdown](https://github.github.com/gfm/)
- [CSS Paged Media](https://www.w3.org/TR/css-page-3/)
- [PDF/A Standard](https://www.pdfa.org/)

### Libraries

- [WeasyPrint GitHub](https://github.com/Kozea/WeasyPrint)
- [Python-Markdown GitHub](https://github.com/Python-Markdown/markdown)
- [PyMdown Extensions](https://facelessuser.github.io/pymdown-extensions/)

---

**Research Complete**: 2025-11-21
**Next Phase**: Data Model Design (data-model.md)
