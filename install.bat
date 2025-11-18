@echo off
REM Complete installation script for MindFlow Canvas Interface
REM Sets up both backend (Python) and frontend (Node.js)

echo ========================================
echo MindFlow Canvas Interface - Installation
echo ========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found! Please install Python 3.11+ first.
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/5] Python found
python --version

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found! Please install Node.js 18+ first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo [2/5] Node.js found
node --version

REM Create Python venv
echo.
echo [3/5] Creating Python virtual environment...
if not exist "venv" (
    python -m venv venv
    echo Virtual environment created
) else (
    echo Virtual environment already exists
)

REM Install Python dependencies
echo.
echo [4/5] Installing Python dependencies...
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -e .
if errorlevel 1 (
    echo ERROR: Failed to install Python dependencies
    pause
    exit /b 1
)

echo Python dependencies installed successfully

REM Install Node.js dependencies
echo.
echo [5/5] Installing Node.js dependencies...
cd frontend
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install Node.js dependencies
    cd ..
    pause
    exit /b 1
)

cd ..
echo Node.js dependencies installed successfully

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo To start the application:
echo   1. Backend:  run-backend.bat
echo   2. Frontend: run-frontend.bat
echo.
echo Or open 2 terminals and run both scripts.
echo.
pause
