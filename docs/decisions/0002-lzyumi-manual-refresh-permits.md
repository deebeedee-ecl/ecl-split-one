# ADR 0002: Gate manual Lzyumi refreshes with durable permits

- Status: Accepted
- Date: 2026-11-13
- Amended: 2026-11-24
- Tracking: GitHub issues #62 and #4

## Context

Opening another player's public profile no longer starts an implicit Lzyumi refresh. ECL still intends to let an authenticated user explicitly refresh a stale public profile through a residential browser, but the signed request URL authenticates only the request parameters. Lzyumi does not provide a server-verifiable signature over the browser response, so ECL cannot prove that a viewer did not alter rank/history data before submitting it for another profile.

That explicit action needs both per-profile and per-requester pressure controls. An in-memory limiter is not sufficient in a serverless web runtime because concurrent instances and restarts would not share it. The existing `LzyumiRefreshQueue` is also not the correct store: it owns scheduled cloud refresh leases, has one row per target profile, and has no requester identity or one-use browser-permit lifecycle.

The reviewed Prisma baseline and metadata-table privilege lock are active. The dedicated permit ledger is therefore delivered as its own additive migration and remains inert until its schema and explicit rollout configuration are available.

## Decision

### Authorization and eligibility

- Only an authenticated ECL profile may request a permit.
- The storage/API slice is owner-only: the requester profile ID must equal the target profile ID at issuance and again at consumption. A pre-existing or manually inserted viewer-bound permit is rejected without changing the target snapshot or timestamp.
- Viewer refresh remains an intended later capability, but it requires a reviewed provider-attestation or equivalent trusted-response design. A browser-generated hash or the existing signed request URL is not sufficient.
- The target must be active, verified, stale under the existing snapshot-freshness rule, and have a complete stored full Riot ID, China server, and `openId`.
- The server loads the target identity. Browser-supplied Riot identity, server, `openId`, freshness, cooldown facts, or requester counts are never authoritative.

### Durable pressure controls

- A permit ledger, not process memory, supplies the latest target-profile issue time, latest requester issue time, and requester rolling-window count.
- Issuance enforces a per-profile cooldown, a per-requester cooldown, and a per-requester rolling-window maximum.
- Exact production durations and limits are rollout configuration. They must be selected and recorded before the storage/API implementation is enabled; this contract fails closed for missing, zero, negative, non-integer, or incoherent policy values.
- The reviewed initial rollout values are: two-minute permit TTL, five-minute target cooldown, one-minute requester cooldown, 24-hour requester window, and 20 permits per requester per window. The endpoint remains disabled until those values are separately configured in the target environment.
- The eligibility check and permit insert occur in one serialized transaction. The implementation must lock both the target-profile and requester scopes, or provide equivalent uniqueness/serialization guarantees, so concurrent instances cannot each issue a permit.

### Permit scope and lifecycle

- One permit is bound to one requester profile and the same owner target profile.
- One issuance authorizes a fixed browser bundle only: profile/rank filter `1`, Solo/Duo filter `2`, Flex filter `3`, one optional recent-stat request, and one coherent snapshot-save attempt.
- The issuance endpoint should construct that bundle from stored target data. It must not accept browser-selected filters, counts, server, Riot ID, or `openId`.
- A permit is short-lived and one-use. Planned states are `ISSUED`, `COMPLETED`, `REJECTED`, and `EXPIRED`.
- Store only a hash of the opaque permit secret. Never persist or log the raw token, signed provider URLs, provider payloads, `openId`, or player identities as permit diagnostics.
- Completion is bound again to the authenticated requester and target. An expired, mismatched, completed, or rejected permit fails closed.
- A coherent accepted snapshot and the conditional `ISSUED -> COMPLETED` transition commit atomically. A validation failure preserves the existing snapshot/timestamp and transitions the permit to `REJECTED` without making it reusable.
- An abandoned browser request expires naturally; its issuance still counts toward cooldown and rolling-window pressure controls.

### Proposed persistence shape

After issue #4 establishes the migration baseline, add a dedicated ledger rather than changing scheduled-refresh queue semantics. The reviewed schema should contain only the fields needed for authorization, replay protection, pressure queries, and sanitized outcome classification:

- opaque permit ID and unique token hash;
- requester profile ID and target profile ID foreign keys with retention-safe delete behavior so deleting a profile cannot erase a live cooldown/budget window;
- lifecycle status;
- issued, expiry, completion, and update timestamps;
- sanitized terminal classification with no raw provider error or payload;
- indexes for target issue time, requester issue time, requester rolling-window counts, and expiry cleanup.

Expired/terminal rows may be cleaned up only after every cooldown and rolling-budget window they enforce has elapsed and the reviewed operational audit interval has passed.

The storage/API PR must include concurrency tests against a disposable database or transaction-faithful fake. It must prove that simultaneous requests for the same target or requester cannot exceed the configured policy and that a permit cannot commit twice.

### API and rollout boundary

- The storage/API slice adds the dedicated ledger and authenticated issue/consume routes but no UI. It follows the reviewed expand/deploy/migrate sequence from `docs/RUNBOOK.md` and fails closed until its schema and policy configuration are available.
- The owner-only OP.GG-style UI is a separate PR after durable issuance and consumption are available. Viewer refresh is not enabled by this contract.
- Existing owner background refresh and scheduled/admin flows are unchanged by this decision. They must not be silently routed through the manual permit ledger.
- Disable the manual-refresh entry point as the first rollback. The additive ledger may remain inert until a later reviewed cleanup; rollback must not require deleting history.

## Consequences

- Manual owner refresh can be explicit and rate-limited across serverless instances without turning page view into an implicit scout action.
- Viewer refresh remains unavailable because browser transport alone cannot attest provider response contents. Enabling it requires a separate trust-boundary decision and regression coverage.
- The browser will still be able to inspect the external provider request and response because residential-browser transport is the reason for this flow. Security does not depend on hiding the provider.
- Issue #4 becomes a hard dependency for durable storage implementation, but contract and policy tests can be reviewed independently now.
- Existing scheduled refresh behavior is not overloaded with requester-specific semantics.
