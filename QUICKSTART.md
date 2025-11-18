# Quick Start: MindFlow Canvas Interface

This guide will get you up and running with the MindFlow Canvas Interface in 5 minutes.

## Prerequisites

- **Python 3.11+** (3.13 works but 3.11-3.12 recommended for better library support)
- **Node.js 18+** and npm
- **Git** (already cloned)

## Setup (First Time Only)

### 1. Backend Setup (Python API)

```bash
# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# Install dependencies
pip install -e .
```

**Note**: `pygraphviz` requires GraphViz system library - skip for now, not needed for basic functionality.

### 2. Frontend Setup (React UI)

```bash
cd frontend
npm install
cd ..
```

## Running the Application

### Option 1: Using Scripts (Recommended)

**Windows**:
```bash
# Terminal 1 - Backend
run-backend.bat

# Terminal 2 - Frontend
run-frontend.bat
```

**Linux/Mac**:
```bash
# Terminal 1 - Backend
./run-backend.sh

# Terminal 2 - Frontend
./run-frontend.sh
```

### Option 2: Manual Commands

**Backend** (Terminal 1):
```bash
# Activate venv first
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Run server
uvicorn mindflow.api.server:app --reload --host 127.0.0.1 --port 8000
```

**Frontend** (Terminal 2):
```bash
cd frontend
npm run dev
```

## Access Points

- **Frontend UI**: http://localhost:5173
- **Backend API**: http://127.0.0.1:8000
- **API Docs**: http://127.0.0.1:8000/docs (FastAPI auto-generated)
- **Health Check**: http://127.0.0.1:8000/health

## Verification

### 1. Test Backend

```bash
curl http://127.0.0.1:8000/
# Expected: {"message":"MindFlow Canvas API","version":"1.0.0"}

curl http://127.0.0.1:8000/health
# Expected: {"status":"healthy"}
```

### 2. Test Frontend

Open http://localhost:5173 in your browser. You should see the Vite + React welcome page.

## What's Implemented So Far

### ✅ Backend (Python FastAPI)
- [x] FastAPI server with CORS
- [x] Health check endpoints
- [x] Pydantic schemas (CanvasViewport)
- [x] Project structure (api/, routes/, schemas/)
- [ ] Graph API endpoints (coming next)
- [ ] Viewport persistence (coming next)

### ✅ Frontend (React + TypeScript)
- [x] Vite + React + TypeScript setup
- [x] Dependencies installed (React Flow, Zustand, Axios)
- [x] TypeScript types (Graph, Canvas entities)
- [x] Vite proxy configured (/api → backend)
- [ ] Canvas component (coming next)
- [ ] Zustand store (coming next)

## Next Steps

See `specs/002-node-canvas-interface/tasks.md` for the full implementation plan.

**Current Status**: Phase 1 complete, Phase 2 in progress (4/13 tasks done)

## Troubleshooting

### Backend won't start
- Ensure venv is activated: `venv\Scripts\activate`
- Check Python version: `python --version` (should be 3.11+)
- Reinstall: `pip install -e .`

### Frontend won't start
- Check Node version: `node --version` (should be 18+)
- Reinstall: `cd frontend && npm install`

### Port already in use
- Backend: Change port in `run-backend.bat` or use `--port 8001`
- Frontend: Vite will auto-increment (5173 → 5174)

## Development Workflow

1. **Make changes** to code
2. **Auto-reload** works for both backend (uvicorn --reload) and frontend (Vite HMR)
3. **Test** changes in browser
4. **Commit** when feature works

---

**Created**: 2025-11-17
**Feature**: 002-node-canvas-interface
**Status**: In Progress - Phase 2 Foundational
