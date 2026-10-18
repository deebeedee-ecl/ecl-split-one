# ECL Hub 1.0.1: installer launch-permission option

The owner confirmed **1.0.1** as the patch version and requested the permissions
choice in the installer. This supersedes the previously discussed in-app
restart action: no new in-app elevation flow was added.

## Give testers this file

`companion/release-test-101/ECL-Hub-Setup-1.0.1.exe`

- Size: **119,270,898 bytes** (about 119 MB).
- SHA-256: `97bce4cb80a3889f87eb2653c6ac27ab58e392897d0e41666bf08a04d05a3730`.
- Locally signed and verified with the same ECL Ed25519 pin as prior releases.
  This does not provide Windows Authenticode publisher reputation.
- The installer is self-contained; no other files are required for manual
  installation. Existing 1.0.0 and 0.9.2 signed artifacts were not overwritten.

## Installer choice

Choose English or Simplified Chinese, then proceed to **League connection
permissions**. Leave **Run ECL Hub as administrator when it starts** checked
when League/WeGame runs as administrator. It is checked by default on a fresh
interactive installation. Uncheck it if League uses normal permissions.

This configures the current Windows user's launch setting for the installed
Hub executable. It avoids asking players to edit shortcut compatibility
settings themselves. The installer remains per-user and does not itself
require elevation. The setting applies to later launches of Hub, not just setup.

**Windows still requests approval when Hub launches with administrator rights.**
This is the normal UAC flow, not a bypass or a permanent grant. A standard
Windows user may need administrator credentials. Use the same Windows account
for Hub and League to retain that account's saved login and matches; signing
into a different Windows account has separate app data.

Re-run the installer and uncheck the option to return Hub to normal launches.
Silent updates preserve the saved choice. Without a saved choice they preserve
an existing manually configured administrator-launch flag, and otherwise do
not silently enable it. Full uninstall removes the administrator flag managed
by this option while retaining unrelated DPI/compatibility flags. App-data
preservation behavior is unchanged.

Close Hub using **Quit ECL Hub** before installing. On the first launch, accept
the Windows prompt if this option is enabled, then check **Collector** while
League is open. The owner confirmed that matching Hub's and League's elevation
levels resolved the earlier disconnected state. The installer option automates
saving that launch preference; it does not resolve unrelated League API outages.

## Verification

- Desktop suite: **80 passed**, one optional installer probe skipped.
- The real custom NSIS hook compiled successfully in the full installer.
- **Nine native NSIS integration scenarios passed** against a unique test-only
  HKCU namespace: normal silent default, enabled launch, remembered enabled
  launch, opt-out preserving other flags, remembered opt-out, existing manual
  preference, duplicate flag prevention, upgrade retention and uninstall cleanup.
- English/Chinese native fixture pages expose a checked, reversible checkbox.
  Chinese page rendering was inspected; hidden-window screenshots are optional
  because Windows can decline painting them. No real installation was changed
  by these fixture checks.
- Actual packaged 1.0.1 sample UI smoke passed, including displayed version,
  both languages, screen layouts, histories/scoreboards and renderer isolation.
- All twelve packaged runtime source files and the renderer match the build
  source/output. Release trust, signature and installer size/SHA-512 checks pass.
- The new installer has not been executed against the owner's managed Hub
  installation. Test the real setup checkbox, next-launch UAC and preserved data
  on a tester PC. Fresh-game collection still requires a real completed game.

The permissions option uses `companion/installer/league-permissions.nsh` via the
supported electron-builder NSIS include hook. No machine-wide compatibility
entries, system UAC policies, League files, process memory or credentials are
modified. Local integration registry effects are confined to generated
`HKCU\Software\ECLHubInstallerTests\<UUID>` namespaces and removed afterward.

## Source and service boundaries

The patch is limited to the desktop installer configuration, its hook/tests,
version and handoff documentation. Pending reporting/freshness/retention backend
changes and unrelated dirty files stay separate. No website push/deployment,
database operation, update-feed publication or message to testers was performed.
The owner can manually send this installer; the public feed does not offer it
until a separately approved publication. KOOK uploads remain unavailable in the
undeployed pilot. General tester checks are in `TESTER_BUILD_1.0.0.md`.

## Reproduce before a version is frozen

```powershell
# From companion/. Do not overwrite a distributed/signed version.
node tools/test-installer-options.cjs
# Its printed fixture directory can be used for the optional native page check:
# powershell.exe -NoProfile -ExecutionPolicy Bypass -File test/installer-options-ui.ps1 -FixtureDirectory PRINTED_PATH
$env:ECL_UPDATE_PUBLIC_KEY_FILE = Join-Path $env:LOCALAPPDATA 'ECL Hub Release Signing\public-key.pem'
npm.cmd run dist -- --config.directories.output=release-test-101
node tools/run-release-key.cjs sign --installer=release-test-101/ECL-Hub-Setup-1.0.1.exe --version=1.0.1 --out=release-test-101
node tools/check-release.cjs release-test-101
```

References: [Microsoft UAC](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/user-account-control/how-it-works),
[NSIS custom dialogs](https://nsis.sourceforge.io/Docs/nsDialogs/Readme.html)
and the installed electron-builder `assistedInstaller.nsh`/`installSection.nsh`
include hooks. The existing ECL release verification remains enabled.
