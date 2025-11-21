"""Sub-graph API routes for reusable graph templates.

Provides CRUD operations for SubGraphTemplate entities.
"""

from fastapi import APIRouter

# Create router for subgraph endpoints
router = APIRouter(prefix="/subgraphs", tags=["subgraphs"])


# Routes will be implemented in Phase 5+: US4 Sub-Graphs with I/O
