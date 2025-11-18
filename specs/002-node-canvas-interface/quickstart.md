# Quickstart Guide: Interactive Node Canvas Interface

**Feature**: 002-node-canvas-interface
**Audience**: Developers implementing the canvas interface
**Time to setup**: ~15 minutes

---

## Prerequisites

### Required Software

- **Node.js**: 18.0.0 or higher ([Download](https://nodejs.org/))
- **npm**: 9.0.0 or higher (comes with Node.js)
- **Python**: 3.11 or higher (for backend)
- **Git**: For version control

### Verify Installation

```bash
node --version    # Should show v18.0.0+
npm --version     # Should show 9.0.0+
python --version  # Should show 3.11+
```

---

## Project Structure Overview

```
Assisted MindFlow/
├── src/mindflow/              # Python backend (existing)
├── frontend/                  # React UI (NEW - to be created)
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── features/         # Feature modules
│   │   ├── services/         # API services
│   │   ├── stores/           # Zustand stores
│   │   ├── types/            # TypeScript types
│   │   ├── App.tsx           # Root component
│   │   └── main.tsx          # Entry point
│   ├── public/               # Static assets
│   ├── package.json          # Dependencies
│   ├── tsconfig.json         # TypeScript config
│   ├── vite.config.ts        # Vite config
│   └── index.html            # HTML entry
├── specs/002-node-canvas-interface/  # This feature spec
└── pyproject.toml            # Python config (existing)
```

---

## Part 1: Backend Setup (Python API)

### Step 1: Navigate to Project Root

```bash
cd "E:\Projects\github\Assisted MindFlow"
```

### Step 2: Create/Activate Python Virtual Environment

**Windows**:
```bash
python -m venv venv
.\venv\Scripts\activate
```

**Linux/Mac**:
```bash
python -m venv venv
source venv/bin/activate
```

### Step 3: Install Python Dependencies

The MindFlow Engine (feature 001) should already be set up. If not:

```bash
pip install -e ".[dev]"
```

This installs:
- `pydantic` - Data validation
- `networkx` - Graph algorithms
- `tiktoken` - Token counting
- `fastapi` - REST API framework (NEW for this feature)
- `uvicorn` - ASGI server (NEW)
- `pygraphviz` - Graph layout (NEW)

### Step 4: Add FastAPI Dependencies

If `pyproject.toml` doesn't include FastAPI yet, add:

```toml
dependencies = [
    # ... existing deps
    "fastapi>=0.108.0",
    "uvicorn[standard]>=0.25.0",
    "pygraphviz>=1.11",
]
```

Then run:
```bash
pip install -e ".[dev]"
```

### Step 5: Create API Server (Temporary - for testing)

Create `src/mindflow/api/server.py`:

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mindflow.models.graph import Graph
import json

app = FastAPI(title="MindFlow Canvas API")

# Enable CORS for frontend (localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/graphs/{graph_id}")
async def get_graph(graph_id: str):
    # TODO: Load from database/file
    # For now, return mock data or raise 404
    raise HTTPException(status_code=404, detail="Graph not found")

@app.get("/")
async def root():
    return {"message": "MindFlow Canvas API", "version": "1.0.0"}
```

### Step 6: Run Backend Server

```bash
uvicorn mindflow.api.server:app --reload --port 8000
```

Verify it's running by visiting: http://localhost:8000

You should see: `{"message": "MindFlow Canvas API", "version": "1.0.0"}`

**Keep this terminal running.**

---

## Part 2: Frontend Setup (React + Vite)

### Step 1: Open New Terminal

Keep backend terminal running. Open a new terminal for frontend.

### Step 2: Create Frontend Project

Navigate to project root:
```bash
cd "E:\Projects\github\Assisted MindFlow"
```

Create React + TypeScript project with Vite:
```bash
npm create vite@latest frontend -- --template react-ts
```

This creates `frontend/` directory with React + TypeScript template.

### Step 3: Navigate to Frontend Directory

```bash
cd frontend
```

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Install Additional Libraries

```bash
npm install reactflow zustand axios lucide-react
```

Install dev dependencies:
```bash
npm install -D @types/node
```

**Dependency Summary**:
- `reactflow` (v11+) - Node canvas library
- `zustand` (v4+) - State management
- `axios` (v1.6+) - HTTP client
- `lucide-react` (v0.300+) - Icons

### Step 6: Configure Vite for API Proxy

Edit `frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

This proxies `/api/*` requests to the Python backend.

### Step 7: Run Frontend Dev Server

```bash
npm run dev
```

Vite will start at: http://localhost:5173

**Keep this terminal running.**

---

## Part 3: Verify Full Stack

### Check 1: Frontend Loads

Open browser to http://localhost:5173

You should see the default Vite + React welcome page.

### Check 2: API Connection

Open browser console (F12) and test API:

```javascript
fetch('/api/graphs/test')
  .then(r => r.json())
  .catch(e => console.log('Expected 404:', e))
```

You should see a 404 error (expected - no graph exists yet).

### Check 3: CORS Working

No CORS errors should appear in console. If you see CORS errors, verify:
1. Backend CORS middleware is configured
2. Frontend is using proxy (vite.config.ts)

---

## Part 4: Create First Canvas Component

### Step 1: Install React Flow CSS

Edit `frontend/src/main.tsx`:

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import 'reactflow/dist/style.css'  // ADD THIS LINE

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### Step 2: Create Basic Canvas Component

Create `frontend/src/components/Canvas.tsx`:

```typescript
import React from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';

const initialNodes = [
  {
    id: '1',
    type: 'default',
    data: { label: 'Question Node' },
    position: { x: 100, y: 100 },
  },
  {
    id: '2',
    type: 'default',
    data: { label: 'Answer Node' },
    position: { x: 300, y: 200 },
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: false },
];

export default function Canvas() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow nodes={initialNodes} edges={initialEdges}>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

### Step 3: Use Canvas in App

Edit `frontend/src/App.tsx`:

```typescript
import Canvas from './components/Canvas'

function App() {
  return <Canvas />
}

export default App
```

### Step 4: View Result

Refresh http://localhost:5173

You should see:
- Two nodes connected by a line
- Minimap in bottom-right
- Zoom/pan controls
- Background grid

**You can now zoom (mouse wheel) and pan (drag) the canvas!**

---

## Part 5: Development Workflow

### Terminal Setup (Keep 2 Terminals Open)

**Terminal 1 - Backend**:
```bash
cd "E:\Projects\github\Assisted MindFlow"
.\venv\Scripts\activate
uvicorn mindflow.api.server:app --reload --port 8000
```

**Terminal 2 - Frontend**:
```bash
cd "E:\Projects\github\Assisted MindFlow\frontend"
npm run dev
```

### File Watching

Both servers auto-reload on file changes:
- **Backend**: Uvicorn watches `.py` files
- **Frontend**: Vite watches `.tsx`, `.ts`, `.css` files

### Development Loop

1. Make changes to code
2. Save file
3. Server auto-reloads
4. Refresh browser (or Vite hot-reloads automatically)
5. Test changes

---

## Part 6: Testing

### Frontend Tests

```bash
cd frontend
npm run test
```

(Requires Vitest setup - covered in implementation phase)

### Backend Tests

```bash
cd "E:\Projects\github\Assisted MindFlow"
pytest tests/
```

---

## Common Issues & Solutions

### Issue 1: "Module not found" (Python)

**Solution**: Ensure virtual environment is activated and dependencies installed:
```bash
.\venv\Scripts\activate
pip install -e ".[dev]"
```

### Issue 2: "Cannot find module 'reactflow'" (Frontend)

**Solution**: Install dependencies in frontend directory:
```bash
cd frontend
npm install
```

### Issue 3: CORS Errors

**Solution**: Verify:
1. Backend CORS middleware is configured with `http://localhost:5173`
2. Frontend proxy is configured in `vite.config.ts`
3. Both servers are running

### Issue 4: Port Already in Use

**Backend (8000)**:
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:8000 | xargs kill
```

**Frontend (5173)**:
```bash
# Change port in vite.config.ts
server: {
  port: 5174  // Use different port
}
```

### Issue 5: Blank Screen After Setup

**Solution**: Check browser console (F12) for errors. Common causes:
1. React Flow CSS not imported (`import 'reactflow/dist/style.css'`)
2. Canvas div has no height (ensure `height: 100vh`)

---

## Next Steps

### Phase 1 - Implement Core Canvas (P1)

1. **Create Node Component**: Custom node rendering with type styling
2. **Load Graph Data**: Fetch from API and transform to VisualNode
3. **Implement Zoom/Pan**: Configure React Flow controls
4. **Add Connection Lines**: Render parent-child edges

### Phase 2 - Selection & Details (P2)

1. **Node Selection**: Click handling and state management
2. **Detail Panel**: Show full node content on selection
3. **Highlighting**: Emphasize selected node and connections

### Phase 3 - Performance & Polish (P2/P3)

1. **Viewport Culling**: Optimize rendering for large graphs
2. **Touch Gestures**: Enable pinch-to-zoom on touch devices
3. **Keyboard Shortcuts**: Arrow keys for pan, +/- for zoom

---

## Useful Commands Reference

### Backend

```bash
# Activate venv (Windows)
.\venv\Scripts\activate

# Activate venv (Linux/Mac)
source venv/bin/activate

# Run server
uvicorn mindflow.api.server:app --reload --port 8000

# Run tests
pytest tests/ -v

# Type checking
mypy src/mindflow

# Code formatting
black src/ tests/
```

### Frontend

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Run tests
npm run test

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npx tsc --noEmit

# Linting
npx eslint src/
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│  Browser (http://localhost:5173)                │
│  ┌───────────────────────────────────────────┐  │
│  │  React App (Vite)                         │  │
│  │  ├─ Canvas Component (React Flow)         │  │
│  │  ├─ Node Components (Custom)              │  │
│  │  ├─ Detail Panel                          │  │
│  │  └─ Zustand Store (State)                 │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────┘
                      │ HTTP (proxied via Vite)
                      ▼
┌─────────────────────────────────────────────────┐
│  FastAPI Backend (http://localhost:8000/api)    │
│  ┌───────────────────────────────────────────┐  │
│  │  REST Endpoints                           │  │
│  │  ├─ GET /api/graphs/{id}                  │  │
│  │  ├─ GET /api/graphs/{id}/nodes            │  │
│  │  └─ POST /api/graphs/{id}/viewport        │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  MindFlow Engine (Python)                       │
│  ├─ Graph Model (Pydantic)                      │
│  ├─ Node Model                                  │
│  ├─ Validation Utils                            │
│  └─ Layout Algorithm (Dagre)                    │
└─────────────────────────────────────────────────┘
```

---

## Resources

### Documentation

- [React Flow Docs](https://reactflow.dev/)
- [Zustand Docs](https://docs.pmnd.rs/zustand/)
- [Vite Docs](https://vitejs.dev/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Pydantic Docs](https://docs.pydantic.dev/)

### Tutorials

- [React Flow Quickstart](https://reactflow.dev/learn)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)

### Spec Documents

- [spec.md](./spec.md) - Feature specification
- [data-model.md](./data-model.md) - Data models
- [contracts/api.yaml](./contracts/api.yaml) - API schema
- [research.md](./research.md) - Technical decisions

---

**Setup Complete!** You now have:
- ✅ Python backend running on port 8000
- ✅ React frontend running on port 5173
- ✅ Basic canvas with zoom/pan working
- ✅ API proxy configured
- ✅ All dependencies installed

**Ready to implement?** Start with creating custom Node components styled by node type!
