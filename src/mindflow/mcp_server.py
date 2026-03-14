"""MCP Server entry point for MindFlow.

Run with: python -m mindflow.mcp_server

This starts the MCP server using stdio transport, which is the
standard way for Claude Code and other MCP clients to connect.

For SSE transport (HTTP-based), pass --sse flag.
"""

import argparse
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="MindFlow MCP Server")
    parser.add_argument(
        "--sse",
        action="store_true",
        help="Use SSE transport instead of stdio",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8001,
        help="Port for SSE transport (default: 8001)",
    )
    args = parser.parse_args()

    from mindflow.services.mcp_server import mcp

    if args.sse:
        logger.info("Starting MindFlow MCP Server on port %d (SSE transport)", args.port)
        mcp.run(transport="sse")
    else:
        logger.info("Starting MindFlow MCP Server (stdio transport)")
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
