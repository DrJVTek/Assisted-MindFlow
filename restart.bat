@echo off
REM Restart script for Windows - Kills and relaunches backend + frontend servers
REM Usage: restart.bat

echo ================================================
echo  MindFlow Server Restart (Windows)
echo ================================================
echo.

echo [1/4] Killing existing backend processes...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   - Backend processes killed
) else (
    echo   - No backend processes found
)
echo.

echo [2/4] Killing existing frontend processes...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *vite*" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   - Frontend processes killed
) else (
    echo   - No frontend processes found
)
echo.

REM Wait for ports to be released
timeout /t 2 /nobreak >nul

echo [3/4] Starting backend server...
start "MindFlow Backend" cmd /k "cd /d "%~dp0" && venv\Scripts\python.exe -m uvicorn mindflow.api.server:app --reload --port 8000"
echo   - Backend starting on port 8000
echo.

REM Wait for backend to initialize
timeout /t 3 /nobreak >nul

echo [4/4] Starting frontend server...
start "MindFlow Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo   - Frontend starting on port 5173
echo.

echo ================================================
echo  Servers restarted successfully!
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:5173
echo ================================================
echo.
pause
