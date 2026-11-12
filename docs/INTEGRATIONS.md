# ECL integration contracts

Last reviewed: 2026-11-13

This document records responsibilities and invariants, not credentials. Supported variable names live in `.env.example`; real values stay outside version control.

## Lzyumi

Lzyumi is ECL's primary external provider for China-server Riot identity, rank, match history, and match details.

### Profile/rank/history flow

- The server signs a short-lived request through `/api/lzyumi-sign`.
- The authenticated player's browser fetches that URL so a provider that blocks cloud IPs sees the residential connection.
- Opening another player's public profile renders the last verified snapshot and timestamp without signing or sending Lzyumi requests from the viewer's browser. The current automatic browser refresh is limited to the authenticated user's own profile until the explicit manual-refresh contract and its server-side request budgets are available.
- Filter `1`: resolved identity/profile/rank.
- Filter `2`: Solo/Duo history.
- Filter `3`: Flex history.
- Browser signing uses `/lzyumi/lol/info` for profile/history, `/lzyumi/lol/info/getPlayerRecentStat` for optional recent stats, and `/lzyumi/lol/info/findOrderDetailInfoAll` for match detail.
- Profile and history success requires HTTP success, endpoint application code `1`, and the expected object/array shape. HTTP errors, malformed payloads, and application codes `6`, `7`, or `8` are provider failures, never valid empty history.
- `getPlayerRecentStat`/champion recency is optional. It requires its own code-`1` object contract; failure must result in an explicit unavailable section, not retained stale champion data presented as fresh.

Acceptance requires matching the expected full Riot ID, China server, and `openId`. Save profile/rank/Solo/Flex as one coherent snapshot only after every required response passes validation. A rejected replacement preserves the prior snapshot and timestamp; do not independently advance freshness for an unchanged section. Application-code semantics are endpoint-specific and must not be copied to token/session-status endpoints.

### Match-report worker flow

The report engine is an always-on service used after KOOK queues a report job. It loads the saved ten-player session roster, searches recent games, fetches details, checks time/roster coverage, and sends candidate evidence back to the website. The website owns result authority and the database commit.

The optional bounded Lzyumi discovery mode fetches history filters incrementally with concurrency capped at two, deduplicates opaque provider game IDs, and applies the session window and already-reported checks before detail lookup. Observed `battleTypeInfo` values are only a history prefilter: acceptance still requires detail `gameType === CUSTOM_GAME`, verified Riot identity/server/`openId`, roster coverage, and the existing website-side duplicate validation. History and detail calls have separate hard request ceilings, details are fetched sequentially until one candidate passes, and provider codes `7`/`8` start a short in-process cooldown. Keep `legacy` as the immediate rollback setting until a controlled full KOOK golden-path canary records a correct preview, one confirmed 10/10 ingestion, and the next-session transition; activation or an isolated provider probe alone is not rollout verification.

After the website presents a candidate, `!yes` acknowledges quickly and queues durable confirmation work instead of holding the KOOK request open for the complete ingestion. The report engine claims that confirmation job and submits the saved candidate to the website. The website revalidates the actor, session, roster, time window, provider game ID, and duplicate state before committing. Duplicate `!yes` commands must converge on the same job/result.

The worker supports a configurable source and retains a WeGame path, but Lzyumi is the primary/default provider when its token flow is configured. Lzyumi provider application code `7` is treated as throttling/transient pressure and uses bounded retry/backoff with conservative concurrency.

When a configured Lzyumi API token is rejected, a non-`direct` worker may fall back to the provider's authenticated browser page. History and detail calls run through that page so its dedicated persistent profile supplies the provider session without returning the token to ECL code or logs. Provider code `6` means the browser must log in again and permits one bounded session refresh; code `8` may select the browser fallback but is treated as a provider/network failure rather than definitive login evidence. Browser page-flow requests are serialized because the provider page keeps lookup state in shared DOM controls.

The verified match contract exposes provider game ID, history title/time, structured game type/mode, participants, teams, and match statistics. The current Lzyumi payload does not expose the human-entered custom-lobby name. Labels such as `IH #072` belong to the ECL session and are linked to the provider game; a localized history `title` is not a lobby name.

Never place a token, cookie, login, signed URL, provider response containing player data, or local browser profile in a tracked file.

## KOOK

### Ownership split

The adjacent `ecl-kook-bot` process owns the KOOK gateway connection, parses messages, reads voice membership, sends replies, and moves users between voice channels. The website/API owns verification, eligibility, balancing/session persistence, report jobs, results, and LP.

The bot should remain a thin adapter. Domain behavior belongs in tested web libraries/routes or a deliberate service boundary, not duplicated in `bot.js`.

`!ready` is timeout-safe across the website/KOOK boundary. Once the website has persisted an assigned session, a repeated `!ready` returns move instructions reconstructed from that saved Blue/Red roster instead of creating another session. The bot may retry those KOOK voice moves because moving the same user to the same saved destination is idempotent. An empty move list must never be reported as a successful move, and KOOK HTTP success is insufficient unless the KOOK response also carries application code `0`.

### Authentication

KOOK service calls use the `x-ecl-kook-secret` header and `ECL_KOOK_BOT_SECRET`. Missing configuration must fail closed. Do not log the header or expose it to browser code.

Relevant API groups include:

- `/api/kook/verify` for code confirmation and stable KOOK linkage;
- `/api/kook/commands` for account/ladder/status/report command handling;
- `/api/kook/inhouse` for roster checking and team balancing;
- `/api/kook/inhouse/report` for confirmed result ingestion;
- `/api/kook/tournaments/*` for tournament-facing operations.

### Public command vocabulary

The currently communicated player commands are `!help`, `!verify`, `!me`, `!rank`, `!leaderboard`, `!inhouse`, `!ready`, `!status`, `!report`, `!no`, `!yes`, and `!welcome`; admin operations include force-ready and cancel. The bot also recognizes aliases/internal diagnostics in code. Keep the public help message, bot parser, and API command routing synchronized.

Use stable KOOK user IDs for authorization and linkage. Usernames and channel names are presentation. Channel/user IDs belong in environment configuration, not canonical docs or hard-coded new logic.

### Verification codes

Current web code generates a random `ECL-` code, expires it after 24 hours, and prevents reuse by another account after confirmation. Treat the code like a short-lived password, even if onboarding currently asks users to type it in a public verification channel.

## Supabase Auth

The web and companion use Supabase for player authentication. Only the public anon/publishable key is browser-safe. A service-role key must never use a `NEXT_PUBLIC_*` name or be packaged into the companion.

Authentication establishes the Supabase user. Application routes must then load the corresponding ECL account/profile and enforce resource ownership or role-specific authorization.

## PostgreSQL and Prisma

`prisma/schema.prisma` describes the current expected schema. It is not a deployment history: the repository currently lacks committed Prisma migrations. `prisma db push` is for a disposable local database only.

Any result/LP correction, merge, backfill, season reset, or tournament release can affect historical data and requires an explicit environment, preview, approval, transaction/recovery design, and post-check.

## Report engine

`report-engine/` polls trusted job endpoints using a worker/job secret. It may read provider credentials from its deployment environment or ignored local environment file. It must not be the final authority for an ECL result: the website revalidates and owns the commit.

Provider concurrency and retry controls use the supported `REPORT_ENGINE_LZYUMI_*` variable names in `.env.example`. Keep production values in deployment configuration, use conservative bounded settings, and never copy tokens or cookies into documentation.

Before a worker deployment, verify its unit tests and a read-only known-player probe. A successful provider lookup does not prove that final `!yes` ingestion is atomic or idempotent.

Malformed Lzyumi history responses are provider failures, not evidence that a game or roster is invalid. The report worker refreshes its browser session and retries them once, may continue when other validated history filters remain usable, and logs only response shape metadata (`code`, top-level keys, and data type). It must never log raw provider payloads, tokens, cookies, `openId` values, or player identities as part of this diagnostic path.

## Windows companion

The Electron companion remains a supported optional runtime for local collection/desktop workflows and historical pilots. An earlier ranked-inhouse reporting pilot required one of the ten participants to run the companion so it could observe the League client and collect a custom-game ID. That is historical behavior: the current Lzyumi-based ranked-inhouse report flow does not require the companion while the provider flow works.

Companion release work has additional signing, updater, packaging, and private-data constraints in `companion/README.md` and `docs/desktop/`. Treat dated tester/release documents as historical checkpoints.

## Failure behavior

| Failure | Required behavior |
| --- | --- |
| Provider unavailable/throttled | Preserve the last verified snapshot with its original timestamp; show refresh failure |
| Identity/server/openId mismatch | Reject the replacement; do not partially save it |
| Optional champion-stat failure | Keep valid identity/rank/history only; clear/mark the unavailable optional section |
| KOOK/worker secret missing or wrong | Return unauthorized; never fall back to public access |
| Duplicate game/report retry | Return the existing completion or no-op; never apply LP twice |
| Partial database failure | Roll back the entire logical result transaction |
| KOOK reply/move fails after ECL write | Preserve durable ECL state and expose a retryable delivery/operations path |
| KOOK/API request times out while background work continues | Do not infer result failure from the transport timeout; inspect the durable job/session and committed match state before retrying or cancelling |
