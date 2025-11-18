# MindFlow Engine

An AI-assisted visual reasoning engine based on graph nodes. MindFlow enables users to create, navigate, and manipulate reasoning graphs where nodes represent thoughts (questions, answers, hypotheses, evaluations) and edges represent logical relationships.

## Features

- **Graph-Based Reasoning**: Create directed acyclic graphs (DAGs) with typed nodes and parent-child relationships
- **Multi-LLM Support**: Unified interface for Claude, OpenAI, Mistral, Groq, and local models (Ollama)
- **Context-Aware AI**: Intelligent context selection strategies (Timeline, GraphNeighborhood, GroupContext, ManualOverride)
- **Hierarchical Organization**: Organize nodes into groups and reusable projects
- **Explicit Operations**: AI responses include both explanations and explicit graph operations in JSON format
- **Optional Orchestration**: Automatic exploration generating hypotheses and evaluations
- **Multiplatform**: Works on Windows and Linux

## Requirements

- Python 3.11 or higher
- pip (Python package manager)
- Optional: Ollama for local LLM support

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd "Assisted MindFlow"
```

2. Create and activate a virtual environment:
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# Linux
python3 -m venv .venv
source .venv/bin/activate
```

3. Install dependencies:
```bash
pip install -e ".[dev]"
```

4. Configure LLM providers:
```bash
# Copy example configuration
cp config/config.example.json config/config.json

# Edit config/config.json and set your API keys via environment variables:
# - ANTHROPIC_API_KEY for Claude
# - OPENAI_API_KEY for OpenAI
# - MISTRAL_API_KEY for Mistral
# - GROQ_API_KEY for Groq
```

## Quick Start

```python
from mindflow.services.graph_engine import GraphEngine
from mindflow.services.llm_manager import LLMManager

# Initialize graph engine
graph = GraphEngine()

# Create a question node
question_id = graph.create_node(
    type="question",
    content="What are the key principles of system design?",
    author="human"
)

# Initialize LLM manager and generate AI response
llm = LLMManager.from_config("config/config.json")
llm.set_active_provider("claude")

response = llm.generate(
    messages=[{"role": "user", "content": "Explain system design principles"}],
    temperature=0.7
)
```

## Project Structure

```
Assisted MindFlow/
├─ src/mindflow/         # Core library
│  ├─ models/            # Data models (Node, Group, Comment)
│  ├─ services/          # Business logic (GraphEngine, LLMManager, ContextEngine)
│  ├─ providers/         # LLM provider implementations
│  ├─ utils/             # Utilities (validation, cycles, tokens)
│  └─ cli/               # Command-line interface
├─ tests/                # Test suite
│  ├─ unit/              # Unit tests
│  ├─ integration/       # Integration tests
│  └─ contract/          # Contract tests
├─ config/               # Configuration files
├─ docs/                 # Documentation
├─ data/                 # Graph storage
│  ├─ graphs/            # Active graphs
│  └─ backups/           # Graph backups
├─ specs/                # Feature specifications
├─ workbench/            # TEMPORARY: test data, experiments (git-ignored)
├─ .gitignore            # Git ignore rules
├─ CLAUDE.md             # Development guidelines
├─ pyproject.toml        # Python project configuration
├─ README.md             # This file
└─ LICENSE               # License file
```

## Development Tools

### Spec-Kit (GitHub's Spec-Driven Development)

This project uses [GitHub Spec-Kit](https://github.com/github/spec-kit) for spec-driven development.

**What is Spec-Kit?**
- Toolkit for spec-driven development methodology
- Specifications become executable, generating working implementations
- Focus on product scenarios and predictable outcomes
- Compatible with Claude Code, GitHub Copilot, and other AI agents

**Installation:**
Spec-Kit is already installed via UV:
```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
```

**Available Commands:**
- `/speckit.constitution` - Define project principles and constraints
- `/speckit.specify` - Create detailed specifications
- `/speckit.plan` - Generate implementation plans
- `/speckit.tasks` - Break down into actionable tasks
- `/speckit.implement` - Generate code from specs

**Usage:**
```bash
specify init <PROJECT_NAME>
```

## Development

Run tests:
```bash
pytest
```

Run with coverage:
```bash
pytest --cov=src/mindflow --cov-report=html
```

Format code:
```bash
black src tests
```

Run linter:
```bash
ruff check src tests
```

Type checking:
```bash
mypy src
```

See [CLAUDE.md](CLAUDE.md) for detailed development rules and guidelines.

## Documentation

See the `docs/` directory for detailed documentation. Full specification available in `specs/001-mindflow-engine/spec.md`

## Contributing

1. Follow TDD: Write tests before implementation
2. Ensure all tests pass before committing
3. Maintain 80%+ code coverage
4. Use type hints for all functions
5. Follow project coding standards (black, ruff, mypy)

## License

MIT
