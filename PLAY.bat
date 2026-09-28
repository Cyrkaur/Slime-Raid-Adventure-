@echo off
REM Double-click on Windows to play (no npm required).
REM Keep this window open while playing.
cd /d "%~dp0"
set PORT=8090
set URL=http://127.0.0.1:%PORT%/index.html

echo.
echo   Raid of the Gel
echo   Serving this folder on %URL%
echo   Leave this window open. Close it to stop the game server.
echo.

where py >nul 2>&1
if %ERRORLEVEL%==0 (
  start "" "%URL%"
  py -3 -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  start "" "%URL%"
  python -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

where python3 >nul 2>&1
if %ERRORLEVEL%==0 (
  start "" "%URL%"
  python3 -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

echo Python is required.
echo Install from https://www.python.org/downloads/ then double-click PLAY.bat again.
pause
