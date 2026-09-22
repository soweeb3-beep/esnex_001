$ErrorActionPreference='Stop'
$p = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($p) {
  $processId = $p.OwningProcess
  Write-Output "Killing process on port 5000: PID=$processId"
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
} else {
  Write-Output 'No process found on port 5000'
}

Set-Location 'c:\Users\Ebrima Sowe\Desktop\FINAL\EXNEX TECHNOLOGIES CENTER\BACKEND'
# Start server with nodemon (dev)
npm run dev
