!include "MUI2.nsh"

Name "Claude Token Tracker"
OutFile "Claude-Token-Tracker-Setup-2.0.0.exe"
InstallDir "$PROGRAMFILES64\Claude Token Tracker"
RequestExecutionLevel admin

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "Install"
  SetOutPath $INSTDIR
  File /r "D:\project\claude-token-tracker\src-tauri\target\release\claude-token-tracker.exe"
  File "D:\project\claude-token-tracker\src-tauri\target\release\track-usage.js"
  
  ; Create shortcut
  CreateDirectory "$SMPROGRAMS\Claude Token Tracker"
  CreateShortCut "$SMPROGRAMS\Claude Token Tracker\Claude Token Tracker.lnk" "$INSTDIR\claude-token-tracker.exe"
  CreateShortCut "$DESKTOP\Claude Token Tracker.lnk" "$INSTDIR\claude-token-tracker.exe"
  
  ; Uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  ; Registry for Add/Remove Programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClaudeTokenTracker" "DisplayName" "Claude Token Tracker"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClaudeTokenTracker" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClaudeTokenTracker" "DisplayVersion" "2.0.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClaudeTokenTracker" "Publisher" "Claude Token Tracker"
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\claude-token-tracker.exe"
  Delete "$INSTDIR\track-usage.js"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\Claude Token Tracker\Claude Token Tracker.lnk"
  RMDir "$SMPROGRAMS\Claude Token Tracker"
  Delete "$DESKTOP\Claude Token Tracker.lnk"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClaudeTokenTracker"
SectionEnd
