"""Graph validation: cycle detection and type compatibility checks.

Validates graphs before execution to catch structural errors early.
"""

from uuid import UUID

from mindflow.models.graph import Graph
from mindflow.plugins.registry import PluginRegistry
from mindflow.plugins.types import is_compatible
from mindflow.utils.cycles import find_cycles


def validate_graph(
    graph: Graph,
    registry: PluginRegistry,
) -> dict:
    """Validate a graph for cycles and type compatibility.

    Args:
        graph: The graph to validate.
        registry: Plugin registry for looking up node type metadata.

    Returns:
        Validation result dict matching the execution-api.md contract:
        {
            "valid": bool,
            "node_count": int,
            "edge_count": int,
            "has_cycles": bool,
            "cycle_nodes": list[str],  # only if has_cycles
            "type_errors": list[dict],
        }
    """
    # Build edges from parent/children relationships
    edges: list[tuple[UUID, UUID]] = []
    for node in graph.nodes.values():
        for child_id in node.children:
            edges.append((node.id, child_id))

    node_count = len(graph.nodes)
    edge_count = len(edges)

    # Cycle detection
    cycles = find_cycles(edges)
    has_cycles = len(cycles) > 0
    cycle_node_ids: list[str] = []
    if has_cycles:
        # Flatten cycle nodes to unique IDs
        seen: set[str] = set()
        for cycle in cycles:
            for nid in cycle:
                nid_str = str(nid)
                if nid_str not in seen:
                    seen.add(nid_str)
                    cycle_node_ids.append(nid_str)

    # Type compatibility check (only if no cycles — connections may be invalid in cyclic graphs)
    type_errors: list[dict] = []
    if not has_cycles:
        type_errors = _check_type_compatibility(graph, registry)

    result: dict = {
        "valid": not has_cycles and len(type_errors) == 0,
        "node_count": node_count,
        "edge_count": edge_count,
        "has_cycles": has_cycles,
        "type_errors": type_errors,
    }
    if has_cycles:
        result["cycle_nodes"] = cycle_node_ids

    return result


def _check_type_compatibility(
    graph: Graph,
    registry: PluginRegistry,
) -> list[dict]:
    """Check type compatibility of all connections in the graph.

    Examines each node's `connections` dict to verify that the source
    node's output type is compatible with the target node's input type.

    Args:
        graph: The graph to check.
        registry: Plugin registry for node type metadata.

    Returns:
        List of type error dicts per execution-api.md contract.
    """
    errors: list[dict] = []

    for node_id, node in graph.nodes.items():
        if not node.connections:
            continue

        # Get target node's type info
        target_class_type = node.class_type or "text_input"
        target_info = registry.get_node_info().get("node_types", {}).get(target_class_type)
        if target_info is None:
            continue

        for input_name, conn in node.connections.items():
            source_node_id = conn.get("source_node_id")
            output_name = conn.get("output_name", "output")

            if source_node_id is None:
                continue

            source_node = graph.nodes.get(UUID(source_node_id) if isinstance(source_node_id, str) else source_node_id)
            if source_node is None:
                continue

            # Resolve source output type
            source_class_type = source_node.class_type or "text_input"
            source_info = registry.get_node_info().get("node_types", {}).get(source_class_type)
            if source_info is None:
                continue

            source_type = _resolve_output_type(source_info, output_name)
            target_type = _resolve_input_type(target_info, input_name)

            if source_type and target_type and not is_compatible(source_type, target_type):
                errors.append({
                    "source_node": str(source_node.id),
                    "source_output": output_name,
                    "source_type": source_type,
                    "target_node": str(node_id),
                    "target_input": input_name,
                    "target_type": target_type,
                    "message": f"Cannot connect {source_type} output to {target_type} input",
                })

    return errors


def _resolve_output_type(node_info: dict, output_name: str) -> str | None:
    """Resolve the type of a named output from node type metadata."""
    return_types = node_info.get("return_types", ())
    return_names = node_info.get("return_names", ())

    if not return_types:
        return None

    # Match by name if return_names provided
    if return_names:
        for i, name in enumerate(return_names):
            if name == output_name and i < len(return_types):
                return return_types[i]

    # Default: first output type
    return return_types[0] if return_types else None


def _resolve_input_type(node_info: dict, input_name: str) -> str | None:
    """Resolve the expected type of a named input from node type metadata."""
    inputs = node_info.get("inputs", {})

    # Check required inputs
    for name, spec in inputs.get("required", {}).items():
        if name == input_name:
            return spec.get("type") or (spec[0] if isinstance(spec, (list, tuple)) else None)

    # Check optional inputs
    for name, spec in inputs.get("optional", {}).items():
        if name == input_name:
            return spec.get("type") or (spec[0] if isinstance(spec, (list, tuple)) else None)

    return None
