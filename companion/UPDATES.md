# ECL Hub Update Delivery

## Approved 1.0.0 Tester Build

The owner selected version 1.0.0 and approved a scoped local native-source
commit and Windows installer for testers. See
`../docs/desktop/TESTER_BUILD_1.0.0.md` for the artifact and verification status.
Output is isolated under ignored `release-test-100/`; the frozen published
0.9.2 release remains unchanged. This does not authorize publishing the 1.0.0
feed or deploying pending backend changes.

## October 18 Installed Pilot Checkpoint

Final user confirmation: everything works after the update, including retained sign-in and collected matches. The installed updater pilot is complete. Current roadmap: `../docs/desktop/HUB_HANDOFF_2026-10-18.md`. The remaining user-confirmation language in the earlier checkpoint paragraph below is superseded by this confirmation.

The user uploaded all four 0.9.2 public files under Blob `ecl/windows`. The website feed returned the expected metadata; its ECL signature verified against the pinned public key and local installer. The remote installer length matched, and the downloaded blockmap matched byte-for-byte. The approved interactive 0.9.1 bootstrap was opened after Hub quit. After the user completed the update test, the managed executable reported 0.9.2.0 and running Hub processes used `%LOCALAPPDATA%/Programs/ECL Hub/ECL Hub.exe`. Windows had one matching uninstall entry, `ECL Hub 0.9.2`; the install directory had no version-specific application subfolders. `%APPDATA%/ecl-companion` remained present. Sign-in and match-content preservation still require user confirmation; directory existence alone does not prove their contents. This is the approved pilot, not authorization for broad 1.0.0 distribution. Earlier sections below are historical checkpoints.

## Approved 0.9.1 to 0.9.2 Pilot, Prepared

The user approved this real updater test. Local signed/verified bootstrap: `release-bootstrap-091/ECL-Hub-Setup-0.9.1.exe`; target: `release-pilot-092/ECL-Hub-Setup-0.9.2.exe`. The versioned envelope uses the existing Windows-protected Ed25519 key. Commit `b127def` deployed the allowlisted noncached website-to-Blob redirect, and its live destination is the configured `ecl/windows` prefix. The user must upload the three versioned public files before `latest.yml`, then install the 0.9.1 bootstrap and use the installed app, not a stale portable preview/shortcut.

No Blob write credential is configured locally. A four-file public-only staging folder is open for the dashboard upload. At this checkpoint the upload and installed upgrade have not been verified, and no installer was executed. Pending: fetch/verify live metadata+signature, install 0.9.1, observe automatic download/verified ready, user-approved restart into 0.9.2, and check same install directory/one Apps entry/old app-file replacement with account/matches preserved. Existing NSIS source/tests confirm the intended replacement path, but do not replace an actual installed test.

## Local 0.9.1 Review

The user approved deployment of the read-only scoreboard and full-ladder APIs; `0b41027` is pushed and Vercel/live public-ladder checks passed. This does not publish a desktop update. The new executable is `release-review-091/win-unpacked/ECL Hub.exe`; no 0.9.1 installer, signed release envelope or feed metadata was created/uploaded. Public app distribution remains pending 1.0.0 review and the installed-update pilot. The original 0.8.0 bootstrap artifacts are unchanged.

## Local 0.9.0 UI Review

`release-review/win-unpacked/ECL Hub.exe` is a separate local review package, not a new published installer. A persistent clickable status beside the installed version leads to Settings and distinguishes idle, checking, up-to-date, available, download progress, ready, unavailable and rejected states in English/Chinese. Up to date is never inferred from connectivity or version alone. Restart/Later and existing verification/restart guards are unchanged. Website feed publication and an installed-to-installed update test are still required before release 1.0.0. No artifacts were uploaded or deployed.

## October 18 Bootstrap

`release-updates/ECL-Hub-Setup-0.8.0.exe` is built locally with an explicit Ed25519 ECL public pin. The approved permanent private key is Windows-encrypted outside the project. Its signed envelope, installer, blockmap and metadata pass `node tools/check-release.cjs release-updates`; the actual packaged UI smoke passes too. Nothing is uploaded/deployed/installed yet. This provides application-level release verification, not Windows Authenticode publisher reputation.

Build with `ECL_UPDATE_PUBLIC_KEY_FILE` pointing to the external public file, then use the protected signing helper as documented in `../docs/desktop/UPDATE_AND_DATA_SETUP.md`. Without explicit trust the release build is blocked. The installed legacy app still needs the one-time bootstrap; an actual upgrade test remains outstanding. Do not publish while website update/profile backend changes are still local.

## Implemented Locally

- `electron-updater` 6.8.9, NSIS target and fixed generic HTTPS feed: `https://eclchina.lol/desktop-updates/windows/`.
- Checks 15 seconds after a packaged normal launch and every six hours. Settings also has a manual check. Development, sample and smoke profiles do not contact the update feed.
- Valid available updates download automatically in trusted signed builds. Restart/install needs a native confirmation. The ready banner offers Restart and update or Later; Settings retains the install action after deferral.
- Installation is blocked during collection/reporting, unknown/stale League status and non-idle phases, with another check after confirmation. Unsigned builds still cannot download or install.
- `autoDownload`, `autoInstallOnAppQuit`, prereleases and downgrades are disabled. Setup replaces the same app identity and retains `%APPDATA%/ecl-companion`.
- Installer URLs must stay under the fixed HTTPS feed path and match the declared release version. Missing/invalid SHA-512 metadata is rejected. Raw provider errors are not exposed to the renderer.
- Windows update signature verification is explicitly enabled. **This unsigned test build refuses in-app download/install**, rather than relying on electron-updater's unsigned fallback behavior.
- Build-time `dist/update-policy.json` contains only the public expected-publisher list and trust flag. The packager strips `package.json.build`, so runtime code must not read trust configuration there. Production trust also requires the actual packaged `app-update.yml` provider, feed and publishers to match the build policy; missing/mismatched metadata fails closed.

## Not Live Yet

The feed's `latest.yml` returned HTTP 404 in a read-only check on October 17, 2026. No release files have been uploaded or published. No Windows signing certificate is configured; the approved local ECL key and bootstrap now exist. A local verification/UI test is not proof of an installed upgrade cycle.

Existing unsigned prototypes need one final manual installation of a trusted signed updater-enabled release. Merely having update-check code does not grant unsigned builds update-installation trust.

The local website-to-Vercel-Blob redirect route and exact setup/retention requirements are documented in `../docs/desktop/UPDATE_AND_DATA_SETUP.md`. Blob storage and signing remain unconfigured.

The explicitly approved zero-cost Ed25519 verifier is now selected by the 0.8.0 bootstrap's public-key build policy. Default builds without a pin stay untrusted. It does not provide Windows publisher reputation. See the setup document for checks and remaining installed-upgrade/hosting work.

## Enable Production Updates Later

1. For optional Windows Authenticode distribution, approve a Windows signing identity, remove `win.signExecutable: false`, set the certificate's `win.signtoolOptions.publisherName`, keep `win.verifyUpdateCodeSignature: true`, and provide signing secrets only to the trusted build environment. The zero-budget 0.8.0 bootstrap instead uses the explicitly approved ECL-key path above. Do not put certificate passwords/private keys in package.json or the desktop bundle.
2. Build and verify the signed NSIS installer and generated `latest.yml`/`.blockmap`. Confirm the trusted publisher embedded in `resources/app-update.yml` matches the signing certificate. The app's download gate requires signing/publisher configuration; the updater then verifies the downloaded executable's Authenticode signature.
3. Host the signed installer, metadata and blockmap at the fixed website path. An object-storage/CDN backend can sit behind a same-origin rewrite. Do not check 128 MB executables into the website repository or assume a serverless function can stream unlimited release downloads.
4. Upload immutable versioned binary files first and `latest.yml` last. Serve metadata without long-lived caching; versioned installers can be cached. Support the updater's normal file/range requests. Do not accept arbitrary renderer-provided feeds.
5. Test installed old -> available banner -> user-approved download -> verified ready state -> explicit restart -> new version, one Apps entry/shortcut and preserved login/matches. Include interrupted download, offline, wrong certificate, altered hash, invalid metadata and active-game tests.
6. Release to a small pilot before wider distribution. Future key/certificate rotation must be planned and tested; do not disable verification to make a failing update install.

## Sources

- [electron-builder v26 auto-update guide](https://www.electron.build/v26/docs/features/auto-update/): generic servers host artifacts/metadata, NSIS support, updater events and custom UI.
- Installed `electron-updater/out/NsisUpdater.js`: verifies against `publisherName` from packaged update configuration; missing publisher configuration otherwise permits an unsigned fallback, which this app gates off.

No production deployment, hosting purchase, certificate purchase or update publication is performed by the local build commands (`--publish never`).
