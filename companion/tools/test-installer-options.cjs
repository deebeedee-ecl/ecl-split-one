// Compiles the real NSIS hooks and exercises only a unique test registry namespace.
// No ECL installation, player data, real compatibility entry or UAC setting is changed.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const quote = value => `'${String(value).replace(/'/g, "''")}'`;

async function powershell(script) {
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from("$ProgressPreference='SilentlyContinue'\n" + script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 30000 });
  return stdout.trim();
}
async function main() {
  if (process.platform !== 'win32') throw new Error('The native installer integration check requires Windows.');
  const id = crypto.randomUUID();
  const directory = path.resolve(__dirname, '../.test-data', `installer-options-${id}`);
  const key = `Software\\ECLHubInstallerTests\\${id}`;
  const registry = `HKCU:\\${key}`;
  const executable = path.join(directory, 'ECL Fixture.exe');
  await fs.mkdir(directory, { recursive: true });
  const hook = path.resolve(__dirname, '../installer/league-permissions.nsh');
  const nsis = '$';
  const fixture = `Unicode true
Name "ECL permissions test"
OutFile "${directory}\\fixture.exe"
InstallDir "${directory}"
RequestExecutionLevel user
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!define INSTALL_REGISTRY_KEY "${key}\\Install"
!define APP_EXECUTABLE_FILENAME "ECL Fixture.exe"
!define ECL_COMPAT_KEY "${key}\\Layers"
Var appExe
Var EclTestUpdated
!define isUpdated '\"$EclTestUpdated\" == \"1\"'
!include "${hook}"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro customPageAfterChangeDir
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"
Function .onInit
  SetRegView 64
  !insertmacro customInit
  ${nsis}{GetParameters} $0
  ClearErrors
  ${nsis}{GetOptions} $0 "/choice=" $1
  ${nsis}{IfNot} ${nsis}{Errors}
    StrCpy $EclRunAsAdmin $1
  ${nsis}{EndIf}
  ClearErrors
  ${nsis}{GetOptions} $0 "/language=" $1
  ${nsis}{IfNot} ${nsis}{Errors}
    StrCpy $LANGUAGE $1
  ${nsis}{EndIf}
FunctionEnd
Section
  StrCpy $appExe "$INSTDIR\\${nsis}{APP_EXECUTABLE_FILENAME}"
  !insertmacro customInstall
  WriteUninstaller "${directory}\\fixture-uninstaller.exe"
SectionEnd
!define BUILD_UNINSTALLER
!include "${hook}"
Function un.onInit
  SetRegView 64
  StrCpy $INSTDIR "${directory}"
  StrCpy $EclTestUpdated 0
  ${nsis}{GetParameters} $0
  ClearErrors
  ${nsis}{GetOptions} $0 "/updated" $1
  ${nsis}{IfNot} ${nsis}{Errors}
    StrCpy $EclTestUpdated 1
  ${nsis}{EndIf}
FunctionEnd
Section "Uninstall"
  !insertmacro customUnInstall
SectionEnd
`;
  const script = path.join(directory, 'fixture.nsi');
  await fs.writeFile(script, fixture);
  const tools = await require('app-builder-lib/out/toolsets/windows').getMakeNsisPath();
  await exec(tools.path, ['/V2', script], { env: { ...process.env, ...tools.env }, windowsHide: true, timeout: 30000 });
  const layer = `${registry}\\Layers`, install = `${registry}\\Install`;
  const seed = async (value, choice) => powershell(`$ErrorActionPreference='Stop'
New-Item -Path ${quote(layer)} -Force | Out-Null
New-Item -Path ${quote(install)} -Force | Out-Null
${value === null ? `Remove-ItemProperty -LiteralPath ${quote(layer)} -Name ${quote(executable)} -ErrorAction SilentlyContinue` : `New-ItemProperty -LiteralPath ${quote(layer)} -Name ${quote(executable)} -Value ${quote(value)} -PropertyType String -Force | Out-Null`}
${choice === null ? `Remove-ItemProperty -LiteralPath ${quote(install)} -Name LeagueAdminLaunch -ErrorAction SilentlyContinue` : `New-ItemProperty -LiteralPath ${quote(install)} -Name LeagueAdminLaunch -Value ${choice} -PropertyType DWord -Force | Out-Null`}
Write-Output 'seeded'`);
  const read = async () => JSON.parse(await powershell(`$ErrorActionPreference='Stop'
$entry = Get-ItemProperty -LiteralPath ${quote(layer)} -ErrorAction SilentlyContinue
$policy = Get-ItemProperty -LiteralPath ${quote(install)} -ErrorAction SilentlyContinue
@{ layers = [string]$entry.${quote(executable)}; choice = $policy.LeagueAdminLaunch } | ConvertTo-Json -Compress`));
  const run = async (...args) => { await exec(path.join(directory, 'fixture.exe'), ['/S', ...args], { windowsHide: true, timeout: 30000 }); return read(); };
  try {
    await seed(null, null);
    let state = await run(); assert.equal(state.layers, ''); assert.equal(state.choice, 0);
    state = await run('/choice=1'); assert.match(state.layers, /RUNASADMIN/); assert.equal(state.choice, 1);
    state = await run(); assert.match(state.layers, /RUNASADMIN/); assert.equal(state.choice, 1);
    await seed('~ HIGHDPIAWARE RUNASADMIN', 1);
    state = await run('/choice=0'); assert.match(state.layers, /HIGHDPIAWARE/); assert.doesNotMatch(state.layers, /RUNASADMIN/); assert.equal(state.choice, 0);
    state = await run(); assert.equal(state.choice, 0); assert.doesNotMatch(state.layers, /RUNASADMIN/);
    await seed('~ HIGHDPIAWARE RUNASADMIN', null);
    state = await run(); assert.equal(state.choice, 1); assert.match(state.layers, /RUNASADMIN/);
    state = await run('/choice=1'); assert.equal(state.layers.match(/RUNASADMIN/g).length, 1);
    await exec(path.join(directory, 'fixture-uninstaller.exe'), ['/S', '/updated', `_?=${directory}`], { windowsHide: true, timeout: 30000 });
    state = await read(); assert.match(state.layers, /RUNASADMIN/);
    await exec(path.join(directory, 'fixture-uninstaller.exe'), ['/S', `_?=${directory}`], { windowsHide: true, timeout: 30000 });
    state = await read(); assert.match(state.layers, /HIGHDPIAWARE/); assert.doesNotMatch(state.layers, /RUNASADMIN/);
    console.log(JSON.stringify({ status: 'passed', cases: 9, registryScope: 'unique test-only HKCU namespace', fixtureDirectory: directory }));
  } finally {
    // The UUID namespace is the only recursive registry removal target.
    if (!/^HKCU:\\Software\\ECLHubInstallerTests\\[a-f0-9-]{36}$/.test(registry)) throw new Error('Unexpected test registry scope.');
    await powershell(`Remove-Item -LiteralPath ${quote(registry)} -Recurse -Force -ErrorAction SilentlyContinue`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
