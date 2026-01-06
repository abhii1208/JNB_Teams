# Backend Server - Running Status

## Summary

✅ **The backend server is NOT closing automatically - it's running correctly!**

## What Was Happening

The confusion was caused by the terminal returning to the PowerShell prompt even though the server process was still running in the background. This is **normal and expected behavior** for background processes in PowerShell.

### Investigation Results:
1. **Server Process**: Running successfully (confirmed via `Get-Process`)
2. **Port 5000**: Server listening and bound to port
3. **Health Check**: `http://localhost:5000/api/health` returns status 200
4. **Error Handlers**: Working correctly (uncaughtException, unhandledRejection, SIGTERM, SIGINT)

## How to Start the Server

### Method 1: PowerShell Script (Recommended)
```powershell
cd c:\Projects\team\backend
.\start-server.ps1
```

This script:
- Starts the server as a background job
- Tests the health endpoint
- Shows the job ID for later management
- Provides commands to check logs and stop the server

### Method 2: PowerShell Background Job
```powershell
cd c:\Projects\team\backend
Start-Job -ScriptBlock { Set-Location "c:\Projects\team\backend"; npm start }
```

Then check it's running:
```powershell
Get-Job
Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing
```

### Method 3: Direct npm start (Terminal Stays Open)
```powershell
cd c:\Projects\team\backend
npm start
```

This will keep the terminal open and show logs. Press `Ctrl+C` to stop.

### Method 4: Separate PowerShell Window
```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd c:\Projects\team\backend; npm start"
```

## How to Verify Server is Running

### Check Process
```powershell
Get-Process node | Format-Table Id, ProcessName, StartTime
```

### Check Port 5000
```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen
```

### Test Health Endpoint
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing
```

Expected response:
```json
{"status":"ok","timestamp":"2026-01-06T00:40:26.672Z"}
```

## How to Stop the Server

### If Running as Background Job
```powershell
Get-Job  # Find the job ID
Stop-Job <ID>
Remove-Job <ID>
```

### If Running in Terminal
Press `Ctrl+C` in the terminal window

### Kill All Node Processes (Nuclear Option)
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

## Server Configuration

- **Port**: 5000
- **Database**: PostgreSQL (connection pool managed)
- **Error Handling**: 
  - Uncaught exceptions logged (server continues)
  - Unhandled promise rejections logged (server continues)
  - SIGTERM/SIGINT: Graceful shutdown (closes DB pool first)

## Troubleshooting

### "Address already in use" Error
Another process is using port 5000. Find and kill it:
```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

### Server Not Responding
1. Check if node process is running: `Get-Process node`
2. Check if port 5000 is listening: `Get-NetTCPConnection -LocalPort 5000`
3. Check for errors: `Receive-Job <ID>` (if using background job)
4. Restart the server

### Database Connection Issues
Check the `.env` file in `backend/` folder for correct PostgreSQL credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=team_app
DB_USER=postgres
DB_PASSWORD=your_password
```

## Current Status (as of testing)

✅ Server started successfully  
✅ Health endpoint responding  
✅ Database connection working  
✅ Error handlers configured  
✅ No automatic shutdowns detected  

**Conclusion**: The server is stable and running as expected. The terminal returning to prompt is normal PowerShell behavior for background processes.
