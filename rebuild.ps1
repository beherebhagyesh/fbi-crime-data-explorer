# Rebuild and Restart script
Write-Host "Rebuilding Docker containers..." -ForegroundColor Cyan

# Stop existing containers
docker-compose down

# Rebuild images
docker-compose build --no-cache

# Start containers in detached mode
docker-compose up -d

Write-Host "Application is running!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:49000" -ForegroundColor Yellow
Write-Host "API Dashboard: http://localhost:49080" -ForegroundColor Yellow
