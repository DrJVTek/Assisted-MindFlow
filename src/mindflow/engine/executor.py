"""Graph Execution Engine — topological sort and dependency-aware execution.

Executes nodes in topological order, resolving parent dependencies before
children. The terminal (target) node can optionally stream its output via SSE.

Key design (from research.md R4):
- DFS-based topological sort with cycle detection
- Sub-graph extraction: only execute ancestors of target node
- Parents execute in batch (await all), terminal node streams
- Parent failure cancels downstream nodes
"""

import asyncio
import logging
from typing import Any, AsyncIterator, Callable, Awaitable
from uuid import UUID

logger = logging.getLogger(__name__)


class CycleDetectedError(Exception):
    """Raised when a cycle is found during topological sort."""

    def __init__(self, cycle_nodes: list[UUID]):
        self.cycle_nodes = cycle_nodes
        super().__init__(
            f"Cycle detected in graph involving nodes: "
            f"{[str(n) for n in cycle_nodes]}"
        )


class GraphExecutor:
    """Execute nodes in a graph following topological order.

    Supports dirty/clean execution caching:
    - Nodes start as DIRTY (no cached result)
    - After successful execution, nodes become CLEAN with cached output
    - mark_dirty(node_id) invalidates a node and all its descendants
    - Clean nodes are skipped during execution (emit node_skip SSE event)

    Args:
        adjacency: Dict mapping node UUID to {"children": [...], "parents": [...]}
    """

    def __init__(self, adjacency: dict[UUID, dict[str, list[UUID]]]):
        self._adjacency = adjacency
        self._executors: dict[UUID, Callable[[], Awaitable[Any]]] = {}
        # Dirty/clean execution cache
        self._execution_cache: dict[UUID, tuple] = {}
        self._dirty_nodes: set[UUID] = set()
        # All nodes start dirty (no cached result)
        for node_id in adjacency:
            self._dirty_nodes.add(node_id)

    def set_node_executor(
        self,
        node_id: UUID,
        executor: Callable[[], Awaitable[Any]],
    ) -> None:
        """Register an async callable to execute a specific node."""
        self._executors[node_id] = executor

    def mark_dirty(self, node_id: UUID) -> list[UUID]:
        """Mark a node and all its descendants as dirty.

        Returns list of all nodes that were marked dirty.
        """
        dirty_list: list[UUID] = []
        to_visit = [node_id]
        while to_visit:
            current = to_visit.pop()
            if current not in self._dirty_nodes:
                self._dirty_nodes.add(current)
                # Remove cached output
                self._execution_cache.pop(current, None)
                dirty_list.append(current)
                # Propagate to children
                node_info = self._adjacency.get(current, {})
                for child_id in node_info.get("children", []):
                    if child_id not in self._dirty_nodes:
                        to_visit.append(child_id)
            elif current == node_id:
                # Always include the root even if already dirty
                dirty_list.append(current)
        return dirty_list

    def is_dirty(self, node_id: UUID) -> bool:
        """Check if a node needs re-execution."""
        return node_id in self._dirty_nodes

    def topological_sort(self, target: UUID) -> list[UUID]:
        """Return execution order for target node and all its ancestors.

        Uses DFS with cycle detection. Only includes nodes that are
        ancestors of the target (sub-graph extraction).

        Args:
            target: The node to execute (and resolve dependencies for).

        Returns:
            List of node UUIDs in topological order (parents first).

        Raises:
            CycleDetectedError: If a cycle is detected.
        """
        # Collect all ancestors of target via DFS
        visited: set[UUID] = set()
        in_stack: set[UUID] = set()
        order: list[UUID] = []

        def dfs(node_id: UUID) -> None:
            if node_id in in_stack:
                # Cycle detected — collect cycle nodes
                raise CycleDetectedError(list(in_stack))
            if node_id in visited:
                return

            in_stack.add(node_id)
            visited.add(node_id)

            # Visit all parents first (so they appear before this node)
            node_info = self._adjacency.get(node_id)
            if node_info:
                for parent_id in node_info.get("parents", []):
                    dfs(parent_id)

            in_stack.discard(node_id)
            order.append(node_id)

        dfs(target)
        return order

    async def execute(self, target: UUID) -> dict[UUID, dict[str, Any]]:
        """Execute the sub-graph needed for target node.

        Runs nodes in topological order. If any parent fails,
        all downstream nodes are marked as cancelled.

        Args:
            target: The node to execute.

        Returns:
            Dict mapping node_id to result: {"status": "completed"/"failed"/"cancelled", ...}
        """
        execution_order = self.topological_sort(target)
        results: dict[UUID, dict[str, Any]] = {}
        failed_ancestors: set[UUID] = set()

        for node_id in execution_order:
            # Check if any parent has failed
            node_info = self._adjacency.get(node_id, {})
            parents = node_info.get("parents", [])
            has_failed_parent = any(p in failed_ancestors for p in parents)

            if has_failed_parent:
                results[node_id] = {"status": "cancelled"}
                failed_ancestors.add(node_id)
                logger.info("Node %s cancelled due to parent failure", node_id)
                continue

            # Dirty/clean check: skip clean nodes with cached result
            if not self.is_dirty(node_id) and node_id in self._execution_cache:
                results[node_id] = {
                    "status": "completed",
                    "outputs": self._execution_cache[node_id],
                    "cached": True,
                }
                logger.debug("Node %s is clean, returning cached result", node_id)
                continue

            executor = self._executors.get(node_id)
            if executor is None:
                # No executor registered — treat as no-op success
                results[node_id] = {"status": "completed", "outputs": {}}
                self._dirty_nodes.discard(node_id)
                continue

            try:
                outputs = await executor()
                output_val = outputs if isinstance(outputs, dict) else {}
                results[node_id] = {
                    "status": "completed",
                    "outputs": output_val,
                    "cached": False,
                }
                # Mark clean and cache output
                self._dirty_nodes.discard(node_id)
                self._execution_cache[node_id] = output_val
            except Exception as e:
                results[node_id] = {
                    "status": "failed",
                    "error": str(e),
                }
                failed_ancestors.add(node_id)
                logger.error("Node %s failed: %s", node_id, e)

        return results

    async def stream_execute(
        self,
        target: UUID,
    ) -> AsyncIterator[dict[str, Any]]:
        """Execute sub-graph with SSE-compatible event streaming.

        Yields events matching the execution-api.md SSE contract:
        - execution_start, node_start, node_complete, node_error,
          execution_complete, execution_error

        Args:
            target: The node to execute with streaming.

        Yields:
            Event dicts: {"event": str, "data": dict}
        """
        try:
            execution_order = self.topological_sort(target)
        except CycleDetectedError as e:
            yield {
                "event": "execution_error",
                "data": {"error": str(e)},
            }
            return

        execution_id = str(target)  # Simplified — real impl uses UUID

        yield {
            "event": "execution_start",
            "data": {
                "execution_id": execution_id,
                "execution_order": [str(n) for n in execution_order],
            },
        }

        failed_ancestors: set[UUID] = set()
        all_results: dict[str, dict] = {}

        for node_id in execution_order:
            node_info = self._adjacency.get(node_id, {})
            parents = node_info.get("parents", [])
            has_failed_parent = any(p in failed_ancestors for p in parents)

            if has_failed_parent:
                failed_ancestors.add(node_id)
                cancelled_downstream = [
                    str(n) for n in execution_order
                    if n != node_id and any(
                        p in failed_ancestors
                        for p in self._adjacency.get(n, {}).get("parents", [])
                    )
                ]
                yield {
                    "event": "node_error",
                    "data": {
                        "node_id": str(node_id),
                        "error": "Cancelled due to parent failure",
                        "cancelled_downstream": cancelled_downstream,
                    },
                }
                all_results[str(node_id)] = {"status": "cancelled"}
                continue

            # Dirty/clean check: skip clean nodes
            if not self.is_dirty(node_id) and node_id in self._execution_cache:
                yield {
                    "event": "node_skip",
                    "data": {
                        "node_id": str(node_id),
                        "status": "clean",
                        "cached": True,
                    },
                }
                all_results[str(node_id)] = {
                    "status": "completed",
                    "outputs": self._execution_cache[node_id],
                    "cached": True,
                }
                continue

            yield {
                "event": "node_start",
                "data": {"node_id": str(node_id), "status": "executing"},
            }

            executor = self._executors.get(node_id)
            if executor is None:
                self._dirty_nodes.discard(node_id)
                yield {
                    "event": "node_complete",
                    "data": {
                        "node_id": str(node_id),
                        "status": "clean",
                        "cached": False,
                        "outputs": {},
                    },
                }
                all_results[str(node_id)] = {"status": "completed", "outputs": {}}
                continue

            try:
                outputs = await executor()
                output_dict = outputs if isinstance(outputs, dict) else {}
                # Mark clean and cache
                self._dirty_nodes.discard(node_id)
                self._execution_cache[node_id] = output_dict
                yield {
                    "event": "node_complete",
                    "data": {
                        "node_id": str(node_id),
                        "status": "clean",
                        "cached": False,
                        "outputs": output_dict,
                    },
                }
                all_results[str(node_id)] = {"status": "completed", "outputs": output_dict}
            except Exception as e:
                failed_ancestors.add(node_id)
                yield {
                    "event": "node_error",
                    "data": {
                        "node_id": str(node_id),
                        "error": str(e),
                        "cancelled_downstream": [],
                    },
                }
                all_results[str(node_id)] = {"status": "failed", "error": str(e)}

        has_failures = any(r.get("status") == "failed" for r in all_results.values())
        yield {
            "event": "execution_complete" if not has_failures else "execution_error",
            "data": {
                "execution_id": execution_id,
                "status": "failed" if has_failures else "completed",
            },
        }
