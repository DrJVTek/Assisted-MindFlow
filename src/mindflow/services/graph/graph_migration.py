"""Legacy graph migration — converts old type-enum graphs to v2.0.0 plugin format.

Detects version-less graphs (pre-plugin), maps old node type enum values
to class_type identifiers, and stamps the graph with version 2.0.0.

This module is intentionally pure-data (dict in, dict out) — it works on
the raw JSON dict before it's loaded into Pydantic models, so it can run
during canvas deserialization.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Maps legacy node type enum → plugin class_type
LEGACY_TYPE_MAP: dict[str, str] = {
    "question": "llm_chat",
    "answer": "llm_chat",
    "note": "text_input",
    "hypothesis": "text_input",
    "evaluation": "text_input",
    "summary": "text_input",
}

CURRENT_VERSION = "2.0.0"


def migrate_graph_data(graph_data: dict[str, Any]) -> dict[str, Any]:
    """Migrate a graph dict from legacy format to v2.0.0 if needed.

    Args:
        graph_data: Raw graph dict (from JSON deserialization).

    Returns:
        The same dict (mutated in place) if migration was needed,
        or the original dict unchanged if already at v2.0.0+.
    """
    # Already migrated?
    if graph_data.get("version") == CURRENT_VERSION:
        return graph_data

    nodes = graph_data.get("nodes", {})
    migrated_count = 0

    for node_id, node in nodes.items():
        # Skip nodes that already have class_type
        if "class_type" in node:
            continue

        legacy_type = node.get("type")
        if legacy_type is None:
            continue

        # Map to new class_type
        class_type = LEGACY_TYPE_MAP.get(legacy_type, "text_input")
        node["class_type"] = class_type
        migrated_count += 1

    if migrated_count > 0:
        graph_data["version"] = CURRENT_VERSION
        logger.info(
            "Migrated %d nodes from legacy format to v%s",
            migrated_count, CURRENT_VERSION,
        )

    return graph_data
