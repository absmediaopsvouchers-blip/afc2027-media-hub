@echo off
REM ===== AFC Asian Cup 2027 - Media Hub launcher (Windows) =====
REM Double-click this file to start the server.
setlocal
cd /d "%~dp0"

REM Prefer the bundled portable Node; fall back to a system-wide Node.
set "NODE_EXE=%~dp0.node-portable\node-v24.17.0-win-x64\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

if not exist "%~dp0node_modules" (
  echo Installing dependencies for the first time...
  "%NODE_EXE%" "%~dp0.node-portable\node-v24.17.0-win-x64\node_modules\npm\bin\npm-cli.js" install --no-audit --no-fund
)

echo.
echo Starting AFC Asian Cup 2027 - Media Hub ...
echo (Close this window to stop the server.)
echo.
"%NODE_EXE%" server.js

echo.
echo Server stopped.
pause
