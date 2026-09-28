#!/bin/bash
# Build one-click Mac launcher (.app with icon) and refresh Windows launchers.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ICON_ICNS="$ROOT/build/icons/icon.icns"
ICON_PNG="$ROOT/build/icons/icon.png"
ICON_ICO="$ROOT/build/icons/icon.ico"

if [ ! -f "$ICON_ICNS" ]; then
  echo "[launchers] Missing $ICON_ICNS — run icon generation first"
  exit 1
fi

# ── macOS: "Play Raid of the Gel.app" at project root ─────────────────
APP="$ROOT/Play Raid of the Gel.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$ICON_ICNS" "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>Play Raid of the Gel</string>
  <key>CFBundleExecutable</key>
  <string>launch</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>com.softenedrealms.raidgel.launcher</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Play Raid of the Gel</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>LSUIElement</key>
  <false/>
</dict>
</plist>
PLIST

cat > "$APP/Contents/MacOS/launch" <<'LAUNCH'
#!/bin/bash
# One-click: prefer packaged .app, else Electron dev, else web PLAY.command
set -e
# .../Play Raid of the Gel.app/Contents/MacOS → project root
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT" || exit 1

open_packaged() {
  local c
  for c in \
    "dist/mac-arm64/Raid of the Gel.app" \
    "dist/mac/Raid of the Gel.app" \
    "dist/mac-universal/Raid of the Gel.app" \
    "dist/mac-x64/Raid of the Gel.app"
  do
    if [ -d "$ROOT/$c" ]; then
      open "$ROOT/$c"
      exit 0
    fi
  done
  return 1
}

open_packaged || true

# Dev Electron
if [ ! -d "$ROOT/node_modules/electron" ]; then
  osascript -e 'display notification "Installing Electron (one-time)…" with title "Raid of the Gel"' 2>/dev/null || true
  npm install --no-fund --no-audit >/tmp/raidgel-npm-install.log 2>&1 || {
    osascript -e 'display alert "Raid of the Gel" message "Could not install Electron. Open Terminal in this folder and run: npm install && npm run desktop"' 2>/dev/null || true
    exit 1
  }
fi

# Launch Electron (no terminal window)
export ELECTRON_RUN_AS_NODE=
exec "$ROOT/node_modules/.bin/electron" "$ROOT"
LAUNCH
chmod +x "$APP/Contents/MacOS/launch"

# Refresh Finder icon cache for this app
touch "$APP"
xattr -cr "$APP" 2>/dev/null || true

echo "[launchers] Mac: $APP"

# ── Windows launchers at project root ─────────────────────────────────
cat > "$ROOT/Play Raid of the Gel.bat" <<'BAT'
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
BAT

# VBS = true double-click, no black console flash
cat > "$ROOT/Play Raid of the Gel.vbs" <<'VBS'
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir

' Packaged first
unpacked = dir & "\dist\win-unpacked\Raid of the Gel.exe"
If fso.FileExists(unpacked) Then
  sh.Run """" & unpacked & """", 1, False
  WScript.Quit 0
End If

' Any portable exe in dist\
If fso.FolderExists(dir & "\dist") Then
  Set folder = fso.GetFolder(dir & "\dist")
  For Each f In folder.Files
    If LCase(fso.GetExtensionName(f.Name)) = "exe" Then
      If InStr(1, f.Name, "Raid", vbTextCompare) > 0 Or InStr(1, f.Name, "Gel", vbTextCompare) > 0 Then
        sh.Run """" & f.Path & """", 1, False
        WScript.Quit 0
      End If
    End If
  Next
End If

' Dev Electron
bat = dir & "\Play Raid of the Gel.bat"
If fso.FileExists(bat) Then
  ' Run bat hidden (0) so only the game window appears
  sh.Run "cmd /c """ & bat & """", 0, False
Else
  sh.Run "cmd /c cd /d """ & dir & """ && npx electron .", 0, False
End If
VBS

# PowerShell: create Desktop shortcut with .ico (run once on Windows)
cat > "$ROOT/scripts/create-windows-shortcut.ps1" <<'PS1'
# Creates a Desktop shortcut "Raid of the Gel" with the gel icon.
$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
# script is in project/scripts → project root is parent
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Ico = Join-Path $Root "build\icons\icon.ico"
$Vbs = Join-Path $Root "Play Raid of the Gel.vbs"
$Bat = Join-Path $Root "Play Raid of the Gel.bat"
$Target = if (Test-Path $Vbs) { $Vbs } else { $Bat }
$Desktop = [Environment]::GetFolderPath("Desktop")
$LnkPath = Join-Path $Desktop "Raid of the Gel.lnk"
$W = New-Object -ComObject WScript.Shell
$S = $W.CreateShortcut($LnkPath)
$S.TargetPath = $Target
$S.WorkingDirectory = $Root
$S.WindowStyle = 1
$S.Description = "Play Raid of the Gel"
if (Test-Path $Ico) { $S.IconLocation = "$Ico,0" }
$S.Save()
Write-Host "Created: $LnkPath"
Write-Host "Double-click the Desktop shortcut to play."
PS1

# Also refresh PLAY-DESKTOP.command to open the fancy app if present
cat > "$ROOT/PLAY-DESKTOP.command" <<'CMD'
#!/bin/bash
cd "$(dirname "$0")" || exit 1
if [ -d "Play Raid of the Gel.app" ]; then
  open "Play Raid of the Gel.app"
  exit 0
fi
if [ -d "dist/mac-arm64/Raid of the Gel.app" ]; then
  open "dist/mac-arm64/Raid of the Gel.app"
  exit 0
fi
if [ ! -d node_modules/electron ]; then
  echo "Installing Electron (one-time)…"
  npm install
fi
echo "Launching Raid of the Gel desktop…"
npx electron .
CMD
chmod +x "$ROOT/PLAY-DESKTOP.command"

echo "[launchers] Windows: Play Raid of the Gel.vbs / .bat"
echo "[launchers] Done. Double-click 'Play Raid of the Gel' on your OS."
