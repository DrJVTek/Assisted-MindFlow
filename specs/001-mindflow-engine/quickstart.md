# MindFlow Engine: Quickstart Guide

**Version**: 1.0.0
**Date**: 2025-11-17
**Target Audience**: Developers implementing or integrating with MindFlow Engine

## Overview

The MindFlow Engine is a Python library for AI-assisted visual reasoning using graph-based data structures. This guide will get you up and running in 15 minutes.

## Prerequisites

- Python 3.11 or higher
- pip or uv for package management
- (Optional) API keys for Claude, OpenAI, or other LLM providers
- (Optional) Local LLM setup (llama.cpp, Ollama)

## Installation

```bash
# Clone repository
git clone <repository-url>
cd mindflow-engine

# Install dependencies
pip install -e .

# Or with development dependencies
pip install -e ".[dev]"
```

## Configuration

1. **Copy example config**:
```bash
cp config/config.example.json config/config.json
```

2. **Set up LLM providers** (edit `config/config.json`):
```json
{
  "llm_providers": {
    "claude": {
      "api_key_env": "ANTHROPIC_API_KEY",
      "model": "claude-3-5-sonnet-20241022",
      "max_tokens": 4096,
      "temperature": 0.7
    },
    "openai": {
      "api_key_env": "OPENAI_API_KEY",
      "model": "gpt-4-turbo-preview",
      "max_tokens": 4096,
      "temperature": 0.7
    },
    "local": {
      "endpoint": "http://localhost:11434/api/generate",
      "model": "llama2"
    }
  }
}
```

3. **Set environment variables**:
```bash
export ANTHROPIC_API_KEY="your-api-key-here"
export OPENAI_API_KEY="your-api-key-here"
```

## Basic Usage

### 1. Create a Graph

```python
from mindflow.models import Graph, Node, GraphMetadata
from mindflow.services import GraphEngine

# Create empty graph
graph = Graph(
    meta=GraphMetadata(
        name="My First Reasoning Graph",
        description="Exploring market opportunities"
    )
)

# Initialize engine
engine = GraphEngine(graph)
```

### 2. Add Nodes

```python
# Create a question node
result = engine.execute({
    "op": "CREATE_NODE",
    "params": {
        "type": "question",
        "content": "What are the key trends in AI-assisted productivity?",
        "author": "human"
    }
})

question_id = result["created_ids"][0]
print(f"Created node: {question_id}")
```

### 3. Set Up LLM Provider

```python
from mindflow.services import LLMManager

# Initialize LLM manager
llm_manager = LLMManager()

# List available providers
providers = llm_manager.list_providers()
for p in providers:
    print(f"{p['provider_id']}: {p['name']} - Available: {p['is_available']}")

# Set active provider
llm_manager.set_active_provider("claude")
```

### 4. Get AI-Assisted Response

```python
from mindflow.services import ContextEngine

# Build context around the question
context_engine = ContextEngine(graph)
context = context_engine.build_context({
    "focus_node_id": question_id,
    "strategy": "GraphNeighborhood",
    "summary_type": "HybridSummary",
    "max_tokens": 8000
})

# Generate response with graph actions
response = llm_manager.generate({
    "prompt": "Analyze this question and suggest hypotheses",
    "context": context["context_text"]
})

# Execute graph actions returned by AI
for action in response["graph_actions"]:
    result = engine.execute(action)
    print(f"Executed {action['op']}: {result['message']}")

print(f"\nAI Response:\n{response['reply']}")
```

### 5. Save and Load Graph

```python
# Save graph to file
import json
from pathlib import Path

data_dir = Path("./data/graphs")
data_dir.mkdir(parents=True, exist_ok=True)

graph_file = data_dir / "my-reasoning-graph.json"
graph_file.write_text(graph.to_json())
print(f"Graph saved to {graph_file}")

# Load graph from file
loaded_graph = Graph.from_json(graph_file.read_text())
print(f"Loaded graph with {len(loaded_graph.nodes)} nodes")
```

## Common Operations

### Create Parent-Child Relationships

```python
# Create child node and link to parent
child_result = engine.execute({
    "op": "CREATE_NODE",
    "params": {
        "type": "hypothesis",
        "content": "AI coding assistants will become primary development tool",
        "parents": [question_id]
    }
})
```

### Organize with Groups

```python
# Create project group
group_result = engine.execute({
    "op": "CREATE_GROUP",
    "params": {
        "label": "Market Analysis",
        "kind": "project"
    }
})

group_id = group_result["created_ids"][0]

# Add nodes to group
engine.execute({
    "op": "ADD_NODE_TO_GROUP",
    "params": {
        "node_id": question_id,
        "group_id": group_id
    }
})
```

### Add Comments

```python
engine.execute({
    "op": "ADD_COMMENT",
    "params": {
        "content": "Need more data to validate this hypothesis",
        "author": "human",
        "attached_to": {"node_id": child_result["created_ids"][0]}
    }
})
```

### Merge Nodes

```python
# Create synthesis from multiple nodes
merge_result = engine.execute({
    "op": "MERGE_NODES",
    "params": {
        "node_ids": [node_id_1, node_id_2, node_id_3],
        "objective": "Consolidate market trend insights",
        "output_type": "summary",
        "use_ai_synthesis": True
    }
})
```

## Context Strategies

### GraphNeighborhood (Default)

```python
# Include parents, children, and siblings
context = context_engine.build_context({
    "focus_node_id": some_node_id,
    "strategy": "GraphNeighborhood"
})
```

### Timeline

```python
# Chronological order, newest first
context = context_engine.build_context({
    "strategy": "Timeline",
    "summary_type": "TemporalSummary"
})
```

### GroupContext

```python
# All nodes in same group
context = context_engine.build_context({
    "focus_node_id": some_node_id,
    "strategy": "GroupContext"
})
```

### ManualOverride

```python
# Explicitly selected nodes
context = context_engine.build_context({
    "strategy": "ManualOverride",
    "manual_node_ids": [id1, id2, id3, id4]
})
```

## Automatic Orchestration (Advanced)

**⚠️ Warning**: Orchestration consumes LLM API credits. Use with budget limits.

```python
from mindflow.services import Orchestrator

orchestrator = Orchestrator(engine, llm_manager, context_engine)

# Start orchestration on a group
result = orchestrator.start_orchestration({
    "group_id": group_id,
    "mode": "BreadthFirst",
    "max_nodes_per_pass": 5,
    "max_depth": 3,
    "time_budget_seconds": 120,
    "min_confidence": 0.6
})

orchestration_id = result["orchestration_id"]

# Check status
status = orchestrator.get_status(orchestration_id)
print(f"State: {status['state']}")
print(f"Nodes generated: {status['nodes_generated']}")
print(f"Depth: {status['current_depth']}")

# Pause if needed
orchestrator.pause_orchestration(orchestration_id)

# Resume
orchestrator.resume_orchestration(orchestration_id)

# Get final result
if status["state"] == "completed":
    result = orchestrator.get_result(orchestration_id)
    print(f"Created {len(result['created_nodes'])} nodes")
    print(f"Stop nodes: {len(result['stop_nodes'])}")
```

## Testing

### Run Unit Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test
pytest tests/unit/test_graph_ops.py::test_create_node
```

### Mock LLM for Testing

```python
from unittest.mock import Mock

# Create mock provider
mock_provider = Mock()
mock_provider.generate.return_value = {
    "reply": "Here's my analysis...",
    "graph_actions": [
        {"op": "CREATE_NODE", "params": {"type": "answer", "content": "Test"}}
    ]
}

# Use in tests
llm_manager = LLMManager()
llm_manager._active_provider = mock_provider
```

## Troubleshooting

### API Key Not Found

```
Error: Provider 'claude' not available: API key not found
```

**Solution**: Ensure environment variable is set:
```bash
export ANTHROPIC_API_KEY="your-key"
```

### Circular Dependency Error

```
CircularDependencyError: Linking parent_id -> child_id would create cycle
```

**Solution**: This is expected. The engine prevents cycles. Check your graph structure.

### Context Exceeds Token Budget

```
Warning: Context truncated from 12000 to 8000 tokens
```

**Solution**: Use more aggressive summarization or increase max_tokens:
```python
context = context_engine.build_context({
    "max_tokens": 15000,
    "summary_type": "WeightedSummary"
})
```

### Orchestration Not Starting

```
Error: Orchestration is disabled by default
```

**Solution**: This is intentional (constitutional requirement). Explicitly enable:
```python
result = orchestrator.start_orchestration(config)
```

## Next Steps

1. **Read the data model**: See `data-model.md` for entity details
2. **Explore contracts**: Review `contracts/*.json` for API schemas
3. **Review constitution**: See `.specify/memory/constitution.md` for design principles
4. **Implement tests**: Write tests before implementation (TDD required)
5. **Start coding**: Follow the implementation plan in `plan.md`

## Examples

### Complete Example: Market Research

```python
from mindflow.models import Graph, GraphMetadata
from mindflow.services import GraphEngine, LLMManager, ContextEngine

# 1. Create graph
graph = Graph(meta=GraphMetadata(
    name="AI Market Research",
    description="Exploring AI productivity tools market"
))
engine = GraphEngine(graph)

# 2. Create initial question
q1 = engine.execute({
    "op": "CREATE_NODE",
    "params": {
        "type": "question",
        "content": "What are untapped opportunities in AI-assisted development tools?",
        "author": "human"
    }
})["created_ids"][0]

# 3. Set up AI
llm = LLMManager()
llm.set_active_provider("claude")
ctx_engine = ContextEngine(graph)

# 4. Get AI hypotheses
context = ctx_engine.build_context({"focus_node_id": q1})
response = llm.generate({
    "prompt": "Generate 3 diverse hypotheses about untapped opportunities",
    "context": context["context_text"]
})

# 5. Execute AI suggestions
for action in response["graph_actions"]:
    engine.execute(action)

# 6. Review and iterate
for node_id, node in graph.nodes.items():
    if node.type == "hypothesis":
        print(f"Hypothesis: {node.content[:100]}...")

# 7. Save for later
Path("data/graphs/market-research.json").write_text(graph.to_json())
```

## Resources

- **Specification**: `specs/001-mindflow-engine/spec.md`
- **Implementation Plan**: `specs/001-mindflow-engine/plan.md`
- **Research**: `specs/001-mindflow-engine/research.md`
- **Contracts**: `specs/001-mindflow-engine/contracts/`
- **Constitution**: `.specify/memory/constitution.md`

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the constitution for design rationale
3. Consult the data model for entity details
4. Open an issue on GitHub (when available)

---

**Happy Reasoning!** 🧠
