@echo off
cd /d "%~dp0"
set PYTHONPATH=%~dp0src
python -m uvicorn mindflow.api.server:app --reload --host 127.0.0.1 --port 8000
