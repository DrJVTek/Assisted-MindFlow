# Data Model: Node Export to Multiple Formats

**Feature**: 006-node-export
**Created**: 2025-11-21
**Last Updated**: 2025-11-21
**Status**: Phase 0 - Data Model Design

---

## Table of Contents

1. [Overview](#overview)
2. [Core Entities](#core-entities)
3. [Export Request Entity](#export-request-entity)
4. [Export Options Entity](#export-options-entity)
5. [Exported Document Entity](#exported-document-entity)
6. [Tree Traversal Strategies](#tree-traversal-strategies)
7. [Backend Models](#backend-models)
8. [Frontend Types](#frontend-types)
9. [Database Schema](#database-schema)
10. [Validation Rules](#validation-rules)
11. [State Management](#state-management)
12. [Data Flow](#data-flow)

---

## Overview

The export feature requires several data entities to represent user requests, export configurations, generated documents, and traversal strategies. This document defines the complete data model for the export system.

**Design Principles**:
- **Immutability**: Exported documents are immutable snapshots
- **Traceability**: All exports are logged with metadata
- **Flexibility**: Support various export scopes and formats
- **Performance**: Optimize for common use cases (single node, small trees)
- **Type Safety**: Strong typing in both Python and TypeScript

---

## Core Entities

### Entity Relationship Diagram

```
┌─────────────────┐
│  ExportRequest  │
│                 │
│  - node_id      │
│  - scope        │◄──┐
│  - format       │   │
│  - options      │───┼──┐
└─────────────────┘   │  │
         │            │  │
         │ creates    │  │
         ▼            │  │
┌─────────────────┐   │  │
│ExportedDocument │   │  │
│                 │   │  │
│  - content      │   │  │
│  - metadata     │   │  │
│  - file_info    │   │  │
└─────────────────┘   │  │
                      │  │
              ┌───────┘  │
              │          │
              ▼          │
      ┌─────────────┐    │
      │ExportOptions│◄───┘
      │             │
      │ - theme     │
      │ - metadata  │
      │ - depth     │
      └─────────────┘

┌─────────────────┐
│ TreeTraversal   │
│                 │
│  - strategy     │
│  - visited      │
│  - result       │
└─────────────────┘
```

---

## Export Request Entity

### Purpose

Represents a user's request to export one or more nodes in a specific format with given options.

### Fields

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `id` | `str` (UUID) | Yes | Unique request identifier | Auto-generated |
| `node_id` | `str` (UUID) | Yes | Starting node for export | Must exist in graph |
| `scope` | `ExportScope` | Yes | What to include in export | Enum value |
| `format` | `ExportFormat` | Yes | Output file format | Enum value |
| `options` | `ExportOptions` | No | Additional export settings | Default to sensible values |
| `user_id` | `str` | No | User who requested export | For audit logging |
| `requested_at` | `datetime` | Yes | When request was made | Auto-generated |
| `status` | `ExportStatus` | Yes | Current status of export | State machine |
| `error_message` | `str` | No | Error details if failed | Only when status=failed |

### Enums

#### ExportScope

Defines what nodes to include in the export:

```python
from enum import Enum

class ExportScope(str, Enum):
    """Scope of nodes to include in export."""

    SINGLE = "single"
    """Export only the selected node."""

    WITH_ANCESTORS = "with_ancestors"
    """Export node with all ancestors (parent chain to root)."""

    WITH_DESCENDANTS = "with_descendants"
    """Export node with all descendants (children subtree)."""

    FULL_TREE = "full_tree"
    """Export ancestors + node + descendants (complete context)."""
```

**Use Cases**:
- `SINGLE`: Quick export of one node (e.g., save a specific answer)
- `WITH_ANCESTORS`: Show reasoning chain (how we got to this conclusion)
- `WITH_DESCENDANTS`: Show implications (what follows from this hypothesis)
- `FULL_TREE`: Complete context (for comprehensive documentation)

#### ExportFormat

Defines the output file format:

```python
class ExportFormat(str, Enum):
    """Output file format for export."""

    MARKDOWN = "markdown"
    """Markdown (.md) - Plain text with formatting."""

    HTML = "html"
    """HTML (.html) - Standalone web page."""

    PDF = "pdf"
    """PDF (.pdf) - Formatted document."""
```

#### ExportStatus

Tracks the lifecycle of an export request:

```python
class ExportStatus(str, Enum):
    """Status of export request."""

    PENDING = "pending"
    """Export request received, not yet started."""

    PROCESSING = "processing"
    """Export generation in progress."""

    COMPLETED = "completed"
    """Export successfully generated."""

    FAILED = "failed"
    """Export failed due to error."""

    CANCELLED = "cancelled"
    """Export cancelled by user."""
```

**State Transitions**:
```
pending -> processing -> completed
         └──────────────> failed
         └──────────────> cancelled
```

### Python Model

```python
# src/mindflow/models/export_request.py
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum
import uuid

class ExportScope(str, Enum):
    SINGLE = "single"
    WITH_ANCESTORS = "with_ancestors"
    WITH_DESCENDANTS = "with_descendants"
    FULL_TREE = "full_tree"

class ExportFormat(str, Enum):
    MARKDOWN = "markdown"
    HTML = "html"
    PDF = "pdf"

class ExportStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ExportRequest(BaseModel):
    """Request to export node(s) to a specific format."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    node_id: str = Field(..., description="ID of node to export")
    scope: ExportScope = Field(default=ExportScope.SINGLE)
    format: ExportFormat = Field(...)
    options: Optional['ExportOptions'] = Field(default=None)
    user_id: Optional[str] = Field(default=None)
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    status: ExportStatus = Field(default=ExportStatus.PENDING)
    error_message: Optional[str] = Field(default=None)

    class Config:
        use_enum_values = True
        json_schema_extra = {
            "example": {
                "node_id": "n-123e4567",
                "scope": "with_descendants",
                "format": "pdf",
                "options": {
                    "include_metadata": True,
                    "theme": "light",
                    "max_depth": 5
                }
            }
        }

    def mark_processing(self) -> None:
        """Mark export as processing."""
        self.status = ExportStatus.PROCESSING

    def mark_completed(self) -> None:
        """Mark export as completed."""
        self.status = ExportStatus.COMPLETED

    def mark_failed(self, error: str) -> None:
        """Mark export as failed with error message."""
        self.status = ExportStatus.FAILED
        self.error_message = error

    def mark_cancelled(self) -> None:
        """Mark export as cancelled."""
        self.status = ExportStatus.CANCELLED
```

### TypeScript Type

```typescript
// frontend/src/types/export.ts
export enum ExportScope {
  Single = 'single',
  WithAncestors = 'with_ancestors',
  WithDescendants = 'with_descendants',
  FullTree = 'full_tree'
}

export enum ExportFormat {
  Markdown = 'markdown',
  HTML = 'html',
  PDF = 'pdf'
}

export enum ExportStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled'
}

export interface ExportRequest {
  id: string;
  node_id: string;
  scope: ExportScope;
  format: ExportFormat;
  options?: ExportOptions;
  user_id?: string;
  requested_at: string;  // ISO 8601 datetime
  status: ExportStatus;
  error_message?: string;
}
```

---

## Export Options Entity

### Purpose

Configuration options that customize the export output (appearance, content inclusion, limits).

### Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `include_metadata` | `bool` | No | `true` | Include node metadata (author, dates, tags) |
| `include_timestamps` | `bool` | No | `true` | Include creation/update timestamps |
| `include_author` | `bool` | No | `true` | Include author information |
| `include_tags` | `bool` | No | `true` | Include node tags |
| `theme` | `ExportTheme` | No | `"light"` | Visual theme for output |
| `font_size` | `FontSize` | No | `"medium"` | Font size for output |
| `max_depth` | `int` | No | `None` | Maximum tree depth (for descendants) |
| `include_toc` | `bool` | No | Auto | Include table of contents (auto for 10+ nodes) |
| `page_breaks` | `bool` | No | `true` | Include page breaks in PDF (between major sections) |
| `syntax_highlighting` | `bool` | No | `true` | Enable code syntax highlighting |
| `collapsible_sections` | `bool` | No | `true` | Enable collapsible sections in HTML |

### Enums

#### ExportTheme

```python
class ExportTheme(str, Enum):
    """Visual theme for export output."""

    LIGHT = "light"
    """Light theme - white background, dark text."""

    DARK = "dark"
    """Dark theme - dark background, light text."""

    MINIMAL = "minimal"
    """Minimal theme - no metadata, simple styling."""
```

#### FontSize

```python
class FontSize(str, Enum):
    """Font size for export output."""

    SMALL = "small"    # 10pt base
    MEDIUM = "medium"  # 11pt base (default)
    LARGE = "large"    # 13pt base
```

### Python Model

```python
# src/mindflow/models/export_options.py
from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum

class ExportTheme(str, Enum):
    LIGHT = "light"
    DARK = "dark"
    MINIMAL = "minimal"

class FontSize(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"

class ExportOptions(BaseModel):
    """Options to customize export output."""

    # Metadata inclusion
    include_metadata: bool = Field(default=True)
    include_timestamps: bool = Field(default=True)
    include_author: bool = Field(default=True)
    include_tags: bool = Field(default=True)

    # Appearance
    theme: ExportTheme = Field(default=ExportTheme.LIGHT)
    font_size: FontSize = Field(default=FontSize.MEDIUM)

    # Structure
    max_depth: Optional[int] = Field(
        default=None,
        ge=1,
        le=20,
        description="Maximum depth for tree traversal (1-20)"
    )
    include_toc: Optional[bool] = Field(
        default=None,
        description="Include table of contents (auto-determined if None)"
    )

    # Format-specific
    page_breaks: bool = Field(
        default=True,
        description="Include page breaks in PDF exports"
    )
    syntax_highlighting: bool = Field(
        default=True,
        description="Enable syntax highlighting for code blocks"
    )
    collapsible_sections: bool = Field(
        default=True,
        description="Enable collapsible sections in HTML exports"
    )

    class Config:
        use_enum_values = True

    def should_include_toc(self, node_count: int) -> bool:
        """
        Determine if TOC should be included.

        Auto-includes TOC for exports with 10+ nodes.
        """
        if self.include_toc is not None:
            return self.include_toc
        return node_count >= 10

    def get_base_font_size_pt(self) -> int:
        """Get base font size in points."""
        sizes = {
            FontSize.SMALL: 10,
            FontSize.MEDIUM: 11,
            FontSize.LARGE: 13
        }
        return sizes[self.font_size]
```

### TypeScript Type

```typescript
// frontend/src/types/export.ts
export enum ExportTheme {
  Light = 'light',
  Dark = 'dark',
  Minimal = 'minimal'
}

export enum FontSize {
  Small = 'small',
  Medium = 'medium',
  Large = 'large'
}

export interface ExportOptions {
  include_metadata?: boolean;
  include_timestamps?: boolean;
  include_author?: boolean;
  include_tags?: boolean;
  theme?: ExportTheme;
  font_size?: FontSize;
  max_depth?: number;
  include_toc?: boolean;
  page_breaks?: boolean;
  syntax_highlighting?: boolean;
  collapsible_sections?: boolean;
}

// Default options
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  include_metadata: true,
  include_timestamps: true,
  include_author: true,
  include_tags: true,
  theme: ExportTheme.Light,
  font_size: FontSize.Medium,
  max_depth: undefined,
  include_toc: undefined,
  page_breaks: true,
  syntax_highlighting: true,
  collapsible_sections: true
};
```

---

## Exported Document Entity

### Purpose

Represents the generated export document with content, metadata, and file information.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `str` (UUID) | Yes | Unique document identifier |
| `request_id` | `str` (UUID) | Yes | Reference to export request |
| `content` | `bytes` or `str` | Yes | Generated document content |
| `format` | `ExportFormat` | Yes | Document format |
| `file_name` | `str` | Yes | Generated file name |
| `file_size_bytes` | `int` | Yes | File size in bytes |
| `mime_type` | `str` | Yes | MIME type for downloads |
| `node_count` | `int` | Yes | Number of nodes included |
| `metadata` | `ExportMetadata` | Yes | Document metadata |
| `generated_at` | `datetime` | Yes | When document was generated |
| `expires_at` | `datetime` | No | When document expires (if temporary) |

### Python Model

```python
# src/mindflow/models/exported_document.py
from datetime import datetime, timedelta
from typing import Optional, Union
from pydantic import BaseModel, Field
import uuid

class ExportMetadata(BaseModel):
    """Metadata about exported document."""

    title: str = Field(..., description="Document title")
    author: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    node_count: int = Field(..., ge=1)
    root_node_id: str = Field(..., description="Starting node ID")
    depth: Optional[int] = Field(default=None, description="Tree depth")
    format: str = Field(..., description="Export format")
    generator: str = Field(default="MindFlow v1.0.0")

class ExportedDocument(BaseModel):
    """Generated export document."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str = Field(..., description="Export request ID")
    content: Union[bytes, str] = Field(..., description="Document content")
    format: ExportFormat = Field(...)
    file_name: str = Field(..., description="Generated file name")
    file_size_bytes: int = Field(..., ge=0)
    mime_type: str = Field(...)
    node_count: int = Field(..., ge=1)
    metadata: ExportMetadata = Field(...)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(default=None)

    class Config:
        arbitrary_types_allowed = True

    @classmethod
    def create_from_content(
        cls,
        request_id: str,
        content: Union[bytes, str],
        format: ExportFormat,
        nodes: list,
        options: ExportOptions
    ) -> 'ExportedDocument':
        """
        Create document from generated content.

        Args:
            request_id: Export request ID
            content: Generated document content
            format: Export format
            nodes: List of nodes included in export
            options: Export options used

        Returns:
            ExportedDocument instance
        """
        # Determine MIME type
        mime_types = {
            ExportFormat.MARKDOWN: 'text/markdown',
            ExportFormat.HTML: 'text/html',
            ExportFormat.PDF: 'application/pdf'
        }
        mime_type = mime_types[format]

        # Generate file name
        title = nodes[0].get('content', 'export')[:30] if nodes else 'export'
        title_slug = title.lower().replace(' ', '-')
        extensions = {
            ExportFormat.MARKDOWN: 'md',
            ExportFormat.HTML: 'html',
            ExportFormat.PDF: 'pdf'
        }
        file_name = f"mindflow-{title_slug}.{extensions[format]}"

        # Calculate file size
        if isinstance(content, bytes):
            file_size = len(content)
        else:
            file_size = len(content.encode('utf-8'))

        # Create metadata
        metadata = ExportMetadata(
            title=title,
            node_count=len(nodes),
            root_node_id=nodes[0]['id'] if nodes else '',
            format=format.value,
            depth=options.max_depth if options else None
        )

        return cls(
            request_id=request_id,
            content=content,
            format=format,
            file_name=file_name,
            file_size_bytes=file_size,
            mime_type=mime_type,
            node_count=len(nodes),
            metadata=metadata
        )

    def is_expired(self) -> bool:
        """Check if document has expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def get_download_headers(self) -> dict:
        """Get HTTP headers for file download."""
        return {
            'Content-Type': self.mime_type,
            'Content-Disposition': f'attachment; filename="{self.file_name}"',
            'Content-Length': str(self.file_size_bytes),
            'X-Content-Type-Options': 'nosniff'
        }
```

### TypeScript Type

```typescript
// frontend/src/types/export.ts
export interface ExportMetadata {
  title: string;
  author?: string;
  created_at: string;
  node_count: number;
  root_node_id: string;
  depth?: number;
  format: string;
  generator: string;
}

export interface ExportedDocument {
  id: string;
  request_id: string;
  content: string | Blob;
  format: ExportFormat;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  node_count: number;
  metadata: ExportMetadata;
  generated_at: string;
  expires_at?: string;
}
```

---

## Tree Traversal Strategies

### Purpose

Define strategies for collecting nodes based on export scope.

### Strategy Interface

```python
# src/mindflow/utils/traversal_strategy.py
from abc import ABC, abstractmethod
from typing import List, Dict, Set, Optional

class TraversalStrategy(ABC):
    """Abstract base class for tree traversal strategies."""

    def __init__(self, nodes: Dict[str, Dict]):
        """
        Initialize with node data.

        Args:
            nodes: Dictionary mapping node_id -> node_dict
        """
        self.nodes = nodes
        self.visited: Set[str] = set()

    @abstractmethod
    def collect(self, node_id: str, max_depth: Optional[int] = None) -> List[Dict]:
        """
        Collect nodes according to strategy.

        Args:
            node_id: Starting node ID
            max_depth: Maximum depth to traverse

        Returns:
            List of nodes in appropriate order
        """
        pass

    def reset(self) -> None:
        """Reset visited tracking."""
        self.visited.clear()
```

### Single Node Strategy

```python
class SingleNodeStrategy(TraversalStrategy):
    """Collect only the specified node."""

    def collect(self, node_id: str, max_depth: Optional[int] = None) -> List[Dict]:
        """Return only the specified node."""
        if node_id not in self.nodes:
            return []
        return [self.nodes[node_id]]
```

### Ancestor Chain Strategy

```python
class AncestorChainStrategy(TraversalStrategy):
    """Collect node with all ancestors (root to current)."""

    def collect(self, node_id: str, max_depth: Optional[int] = None) -> List[Dict]:
        """
        Collect ancestors from root to current node.

        Returns nodes in order: [root, ..., parent, current_node]
        """
        ancestors = []
        current_id = node_id
        visited_local = set()

        # Walk up parent chain
        while current_id and current_id not in visited_local:
            if current_id not in self.nodes:
                break

            node = self.nodes[current_id]
            ancestors.append(node)
            visited_local.add(current_id)

            # Move to parent
            current_id = node.get('parent_id')

        # Reverse to get root-first order
        return list(reversed(ancestors))
```

### Descendant Tree Strategy (DFS)

```python
class DescendantDFSStrategy(TraversalStrategy):
    """Collect node with all descendants using depth-first search."""

    def collect(self, node_id: str, max_depth: Optional[int] = None) -> List[Dict]:
        """
        Collect descendants in DFS order (pre-order).

        Args:
            node_id: Starting node
            max_depth: Maximum depth to traverse

        Returns:
            List of nodes in DFS order
        """
        result = []
        self.visited.clear()
        self._dfs(node_id, result, depth=0, max_depth=max_depth)
        return result

    def _dfs(
        self,
        node_id: str,
        result: List[Dict],
        depth: int,
        max_depth: Optional[int]
    ) -> None:
        """Recursive DFS helper."""
        # Check depth limit
        if max_depth is not None and depth > max_depth:
            return

        # Check if already visited (cycle detection)
        if node_id in self.visited:
            return

        # Check if node exists
        if node_id not in self.nodes:
            return

        # Process node
        self.visited.add(node_id)
        node = self.nodes[node_id]
        result.append(node)

        # Recurse on children
        for child_id in node.get('child_ids', []):
            self._dfs(child_id, result, depth + 1, max_depth)
```

### Full Tree Strategy

```python
class FullTreeStrategy(TraversalStrategy):
    """Collect ancestors + node + descendants."""

    def __init__(self, nodes: Dict[str, Dict]):
        super().__init__(nodes)
        self.ancestor_strategy = AncestorChainStrategy(nodes)
        self.descendant_strategy = DescendantDFSStrategy(nodes)

    def collect(self, node_id: str, max_depth: Optional[int] = None) -> List[Dict]:
        """
        Collect full tree context.

        Returns ancestors + descendants (removing duplicate of start node).
        """
        # Get ancestors (includes start node)
        ancestors = self.ancestor_strategy.collect(node_id)

        # Get descendants (includes start node)
        descendants = self.descendant_strategy.collect(node_id, max_depth)

        # Combine, removing duplicate start node
        if ancestors and descendants:
            # Remove last ancestor (which is start node)
            full_tree = ancestors[:-1] + descendants
        elif ancestors:
            full_tree = ancestors
        elif descendants:
            full_tree = descendants
        else:
            full_tree = []

        return full_tree
```

### Strategy Factory

```python
# src/mindflow/utils/traversal_factory.py
from typing import Dict
from mindflow.models.export_request import ExportScope

class TraversalStrategyFactory:
    """Factory for creating traversal strategies."""

    @staticmethod
    def create(
        scope: ExportScope,
        nodes: Dict[str, Dict]
    ) -> TraversalStrategy:
        """
        Create appropriate traversal strategy for scope.

        Args:
            scope: Export scope
            nodes: Node data dictionary

        Returns:
            TraversalStrategy instance
        """
        strategies = {
            ExportScope.SINGLE: SingleNodeStrategy,
            ExportScope.WITH_ANCESTORS: AncestorChainStrategy,
            ExportScope.WITH_DESCENDANTS: DescendantDFSStrategy,
            ExportScope.FULL_TREE: FullTreeStrategy
        }

        strategy_class = strategies[scope]
        return strategy_class(nodes)


# Usage:
def get_export_nodes(
    node_id: str,
    scope: ExportScope,
    nodes: Dict[str, Dict],
    max_depth: Optional[int] = None
) -> List[Dict]:
    """
    Get nodes for export using appropriate strategy.

    Args:
        node_id: Starting node ID
        scope: Export scope
        nodes: All nodes in graph
        max_depth: Maximum depth (for descendant/full tree)

    Returns:
        List of nodes to include in export
    """
    factory = TraversalStrategyFactory()
    strategy = factory.create(scope, nodes)
    return strategy.collect(node_id, max_depth)
```

---

## Backend Models

### Complete Backend Model Structure

```python
# src/mindflow/models/export_models.py
"""
Complete export data models for backend.

This module contains all Pydantic models for the export feature.
"""

from datetime import datetime, timedelta
from typing import Optional, Union, List, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum
import uuid

# Re-export all components
from .export_request import (
    ExportRequest,
    ExportScope,
    ExportFormat,
    ExportStatus
)
from .export_options import (
    ExportOptions,
    ExportTheme,
    FontSize
)
from .exported_document import (
    ExportedDocument,
    ExportMetadata
)

__all__ = [
    'ExportRequest',
    'ExportScope',
    'ExportFormat',
    'ExportStatus',
    'ExportOptions',
    'ExportTheme',
    'FontSize',
    'ExportedDocument',
    'ExportMetadata',
    'ExportCreateRequest',
    'ExportResponse',
    'ExportStatusResponse'
]


# API Request/Response models
class ExportCreateRequest(BaseModel):
    """Request body for creating an export."""

    node_id: str = Field(..., description="Node ID to export")
    scope: ExportScope = Field(default=ExportScope.SINGLE)
    format: ExportFormat = Field(...)
    options: Optional[ExportOptions] = Field(default=None)

    @validator('node_id')
    def validate_node_id(cls, v):
        """Validate node ID format."""
        if not v or not isinstance(v, str):
            raise ValueError('node_id must be a non-empty string')
        return v


class ExportResponse(BaseModel):
    """Response after creating export request."""

    request_id: str = Field(..., description="Export request ID")
    status: ExportStatus = Field(...)
    estimated_size_nodes: int = Field(..., description="Estimated node count")
    estimated_time_seconds: int = Field(..., description="Estimated processing time")
    download_url: Optional[str] = Field(
        default=None,
        description="URL to download export (available when completed)"
    )


class ExportStatusResponse(BaseModel):
    """Response for checking export status."""

    request_id: str = Field(...)
    status: ExportStatus = Field(...)
    progress_percent: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
        description="Progress percentage (0-100)"
    )
    error_message: Optional[str] = Field(default=None)
    download_url: Optional[str] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)


class ExportSizeEstimate(BaseModel):
    """Estimate of export size and warnings."""

    node_count: int = Field(..., ge=0)
    estimated_file_size_kb: int = Field(..., ge=0)
    estimated_time_seconds: int = Field(..., ge=0)
    warnings: List[str] = Field(default_factory=list)
    recommended_max_depth: Optional[int] = Field(default=None)

    @classmethod
    def estimate(
        cls,
        node_count: int,
        format: ExportFormat
    ) -> 'ExportSizeEstimate':
        """
        Estimate export size and time.

        Args:
            node_count: Number of nodes to export
            format: Export format

        Returns:
            Size estimate with warnings
        """
        # Rough estimates
        kb_per_node = {
            ExportFormat.MARKDOWN: 1,   # 1 KB per node
            ExportFormat.HTML: 3,        # 3 KB per node (with CSS)
            ExportFormat.PDF: 10         # 10 KB per node (with formatting)
        }
        estimated_size = node_count * kb_per_node[format]

        # Processing time (rough estimate)
        seconds_per_node = {
            ExportFormat.MARKDOWN: 0.01,  # Fast
            ExportFormat.HTML: 0.02,       # Medium
            ExportFormat.PDF: 0.1          # Slower (rendering)
        }
        estimated_time = int(node_count * seconds_per_node[format])

        # Generate warnings
        warnings = []
        recommended_depth = None

        if node_count > 500:
            warnings.append(
                f"Large export ({node_count} nodes). This may take several minutes."
            )
            if node_count > 1000:
                warnings.append(
                    "Consider limiting depth to reduce export size."
                )
                recommended_depth = 5

        if estimated_size > 10240:  # > 10 MB
            warnings.append(
                f"Estimated file size: {estimated_size // 1024} MB. "
                "Large files may be slow to download."
            )

        if format == ExportFormat.PDF and node_count > 200:
            warnings.append(
                "PDF generation for large documents can be slow. "
                "Consider using Markdown or HTML for faster exports."
            )

        return cls(
            node_count=node_count,
            estimated_file_size_kb=estimated_size,
            estimated_time_seconds=estimated_time,
            warnings=warnings,
            recommended_max_depth=recommended_depth
        )
```

---

## Frontend Types

### Complete Frontend Type Definitions

```typescript
// frontend/src/types/export.ts
/**
 * Complete type definitions for export feature.
 */

// Enums (re-exported from earlier definitions)
export enum ExportScope {
  Single = 'single',
  WithAncestors = 'with_ancestors',
  WithDescendants = 'with_descendants',
  FullTree = 'full_tree'
}

export enum ExportFormat {
  Markdown = 'markdown',
  HTML = 'html',
  PDF = 'pdf'
}

export enum ExportStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled'
}

export enum ExportTheme {
  Light = 'light',
  Dark = 'dark',
  Minimal = 'minimal'
}

export enum FontSize {
  Small = 'small',
  Medium = 'medium',
  Large = 'large'
}

// Core entities
export interface ExportOptions {
  include_metadata?: boolean;
  include_timestamps?: boolean;
  include_author?: boolean;
  include_tags?: boolean;
  theme?: ExportTheme;
  font_size?: FontSize;
  max_depth?: number;
  include_toc?: boolean;
  page_breaks?: boolean;
  syntax_highlighting?: boolean;
  collapsible_sections?: boolean;
}

export interface ExportRequest {
  id: string;
  node_id: string;
  scope: ExportScope;
  format: ExportFormat;
  options?: ExportOptions;
  user_id?: string;
  requested_at: string;
  status: ExportStatus;
  error_message?: string;
}

export interface ExportMetadata {
  title: string;
  author?: string;
  created_at: string;
  node_count: number;
  root_node_id: string;
  depth?: number;
  format: string;
  generator: string;
}

export interface ExportedDocument {
  id: string;
  request_id: string;
  content: string | Blob;
  format: ExportFormat;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  node_count: number;
  metadata: ExportMetadata;
  generated_at: string;
  expires_at?: string;
}

// API Request/Response types
export interface ExportCreateRequest {
  node_id: string;
  scope: ExportScope;
  format: ExportFormat;
  options?: ExportOptions;
}

export interface ExportResponse {
  request_id: string;
  status: ExportStatus;
  estimated_size_nodes: number;
  estimated_time_seconds: number;
  download_url?: string;
}

export interface ExportStatusResponse {
  request_id: string;
  status: ExportStatus;
  progress_percent?: number;
  error_message?: string;
  download_url?: string;
  completed_at?: string;
}

export interface ExportSizeEstimate {
  node_count: number;
  estimated_file_size_kb: number;
  estimated_time_seconds: number;
  warnings: string[];
  recommended_max_depth?: number;
}

// UI State types
export interface ExportDialogState {
  isOpen: boolean;
  nodeId: string | null;
  selectedFormat: ExportFormat;
  selectedScope: ExportScope;
  options: ExportOptions;
  isExporting: boolean;
  error: string | null;
  sizeEstimate: ExportSizeEstimate | null;
}

// Helper type guards
export function isExportCompleted(status: ExportStatus): boolean {
  return status === ExportStatus.Completed;
}

export function isExportFailed(status: ExportStatus): boolean {
  return status === ExportStatus.Failed;
}

export function isExportInProgress(status: ExportStatus): boolean {
  return status === ExportStatus.Pending || status === ExportStatus.Processing;
}

// Constants
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  include_metadata: true,
  include_timestamps: true,
  include_author: true,
  include_tags: true,
  theme: ExportTheme.Light,
  font_size: FontSize.Medium,
  max_depth: undefined,
  include_toc: undefined,
  page_breaks: true,
  syntax_highlighting: true,
  collapsible_sections: true
};

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  [ExportFormat.Markdown]: 'Markdown (.md)',
  [ExportFormat.HTML]: 'HTML (.html)',
  [ExportFormat.PDF]: 'PDF (.pdf)'
};

export const EXPORT_SCOPE_LABELS: Record<ExportScope, string> = {
  [ExportScope.Single]: 'Single node only',
  [ExportScope.WithAncestors]: 'Node with ancestors (parent chain)',
  [ExportScope.WithDescendants]: 'Node with descendants (children)',
  [ExportScope.FullTree]: 'Full tree (ancestors + descendants)'
};

export const EXPORT_THEME_LABELS: Record<ExportTheme, string> = {
  [ExportTheme.Light]: 'Light',
  [ExportTheme.Dark]: 'Dark',
  [ExportTheme.Minimal]: 'Minimal'
};
```

---

## Database Schema

### Storage Requirements

Export requests and documents can be stored in-memory (for short-term caching) or persisted to database (for audit trails).

### In-Memory Storage (Recommended for MVP)

```python
# src/mindflow/storage/export_storage.py
from typing import Dict, Optional
from datetime import datetime, timedelta
from mindflow.models.export_models import ExportRequest, ExportedDocument

class ExportStorage:
    """In-memory storage for export requests and documents."""

    def __init__(self, ttl_hours: int = 24):
        """
        Initialize storage.

        Args:
            ttl_hours: Time-to-live for cached exports (hours)
        """
        self._requests: Dict[str, ExportRequest] = {}
        self._documents: Dict[str, ExportedDocument] = {}
        self.ttl = timedelta(hours=ttl_hours)

    def save_request(self, request: ExportRequest) -> None:
        """Save export request."""
        self._requests[request.id] = request

    def get_request(self, request_id: str) -> Optional[ExportRequest]:
        """Get export request by ID."""
        return self._requests.get(request_id)

    def save_document(self, document: ExportedDocument) -> None:
        """Save exported document."""
        # Set expiration if not set
        if document.expires_at is None:
            document.expires_at = datetime.utcnow() + self.ttl

        self._documents[document.request_id] = document

    def get_document(self, request_id: str) -> Optional[ExportedDocument]:
        """Get document by request ID."""
        doc = self._documents.get(request_id)

        if doc and doc.is_expired():
            # Remove expired document
            del self._documents[request_id]
            return None

        return doc

    def cleanup_expired(self) -> int:
        """
        Remove expired documents.

        Returns:
            Number of documents removed
        """
        expired = [
            req_id for req_id, doc in self._documents.items()
            if doc.is_expired()
        ]

        for req_id in expired:
            del self._documents[req_id]

        return len(expired)

# Global instance
export_storage = ExportStorage()
```

### Database Schema (Optional - for persistent storage)

If persistent storage is needed:

```sql
-- Export Requests table
CREATE TABLE export_requests (
    id VARCHAR(36) PRIMARY KEY,
    node_id VARCHAR(36) NOT NULL,
    scope VARCHAR(20) NOT NULL,
    format VARCHAR(10) NOT NULL,
    options JSON,
    user_id VARCHAR(36),
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    INDEX idx_node_id (node_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_requested_at (requested_at)
);

-- Exported Documents table
CREATE TABLE exported_documents (
    id VARCHAR(36) PRIMARY KEY,
    request_id VARCHAR(36) NOT NULL UNIQUE,
    format VARCHAR(10) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    node_count INTEGER NOT NULL,
    metadata JSON NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    -- Content stored as blob or file path
    content_blob BLOB,  -- For small files
    content_path VARCHAR(500),  -- For large files stored on disk
    FOREIGN KEY (request_id) REFERENCES export_requests(id) ON DELETE CASCADE,
    INDEX idx_request_id (request_id),
    INDEX idx_expires_at (expires_at)
);
```

---

## Validation Rules

### Request Validation

```python
# src/mindflow/validators/export_validator.py
from typing import Optional
from mindflow.models.export_models import (
    ExportCreateRequest,
    ExportScope,
    ExportFormat,
    ExportOptions
)

class ExportValidator:
    """Validate export requests."""

    def __init__(self, max_nodes: int = 1000, max_depth: int = 20):
        self.max_nodes = max_nodes
        self.max_depth = max_depth

    def validate_request(
        self,
        request: ExportCreateRequest,
        node_exists: bool,
        estimated_nodes: int
    ) -> tuple[bool, Optional[str]]:
        """
        Validate export request.

        Args:
            request: Export request to validate
            node_exists: Whether node_id exists in graph
            estimated_nodes: Estimated number of nodes to export

        Returns:
            (is_valid, error_message)
        """
        # Check node exists
        if not node_exists:
            return False, f"Node {request.node_id} not found"

        # Check node limit
        if estimated_nodes > self.max_nodes:
            return False, (
                f"Export would include {estimated_nodes} nodes, "
                f"exceeding limit of {self.max_nodes}. "
                f"Consider limiting depth or scope."
            )

        # Validate options
        if request.options:
            if request.options.max_depth:
                if request.options.max_depth < 1:
                    return False, "max_depth must be >= 1"
                if request.options.max_depth > self.max_depth:
                    return False, f"max_depth cannot exceed {self.max_depth}"

        return True, None

    def estimate_node_count(
        self,
        node_id: str,
        scope: ExportScope,
        max_depth: Optional[int],
        nodes: dict
    ) -> int:
        """
        Estimate number of nodes that will be exported.

        Args:
            node_id: Starting node
            scope: Export scope
            max_depth: Depth limit
            nodes: All nodes in graph

        Returns:
            Estimated node count
        """
        from mindflow.utils.traversal_factory import TraversalStrategyFactory

        factory = TraversalStrategyFactory()
        strategy = factory.create(scope, nodes)
        collected = strategy.collect(node_id, max_depth)

        return len(collected)
```

### Content Validation

```python
def validate_content(content: str, format: ExportFormat) -> tuple[bool, Optional[str]]:
    """
    Validate node content is suitable for export.

    Args:
        content: Node content
        format: Target export format

    Returns:
        (is_valid, error_message)
    """
    # Check content not empty
    if not content or not content.strip():
        return False, "Node content is empty"

    # Check content length (sanity check)
    if len(content) > 1_000_000:  # 1 MB
        return False, "Node content exceeds maximum length (1 MB)"

    # Format-specific checks
    if format == ExportFormat.PDF:
        # Check for extremely long lines (can cause PDF rendering issues)
        lines = content.split('\n')
        max_line_length = max(len(line) for line in lines) if lines else 0

        if max_line_length > 10000:
            return False, (
                "Content contains extremely long lines that may cause "
                "PDF rendering issues. Consider breaking into smaller lines."
            )

    return True, None
```

---

## State Management

### Frontend State Management (Zustand)

```typescript
// frontend/src/stores/exportStore.ts
import create from 'zustand';
import {
  ExportDialogState,
  ExportFormat,
  ExportScope,
  ExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  ExportSizeEstimate
} from '../types/export';

interface ExportStore extends ExportDialogState {
  // Actions
  openDialog: (nodeId: string) => void;
  closeDialog: () => void;
  setFormat: (format: ExportFormat) => void;
  setScope: (scope: ExportScope) => void;
  updateOptions: (options: Partial<ExportOptions>) => void;
  setError: (error: string | null) => void;
  setSizeEstimate: (estimate: ExportSizeEstimate | null) => void;
  startExport: () => void;
  finishExport: () => void;
  reset: () => void;
}

const initialState: ExportDialogState = {
  isOpen: false,
  nodeId: null,
  selectedFormat: ExportFormat.Markdown,
  selectedScope: ExportScope.Single,
  options: DEFAULT_EXPORT_OPTIONS,
  isExporting: false,
  error: null,
  sizeEstimate: null
};

export const useExportStore = create<ExportStore>((set) => ({
  ...initialState,

  openDialog: (nodeId: string) => set({
    isOpen: true,
    nodeId,
    error: null,
    sizeEstimate: null
  }),

  closeDialog: () => set({ isOpen: false }),

  setFormat: (selectedFormat: ExportFormat) => set({ selectedFormat }),

  setScope: (selectedScope: ExportScope) => set({ selectedScope }),

  updateOptions: (newOptions: Partial<ExportOptions>) => set((state) => ({
    options: { ...state.options, ...newOptions }
  })),

  setError: (error: string | null) => set({ error }),

  setSizeEstimate: (sizeEstimate: ExportSizeEstimate | null) => set({ sizeEstimate }),

  startExport: () => set({ isExporting: true, error: null }),

  finishExport: () => set({ isExporting: false }),

  reset: () => set(initialState)
}));
```

---

## Data Flow

### Export Request Flow

```
┌─────────────┐
│   User      │
│  (clicks    │
│   Export)   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ ExportDialog    │ (React Component)
│                 │
│ - Select format │
│ - Select scope  │
│ - Set options   │
└──────┬──────────┘
       │
       │ POST /api/exports
       ▼
┌─────────────────┐
│ Export API      │ (FastAPI Endpoint)
│                 │
│ - Validate      │
│ - Estimate size │
│ - Create request│
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Export Service  │ (Business Logic)
│                 │
│ - Traverse tree │
│ - Collect nodes │
│ - Generate doc  │
└──────┬──────────┘
       │
       ├──────────────────┬──────────────────┐
       ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Markdown     │  │ HTML         │  │ PDF          │
│ Exporter     │  │ Exporter     │  │ Exporter     │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                  │                  │
       └──────────────────┴──────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ Exported        │
                 │ Document        │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ File Download   │
                 │ (Browser)       │
                 └─────────────────┘
```

### Sequence Diagram

```
User          Frontend      API          Service       Exporter
 │               │           │              │             │
 │  Click Export │           │              │             │
 ├──────────────>│           │              │             │
 │               │           │              │             │
 │               │ POST      │              │             │
 │               │ /exports  │              │             │
 │               ├──────────>│              │             │
 │               │           │              │             │
 │               │           │ validate     │             │
 │               │           ├─────────────>│             │
 │               │           │              │             │
 │               │           │ get nodes    │             │
 │               │           ├─────────────>│             │
 │               │           │              │             │
 │               │           │              │ generate    │
 │               │           │              ├────────────>│
 │               │           │              │             │
 │               │           │              │ document    │
 │               │           │              │<────────────┤
 │               │           │              │             │
 │               │           │ document     │             │
 │               │           │<─────────────┤             │
 │               │           │              │             │
 │               │ response  │              │             │
 │               │ (blob)    │              │             │
 │               │<──────────┤              │             │
 │               │           │              │             │
 │  Download     │           │              │             │
 │<──────────────┤           │              │             │
 │               │           │              │             │
```

---

## Summary

This data model provides:

1. **Strong Typing**: Pydantic models (backend) and TypeScript types (frontend) ensure type safety
2. **Flexibility**: Options and scopes allow customization without complexity
3. **Extensibility**: Easy to add new formats, themes, or options
4. **Validation**: Built-in validation at model level
5. **Traceability**: Request/document tracking for audit trails
6. **Performance**: Strategies pattern for efficient tree traversal

**Next Steps**:
- Implement API contracts (contracts/api-export.yaml)
- Create quickstart guide
- Build implementation plan

---

**Data Model Complete**: 2025-11-21
**Next Phase**: API Contracts (contracts/api-export.yaml)
