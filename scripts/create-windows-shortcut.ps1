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
