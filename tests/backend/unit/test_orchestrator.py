"""Tests for the Orchestrator — context-aware graph execution engine."""

import pytest
from uuid import uuid4, UUID
from unittest.mock import AsyncMock, MagicMock

from mindflow.engine.orchestrator import Orchestrator


def _make_graph(nodes_spec: dict) -> MagicMock:
    """Build a mock Graph from a spec dict.

    nodes_spec: {
        "node_id": {
            "content": "...",
            "class_type": "text_input" | "llm_chat" | None,
            "parents": [UUID, ...],
            "children": [UUID, ...],
            "inputs": {...},
            "connections": {...},
            "provider_id": None | UUID,
        }
    }
    """
    graph = MagicMock()
    graph.nodes = {}
    for node_id, spec in nodes_spec.items():
        node = MagicMock()
        node.id = node_id
        node.content = spec.get("content", "")
        node.class_type = spec.get("class_type", "text_input")
        node.parents = spec.get("parents", [])
        node.children = spec.get("children", [])
        node.inputs = spec.get("inputs", {})
        node.connections = spec.get("connections", {})
        node.provider_id = spec.get("provider_id", None)
        graph.nodes[node_id] = node
    return graph


def _make_registry(class_map: dict) -> MagicMock:
    """Build a mock registry with node_classes."""
    registry = MagicMock()
    registry.node_classes = class_map
    return registry


class FakeTextInput:
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "execute"
    CATEGORY = "input"
    STREAMING = False

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"text": ("STRING", {})}}

    def execute(self, text: str = "", **kwargs) -> tuple:
        return (text,)


class FakeLLMChat:
    RETURN_TYPES = ("STRING", "CONTEXT", "STRING")
    RETURN_NAMES = ("response", "context", "prompt")
    FUNCTION = "execute"
    CATEGORY = "llm"
    STREAMING = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"prompt": ("STRING", {}), "model": ("COMBO", {})},
            "optional": {"context": ("CONTEXT", {})},
        }

    async def execute(self, prompt: str = "", context: str = "",
                      provider: object = None, **kwargs) -> tuple:
        # Simulate LLM response
        response = f"Answer to: {prompt}"
        if context:
            response = f"[with context] Answer to: {prompt}"
        updated_context = (context + "\n\n" if context else "") + f"User: {prompt}\nAssistant: {response}"
        return (response, updated_context, prompt)

    async def stream(self, prompt: str = "", context: str = "",
                     provider: object = None, **kwargs):
        response = f"Answer to: {prompt}"
        if context:
            response = f"[with context] Answer to: {prompt}"
        for word in response.split():
            yield word + " "


class TestOrchestratorContextPassing:
    """Test that parent outputs flow correctly to child inputs."""

    @pytest.mark.asyncio
    async def test_linear_chain_text_to_llm(self):
        """TextInput → LLMChat: text output becomes prompt input."""
        n1 = uuid4()
        n2 = uuid4()

        graph = _make_graph({
            n1: {
                "content": "What is quantum computing?",
                "class_type": "text_input",
                "parents": [],
                "children": [n2],
            },
            n2: {
                "content": "",
                "class_type": "llm_chat",
                "parents": [n1],
                "children": [],
                "connections": {
                    "prompt": {"source_node_id": str(n1), "output_name": "text"},
                },
            },
        })

        registry = _make_registry({
            "text_input": FakeTextInput,
            "llm_chat": FakeLLMChat,
        })

        orchestrator = Orchestrator(graph, registry)
        results = await orchestrator.execute(target=n2)

        assert results[n1]["status"] == "completed"
        assert results[n2]["status"] == "completed"
        assert "Answer to: What is quantum computing?" in results[n2]["outputs"]["response"]

    @pytest.mark.asyncio
    async def test_chain_three_nodes_context_flows(self):
        """TextInput → LLMChat → LLMChat: context accumulates through chain."""
        n1 = uuid4()
        n2 = uuid4()
        n3 = uuid4()

        graph = _make_graph({
            n1: {
                "content": "Explain gravity",
                "class_type": "text_input",
                "parents": [],
                "children": [n2],
            },
            n2: {
                "content": "",
                "class_type": "llm_chat",
                "parents": [n1],
                "children": [n3],
                "connections": {
                    "prompt": {"source_node_id": str(n1), "output_name": "text"},
                },
            },
            n3: {
                "content": "Go deeper",
                "class_type": "llm_chat",
                "parents": [n2],
                "children": [],
                "connections": {
                    "context": {"source_node_id": str(n2), "output_name": "context"},
                },
            },
        })

        registry = _make_registry({
            "text_input": FakeTextInput,
            "llm_chat": FakeLLMChat,
        })

        orchestrator = Orchestrator(graph, registry)
        results = await orchestrator.execute(target=n3)

        # n3 should have received context from n2
        assert results[n3]["status"] == "completed"
        assert "[with context]" in results[n3]["outputs"]["response"]

    @pytest.mark.asyncio
    async def test_no_autowire_without_explicit_connections(self):
        """Nodes with parents but no explicit connections do NOT auto-wire.

        The auto-wire fallback that built context from parents silently was
        removed in spec 015 because it bypassed the plugin's declared
        INPUT_TYPES. Connections are now the sole source of truth for
        input wiring — a node without connections runs standalone with its
        own content only.
        """
        n1 = uuid4()
        n2 = uuid4()

        graph = _make_graph({
            n1: {
                "content": "Hello world",
                "class_type": "text_input",
                "parents": [],
                "children": [n2],
            },
            n2: {
                "content": "Respond to parent",
                "class_type": "llm_chat",
                "parents": [n1],
                "children": [],
                "connections": {},  # No explicit connections
            },
        })

        registry = _make_registry({
            "text_input": FakeTextInput,
            "llm_chat": FakeLLMChat,
        })

        orchestrator = Orchestrator(graph, registry)
        results = await orchestrator.execute(target=n2)

        # n2 runs without context — its own prompt is used, but no parent
        # text was silently merged in.
        assert results[n2]["status"] == "completed"
        assert "[with context]" not in results[n2]["outputs"]["response"]


class TestOrchestratorFailurePropagation:
    """Test that parent failures cancel downstream nodes."""

    @pytest.mark.asyncio
    async def test_parent_failure_cancels_child(self):
        """If a parent fails, its children are cancelled."""
        n1 = uuid4()
        n2 = uuid4()

        class FailingNode:
            RETURN_TYPES = ("STRING",)
            RETURN_NAMES = ("text",)
            FUNCTION = "execute"
            STREAMING = False

            @classmethod
            def INPUT_TYPES(cls):
                return {"required": {}}

            def execute(self, **kwargs):
                raise RuntimeError("Node failed!")

        graph = _make_graph({
            n1: {
                "content": "",
                "class_type": "failing",
                "parents": [],
                "children": [n2],
            },
            n2: {
                "content": "",
                "class_type": "text_input",
                "parents": [n1],
                "children": [],
            },
        })

        registry = _make_registry({
            "failing": FailingNode,
            "text_input": FakeTextInput,
        })

        orchestrator = Orchestrator(graph, registry)
        results = await orchestrator.execute(target=n2)

        assert results[n1]["status"] == "failed"
        assert results[n2]["status"] == "cancelled"

    @pytest.mark.asyncio
    async def test_cancellation_flag(self):
        """Setting cancelled=True stops execution."""
        n1 = uuid4()

        graph = _make_graph({
            n1: {
                "content": "test",
                "class_type": "text_input",
                "parents": [],
                "children": [],
            },
        })

        registry = _make_registry({"text_input": FakeTextInput})

        orchestrator = Orchestrator(graph, registry)
        orchestrator.cancelled = True
        results = await orchestrator.execute(target=n1)

        assert results[n1]["status"] == "cancelled"


class TestOrchestratorStreaming:
    """Test SSE event streaming execution."""

    @pytest.mark.asyncio
    async def test_stream_execute_emits_events(self):
        """stream_execute yields proper SSE events."""
        n1 = uuid4()

        graph = _make_graph({
            n1: {
                "content": "Hello",
                "class_type": "text_input",
                "parents": [],
                "children": [],
            },
        })

        registry = _make_registry({"text_input": FakeTextInput})

        orchestrator = Orchestrator(graph, registry)
        events = []
        async for event in orchestrator.stream_execute(target=n1):
            events.append(event)

        event_types = [e["event"] for e in events]
        assert "execution_start" in event_types
        assert "node_start" in event_types
        assert "node_complete" in event_types
        assert "execution_complete" in event_types

    @pytest.mark.asyncio
    async def test_stream_terminal_node(self):
        """Terminal LLM node uses stream method."""
        n1 = uuid4()
        n2 = uuid4()

        graph = _make_graph({
            n1: {
                "content": "Hello",
                "class_type": "text_input",
                "parents": [],
                "children": [n2],
            },
            n2: {
                "content": "",
                "class_type": "llm_chat",
                "parents": [n1],
                "children": [],
                "connections": {
                    "prompt": {"source_node_id": str(n1), "output_name": "text"},
                },
            },
        })

        registry = _make_registry({
            "text_input": FakeTextInput,
            "llm_chat": FakeLLMChat,
        })

        orchestrator = Orchestrator(graph, registry)
        events = []
        async for event in orchestrator.stream_execute(target=n2):
            events.append(event)

        # Should have node_complete for both nodes
        complete_events = [e for e in events if e["event"] == "node_complete"]
        assert len(complete_events) == 2

        # Terminal node should have response in outputs
        terminal_event = [e for e in complete_events if e["data"]["node_id"] == str(n2)][0]
        assert "Answer to: Hello" in terminal_event["data"]["outputs"]["response"]


class TestTemplateVariableSubstitution:
    """Test {{variable}} substitution in prompts."""

    def test_substitute_simple_vars(self):
        """Variables in prompt are replaced with resolved values."""
        inputs = {
            "prompt": "Explain {{topic}} for {{audience}}",
            "topic": "quantum physics",
            "audience": "kids",
        }
        result = Orchestrator._substitute_template_vars(inputs)
        assert result["prompt"] == "Explain quantum physics for kids"

    def test_substitute_missing_var_unchanged(self):
        """Unresolved {{var}} stays as-is."""
        inputs = {"prompt": "Explain {{topic}} for {{audience}}"}
        result = Orchestrator._substitute_template_vars(inputs)
        assert result["prompt"] == "Explain {{topic}} for {{audience}}"

    def test_substitute_partial(self):
        """Mix of resolved and unresolved vars."""
        inputs = {
            "prompt": "Tell me about {{subject}} in {{language}}",
            "subject": "gravity",
        }
        result = Orchestrator._substitute_template_vars(inputs)
        assert result["prompt"] == "Tell me about gravity in {{language}}"

    def test_no_template_vars(self):
        """Prompt without {{}} passes through unchanged."""
        inputs = {"prompt": "Just a normal prompt", "context": "some context"}
        result = Orchestrator._substitute_template_vars(inputs)
        assert result["prompt"] == "Just a normal prompt"

    @pytest.mark.asyncio
    async def test_template_vars_in_execution(self):
        """End-to-end: TextInput → LLMChat with {{}} in prompt."""
        n1 = uuid4()
        n2 = uuid4()

        graph = _make_graph({
            n1: {
                "content": "quantum computing",
                "class_type": "text_input",
                "parents": [],
                "children": [n2],
            },
            n2: {
                "content": "Explain {{topic}} simply",
                "class_type": "llm_chat",
                "parents": [n1],
                "children": [],
                "connections": {
                    "topic": {"source_node_id": str(n1), "output_name": "text"},
                },
            },
        })

        registry = _make_registry({
            "text_input": FakeTextInput,
            "llm_chat": FakeLLMChat,
        })

        orchestrator = Orchestrator(graph, registry)
        results = await orchestrator.execute(target=n2)

        assert results[n2]["status"] == "completed"
        # The prompt should have been substituted: "Explain quantum computing simply"
        assert "Answer to: Explain quantum computing simply" in results[n2]["outputs"]["response"]
