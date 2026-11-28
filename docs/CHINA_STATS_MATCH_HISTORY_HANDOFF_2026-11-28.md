# China Stats match-history usability handoff

Date: 2026-11-28 (Asia/Shanghai)

Status: release candidate; implementation committed and GitHub delivery
authorized, with PR/preview/merge evidence pending

## Branch and base

- Worktree: `.tmp/china-apex-ui`
- Branch: `feat/china-stats-match-history-usability`
- Base and current upstream checkpoint at branch creation:
  `a89dce7975d260e36b6315e45d812415fdb37ace`
- Implementation commit:
  `0462262d1be1bcde107cbe0b862ce360c0169acd`.
- Documentation and this handoff are committed separately on the same branch so
  the implementation SHA remains stable.

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
server. GitHub PR/merge and preview metadata are release operations only and
must be appended to the production checkpoint after completion.

An isolated temporary preview or equivalent pre-production check is still
required before production. It must not have unrestricted production write
credentials. The owner authorized push, PR, isolated preview verification, and
merge after the local checks passed. No manual Vercel configuration change or
separate production deployment was authorized.

## Rollback and next step

Before merge, the rollback boundary is the branch base
`a89dce7975d260e36b6315e45d812415fdb37ace`. There is no schema, configuration,
or stored-data cleanup.

Exact next step: push the authorized branch, open the focused PR, require CI
and isolated preview evidence, and merge only if those gates pass. Matchups
remains a separate later slice.
