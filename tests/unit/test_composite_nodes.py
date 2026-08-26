"""Tests: composite node execution and parameter binding."""

import asyncio
from uuid import uuid4

import pytest

from mindflow.plugins.composite import CompositeNodeDefinition, expand_composite


class TestCompositeExecution:
    """T068: Composite node with 3 internal nodes executes in correct order."""

    def test_expand_composite_returns_internal_graph(self):
        """Expanding a composite produces internal adjacency with bindings."""
        n1, n2, n3 = uuid4(), uuid4(), uuid4()

        definition = CompositeNodeDefinition(
            name="Test Composite",
            version="1.0",
            exposed_params={},
            inputs={
                "text": {"type": "STRING", "maps_to": {"node": str(n1), "input": "text"}},
            },
            outputs=[
                {"type": "STRING", "maps_from": {"node": str(n3), "output": 0}},
            ],
            internal_graph={
                "nodes": {
                    str(n1): {"children": [str(n2)], "parents": []},
                    str(n2): {"children": [str(n3)], "parents": [str(n1)]},
                    str(n3): {"children": [], "parents": [str(n2)]},
                },
            },
        )

        adjacency, input_bindings, output_bindings = expand_composite(
            definition,
            input_values={"text": "Hello world"},
        )

        # 3 internal nodes in adjacency
        assert len(adjacency) == 3
        # Input bound to n1
        assert input_bindings[str(n1)]["text"] == "Hello world"
        # Output mapped from n3
        assert output_bindings[0] == {"node": str(n3), "output": 0}

    def test_internal_graph_maintains_topology(self):
        """Internal graph preserves parent/child relationships."""
        n1, n2, n3 = uuid4(), uuid4(), uuid4()

        definition = CompositeNodeDefinition(
            name="Pipeline",
            version="1.0",
            exposed_params={},
            inputs={"text": {"type": "STRING", "maps_to": {"node": str(n1), "input": "text"}}},
            outputs=[{"type": "STRING", "maps_from": {"node": str(n3), "output": 0}}],
            internal_graph={
                "nodes": {
                    str(n1): {"children": [str(n2)], "parents": []},
                    str(n2): {"children": [str(n3)], "parents": [str(n1)]},
                    str(n3): {"children": [], "parents": [str(n2)]},
                },
            },
        )

        adjacency, _, _ = expand_composite(definition, input_values={})

        # n1 → n2 → n3 topology
        assert str(n2) in [str(c) for c in adjacency[str(n1)]["children"]]
        assert str(n3) in [str(c) for c in adjacency[str(n2)]["children"]]
        assert adjacency[str(n3)]["children"] == []


class TestExposedParameterBinding:
    """T069: Composite exposed parameters correctly bind to internal node inputs."""

    def test_exposed_params_injected_into_internal_inputs(self):
        """Exposed params override internal node defaults."""
        n1, n2 = uuid4(), uuid4()

        definition = CompositeNodeDefinition(
            name="Param Test",
            version="1.0",
            exposed_params={
                "temperature": {
                    "internal_node": str(n2),
                    "internal_param": "temperature",
                    "type": "FLOAT",
                    "default": 0.7,
                },
            },
            inputs={"text": {"type": "STRING", "maps_to": {"node": str(n1), "input": "text"}}},
            outputs=[{"type": "STRING", "maps_from": {"node": str(n2), "output": 0}}],
            internal_graph={
                "nodes": {
                    str(n1): {"children": [str(n2)], "parents": []},
                    str(n2): {"children": [], "parents": [str(n1)]},
                },
            },
        )

        _, input_bindings, _ = expand_composite(
            definition,
            input_values={"text": "Prompt"},
            exposed_param_values={"temperature": 0.9},
        )

        # Exposed param injected into n2's inputs
        assert input_bindings[str(n2)]["temperature"] == 0.9

    def test_exposed_param_uses_default_when_not_provided(self):
        """If exposed param not provided, use default value."""
        n1 = uuid4()

        definition = CompositeNodeDefinition(
            name="Default Test",
            version="1.0",
            exposed_params={
                "max_tokens": {
                    "internal_node": str(n1),
                    "internal_param": "max_tokens",
                    "type": "INT",
                    "default": 500,
                },
            },
            inputs={},
            outputs=[{"type": "STRING", "maps_from": {"node": str(n1), "output": 0}}],
            internal_graph={
                "nodes": {
                    str(n1): {"children": [], "parents": []},
                },
            },
        )

        _, input_bindings, _ = expand_composite(
            definition,
            input_values={},
            exposed_param_values={},  # No override
        )

        assert input_bindings[str(n1)]["max_tokens"] == 500
