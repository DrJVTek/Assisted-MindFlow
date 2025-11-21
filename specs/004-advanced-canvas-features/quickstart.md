# Quickstart: Advanced Canvas Features

**Feature**: 004-advanced-canvas-features  
**Date**: 2025-11-18

## Prerequisites

- Python 3.11+
- Node.js 18+
- Existing MindFlow installation (Features 001-003 implemented)

## Development Setup

### 1. Install Dependencies

**Backend**:
No new Python dependencies required - uses existing FastAPI stack.

**Frontend**:
```bash
cd frontend
npm install elkjs@^0.9.0
```

### 2. Database Setup

Current implementation uses JSON file storage. Create directories:

```bash
mkdir -p data/canvases
mkdir -p data/subgraphs
mkdir -p data/users
```

### 3. Run Development Servers

**Backend** (Terminal 1):
```bash
./run-backend.sh  # Linux/Mac
# or
.un-backend.bat  # Windows
```

**Frontend** (Terminal 2):
```bash
./run-frontend.sh  # Linux/Mac
# or
.un-frontend.bat  # Windows
```

### 4. Verify Setup

Open browser to http://localhost:5173

Expected initial state:
- Empty canvas list in left sidebar
- "+ New Canvas" button visible
- Default canvas created automatically

## Testing Quick Checks

### Manual Smoke Tests

1. **Canvas Management**:
   - Click "+ New Canvas" → new canvas created
   - Double-click canvas name → rename dialog appears
   - Switch between canvases → correct graph data loads

2. **Copy/Paste**:
   - Create 2 nodes
   - Select both (Ctrl+Click)
   - Ctrl+C to copy
   - Ctrl+V to paste
   - Verify duplicates appear with " (copy)" suffix

3. **Auto-Layout**:
   - Create 5+ nodes in random positions
   - Click "Auto-Layout" button
   - Verify nodes arrange hierarchically with animation

### Automated Tests

```bash
# Backend tests
cd E:\Projects\github\Assisted MindFlow
pytest tests/test_canvas.py -v
pytest tests/test_subgraph.py -v

# Frontend tests
cd frontend
npm test -- --run
```

## File Structure

After setup, new files:

```
src/mindflow/
├─ models/
│  ├─ canvas.py (NEW)
│  ├─ subgraph.py (NEW)
│  └─ preferences.py (NEW)
├─ api/
│  └─ routes/
│     ├─ canvases.py (NEW)
│     └─ subgraphs.py (NEW)

frontend/src/
├─ features/
│  └─ canvas/
│     ├─ components/
│     │  ├─ CanvasNavigator.tsx (NEW)
│     │  ├─ AutoLayoutButton.tsx (NEW)
│     │  └─ SubGraphLibrary.tsx (NEW)
│     └─ services/
│        └─ layoutService.ts (NEW)
├─ types/
│  ├─ canvas.ts (UPDATED)
│  ├─ subgraph.ts (NEW)
│  └─ preferences.ts (NEW)
└─ stores/
   └─ canvasStore.ts (UPDATED)
```

## Common Issues

### Issue: "elkjs not found"
**Solution**: Run `npm install elkjs` in frontend directory

### Issue: Canvas list empty after refresh
**Solution**: Check backend logs - may be data persistence issue. Verify data/canvases directory exists.

### Issue: Auto-layout doesn't move nodes
**Solution**: Check browser console for web worker errors. Verify ELK.js loaded correctly.

## Next Steps

After setup:
1. Review data-model.md for entity structures
2. Review contracts/ for API specifications
3. Implement backend models (Phase 2)
4. Implement frontend components (Phase 3)
5. Run full test suite before PR

## Support

For issues during development:
- Check existing tests for usage examples
- Review research.md for architectural decisions
- Consult constitution.md for project principles
