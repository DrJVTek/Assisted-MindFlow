"""Integration test: 3-node chain execution via GraphExecutor."""

import asyncio
from uuid import uuid4

import pytest

from mindflow.engine.executor import GraphExecutor


class TestExecutionPipeline:
    """T077: Full 3-node chain execution (TextInput → LLMChat → output)."""

    @pytest.mark.asyncio
    async def test_three_node_chain_executes_in_order(self):
        """TextInput → Transform → Output chain executes in correct topological order."""
        text_input = uuid4()
        transform = uuid4()
        output = uuid4()

        adjacency = {
            text_input: {"children": [transform], "parents": []},
            transform: {"children": [output], "parents": [text_input]},
            output: {"children": [], "parents": [transform]},
        }

        execution_log = []

        async def run_text_input():
            execution_log.append("text_input")
            return {"text": "What is AI?"}

        async def run_transform():
            execution_log.append("transform")
            return {"text": "Processed: What is AI?"}

        async def run_output():
            execution_log.append("output")
            return {"response": "AI is artificial intelligence."}

        executor = GraphExecutor(adjacency)
        executor.set_node_executor(text_input, run_text_input)
        executor.set_node_executor(transform, run_transform)
        executor.set_node_executor(output, run_output)

        results = await executor.execute(target=output)

        # All three ran in order
        assert execution_log == ["text_input", "transform", "output"]
        assert results[text_input]["status"] == "completed"
        assert results[transform]["status"] == "completed"
        assert results[output]["status"] == "completed"
        assert results[output]["outputs"]["response"] == "AI is artificial intelligence."

    @pytest.mark.asyncio
    async def test_stream_execute_emits_correct_events(self):
        """stream_execute yields execution_start, node_start/complete, execution_complete."""
        a, b = uuid4(), uuid4()
        adjacency = {
            a: {"children": [b], "parents": []},
            b: {"children": [], "parents": [a]},
        }

        async def succeed():
            return {"text": "ok"}

        executor = GraphExecutor(adjacency)
        executor.set_node_executor(a, succeed)
        executor.set_node_executor(b, succeed)

        events = []
        async for event in executor.stream_execute(target=b):
            events.append(event["event"])

        assert events[0] == "execution_start"
        assert "node_start" in events
        assert "node_complete" in events
        assert events[-1] == "execution_complete"

    @pytest.mark.asyncio
    async def test_middle_node_failure_cancels_downstream(self):
        """If the middle node fails, the output node is cancelled."""
        a, b, c = uuid4(), uuid4(), uuid4()
        adjacency = {
            a: {"children": [b], "parents": []},
            b: {"children": [c], "parents": [a]},
            c: {"children": [], "parents": [b]},
        }

        async def succeed():
            return {"text": "ok"}

        async def fail():
            raise RuntimeError("API error")

        executor = GraphExecutor(adjacency)
        executor.set_node_executor(a, succeed)
        executor.set_node_executor(b, fail)
        executor.set_node_executor(c, succeed)

        results = await executor.execute(target=c)

        assert results[a]["status"] == "completed"
        assert results[b]["status"] == "failed"
        assert results[c]["status"] == "cancelled"
