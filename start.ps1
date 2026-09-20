# AI Ticket Workspace - Automated Launch Script
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Starting AI Ticket Workspace with Docker  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Start containers in background
docker compose up --build -d

# 2. Wait briefly for services to initialize
Write-Host "`nWaiting for Frontend and Backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 3. Launch UI in default browser
Write-Host "Opening AI Ticket Workspace in browser..." -ForegroundColor Green
Start-Process "http://localhost:3000"

Write-Host "`nAll services are running:" -ForegroundColor Cyan
Write-Host "  -> Frontend UI:      http://localhost:3000" -ForegroundColor White
Write-Host "  -> Backend API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "  -> MailDev Web:      http://localhost:1080" -ForegroundColor White
Write-Host "`nTo view logs: docker compose logs -f" -ForegroundColor Gray
Write-Host "To stop:      docker compose down" -ForegroundColor Gray
