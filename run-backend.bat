@echo off
title Lassi Shop Backend Server
echo =======================================
echo   Lassi Shop Online - Backend Startup  
echo =======================================
echo.
echo Step 1: Checking Node.js dependencies...
if not exist node_modules (
    echo Dependencies not found. Installing...
    call npm install
) else (
    echo Dependencies already installed.
)
echo.
echo Step 2: Launching Express Server...
npm start
pause
