# ADR 0001: Use Lzyumi as the primary China-server data provider

- Status: Accepted
- Date: 2026-11-07

## Context

ECL needs China-server Riot identity, rank, history, and match details. Earlier workflows leaned on local WeGame/League access and the Windows companion because cloud access to China services is unreliable. The project now has an operational Lzyumi token flow and a signed browser path that can use the player's residential IP.

## Decision

Use Lzyumi as the primary external provider for ordinary profile/rank/history refreshes and as the primary match-data path when configured. Use `/api/lzyumi-sign` plus a browser fetch for player-facing refreshes when cloud IP blocking applies.

Accept data only after verifying full Riot ID, China server, and `openId`. Save coherent snapshots, and treat optional recent champion statistics separately. Retain bounded, explicit fallbacks such as WeGame or the companion for workflows where Lzyumi is unavailable or insufficient; do not make the companion a blanket prerequisite.

## Consequences

- The product can refresh common profile data without requiring every player to install an app.
- Browser and worker flows have different network/trust characteristics and must remain explicit.
- Provider tokens, signed URLs, raw payloads, and identity mismatches need strict handling.
- Provider changes/throttling remain an operational dependency, so verified last-known data and honest freshness are required.
- Fallback code must not silently merge or override data from a different identity/source.
