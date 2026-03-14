# MindFlow Engine

An AI-assisted visual reasoning engine based on graph nodes. MindFlow enables users to create, navigate, and manipulate reasoning graphs where nodes represent thoughts (questions, answers, hypotheses, evaluations) and edges represent logical relationships.

## Features

### Core Engine
- **Graph-Based Reasoning**: Create directed acyclic graphs (DAGs) with typed nodes and parent-child relationships
- **Multi-LLM Support**: Unified interface for Claude, OpenAI, Gemini, Mistral, Groq, and local models (Ollama)
- **Provider Registry**: Full CRUD management of LLM providers with API key storage and model selection
- **Context-Aware AI**: Intelligent context selection strategies (Timeline, GraphNeighborhood, GroupContext, ManualOverride)
- **Hierarchical Organization**: Organize nodes into groups and reusable projects
- **Explicit Operations**: AI responses include both explanations and explicit graph operations in JSON format
- **Optional Orchestration**: Automatic exploration generating hypotheses and evaluations
- **Multiplatform**: Works on Windows and Linux

### Visual Canvas Interface
- **Interactive Canvas**: React-based visual interface using ReactFlow for node manipulation
- **Intelligent Reorganization**: One-click automatic layout with hierarchical graph organization (elkjs)
- **Undo/Redo**: Full undo/redo support for layout changes with keyboard shortcuts (Ctrl+Z/Y)
- **Multi-Canvas Support**: Create and manage multiple canvases, each linked to a graph
- **Advanced Interactions**: Drag-and-drop, multi-select, node editing, groups, and comments
- **Version History**: Track and restore previous versions of node content
- **Cascade Regeneration**: Automatically update downstream nodes when parent nodes change
- **LLM Configuration**: Unified LLM Providers panel with full provider CRUD

### ChatGPT Import
- **Conversation Import**: Import conversations from ChatGPT into MindFlow canvases
- **Cloudflare Bypass**: Uses curl_cffi with Chrome TLS impersonation to access ChatGPT backend API
- **Two-Step Token Flow**: Console command extracts token, user pastes into MindFlow

### MCP (Model Context Protocol)
- **MCP Client**: Connect to external MCP servers and browse available tools
- **MCP Server**: Expose MindFlow operations as MCP tools for external AI agents
- **Tool Browser**: Visual interface to explore and invoke MCP tools

### Multi-LLM Debates
- **Debate Engine**: Structured debates between multiple LLM providers
- **Configurable Rounds**: Set number of rounds, participants, and debate topic
- **Debate Controls**: UI to create, manage, and view debate results

## Requirements

### Backend
- Python 3.11 or higher
- pip (Python package manager)
- Optional: Ollama for local LLM support

### Frontend
- Node.js 18 or higher
- npm (comes with Node.js)

## Installation

### Backend Setup

1. Clone the repository:
```bash
git clone https://github.com/Fora-Ante/Assisted-MindFlow.git
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

Providers can be managed directly from the UI (Settings > LLM Providers) or via environment variables:
```bash
# Set API keys via environment variables:
# - ANTHROPIC_API_KEY for Claude
# - OPENAI_API_KEY for OpenAI
# - GOOGLE_API_KEY for Gemini
# - MISTRAL_API_KEY for Mistral
# - GROQ_API_KEY for Groq
# - Ollama runs locally, no key needed
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Option 1: Quick Start (Restart Both Servers)
```bash
# Windows
restart.bat

# Linux/Mac
./restart.sh
```

This will kill any existing servers and start both backend (port 8000) and frontend (port 5173).

### Option 2: Manual Start

**Start Backend:**
```bash
# From project root
python -m uvicorn src.mindflow.api.server:app --reload --port 8000
```

**Start Frontend:**
```bash
# From frontend directory
cd frontend
npm run dev
```

Then open http://localhost:5173 in your browser.

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
├─ frontend/             # React-based visual interface
│  ├─ src/
│  │  ├─ components/     # UI components (Canvas, Node, ContextMenu)
│  │  ├─ features/       # Feature modules (canvas, llm)
│  │  │  └─ canvas/
│  │  │     ├─ hooks/    # React hooks (useLayout, useUndoRedo)
│  │  │     ├─ services/ # Layout services (elkjs integration)
│  │  │     └─ utils/    # Canvas utilities
│  │  ├─ services/       # API client (Axios)
│  │  ├─ stores/         # State management (Zustand)
│  │  └─ types/          # TypeScript types
│  ├─ tests/             # Frontend tests (Vitest)
│  ├─ package.json       # Node.js dependencies
│  └─ vite.config.ts     # Vite configuration
├─ src/mindflow/         # Backend Python library
│  ├─ api/               # FastAPI server and routes
│  ├─ models/            # Data models (Node, Group, Comment, Canvas)
│  ├─ services/          # Business logic (GraphEngine, LLMManager, ContextEngine)
│  ├─ providers/         # LLM provider implementations
│  ├─ utils/             # Utilities (validation, cycles, tokens)
│  └─ cli/               # Command-line interface
├─ tests/                # Backend test suite
│  ├─ unit/              # Unit tests
│  ├─ integration/       # Integration tests
│  └─ contract/          # Contract tests
├─ config/               # Configuration files
├─ docs/                 # Documentation
├─ data/                 # Graph storage
│  ├─ graphs/            # Active graphs
│  └─ backups/           # Graph backups
├─ specs/                # Feature specifications
│  ├─ 001-intelligent-reorganize/  # Canvas reorganization
│  ├─ 004-advanced-canvas-features/ # Full canvas features
│  └─ 011-multi-provider-llm-mcp/  # Multi-provider, MCP, debates
├─ workbench/            # TEMPORARY: test data, experiments (git-ignored)
├─ restart.bat/sh        # Quick server restart scripts
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

### Backend Testing

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

### Frontend Testing

Run all tests:
```bash
cd frontend
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run specific test file:
```bash
npm test -- useLayout
```

### Test Coverage

- **Backend**: Minimum 80% code coverage target
- **Frontend**: 45 tests passing (elkjs, layout, undo/redo)
  - 8 tests: elkjsAdapter (graph format conversion)
  - 12 tests: layoutService (layout computation)
  - 11 tests: useLayout hook (reorganization logic)
  - 11 tests: useUndoRedo hook (state management)
  - 3 tests: Integration tests (layout with 50+ nodes)

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
