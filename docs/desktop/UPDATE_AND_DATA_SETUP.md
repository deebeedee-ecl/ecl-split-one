# Hub Updates and Data Lifecycle

## October 18 Installed Update Pilot Checkpoint

Final confirmation: the user reports everything working with sign-in and collected matches preserved. The real installed pilot is complete. See `HUB_HANDOFF_2026-10-18.md` for the current roadmap; it supersedes pending-confirmation statements below.

Public 0.9.2 metadata and its ECL signature verified through the website feed against the pinned key/local installer; the public installer length and blockmap were checked. Following the approved interactive 0.9.1 bootstrap and the user's update test, the installed/running managed app reported 0.9.2, with one Windows uninstall entry and the same installation directory. The existing account/match folder remains present. User confirmation of preserved sign-in/match contents is still pending. This does not approve broader 1.0.0 distribution or deploy reporting/retention changes. The preparation sections below are historical.

## Local Implementation, Not a Live Release

### October 18 Approved Real-Updater Pilot Preparation

The user approved a local updater-enabled 0.9.1 bootstrap install plus publication of ECL-verified 0.9.2 test files before 1.0.0. Both local packages and their signed envelopes passed release checks using the same protected key. Files: `companion/release-bootstrap-091/ECL-Hub-Setup-0.9.1.exe` and `companion/release-pilot-092/ECL-Hub-Setup-0.9.2.exe`. The 0.9.2 executable passed the actual packaged sample-data UI checks. It includes a redesigned scoreboard with corrected full-unit damage/gold, damage/share bars and stored MVP/SVP; unavailable vision is not invented.

Commit `b127def` deployed the read-only statistics fix and update-host redirect; Vercel success and the live 307 destination were checked. A read-only IH #028 numeric audit confirmed the legacy K-vs-full-unit mismatch and absent vision. No database records or schema were changed. No reporting/retention/profile-refresh-protocol deployment was included.

Publication/install checkpoint: no Blob write credentials are present locally. The generated public-only `companion/release-upload-092` folder has `01-versioned-files` (three files) and `02-publish-last` (`latest.yml`). The user was asked to upload into the existing Blob `ecl/windows` folder with exact filenames, versioned files first and metadata last; also to Quit the currently running preview. At this checkpoint the local managed installation remains 0.7.1 and no installer or installed upgrade has run. Do not mark the real updater test successful until live metadata/signature verification and the installed 0.9.1 -> 0.9.2 download/restart/replacement/data-preservation checks succeed. Developer preview directories/downloaded installers are not automatically deleted.

### October 18 Approved Read-Only API Deployment

User approval explicitly covered only the read-only APIs required for desktop scoreboards/full ladder. Commit `0b41027` contains `/api/hub/ladder`, the own-history scoreboard query, two parsing helpers and fake-store tests. It is pushed; Vercel reports success. The live ladder returned 33 players and 31 champion snapshots, and the signed-out packaged app paginated all three pages. Missing/ambiguous snapshots stay empty. Champion picks use saved Lzyumi counts and source timestamps, not inhouse counts or new provider requests. Authenticated real-match display still requires user verification; signed-out scoreboard requests return 401 and own-history authorization/minimization pass fake-store tests.

The 0.9.1 local review executable is `companion/release-review-091/win-unpacked/ECL Hub.exe`. No desktop installer/update artifacts were published, no schema/migration was changed, and reporting, refresh-on-open protocol, retention and update-hosting changes remain outside that commit. Earlier 0.9.0 sections below describe the state before this narrow deployment.

### October 18 UI Review 0.9.0

The new local unpacked app is `companion/release-review/win-unpacked/ECL Hub.exe`; the signed 0.8.0 bootstrap files are unchanged. English rank/server display, preferred/played role icons, larger profile badges, snapshot dates, session-scoped collector stages and persistent update status are included. Only a successful update check can show Up to date. Public release remains 1.0.0 after review/approval, not this review build.

New read-only website support (not deployed): `/api/hub/ladder` returns full all-time recorded inhouse standings and top-three inhouse champion picks, preserving `/api/leaderboard`'s top-ten contract. `/api/hub/my-inhouse-history?statId=...` requires authentication and own-history membership, returns minimized scoreboard fields with private/no-store caching, and never transfers raw JSON/PUUIDs/contact data. Normal app use falls back honestly while these routes are undeployed. No database schema changes or real-store tests were performed.

### October 18 Bootstrap Build

The user explicitly approved creating the permanent ECL release key on this PC, encrypted with Windows safeStorage and stored outside the project. It now lives under `%LOCALAPPDATA%/ECL Hub Release Signing/` as `release-key.encrypted` and its nonsecret `public-key.pem`. No plaintext private key file was created for ECL. The key fingerprint is `3cf2cd25cca9e10a6ef8c57180bd3c6dbb4da780922bcef8a2a174acd879027f`.

`companion/release-updates/ECL-Hub-Setup-0.8.0.exe` (128,811,787 bytes) is built with that public key pinned, plus its blockmap, signed `ECL-Hub-Release-0.8.0.json` and `latest.yml`. The protected signing helper checked the actual ASAR policy/version and `app-update.yml` before signing. `tools/check-release.cjs` verified the release metadata, installer digest, packaged verifier source and private-file exclusions. The actual packaged UI smoke passed. No installer/update was executed against the installed app, and no files were uploaded or deployed. An installed-to-installed upgrade test is still outstanding.

Normal builds now select the ECL-key adapter only when `ECL_UPDATE_PUBLIC_KEY_FILE` points to a valid absolute public Ed25519 key file, the NSIS publisher marker matches and verification stays enabled. Missing pins leave runtime trust disabled; `npm.cmd run dist` blocks a release build without explicit valid trust. This uses `win.signtoolOptions.publisherName` as required by the installed builder, not the obsolete top-level `win.publisherName` field. The marker selects our verifier, not a Windows-certified publisher. The installer remains Authenticode-unsigned and Windows warnings can remain.

For future local releases:

```powershell
# companion directory; this is a public file path, never a private key in the environment.
$env:ECL_UPDATE_PUBLIC_KEY_FILE=Join-Path $env:LOCALAPPDATA 'ECL Hub Release Signing\public-key.pem'
npm.cmd run dist
# Substitute the new version and exact corresponding paths.
node tools/run-release-key.cjs sign --installer="release-updates/ECL-Hub-Setup-0.8.0.exe" --version=0.8.0 --out="release-updates"
node tools/check-release.cjs release-updates
```

Versioned signature files are never overwritten. The helper launches Electron without a window, uses Windows encryption and passes a decrypted KeyObject directly to the signer in memory. It does not log/persist/export the plaintext key or publish files. The tools folder is excluded from the app. Do not copy the encrypted key to Vercel, Blob or Git. Windows-protected ciphertext alone is not a portable backup: establish a separately protected recovery/export procedure before wider distribution. Losing the Windows account/key can require a manually distributed replacement bootstrap with a new public pin. Rotation/revocation and metadata freshness policies are still rollout work.

The user reports that `ECL_DESKTOP_UPDATE_BLOB_BASE` is saved in Vercel. This does not deploy the local update route. Before distributing 0.8.0, publish only the approved four public artifacts and separately approve/deploy the update route and profile-refresh backend changes. Local retention does run when this new app runs; server cleanup/reporting remain disabled until explicitly configured/deployed. Do not claim that saving the Blob setting activates the updater or the profile-refresh server protocol.

Approved scope: Vercel + Supabase, fewer than 50 users, zero additional budget, personally distributed initial installer, automatic background downloads with an explicit restart decision, and 30-day raw-match retention. The user created/connected the remote Blob store and saved its public prefix; this local work has not deployed production code, migrated the schema or published release files. Only the explicitly approved local protected release key was created by the signing helper.

The existing installed Hub is not changed by editing or building source. The October 18 local bootstrap installer above has not been installed.

## Update Delivery

- The packaged app checks the existing fixed feed at `https://eclchina.lol/desktop-updates/windows/`.
- A valid release starts downloading automatically only in a trusted, signed build. Installation remains explicit. **Later** hides that version's ready banner for the current app session; Settings still offers installation.
- Restart is blocked while the collector or reporter is busy, while League status is stale/unknown, and outside a confirmed idle/lobby/end-of-game phase or confirmed offline state. The guard is checked again after the native confirmation dialog.
- The collector distinguishes a running but unreadable League process from a genuinely absent client. A running game process without a usable client does not count as safely offline.
- `win.signExecutable: false` remains unchanged: no paid Windows certificate is used. Builds without a pinned ECL public key cannot download/install updates. The 0.8.0 bootstrap explicitly enables ECL-key verification through its embedded public key and matching metadata; no signature check is disabled. Hosting/publication is still required.
- Expect a one-time manual transition from unsigned prototypes into a trusted updater-enabled build. Preserve package name, app ID, install location and app-data path.

### Vercel Blob Setup, Once Signing Is Resolved

On October 18 the user created the public `ECL-HUB` store (HKG1), connected it to `ecl-split-one`, and supplied its public hostname. The local ignored `.env.local` now has this public read prefix:

```dotenv
ECL_DESKTOP_UPDATE_BLOB_BASE=https://wjeuparxlihzvwlv.public.blob.vercel-storage.com/ecl/windows/
```

The user reports saving the same variable in Vercel for Production and Preview. This is separate from `BLOB_STORE_ID`/`BLOB_WEBHOOK_PUBLIC_KEY`; connecting the store does not populate this app-specific prefix. No read-write token is required by the public redirect route. Do not expose a token, private signing key or raw match data in this public store. Local `.env.local` does not itself configure or deploy Vercel. No release has been uploaded; the local key and 0.8.0 public pin now exist as described above.

1. Create a **public** Vercel Blob store dedicated to installers. Never put player uploads/raw JSON in that public store.
2. Use stable exact names under one prefix, with random filename suffixes disabled: `ECL-Hub-Setup-VERSION.exe`, its `.blockmap`, and `latest.yml`. Manifest entries must use relative installer names, not arbitrary external URLs.
3. Set server-only `ECL_DESKTOP_UPDATE_BLOB_BASE` to the public HTTPS prefix, for example `https://YOUR-STORE.public.blob.vercel-storage.com/ecl/windows/`. This is a URL, not a write credential. No secret goes into the desktop bundle.
4. The website's new `app/desktop-updates/windows/[file]/route.ts` validates the filename and Blob hostname and issues a noncached 307 redirect. Large binary/range transfers go directly to Blob, not through a Vercel Function. An unset/invalid prefix returns 404.
5. Build and verify a signed release locally. Upload versioned installer/blockmap first and `latest.yml` last. Keep metadata caching short. Protect Blob write permissions and signing keys separately. No public upload API is added.
6. Test actual installed-old to signed-new update, redirects/range downloads, offline/interrupted download, hash/signature rejection, disk full, game-state restart guards and preserved session/matches. Synthetic event tests are not a real signed upgrade test.
7. Pilot in mainland China before distributing more widely. Check actual Vercel plan allowances and remaining transfer/storage. About 50 full 129 MB downloads consume 6.5 GB; multiple releases/retries can exceed a free allowance. No zero-cost or availability guarantee is made.

### Approved Local ECL-Key Prototype

The user explicitly approved prototyping verification with an ECL signing key rather than a paid Windows publisher certificate, acknowledging that Windows may still show an unknown-publisher warning.

- `companion/src/release-signature.cjs` verifies Ed25519 signatures using Node's built-in crypto. A pinned SPKI public key authenticates a base64 envelope containing the exact app/platform scope, release version, installer filename, SHA-512 and byte size. The public key cannot be replaced by data fetched from the server. Private keys are never shipped.
- The signed envelope is `ECL-Hub-Release-VERSION.json`, under the fixed website feed. One public Vercel Blob redirect is allowed, with bounded JSON size, HTTPS, no credentials/query/fragment and an exact filename. No arbitrary update host or web installer is accepted.
- `Updates` has an optional verifier adapter. In this prototype it validates the signed metadata **before downloading**, checks files through the supported NSIS custom-verification hook, checks the downloaded event as well (including cached installers that skip that hook), and hashes/verifies again immediately before installation. Game/report restart guards run after the final verification too. Tampering, wrong keys and missing signatures fail closed.
- The initial prototype was test-only. The October 18 bootstrap now selects the adapter through explicit public-key build policy and matching packaged feed/publisher metadata. A protected ECL release key exists locally and its public key is pinned in 0.8.0. No actual installer has been executed by these checks. This is not a completed installed-to-installed update rollout or an externally audited update protocol.
- `companion/tools/sign-release.cjs` signs an existing installer locally. The protected `run-release-key.cjs` wrapper avoids plaintext key files and checks the actual packaged public pin before signing. Both refuse mismatched versions; versioned signature files are never overwritten. The `tools` folder is excluded from the app; the public verifier modules are included. Test keys remain temporary and are deleted afterward.
- Before enabling: establish protected private-key storage and recovery, public-key pinning in build policy, key rotation/revocation procedures, metadata freshness/rollback policy, secure release publication, real NSIS cache/redirect checks and an installed pilot upgrade. Do not enable the prototype just by setting `trusted: true` or turning off signature checks. Windows Authenticode reputation is a separate problem, not solved by an ECL manifest signature.

Example manual signing command (not run against a production key):

```powershell
# From companion; use your protected external key file, never paste its contents.
node tools/sign-release.cjs --installer="release/ECL-Hub-Setup-1.2.3.exe" --version=1.2.3 --private-key="C:\PROTECTED-EXTERNAL-LOCATION\release.key" --out="release"
```

An encrypted PKCS8 key can use `ECL_RELEASE_KEY_PASSPHRASE` in the trusted signing process. Neither the key nor passphrase belongs in the app, website/public storage, Git repository, logs or chat. Initial bootstrap remains a manually distributed, trusted installer; it must carry the correct pinned public key before ECL-key updates can be trusted.

## Profile Refresh on Hub Use

- Login/restored-session load reads saved profile/history immediately. Stale snapshots request `POST /api/account/refresh-stats?ifStale=1` from the Electron main process. No password or League token is sent to Lzyumi; the website uses its existing integration.
- Server authentication derives the owner from the current Supabase bearer session, never a supplied profile ID.
- The existing `LzyumiRefreshQueue` supplies a cross-device atomic lease. Successful stale checks have a 12-hour interval; failed refreshes have a five-minute retry cooldown. Existing background queue workers use conditional claims and do not reset another device's lease/backoff.
- The desktop also coalesces in-flight requests and has a five-minute retry guard. Signing out/account change aborts its request and discards late responses. An already-started server refresh can still complete for the original account.
- Available solo/flex ranks and most-played champion counts are minimized before IPC. They appear separately from official inhouse metrics. Source champion counts are not represented as inhouse games or a guaranteed solo-only breakdown.
- Provider failures preserve saved data and show a nonfatal stale-snapshot message. The last lookup timestamp advances only when usable new statistics are stored. Partial provider responses can still leave some sections older than others.
- This does not award points, change ECL rating, prove League-account ownership, or bypass private/unavailable upstream data. Real authenticated provider testing remains outstanding.

## Thirty-Day Raw-Match Retention

### Local Files

Collector startup and each scan remove known raw match files whose `collectedAt` is at least 30 days old, along with their saved queue entries. Pending requests and newer files remain. Paths must be simple filenames inside the match directory. If Hub is not running, local cleanup happens when it next runs. Untracked manual exports, copied files and OS backups are outside this cleanup.

### Uploaded Pilot Reports

- Existing `InhouseReportJob.rawMatchData` is used; no schema change is needed.
- `GET /api/jobs/desktop-retention` requires `ECL_DESKTOP_RETENTION_ENABLED=1` and a server-only `CRON_SECRET` of at least 32 characters. Vercel supplies `Authorization: Bearer CRON_SECRET` to scheduled requests. Disabled/missing configuration fails closed without database access.
- The `vercel.json` daily schedule is 03:00 UTC (11:00 China time). Free-tier schedule precision may vary. Delete batches are bounded to 200 oldest uploads; monitor failures/backlog and rerun securely if needed.
- Only `desktop-upload-v1` payloads with `completedAt` at least 30 days ago are scrubbed. Both full raw JSON and player summary are removed. Legacy uploads, newer uploads and official match-result tables are untouched.
- Minimal game/platform/owner identifiers and a deletion timestamp remain for duplicate prevention. An unreviewed expired report becomes `DESKTOP_REVIEW_EXPIRED`, is not scored, and cannot be reused as a fresh report. Admin reads independently hide expired raw data even if cleanup is delayed.
- Before enabling uploads, deploy and verify the cleanup job, configure its secrets privately in Vercel, and establish a person responsible for daily failures. No cleanup has run against production during development.
- Daily cleanup removes expired active records on its next successful run, not at an exact second. Provider backups may retain historical copies under their own retention. Do not promise immediate deletion of backups or copies.

## Verification

```powershell
# Repository root: isolated fake-store/server tests, no real database writes.
node --import tsx --test scripts/test-desktop-reporting.ts scripts/test-desktop-lifecycle.ts
.\node_modules\.bin\tsc.cmd --noEmit --incremental false

# companion directory
npm.cmd test
npm.cmd run build
```

Electron smoke tests use a separate temporary profile and synthetic update events. They do not sign in, refresh real profiles, upload matches or install updates. Signing/storage/production activation are deliberate next steps, not side effects of these commands.

Verified locally on October 17: 65 desktop unit tests plus the optional real-installer signature probe, 15 isolated server tests, root TypeScript and targeted ESLint, the synthetic desktop UI smoke and signed-out public-website UI smoke. The existing 0.7.1 installer was hashed/signed/verified using a temporary test key without modification/execution; this is not an installed upgrade. No real authenticated Lzyumi refresh or production database writes were tested.
