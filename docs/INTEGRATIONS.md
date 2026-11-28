# ECL integration contracts

Last reviewed: 2026-11-27

This document records responsibilities and invariants, not credentials. Supported variable names live in `.env.example`; real values stay outside version control.

## Lzyumi

Lzyumi is ECL's primary external provider for China-server Riot identity, rank, match history, and match details.

### Profile/rank/history flow

- The server signs a short-lived request through `/api/lzyumi-sign`.
- The authenticated player's browser fetches that URL so a provider that blocks cloud IPs sees the residential connection.
- Opening another player's public profile renders the last verified snapshot and timestamp without signing or sending Lzyumi requests from the viewer's browser. On `/hub/me`, enabling manual refresh permits makes the explicit owner action own stale refresh; disabling the flag restores the legacy automatic owner refresh.
- Filter `1`: resolved identity/profile/rank.
- Filter `2`: Solo/Duo history.
- Filter `3`: Flex history.
- Browser signing uses `/lzyumi/lol/info` for profile/history, `/lzyumi/lol/info/getPlayerRecentStat` for optional recent stats, and `/lzyumi/lol/info/findOrderDetailInfoAll` for match detail.
- Profile and history success requires HTTP success, endpoint application code `1`, and the expected object/array shape. HTTP errors, malformed payloads, and application codes `6`, `7`, or `8` are provider failures, never valid empty history.
- Identity lookup uses a bounded cascade: bare Riot name, full `name#tag`, then saved-`openId` variants when available. A bare-name response is only a candidate until `battleInfo.nameInfoNew`, `areaId`, and `openId` prove the expected full identity. Lzyumi has been observed returning code `1` with `battleInfo: null` and `data: null` for the full ID while the bare name resolves the exact same `name#tag`; that response is `IDENTITY_NOT_FOUND`/`INCOMPLETE_LOOKUP`, not empty history.
- The authenticated owner's browser refresh receives at most five server-built identity attempts in that order: bare name, full ID, bare name plus the stored `openId`, full ID plus the stored `openId`, and stored-`openId` only. This applies to the permit-backed manual path and the flag-off legacy implicit path. The server adds stored identity data only for the authenticated owner's profile; the browser cannot choose another target identity. Solo/Duo and Flex provider requests start only after one attempt resolves the exact full Riot ID and China server, and their server-signed `openId` must match the resolved identity.
- Browser identity resolution reports one explicit terminal state: `RESOLVED`, `IDENTITY_NOT_FOUND`, `IDENTITY_MISMATCH`, `INCOMPLETE_LOOKUP`, `THROTTLED`, or `AUTH_FAILURE`. HTTP errors, malformed responses, code `8`, and exhausted mixed/incomplete attempts are `INCOMPLETE_LOOKUP`; they never become empty history. Code `6` is `AUTH_FAILURE` and code `7` is `THROTTLED` for these profile endpoints.
- `HISTORY_EMPTY` is valid only after identity resolution succeeded and the requested history endpoint returned a coherent empty array. Filter `1` may include localized custom-game history rows; `title` containing `新模式` is a discovery candidate only, and final custom-game acceptance still requires detail `gameType === CUSTOM_GAME` plus the normal server, identity, time, roster, and duplicate checks.
- `getPlayerRecentStat`/champion recency is optional. It requires its own code-`1` object contract; failure must result in an explicit unavailable section, not retained stale champion data presented as fresh.

The admin-session-protected custom-game finder at `/admin/game-finder` is a separate
read-only operator discovery surface. The legacy `/hub/search-engine` route only
redirects to this protected admin route. The finder tries the bare Riot name before the full ID,
accepts a response only after exact full-ID/server/`openId` verification, then
loads history filters with concurrency capped at two. It deduplicates opaque
game IDs, considers at most twelve dated detail candidates, and fetches those
details sequentially. A result is shown only when structured detail reports
`gameType === CUSTOM_GAME` and the searched participant matches both full Riot
ID and the verified `openId`. Optional champion/opponent clues affect ranking;
they never weaken identity or custom-game validation. The UI does not expose
`openId`, signed URLs, or raw provider payloads and has no result-write action.
Unlike the owner profile-refresh bundle, an arbitrary Search Engine query has no
trusted stored target identity, so it does not add saved-`openId` attempts.

Acceptance requires matching the expected full Riot ID, China server, and `openId`. Save profile/rank/Solo/Flex as one coherent snapshot only after every required response passes validation. A rejected replacement preserves the prior snapshot and timestamp; do not independently advance freshness for an unchanged section. Application-code semantics are endpoint-specific and must not be copied to token/session-status endpoints.

#### Hidden China-stats preview

The direct-link `/labs/china-stats` surface is a noindex, feature-gated product
preview. Its root redirects to the apex leaderboard, whose players link to the
real-player lookup. It is available by default only in development. A
deployed environment fails closed unless `CHINA_STATS_PREVIEW_ENABLED=true` is set
deliberately and `CHINA_STATS_PREVIEW_ALLOWED_PROFILE_IDS` contains a valid,
comma-separated allowlist of stable `AccountProfile.id` UUIDs.

An isolated preview database may set `CHINA_STATS_PREVIEW_ACCESS_ORIGIN` to the
canonical HTTPS origin. In that mode, preview routes forward the current
Supabase bearer token only to the fixed `/api/china-stats/access` endpoint and
accept only its boolean allow/deny result; redirects, malformed origins,
failures, and non-2xx responses fail closed. Player data and the ladder
snapshot remain in the isolated preview database, and the canonical deployment
does not expose account records to preview.

`/labs/china-stats/live` is a read-only browser lookup for one exact full Riot
ID on Ionia (`areaId=1`) or Super Server (`areaId=31`). It uses the dedicated
authenticated POST signer at `/api/china-stats/sign` and the residential-browser
flow. The signer accepts only profile, Solo/Duo, Flex, optional recent-stat, and
match-detail reads with fixed bounds; it does not expose a general provider URL
signer. The lookup tries the bare name before the full Riot ID and accepts the
result only after full Riot ID, server, and `openId` verification. A failed
queue or recent-stat section is shown as unavailable rather than replaced with
stale data. Match detail is lazy and capped at five unique requests per lookup.
The preview does not persist provider data, expose signed URLs, `openId`, opaque
provider game IDs, or raw payloads, and has no result-write action.
Client-local history filters must consume only the already normalized in-tab rows and
must not call the signer or provider. A detail participant may become a profile
link only from one validated full Riot ID; the URL carries only the selected
China Stats server and Riot ID. Incomplete identities remain text, and provider
identifiers never enter the destination URL.

The dedicated signer has a best-effort per-account warm-instance request
ceiling. A small authenticated preview must also use the deployment platform's
request controls; a broader public launch requires a durable cross-instance
rate-limit contract. The legacy `/api/lzyumi-sign` contract remains unchanged
for existing ECL flows and is not used by this preview.

Knowing the direct URL is never an access grant. In deployed environments, the
page calls the authenticated `/api/china-stats/access` boundary and renders the
preview only for an active, verified allowlisted profile. The signer repeats
the same server-side profile check and returns `403` for every other account,
so bypassing the client gate does not grant provider access. Change the
allowlist only through deployment configuration; never commit real profile IDs.

`/labs/china-stats/leaderboard` reads a sanitized apex snapshot through the
authenticated `/api/china-stats/leaderboard` boundary. Two collectors are
supported. The local League client collector resolves apex PUUIDs to Riot IDs
inside LCU and projects rank, full Riot ID, tier, LP, record, and profile icon.
The browser-run WeGame collector uses the operator's existing logged-in WeGame
page, projects rank, full Riot ID, tier, LP, profile icon, and up to five public
champion IDs in the supported `1–10000` range, and discards out-of-range values
plus WeGame `openid` before creating the file. WeGame does not
supply wins/losses on this boundary, so those records remain unavailable rather
than being fabricated. Both collectors store at most 100 rows per apex tier;
PUUIDs, summoner IDs, `openid`, session credentials, and raw payloads are never
uploaded.

The snapshot file configured by `CHINA_STATS_LADDER_SNAPSHOT_PATH` remains a
local-development override. The durable path is the additive
`china_stats_ladder_snapshots` table: one sanitized public snapshot per server,
read only through the authenticated leaderboard API. The disabled-by-default
`POST /api/jobs/china-stats-ladder` boundary requires its own 32-or-more-character
`CHINA_STATS_COLLECTOR_SECRET`; it never accepts the KOOK, job, or report-engine
secret as a fallback. The server normalizes the upload before persistence and
stores only platform, queue, capture time, tier coverage, public rows, a content
hash, and collector schema version. The version also encodes provenance:
version `1` is the LCU projection and version `2` is the WeGame tier-rank
projection.

Each server write takes a transaction-scoped advisory lock. A newer capture
atomically replaces the prior row, an exact retry is a no-op, and an older or
same-time/different-content upload is rejected. Both ingestion and reads enforce
the 24-hour maximum age, exact platform-to-server mapping, standard Solo/Duo
queue, required apex tiers, unique full Riot IDs, bounded numeric values, and
coverage counts. Browser roles have all table privileges revoked by the
additive migration. `CHINA_STATS_LADDER_INGEST_ENABLED=false` is the immediate
write-path rollback; disabling it preserves the last coherent row and timestamp.

The Windows collector resolves PUUIDs to current full Riot IDs inside the local
League client, then writes only the sanitized projection under ignored `.tmp/`.
The WeGame collector runs only on the official logged-in rank page and downloads
the same bounded sanitized file; it never exports the browser session. The
upload helper refuses files outside `.tmp/` and rejects credential, PUUID,
summoner-ID, `openId`, or diagnostic credential markers before sending. Ionia
maps to WeGame area `1` / platform `HN1`; Super Server maps to area `31` /
platform `BGP2`. Per-player details continue to come from the existing Lzyumi
browser flow; searched players are never used to fabricate the ladder.

#### Explicit manual refresh permit API and owner UI

The OP.GG-style action on `/hub/me` is backed by a durable, short-lived, one-use permit bound to the authenticated owner profile and that same active, verified, stale target profile. The UI reports concise refreshing, success, unavailable, failure, and cooldown states. It is not rendered on a public profile route. `POST /api/hub/lzyumi-refresh-permits` rejects a target owned by another profile, then atomically enforces per-profile cooldown, per-requester cooldown, and a requester rolling-window budget across serverless instances. It returns only the opaque one-use token, expiry, target profile ID, and a fixed signed-browser bundle derived from stored target identity: at most five ordered profile-identity attempts, Solo/Duo filter `2`, Flex filter `3`, and optional recent-stat. The browser resolves and verifies the identity sequentially before making the two history requests, and rejects the bundle if their signed `openId` differs from the resolved identity. `POST /api/hub/lzyumi-refresh-permits/consume` rechecks owner/target equality even for an otherwise valid permit, validates the complete core snapshot against the stored identity, and atomically replaces it while completing the permit.

The existing scheduled `LzyumiRefreshQueue` is not the manual-permit store. It owns one background lease per target profile and has no requester-bound lifecycle. The permit ledger is an additive Prisma migration with retention-safe `RESTRICT` relations and no browser-role privileges. The API remains fail-closed unless `LZYUMI_MANUAL_REFRESH_PERMITS_ENABLED=true` and every positive-integer policy variable is present and coherent. With that flag enabled, `/hub/me` renders the saved snapshot without starting the pre-existing implicit owner refresh, leaving a stale snapshot actionable through the permit flow. With the flag disabled, the implicit owner flow remains the immediate rollback. Its background-save route is owner-bound even when a target profile ID is supplied; it cannot be used by a viewer to bypass permit pressure controls. Signed request URLs do not sign Lzyumi response bodies, so viewer refresh remains disabled until a separate reviewed attestation or equivalent trusted-response mechanism exists. Schema rollout, policy activation, and application deployment remain separate authorization/release boundaries. See ADR 0002 for authorization, replay, persistence, and rollback boundaries.

#### Remaining refresh ownership and retention

- Owner permit-backed browser refresh is the primary ordinary Hub path. The flag-off implicit owner browser flow remains its rollback.
- The admin browser batch is an explicit operator fallback. It is protected by the admin session boundary and still applies the same identity/coherent-snapshot validation before saving.
- `GET|POST /api/jobs/refresh-lzyumi-profiles` is a job-secret-protected direct-cloud scout/fallback. No scheduler for it is committed in this repository, and direct cloud access is not assumed to work when Lzyumi blocks cloud IPs. Its queue is operational lease/error state, not permit or audit history.
- The KOOK shared-secret profile refresh endpoints are legacy integration surfaces. They do not authorize a public viewer and do not own normal Hub freshness.

Every successful writer now stores a bounded display projection instead of the provider envelope: profile rank rows and rendered recent-game fields, optional recent-stat KDA/champion counts, and bounded Solo/Flex display rows. Exact identity is still validated against the provider response before projection, while durable `openId` remains in its dedicated private column. Future snapshot JSON excludes `openId`, provider game IDs, response messages, and unused provider metadata. Existing rows are minimized only when a later coherent refresh replaces them; there is no migration, backfill, or shared-data cleanup in this slice.

Full match evidence in `InhouseReportJob.rawMatchData`, `InhouseSession.reportRawJson`, `MatchGame.ocrRawJson`, and private tournament report `raw`/`evidence` is not profile-cache data. It is restricted to worker/admin boundaries while pending; public and ordinary player reads must use normalized projections. Some completed-match UI, champion aggregation, duplicate detection, and recovery code still depends on legacy raw JSON, so terminal evidence must not be deleted yet. The target policy is: preserve normalized historical results and minimal stable dedupe/provenance keys, retain full private evidence only for a reviewed dispute/recovery interval, then reduce or delete it through a separately authorized bounded cleanup with backup and rollback. Selecting that interval and materializing the remaining normalized fields are prerequisites to activation.

### Match-report worker flow

The report engine is an always-on service used after KOOK queues a report job. It loads the saved ten-player session roster, searches recent games, fetches details, checks time/roster coverage, and sends candidate evidence back to the website. The website owns result authority and the database commit.

The optional bounded Lzyumi discovery mode fetches each history filter across the prioritized session roster before advancing to the next filter, with concurrency capped at two. This roster-first traversal prevents one reporter's stale history from consuming the complete request budget before another participant can expose the shared custom game. It deduplicates opaque provider game IDs and applies the session window and already-reported checks before detail lookup. Observed `battleTypeInfo` values are only a history prefilter: acceptance still requires detail `gameType === CUSTOM_GAME`, verified provider identity, roster coverage, and the existing website-side duplicate validation. Roster matching uses the stable saved `openId` plus China server when available, so a mutable Riot ID snapshot cannot hide the same durable player; missing, ambiguous, or conflicting stable identity still fails closed, and Riot ID is only the compatibility fallback when no saved `openId` exists. History and detail calls have separate hard request ceilings, details are fetched sequentially until one candidate passes, and provider codes `7`/`8` start a short in-process cooldown. Keep `legacy` as the immediate rollback setting until a controlled full KOOK golden-path canary records a correct preview, one confirmed 10/10 ingestion, and the next-session transition; activation or an isolated provider probe alone is not rollout verification.

If a bounded lookup has any failed history or detail request and no exact match, the final result is an incomplete provider lookup. It must tell the operator to retry later and must not downgrade that failure into a conclusive roster miss, time-window miss, or stale closest-candidate message. An exact validated match may still succeed when an unrelated lookup failed.

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

The permanent manual ranked-inhouse import contract is `/api/jobs/manual-inhouse-import`. It accepts only a private reviewed Lzyumi manifest through the report-engine/job credential. `preflight` is read-only and returns a database-bound fingerprint; `apply` is production-only, rechecks that fingerprint under the ranked advisory lock, and atomically inserts only missing ranked games while replaying affected current-season LP. Unregistered fillers require explicit owner approval and are excluded rather than provisioned. Notifications are always off. Operational steps live in `docs/RUNBOOK.md`.

Lzyumi match history exposes an opaque provider game ID rather than the numeric League Game ID. For an administrator-reviewed tournament recovery, that opaque value may be used as the private external-game identity when the numeric ID is unavailable. It must never be presented as a numeric League ID or exposed in the public tournament response; approval still checks it against tournament, ranked-report, legacy-game, and inhouse-session identities.

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
