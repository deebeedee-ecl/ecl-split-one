---
name: ecl-manual-inhouse-import
description: Find, review, preflight, and, only after explicit authorization, import missing China-server ranked inhouse custom games into ECL. Use when asked to compare player Lzyumi histories with ECL or add inhouse matches played outside the KOOK lifecycle. Do not use for tournament results or matches already handled by KOOK.
---

# ECL Manual Inhouse Import

Use the permanent reviewed workflow. Do not create a new dated endpoint, one-off database script, or direct LP edit.

## Canonical procedure

Before acting, read **Manual ranked-inhouse import** in `docs/RUNBOOK.md` and `report-engine/BACKFILL_DISCOVERY.md`. Read `docs/INTEGRATIONS.md` only when the endpoint, credential boundary, or worker contract may need to change.

## Inputs and scope

Obtain or infer only what the requested scope needs:

- exact full Riot IDs for the supplied history sources;
- a bounded China-date window;
- whether the owner approves excluding unregistered filler participants;
- optional reviewed provider game IDs or roster clues.

Player tags are discovery inputs, not durable ECL identity keys. Verify resolved full Riot ID, China server, and Lzyumi `openId` before accepting evidence. Do not treat an unresolved provider response as empty history.

## Workflow

1. Run local read-only discovery from `report-engine/`. Do not give discovery database credentials. Keep raw provider JSON, identities, and provider IDs only in ignored `report-engine/inhouse-discovery-*` files.
2. Review structured `CUSTOM_GAME` details, both teams, date coverage, and tournament exclusions. Merge only non-conflicting complementary detail variants. Reject provider failures, identity drift, and tournament evidence.
3. Select exact provider game IDs in an ignored review file based on `report-engine/manual-inhouse-import-review.example.json`. Record the exact authorized unknown-filler count and any reviewed `KIWI` override.
4. Prepare the immutable manifest with `npm run inhouse:import:prepare`. Never overwrite an earlier manifest or audit.
5. Run `npm run inhouse:import -- --preflight` against the permanent production endpoint through the report-engine environment. Keep worker credentials inside that process and report only the bounded plan.
6. Compare the plan with ECL state: new versus existing games, excluded participants, affected players, inserted stat rows, replayed later stats, and projected LP deltas. Stop on every blocker or collision.
7. Apply only when the current conversation already contains explicit production authorization for the exact reviewed scope, or after obtaining it. Use the immediately preceding clean fingerprint, `--approved-production`, and a new ignored audit path. Notifications remain off.
8. Re-run preflight after apply. Every selected game must be existing, with zero inserts, zero stat changes, and zero LP delta. Separately verify the production inhouse archive and ladder.

If the user asks only to find, compare, review, or preflight, stop before apply. Authorization to investigate is not authorization to mutate production.

## Fillers and identity

Unregistered fillers may be excluded only when the owner explicitly approves that policy for the batch. Never create an ECL account, `Player`, stat row, or LP change for an excluded filler. Registered participants must resolve through stable stored identity; a mutable display name is insufficient.

## Stop conditions

Stop without applying when any of these is true:

- a candidate is not a verified custom game or may be a tournament game;
- the Riot identity, China server, or `openId` is unresolved or conflicting;
- provider evidence is partial without the exact reviewed override;
- an existing provider-game collision is incoherent or foreign;
- the fingerprint is stale, the manifest changed, or the bounded scope is invalid;
- the permanent endpoint or dedicated worker credential is unavailable.

Do not weaken a blocker to finish the batch. A rollback is a separately reviewed reverse/replay operation scoped to the recorded batch, never ad hoc deletion or LP editing.

## Completion report

Report the batch ID and bounded counts: selected, existing, inserted, excluded fillers, stat rows, affected players, and post-apply zero-delta preflight. State whether archive and ladder checks passed. Never print secrets, raw provider payloads, private identities, or unrestricted audit contents.
