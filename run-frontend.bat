@echo off
REM Script to run MindFlow Canvas UI frontend dev server
REM Starts Vite dev server with hot-reload

cd /d "%~dp0\frontend"

echo ========================================
echo MindFlow Canvas UI - Frontend Server
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo ERROR: Dependencies not installed!
    echo Please run: npm install
    pause
    exit /b 1
)

echo Starting Vite dev server on http://localhost:5173
echo Press CTRL+C to stop
echo.

npm run dev
