# Live tournament foundation: October 17, 2026

The user approved creating a separate Supabase section to avoid mixing Split II
with previous tournament statistics, then requested a retry. The approved scope
was additive tournament storage and a closed DRAFT event. No site publication or
registration opening was performed.

Applied the exact reviewed `create-tournaments.draft.sql` and
`seed-split-ii.draft.sql`. Prisma CLI committed table creation but did not return
successfully before its timeout. A separate read-only check found both tables
and no event. Creation was not repeated; the exact seed was applied using the
existing temporary PostgreSQL client. No application dependency was added.

Verified live:

- `tournaments` and `tournament_registrations` exist in public. Split II has its
  own event ID and slug `ecl-split-ii-2026`.
- Status DRAFT, capacity 30, zero registrations, lottery team formation, first
  prize 3,000 RMB. Draft October 23, play begins October 24, finals November 20.
- RLS enabled on both tables. Neither anon nor authenticated has direct SELECT,
  INSERT, UPDATE or DELETE privileges on either table.
- Both registration and capacity guard triggers are enabled.
- Registration foreign keys reference only the event and existing AccountProfile
  identity. They do not reference legacy teams, matches or scoring tables.
- Before/after database-side aggregate row fingerprints and column metadata match
  for AccountProfile, Player, Team, Match, MatchGame, MatchGamePlayerStat,
  InhouseSession, InhouseSessionPlayer, TeamRegistration and FreeAgentRegistration.
  No individual player records or credentials were exported or printed.

The local production smoke server was unavailable during this retry, so no new
HTTP smoke result is claimed. Earlier local build, API, concurrency, RLS and UI
tests are recorded in the main release document. Run production smoke checks
after the approved site publication and before opening registration.

Future lottery assignments, teams, matches and statistics must carry tournament
scope when implemented. The current foundation isolates registrations; it does
not implement or migrate future tournament statistics.

Do not rerun creation. Use `scripts/release-split-ii.ts check` for read-only state.
If a future SQL command reports failure, inspect database state before retrying:
the client can fail after the transaction has committed. Keep the event DRAFT
until the publication/opening step is authorized and verified.
