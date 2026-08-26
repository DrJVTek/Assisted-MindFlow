# MindFlow Engine

An AI-assisted visual reasoning engine based on graph nodes. MindFlow enables users to create, navigate, and manipulate reasoning graphs where nodes represent thoughts (questions, answers, hypotheses, evaluations) and edges represent logical relationships.

## Features

### Core Engine
- **Graph-Based Reasoning**: Create directed acyclic graphs (DAGs) with typed nodes and parent-child relationships
- **Multi-LLM Support**: Unified interface for OpenAI, Claude (Anthropic), Gemini, ChatGPT Web (subscription/OAuth), and local models (Ollama / LM Studio)
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

2. Install everything (backend venv + dev extras + frontend deps):
```bash
# Windows
install.bat

# Linux
./install.sh
```
   Or manually (the run scripts expect the venv to be named `venv`):
```bash
python -m venv venv
venv\Scripts\pip install -e ".[dev]"     # Linux: venv/bin/pip install -e ".[dev]"
```

3. Configure LLM providers **from the UI** (Settings > LLM Providers): add a provider and paste
   its API key (stored **encrypted** in `data/secrets/`, git-ignored — never in plaintext, never in
   the repo), or sign in with ChatGPT (OAuth). Ollama needs no key.

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
venv\Scripts\python.exe -m uvicorn mindflow.api.server:app --reload --port 8000
# Linux: venv/bin/python -m uvicorn mindflow.api.server:app --reload --port 8000
```

**Start Frontend:**
```bash
# From frontend directory
cd frontend
npm run dev
```

Then open http://localhost:5173 in your browser.

## Quick Start

1. `restart.bat` (or `./restart.sh`), then open http://localhost:5173.
2. Create a canvas, then **double-click** the empty canvas (or right-click → *Add node*) and pick
   **LLM Chat**.
3. In Settings > LLM Providers, add a provider (API key or ChatGPT sign-in) and select it on the node.
4. Type a prompt and hit **▶ Run** — the response streams into the node.
5. Branch: right-click a node → *Add child* (or drag from an output port). **Merge** two branches by
   wiring both into distinct input ports of a downstream node — context is rebuilt from the graph at
   execution time (the graph IS the memory), so any node can be re-run at any point.

Programmatic access uses the same REST API the UI calls, e.g.:
```bash
curl -X POST http://127.0.0.1:8000/api/graphs/<graph_id>/execute/<node_id> \
     -H "Content-Type: application/json" -d "{\"stream\": false}"
```

## Project Structure

```
Assisted MindFlow/
├─ frontend/             # React-based visual interface
│  ├─ src/
│  │  ├─ components/     # Shared design system only (ui/, icons/, ErrorBoundary)
│  │  ├─ features/       # Feature modules — each owns its components/
│  │  │  ├─ canvas/      # Canvas host, hooks (useLayout, useUndoRedo), elkjs, utils
│  │  │  ├─ nodes/       # Node, DetailPanel, NodeCreator/Editor, markdown
│  │  │  ├─ providers/   # Provider settings, model selector, OAuth login
│  │  │  └─ mcp/ plugins/ debate/ settings/ logging/ import/
│  │  ├─ services/       # API client (Axios)
│  │  ├─ stores/         # State management (Zustand)
│  │  └─ types/          # TypeScript types
│  ├─ tests/             # Frontend tests (Vitest)
│  ├─ package.json       # Node.js dependencies
│  └─ vite.config.ts     # Vite configuration
├─ src/mindflow/         # Backend Python library
│  ├─ api/               # FastAPI server (lifespan composition root) and routes
│  ├─ engine/            # Orchestrator (graph execution) + topology utils + validator
│  ├─ plugins/           # ComfyUI-style node-type plugin registry
│  ├─ models/            # Data models (Node, Graph, Group, Comment, Canvas, Provider)
│  ├─ services/          # mcp/ · auth/ · storage/ · graph/ · llm_web/ sub-packages
│  ├─ providers/         # LLM providers (openai, anthropic, gemini, ollama, chatgpt)
│  └─ utils/             # Utilities (validation, cycles, tokens)
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

- **Backend**: 635 tests passing (unit / integration / contract; 80% coverage target)
- **Frontend**: 129 tests passing across 12 files (components, stores, canvas layout/undo-redo)

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
