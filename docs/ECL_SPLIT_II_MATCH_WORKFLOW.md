# Split II match workflow — release checks

Owner approved the listed implementation October 24, 2026. The Yasser/fayimo
identity swap is explicitly excluded until confirmed. Existing profile values
are displayed; no ownership correction is inferred from nicknames.

## Authorized scope

- Publish grey current Riot IDs on final team roster cards.
- Dedicated tournament teams/members, fixtures, reports, approved results,
  floater appearances and notification outbox, isolated from inhouse tables.
- Captains/admins propose fixture times; opposing captain confirms. China time.
- Admin manual entry, screenshot/JSON evidence, review/publish/correct results.
- Results, standings and Top 3 KDA/assists/MVP from approved tournament games.
- Desktop Split II tab; explicit tournament collection enters tournament review.
- KOOK command adapter and reliable notifications for actual scheduling/results.

## Delivery checks

- [x] Schema and seeded teams/fixtures validated in isolated PostgreSQL.
- [x] Scheduling permissions, duplicate reports, corrections and floater limits tested.
- [x] Tournament operations verified not to change inhouse scores or records.
- [x] Admin/public UI interaction tests and desktop unit/build checks pass; no fabricated live statistics.
- [x] Additive production migration applied; every existing table fingerprint matched.
- [ ] Scoped website deployment verified.
- [ ] KOOK adapter integrated/tested; live process activation verified separately.
- [x] Desktop 1.0.2 installer built, signed with the existing ECL key and verified against isolated source. Installed app unchanged.

Working tree already contains unrelated desktop/bot changes. Keep scope explicit
when staging and deploying. Never stage environment files, private audit backups
or the KOOK token. Do not send test KOOK messages to real channels.

## Operator workflow

- Website: `/hub/split-ii`, with shared data at `/api/tournaments/split-ii/matches`.
- Admin: `/admin/split-ii`. Select the fixture and actual ten players, winner,
  duration and optional K/D/A, MVP and private screenshot. Save for review,
  inspect the lineup/evidence, enter a review note and approve to publish.
- Paste a complete LCU match JSON for the selected fixture, or a structured
  report JSON. Raw evidence never appears in public responses. Manual reports
  work without Tencent match history. A missing Game ID cannot be deduplicated
  across ingestion systems; enter it whenever available.
- Corrections name the current approved report. Approval replaces its result
  and floater ledger atomically; old reports remain available for audit.
- KOOK: `!split2 fixtures`, `!split2 schedule RR01 2026-10-26 20:00`,
  `!split2 confirm RR01 REVISION`, `!split2 cancel RR01 REVISION`.
  Only the fixture captains schedule; the opponent confirms. Admins can override.
- Player collection: `!split2 report RR01 GAME_ID` (optional final game number
  for a series). In Hub 1.0.2, open Split II and connect tournament reporting.
  Explicit session consent is required. Only that account's requested match
  uploads; every upload still requires admin review. Restart/logout/disconnect
  stops future uploads. It never applies inhouse LP.
- Notifications use the fixture's KOOK text channel, or optional
  `KOOK_SPLIT_II_CHANNEL_ID`. Admin scheduling accepts a text channel ID.
  The bot polls durable outbox claims and sends with its existing credentials;
  the website does not need a duplicate bot token. Ambiguous delivery becomes
  UNKNOWN. Check the channel before retrying from the admin page.
- Main roster and floaters are preserved. No identity swaps are included.
  Floater enforcement is once per team per tournament game; scrims are outside
  this fixture/report workflow. Stats use approved games only; missing stats
  are excluded. Tied standings are provisional and require the published
  tournament tie-breakers rather than an automatic alphabetical qualification.

## Release operations

Read-only preflight: `node node_modules/tsx/dist/cli.mjs scripts/release-split-ii-matches.ts check`.
The approved additive migration/seed uses `apply --apply`; never run `db push`
or rerun the original registration creation SQL. The helper refuses an unexpected
main roster and writes hashes/counts of existing tables to a private audit under
`.tmp`. It seeds the exact five rosters and ten existing round-robin fixtures.

Required production settings: existing `ECL_KOOK_BOT_SECRET` and explicitly
configured `ADMIN_SESSION_SECRET` or `ADMIN_PASSWORD`. New tournament admin
endpoints refuse a hardcoded default. Vercel CLI authentication was restored by
the owner. After explicit owner approval, encrypted production admin password
and session-secret variables were configured. The login is saved privately in
`.tmp/ECL-admin-login.txt`; no password or bot token is included in source control.
Existing admin sessions must sign in again after the new deployment takes effect.

Desktop delivery is a local 1.0.2 installer. It preserves the app ID/data directory
and existing public release pin. No installed app or public update feed is changed
automatically. The sibling bot's unrelated pending changes are excluded from its
release commit. Real KOOK test messages and live test results are not used.

Migration: October 24, 2026. Five teams, 25 memberships and ten fixtures seeded;
25 main registrations and five floaters remain. Zero reports were fabricated.
The private before/after audit is `.tmp/split-ii-match-migration-audit.json`.
Installer: `companion/release-test-102/ECL-Hub-Setup-1.0.2.exe` (119,274,135 bytes).
It was verified from `.tmp/split-ii-workflow-release/companion` so line endings
match the exact packaged source, with the existing public ECL verification pin.
Public update-feed publication and installed-upgrade testing are separate.

Website feature commit: `a675c5c`. Bot adapter commit: `050ea4a` in
`deebeedee-ecl/ecl-kook-bot`. Production verification is performed after the
credential-configured deployment; no live test results or KOOK messages are
created during smoke checks.
