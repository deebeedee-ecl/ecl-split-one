# Tournament data foundation

The registration release is implemented and tested locally. The user approved
the separate Supabase foundation, which was created on October 17, 2026. Split II
remains DRAFT with zero registrations. The user subsequently approved publication
and opening at noon on October 17; release is in progress. See
[the release record](../../ECL_SPLIT_II_RELEASE.md) for exact checks and steps.

## Separate data

| Supabase table | Prisma model | Purpose |
| --- | --- | --- |
| tournaments | Tournament | Event configuration, dates, capacity, first prize, lottery method, status and consent versions. |
| tournament_registrations | TournamentRegistration | An event-scoped entry linked to the existing AccountProfile, with name/role/League identity snapshots and accepted consent versions/time. |

Split II is the ecl-split-ii-2026 event, rather than a new table/project for every
season. Existing World Cup registrations, Player.teamId, teams, matches and scoring
remain separate. Future lottery assignments should reference registration IDs
and remain tournament-scoped. Reuse established match/reporting infrastructure
when implementing later phases; do not create another scoring engine.

## Implementation

- lib/tournaments/registration.ts authenticates ownership through the caller's
  existing account ID, rechecks ACTIVE/VERIFIED eligibility and profile fields,
  snapshots the profile role, and rejects duplicate profile/game identities.
- lib/tournaments/registration-http.ts exposes a restricted response shape and
  validates request consent. The actual route always uses getAccountFromRequest;
  only isolated tests inject a fictional authenticator.
- All writes lock the event then the profile inside a READ COMMITTED transaction.
  Existing entries are returned idempotently before checking the window/capacity.
  Database triggers provide an additional capacity/window/version guard and
  prohibit edits to saved registration snapshots.
- Browser roles have no direct table privileges; RLS is enabled. The existing
  backend role's CREATE/RLS bypass and profile ID type have been verified read-only.
- Public responses contain roster registration IDs, display names and roles only.
  League identity keys, profile IDs, emails and consent records are not public.
- Terms are frozen in lib/tournaments/ecl-terms-2026-10-16.ts. Published registration
  rules and identifiers are in split-ii-config.ts. Keep accepted versions immutable
  after launch; new wording requires a new version, not an edit to old evidence.
- Profile/event deletion is restricted while registrations exist. An account
  erasure request needs an explicit retention/anonymization workflow.

## SQL files

`create-tournaments.draft.sql` and `seed-split-ii.draft.sql` were applied live on
October 17, 2026. The filenames retain their reviewed names; do not rerun creation.
See [the live preparation record](LIVE_PREPARATION.md). Opening and rollback SQL
have not been applied live.

- create-tournaments.draft.sql: additive tables, constraints, guards, RLS/grants.
- seed-split-ii.draft.sql: one DRAFT event; no fixture player entries.
- schedule-split-ii.draft.sql: enable signup at October 17, 2026, 12:00 noon China time;
  refuses a mismatched configuration and does not reopen a closed event.
- close-split-ii.sql: close registration without deleting any data.
- rollback-tournaments.draft.sql: remove only an unused foundation; refuses saved
  registrations or other event configurations. No CASCADE.

The scripts stay outside prisma/migrations: the repository has no established
migration baseline, and the website build must not apply SQL automatically.
Do not regenerate this SQL blindly; Prisma does not express the custom triggers,
CHECK constraints or RLS grants.

## Confirmed configuration

Draft October 23, play begins October 24, finals November 20, 2026. Random team
draw, 30 places and first prize 3,000 RMB. Timezone Asia/Shanghai. Opening instant
is 2026-10-17T04:00:00Z, per the latest noon confirmation. The original seed was
already applied with midnight; the schedule step updates that empty DRAFT event
atomically before enabling signup. Closing time is unset; close before the draw.
Four of the last 41 ACTIVE/VERIFIED profiles lack a complete server/openId identity;
all registrations are unique by profile and known Riot/server identity is checked.
This does not prove one physical person across accounts without shared identity.

## Verification

The migration, seed, schedule, duplicate/eligibility/consent rules, real concurrent
last-slot claims and direct inserts, RLS/grants, immutable snapshots and rollback
have passed on a fresh local PostgreSQL cluster using fictional accounts. No live
credentials are loaded by the test. Client DOM interaction tests and the production
build also pass. After live preparation, aggregate fingerprints and column metadata
matched for all ten checked legacy tables. Both new tables have RLS enabled, with
all direct CRUD privileges denied to anon/authenticated. Both guard triggers are
enabled; the only legacy foreign key references AccountProfile for account identity.

```powershell
npm.cmd install --prefix .tmp/tournament-test-tools --no-save --package-lock=false --no-audit --no-fund embedded-postgres@18.4.0-beta.17 jsdom@26.1.0
node node_modules/tsx/dist/cli.mjs scripts/test-tournament-registration.ts
node scripts/test-tournament-ui.mjs
```

The temporary tools and fixture database files stay in the ignored .tmp folder;
no application dependency was added. The test server binds to 127.0.0.1:54329
and is stopped after the test. On Windows, run these in an ordinary shell with
permission to launch PostgreSQL/esbuild subprocesses.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Supabase/Prisma](https://supabase.com/docs/guides/database/prisma),
[PostgreSQL locking](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE).
