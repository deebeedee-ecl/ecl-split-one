# Split II registration release: published and scheduled

Latest confirmed opening: **October 17, 2026, 12:00 noon Asia/Shanghai**
(`2026-10-17T04:00:00Z`), replacing the earlier midnight request. If enabled after that instant, registration opens
immediately. On October 17, the user approved and retried creation of the separate
Supabase foundation. Both tournament tables and one DRAFT event now exist, with
zero registrations. The user subsequently approved publication and scheduled
opening at noon on October 17. Release commit
`f0845652ffa438b44565a91d4b5bcf1659299279` is published; Vercel and the report-engine
deployment checks succeeded. Production smoke checks passed before scheduling.
The live API now reports `scheduled`, opening `2026-10-17T04:00:00.000Z`, capacity
30 and zero registrations. No genuine signup was created during release checks.
See [the preparation record](database/tournaments/LIVE_PREPARATION.md).

## Public landing page follow-up

At the user's request, `/split-ii` is now a simple public event landing page
headed ECL SPLIT II. Its primary action links to `/hub/dashboard` to sign in and
register; the homepage announcement also says to sign up through the Hub. Dates,
prize, verification requirement and the rules link remain visible. The public page
does not render the registration client or roster. Hub registration, backend
eligibility/consent/capacity checks and the approved opening time are unchanged.

## Included

- Existing ECL sign-in, with ACTIVE + VERIFIED profile eligibility.
- A persistent 30-player pool, one entry per profile, deterministic signup order,
  profile role snapshots and saved consent versions/time.
- Server-side profile identity and role derivation, duplicate League identity
  protection when known, idempotent retries and atomic capacity enforcement.
- Anonymous visitors see roster names/roles only; personal ticket details require
  the existing Supabase bearer-token authentication.
- Draft October 23; play begins October 24; **finals November 20**. Teams are drawn
  at random; first prize is 3,000 RMB.
- The supplied Worlds 2021 Destiny track on the Hub dashboard, at 20% volume,
  with a play/mute control and a manual-play fallback for autoplay restrictions.
- The agreed blue/black/gold/white design, white title/counter bands, dark entry
  ticket and upright AGAINST ALL ODDS catchphrase.
- World Cup removed from active promotion/navigation and retained in the archive.
- Ladder connection failures show a retry panel instead of a crash. The existing
  Next.js admin teams query-parameter compatibility issue was also corrected so
  the production build succeeds.

Lottery execution, team administration, brackets, match collection, reporting,
waitlists and cancellation are outside this registration release.

## Live changes and remaining approval

1. Create `public.tournaments`, `public.tournament_registrations`, their indexes,
   foreign keys, `TournamentStatus` enum and two guard functions/triggers using
   [the tested SQL](database/tournaments/create-tournaments.draft.sql).
   Browser-role grants are revoked and RLS is enabled. Existing account, player,
   World Cup, match and score tables are not changed.
2. [Seed one Split II event](database/tournaments/seed-split-ii.draft.sql) in DRAFT,
   with the confirmed dates, 30-player capacity, first prize and consent versions.
   No player entries or fixture accounts are seeded.
3. Publish only the release files to the existing GitHub main / Vercel pipeline.
   `vercel.json` selects the tested webpack build through
   `npm run build -- --webpack`. No schema command runs during the Vercel build.
4. After production smoke checks, [enable the scheduled opening](database/tournaments/schedule-split-ii.draft.sql).
   This does not need a cron task; every signup checks the opening instant on the
   server. No closing time has been supplied, so close registration manually
   before the October 23 draw using the close operation below.

All four steps were approved and completed on October 17. The user confirmed
"12:00 noon, October 17". After production checks, the exact tested schedule SQL
updated the empty DRAFT event's original midnight value and enabled its noon gate.
Do not repeat table creation. Use the read-only check before further operations.

Production `/split-ii`, `/split-ii/rules`, `/hub/dashboard`, `/hub/split-ii` and the
World Cup archive return 200. The mock preview returns 404; anonymous signup is
401; registration GET is no-store; audio byte ranges return 206 audio/mpeg. Both
the closed state before scheduling and scheduled state afterward were verified.
The bilingual KOOK verification announcement was supplied only in chat for group
posting, as requested; no Chinese notice was added to the site.

## Completed verification

- Prisma schema validation and generated client; TypeScript and focused ESLint.
- Real, isolated PostgreSQL migration, seed and schedule tests using fictional
  profiles on loopback port 54329. No live credentials are loaded by the test.
- Authentication/eligibility/consent and malformed-request cases; profile/role
  spoofing rejection; role/name snapshots survive profile edits; saved consent.
- Race for place 30: one winner, one refusal. Place 31 refused. Eight simultaneous
  retries do not consume another place. Concurrent direct DB inserts are also
  limited by the trigger; capacity cannot shrink below occupancy.
- RLS and denied SELECT/INSERT/UPDATE/DELETE for both browser roles on both new
  tables; unsupported transaction isolation fails closed.
- Rollback refuses registrations; deliberately rolled-back insert leaves no row;
  empty foundation rollback succeeds.
- Client DOM interaction checks with mocked auth/HTTP: login link, no fictional
  live roster, required consent, saved ticket after remount, scheduled/full/error
  states, retry recovery and no false confirmation after a refused signup.
- Audio DOM checks cover blocked autoplay, manual play and mute. The actual MP3
  serves as audio/mpeg and supports HTTP byte ranges (206).
- `next build --webpack` passes, including all 66 static pages and route types.
- Built production app smoke check on localhost:3003: `/split-ii`, `/hub/dashboard`
  and `/split-ii/rules` return 200; the mock preview route returns 404; anonymous
  signup is 401; unapplied live tables return 503 without a fictional counter.
- Initial live preflight confirmed both tables absent and the existing profile
  ID/backend privileges compatible. Approved preparation then created both tables
  and the DRAFT event. All ten checked legacy table data fingerprints and column
  metadata are unchanged; RLS/grants/foreign keys/guards were verified live.
- Last aggregate check: 41 active/verified profiles; 4 lack a complete stable
  server/openId identity. They are still eligible if their profile fields/role
  are complete. Profile uniqueness is enforced for all, and normalized Riot
  identity is checked when the server is known. This cannot prove one physical
  person across accounts with no shared identity; admin verification remains
  the identity foundation.
- Existing live domain `https://eclchina.lol` responds from Vercel. Public GitHub
  commit status has a successful Vercel deployment. Local and remote main both
  match `1c87ef62a8a1f2ea5ae21859d8eb4e11ae33f43b`; a no-op dry-run push succeeded.

The in-app browser is unavailable, so final visual review is manual. The client
interaction tests use DOM fixtures, not a real signed-in browser session. An
authenticated production user should perform the first genuine signup after
opening; do not create fake accounts/registrations in the live player pool.

## Local review

- Public landing page: `http://127.0.0.1:3002/split-ii`
- Real registration client: `http://127.0.0.1:3002/hub/dashboard`
- Desktop design/music with isolated fixtures: `http://127.0.0.1:3002/hub/split-ii/preview`
- Frozen consent text: `http://127.0.0.1:3002/split-ii/rules`
- Production-mode smoke server: `http://127.0.0.1:3003/split-ii`

Mock controls exist only on the development preview route. The normal dashboard
uses the actual authenticated Hub shell in development and production.

## Operations after approval

The helper loads the same environment precedence as Next.js, so Prisma CLI does
not accidentally select a different `.env` database. It never prints credentials
or player rows. It is read-only without an explicit write action plus `--apply`.

```powershell
# Read-only preflight; already performed successfully.
node node_modules/tsx/dist/cli.mjs scripts/release-split-ii.ts check

# Already completed October 17: tables and CLOSED/DRAFT event. Do not rerun prepare.

# Publish the approved files, wait for the new Vercel deployment, then smoke-check
# its rules page, anonymous POST rejection and registration GET while still closed.

# After deployment verification: enable the agreed October 17 noon opening time.
node node_modules/tsx/dist/cli.mjs scripts/release-split-ii.ts open --apply

# Operational close before the draw, or if registration needs to be stopped.
# This preserves every registration and consent record.
node node_modules/tsx/dist/cli.mjs scripts/release-split-ii.ts close --apply
```

During preparation, Prisma CLI committed the creation transaction but failed to
return successfully before its timeout. Metadata was checked before any further
action; only the exact approved seed was then applied through a PostgreSQL client.
If any SQL helper fails, run the read-only check and inspect the resulting state
before retrying a write. A CLI failure does not prove its transaction rolled back.

Do not use `db push`, seed fixture players, push every worktree file or run
automation scripts as part of this release. Leave the unrelated package.json
collector shortcuts and untracked investigation scripts untouched. Select the
site changes, `app/split-ii`, `app/api/tournaments`, `lib/tournaments`, Prisma
schema, supplied audio, `vercel.json`, release helpers/tests and documentation.

## Stop / rollback

If deployment fails, keep the event in DRAFT. If signup has opened, close it
before reverting the website. Preserve the new tables once registrations exist.
The [empty-only rollback SQL](database/tournaments/rollback-tournaments.draft.sql)
refuses to erase a registration and does not cascade into old data. Fix forward
or export/preserve event and consent data when any genuine signup exists.

Sources for the implementation choices: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Vercel project configuration](https://vercel.com/docs/project-configuration),
[PostgreSQL row locking](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE).
