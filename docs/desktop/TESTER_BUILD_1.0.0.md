# ECL Hub 1.0.0 tester build

The owner explicitly selected version **1.0.0** for a Windows installer to give
to a small group of testers. This authorizes a local source commit and installer
build. It does not publish the update feed, push/deploy the website, change the
database or activate the pending upload/retention backend.

## Artifact and verification checkpoint

Built, ECL-signed and verified locally. The owner-distributed file is:

`companion/release-test-100/ECL-Hub-Setup-1.0.0.exe`

- Installer size: **119,338,608 bytes** (about 119 MB).
- SHA-256: `df1f53945652b974cc99e2baf9be821c00b38878f49f4d7156e9bea5ec20a57b`.
- App and installer file versions verified as 1.0.0; twelve packaged runtime
  source files and the renderer bundle match the build source/output.
- The existing ECL public pin, public-only authentication configuration,
  signed release envelope and installer size/SHA-512 all passed verification.
- Desktop tests: **80 passed**, one optional installer probe skipped.
- Actual packaged-app UI smoke passed: 1.0.0 in app state and Settings, English/
  Chinese, native screens, scoreboards, compact layout, sandbox and no renderer
  errors. Sample profiles were isolated; no real sign-in or upload was used.
- Screenshots from the packaged sample app were visually inspected. The
  installer itself was not executed against the owner's installed 0.9.2 app.
- No upload, update-feed publication, website push/deployment or database
  operation was performed. Backend reporting/freshness/retention stays pending.

The corresponding `.blockmap`, `ECL-Hub-Release-1.0.0.json` and `latest.yml`
exist locally for future separately approved update publication. Testers only
need the `.exe` for manual installation. The original 0.9.2 feed/artifacts were
not overwritten.

Keep the installer and generated release files out of Git. Build into this new
directory; never overwrite the frozen signed 0.9.2 artifacts. The release uses
the existing ECL Ed25519 public pin and Windows-protected signing helper. This
is application-level release verification, not Windows Authenticode signing.
Windows may still identify the installer as an unknown publisher.

## What to send testers

Send the verified `ECL-Hub-Setup-1.0.0.exe` and the short test instructions below
through the owner's normal private distribution channel. Testers do not need
the source, unpacked application folder, release signing files or developer
dependencies. Never send the private signing key, environment files or player
match records. This work does not send messages or upload the installer.

## Tester instructions

1. Quit ECL Hub from its tray menu if it is already running. Run the installer
   supplied directly by the owner. Existing installations should retain the
   same app identity, remembered sign-in and saved matches. Do not uninstall
   or delete the app-data folder first.
2. Open Hub and confirm **1.0.0** in Settings. Sign in with your existing ECL
   account. Check Remember me, quit/reopen and confirm the expected behavior.
3. Check Profile, Inhouse History, League History and every Ranked Ladder page.
   Open a recorded match and inspect winner, KDA, damage/gold and any stored
   MVP/SVP awards. Missing data should remain visibly unavailable.
4. Switch between English and Chinese. Check portraits, role icons and layout
   at the smallest supported window size. Open website links and confirm they
   use your normal browser. Check dashboard Refresh.
5. Open League on the same Windows PC and check Collector's detected player.
   Leave **KOOK reporting disconnected**. Complete one real custom 5v5, enter
   its Game ID and verify that it saves locally with the correct ten players,
   sides, winner and statistics. Re-enter the ID and restart Hub: the same
   collector identity should still have one saved record for that game.
6. Restart League and verify Hub reconnects. If collection fails, note its
   status, keep the Game ID and try the queued Retry action after connectivity
   recovers. Distinguish a working League connection from a working match-history
   backend. Report failures rather than assuming an outage means an empty game.
7. Report app version, Windows version, League server, the action taken,
   expected/actual behavior and time (including timezone). Crop account details
   from screenshots. Do not share passwords, connection tokens, raw JSON or
   player identifiers in public channels.

## Current service limitations

- Desktop KOOK uploads/admin review are not deployed/enabled by this build and
  do not award points automatically. Tester scope is local collection and the
  existing published Hub data APIs.
- League ranks/champions can display saved snapshots. The new stale-on-open
  backend protocol and server raw-upload cleanup are still pending separately.
- The updater keeps the fixed feed and existing verification/restart controls.
  This installer is not automatically offered to other users until a separately
  approved feed publication. An older feed must not downgrade this app.
- Fresh real-game collection, install/upgrade behavior on tester PCs and
  provider/network failure behavior still need actual tester results. Local
  automated checks do not establish those results.
- Signing-key recovery remains an owner follow-up before wider distribution.

## Reproduce locally

From `companion/`, using the existing public pin outside the repository:

```powershell
$env:ECL_UPDATE_PUBLIC_KEY_FILE = Join-Path $env:LOCALAPPDATA 'ECL Hub Release Signing\public-key.pem'
npm.cmd run dist -- --config.directories.output=release-test-100
node tools/run-release-key.cjs sign --installer=release-test-100/ECL-Hub-Setup-1.0.0.exe --version=1.0.0 --out=release-test-100
node tools/check-release.cjs release-test-100
```

These commands build/sign locally with publication disabled. Do not rerun them
over a frozen or distributed release. Use a new version/output directory for
subsequent changed builds. The protected signing helper never writes a plaintext
private key or includes it in the application.
