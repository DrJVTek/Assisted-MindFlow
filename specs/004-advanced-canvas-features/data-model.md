# Data Model: Advanced Canvas Features

**Feature**: 004-advanced-canvas-features  
**Date**: 2025-11-18

## Overview

This document defines the data structures and entity relationships for multi-canvas management, sub-graphs, clipboard operations, and icon customization.

---

## 1. Canvas Entity

### Python Backend Model

```python
from datetime import UTC, datetime
from typing import Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field

class Canvas(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    graph_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_opened: datetime = Field(default_factory=lambda: datetime.now(UTC))
    thumbnail: Optional[str] = None
    is_subgraph: bool = False
    owner_id: Optional[str] = None
```

### Storage Location
- Backend: src/mindflow/models/canvas.py
- Frontend: frontend/src/types/canvas.ts  
- Persistence: JSON file per canvas in data/canvases/{canvas_id}.json

---

## 2. Sub-Graph Entities

See research.md for detailed architecture decisions.

Key models:
- SubGraphTemplate: Reusable sub-graph definition
- SubGraphInstance: Embedded instance in a canvas
- SubGraphPort: Input/output port for sub-graph interface

Storage location: src/mindflow/models/subgraph.py

---

## 3. Clipboard Data Structure

Clipboard state stored in frontend Zustand store:
- items: Node[] (nodes being copied/cut)
- mode: copy | cut
- sourceCanvasId: UUID
- timestamp: number

Browser clipboard: JSON serialized format (best-effort)

---

## 4. Icon Customization

IconPreferences model:
- node_type_icons: Mapping of node type to icon config
- custom_icons: User-uploaded icons (max 20, 512KB each)

Storage: data/users/{user_id}/preferences.json

---

## 5. Layout Algorithm Parameters

LayoutConfig:
- algorithm: elk | dagre
- direction: DOWN | UP | LEFT | RIGHT
- nodeSpacing: number (default 50px)
- layerSpacing: number (default 80px)
- edgeRouting: ORTHOGONAL | POLYLINE | SPLINES

---

## 6. Extended Graph Metadata

Add to existing Graph model:
- subgraph_instances: dict[UUID, SubGraphInstance]
- complexity_score: int

---

## 7. Validation Rules

### Canvas Validation
- Name must be unique per user
- Name length: 1-200 characters
- graph_id must reference existing Graph

### SubGraphTemplate Validation
- Circular dependency check required
- Complexity score < 5000 (hard limit)
- Port names must be unique within template

### IconPreferences Validation
- Max 20 custom icons per user
- Total custom icon data < 10MB per user
- Individual icon file < 512KB

---

## Conclusion

Data model designed to support all feature requirements while maintaining compatibility with existing Graph architecture.
