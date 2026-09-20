@echo off
echo =============================================
echo    Starting AI Ticket Workspace with Docker  
echo =============================================

docker compose up --build -d

echo Waiting for services to initialize...
timeout /t 3 /nobreak >nul

echo Opening browser at http://localhost:3000 ...
start http://localhost:3000

echo.
echo =============================================
echo Services running:
echo   - Frontend:      http://localhost:3000
echo   - Backend Docs:  http://localhost:8000/docs
echo   - MailDev:       http://localhost:1080
echo =============================================
echo To stop services, run: docker compose down
pause
