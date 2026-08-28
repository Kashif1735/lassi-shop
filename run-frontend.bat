@echo off
title Lassi Shop Frontend Client
echo =======================================
echo   Lassi Shop Online - Frontend Launch  
echo =======================================
echo.
echo Waiting for backend server to warm up (2 seconds)...
timeout /t 2 /nobreak > nul
echo.
echo Launching Customer Ordering Site...
start http://localhost:3000/
echo.
echo Launching Shop Owner Admin Dashboard...
start http://localhost:3000/admin.html
echo.
echo Done! Enjoy serving fresh lassis!
timeout /t 3 > nul
exit
