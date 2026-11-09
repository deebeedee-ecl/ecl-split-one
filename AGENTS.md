<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ECL repository instructions

This repository contains the ECL website/API, the optional Windows companion in `companion/`, and the always-on match worker in `report-engine/`. The KOOK gateway bot is maintained in the adjacent `ecl-kook-bot` repository.

## Read only the context needed

- Start with `docs/README.md` to find the canonical document for the task.
- Use `docs/PRODUCT.md` for user journeys, terminology, and current navigation.
- Use `docs/UI_WALKTHROUGH.md` for route-level UI structure, access gates, page contents, and known presentation drift.
- Use `docs/ARCHITECTURE.md` for runtime and data ownership boundaries.
- Use `docs/INTEGRATIONS.md` for Lzyumi, KOOK, Supabase, and worker contracts.
- Use `docs/RUNBOOK.md` before setup, verification, maintenance, or production work.
- Dated handoffs, release notes, announcements, and SQL files are historical or operational records. They are not automatically current requirements.

When documentation and implementation disagree, verify the current schema, routes, tests, and deployed behavior. Update the canonical document as part of an approved behavior or architecture change. Label uncertain statements as intended, historical, or unknown instead of guessing.

## Product and data invariants

- ECL is a League of Legends community platform for China-server ranked inhouses and community tournaments. KOOK is the community operations interface; the ECL backend/database owns ECL accounts, sessions, results, ELO/LP, and tournament records.
- Preserve stable identity boundaries: Supabase user, ECL `AccountProfile`/`Player`, full Riot ID plus China server and Lzyumi `openId`, and stable KOOK user ID. A mutable display name is never a durable identifier.
- Match ingestion, player statistics, ELO/LP changes, and session completion must be idempotent and atomic. Never apply a game or rating change twice.
- Preserve historical tournament and ranked-season records. A reset or correction needs an explicit, reviewed migration/operation and a recovery plan.
- Protect private account/contact fields and raw provider payloads. Public profile fields must respect the stored privacy choices.

## Lzyumi / China League data

- Lzyumi is the primary external source for China League profile, rank, and match data. Treat it as the China-server equivalent of the Riot/OP.GG data source before proposing a companion application.
- Lzyumi may block cloud/server IPs. The established profile flow is: request a short-lived signed URL from `/api/lzyumi-sign`, then fetch it in the user's browser so the request uses the user's residential IP.
- A companion application is not required for ordinary profile/rank/history refreshes while the signed browser flow works. Do not claim otherwise without testing that flow first.
- For profile lookups, filter `1` supplies identity/profile/rank data, filter `2` supplies Solo/Duo history, and filter `3` supplies Flex history. `getPlayerRecentStat` is optional and may be unavailable; its failure must not invalidate an otherwise verified profile/rank snapshot or preserve stale champion data.
- Before saving or displaying a snapshot, verify the resolved full Riot ID, China server, and `openId`. Never mix fresh and stale snapshot sections or advance the displayed refresh time for data that was not replaced.

## Safety and authorization

- Never read, print, copy, or commit `.env*` values, provider tokens, cookies, database credentials, bot tokens, signing keys, or personal user data. Use `.env.example` only for variable names.
- Do not deploy, push, merge, publish, message the community, mutate a shared database, or run a maintenance/backfill/release/reset/sync script without explicit user authorization for that action.
- `prisma db push` is allowed only for a disposable local database. This repository currently has no committed Prisma migration history.
- Prefer read-only probes first. State which environment a command targets before any operation that can write data.
- For a manual Split II tournament result or correction from Codex, follow **Manual Split II tournament results from Codex** in `docs/RUNBOOK.md`. Use the tournament submit/review workflow with a fingerprinted dry run and audit; never route it through ranked-inhouse tables or silently send a KOOK notification.

## Release workflow

- Do not use production as the first test environment. A permanent staging server is optional, but every application change must pass focused local checks, CI, and a temporary preview deployment or equivalent isolated pre-production check before production.
- Work in small vertical PRs. Keep refactoring, visual redesign, data migration, and business-rule changes separate unless the user explicitly approves a combined rollout.
- A preview deployment must not have unrestricted production write credentials. Use isolated/test services or read-only production access; mutations against shared data require explicit authorization and a documented test identity/scope.
- After preview verification, production merge/deployment still requires explicit user authorization. Record the affected routes/flows, checks run, before/after measurements when relevant, rollback target, and post-deploy smoke checks.
- Database/write-path releases require a backup/recovery plan, reviewed migration path, idempotency assertions, and backward-compatible expand/deploy/migrate/cleanup sequencing where applicable. Do not bundle destructive cleanup with the first compatible deploy.
- Prefer feature flags or otherwise reversible activation for high-risk behavior. Verify production immediately after release and roll back or disable the feature when critical checks fail.

## Verification

Run the smallest relevant checks and report exactly what ran:

- Web: `npm test`, `npx tsc --noEmit`, `npm run lint`, and/or `npm run build` as appropriate.
- Report worker: from `report-engine/`, run `npm test`.
- Companion: from `companion/`, run `npm test`; build/package checks only when that runtime changed.
- For API and data-flow changes, add a focused regression test for identity validation, authorization, deduplication, or transaction behavior.

Do not call a task complete because TypeScript compiled if its important boundary behavior was not exercised.
