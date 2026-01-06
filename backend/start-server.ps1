# Start Backend Server Script
# This script starts the backend server in a background job and monitors it

Write-Host "🚀 Starting backend server..." -ForegroundColor Green

# Change to backend directory
Set-Location "$PSScriptRoot"

# Start the server as a background job
$job = Start-Job -ScriptBlock {
    Set-Location $args[0]
    npm start
} -ArgumentList (Get-Location).Path

Write-Host "✅ Server starting... (Job ID: $($job.Id))" -ForegroundColor Green
Write-Host "⏳ Waiting for server to be ready..." -ForegroundColor Yellow

# Wait a bit for the server to start
Start-Sleep -Seconds 3

# Test if server is responding
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing -TimeoutSec 5
    $health = $response.Content | ConvertFrom-Json
    
    if ($health.status -eq "ok") {
        Write-Host "✅ Backend server is running successfully!" -ForegroundColor Green
        Write-Host "   📡 Health check: http://localhost:5000/api/health" -ForegroundColor Cyan
        Write-Host "   ⏰ Server time: $($health.timestamp)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "To stop the server, run: Stop-Job $($job.Id); Remove-Job $($job.Id)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Server may still be starting up. Check manually at http://localhost:5000/api/health" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "To check server status, run: Get-Job $($job.Id)" -ForegroundColor Cyan
Write-Host "To view server logs, run: Receive-Job $($job.Id) -Keep" -ForegroundColor Cyan
