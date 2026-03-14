"""Debate engine service (Feature 011 - US2).

Orchestrates sequential LLM debates between connected nodes.
Each node in the chain generates a response via its assigned provider,
receiving the full conversation history from all prior nodes.
"""

import asyncio
import logging
from typing import Dict, List, Optional
from uuid import UUID

from mindflow.models.debate import DebateChain, DebateStatus
from mindflow.models.graph import Graph
from mindflow.services.provider_registry import ProviderRegistry
from mindflow.utils.cycles import has_cycle

logger = logging.getLogger(__name__)

# In-memory storage for active debates
_debates: Dict[str, DebateChain] = {}


def get_debate(debate_id: str) -> Optional[DebateChain]:
    """Get a debate by ID."""
    return _debates.get(debate_id)


def list_debates(graph_id: Optional[str] = None) -> List[DebateChain]:
    """List debates, optionally filtered by graph."""
    debates = list(_debates.values())
    if graph_id:
        gid = UUID(graph_id)
        debates = [d for d in debates if d.graph_id == gid]
    return debates


def discover_chain(graph: Graph, start_node_id: UUID) -> List[UUID]:
    """Walk edges from start_node to discover the debate chain.

    Follows child_ids depth-first from the start node, collecting
    all nodes into an ordered chain. Stops at nodes with no children
    or when all children have been visited.

    Args:
        graph: The graph containing the nodes
        start_node_id: Node to start walking from

    Returns:
        Ordered list of node UUIDs forming the debate chain

    Raises:
        ValueError: If start_node not found or chain has fewer than 2 nodes
    """
    if start_node_id not in graph.nodes:
        raise ValueError(f"Start node {start_node_id} not found in graph")

    chain: List[UUID] = []
    visited: set[UUID] = set()

    # DFS traversal following children
    stack = [start_node_id]
    while stack:
        node_id = stack.pop()
        if node_id in visited:
            continue
        visited.add(node_id)
        chain.append(node_id)

        node = graph.nodes.get(node_id)
        if node and hasattr(node, 'children'):
            # Add children in reverse order so first child is processed first
            for child_id in reversed(node.children):
                if child_id not in visited and child_id in graph.nodes:
                    stack.append(child_id)

    if len(chain) < 2:
        raise ValueError(
            f"Chain from node {start_node_id} has fewer than 2 nodes. "
            "A debate requires at least 2 connected nodes."
        )

    return chain


def check_chain_cycles(graph: Graph, chain: List[UUID]) -> bool:
    """Check if the chain nodes form a cycle in the graph.

    Args:
        graph: The graph containing the nodes
        chain: Node IDs in the chain

    Returns:
        True if cycles exist among chain nodes
    """
    chain_set = set(chain)
    edges = []
    for nid in chain:
        node = graph.nodes.get(nid)
        if node and hasattr(node, 'children'):
            for child_id in node.children:
                if child_id in chain_set:
                    edges.append((nid, child_id))
    return has_cycle(edges)


def validate_providers(graph: Graph, chain: List[UUID]) -> List[UUID]:
    """Validate that all nodes in the chain have provider_id assigned.

    Returns list of node IDs missing provider assignments.
    """
    missing = []
    for nid in chain:
        node = graph.nodes.get(nid)
        if node is None:
            missing.append(nid)
        elif not getattr(node, 'provider_id', None):
            missing.append(nid)
    return missing


async def start_debate(
    graph: Graph,
    start_node_id: UUID,
    max_rounds: int,
    registry: ProviderRegistry,
) -> DebateChain:
    """Start a new debate chain.

    Discovers the chain, validates providers, and begins execution.

    Args:
        graph: The graph containing the nodes
        start_node_id: First node in the debate
        max_rounds: Maximum number of debate rounds
        registry: Provider registry for instantiating providers

    Returns:
        The created DebateChain

    Raises:
        ValueError: If chain is invalid (too few nodes, missing providers, etc.)
    """
    # Discover chain
    chain = discover_chain(graph, start_node_id)

    # Check for existing running debate on same chain
    for debate in _debates.values():
        if (
            debate.graph_id == graph.id
            and debate.start_node_id == start_node_id
            and not debate.is_terminal()
        ):
            raise ValueError("Debate already running on this chain")

    # Check cycles — if cyclic, cap at max_rounds
    is_cyclic = check_chain_cycles(graph, chain)
    if is_cyclic:
        logger.info("Chain has cycles — debate will be capped at %d rounds", max_rounds)

    # Validate all nodes have providers
    missing = validate_providers(graph, chain)
    if missing:
        raise ValueError(
            f"Nodes missing provider assignments: {[str(m) for m in missing]}"
        )

    # Create debate
    debate = DebateChain(
        graph_id=graph.id,
        start_node_id=start_node_id,
        node_ids=chain,
        max_rounds=max_rounds,
        status=DebateStatus.RUNNING,
    )
    _debates[str(debate.id)] = debate

    # Execute debate asynchronously
    asyncio.create_task(_execute_debate(debate, graph, registry))

    return debate


async def continue_debate(
    debate_id: str,
    additional_rounds: int,
    graph: Graph,
    registry: ProviderRegistry,
) -> DebateChain:
    """Continue a completed debate for additional rounds."""
    debate = _debates.get(debate_id)
    if debate is None:
        raise ValueError("Debate not found")
    if not debate.is_terminal():
        raise ValueError("Debate is still running")

    debate.max_rounds += additional_rounds
    debate.status = DebateStatus.RUNNING
    debate.error_message = None
    debate.touch()

    asyncio.create_task(_execute_debate(debate, graph, registry))

    return debate


def stop_debate(debate_id: str) -> Optional[DebateChain]:
    """Stop a running debate."""
    debate = _debates.get(debate_id)
    if debate is None:
        return None
    if not debate.is_terminal():
        debate.status = DebateStatus.STOPPED
        debate.touch()
    return debate


async def _execute_debate(
    debate: DebateChain,
    graph: Graph,
    registry: ProviderRegistry,
) -> None:
    """Execute the debate rounds.

    For each round, iterate through the chain nodes sequentially.
    Each node's provider generates a response given the accumulated
    conversation history from prior nodes.
    """
    try:
        while debate.round_count < debate.max_rounds:
            if debate.status != DebateStatus.RUNNING:
                break

            debate.round_count += 1
            debate.touch()
            logger.info(
                "Debate %s: starting round %d/%d",
                debate.id, debate.round_count, debate.max_rounds,
            )

            # Build conversation history from all nodes
            history: List[Dict[str, str]] = []

            for node_id in debate.node_ids:
                if debate.status != DebateStatus.RUNNING:
                    break

                node = graph.nodes.get(node_id)
                if node is None:
                    continue

                provider_id = str(node.provider_id) if node.provider_id else None
                if not provider_id:
                    continue

                provider_instance = registry.get_provider_instance(provider_id)
                if provider_instance is None:
                    debate.status = DebateStatus.ERROR
                    debate.error_message = f"Provider not available for node {node_id}"
                    debate.touch()
                    return

                # Get the provider config for model selection
                provider_config = registry.get_provider(provider_id)
                model = provider_config.selected_model if provider_config else "default"

                # Build prompt from history
                history_text = _format_history(history)
                prompt = node.content or ""
                if history_text:
                    full_prompt = f"{history_text}\n\n---\n\n{prompt}"
                else:
                    full_prompt = prompt

                try:
                    response = await provider_instance.generate(
                        prompt=full_prompt,
                        model=model or "default",
                        system_prompt="You are participating in a multi-LLM debate. "
                        "Respond to the conversation history and the current prompt. "
                        "Be concise and substantive.",
                    )

                    # Update node with response
                    node.llm_response = response
                    node.llm_status = "complete"

                    # Add to history
                    provider_name = provider_config.name if provider_config else "Unknown"
                    history.append({
                        "role": provider_name,
                        "content": response,
                    })

                except Exception as exc:
                    logger.error(
                        "Debate %s: provider error for node %s: %s",
                        debate.id, node_id, exc,
                    )
                    node.llm_status = "error"
                    node.llm_error = str(exc)
                    # Continue with remaining nodes in this round
                    history.append({
                        "role": "error",
                        "content": f"[Error: {exc}]",
                    })

        # Mark complete
        if debate.status == DebateStatus.RUNNING:
            debate.status = DebateStatus.COMPLETED
            debate.touch()
            logger.info("Debate %s completed after %d rounds", debate.id, debate.round_count)

    except Exception as exc:
        logger.exception("Debate %s failed: %s", debate.id, exc)
        debate.status = DebateStatus.ERROR
        debate.error_message = str(exc)
        debate.touch()


def _format_history(history: List[Dict[str, str]]) -> str:
    """Format conversation history as text for the next provider."""
    if not history:
        return ""
    lines = []
    for entry in history:
        role = entry.get("role", "Unknown")
        content = entry.get("content", "")
        lines.append(f"[{role}]: {content}")
    return "\n\n".join(lines)
