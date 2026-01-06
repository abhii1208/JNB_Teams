# Start backend as background process and redirect output to logs
param(
  [string]$NodeExe = "node",
  [string]$Script = "index.js",
  [string]$LogDir = "logs"
)

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir | Out-Null
}

$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$outFile = Join-Path $LogDir ("backend_$timestamp.log")
$errFile = Join-Path $LogDir ("backend_$timestamp.err.log")

Start-Process -FilePath $NodeExe -ArgumentList $Script -RedirectStandardOutput $outFile -RedirectStandardError $errFile -WindowStyle Hidden
Write-Output "Started backend as background process; logs: $outFile and $errFile"
