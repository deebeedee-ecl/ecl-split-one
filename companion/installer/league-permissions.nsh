; A per-user launch preference, not a machine-wide or silent UAC bypass.
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "WordFunc.nsh"

; Override only in the isolated NSIS integration harness.
!ifndef ECL_COMPAT_KEY
  !define ECL_COMPAT_KEY "Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers"
!endif

!ifndef ECL_PERMISSIONS_STRINGS
!define ECL_PERMISSIONS_STRINGS
LangString EclPermissionsTitle 1033 "League connection permissions"
LangString EclPermissionsTitle 2052 "英雄联盟连接权限"
LangString EclPermissionsSubtitle 1033 "Choose how ECL Hub starts on this Windows account."
LangString EclPermissionsSubtitle 2052 "选择 ECL Hub 在当前 Windows 账户下的启动方式。"
LangString EclPermissionsOption 1033 "Run ECL Hub as administrator when it starts"
LangString EclPermissionsOption 2052 "启动 ECL Hub 时以管理员身份运行"
LangString EclPermissionsHelp 1033 "Recommended when League or WeGame runs as administrator. Matching permissions allows Hub to read League's local connection.$\r$\n$\r$\nWindows will still ask for approval when Hub starts. This does not disable UAC or grant permanent administrator rights.$\r$\n$\r$\nIf League runs normally, you can uncheck this option. Re-run this installer to change your choice. Use the same Windows account to keep your sign-in and matches."
LangString EclPermissionsHelp 2052 "当英雄联盟或 WeGame 以管理员身份运行时，建议勾选此项。权限一致后，Hub 才能读取游戏的本地连接信息。$\r$\n$\r$\n启动 Hub 时，Windows 仍会请求批准；此选项不会关闭 UAC，也不会永久授予管理员权限。$\r$\n$\r$\n如果游戏以普通权限运行，可以取消勾选。重新运行安装程序即可修改选择。请使用同一 Windows 账户，以保留登录状态和比赛记录。"
LangString EclPermissionsSaveError 1033 "Windows could not save the Hub launch preference. You can still finish installing, then run ECL Hub as administrator from its shortcut if League requires it."
LangString EclPermissionsSaveError 2052 "Windows 无法保存 Hub 启动设置。你仍可完成安装；如果游戏需要管理员权限，请右键 Hub 快捷方式并以管理员身份运行。"
!endif

!ifndef BUILD_UNINSTALLER
  Var EclRunAsAdmin
  Var EclPermissionsDialog
  Var EclPermissionsCheckbox

  !macro customInit
    ; Silent updates without a prior choice must not silently enable elevation.
    ClearErrors
    ReadRegDWORD $EclRunAsAdmin HKCU "${INSTALL_REGISTRY_KEY}" "LeagueAdminLaunch"
    ${If} ${Errors}
      StrCpy $EclRunAsAdmin 0
      ${If} ${Silent}
        ; Keep an existing manually configured compatibility preference too.
        ReadRegStr $0 HKCU "${ECL_COMPAT_KEY}" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
        ${WordReplace} "$0" "RUNASADMIN" "" "+" $1
        ${If} $0 != $1
          StrCpy $EclRunAsAdmin 1
        ${EndIf}
      ${Else}
        StrCpy $EclRunAsAdmin 1
      ${EndIf}
    ${EndIf}
  !macroend

  !macro customPageAfterChangeDir
    Page custom EclPermissionsCreate EclPermissionsLeave
  !macroend

  Function EclPermissionsCreate
    ${If} ${Silent}
      Abort
    ${EndIf}
    !insertmacro MUI_HEADER_TEXT "$(EclPermissionsTitle)" "$(EclPermissionsSubtitle)"
    nsDialogs::Create 1018
    Pop $EclPermissionsDialog
    ${If} $EclPermissionsDialog == error
      Abort
    ${EndIf}
    ${NSD_CreateCheckbox} 0 2u 100% 24u "$(EclPermissionsOption)"
    Pop $EclPermissionsCheckbox
    ${NSD_SetState} $EclPermissionsCheckbox $EclRunAsAdmin
    ${NSD_CreateLabel} 0 32u 100% 96u "$(EclPermissionsHelp)"
    Pop $0
    nsDialogs::Show
  FunctionEnd

  Function EclPermissionsLeave
    ${NSD_GetState} $EclPermissionsCheckbox $EclRunAsAdmin
  FunctionEnd

  !macro customInstall
    ; Touch only this executable's HKCU entry. Preserve unrelated DPI/OS flags.
    ReadRegStr $0 HKCU "${ECL_COMPAT_KEY}" "$appExe"
    ${WordReplace} "$0" "RUNASADMIN" "" "+" $1
    ClearErrors
    ${If} $EclRunAsAdmin == 1
      ${If} $1 == ""
        StrCpy $1 "~"
      ${EndIf}
      WriteRegStr HKCU "${ECL_COMPAT_KEY}" "$appExe" "$1 RUNASADMIN"
    ${Else}
      ${If} $1 == ""
      ${OrIf} $1 == "~"
      ${OrIf} $1 == "~ "
        ${If} $0 != ""
          DeleteRegValue HKCU "${ECL_COMPAT_KEY}" "$appExe"
        ${EndIf}
      ${Else}
        WriteRegStr HKCU "${ECL_COMPAT_KEY}" "$appExe" "$1"
      ${EndIf}
    ${EndIf}
    ${If} ${Errors}
      MessageBox MB_OK|MB_ICONEXCLAMATION "$(EclPermissionsSaveError)" /SD IDOK
    ${Else}
      WriteRegDWORD HKCU "${INSTALL_REGISTRY_KEY}" "LeagueAdminLaunch" $EclRunAsAdmin
    ${EndIf}
  !macroend
!else
  !macro customUnInstall
    ; Keep the preference during an upgrade; remove only our flag on full uninstall.
    ${IfNot} ${isUpdated}
      ReadRegDWORD $0 HKCU "${INSTALL_REGISTRY_KEY}" "LeagueAdminLaunch"
      ${If} $0 == 1
        ReadRegStr $0 HKCU "${ECL_COMPAT_KEY}" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
        ${un.WordReplace} "$0" "RUNASADMIN" "" "+" $1
        ${If} $1 == ""
        ${OrIf} $1 == "~"
        ${OrIf} $1 == "~ "
          DeleteRegValue HKCU "${ECL_COMPAT_KEY}" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
        ${Else}
          WriteRegStr HKCU "${ECL_COMPAT_KEY}" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "$1"
        ${EndIf}
      ${EndIf}
    ${EndIf}
  !macroend
!endif
