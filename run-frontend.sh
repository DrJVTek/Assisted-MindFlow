#!/bin/bash
# Script to run MindFlow Canvas UI frontend dev server
# Starts Vite dev server with hot-reload

cd "$(dirname "$0")/frontend"

echo "========================================"
echo "MindFlow Canvas UI - Frontend Server"
echo "========================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "ERROR: Dependencies not installed!"
    echo "Please run: npm install"
    exit 1
fi

echo "Starting Vite dev server on http://localhost:5173"
echo "Press CTRL+C to stop"
echo ""

npm run dev
