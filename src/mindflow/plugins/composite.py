"""Composite node definitions and expansion logic.

A composite node encapsulates a sub-graph with exposed parameters.
During execution, the executor expands the composite inline,
binds inputs/params to internal nodes, and collects outputs.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class CompositeNodeDefinition:
    """Stores a reusable composite node definition.

    Attributes:
        name: Human-readable name for this composite.
        version: Version string for this definition.
        exposed_params: Parameters exposed to the user, mapped to internal nodes.
        inputs: External inputs mapped to internal node inputs.
        outputs: Ordered list of output mappings from internal nodes.
        internal_graph: The sub-graph structure (nodes + connections).
    """
    name: str
    version: str
    exposed_params: dict[str, dict[str, Any]] = field(default_factory=dict)
    inputs: dict[str, dict[str, Any]] = field(default_factory=dict)
    outputs: list[dict[str, Any]] = field(default_factory=list)
    internal_graph: dict[str, Any] = field(default_factory=dict)


def expand_composite(
    definition: CompositeNodeDefinition,
    input_values: dict[str, Any] | None = None,
    exposed_param_values: dict[str, Any] | None = None,
) -> tuple[dict[str, dict], dict[str, dict], list[dict]]:
    """Expand a composite definition for execution.

    Args:
        definition: The composite node definition to expand.
        input_values: Values provided for composite inputs.
        exposed_param_values: Values provided for exposed parameters.

    Returns:
        Tuple of:
        - adjacency: Internal graph adjacency dict (node_id -> {children, parents})
        - input_bindings: Input values bound to internal nodes (node_id -> {param: value})
        - output_bindings: Output mappings from internal nodes
    """
    input_values = input_values or {}
    exposed_param_values = exposed_param_values or {}

    # Extract adjacency from internal graph
    internal_nodes = definition.internal_graph.get("nodes", {})
    adjacency: dict[str, dict] = {}
    for node_id, node_data in internal_nodes.items():
        adjacency[node_id] = {
            "children": node_data.get("children", []),
            "parents": node_data.get("parents", []),
        }

    # Build input bindings: map composite inputs to internal node params
    input_bindings: dict[str, dict] = {}
    for input_name, mapping in definition.inputs.items():
        target_node = mapping.get("maps_to", {}).get("node")
        target_input = mapping.get("maps_to", {}).get("input")
        if target_node and target_input and input_name in input_values:
            if target_node not in input_bindings:
                input_bindings[target_node] = {}
            input_bindings[target_node][target_input] = input_values[input_name]

    # Apply exposed parameter values (or defaults) to internal nodes
    for param_name, param_spec in definition.exposed_params.items():
        target_node = param_spec.get("internal_node")
        target_param = param_spec.get("internal_param")
        if not target_node or not target_param:
            continue

        # Use provided value, fall back to default
        value = exposed_param_values.get(param_name, param_spec.get("default"))
        if value is not None:
            if target_node not in input_bindings:
                input_bindings[target_node] = {}
            input_bindings[target_node][target_param] = value

    # Output bindings — direct passthrough from definition
    output_bindings = [
        {"node": o["maps_from"]["node"], "output": o["maps_from"]["output"]}
        for o in definition.outputs
    ]

    return adjacency, input_bindings, output_bindings
