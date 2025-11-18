"""Demo graph data for testing the canvas interface."""

from uuid import uuid4
from mindflow.models.graph import Graph, Node, GraphMetadata

def create_demo_graph() -> Graph:
    """Create a demo graph with various node types for testing."""

    # Use a fixed UUID for demo graph so frontend can reference it consistently
    graph_id = "550e8400-e29b-41d4-a716-446655440000"

    # Create nodes
    node1_id = str(uuid4())
    node2_id = str(uuid4())
    node3_id = str(uuid4())
    node4_id = str(uuid4())
    node5_id = str(uuid4())

    node1 = Node(
        id=node1_id,
        type="question",
        author="human",
        content="How can we implement an interactive node canvas interface for visualizing reasoning graphs?",
        parents=[],
        children=[node2_id, node3_id],
        groups=[],
        meta={
            "position": {"x": 100, "y": 100},
            "created_at": "2025-01-15T10:00:00Z",
            "updated_at": "2025-01-15T10:00:00Z",
            "importance": 0.9,
            "tags": ["architecture", "ui"],
            "status": "valid",
            "stop": False,
        }
    )

    node2 = Node(
        id=node2_id,
        type="answer",
        author="llm",
        content="We can use React Flow library which provides a robust foundation for building node-based interfaces with features like zoom, pan, and drag-and-drop.",
        parents=[node1_id],
        children=[node4_id],
        groups=[],
        meta={
            "position": {"x": -150, "y": 300},
            "created_at": "2025-01-15T10:05:00Z",
            "updated_at": "2025-01-15T10:05:00Z",
            "importance": 0.7,
            "tags": ["implementation"],
            "status": "valid",
            "stop": False,
        }
    )

    node3 = Node(
        id=node3_id,
        type="hypothesis",
        author="human",
        content="A graph visualization approach would be more intuitive than a linear list for understanding complex reasoning chains.",
        parents=[node1_id],
        children=[node5_id],
        groups=[],
        meta={
            "position": {"x": 350, "y": 300},
            "created_at": "2025-01-15T10:10:00Z",
            "updated_at": "2025-01-15T10:10:00Z",
            "importance": 0.8,
            "tags": ["ux", "design"],
            "status": "experimental",
            "stop": False,
        }
    )

    node4 = Node(
        id=node4_id,
        type="note",
        author="tool",
        content="React Flow documentation: https://reactflow.dev - Supports TypeScript, provides hooks for state management.",
        parents=[node2_id],
        children=[],
        groups=[],
        meta={
            "position": {"x": -150, "y": 500},
            "created_at": "2025-01-15T10:15:00Z",
            "updated_at": "2025-01-15T10:15:00Z",
            "importance": 0.5,
            "tags": ["reference"],
            "status": "draft",
            "stop": False,
        }
    )

    node5 = Node(
        id=node5_id,
        type="evaluation",
        author="human",
        content="After testing with users, the graph visualization received positive feedback. Users found it easier to navigate complex reasoning compared to linear formats.",
        parents=[node3_id],
        children=[],
        groups=[],
        meta={
            "position": {"x": 350, "y": 500},
            "created_at": "2025-01-15T11:00:00Z",
            "updated_at": "2025-01-15T11:00:00Z",
            "importance": 0.9,
            "tags": ["validation", "ux"],
            "status": "final",
            "stop": False,
        }
    )

    # Create graph
    graph = Graph(
        id=graph_id,
        meta=GraphMetadata(
            name="Demo Canvas Interface Graph",
            description="A demonstration graph showing various node types and relationships",
            created_at="2025-01-15T10:00:00Z",
            updated_at="2025-01-15T11:00:00Z",
            tags=["demo", "canvas", "ui"],
        ),
        nodes={
            node1_id: node1,
            node2_id: node2,
            node3_id: node3,
            node4_id: node4,
            node5_id: node5,
        },
        groups={},
        comments={},
    )

    return graph
