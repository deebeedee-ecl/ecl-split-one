# ECL Hub: Next Releases

Current checkpoint: the owner approved the native source commit and selected
**1.0.0** for a small tester installer. See
`../docs/desktop/TESTER_BUILD_1.0.0.md` and
`../docs/desktop/HUB_HANDOFF_2026-10-18.md`. The installed 0.9.2 updater pilot
passed. Reporting, profile freshness and server retention backend work remains
separate and undeployed. The sections below are historical planning notes;
their old updater/version status is not the current release checkpoint.

## 0.2: Branding and Clear Privacy

- ECL Hub display name and real ECL Windows executable, taskbar, window and tray icons.
- Preserve the original app identity/profile directory, so the name change does not reset sessions or saved data.
- Explain exactly what the local collector reads and stores, what it does not access, and how the live website differs.
- Automatic collection remains opt-in. No remote match uploads or added analytics.
- Rebuild and verify before replacing the original prototype. Do not overwrite a running executable.

## 0.2.1: Windows Setup

- Assisted NSIS installer, per-user defaults, optional install-folder selection and no elevation request.
- ECL icons, desktop/Start menu shortcuts and a Windows Apps uninstall entry.
- Preserve the original profile directory on upgrades and default uninstall. Old portable builds remain available.
- Setup bundles the full app; no runtime download, telemetry, startup task or automatic updater is added.
- Local build commands explicitly disable publishing. This setup is unsigned; signed distribution and authenticated updates remain future work.

## Next: Link the Correct Player

Version 0.3 adds a native desktop workspace and read-only ECL account access. Existing email/password authentication uses the official Supabase client in the main process, with OS-encrypted session persistence and no page-renderer tokens. Dashboard, Profile, Match History and Settings are local views; the website is optional. This is authenticated data access, not yet verified League-identity linking or bot-job authorization.

Version 0.4 adds an explicit Remember me choice, full-size website avatar support, separate Inhouse History and saved Lzyumi ranked League History, plus the Radix Colors/Inter desktop refresh. No direct Lzyumi requests, profile writes, uploads or database changes were added.

Version 0.5 adds ECL Central navigation, persisted English/Chinese, external-browser website links (no webview), public website news/events, a dedicated ladder with an explicitly labelled top-ten fallback, Chart.js form and Floating UI hints. Automatic update checking/notification is wired to a fixed website feed. Production metadata currently returns 404 and the build is unsigned, so in-app download/install is deliberately blocked. See `UPDATES.md` for signing/hosting and an installed-upgrade pilot before claiming production automatic updates work. See `UI_RESEARCH.md` for the deeper free-package review.

- Explicitly link a signed-in Hub account to a local League identity, with user approval and a short-lived authorization exchange.
- Display which ECL and League accounts are linked; detect mismatches and allow unlinking.
- Never scrape the Hub's authentication storage or distribute the global worker secret.
- Add owner-scoped authentication to any desktop report-job endpoint. Existing website authentication can be reused, but a sandboxed website session is not itself a desktop authorization bridge.

## Then: Complete KOOK Reporting

Version 0.7 implements the local, disabled-by-default review-only pilot: explicit upload consent, short-lived account-bound capabilities, own-job claims, lease/expiry checks, exact ten-player/team validation, and server review storage. No schema changes, production deployment or automatic scoring. See `../docs/desktop/REPORTING_PILOT.md`. Independent League ownership proof, real database concurrency tests, retention and complete administrator review/scoring remain required.

Preferred interaction: keep `!ready`/team coordination in KOOK; add an optional native **Report match** action that selects only the signed-in player's pending ready session and a collected match. It must use the same authenticated job/review service as the bot, not a second scoring path or a client-invented roster. This report-entry UI has been discussed, not implemented. First verify the existing bot-request pilot with a real game before widening entry points.

- Preserve the existing `!ready` roster, teams and designated reporter.
- Assign `!report` + Game ID jobs only to the linked reporter's app, with expiry, acknowledgments and idempotent retries.
- Collect a real completed custom 5v5, upload only with clear disclosure/consent, and validate on the server: game completion, all ten verified identities, expected teams, server/region, collector participation and global duplicate Game ID.
- Reuse the existing report confirmation and scoring path. Local JSON and local candidate labels are not proof of an official result.
- Provide pending, uploading, awaiting confirmation, accepted and rejected states with useful errors.

## Reliability and User Controls

- Test real post-game collection across League restarts, permission differences, network failures and account changes.
- Separate pause discovery, pause all queued work, cancel and retry controls. Add a safe in-app delete action and a documented retention policy.
- Make privacy and upload permission visible before collection/submission, not only in Info.
- Package sanitized diagnostics with user review; do not silently upload logs or credentials.
- Keep Live Client snapshots separate from authoritative final match statistics.

## Useful Workspace Additions

- Matchday view showing the approved ready roster, linked League account and report progress. Prioritize this after identity linking; do not invent online/ready state from local app presence.
- Per-season champion and role breakdowns from official inhouse records, with clear sample sizes and season selection once the API supports them.
- Opt-in desktop notifications for collection failures and report outcomes, with quiet hours.
- A visible ECL/API/League connection status and reviewable, sanitized diagnostics.
- Optional online player presence only after explicit user consent and a server-side presence design; no background activity tracking.

## Distribution

Update checking and notification are implemented. Automatic installation is not operational yet: the test releases are unsigned and the website feed has not been published. Configure code signing and trusted publisher metadata, host signed installers/blockmaps/`latest.yml`, and test an installed old-to-new upgrade before calling updates ready. Do not disable signature verification to bypass this work.

- Small pilot with a few designated reporters before wider rollout.
- Add a signed installer and authenticated/signed update delivery with rollback and release notes. Decide who operates the signing identity and update hosting first.
- No silent executable replacement or disabling Windows security warnings.
- Reduce memory/startup cost based on measurements; reconsider a native shell only if the pilot shows the bundled Electron runtime is a problem.
- Registration, the database schema and production deployment remain outside this local desktop work unless separately approved.
