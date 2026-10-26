@echo off
title ZenFlow AI Enterprise Platform Launcher
cls
echo ========================================================
echo     ZenFlow AI Enterprise Platform - 100%% Local Launcher
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting AI Retrieval & Deflection Microservice (Port 8000)...
start "ZenFlow AI Microservice" /min python -m uvicorn ai-backend.main:app --host 127.0.0.1 --port 8000

echo [2/3] Initializing microservice...
timeout /t 2 /nobreak > nul

echo [3/3] Starting Node.js Enterprise Gateway & Web App (Port 5000)...
start "ZenFlow Web Gateway" /min node server.js

echo.
echo ========================================================
echo   ZenFlow is LIVE & running 100%% locally free!
echo   - Local Web App:     http://localhost:5000
echo   - AI Microservice:   http://127.0.0.1:8000
echo   - Local Storage:     data/tickets_store.json
echo   - Cloud Costs:       $0.00 / Free forever
echo ========================================================
echo.
echo Opening ZenFlow in your default browser...
timeout /t 1 /nobreak > nul
start http://localhost:5000

echo.
echo Done! You can minimize or close this window.
echo To shut down all services, run 'stop-zenflow.bat'.
pause
