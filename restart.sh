#!/bin/bash
# Restart script for Linux/Mac - Kills and relaunches backend + frontend servers
# Usage: ./restart.sh

set -e

echo "================================================"
echo " MindFlow Server Restart (Linux/Mac)"
echo "================================================"
echo ""

echo "[1/4] Killing existing backend processes..."
pkill -f "uvicorn mindflow.api.server:app" 2>/dev/null && echo "  - Backend processes killed" || echo "  - No backend processes found"
echo ""

echo "[2/4] Killing existing frontend processes..."
pkill -f "vite" 2>/dev/null && echo "  - Frontend processes killed" || echo "  - No frontend processes found"
echo ""

# Wait for ports to be released
sleep 2

echo "[3/4] Starting backend server..."
cd "$(dirname "$0")"
nohup venv/bin/python -m uvicorn mindflow.api.server:app --reload --port 8000 > logs/backend.log 2>&1 &
echo "  - Backend starting on port 8000 (PID: $!)"
echo ""

# Wait for backend to initialize
sleep 3

echo "[4/4] Starting frontend server..."
cd frontend
nohup npm run dev > ../logs/frontend.log 2>&1 &
echo "  - Frontend starting on port 5173 (PID: $!)"
cd ..
echo ""

echo "================================================"
echo " Servers restarted successfully!"
echo " Backend:  http://localhost:8000"
echo " Frontend: http://localhost:5173"
echo " Logs: logs/backend.log, logs/frontend.log"
echo "================================================"
echo ""
