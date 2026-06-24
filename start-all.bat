@echo off
title PRIMESTACK MOTO POS - All Services

echo Starting PRIMESTACK MOTO POS System...
echo.
echo ===========================================
echo Starting Backend API (Port 3001)...
echo ===========================================
start "Backend API" cmd /k "cd /d %~dp0 && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ===========================================
echo Starting Admin Dashboard (Port 3002)...
echo ===========================================
start "Admin Dashboard" cmd /k "cd /d %~dp0admin-dashboard && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ===========================================
echo Starting Merchant Dashboard (Port 3003)...
echo ===========================================
start "Merchant Dashboard" cmd /k "cd /d %~dp0merchant-dashboard && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ===========================================
echo Starting POS App (Port 3004)...
echo ===========================================
start "POS App" cmd /k "cd /d %~dp0pos-app && npm run dev"

echo.
echo ===========================================
echo All services are starting!
echo Access URLs:
echo - Backend API: http://localhost:3001
echo - Admin Dashboard: http://localhost:3002
echo - Merchant Dashboard: http://localhost:3003
echo - POS App: http://localhost:3004
echo ===========================================
pause
