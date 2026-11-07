# ECL development and operations runbook

Last reviewed: 2026-11-08

## Safe local start

1. Use Node.js 20.9+; Node.js 22 LTS is preferred.
2. Run `npm ci` at the repository root.
3. Copy `.env.example` to a local ignored environment file and populate only what the task needs. Never inspect or copy someone else's environment file into documentation or tool output.
4. For a brand-new disposable local PostgreSQL database only, run `npx prisma db push`.
5. Run `npm run dev` and use the local URL.

The root `README.md` has the fuller setup and environment-variable matrix. If its commands disagree with `package.json`, the current package scripts win and the README should be corrected.

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

### Release evidence

Every production handoff should state:

- PR/commit and affected runtime/routes;
- checks actually run and anything skipped;
- preview environment and smoke results;
- database/external side effects, or an explicit statement that there are none;
- before/after measurements for performance changes;
- production deployment authorization;
- rollback target and post-deploy verification result.

## Read-only diagnostics first

For an incident or integration change:

1. Identify the exact runtime and environment.
2. Reproduce with the smallest read-only endpoint/probe or a sanitized fixture.
3. Confirm identity keys (profile/player ID, full Riot ID, server, `openId`, stable KOOK ID) without exposing personal values in shared output.
4. Trace request → validation → durable state → external side effect.
5. Distinguish provider failure, ECL validation rejection, database failure, and KOOK delivery failure.
6. Only then propose a mutation, retry, backfill, or deployment.

Useful read-only worker probe syntax is documented in the root README. Provider probes may still expose personal/provider data, so use a known approved test identity and do not commit their output.

### Report-engine deployment configuration

- Keep provider tokens, cookies, worker secrets, and login material only in ignored local configuration or the deployment environment.
- Use the supported names in `.env.example`, including `REPORT_ENGINE_LZYUMI_HISTORY_CONCURRENCY`, `REPORT_ENGINE_LZYUMI_CODE_7_RETRIES`, and `REPORT_ENGINE_LZYUMI_CODE_7_BACKOFF_MS`; keep concurrency conservative and retries bounded.
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

## Profile refresh incident checklist

- Test `/api/lzyumi-sign` and the browser-side request before concluding that a companion app is required.
- Inspect which filters succeeded and whether the response resolved the same full Riot ID/server/`openId`.
- Keep the prior verified snapshot and timestamp on failure.
- If optional recent champion data fails, do not let stale champion data appear newly refreshed.

## Documentation upkeep

Update the appropriate canonical document in the same change when any of these move:

- user journey/navigation/product rule → the current product document when one is tracked;
- runtime, ownership, trust boundary, durable flow → `ARCHITECTURE.md` and possibly an ADR;
- endpoint/provider/bot contract or failure policy → `INTEGRATIONS.md`;
- setup, verification, diagnostics, or operational safety → `RUNBOOK.md`.

Add a dated release/handoff note only for event-specific operational history. Do not turn dated notes into the only place where current architecture is explained.
