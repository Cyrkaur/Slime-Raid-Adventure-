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
