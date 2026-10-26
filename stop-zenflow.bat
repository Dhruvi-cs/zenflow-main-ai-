@echo off
title Stop ZenFlow AI Platform
cls
echo ========================================================
echo          Stopping ZenFlow Local Background Services
echo ========================================================
echo.

echo Terminating Node.js Gateway on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Terminating Python FastAPI Microservice on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo All ZenFlow services on ports 5000 and 8000 have been safely stopped.
echo ========================================================
pause
