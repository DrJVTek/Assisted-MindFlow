@echo off
REM Script to run MindFlow Canvas API backend server
REM Activates venv and starts uvicorn with hot-reload

cd /d "%~dp0"

echo ========================================
echo MindFlow Canvas API - Backend Server
echo ========================================
echo.

REM Check if venv exists
if not exist "venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found!
    echo Please run: python -m venv venv
    echo Then run: venv\Scripts\pip install -e .
    pause
    exit /b 1
)

REM Activate venv and run server
echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Starting FastAPI server on http://127.0.0.1:8000
echo Press CTRL+C to stop
echo.

uvicorn mindflow.api.server:app --reload --host 127.0.0.1 --port 8000
