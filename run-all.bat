@echo off
title Lassi Shop Launcher
echo =======================================
echo   Lassi Shop Online Ordering Launcher  
echo =======================================
echo.
echo Launching Backend Server (new terminal window)...
start cmd /c "run-backend.bat"
echo.
echo Launching Frontend Client (opening browser)...
start cmd /c "run-frontend.bat"
echo.
echo Startup instructions completed.
exit
