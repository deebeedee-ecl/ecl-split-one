# ADR 0003: Make the ECL backend the competitive source of truth

- Status: Accepted
- Date: 2026-11-07

## Context

ECL consumes authentication from Supabase, community identity/events from KOOK, and China-server match evidence from external providers. None of those systems models ECL-specific balanced sessions, tournament policy, result confirmation, or LP history.

## Decision

The ECL backend and PostgreSQL database are authoritative for ECL accounts/profile linkage, inhouse sessions and frozen rosters, accepted match results, player statistics, LP/ELO, ranked seasons, and tournament records.

External systems provide authenticated identity or evidence. Before a durable transition, the backend validates the actor, expected identity, current resource state, provider evidence, and deduplication key. A logical result transition must commit atomically and be safe to retry.

## Consequences

- KOOK messages and provider responses are inputs, not final records.
- Rebuilding projections and redelivering messages is possible from durable state.
- Result ingestion needs database uniqueness/transactions and auditable override paths.
- Corrections and season resets are explicit ECL operations with recovery and history preservation.
