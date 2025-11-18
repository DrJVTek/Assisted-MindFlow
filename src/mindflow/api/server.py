"""FastAPI application for MindFlow Canvas Interface.

This module provides REST API endpoints for the interactive node canvas interface.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from mindflow.api.routes import graphs, viewport
from mindflow.api.demo_data import create_demo_graph

app = FastAPI(
    title="MindFlow Canvas API",
    description="REST API for the Interactive Node Canvas Interface",
    version="1.0.0",
)

# Initialize demo data on startup
@app.on_event("startup")
async def startup_event():
    """Initialize demo graph data."""
    demo_graph = create_demo_graph()
    graphs.add_graph_to_storage(demo_graph)
    print(f"[OK] Demo graph loaded: {demo_graph.id}")

# Configure CORS based on environment
ENV = os.getenv("ENV", "development")
if ENV == "production":
    # Production: Restrict to specific domains
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
else:
    # Development: Allow localhost on common ports
    allowed_origins = [
        "http://localhost:5173",  # Vite default
        "http://localhost:3000",  # Common React port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(graphs.router, prefix="/api")
app.include_router(viewport.router, prefix="/api")


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint for health check."""
    return {"message": "MindFlow Canvas API", "version": "1.0.0"}


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}
