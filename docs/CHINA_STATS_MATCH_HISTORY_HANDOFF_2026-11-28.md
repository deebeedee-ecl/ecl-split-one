# China Stats match-history usability handoff

Date: 2026-11-28 (Asia/Shanghai)

Status: merged and deployed to production

## Branch and base

- Worktree: `.tmp/china-apex-ui`
- Branch: `feat/china-stats-match-history-usability`
- Base and current upstream checkpoint at branch creation:
  `a89dce7975d260e36b6315e45d812415fdb37ace`
- Implementation commit:
  `0462262d1be1bcde107cbe0b862ce360c0169acd`.
- Documentation/handoff commit in the implementation PR:
  `14aa5f1525ec5fb32ddfaf9386e8606cce7ced8d`.
- PR [#106](https://github.com/deebeedee-ecl/ecl-split-one/pull/106)
  merged as `fe316e7499555bae4370a01892b29cb6c55c462a`.

## Delivered scope

- Compact match rows separate result, champion, role, queue, timestamp, and
  provider-confirmed MVP/SVP markers.
- Queue, champion, role, and result filters operate over loaded Solo/Duo and
  Flex rows only. Reset and intentional zero-results states are explicit.
- History K/D/A is not rendered because the normalized history contract has no
  K/D/A field. Detail scoreboard K/D/A continues to use normalized
  `scoreInfo`.
- A detail participant links to `/labs/china-stats/live` only for one valid full
  Riot ID. The link keeps the current Ionia or Super Server selection and uses
  no provider-private identifier. Malformed or incomplete identities remain
  text.
- Existing leaderboard/profile navigation, partial/empty/retry behavior,
  same-target retention, identity validation, and the five-unique-detail budget
  remain in place.

## Explicitly out of scope

- Matchups, leaderboard redesign, or a full visual redesign
- Database, Prisma, or provider write changes
- Refresh/rate-limit redesign or public access
- Pro Players, watchlists, standalone-product work, or community messaging

## Verification

- `node --import tsx --test test/china-stats-live.test.ts`: 13/13 passed.
- `npm test`: 194/194 passed.
- `npx tsc --noEmit --incremental false`: passed.
- `npx eslint app/labs/china-stats/ChinaStatsLiveLookupClient.tsx lib/china-stats-live.ts test/china-stats-live.test.ts`: passed.
- `npm run build`: passed after allowing the build to fetch the repository's
  existing Google fonts. Existing workspace-root, middleware-deprecation,
  Node-deprecation, and missing local Supabase public-variable warnings remain.
- Ignored synthetic Playwright artifacts:
  `.tmp/china-stats-match-history-smoke-{desktop,mobile}.json` with matching
  PNG screenshots at 1440 and 390 pixels.
- Synthetic evidence: filter changes and reset held signer/provider request
  counts at 4/4; one opened scoreboard moved them to 5/5 with exactly one
  detail request. Same-server participant link, malformed unlinked identity,
  private-value non-disclosure, a clean browser console, and no horizontal
  overflow in either viewport passed.

## Side effects and release boundary

The feature and its verification perform no real provider, database, Railway,
KOOK, Vercel-configuration, production-data, or community mutation. The
synthetic smoke used only intercepted fixture responses on a local development
server. Authorized external release effects were GitHub PR/merge, Vercel
preview/production deployments, and the automatic unchanged-source Railway
report-engine deployment; all reached success.

The Vercel preview reached `READY`; Supabase preview was skipped, so no preview
database or write credentials were provisioned. Vercel Protection blocked
signed-out application-route smoke before the request reached the app, while
the first response retained `X-Robots-Tag: noindex`. No protection bypass or
configuration change was made. Local fixture browser smoke supplied the
equivalent isolated functional coverage.

Production deployment `dpl_2hv3aayxd8BVSXYznMV8YayrvsZW` reached `READY` for
the merge SHA. `/labs/china-stats/live` returned `200` with
`noindex`/`nofollow`/`nocache`; signed-out `/api/china-stats/access` returned
`401` with `{"allowed":false}`. No real lookup was sent.

## Rollback and next step

The functional rollback target is
`a89dce7975d260e36b6315e45d812415fdb37ace`. There is no schema, configuration,
or stored-data cleanup; revert PR #106 as one unit if a critical production
regression appears.

Exact next step: the owner performs one authenticated production demo journey
without sharing private identifiers. If accepted, Matchups remains a separate
later slice.
