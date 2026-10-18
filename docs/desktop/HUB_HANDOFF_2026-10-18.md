# ECL Hub Handoff and Roadmap

Last updated: October 18, 2026 (Asia/Shanghai).
This is the current checkpoint. Older preparation sections in other documents describe earlier states.

## Owner-Approved 1.0.0 Tester Build

The owner subsequently approved committing the scoped native source/cleanup
and creating an installer for other testers, explicitly selecting **1.0.0**.
See `TESTER_BUILD_1.0.0.md` for the current build/verification result and tester
instructions. `SOURCE_COMMIT_FILES.txt` now lists 60 native-source/document
files, including that guide. Earlier no-commit and version-selection statements
below describe the previous checkpoint. Reporting, profile-refresh and retention
backend changes remain separate and undeployed; no website push, update-feed
publication or database change is authorized by the tester build request.

The 1.0.0 installer is now built, signed with the existing ECL key and verified
at `companion/release-test-100/ECL-Hub-Setup-1.0.0.exe` (119,338,608 bytes).
The actual packaged sample UI passed, including displayed version 1.0.0 and
English/Chinese layouts; all twelve packaged runtime source files match the
source. The desktop suite remains 80 passed, one optional probe skipped. See
the tester guide for its SHA-256 and verification limits. It has not replaced
the owner's installed 0.9.2 app or been published to the update feed.

## October 18 Local Source Review Follow-up

- See `SOURCE_REVIEW_2026-10-18.md` for the review findings, next live-game test,
  verification results and separate proposed commit groups. Nothing was committed,
  pushed, deployed or published; no database operations were performed.
- A 72-file source snapshot, taken before the follow-up edits, is preserved under
  ignored `backups/hub-source-review-2026-10-18-96deeb09/` with a verified SHA-256
  manifest. This is a same-PC source copy, not a portable signing-key backup.
- Local source now invalidates stale League display/restart state after LCU
  authentication failure and ignores obsolete reporting connection responses.
  Three added regression cases pass; desktop results are now 80 passed and one
  optional installer probe skipped. The 20 isolated server tests and root
  TypeScript passed; targeted ESLint has no errors and six existing-file warnings.
- These fixes are not in the installed/published 0.9.2 app. The frozen 0.9.2
  release passed local verification and was not rebuilt or overwritten. Any
  future package with changed source needs a new approved release version.
- `SOURCE_COMMIT_FILES.txt` lists the exact proposed 59-file native-source/docs
  commit. Reporting and lifecycle backend changes remain separate and unstaged.
- League was not running during this follow-up. Fresh real-game collection and
  the authenticated KOOK upload/review pilot remain unverified.

## Start Here in the Next Chat

Continue ECL Hub from this document. Inspect the current worktree before editing. The installed app is 0.9.2, and the user has confirmed that the real 0.9.1-to-0.9.2 updater test worked, including preserved sign-in and collected matches. Do not repeat the bootstrap or replace it with a portable preview. Plan toward 1.0.0, but do not publish another version, deploy reporting/retention, change the database or commit unrelated work without approval. The recommended next milestone is an independently verified local collector, followed by a tightly scoped KOOK reporting pilot.

## Project and Constraints

- Repository: `C:\Users\muiri\Desktop\ECL\ecl-split-one` (the actual path includes `ECL`).
- Native Electron app source: `companion/`; package name `ecl-companion`, app ID `lol.eclchina.companion`, product name `ECL Hub`.
- Installed executable: `%LOCALAPPDATA%\Programs\ECL Hub\ECL Hub.exe`.
- Account/local-match storage: `%APPDATA%\ecl-companion`.
- Website: `https://eclchina.lol`, hosted on Vercel; existing Supabase/PostgreSQL through Prisma.
- Ubuntu worker is retired. Do not reintroduce paid hosting or WeGame-cookie renewal as a prerequisite.
- Fewer than 50 initial users; zero additional budget; owner distributes the initial installer.
- Updates download automatically; installation requires an explicit restart decision. Preserve account and local matches.
- Raw match retention requirement: 30 days. Public update storage must never contain player raw match uploads.
- No database schema change or production record repair was performed for this work.

## What Is Working

### Native Hub

- Native Dashboard, Profile, Inhouse History, League History, Ranked Ladder, Collector, Settings and Info/privacy views, rather than an embedded full website.
- ECL branding, transparent logo, English/Chinese UI, role icons, English rank labels and stronger profile rank/verification presentation.
- Existing ECL sign-in, encrypted remember-me session handling, profile pictures, primary/secondary roles and saved League snapshots.
- Website links open the user's normal browser.
- Dashboard fetches website content on startup and every 15 minutes while open; manual refresh is available. New website posts do not require a new installer. This is polling, not instant push.
- Inhouse History is the user's recorded ECL games; League History/ranks/champions are a separate saved-provider snapshot.
- Full inhouse ladder pagination and top-three champions from saved Lzyumi snapshots, not inhouse champion counts. Missing/ambiguous snapshots remain empty.
- Public ladder verification returned 33 players, 31 with champion snapshots; the packaged UI reached all three pages.

### 0.9.2 Scoreboard Fix

- More compact, visual match dialog: victory/defeat bands, team kills, champion portraits, role icons, KDA, damage bars/share and gold totals.
- MVP/SVP badges use existing stored ECL awards; the app does not recompute or award them.
- Legacy summary damage/gold were rounded thousands. Exact full-unit values come from raw `echartsMap` when available; provider-only K fallbacks are marked approximate.
- Missing vision is not invented. The column is omitted when no player has recorded vision, with an explicit unavailable message. Missing statistics are not zero.
- Scoreboards are minimized, authenticated, own-history responses. Raw JSON, PUUIDs and contact details are not included in these display responses.
- Stored results, ratings and awards were not modified.

### Real Updater Pilot: Completed

1. Built and verified updater-enabled 0.9.1 bootstrap and 0.9.2 target.
2. Published only public installer, blockmap, signed release envelope and `latest.yml` under Blob `ecl/windows`.
3. Verified live website metadata and ECL signature against the pinned key/local installer; checked public installer length and downloaded blockmap bytes.
4. Closed the preview and opened interactive 0.9.1 bootstrap setup.
5. User completed the installed updater test and reported everything working.
6. Independently checked installed executable version 0.9.2.0, running processes from the managed install folder and one Windows entry: `ECL Hub 0.9.2`.
7. User confirmed preserved sign-in and collected matches.

The managed upgrade replaces application files at the same location. Developer preview folders and downloaded installers are not installed versions and are not automatically deleted. No arbitrary recursive cleanup was authorized.

## Update Hosting and Trust

- Fixed app feed: `https://eclchina.lol/desktop-updates/windows/`.
- Public storage prefix: `https://wjeuparxlihzvwlv.public.blob.vercel-storage.com/ecl/windows/`.
- Vercel setting: `ECL_DESKTOP_UPDATE_BLOB_BASE` points to that prefix.
- Website issues allowlisted, noncached redirects; large binaries transfer directly from Blob, not through a serverless function.
- ECL Ed25519 release verification is pinned in the app. Installer version/name/size/SHA-512 are signed and checked before download/after download/before installation.
- This is not paid Windows Authenticode signing. Unknown-publisher warnings may remain; never disable verification to bypass them.
- Private signing key is Windows-encrypted outside the repository in `%LOCALAPPDATA%\ECL Hub Release Signing\release-key.encrypted`. Only the public pin belongs in the app. Do not upload the private key/ciphertext to Git, Blob or Vercel.
- Key fingerprint: `3cf2cd25cca9e10a6ef8c57180bd3c6dbb4da780922bcef8a2a174acd879027f`.
- Startup check after about 15 seconds; recurring checks every six hours; Settings manual check available.
- Verified updates download automatically; Later defers installation. Restart is guarded against active games, stale/unknown League state and collection/reporting work.

## Live Versus Local

Live website commits:

- `0b41027`: read-only full ladder and own-history scoreboards, snapshot parsing and tests.
- `b127def` (current checked HEAD): scoreboard unit correction and allowlisted website-to-Blob update redirects, with tests/helpers.

Public pilot artifacts:

- `companion/release-bootstrap-091/`: one-time local 0.9.1 installer; do not overwrite target feed metadata with its older `latest.yml`.
- `companion/release-pilot-092/`: frozen, signed 0.9.2 target artifacts.
- `companion/release-upload-092/01-versioned-files/`: three versioned public files.
- `companion/release-upload-092/02-publish-last/latest.yml`: publish metadata last, after immutable files are accessible.
- These generated directories are ignored by Git. Do not rebuild/overwrite a signed published version; use a new version.

Not yet deployed/enabled as part of the approved website commits:

- Desktop-to-KOOK reporting protocol, upload/admin-review APIs and bot changes.
- New stale-on-Hub-open profile-refresh protocol and queue/lease changes.
- Server raw-upload retention route, schedule and enable flags.
- The full desktop source is currently untracked under `companion/`, alongside other local/untracked work. Publishing binaries did not commit the source. Review and obtain approval for a scoped source commit before broader distribution.

The worktree is deliberately dirty. Do not reset/revert it or blindly stage everything. `git status --short` identifies unrelated scripts and pending reporting/lifecycle work.

## Remaining Roadmap, in Order

### 1. Preserve and Review the Working Baseline

- Review source changes and prepare an explicitly scoped commit/backup with user approval; keep installers, secrets and private match files out of Git.
- Keep the verified 0.9.2 artifacts and current app identity/data paths stable.
- Establish a secure signing-key recovery/rotation procedure before wider distribution. Windows-encrypted ciphertext alone is not a portable recovery backup.
- Confirm feed metadata cache/freshness behavior for the next release; do not weaken version/hash/signature checks.

### 2. Independently Verify Real Local Collection

- Use League on the player's Windows PC; authenticate from `LeagueClientUx.exe` process arguments. The Chinese League lockfile can be empty; Riot Client credentials are not LCU credentials.
- Never log, upload or persist the LCU authentication token. Do not read process memory, inject code or modify League files.
- The live API on port 2999 and dynamic-port LCU match-history API are separate.
- Test one fresh completed custom 5v5: discover Game ID, retrieve full raw JSON, join identities by participantId, verify all ten players/teams/winner/statistics and save locally once.
- Verify restart/re-discovery when League changes ports/tokens, retry/backoff for 500/503/timeouts, deduplication and an offline pending queue.
- Earlier local access succeeded but the Tencent match-history backend also timed out. A successful updater/UI test is not proof of reliable collection across games or outages. Direct Game ID and recent history share a backend; neither guarantees recovery from a wider outage.

### 3. Run a Small KOOK-to-Hub Reporting Pilot

- Keep KOOK as the coordination entry point initially, rather than adding a second competing report flow.
- Local intended flow: verified ten-player `!ready` roster -> play -> authorized participating reporter signs into Hub and enables session-specific upload consent -> `!report <inhouse number> <League Game ID>` -> assigned Hub collects/uploads -> server validates roster/sides/server/duplicate -> administrator review.
- Reporter must be an eligible roster participant and allowed pilot profile; do not assume only the person who typed `!ready` can report. Re-read the policy before documenting final permissions.
- User approved assigned raw-match uploads containing ten players' in-game identities, PUUIDs and statistics to ECL storage, with explicit in-app consent and no automatic point awards.
- Reporting receipt is not official approval. Do not enable automatic ratings, results or points.
- Review `REPORTING_PILOT.md`, authorization/ownership, request replay, duplicate/concurrent requests, wrong Game ID/roster, cancellation, expired requests and notification failures before explicitly approved deployment.
- Existing local enable flags include `ECL_DESKTOP_REPORTING_ENABLED`, `ECL_DESKTOP_REPORTER_PROFILE_IDS` and `ECL_DESKTOP_LINK_SECRET`. Do not enable production as a side effect of a read-only/UI change.

### 4. Finish Profile Freshness and Raw-Data Lifecycle

- Review/deploy the pending authenticated stale-on-open Lzyumi refresh only with approval. Desktop polling cannot activate server code that has not been deployed.
- Current views can read saved ranks/champions; the new protocol aims to refresh stale snapshots without a full website visit, with cross-device leases, cooldowns and usable cached data on failures.
- Verify solo/flex ranks, most-played champions and honest last-updated labels; do not mislabel provider-wide counts as solo-only or as inhouse counts.
- Local 30-day cleanup is implemented; verify it on controlled fixtures. Never delete arbitrary exports or unknown paths.
- Server 30-day cleanup is local/pending, not live: review enable flag, authenticated cron, expiry handling and backlog monitoring before deploying/enabling.
- Keep raw uploads private. Public Blob is exclusively for public releases. Do not claim 'we collect no personal data': in-game identifiers and account-linked match data are collected under the approved scope. Explain exactly what stays local and what is uploaded.

### 5. Harden and Release 1.0.0

- Pilot with a few real users in mainland China: fresh install, remember-me, EN/ZH, portraits, histories, ladder, collection and network/provider failures.
- Test interrupted/offline downloads, altered/wrong signatures, low disk space, restart guards, reinstall/uninstall and another installed upgrade.
- Recheck dependency vulnerabilities and Electron security boundaries without applying breaking upgrades blindly.
- Check actual Vercel/Blob quotas, transfer usage and reachability before each distribution; zero additional cost is a goal, not a guarantee. About 50 full 129 MB downloads use roughly 6.5 GB before retries/other releases.
- Improve reproducible release tooling/checklists so the owner can build/sign/verify, upload versioned files first and update metadata last without manual path confusion.
- Only then approve/build/publish 1.0.0. Retain a recovery installer; no silent trust changes or automatic scoring.

### Separate Track: Split II Website

- Keep the existing accounts/player data and World Cup functionality.
- Design direction: centered 'Expat China League' with 'Split II: Draft' below, electric royal blue/black/white, restrained esports typography, small readable registration roster.
- Mock/local UI first. Ignore the external HTML prototype as implementation authority.
- Thirty verified eligible places, one per player; future real server capacity must be concurrency-safe.
- No production registration schema/dataset changes until explicit design/database approval. Reinspect `docs/ECL_SPLIT_II_HANDOFF.md` and actual UI before describing any mock as production-ready.

## Verification Already Run

- Previous desktop suite: 77 passed, one optional real-installer probe skipped.
- Backend/view/update-host/lifecycle/reporting fake-store suite: 20 passed; no production writes.
- TypeScript no-emit and targeted ESLint passed.
- Packaged 0.9.2 sample UI tested at 1160x800 and 860x680, including scoreboard awards/bars, missing vision, translations and no overflow.
- Both bootstrap/target signed-release checks passed, followed by the actual installed updater pilot and user confirmation.
- These are checkpoint results, not a claim that tests were rerun after future edits.

Useful commands (PowerShell):

```powershell
cd C:\Users\muiri\Desktop\ECL\ecl-split-one
git status --short
node --import tsx --test scripts/test-desktop-views.ts scripts/test-desktop-update-host.ts scripts/test-desktop-lifecycle.ts scripts/test-desktop-reporting.ts
cd companion
npm.cmd test
node tools/check-release.cjs release-pilot-092
```

Read `companion/README.md`, `companion/UPDATES.md`, `docs/desktop/UPDATE_AND_DATA_SETUP.md` and `docs/desktop/REPORTING_PILOT.md` for details, treating this handoff as the latest status. Do not print secrets or private identifiers while diagnosing.
