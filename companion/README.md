# ECL Hub 1.0.1 Tester Installer

The owner approved committing the native Hub source and building tester
installers. Version 1.0.1 adds an English/Chinese setup option to run Hub with
administrator permissions when League requires them. Tester instructions and
verification are in `../docs/desktop/TESTER_BUILD_1.0.1.md`. Historical release
notes below describe earlier checkpoints; the installed 0.9.2 updater pilot
remains complete. Pending reporting, profile-refresh protocol and retention
backend changes are outside this source commit and installer build.

## October 18: Installed Pilot Result

The user subsequently confirmed everything works, including preserved sign-in and collected matches. The installed updater pilot is complete. Start the next session with `../docs/desktop/HUB_HANDOFF_2026-10-18.md`; it supersedes pending-confirmation statements below.

The public 0.9.2 feed metadata and ECL signature were verified, and the approved 0.9.1 bootstrap setup was opened. Following the user's update test, the installed and running Hub was confirmed at 0.9.2 in the same managed installation folder, with one Windows uninstall entry. The existing account/match data folder is present; the user still needs to confirm sign-in and collected-match contents. See `UPDATES.md` for the verification checkpoint. Earlier preparation notes below describe the pre-install state, not the current installation.

## October 18: Scoreboard and Real-Updater Pilot

User explicitly approved installing an updater-enabled 0.9.1 bootstrap and publishing the ECL-verified 0.9.2 test artifacts before 1.0.0. The protected signing key is unchanged. Bootstrap: `release-bootstrap-091/ECL-Hub-Setup-0.9.1.exe` (128,825,578 bytes). Update: `release-pilot-092/ECL-Hub-Setup-0.9.2.exe` (128,827,446 bytes). Both installers, pinned ASAR policies, signed envelopes and metadata pass `tools/check-release.cjs`. This is ECL-key verification, not a Windows publisher certificate.

The 0.9.2 scoreboard has team outcome/kill totals, damage/share bars, role icons and stored ECL MVP/SVP awards. A read-only audit of IH #028 confirmed that legacy summary metrics were rounded K values while `echartsMap` stores exact units. The deployed API now prefers exact damage/gold, marks top-level K fallbacks approximate and does not guess from number magnitude. Missing vision remains unavailable and its column is hidden if no player has a recorded value. No stored results/ratings/awards were changed.

Commit `b127def` deployed only that read-only metric fix, the allowlisted Blob-feed redirect and tests/helpers. The website now redirects update files to `https://wjeuparxlihzvwlv.public.blob.vercel-storage.com/ecl/windows/`. Reporting, profile-refresh protocol and server retention changes are still outside the deployment. The public update files must be uploaded separately; deployment alone does not publish an update.

`release-upload-092/01-versioned-files/` contains only the three immutable public files (installer, blockmap, signed envelope). Upload them to Blob `ecl/windows`, with exact names/no random suffix, then upload `02-publish-last/latest.yml` to the same folder last. No Blob write token is configured locally; the user was asked to upload in the dashboard. The user was also asked to quit the unpacked preview before the one-time bootstrap install. At this checkpoint no installer has run and the actual installed 0.9.1 -> 0.9.2 cycle is NOT verified. The previously installed copy was 0.7.1 under `%LOCALAPPDATA%/Programs/ECL Hub`.

Managed NSIS upgrades reuse appId/install location, uninstall old application files before installing and retain `%APPDATA%/ecl-companion`. They do not delete arbitrary development folders or downloaded setup files. Verify one Apps entry, updated shortcut/version, preserved account/local storage, automatic verified download and explicit Restart/Later after the user completes the pilot. Do not claim the updater works end to end until that check is done.

## October 18: API Connection Fix

The 0.9.1 review app is `release-review-091/win-unpacked/ECL Hub.exe`. With explicit user approval, only the read-only scoreboard/full-ladder APIs, two parsing helpers and their tests were committed/pushed as `0b41027`. Vercel reports success; the production ladder returned 33 players, 31 with saved champion snapshots. The packaged signed-out UI test reached all three ladder pages and loaded champion portraits. Private scoreboards reject unsigned requests (401); authenticated ownership/minimization are covered by fake-store tests. The user still needs to retry their real match in Hub.

Ladder champion picks now come from verified active players' saved `lzyumiRecentStat.data.recentState.common_use_champions`, sorted by count and limited to three. They are not inhouse picks. Ambiguous/missing profiles remain empty; hover shows ECL snapshot and its saved lookup date when available. Browsing the ladder does not refresh everyone through Lzyumi or expose raw snapshots/contact details/PUUIDs.

Dashboard news is fetched on startup and every 15 minutes while Hub runs, with manual refresh available. New website posts do not require an app-binary update. The app/installer, reporting, update feed and retention changes remain unpublished/uncommitted; no schema change or database migration was performed.

## October 18: Profile and Status Review

The new unpacked review app is `release-review/win-unpacked/ECL Hub.exe`. It keeps the original app ID and encrypted account/collector storage. It is not an installed upgrade or a published release; the existing 0.8.0 bootstrap installer remains unchanged. Public release 1.0.0 still requires approval and the installed-update pilot.

English rank/server labels, larger profile badges, primary/secondary roles, bundled League position icons in both histories, snapshot dates and persistent version/update status are implemented. Only a successful update check displays Up to date. Collector upload stages are session-scoped acknowledgements, never proof of official approval.

The new read-only `GET /api/hub/ladder` returns the full all-time inhouse ladder and each player's top three recorded inhouse champions. The existing top-ten API is unchanged. `GET /api/hub/my-inhouse-history?statId=...` authenticates the viewer, checks membership in their latest-100 history and returns minimized scoreboard fields, not raw JSON, PUUIDs or contact details. These website changes are LOCAL, not deployed: normal Hub currently falls back to published top ten with missing champion picks, and unavailable detail responses are explicit. Sample mode previews the full UI. No schema/migration changes.

Verification: `npm.cmd test`; `node --import tsx --test scripts/test-desktop-views.ts scripts/test-desktop-lifecycle.ts scripts/test-desktop-reporting.ts` from the repo root; `test/smoke.cjs` against the actual review executable. Server tests use fake stores and fake authentication transport only.

## October 18: Local 0.8.0 Bootstrap

The latest local installer is `release-updates/ECL-Hub-Setup-0.8.0.exe`, with ECL-key update verification pinned to the approved public key. Its private key is encrypted with Windows safeStorage outside the repository. The release and actual packaged UI checks pass; it has not been installed, uploaded or deployed. Read `../docs/desktop/UPDATE_AND_DATA_SETUP.md` for protected signing commands, required website/profile backend rollout and recovery limitations. Windows publisher warnings may remain. Earlier sections below describe historical prototypes, not current release activation.

## Current Local Changes

Automatic background downloads for trusted signed releases, Restart/Later controls, stricter restart guards, stale-profile refresh through the authenticated ECL server, solo/flex rank and champion snapshot display, and 30-day local/server raw retention are implemented in source. No new installer or live deployment was made for this change. Signing, Vercel Blob and the server cleanup still require configuration before rollout. Read `../docs/desktop/UPDATE_AND_DATA_SETUP.md`; older version descriptions below are historical.

Windows desktop prototype. Separate from the Next.js website, database and KOOK worker. No WeGame cookies, Ubuntu host or shared server secrets.

## Run

From this directory in PowerShell:

```powershell
npm.cmd ci
npm.cmd start
```

`npm.cmd run demo` opens explicitly labelled sample data in a separate temporary app profile, without connecting to League or opening the live Hub.

`npm.cmd test` runs the tests. `npm.cmd run pack` builds an unpacked Windows application; `npm.cmd run dist` builds the Windows installer at `release-logo/ECL-Hub-Setup-0.7.1.exe`. `npm.cmd run dist:portable` builds a portable executable under `release-hub/`. Both are full offline packages: installing does not need to download Electron separately. The installed launcher is normally `%LOCALAPPDATA%/Programs/ECL Hub/ECL Hub.exe`, also accessible through the desktop/Start menu shortcut.

Version 0.7 adds **Preview example match** in Collector: a labelled fictional ten-player scoreboard, not saved, counted or submitted. It also implements a separately consented, reporter-scoped KOOK upload pilot. The server code must be separately deployed and enabled; a new installer alone does not activate it. See `../docs/desktop/REPORTING_PILOT.md` for setup, commands, review restrictions and outstanding live tests. No automatic point awards or independent League ownership proof are implemented.

## Native Workspace

The refreshed desktop UI uses locally bundled Inter Variable, Radix Colors, Lucide, Chart.js, Floating UI and i18next. No UI/font/translation assets come from a CDN. Read `UI_RESEARCH.md` for the free-package comparison, choices and upstream sources. Navigation is ECL Central, with a dedicated Ranked Ladder tab. Settings > Language switches English/Simplified Chinese immediately and persists only that preference to `preferences.json`. Player names, source news and upstream technical diagnostics retain their original language.

Website links always open the user's default browser. There is no embedded website/webview or cookie bridge. Native desktop authentication remains separate from the default browser's login. Legacy website-session files from earlier test releases are not silently erased.

Dashboard reads the public website's `/news`, `/tournaments` and homepage every 15 minutes, preserving published dates and archive labels. Official League patch notes open the official Riot page externally. Cheerio parses bounded HTML into plain text in the main process; no remote scripts or HTML are executed. The full `/hub/leaderboard` table is attempted read-only. If unavailable, the existing API's published top ten is explicitly labelled instead; no full/live ladder is invented. No new website API or deployment is required, but website markup changes may require parser maintenance.

Version 0.6 separates community and personal views. Dashboard has a welcome greeting, upcoming fixtures and news/events, without personal rating or match statistics. Fixtures use the existing public `GET /api/matches`: only future, dated `SCHEDULED` matches are shown, ordered by start time. Past, undated, postponed, cancelled, forfeit and completed matches are excluded. Empty and failed schedules have distinct states; no fixtures are invented or written to the database. Profile owns personal metrics, recent inhouses, most-played champions, form chart and roles. Settings owns player information, bio and the website edit action. Ladder hides `FA`, retains real team tags and parses website percentage strings correctly, with `--` for missing percentages.

**Inhouse History** is the signed-in user's official ECL games. **League History** is separate: it reads and sanitizes the user's saved `lzyumiRankedGames.soloGames` and `flexGames` from the existing authenticated profile response. The UI calls this **ECL snapshot**, with **Last updated** from the saved source timestamp, not the time the app fetched it. Queue filters, champion search, KDA when supplied and pagination are included. It does not call Lzyumi directly, refresh source statistics, change the database, or label saved games as live. Missing data stays empty rather than being invented. Source dates have no year; they are displayed as reported and sorted month/day within the saved snapshot.

**Remember me on this PC** defaults on when Windows encryption is available. Selecting it saves the session encrypted, never the password. Deselecting it removes prior saved session keys and keeps the new session in memory until Quit; hiding to the tray does not end the session. Sign-out removes saved native session keys. An existing session from an earlier release stays restorable; website and native desktop sessions remain separate. Server revocation or expiry can still require a new sign-in.

Profile-picture normalization now accepts the full website upload allowance of 4 MiB binary (about 5.6 MiB base64), instead of truncating at 400,000 characters and discarding the result. Allowed image types/origins and initials fallback remain restricted. A real account's avatar and saved history still need user sign-in verification; automated UI tests use labelled sample data.

Dashboard, Profile, both histories, Ranked Ladder and Settings are local desktop pages. Account reads use the existing `GET /api/account/profile`, `GET /api/hub/my-inhouse-history` and public `GET /api/leaderboard`. Refresh reloads stored data, not source statistics or database writes. Published standings may be archived/frozen and are not labelled as live Split II standings. Official ECL history (up to the latest 100 recorded games) is separate from locally collected League games.

Sign in with your existing ECL email/password in the desktop dialog. This does not create an account or scrape browser authentication. Supabase's official client authenticates in the main process; passwords are not saved and tokens never pass to the renderer. Auth requests are restricted to the configured Supabase HTTPS origin; authenticated data requests are fixed-origin, GET-only, with redirects refused. Native sign-out forgets this device's session even if revocation is unavailable offline.

The build reads only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the existing environment to write `dist/public-config.json`. Only public anonymous/publishable keys are accepted; service-role/server keys are rejected. No `.env` files, database passwords or report-worker secrets are packaged. Desktop sessions are stored as Windows-encrypted binary files under `%APPDATA%/ecl-companion/account`; if secure storage is unavailable, they remain session-only in memory. Native profile/history payloads are filtered before IPC and not cached to disk. Authenticated API checks with a real account require the user to sign in; automated tests use fake sessions, not real credentials.

## Test the Windows Installer

1. Choose **Quit ECL Hub** (or **Quit Companion**) in the old app first. Closing the window alone only hides it in the tray.
2. Open `release-logo/ECL-Hub-Setup-0.7.1.exe`. It is an assisted, current-user installer with an install-folder choice, ECL icons, desktop and Start menu shortcuts, and a Windows Apps uninstall entry. It does not request administrator elevation.
3. Finish setup and open ECL Hub. Sign in in the native dialog to load your own profile/history. Local matches remain in `%APPDATA%/ecl-companion`, not the install directory.
4. Open League and collect a completed match. Preview example match needs no League connection. Reporting uploads remain off unless you approve the separate session consent and the server pilot is enabled. No Windows startup task is added.
5. Setup reuses the existing location, removes old application files and retains the same app ID, Apps entry and shortcuts. Saved login/matches remain separate. Automatic update checking and an availability banner are implemented in 0.5; signed release hosting is not configured yet, so this unsigned build refuses in-app download/install. Read `UPDATES.md`. Older versions need this installer once to acquire updater support.
6. Uninstall through Windows Settings > Apps. The default uninstall preserves login/profile storage and match files. To remove that data too, quit the app and separately delete `%APPDATA%/ecl-companion`; this signs you out and removes saved local matches/queued requests. Uninstalling is not a personal-data erasure action.

This prototype is **unsigned**: Windows may display an unknown-publisher/SmartScreen warning. Code signing is not yet configured. Do not disable Windows protection, and only test artifacts built from this trusted local workspace. No signing or production-readiness claim is made. The old portable builds are retained under ignored `release/` and `release-hub/` as rollback options.

Portable/unpacked prototypes and downloaded setup executables are not registered installations. An upgrade does not search for or delete those files, and an already-running portable preview is separate from the installed app. Close old previews and use the installed ECL Hub shortcut. Keep `build.appId`, the package name and the app-data path stable across releases; changing them can break replacement or make saved data appear missing. The installer tests guard this identity and the bundled NSIS old-version removal/data-preservation sequence. An actual Windows install-to-upgrade test is still required before public distribution.

The Windows icon is generated at multiple sizes from the existing ECL logo by `icon.cjs`; `sharp` is a build-only dependency and is not shipped with the app. Executable resource editing is enabled to apply the logo and product name, while code signing remains disabled until a signing identity is set up.

## What works

- Native Dashboard/Profile/Match History: existing authenticated ECL data, published standings, champion portraits, result/search filters and history pagination. Settings includes native sign-in/out, collection toggle, local files, privacy and manual-update release notes.
- External Website button: opens the default browser. No webview, auth injection, browser-session scraping or registration/database changes from launching the app.
- Collector tab: Windows CIM discovery of LeagueClientUx.exe credentials, authenticated read-only loopback HTTPS requests, local League profile and gameflow status. Empty CN lockfiles and Riot Client Services are not used.
- Manual Game ID retrieval, automatic discovery of the latest five matches once per minute, plus a direct Game ID observed through gameflow when a game ends.
- Complete raw JSON and a ten-player scoreboard, joined by participant ID. Aborted/incomplete games, missing PUUIDs and incorrect teams are flagged. A complete custom Summoner's Rift 5v5 is only a *candidate* pending server roster verification.
- Persisted retry queue (five attempts, exponential backoff capped at five minutes), account-scoped jobs and local deduplication. Reconnection after the League process changes. Closing the window hides to tray; Quit stops collection.
- Info & privacy tab: usage, a detailed data-access/storage disclosure, optional-collection controls, separation from website login, and the remaining reporting work. It explicitly avoids a false "no personal data" promise: names, PUUIDs and statistics can identify players.

The collector does not modify League files, inject code or access process memory. Collection stays local by default. The optional reporting bridge sends the consented League identity and only assigned match JSON to `https://eclchina.lol` for storage/admin review; League credentials are never uploaded. Local TLS verification is disabled only on requests hardcoded to `127.0.0.1`, never on remote connections. League tokens and short-lived reporting capabilities stay in main-process memory, not IPC/disk/logs. League must run on the same PC; the app does not automatically elevate.

Raw data and queue: `%APPDATA%\ecl-companion\collector` (the Open folder button is authoritative). Match files contain player PUUIDs and statistics. Protect that folder and do not publicly share raw exports. Automatic collection is off by default; enabling it includes recent non-ECL games. No scheduled task or Windows auto-start is installed.

## Still to build

See `ROADMAP.md` for the ordered next releases: user-approved ECL/League account linking, authenticated KOOK report jobs and server validation, reliability/retention controls, then signed distribution and updates.

Native ECL login does not prove ownership of a local League identity. The pilot adds explicit session consent, matching the claimed Riot ID, authenticated own-job claims and strict server checks, but still requires administrator review of untrusted desktop JSON. The browser never hands its tokens to the collector.

The pilot flow is `!ready` -> play -> `!report IH_NUMBER LEAGUE_GAME_ID` -> authenticated reporter's app -> exact roster/side checks -> administrator review. It has not been deployed or exercised with real account uploads. Automatic scoring, independently verified League linking, retention controls and a complete admin review UI remain follow-up work. Untrusted client JSON must never directly award points.

No code signing or telemetry is included. Remote match uploads require the separate pilot consent and server enablement described above. Update checks contact the fixed ECL HTTPS feed, which returned 404 during implementation; signed release hosting is required before the full update cycle works. Update logic is tested with mock events, not a real signed upgrade.

Dependency audit at implementation time: zero shipped-runtime findings (`npm audit --omit=dev`); eight moderate build-tool findings remain. No high/critical findings. Do not use `npm audit fix --force` without reviewing toolchain changes.
