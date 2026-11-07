# ADR 0002: Keep the KOOK bot a thin community adapter

- Status: Accepted
- Date: 2026-11-07

## Context

KOOK is the primary community interface for onboarding and ranked-inhouse commands. The gateway process must handle KOOK-specific events, voice membership, messages, and moves, but duplicating eligibility, balancing, report, or LP rules in the bot and website would create drift and unsafe retries.

## Decision

The adjacent KOOK bot owns transport and KOOK-native side effects. It calls authenticated ECL APIs for verification, account/ladder queries, inhouse eligibility and balancing, session persistence, report orchestration, and result submission. The ECL website/API owns domain validation and durable state transitions.

Public help text, parser aliases, and API routing must be deliberately synchronized. Durable authorization uses stable KOOK user IDs, not usernames.

## Consequences

- Business rules can be tested close to the database and shared by web/admin/KOOK flows.
- The bot remains deployable independently and can retry transport operations.
- ECL APIs must return enough structured instructions for KOOK-native actions.
- A compromised bot secret is still material; APIs must enforce business authorization and resource state in addition to service authentication.
