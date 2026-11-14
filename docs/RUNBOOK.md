# ECL development and operations runbook

Last reviewed: 2026-11-10

## Safe local start

1. Use Node.js 20.9+; Node.js 22 LTS is preferred.
2. Run `npm ci` at the repository root.
3. Copy `.env.example` to a local ignored environment file and populate only what the task needs. Never inspect or copy someone else's environment file into documentation or tool output.
4. When authentication work needs an isolated local Supabase environment, run `npm run supabase:start`; Docker is required. Use `npm run supabase:status` locally to obtain the local API URL, public anon key, and database URL, but do not paste or commit the complete output.
5. For a brand-new disposable local PostgreSQL database only, run `npm run db:push:local` after selecting its local `DATABASE_URL` in `.env.local`. The command refuses non-loopback PostgreSQL hosts before Prisma starts.
6. Run `npm run dev` and use the local URL. Stop the optional Supabase stack with `npm run supabase:stop` when finished.

The repository-pinned Supabase CLI owns the local Auth/service stack only. Prisma remains the schema owner for ECL application tables. Do not add or apply Supabase database migrations for those tables, and do not run `supabase login`, `supabase link`, or any remote command against a shared or production project without explicit authorization naming the target.

The root `README.md` has the fuller setup and environment-variable matrix. If its commands disagree with `package.json`, the current package scripts win and the README should be corrected.

For the existing-production Prisma migration baseline, follow [`database/PRISMA_MIGRATION_BASELINE.md`](database/PRISMA_MIGRATION_BASELINE.md). Its inspection command is read-only and plan-only by default. Backup creation, a live-schema read, baseline metadata writes, migration deployment, and restore are separate authorization boundaries; do not collapse them into one operation.

## Choose checks by changed runtime

| Change area | Minimum focused check | Broader check before handoff when practical |
| --- | --- | --- |
| Docs only | Inspect links/paths and diff | No application build required |
| Web library/API | `npm test` plus focused test | `npx tsc --noEmit`, `npm run lint`, `npm run build` |
| Next.js route/component | Relevant focused test/type check | `npm run build`; visually inspect affected route |
| Prisma/data flow | Test validation, auth, dedupe, transaction behavior with an isolated database/fakes | Build plus reviewed migration/operation plan |
| Report engine | `npm test` in `report-engine/` | Read-only known-player probe in the intended environment |
| Companion | `npm test` in `companion/` | Build/demo; package/release checks only for release work |
| Adjacent KOOK bot | Parser/command smoke test if available | Staging/test-channel exercise; never message production without approval |

Record commands, pass/fail counts, skipped checks, and the reason for each skip. Do not describe a check as passing if it was not run.

### Web CI baseline

Pull requests and pushes to `main` run the locked root install, `npm test`,
`npm run test:focused`, `npx tsc --noEmit --incremental false`, `npm run build`,
and the offline `npm run test:perf:ci` contract check on Node.js 22. The last
command writes a sanitized JUnit report under ignored `.tmp/ci/` for artifact
upload, with local paths and variable timing/request values normalized; it does
not contact a deployed site or use credentials. Full lint is not blocking while
the known repository-wide baseline remains unresolved.

## Preview-first release workflow

ECL does not require a permanently running staging environment for ordinary work, but production must not be the first place a change is exercised. Use this default path:

1. Create a focused feature branch and small PR for one vertical behavior or route.
2. Run the smallest relevant local checks and add characterization/regression coverage for behavior being moved.
3. Let CI run the build, type checks, lint, and focused tests configured for the changed runtime.
4. Create a temporary preview deployment or equivalent isolated pre-production environment.
5. Exercise the affected happy path, loading/empty/error states, authentication boundary, and a short critical-journey smoke list.
6. Record before/after measurements for performance work and verify that no unexpected requests, writes, or private data appear.
7. After explicit approval, merge/deploy to production.
8. Run the named production smoke checks immediately, observe the relevant logs/metrics, and use the recorded rollback target if a critical check fails.

### Preview data rules

- Prefer a separate Supabase/project database or sanitized fixtures when a test needs writes.
- A preview that reads production data must use a read-only or otherwise restricted credential and must not expose private fields in logs, screenshots, fixtures, or artifacts.
- Do not point preview mutation flows at production merely because setting up test data is inconvenient.
- Use an approved test account/identity for authenticated smoke checks. Never commit its credentials or browser storage.
- External side effects such as KOOK messages, tournament changes, provider writes, email, and update publication stay disabled or target an explicit test channel/service.

### Database and write-path rollout

For schema changes and durable workflow changes, prefer an expand/deploy/migrate/cleanup sequence:

1. Add backward-compatible schema/API support.
2. Deploy code that can tolerate old and new representations.
3. Run the reviewed migration/backfill with preflight, bounded scope, idempotency, and recovery checks.
4. Verify reads and writes in production.
5. Remove the old representation only in a later approved change.

Do not combine irreversible cleanup with the first production deployment. High-risk behavior should use a feature flag or another reversible activation path when practical.

For the approved Split II semifinal release, use
`scripts/release-split-ii-semifinals.ts`. Run `check --target=production` first,
review the standings, planned `SF01`/`SF02` matchups, blockers, and fingerprint,
then run `apply --target=production --apply --fingerprint=<fingerprint>` only
with explicit production authorization. The apply transaction locks the event,
revalidates the fingerprint, tolerates already-correct rows, and writes an
ignored audit. Before a semifinal schedule or report exists, recovery may
delete only those two fixture rows in one separately reviewed transaction;
after use, preserve the fixture history and correct records through the normal
tournament workflow.

If the operator workstation cannot reach PostgreSQL, the authenticated Split II
admin page exposes the same bounded release as **Publish SF01 & SF02**. The
server-side action locks the event, rechecks completed non-provisional standings,
rejects any unexpected or changed semifinal row, and inserts only missing exact
fixtures. It is idempotent and never queues a KOOK notification. Capture the
returned inserted codes and verify the public tournament API immediately. The
same recovery boundary above applies.

### Release evidence

Every production handoff should state:

- PR/commit and affected runtime/routes;
- checks actually run and anything skipped;
- preview environment and smoke results;
- database/external side effects, or an explicit statement that there are none;
- before/after measurements for performance changes;
- production deployment authorization;
- rollback target and post-deploy verification result.

### Post-merge deployment verification

Do not infer a deployment from a successful merge, an earlier green deployment,
or a generic GitHub status. Verify each runtime against the exact merge commit.
The repository provides a read-only status command that emits only bounded,
sanitized metadata:

```powershell
npm run release:status -- --sha <merge-sha>
```

The default check reads GitHub check runs and the ECL Vercel production history.
It prints check names, conclusions, deployment state/ID, and commit SHA; it does
not print creator/email fields, raw CLI payloads, tokens, environment values, or
response bodies. `SUCCESS`/`READY` are observed states. `PENDING`, `NOT_FOUND`,
and `SKIPPED` must remain explicit and must not be reported as deployment
success. The operator must already have authenticated `gh` and `vercel` CLIs;
a scoped Railway check additionally requires an authenticated `railway` CLI.

### Railway runtime scope

The repository-root Railway link is an operator convenience, not shared project
configuration. The confirmed production mapping for this repository is the
`report-engine/` runtime to the Railway service `ECL Report Engine` in the
`production` environment. The Railway project contains multiple services, so
leave the repository root linked at project/environment scope and pass the
service explicitly for service-specific commands.

The `ecl-kook-bot` Railway service belongs to the adjacent `ecl-kook-bot`
repository. Do not deploy it or change its variables from this repository.
Do not commit Railway project, environment, or service IDs; keep them in an
ignored operator environment using the variable names in `.env.example`, or
pass the three IDs explicitly to the read-only release-status command.

For a Railway-backed runtime, pass the project, environment, and service IDs
together. Keep those IDs in ignored operator configuration or dedicated
`ECL_RELEASE_RAILWAY_*` environment variables rather than committing them:

```powershell
npm run release:status -- --sha <merge-sha> `
  --railway-project <project-id> `
  --railway-environment <environment-id> `
  --railway-service <service-id> `
  --require-railway
```

Use `--require-railway` only when that release is expected to deploy the scoped
service. For a web-only change, an absent report-engine deployment is not an
error; record `NOT_FOUND` and do not trigger a worker deployment merely to make
the statuses align. The command always uses explicit Railway scope and searches
for the requested commit SHA instead of substituting a newer or older deploy.

If a reviewed preview commit must be rebuilt for production after the automatic
Vercel deployment fails to start, record both commits with `--vercel-sha`. The
command verifies that the preview-source and merge commits resolve to the same
Git tree; a mismatch fails the check:

```powershell
npm run release:status -- --sha <merge-sha> --vercel-sha <preview-sha>
```

Important release rules:

- Query Vercel directly with the project and team scope when GitHub exposes no
  deployment/status for the merge commit.
- Poll in bounded intervals and retain the exact deployment ID. Do not attribute
  an earlier `READY` deployment to a newer commit.
- `vercel promote <preview> --yes` may create a fresh production build instead
  of only changing aliases. It is a production deployment and still requires
  explicit authorization.
- Check Railway only for a runtime/path that could deploy there. Use explicit
  project/environment/service scope and require the exact commit to reach
  `SUCCESS` before reporting success.
- Deployment Protection is not permission to bypass preview authentication. If
  the preview cannot be opened safely, use an isolated local production build
  for pre-merge visual verification and record the preview limitation.

After the production deployment is `READY`, run the signed-out layout smoke for
the affected public/Hub shell boundary:

```powershell
npm run smoke:layouts -- `
  --base-url https://eclchina.lol `
  --label production-<short-sha> `
  --output .tmp/layout-smoke/production-<short-sha>.json
```

The smoke checks `/hub` and `/hub/dashboard` at desktop and mobile viewports. It
asserts status/path, public header/footer and login/contact presence, Hub sidebar
presence, and document-level horizontal overflow. Screenshots and the optional
JSON report stay under ignored `.tmp/`; the command is signed-out, does not
submit forms, and does not retain response bodies.

### Isolated hotfix from a dirty worktree

Do not deploy the current directory when it contains unrelated or unreviewed changes. `scripts/deploy-isolated-hotfix.ps1` builds an isolated package from the Git commit attached to the current production deployment (or the base SHA recorded by an earlier run of this script) and overlays only an exact allowlist of repository-relative files. If an older direct CLI deployment has neither metadata field, supply its already-verified commit with `-BaseRef`. The script rejects globs, paths outside the repository, symlinks, `.env*`, `.git`, `.vercel`, `.tmp`, and `node_modules`.

Use three separate invocations so production cannot be the first test environment:

```powershell
# Local package only; no Vercel write.
./scripts/deploy-isolated-hotfix.ps1 -Mode Plan -Files @(
  "app/example/ChangedComponent.tsx",
  "scripts/test-example.mjs"
)

# Requires explicit authorization for a Preview deployment.
./scripts/deploy-isolated-hotfix.ps1 -Mode Preview -Files @(
  "app/example/ChangedComponent.tsx",
  "scripts/test-example.mjs"
)

# Use the READY deployment ID printed by Preview mode. This is still allowed
# only after the operator explicitly authorizes the named production release.
./scripts/deploy-isolated-hotfix.ps1 -Mode Production -Approved `
  -ExpectedPreviewDeployment "dpl_REPLACE_ME" -Files @(
    "app/example/ChangedComponent.tsx",
    "scripts/test-example.mjs"
  )
```

Preview mode records an ignored local state file containing the production base SHA, the exact file allowlist, and a content fingerprint. Production mode refuses to proceed if any of those changed, if the expected preview is not `READY`, or if it is already a production deployment. It prints the previous production deployment ID and rollback command after a successful release.

The `-Approved` switch is a mechanical guard, not a substitute for operator authorization. Do not run Preview or Production mode merely because the command exists. A direct CLI deployment also creates Git/deployment drift until the same change is reviewed and merged; record that fact and prevent the next Git deployment from silently reverting the hotfix.

## Read-only diagnostics first

For an incident or integration change:

1. Identify the exact runtime and environment.
2. Reproduce with the smallest read-only endpoint/probe or a sanitized fixture.
3. Confirm identity keys (profile/player ID, full Riot ID, server, `openId`, stable KOOK ID) without exposing personal values in shared output.
4. Trace request → validation → durable state → external side effect.
5. Distinguish provider failure, ECL validation rejection, database failure, and KOOK delivery failure.
6. Only then propose a mutation, retry, backfill, or deployment.

For Hub performance diagnostics, run the documented command in `docs/performance/HUB_BASELINE.md`. Each benchmark sample uses a random `X-ECL-Performance-Request-ID`; match it to the structured `ecl.performance` server log. Do not add account, profile, Riot, KOOK, query-string, SQL-argument, or provider fields to performance logs. `Server-Timing` is available on private/uncached instrumented read-API responses, while post-routing page/database phases and publicly cacheable requests are available in the correlated server log.

Useful read-only worker probe syntax is documented in the root README. Provider probes may still expose personal/provider data, so use a known approved test identity and do not commit their output.

### Lzyumi access triage

Classify Lzyumi failures before changing tokens, building a companion flow, or concluding that history is empty:

1. Start with the established signed browser request for ordinary profile/rank/history refreshes. It uses the player's residential IP and is the expected primary path.
2. Resolve identity with bounded attempts in this order: bare Riot name, full `name#tag`, then variants using the saved `openId` when available. If the full-ID attempt returns code `1` with `battleInfo: null`/`data: null`, continue to the bare-name or saved-identity attempt; do not report empty history.
3. Accept a bare-name result only when the returned full Riot ID exactly matches the expected normalized `name#tag`, the returned server is the expected China server, and a coherent `openId` is present. A different tag or server is an identity mismatch, not a fallback success.
4. After identity resolution, request the needed filters with that verified identity. For custom-game discovery, filter `1` history rows whose localized title contains `新模式` are candidates only; fetch detail and require structured `gameType === CUSTOM_GAME` before treating a row as a confirmed custom game.
5. Record only a sanitized outcome: transport failure, HTTP status, provider application code, whether identity matched, response shape/data length, and which requested filters returned coherent data. Never print or copy the token, signed URL, cookies, `openId`, provider game IDs, or raw private payload.
6. Treat application code `6` as an authentication/session problem. Treat code `7` as throttling. Code `8` is ambiguous and can represent provider/network rejection; it is not proof that the token is invalid. Code `1` is not sufficient when the expected identity or response shape is absent.
7. When code `8`, a transport failure, or an unresolved/empty server-side lookup persists, repeat the same bounded read-only request through the signed browser flow or one deliberately different network. If the browser/residential request succeeds while the server request fails, classify the incident as transport/egress behavior rather than proof of empty history.
8. Do not rotate credentials, repeatedly hammer the provider, or mutate the stored profile snapshot during that comparison. Keep the last coherent verified snapshot and its timestamp.
9. If a complete raw detail was already saved locally for an authorized operation, use that evidence instead of requiring another provider fetch. Verify its provider ID, numeric game ID, full identities, and timestamp before relying on it.

A network-switch result is diagnostic evidence, not a permanent architecture. Prefer the signed browser flow, bounded retry/backoff, and explicit failure reporting over silently depending on a hotspot.

### Historical inhouse discovery

- Start historical discovery with the read-only `report-engine` command documented in `report-engine/BACKFILL_DISCOVERY.md`; do not begin by automating the operator's normal browser.
- Use a local ignored player config containing the exact full Riot IDs and date bounds. The committed example must remain synthetic.
- Treat transport errors and incomplete player-history coverage as an incomplete scan, never as proof that no games exist.
- Review tournament exclusions and candidate roster coverage before promoting any provider game ID to an import plan.
- Discovery writes local JSON/CSV evidence only. It must not connect to the ECL database, claim report jobs, create ranked rows, or apply LP.
- Provider payloads and player identities in the output are private operational evidence. Keep them ignored and never commit or paste unrestricted artifacts into logs, issues, or chat.

### Interactive custom-game lookup

Use `/hub/search-engine` when an operator remembers a player/date/champion but
does not yet have the provider game ID. This is the lookup phase only; do not
open the tournament admin page until a candidate has been independently
reviewed and an authorized result workflow has been selected.

1. Enter the player's exact full Riot ID, selected China server, and approximate
   China date. Add champion and opposing-player clues only when known.
2. Review the bounded scan summary. An unavailable filter/detail is a provider
   failure, not evidence of empty history.
3. Accept only a candidate marked as structured `CUSTOM_GAME` whose highlighted
   searched player has the expected full Riot identity. Review both five-player
   teams and all optional clue badges.
4. Copy the opaque provider game ID only into ignored/private operational
   evidence. It is not a numeric League Game ID.
5. Stop after discovery unless the user separately authorizes the applicable
   tournament or ranked-result workflow. The finder itself never writes ECL
   data, applies LP, queues KOOK, or publishes a result.

### Completed ranked-inhouse backfill from 2026-11-12

The reviewed five-game recovery completed under operation marker `ranked-inhouse-backfill-2026-11-12`; its one-off endpoint, import library, and client were removed after verification. Keep the private manifest and apply/post-verification audits in ignored operational storage. Do not recreate or generalize the removed write path for another incident.

Recovery must preserve history. Freeze further ranked writes, inspect only sessions and `MatchGame.ocrRawJson` carrying that exact operation marker, and either restore the confirmed backup or run a separately reviewed reverse/replay transaction that removes only those operation rows and recomputes every affected player from remaining season stats. Never hand-edit LP or delete rows ad hoc.

### Report-engine deployment configuration

- Keep provider tokens, cookies, worker secrets, and login material only in ignored local configuration or the deployment environment.
- Check a configured worker token without exposing it with `node worker.js --lzyumi-token-status`; the command prints only the provider code, authentication classification, and account `endTime`.
- Seed a dedicated persistent browser session with `node worker.js --lzyumi-login-manual`, or configure login credentials in the worker's secret environment and run `node worker.js --lzyumi-login`. Never copy the resulting token, cookies, or browser profile into logs, chat, or tracked files.
- In non-`direct` mode, provider codes `6` and `8` may trigger the authenticated browser fallback. Code `6` permits one bounded session recovery; code `8` remains an ambiguous provider/network failure and is not proof that credentials expired.
- Use the supported names in `.env.example`, including `REPORT_ENGINE_LZYUMI_HISTORY_CONCURRENCY`, `REPORT_ENGINE_LZYUMI_CODE_7_RETRIES`, and `REPORT_ENGINE_LZYUMI_CODE_7_BACKOFF_MS`; keep concurrency conservative and retries bounded.
- Keep `REPORT_ENGINE_LZYUMI_DISCOVERY_MODE=legacy` as the rollback setting. Enable `bounded` only in an isolated preview/test runtime first, with explicit `REPORT_ENGINE_LZYUMI_HISTORY_REQUEST_LIMIT`, `REPORT_ENGINE_LZYUMI_DETAIL_REQUEST_LIMIT`, and `REPORT_ENGINE_LZYUMI_PRESSURE_COOLDOWN_MS` values. Compare sanitized history/detail request counts and selected-candidate classification before rollout; never include identities, provider game IDs, `openId`, or raw payloads in that evidence.
- For a confirmation-flow release, deploy backward-compatible worker support before enabling web code that queues the new confirmation state.
- Before production, run report-engine tests and a read-only known-player probe. Do not use a real `!yes` or shared-database mutation as the first smoke test.

## High-risk operations

The following require explicit approval naming the target environment and operation:

- deployment, rollback, publishing, merging, or pushing;
- shared/staging/production database writes;
- scripts containing `apply`, `backfill`, `repair`, `reset`, `release`, or `sync`;
- Prisma schema application outside a disposable local database;
- tournament opening/closing, roster correction, fixture/result changes, or ranked-season reset;
- KOOK announcements, role/channel changes, or messages to real users;
- companion signing/update publication.

Before an approved data operation, capture a read-only preflight, affected-row estimate, idempotency behavior, backup/recovery path, and post-operation assertions. Prefer a dry run and transaction where possible.

## Inhouse report incident checklist

- Confirm the saved session exists, is in the expected state, and has the intended ten-player roster.
- Confirm the reporter's stable KOOK ID is linked to an active verified profile.
- Confirm each provider identity uses the expected full Riot ID, server, and `openId`.
- Check the candidate game's time window and roster coverage.
- Check whether the provider game ID or session is already completed before retrying.
- Do not manually edit LP first. Determine whether match/game/stat writes are complete or partial, then use a reviewed repair plan.
- Separate “provider found the game,” “preview delivered,” “confirmation queued,” “confirmed result committed,” and “KOOK result delivered”; they are different checkpoints.
- A KOOK/API 30-second timeout is not proof that the provider lookup or database commit failed. Check the durable report job, session status, linked match/game, ten stat rows, and LP linkage before retrying or cancelling.
- Treat repeated `!report`/`!yes` as retries of the same durable work. They must not create another result or apply LP twice.
- If the session is already `COMPLETED`, do not reopen or cancel it merely because KOOK missed the final reply; repair notification/operations state separately if needed.

## Manual Split II tournament results from Codex

Use this recovery workflow when a completed Split II tournament match cannot be collected automatically and the operator wants Codex to publish it manually. This is a tournament-result operation, not a ranked-inhouse import: it must never create ranked sessions, match games, player LP changes, or legacy inhouse rows.

### What the operator should provide

- Fixture code, such as `RR02`, and game number for a multi-game series.
- Exact numeric League Game ID. If it is unavailable, provide the opaque Lzyumi provider game ID plus a previously collected, verified detail snapshot; never invent or relabel an opaque ID as numeric.
- Winner, China-time completion timestamp, and duration.
- The actual ten-player lineup. Prefer full Riot IDs from the tournament roster; identify registered floaters and owner-approved last-minute guest substitutes explicitly.
- A WeGame/post-game screenshot or a previously collected Lzyumi detail snapshot.
- When available: K/D/A, numeric champion ID, seven item slots (`0` for an empty slot), champion damage, gold, position, and one winning-team MVP.

The current tournament payload and result modal support champion, items, K/D/A, damage, gold, position, and MVP. They do not have dedicated fields for SVP, level, CS, runes, summoner spells, or WeGame rating. Preserve unsupported values in the private audit/evidence when useful, but do not invent fields or overload MVP.

If provider evidence and the registered full Riot ID disagree, stop and reconcile the identity explicitly. A manual result may attach verified match statistics to the already selected tournament profile, but it must not silently rewrite the player's durable profile identity. Record any approved alias reconciliation in the operation audit. An unregistered player may be recorded only as an explicitly owner-approved guest substitute keyed by platform and full Riot ID; this must not create an ECL account or ranked player record.

### Required workflow

1. Confirm explicit authorization for the named environment and exact fixture(s). A request to inspect or diagnose a result is not authorization to publish it.
2. Read the live tournament view with admin visibility. Resolve the fixture, both teams, and all ten players to their stable tournament `profileId` values; never persist display-name-only matching.
3. Check the numeric League Game ID, or the private Lzyumi provider ID fallback, across current tournament reports, non-cancelled report jobs, legacy `MatchGame` payloads, and `InhouseSession.lzyumiGameId`. Abort on any ranked/legacy collision.
4. Validate five players per fixture team, the winner, K/D/A totals, timestamp, duration, MVP side, and every optional field against the supplied evidence. Resolve normal players to stable registered `profileId` values. Record an approved unregistered substitute as a tournament-only guest identity and mark it `SUB`; do not map it to another person's profile. Missing or unverified optional fields stay absent.
5. Run a read-only dry run first. Print a bounded summary and fingerprint of the current reports, fixture/roster identities, duplicate checks, and exact proposed payload. Do not print provider tokens, cookies, `openId` values, raw signed URLs, or unrestricted provider payloads.
6. Apply only with the immediately preceding fingerprint. Create the report through `submitTournamentReport`, then publish it through `reviewTournamentReport`; never edit an approved report row directly.
7. For a correction, submit a new report with `replacesId` pointing to the current approved report. Approval must atomically mark the old report `REPLACED` and the correction `APPROVED`.
8. Default Codex recovery operations to `{ notify: false }`. Sending a KOOK result message requires separate explicit authorization. Tournament approval must report `lpApplied: false`.
9. Write an ignored local audit containing the fingerprint, old/new report IDs, before/after standings, identity reconciliation, duplicate checks, notification result, and recovery instructions.
10. Verify the public `/api/tournaments/split-ii/matches` response: exactly one `APPROVED` report for the game, correct fixture/result/player fields, substitute labels where applicable, no private provider ID, and no stale approved predecessor. Independently confirm that no KOOK notification or ranked/legacy row was created.

### Reusable read-only preflight

`scripts/preflight-split-ii-result.ts` performs the reusable portion of steps 2–5 without calling Lzyumi and without exposing an apply mode. Start from the sanitized shape in `scripts/split-ii-result-manifest.example.json`, place the real manifest in an ignored local directory such as `.tmp/`, and validate its structure first:

```powershell
npx tsx scripts/preflight-split-ii-result.ts `
  --input=.tmp/split-ii-result.json `
  --validate-only
```

After explicitly selecting/configuring the intended read-only database target, omit `--validate-only` to resolve the live fixture and all ten full Riot IDs, verify each registration snapshot against its current Ionia profile, `openId`, and `gameIdentityKey`, distinguish roster members from registered floaters, check prior floater appearances, and search tournament reports, active report jobs, legacy/ranked `MatchGame` payloads, and `InhouseSession.lzyumiGameId` for collisions:

```powershell
npx tsx scripts/preflight-split-ii-result.ts `
  --input=.tmp/split-ii-result.json `
  --target=production-read-only
```

The manifest normally supplies `leagueGameId`. For the verified Lzyumi-only fallback, set `leagueGameId` to `null`, supply `providerId`, and mark each approved unregistered player with `guestSubstitute: true`. The required `--target` value is a non-secret audit label; it does not select or weaken the configured database credential. The command prints a bounded summary, blockers/warnings, duplicate-check booleans, invariants, and a state fingerprint. It never prints the raw manifest identities in its normal summary, never requests provider data, never queues KOOK, and rejects `--apply`. A clean result is evidence for review, not authorization to publish; use a separately reviewed fixture-specific submit/review operation with the immediately preceding fingerprint.

Recovery is another tournament correction replacing the current approved report. Never repair a tournament result by changing ranked LP or deleting historical report rows. Preserve `REPLACED` reports as the audit trail.

## Profile refresh incident checklist

- Test `/api/lzyumi-sign` and the browser-side request before concluding that a companion app is required.
- Inspect which filters succeeded and whether the response resolved the same full Riot ID/server/`openId`.
- Keep the prior verified snapshot and timestamp on failure.
- If optional recent champion data fails, do not let stale champion data appear newly refreshed.

## Documentation upkeep

Update the appropriate canonical document in the same change when any of these move:

- user journey/navigation/product rule → `PRODUCT.md`;
- runtime, ownership, trust boundary, durable flow → `ARCHITECTURE.md` and possibly an ADR;
- endpoint/provider/bot contract or failure policy → `INTEGRATIONS.md`;
- setup, verification, diagnostics, or operational safety → `RUNBOOK.md`.

Add a dated release/handoff note only for event-specific operational history. Do not turn dated notes into the only place where current architecture is explained.
