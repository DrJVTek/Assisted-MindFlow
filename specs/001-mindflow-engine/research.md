# Research & Technology Decisions: MindFlow Engine

**Date**: 2025-11-17
**Feature**: MindFlow Engine (Speckit)
**Branch**: 001-mindflow-engine

## Overview

This document resolves all "NEEDS CLARIFICATION" items from the Technical Context in plan.md through research and reasoned decision-making.

## Decisions Summary

| Decision Area | Choice | Status |
|---------------|--------|--------|
| Language/Runtime | Python 3.11+ | ✅ RESOLVED |
| Primary Dependencies | anthropic, openai, tiktoken, pydantic, networkx | ✅ RESOLVED |
| Testing Framework | pytest with pytest-mock | ✅ RESOLVED |
| Graph Library | networkx | ✅ RESOLVED |
| JSON Schema | pydantic v2 | ✅ RESOLVED |
| Token Counting | tiktoken | ✅ RESOLVED |

---

## 1. Language/Runtime Selection

### Decision: Python 3.11+

### Rationale

**Strengths for this project**:
- **LLM SDK ecosystem**: First-class SDKs from all major providers (anthropic, openai, mistral, groq)
- **Rapid prototyping**: Fast iteration for complex graph algorithms and AI integration
- **Multiplatform**: Native support for Windows + Linux (constitutional requirement VI)
- **Graph libraries**: Mature graph libraries (networkx) for cycle detection and traversal
- **JSON handling**: Excellent built-in and third-party JSON/schema support (pydantic)
- **Community**: Large ML/AI community with extensive libraries and examples
- **Type safety**: Type hints (Python 3.11+) provide good static analysis with mypy

**Weaknesses addressed**:
- **Performance**: Mitigated by using C-based libraries (networkx uses C extensions) and keeping graph ops simple
- **Concurrency**: Not a concern for single-user reasoning engine; async/await available if needed

### Alternatives Considered

**TypeScript/Node.js 18+**:
- **Pros**: Strong typing, good performance, excellent JSON handling, cross-platform
- **Cons**: LLM SDKs less mature, graph libraries less robust, less common in ML/AI space
- **Rejected because**: Python's LLM ecosystem is significantly more mature and better documented

**Rust 1.75+**:
- **Pros**: Maximum performance, strong type system, memory safety
- **Cons**: Steep learning curve, slower development, LLM SDKs immature, overkill for reasoning engine
- **Rejected because**: Performance not critical enough to justify development overhead

**Go 1.21+**:
- **Pros**: Good performance, simple concurrency, easy deployment
- **Cons**: Limited LLM SDK ecosystem, less graph library support
- **Rejected because**: Python's LLM ecosystem advantage outweighs Go's concurrency benefits

---

## 2. Primary Dependencies

### Decision: Core Stack

```python
# LLM Provider SDKs
anthropic>=0.18.0        # Claude integration
openai>=1.12.0           # OpenAI/GPT integration
requests>=2.31.0         # HTTP for Groq, Mistral, custom endpoints

# Graph & Data Structures
networkx>=3.2            # Graph operations, cycle detection
pydantic>=2.6.0          # JSON schema validation, data models

# Token Counting
tiktoken>=0.6.0          # OpenAI-compatible token counting

# Testing & Development
pytest>=8.0.0            # Unit testing framework
pytest-mock>=3.12.0      # Mocking for LLM providers
pytest-asyncio>=0.23.0   # Async test support
mypy>=1.8.0              # Static type checking
black>=24.1.0            # Code formatting
```

### Rationale

**anthropic / openai**:
- Official SDKs from Claude and OpenAI
- Well-maintained, type-hinted, actively developed
- Handle authentication, retries, rate limiting automatically
- **Alternative**: langchain considered but adds unnecessary abstraction layer

**networkx**:
- Industry-standard graph library for Python
- Built-in cycle detection (DiGraph.has_cycles)
- Efficient traversal algorithms (BFS, DFS)
- Supports directed graphs (required for parent-child relationships)
- **Alternative**: igraph (faster but less Pythonic API)

**pydantic**:
- Best-in-class data validation for Python
- Automatic JSON schema generation
- Type-safe data models
- Excellent error messages for debugging
- **Alternative**: marshmallow (older, less type-safe)

**tiktoken**:
- Accurate token counting for OpenAI models
- Can approximate for Claude (similar tokenization)
- Fast C-based implementation
- **Alternative**: Manual counting (inaccurate and slow)

**pytest**:
- De facto standard for Python testing
- Excellent fixture system for test data
- Great plugin ecosystem (mock, async, coverage)
- **Alternative**: unittest (less expressive, more verbose)

### Local LLM Integration

For llama.cpp and Ollama, use HTTP requests to local endpoints:
- **llama.cpp**: HTTP server mode (--server flag)
- **Ollama**: REST API on http://localhost:11434
- **Implementation**: Unified provider interface wraps HTTP calls

---

## 3. Graph Algorithm Patterns

### Cycle Detection Strategy

**Decision**: Use networkx DiGraph with pre-check before adding edges

```python
import networkx as nx

def can_add_edge(graph: nx.DiGraph, parent_id: str, child_id: str) -> bool:
    """Check if adding edge would create cycle."""
    temp_graph = graph.copy()
    temp_graph.add_edge(parent_id, child_id)
    return not nx.is_directed_acyclic_graph(temp_graph)
```

**Rationale**:
- **Correctness**: networkx algorithms are well-tested and proven
- **Performance**: O(V+E) for DAG check is acceptable for graphs < 1000 nodes
- **Simplicity**: No need to implement custom cycle detection
- **Alternative**: Implement DFS-based detection (rejected: reinventing wheel)

### Referential Integrity Strategy

**Decision**: Bidirectional relationship maintenance with validation

```python
class Graph:
    def link(self, parent_id: str, child_id: str):
        """Link two nodes with integrity checks."""
        # Validate both nodes exist
        if parent_id not in self.nodes or child_id not in self.nodes:
            raise ValueError("Both nodes must exist")

        # Check for cycle
        if not can_add_edge(self._nx_graph, parent_id, child_id):
            raise ValueError("Would create circular dependency")

        # Update both directions atomically
        self.nodes[parent_id].children.append(child_id)
        self.nodes[child_id].parents.append(parent_id)
        self._nx_graph.add_edge(parent_id, child_id)
```

**Rationale**:
- **Atomic updates**: Parent and child updated together or rolled back
- **Validation**: Checks before modification prevent corruption
- **Dual storage**: Python dict for fast lookup + networkx for graph ops
- **Alternative**: Single source of truth in networkx (rejected: harder to query)

---

## 4. Transaction & Rollback Mechanism

### Decision: Command pattern with state snapshots

```python
from typing import Protocol
from dataclasses import dataclass
import copy

class GraphOperation(Protocol):
    """Base protocol for all graph operations."""
    def execute(self, graph: Graph) -> None: ...
    def undo(self, graph: Graph) -> None: ...

@dataclass
class CreateNodeOp:
    node_data: dict
    created_node_id: str = None

    def execute(self, graph: Graph):
        self.created_node_id = graph.create_node(**self.node_data)

    def undo(self, graph: Graph):
        graph._remove_node(self.created_node_id)
```

**Rationale**:
- **Reversibility**: Every operation knows how to undo itself
- **Composability**: Complex operations composed of simple ops
- **Testing**: Easy to test operations in isolation
- **Alternative**: Event sourcing (rejected: overkill for single-user system)

**For atomic multi-operation transactions**:
```python
class Transaction:
    def __init__(self, graph: Graph):
        self.graph = graph
        self.operations: list[GraphOperation] = []

    def execute(self):
        """Execute all operations, rollback on any failure."""
        completed = []
        try:
            for op in self.operations:
                op.execute(self.graph)
                completed.append(op)
        except Exception:
            # Rollback in reverse order
            for op in reversed(completed):
                op.undo(self.graph)
            raise
```

---

## 5. Context Token Counting

### Decision: tiktoken with Claude approximation

**Implementation strategy**:
```python
import tiktoken

class TokenCounter:
    def __init__(self):
        # Use cl100k_base for GPT-4 and approximate for Claude
        self.encoder = tiktoken.get_encoding("cl100k_base")

    def count_tokens(self, text: str, provider: str = "openai") -> int:
        """Count tokens with provider-specific adjustments."""
        base_count = len(self.encoder.encode(text))

        # Claude's tokenizer is similar but not identical
        # Apply 10% buffer for safety
        if provider == "claude":
            return int(base_count * 1.1)

        return base_count
```

**Rationale**:
- **Accuracy**: tiktoken is exact for OpenAI models
- **Approximation**: 10% buffer for Claude covers tokenization differences
- **Performance**: Fast C implementation handles large contexts
- **Safety**: Over-estimation prevents token budget overruns
- **Alternative**: Provider-specific APIs (rejected: requires online check)

---

## 6. Logging Strategy

### Decision: Structured logging with operation tracing

```python
import logging
import json
from datetime import datetime
from typing import Any

class GraphLogger:
    def __init__(self, graph_id: str):
        self.logger = logging.getLogger(f"mindflow.graph.{graph_id}")
        self.graph_id = graph_id

    def log_operation(self, operation: str, details: dict[str, Any]):
        """Log graph operation with structured data."""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "graph_id": self.graph_id,
            "operation": operation,
            "details": details
        }
        self.logger.info(json.dumps(log_entry))
```

**Format example**:
```json
{
  "timestamp": "2025-11-17T10:30:45.123Z",
  "graph_id": "proj-001",
  "operation": "CREATE_NODE",
  "details": {
    "node_id": "uuid-1234",
    "type": "question",
    "author": "llm",
    "parent_ids": ["uuid-5678"]
  }
}
```

**Rationale**:
- **Structured**: JSON format enables log analysis and debugging
- **Traceable**: Every operation logged with timestamp and context
- **Privacy-safe**: Node IDs logged, not content (prevents leaking user data)
- **Queryable**: Standard logging infrastructure can filter/search
- **Alternative**: Plain text logs (rejected: harder to parse and analyze)

---

## 7. Configuration Management

### Decision: JSON config with environment override

**config.example.json**:
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
  },
  "context_engine": {
    "default_strategy": "GraphNeighborhood",
    "default_summary": "HybridSummary",
    "max_tokens": 8000
  },
  "storage": {
    "data_dir": "./data/graphs",
    "backup_dir": "./data/backups"
  }
}
```

**Rationale**:
- **No hardcoded secrets**: API keys from environment variables
- **User-friendly**: JSON is readable and editable
- **Defaults**: Example config provides sensible starting point
- **Override**: Environment variables override file settings
- **Multiplatform**: Relative paths with pathlib handle Windows/Linux
- **Alternative**: YAML (rejected: requires extra dependency)

---

## 8. Testing Strategy

### Decision: Three-tier testing with mocked LLMs

**Unit Tests** (tests/unit/):
- Test individual components in isolation
- Mock all external dependencies (LLM providers, file I/O)
- Fast execution (< 1 second total)

**Integration Tests** (tests/integration/):
- Test component interactions
- Mock LLM providers but use real graph operations
- Moderate execution time (< 10 seconds total)

**Contract Tests** (tests/contract/):
- Verify API contracts match specifications
- Use JSON schemas from contracts/ directory
- Validate operation format and responses

**Example mock pattern**:
```python
import pytest
from unittest.mock import Mock

@pytest.fixture
def mock_llm_provider():
    provider = Mock()
    provider.generate.return_value = {
        "reply": "Test response",
        "graph_actions": [
            {"op": "CREATE_NODE", "type": "answer", "content": "Test"}
        ]
    }
    return provider

def test_llm_integration(mock_llm_provider):
    engine = GraphEngine(llm_provider=mock_llm_provider)
    result = engine.ask_question("test question")

    assert result["reply"] == "Test response"
    assert len(result["graph_actions"]) == 1
```

**Rationale**:
- **No API costs**: Mocked providers avoid LLM API calls during tests
- **Deterministic**: Tests produce consistent results
- **Fast**: No network I/O in unit tests
- **Comprehensive**: Three tiers cover all aspects
- **Alternative**: Record/replay (rejected: brittle, hard to maintain)

---

## 9. Performance Optimization Strategies

### Graph Operation Caching

**Decision**: Cache expensive operations with invalidation

```python
from functools import lru_cache

class Graph:
    def __init__(self):
        self._cache_version = 0

    def _invalidate_cache(self):
        self._cache_version += 1

    @lru_cache(maxsize=128)
    def _get_ancestors(self, node_id: str, version: int) -> set[str]:
        """Cache ancestors with version for invalidation."""
        # Use networkx to compute ancestors
        return nx.ancestors(self._nx_graph, node_id)

    def get_ancestors(self, node_id: str) -> set[str]:
        return self._get_ancestors(node_id, self._cache_version)
```

**Rationale**:
- **Lazy evaluation**: Only compute when needed
- **Cache invalidation**: Version bump clears cache after graph modification
- **Memory bounded**: LRU cache limits memory usage
- **Performance**: Ancestor queries common in context building

### Context Building Optimization

**Decision**: Two-phase context building (selection → summarization)

1. **Selection phase**: Use graph algorithms to select relevant nodes (fast)
2. **Summarization phase**: Only summarize if exceeds token budget (slow)

**Rationale**:
- **Most cases skip summarization**: Typical graphs fit in token budget
- **Progressive summarization**: Start with most important nodes, add until budget
- **Transparency**: Log which nodes selected vs. summarized

---

## 10. Error Handling Philosophy

### Decision: Fail-fast with informative errors

```python
class GraphIntegrityError(Exception):
    """Raised when graph operation would violate integrity."""
    pass

class CircularDependencyError(GraphIntegrityError):
    """Raised when operation would create cycle."""
    def __init__(self, parent_id: str, child_id: str, cycle_path: list[str]):
        self.parent_id = parent_id
        self.child_id = child_id
        self.cycle_path = cycle_path
        super().__init__(
            f"Linking {parent_id} -> {child_id} would create cycle: "
            f"{' -> '.join(cycle_path)}"
        )
```

**Rationale**:
- **Fail-fast**: Detect errors before graph corruption
- **Informative**: Error messages explain what and why
- **Typed exceptions**: Different error types for different handling
- **Recovery**: Caller can catch and handle gracefully
- **Alternative**: Silent failures (rejected: constitutional violation)

---

## Dependencies Final List

```toml
# pyproject.toml
[project]
name = "mindflow-engine"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "anthropic>=0.18.0",
    "openai>=1.12.0",
    "requests>=2.31.0",
    "networkx>=3.2",
    "pydantic>=2.6.0",
    "tiktoken>=0.6.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-mock>=3.12.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=4.1.0",
    "mypy>=1.8.0",
    "black>=24.1.0",
    "ruff>=0.2.0",
]
```

---

## Open Questions for Phase 1 Design

The following items require detailed design in Phase 1 (data-model.md and contracts/):

1. **Exact JSON schema for Node, Group, Comment entities**
2. **GraphOp operation format details** (parameter validation, response format)
3. **LLM provider capability discovery mechanism**
4. **Context preview UI contract** (what data does UI need to display context?)
5. **User approval workflow** (synchronous block vs. async notification?)
6. **Graph persistence format** (single file vs. file per node vs. database?)
7. **Orchestration state machine** (how to pause/resume exploration?)

These will be addressed in the next phase.

---

**Research Complete**: All NEEDS CLARIFICATION items resolved. Ready for Phase 1 design.
