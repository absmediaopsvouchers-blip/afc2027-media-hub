# ===== AFC Asian Cup 2027 - Media Hub launcher (PowerShell) =====
# Run with:  powershell -ExecutionPolicy Bypass -File .\start.ps1
Set-Location -Path $PSScriptRoot

# Prefer the bundled portable Node; fall back to a system-wide Node.
$node = Join-Path $PSScriptRoot '.node-portable\node-v24.17.0-win-x64\node.exe'
if (-not (Test-Path $node)) { $node = 'node' }

if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules'))) {
  Write-Host 'Installing dependencies for the first time...'
  $npmCli = Join-Path $PSScriptRoot '.node-portable\node-v24.17.0-win-x64\node_modules\npm\bin\npm-cli.js'
  & $node $npmCli install --no-audit --no-fund
}

Write-Host ''
Write-Host 'Starting AFC Asian Cup 2027 - Media Hub ...' -ForegroundColor Cyan
Write-Host '(Press Ctrl+C to stop the server.)'
Write-Host ''
& $node server.js
