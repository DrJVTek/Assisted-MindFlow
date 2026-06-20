"""FastAPI application for MindFlow Canvas Interface.

This module provides REST API endpoints for the interactive node canvas interface.
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from mindflow.api.routes import graphs, viewport, canvases, subgraphs, auth, import_conversations, providers, debates, mcp_connections, node_types, execution, composites, plugins as plugins_route
from mindflow.plugins.registry import PluginRegistry

logger = logging.getLogger(__name__)

def _build_plugin_registry() -> PluginRegistry:
    """Discover and load all node-type plugins. The single place this happens."""
    project_root = Path(__file__).resolve().parents[3]
    plugin_dirs = [
        str(project_root / "plugins" / "core"),
        str(project_root / "plugins" / "community"),
    ]
    registry = PluginRegistry(plugin_dirs)
    registry.discover_and_load()
    return registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Composition root: build registries and wire them once at startup."""
    registry = _build_plugin_registry()
    node_types.set_plugin_registry(registry)
    # Eagerly build the provider registry singleton so it's ready on first request.
    from mindflow.api.routes.providers import _get_registry
    _get_registry()
    logger.info(
        "Plugin system ready: %d plugins, %d node types",
        len(registry.plugins),
        len(registry.node_classes),
    )
    yield


app = FastAPI(
    title="MindFlow Canvas API",
    description="REST API for the Interactive Node Canvas Interface",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS based on environment
ENV = os.getenv("ENV", "development")
if ENV == "production":
    # Production: Restrict to specific domains
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
else:
    # Development: Allow localhost on common ports + chatgpt.com for token capture
    allowed_origins = [
        "http://localhost:5173",  # Vite default
        "http://localhost:5174",  # Vite fallback port
        "http://localhost:3000",  # Common React port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
        "https://chatgpt.com",   # ChatGPT token capture (console one-liner)
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
app.include_router(canvases.router, prefix="/api")
app.include_router(subgraphs.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(import_conversations.router, prefix="/api")
app.include_router(providers.router, prefix="/api")
app.include_router(debates.router, prefix="/api")
app.include_router(mcp_connections.router, prefix="/api")
app.include_router(node_types.router, prefix="/api")
app.include_router(execution.router, prefix="/api")
app.include_router(composites.router, prefix="/api")
app.include_router(plugins_route.router, prefix="/api")


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint for health check."""
    return {"message": "MindFlow Canvas API", "version": "1.0.0"}


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}
