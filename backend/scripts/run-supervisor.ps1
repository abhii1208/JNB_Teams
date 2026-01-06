# Supervisor loop for backend: restarts `node index.js` when it exits.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-supervisor.ps1

param(
  [int]$InitialBackoffSeconds = 2,
  [int]$MaxBackoffSeconds = 30,
  [string]$NodeExe = "node",
  [string]$Script = "index.js",
  [string]$LogDir = "logs"
)

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir | Out-Null
}

$run = 0
$backoff = $InitialBackoffSeconds

while ($true) {
  $run++
  $timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
  $outFile = Join-Path $LogDir ("supervisor_run_${run}_$timestamp.log")
  $errFile = Join-Path $LogDir ("supervisor_run_${run}_$timestamp.err.log")

  Write-Output "[$(Get-Date -Format o)] Supervisor: starting '$NodeExe $Script' (run #$run). Output -> $outFile"

  # Start node and wait for it to exit, redirecting output to files
  Start-Process -FilePath $NodeExe -ArgumentList $Script -RedirectStandardOutput $outFile -RedirectStandardError $errFile -Wait -NoNewWindow
  $exitCode = $LASTEXITCODE

  Write-Output "[$(Get-Date -Format o)] Supervisor: process exited with code $exitCode"
  Write-Output "[$(Get-Date -Format o)] Supervisor: logs: $outFile, $errFile"

  # exponential backoff with cap
  Start-Sleep -Seconds $backoff
  $backoff = [Math]::Min($backoff * 2, $MaxBackoffSeconds)

  Write-Output "[$(Get-Date -Format o)] Supervisor: restarting (next backoff $backoff s)"
}
