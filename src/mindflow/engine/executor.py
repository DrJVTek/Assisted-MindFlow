"""Graph execution engine — topological sort with cycle detection.

DFS-based topological sort with sub-graph extraction: only the ancestors of the
target node are included. The actual node execution and parent-failure
propagation live in the Orchestrator (engine/orchestrator.py), which calls
``topological_sort`` here and runs the execution loop itself.
"""

from uuid import UUID


class CycleDetectedError(Exception):
    """Raised when a cycle is found during topological sort."""

    def __init__(self, cycle_nodes: list[UUID]):
        self.cycle_nodes = cycle_nodes
        super().__init__(
            f"Cycle detected in graph involving nodes: "
            f"{[str(n) for n in cycle_nodes]}"
        )


class GraphExecutor:
    """Topology utility: ancestor sub-graph ordering for a target node.

    Args:
        adjacency: Dict mapping node UUID to {"children": [...], "parents": [...]}
    """

    def __init__(self, adjacency: dict[UUID, dict[str, list[UUID]]]):
        self._adjacency = adjacency

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
