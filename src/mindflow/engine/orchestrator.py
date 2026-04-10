"""Orchestrator — context-aware graph execution engine.

The orchestrator is the brain of MindFlow's execution model. It:
1. Walks the ancestor tree of a target node (topological sort)
2. Executes each node in order, passing parent outputs as child inputs
3. Reconstructs context from the graph at each step (no accumulated LLM state)
4. The graph IS the memory — not the LLM's conversation history

Key differences from a simple executor:
- Parent outputs flow to child inputs via the node's `connections` mapping
- LLM providers are injected per-node (supports mixed providers in one graph)
- Web LLMs (ChatGPT Web, Gemini Web) get fresh sessions per execution
- The terminal node can stream its output via SSE

Architecture:
    TextInput("Explain X") ──→ {text: "Explain X"}
         │ [text → prompt]
    LLMChat(prompt=...) ──→ {response: "...", context: "User: ... Assistant: ..."}
         │ [context → context]
    LLMChat(prompt="Go deeper") ──→ {response: "...", context: "..."}

Each node receives ONLY what its connections explicitly map from parent outputs.
No implicit context accumulation. The graph defines what each node sees.
"""

import asyncio
import json
import logging
import re
from typing import Any, AsyncIterator
from uuid import UUID

from mindflow.engine.executor import GraphExecutor, CycleDetectedError

logger = logging.getLogger(__name__)


class Orchestrator:
    """Context-aware graph execution engine.

    Executes nodes in topological order, routing parent outputs
    to child inputs based on explicit connection mappings.

    Args:
        graph: The Graph object containing nodes and their connections.
        registry: PluginRegistry with loaded node classes.
        provider_resolver: Callable that resolves a provider_id to a provider instance.
    """

    def __init__(
        self,
        graph: Any,
        registry: Any,
        provider_resolver: Any = None,
    ):
        self._graph = graph
        self._registry = registry
        self._provider_resolver = provider_resolver

        # Build adjacency for the executor
        self._adjacency: dict[UUID, dict[str, list[UUID]]] = {}
        for node_uuid, node in graph.nodes.items():
            self._adjacency[node_uuid] = {
                "children": list(node.children),
                "parents": list(node.parents),
            }

        self._executor = GraphExecutor(self._adjacency)

        # Stores outputs from executed nodes: {node_id: {output_name: value}}
        self._outputs: dict[UUID, dict[str, Any]] = {}

        # Cancellation flag
        self.cancelled = False

    def _resolve_inputs(self, node_id: UUID) -> dict[str, Any]:
        """Build the input dict for a node by resolving connections from parent outputs.

        For each input defined in the node's `connections`, looks up the
        source node's output and maps it. Falls back to the node's own
        `inputs` dict for values not connected to a parent.

        Returns:
            Dict of input_name -> value, ready to pass to node.execute()
        """
        node = self._graph.nodes[node_id]
        inputs: dict[str, Any] = {}

        # Start with the node's own static inputs (user-entered values)
        if node.inputs:
            inputs.update(node.inputs)

        # If the node has content (legacy text field), use it as text/prompt
        if node.content and "text" not in inputs:
            inputs["text"] = node.content
        if node.content and "prompt" not in inputs:
            inputs["prompt"] = node.content

        # Override with connected parent outputs
        connections = node.connections or {}
        for input_name, conn_spec in connections.items():
            if isinstance(conn_spec, dict):
                source_node_id = conn_spec.get("source_node_id")
                output_name = conn_spec.get("output_name", "text")

                if source_node_id:
                    source_uuid = UUID(source_node_id) if isinstance(source_node_id, str) else source_node_id
                    parent_outputs = self._outputs.get(source_uuid, {})
                    if output_name in parent_outputs:
                        inputs[input_name] = parent_outputs[output_name]

        # Auto-wire: if node has parents but no explicit connections,
        # build context from all parent outputs (backward compatibility)
        if not connections and node.parents:
            context_parts = []
            for parent_id in node.parents:
                parent_outputs = self._outputs.get(parent_id, {})
                # Collect response or text from parent
                if "response" in parent_outputs:
                    parent_node = self._graph.nodes.get(parent_id)
                    parent_prompt = parent_node.content if parent_node else ""
                    context_parts.append(
                        f"User: {parent_prompt}\nAssistant: {parent_outputs['response']}"
                    )
                elif "context" in parent_outputs:
                    context_parts.append(parent_outputs["context"])
                elif "text" in parent_outputs:
                    context_parts.append(parent_outputs["text"])

            if context_parts:
                inputs["context"] = "\n\n".join(context_parts)

        # Fill missing inputs with defaults from INPUT_TYPES metadata
        node_cls = self._get_node_class(node_id)
        if node_cls is not None:
            input_types_func = getattr(node_cls, "INPUT_TYPES", None)
            if callable(input_types_func):
                try:
                    input_types = input_types_func()
                    for section_name in ("required", "optional"):
                        section = input_types.get(section_name, {})
                        for input_name, spec in section.items():
                            if input_name in inputs:
                                continue
                            # Parse spec: ("TYPE", {opts}) or InputSpec
                            if isinstance(spec, (list, tuple)) and len(spec) >= 2:
                                type_name = spec[0]
                                opts = spec[1] if isinstance(spec[1], dict) else {}
                            else:
                                continue
                            # COMBO: default to first option
                            if type_name == "COMBO" and "options" in opts:
                                inputs[input_name] = opts.get("default", opts["options"][0])
                            elif "default" in opts:
                                inputs[input_name] = opts["default"]
                except Exception as e:
                    logger.warning("INPUT_TYPES() failed for node %s (class=%s): %s",
                                   node_id, node.class_type, e)

        # Substitute template variables in string inputs: {{var_name}}
        inputs = self._substitute_template_vars(inputs)

        return inputs

    @staticmethod
    def _substitute_template_vars(inputs: dict[str, Any]) -> dict[str, Any]:
        """Replace {{variable}} placeholders in string inputs with resolved values.

        For each string-valued input, finds all {{name}} patterns and replaces
        them with the value of `inputs[name]` if it exists. This allows nodes
        to act as parameterized templates.

        Example:
            inputs = {"prompt": "Explain {{topic}} for {{audience}}", "topic": "gravity", "audience": "kids"}
            → {"prompt": "Explain gravity for kids", "topic": "gravity", "audience": "kids"}
        """
        pattern = re.compile(r"\{\{(\w+)\}\}")

        result = dict(inputs)
        for key, value in result.items():
            if isinstance(value, str) and "{{" in value:
                def replacer(match: re.Match) -> str:
                    var_name = match.group(1)
                    replacement = inputs.get(var_name)
                    if replacement is not None:
                        return str(replacement)
                    return match.group(0)  # Keep original if not found

                result[key] = pattern.sub(replacer, value)

        return result

    def _get_node_class(self, node_id: UUID) -> Any:
        """Get the plugin class for a node.

        Returns None only for nodes with no class_type (plain text nodes).
        Raises ValueError if class_type is set but not found in registry.
        """
        node = self._graph.nodes[node_id]
        class_type = node.class_type
        if not class_type:
            return self._registry.node_classes.get("text_input")
        node_cls = self._registry.node_classes.get(class_type)
        if node_cls is None:
            raise ValueError(
                f"Unknown node class_type '{class_type}' for node {node_id}. "
                f"Is the plugin loaded? Available: {list(self._registry.node_classes.keys())}"
            )
        return node_cls

    async def _resolve_provider(self, node_id: UUID) -> Any:
        """Resolve the provider instance for a node.

        Resolution order:
        1. Explicit provider_id on the node
        2. Auto-detect from plugin class_type category (e.g., llm/chatgpt_web → chatgpt_web)
        """
        if self._provider_resolver is None:
            return None
        node = self._graph.nodes[node_id]

        # 1. Explicit provider_id
        if node.provider_id:
            return self._provider_resolver(str(node.provider_id))

        # 2. Auto-resolve from plugin category
        class_type = node.class_type or "text_input"
        node_cls = self._registry.node_classes.get(class_type)
        if node_cls is None:
            return None

        category = getattr(node_cls, "CATEGORY", "")
        if not category.startswith("llm/"):
            return None

        # Extract provider type from category: "llm/chatgpt_web" → "chatgpt_web"
        plugin_provider_type = category.split("/")[1]
        # Map plugin category to ProviderType (ollama → local)
        if plugin_provider_type == "ollama":
            plugin_provider_type = "local"

        # Find matching provider in registry
        from mindflow.api.routes.providers import _get_registry
        provider_registry = _get_registry()
        for p_config in provider_registry.list_providers():
            if p_config.type.value == plugin_provider_type:
                instance = provider_registry.get_provider_instance(str(p_config.id))
                if instance:
                    return instance

        return None

    async def _execute_node(self, node_id: UUID) -> dict[str, Any]:
        """Execute a single node and return its outputs as a dict.

        Resolves inputs from parent outputs, creates a node instance,
        injects the provider if needed, and calls the execution function.
        """
        node = self._graph.nodes[node_id]
        node_cls = self._get_node_class(node_id)

        if node_cls is None:
            # Plain text node (no class_type) — pass through content
            outputs = {"text": node.content or ""}
            self._outputs[node_id] = outputs
            return outputs

        # Resolve inputs from connections + static values
        inputs = self._resolve_inputs(node_id)

        # Inject provider for LLM nodes
        provider = await self._resolve_provider(node_id)
        if provider is not None:
            inputs["provider"] = provider

        # Create instance and execute
        instance = node_cls()
        func_name = getattr(node_cls, "FUNCTION", "execute")
        func = getattr(instance, func_name, None)

        if func is None:
            raise ValueError(
                f"Node class '{node.class_type}' has no function '{func_name}'. "
                f"Check the plugin's FUNCTION attribute."
            )

        # Call execute
        result = func(**inputs)
        # Handle both sync and async
        if asyncio.iscoroutine(result):
            result = await result

        # Convert tuple result to named outputs
        return_names = getattr(node_cls, "RETURN_NAMES", ("text",))
        if isinstance(result, tuple):
            outputs = {}
            for i, name in enumerate(return_names):
                if i < len(result):
                    outputs[name] = result[i]
            self._outputs[node_id] = outputs
        elif isinstance(result, dict):
            self._outputs[node_id] = result
            outputs = result
        else:
            outputs = {return_names[0] if return_names else "text": result}
            self._outputs[node_id] = outputs

        return outputs

    async def execute(self, target: UUID) -> dict[UUID, dict[str, Any]]:
        """Execute the sub-graph for target node, routing outputs between nodes.

        Returns:
            Dict mapping node_id to {status, outputs, error}
        """
        execution_order = self._executor.topological_sort(target)
        results: dict[UUID, dict[str, Any]] = {}
        failed_ancestors: set[UUID] = set()

        for node_id in execution_order:
            if self.cancelled:
                results[node_id] = {"status": "cancelled"}
                continue

            # Check parent failures
            parents = self._adjacency.get(node_id, {}).get("parents", [])
            if any(p in failed_ancestors for p in parents):
                results[node_id] = {"status": "cancelled"}
                failed_ancestors.add(node_id)
                continue

            try:
                outputs = await self._execute_node(node_id)
                results[node_id] = {"status": "completed", "outputs": outputs}
            except Exception as e:
                results[node_id] = {"status": "failed", "error": str(e)}
                failed_ancestors.add(node_id)
                logger.error("Node %s failed: %s", node_id, e)

        return results

    async def stream_execute(self, target: UUID) -> AsyncIterator[dict[str, Any]]:
        """Execute with SSE event streaming.

        All ancestor nodes execute in batch. The terminal (target) node
        streams its output token-by-token if it supports streaming.
        """
        logger.info("stream_execute: target=%s", target)
        try:
            execution_order = self._executor.topological_sort(target)
        except CycleDetectedError as e:
            yield {"event": "execution_error", "data": {"error": str(e)}}
            return

        logger.info("Execution order: %s (%d nodes)", [str(n) for n in execution_order], len(execution_order))

        yield {
            "event": "execution_start",
            "data": {
                "execution_order": [str(n) for n in execution_order],
                "target_node_id": str(target),
            },
        }

        failed_ancestors: set[UUID] = set()

        for node_id in execution_order:
            if self.cancelled:
                yield {
                    "event": "node_error",
                    "data": {"node_id": str(node_id), "error": "Execution cancelled"},
                }
                continue

            # Check parent failures
            parents = self._adjacency.get(node_id, {}).get("parents", [])
            if any(p in failed_ancestors for p in parents):
                failed_ancestors.add(node_id)
                yield {
                    "event": "node_error",
                    "data": {
                        "node_id": str(node_id),
                        "error": "Cancelled due to parent failure",
                    },
                }
                continue

            yield {"event": "node_start", "data": {"node_id": str(node_id)}}

            # Terminal node: try streaming if supported
            is_terminal = (node_id == target)

            if is_terminal:
                node_cls = self._get_node_class(node_id)
                is_streamable = getattr(node_cls, "STREAMING", False) if node_cls else False

                if is_streamable and node_cls is not None:
                    try:
                        # Stream tokens via SSE events
                        async for event in self._stream_terminal_node_events(node_id, node_cls):
                            yield event
                    except Exception as e:
                        failed_ancestors.add(node_id)
                        yield {
                            "event": "node_error",
                            "data": {"node_id": str(node_id), "error": str(e)},
                        }
                    continue

            # Non-terminal or non-streamable: execute in batch
            try:
                outputs = await self._execute_node(node_id)
                yield {
                    "event": "node_complete",
                    "data": {"node_id": str(node_id), "outputs": outputs},
                }
            except Exception as e:
                failed_ancestors.add(node_id)
                yield {
                    "event": "node_error",
                    "data": {"node_id": str(node_id), "error": str(e)},
                }

        has_failures = len(failed_ancestors) > 0
        yield {
            "event": "execution_complete" if not has_failures else "execution_error",
            "data": {"status": "failed" if has_failures else "completed"},
        }

    async def _stream_terminal_node_events(
        self, node_id: UUID, node_cls: Any
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream the terminal node's output as SSE token events.

        Yields token events during streaming, then a node_complete event
        with the full outputs dict.
        """
        node = self._graph.nodes[node_id]
        inputs = self._resolve_inputs(node_id)
        logger.info("Streaming node %s (class=%s), inputs keys: %s",
                     node_id, node.class_type, list(inputs.keys()))

        provider = await self._resolve_provider(node_id)
        if provider is not None:
            inputs["provider"] = provider
            logger.info("Provider resolved for node %s: %s", node_id, type(provider).__name__)
        else:
            logger.warning("No provider resolved for node %s (class=%s)", node_id, node.class_type)

        instance = node_cls()
        stream_func = getattr(instance, "stream", None)

        if stream_func is None:
            raise ValueError(
                f"Node class '{node.class_type}' declares STREAMING=True "
                f"but has no stream() method."
            )

        # Stream tokens one by one
        logger.info("Starting stream for node %s with model=%s", node_id, inputs.get("model", "?"))
        tokens = []
        async for token in stream_func(**inputs):
            tokens.append(token)
            yield {
                "event": "token",
                "data": {"node_id": str(node_id), "token": token},
            }

        full_response = "".join(tokens)

        # Build outputs dict
        return_names = getattr(node_cls, "RETURN_NAMES", ("response",))
        outputs: dict[str, Any] = {}
        if return_names:
            outputs[return_names[0]] = full_response
        if len(return_names) > 1 and return_names[1] == "context":
            context = inputs.get("context", "")
            prompt = inputs.get("prompt", node.content or "")
            if context:
                context += "\n\n"
            context += f"User: {prompt}\nAssistant: {full_response}"
            outputs["context"] = context
        if "prompt" in return_names:
            outputs["prompt"] = inputs.get("prompt", node.content or "")

        self._outputs[node_id] = outputs

        # Also persist the response to the node model
        node.llm_response = full_response
        node.llm_status = "complete"

        yield {
            "event": "node_complete",
            "data": {"node_id": str(node_id), "outputs": outputs},
        }

