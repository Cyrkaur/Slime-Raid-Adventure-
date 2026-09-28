@echo off
setlocal
cd /d "%~dp0"

REM Prefer packaged portable / unpacked build
if exist "dist\win-unpacked\Raid of the Gel.exe" (
  start "" "dist\win-unpacked\Raid of the Gel.exe"
  exit /b 0
)
for %%F in ("dist\Raid of the Gel*.exe") do (
  if exist %%~fF (
    start "" "%%~fF"
    exit /b 0
  )
)
if exist "dist\Raid of the Gel 1.0.0.exe" (
  start "" "dist\Raid of the Gel 1.0.0.exe"
  exit /b 0
)

REM Dev: Electron via npm
where npm >nul 2>&1
if errorlevel 1 (
  echo npm not found. Install Node.js from https://nodejs.org then try again.
  pause
  exit /b 1
)
if not exist "node_modules\electron" (
  echo Installing Electron ^(one-time^)...
  call npm install --no-fund --no-audit
)
start "" /B cmd /c "npx electron ."
exit /b 0
