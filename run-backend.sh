#!/bin/bash
# Script to run MindFlow Canvas API backend server
# Activates venv and starts uvicorn with hot-reload

cd "$(dirname "$0")"

echo "========================================"
echo "MindFlow Canvas API - Backend Server"
echo "========================================"
echo ""

# Check if venv exists
if [ ! -f "venv/bin/activate" ]; then
    echo "ERROR: Virtual environment not found!"
    echo "Please run: python -m venv venv"
    echo "Then run: venv/bin/pip install -e ."
    exit 1
fi

# Activate venv and run server
echo "Activating virtual environment..."
source venv/bin/activate

echo "Starting FastAPI server on http://127.0.0.1:8000"
echo "Press CTRL+C to stop"
echo ""

uvicorn mindflow.api.server:app --reload --host 127.0.0.1 --port 8000
