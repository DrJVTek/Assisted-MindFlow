#!/bin/bash
# Complete installation script for MindFlow Canvas Interface
# Sets up both backend (Python) and frontend (Node.js)

set -e  # Exit on error

echo "========================================"
echo "MindFlow Canvas Interface - Installation"
echo "========================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python not found! Please install Python 3.11+ first."
    echo "Download from: https://www.python.org/downloads/"
    exit 1
fi

echo "[1/5] Python found"
python3 --version

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found! Please install Node.js 18+ first."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

echo "[2/5] Node.js found"
node --version

# Create Python venv
echo ""
echo "[3/5] Creating Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "Virtual environment created"
else
    echo "Virtual environment already exists"
fi

# Install Python dependencies
echo ""
echo "[4/5] Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -e .

echo "Python dependencies installed successfully"

# Install Node.js dependencies
echo ""
echo "[5/5] Installing Node.js dependencies..."
cd frontend
npm install
cd ..

echo "Node.js dependencies installed successfully"

echo ""
echo "========================================"
echo "Installation Complete!"
echo "========================================"
echo ""
echo "To start the application:"
echo "  1. Backend:  ./run-backend.sh"
echo "  2. Frontend: ./run-frontend.sh"
echo ""
echo "Or open 2 terminals and run both scripts."
echo ""
