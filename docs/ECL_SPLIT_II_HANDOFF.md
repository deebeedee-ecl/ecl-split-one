# ECL Split II and Automation Handoff

Updated: October 17, 2026 (Asia/Shanghai).

## Registration Release Status

The minimum registration release is implemented, tested and deployed. Read
`docs/ECL_SPLIT_II_RELEASE.md` before proceeding. The user approved the separate
Supabase foundation: both new tables and one DRAFT event were created October 17.
Release commit `f0845652ffa438b44565a91d4b5bcf1659299279` is pushed and deployed.
Vercel and report-engine checks succeeded. The user approved publication and
opening at noon; the live API reports scheduled for October 17, 12:00 China time,
capacity 30 and zero registrations. Signup unlocks automatically at that instant.
Production routes, anonymous rejection, consent page, preview exclusion and audio
passed smoke checks. The translated KOOK notice was chat-only for group posting. See
`docs/database/tournaments/LIVE_PREPARATION.md` before any further SQL operation.

- User's latest confirmation is **October 17, 2026, 12:00 noon China time** (UTC
  October 17, 04:00), replacing the initial midnight request. If enabled after that
  instant, it opens immediately. Draft October 23;
  play begins October 24; **finals November 20**. Teams drawn at random; first
  prize 3,000 RMB. Closing time is unset; close manually before the draft.
- Public `/split-ii` is now an ECL SPLIT II landing page directing visitors to
  log into the Hub, with the dates, prize and eligibility/rules information.
  The homepage announcement uses the same Hub signup wording.
- Real registration client routes: `/hub/dashboard`, `/hub/split-ii`. They use the
  authenticated server API at `/api/tournaments/split-ii/registration`. The two
  Hub routes retain the existing access gate in every environment.
- Mock controls/fixtures are isolated to development-only
  `/hub/split-ii/preview`, which returns 404 in production. Desktop design/music
  review: `http://127.0.0.1:3002/hub/split-ii/preview`.
- Header: white ECL on blue; smaller gold DRAFT [existing ECL logo] 2026 on black;
  blue SPLIT II on white. White capacity counter; dark entry ticket. Upright,
  flattened italic AGAINST ALL ODDS at bottom right. Custom angular SVG lettering
  echoes the reference; the full center logo uses object-fit contain.
- User supplied a Worlds 2021 Destiny MP3, copied to
  `public/split-ii-champ-select.mp3` (20,101,566 bytes). Dashboard attempts playback
  at 20% volume and offers a play/mute control when autoplay is blocked.
- Registration requires ACTIVE + VERIFIED profile eligibility and valid profile
  name/League identity/role. The server derives all player data, stores immutable
  role/name/League snapshots and consent versions/time, enforces uniqueness and
  serializes claims with an event-row lock. Capacity is also protected by a DB
  trigger. Retries return the caller's existing ticket, even when full/closed.
- Public roster responses expose registration IDs, names and roles only. No private
  profile IDs, contact data, identity keys or consent records are exposed.
- Frozen terms and registration rules: `/split-ii/rules`,
  `lib/tournaments/ecl-terms-2026-10-16.ts`, and
  `lib/tournaments/split-ii-config.ts`. Keep accepted versions immutable.
- SQL, seed, schedule, safe close and empty-only rollback are prepared under
  `docs/database/tournaments/`. Creation and the DRAFT seed were applied live;
  do not rerun creation. The release helper
  `scripts/release-split-ii.ts` defaults to read-only check; writes require an
  explicit action and --apply after user approval.
- Real isolated PostgreSQL tests pass: eligibility, consent, profile spoofing,
  saved snapshots, privacy, RLS/grants, duplicate retries, slot-30 race, slot-31
  rejection, concurrent direct inserts, isolation and rollback. Client DOM tests
  pass for login, checkbox consent, persisted ticket, full/scheduled/error states,
  retry and audio controls. The production webpack build passes all 66 static
  pages; focused ESLint and TypeScript pass.
- Production smoke server is `http://127.0.0.1:3003`. Public registration/rules and
  Hub dashboard return 200; production mock preview is 404; anonymous POST is 401.
  Before tables are applied, registration GET fails closed with 503 and no fake
  counter. The MP3 supports byte ranges (206). In-app browser is unavailable;
  final visual review is manual and no real authenticated signup was created.
- Live foundation verified: both new tables exist with RLS, restricted browser
  grants and enabled guards. All ten checked legacy tables retain identical data
  fingerprints and column metadata. Last aggregate eligibility check: 41 eligible
  profiles, 4 without complete server/openId identity. Identity policy and the
  limitations of cross-account matching are described in the release record.
- Live site `https://eclchina.lol` is on Vercel, with successful public GitHub
  deployment status for release commit
  `f0845652ffa438b44565a91d4b5bcf1659299279`. The
  Vercel plugin was suggested but is not confirmed connected; the existing Git
  pipeline is available without relying on that connection.
- `vercel.json` selects the tested webpack build. An existing admin teams page
  searchParams type was updated to the required Promise/await form to unblock
  the Next.js build. The default npm dev/build scripts remain unchanged.
- World Cup is over: active Hub/navigation promotion removed; historical pages,
  records and APIs retained. Existing reporting/scoring/automation code is untouched.
- The earlier ladder database crash was due to the preview process's network
  restrictions. Read-only queries and the restarted server load the ladder again.
  The page now has an unavailable/retry state and a route error boundary.
- Keep the unrelated modified package.json collector shortcuts and untracked
  investigation scripts out of the release commit. Never use git add -A.

## Start Here

We have two related projects:

1. Build the ECL Split II 2026 registration experience in the existing website.
2. Develop ECL Companion, a lightweight local Windows collector for Chinese League matches.

The registration website milestone has shipped. Current work is launch monitoring,
draft/tournament operations before October 23/24, and the separate desktop match
collector investigation. Collection does not block accepting registrations.

Disregard the externally proposed HTML preview and ZIP package. Build the design directly in the existing Next.js application using the requirements below. Do not wait for those files.

## Workspace and Guardrails

- Actual repository: `C:\Users\muiri\Desktop\ECL\ecl-split-one`.
- Some tool sessions default to the nonexistent `C:\Users\muiri\Desktop\ecl-split-one`. Verify the working directory before running commands.
- Read `AGENTS.md`. It requires consulting the installed Next.js documentation before writing Next.js code.
- Stack: Next.js App Router, React, TypeScript, Tailwind, Supabase authentication, Prisma/PostgreSQL, existing Radix/shadcn-related components and Lucide icons.
- Preserve existing Hub, World Cup pages, accounts, player records, league results, reporting and scoring.
- No production database/schema changes, deployment or live registrations without explicit user approval.
- Keep credentials out of logs, screenshots, commits and frontend code. Do not read or reproduce secret values merely to inspect configuration.
- There are unrelated modified/untracked scripts in the worktree. Inspect status and preserve them.
- Use `npm.cmd` in PowerShell if `npm.ps1` is blocked by execution policy.

## Split II Product Requirements

### Visual Direction

- Premium esports registration experience inspired by Worlds 2021 champion select.
- Electric royal blue `#0035F8`, black and white, bold condensed display typography.
- Prominent registration counter and 30-slot player grid.
- A premium entry-ticket treatment for the player's registration state.
- Capacity state progresses green -> amber -> red as places fill. Exact thresholds are a design decision, not an existing business rule.
- Responsive desktop/mobile layouts, restrained motion, accessible focus and reduced-motion behavior.
- Use the project's existing components and compatible dependencies. Avoid redesigning unrelated Hub pages.

### Registration Rules

- Existing authenticated ECL account required.
- Only eligible, verified players may claim a place.
- Maximum 30 players; one registration per player.
- Display existing ECL display names, ordered by signup time.
- Show occupied and available places and remaining capacity.
- Provide a clear entry point from the homepage and a relevant Hub destination.
- Existing World Cup registration datasets remain separate.
- The server must enforce capacity and uniqueness, including simultaneous requests and request retries.

### Existing Integration Points

- `prisma/schema.prisma`: `User`, `AccountProfile`, existing registration and match/report models.
- `AccountProfile` already has `displayName`, Riot identity/server fields, `verificationStatus` and `accountStatus`.
- `lib/account-auth.ts`: authenticates incoming bearer tokens with Supabase `auth.getUser`.
- `components/account/client-account.ts`: existing client-side profile/session helpers.
- `app/hub/_components/HubAccessGate.tsx`: existing Hub access flow. Having a profile/Hub access is not equivalent to verified Split II eligibility.
- `app/hub/_components/HubShell.tsx` and surrounding Hub components: existing layout/navigation.
- `Tournament` and `TournamentRegistration` map to dedicated live `tournaments` and `tournament_registrations` tables. The approved foundation and noon opening schedule were applied. SQL, security/capacity guards, event seed and rollback are in `docs/database/tournaments/README.md`; do not rerun creation.

## Split II Implementation Roadmap

### Current position: October 17, 2026

| Workstream | Status | Next work |
| --- | --- | --- |
| Phase 1: design | Approved and shipped | Address real user feedback if needed. |
| Phase 2: eligibility/data plan | Implemented in separate live tables | Registration closing time, replacements and random-draw rules still need decisions. |
| Phase 3: signup integration | Implemented and tested | Confirm the first genuine player's saved entry after opening. |
| Phase 4: release | Deployed; opening scheduled for October 17, noon China time | Monitor failed registrations and capacity. Latest public check: scheduled, 0/30. |
| Draft and tournament operations | Not implemented by this registration release | Prepare admin roster/export, role handling and an auditable random draw before October 23; tournament-scoped teams, fixtures/results and reporting before play begins October 24. |
| ECL Companion desktop collector | Investigation/prototype | Prove reliable complete post-game retrieval, then build durable collection/upload and connect existing reporting/scoring. |

The tournament closes with finals on November 20. Decide the match format,
schedule, no-show/replacement handling and reporting fallback before play begins.
Future teams, matches and statistics must be scoped to their tournament; the
registration foundation alone does not isolate future match ingestion.

Lyzumi remains the source for League ranks and ranked profile statistics. The
existing My Profile page refreshes missing data or snapshots older than 12 hours;
login to the dashboard alone does not initiate this browser refresh. No interval
or trigger change was approved or implemented in the clarification discussion.
Inhouse ELO/results remain sourced from stored ECL match records. The future
desktop app will collect/report those matches; it does not replace Lyzumi profile
updates. The desktop ingestion path is not yet proven end to end.

The detailed original phase checklists below remain as acceptance criteria.

### Phase 1: Inspect and Build the Local Design

1. Inspect current homepage, Hub layouts, authentication, profile statuses and existing UI components.
2. Choose a clear Split II registration route within the current application.
3. Implement the actual page with isolated mock registrations; no database writes.
4. Include signed-out, eligible/unregistered, registered, ineligible, full, loading and error states in the prototype.
5. Allow local review of low, medium, nearly-full and full capacity states. Keep test controls out of production UI.
6. Add appropriate local navigation/homepage entry points without disturbing other events.
7. Start the local development server on a free port and provide its exact URL.
8. Check desktop/mobile screenshots, overflow, interaction states, keyboard access and reduced motion.

Acceptance: the user can review a working registration page locally and approve/revise its visuals. Mock counters must not be presented as real registrations.

### Phase 2: Approve the Rules and Database Plan

After visual approval, establish:

- Which existing verification/account statuses qualify a player.
- Whether registration has opening/closing dates and whether cancellation or a waitlist is needed. These are not yet agreed features.
- How one real player is identified if multiple ECL accounts/profiles can refer to the same League identity.
- Which registered-player details are visible publicly versus only inside the Hub.

Prepare a separate season-scoped registration model tied to the existing profile. Enforce a unique season/player registration. Plan an atomic capacity mechanism, such as locking a season capacity row inside a transaction; a separate count followed by an insert is insufficient. Prepare migration and rollback instructions for review before any production schema change.

### Phase 3: Connect and Verify Registration

1. Implement authenticated server endpoints using existing Supabase/Prisma patterns.
2. Recheck eligibility on the server and derive player identity from the authenticated account.
3. Enforce the 30-player limit and duplicate handling atomically.
4. Read the roster in deterministic signup order and update the counter after successful registration.
5. Decide whether polling or existing realtime infrastructure is appropriate for other visitors' roster updates.
6. Test unauthenticated/ineligible requests, duplicate retries, slot 30, slot 31 and concurrent claims for the last place in an isolated test database.

Acceptance: the counter and roster agree with stored registrations, duplicates do not consume extra places, and concurrency never produces more than 30 registrations.

### Phase 4: Release With Approval

Review the final design, database migration, configuration and verification results with the user. Deploy and change the live schema only after explicit approval. Monitor registration failures and capacity consistency.

## Automation: What We Already Tried

### Server-Side WeGame

- `SearchPlayer` resolved Riot names/tags to WeGame internal identities.
- `GetBattleList` and `GetBattleDetail` successfully returned recent games and full 10-player results for tested players.
- Search results must match the correct tag/server; selecting the first similarly named account caused incorrect lookups.
- `count=8` worked in tests where `count=24` returned an API failure. Do not assume a universal API limit from this alone.
- Integrated into the Docker report worker on an Ubuntu VPS.
- Cookies expired. A `login_by_qq` probe minted usable tickets while the QQ session was valid, but later failed with `Session Not exists` / invalid QQ login state.
- This did not establish unattended, indefinite authentication renewal.
- The user disabled/removed the Ubuntu server to save money. Do not plan around restoring it.

### Local League Client Access

- The chosen direction is ECL Companion running on a player's Windows PC alongside League.
- Chinese installation: `C:\Program Files (x86)\WeGameApps\lol\LeagueClient`.
- `LeagueClient\lockfile` exists but is empty on the tested installation.
- A Riot Client Data lockfile reached a different local service and did not provide the needed League match-history API.
- The proven method reads `LeagueClientUx.exe` process `CommandLine` through `Get-CimInstance Win32_Process` and extracts `--app-port` and `--remoting-auth-token`.
- Requests use HTTPS to `127.0.0.1:{dynamic-port}`, HTTP Basic username `riot`, and the token as password. Local TLS certificate verification needs appropriate loopback handling.
- Ordinary PowerShell exposed the command line when Codex/VS Code execution contexts did not. Empty WMI command lines do not prove missing flags or a changed League launch configuration.
- A later user-run Node diagnostic successfully discovered process credentials too.
- Do not hardcode the port/token or reuse an old environment token after a client restart.

### Reported Successful Local Tests

User-provided PowerShell results reported HTTP 200 and complete 10-player match data for:

- `11363536449`.
- `11360928249` (normal Summoner's Rift, queue 430).
- `11363615233` returned HTTP 200 for a custom game; completeness still needs inspecting.

Working reference endpoints:

- `/lol-match-history/v1/games/{gameId}`.
- `/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=4`.
- `/lol-summoner/v1/current-summoner` for session identity.

Join `participants` to `participantIdentities` using `participantId`. Match payloads include champion/team, KDA, damage, gold, CS, vision, items/runes, player identities/PUUIDs and team objectives/results.

Live Client API on `https://127.0.0.1:2999/liveclientdata/allgamedata` reportedly returned 10 players during a game. Port 2999 serves a different API from the dynamically assigned LCU port. Live snapshots are not yet proven substitutes for complete post-game results.

### Current Automation Blocker

Later Node requests authenticated successfully but match-history requests returned HTTP 400 RPC timeouts or HTTP 500/503 backend errors. Both recent-history ranges and known direct game IDs failed in the recorded comparison. The user also reported that League's own match history UI worked.

We have not established whether the cause is client request behavior, session context, caching, backend routing or intermittent service availability. Do not describe it as a confirmed Tencent outage or an auth failure.

An actual code bug made missing `--end` become `0` through `Number("")`. The active `fetchRecentGames` lines were subsequently changed to `nonNegativeIntArg`, defaulting to 4. Verify runtime output rather than trusting past claims that a patch landed.

## Automation Code and Next Investigation

- `scripts/local-league-collector.ts`: credential discovery, diagnostic mode, recent history, direct match fetch, retries and local raw/normalized/validation JSON output.
- `scripts/probe-lcu-parity.ts`: separate Node HTTPS versus `curl.exe` comparison using one credential set; checks current summoner, current-summoner history, PUUID history and known games.
- `package.json`: `local:league` and `local:lcu-parity` shortcuts.
- The scripts were untracked in the last inspected worktree. TypeScript checking passed, but that is not proof of successful real match retrieval.
- No persistent background collector, deduplication, upload queue or end-to-end Companion submission has been demonstrated.

Next steps:

1. Read the parity script before running it. It currently truncates response bodies before extracting the PUUID and uses different User-Agent/Accept behavior across transports. Correct these diagnostic limitations before drawing conclusions; preserve full responses in memory and print safe summaries only.
2. Ensure error reporting cannot expose a token through a spawned curl command's error text. Prefer passing curl credentials through stdin configuration rather than process arguments.
3. In ordinary PowerShell with League fully open, obtain fresh credentials and compare both transports using the same session and URLs. Record status, duration and sanitized error details.
4. Verify logged-in identity and PUUID. Test current-summoner and PUUID history and known direct game IDs. Neither transport has a successful comparison result recorded yet.
5. If retrieval succeeds, inspect and preserve complete raw payloads; verify player identities, teams and winners before enabling uploads.
6. Only then add background discovery, reconnection after client restarts, bounded retries, durable local storage, deduplication scoped to server/account context and a pending-submission queue.
7. Connect authenticated submissions to existing ECL roster validation/reporting/scoring after independent collector verification. Keep LCU tokens on the local machine.

Existing reporting foundation: `lib/inhouse-report-jobs.ts`, `app/api/jobs/inhouse-report/route.ts`, KOOK report command handling and the existing inhouse report ingestion code. Inspect current implementations before extending them; do not create a parallel scoring system.

## Paste Into the Next Chat

> Read docs/ECL_SPLIT_II_HANDOFF.md and docs/ECL_SPLIT_II_RELEASE.md. The real
> registration flow, isolated database tests, client tests and production build
> are complete locally. Do not repeat prototype work. Check whether the user has
> approved publishing/opening: the two live tables were already created, and the
> latest approved opening is October 17 at 12:00 noon China time. Check release
> status before writing; do not rerun creation. Use the existing GitHub/Vercel
> pipeline, preserve unrelated
> scripts/worktree changes and verify the deployed site. Keep test players out
> of the live database. The separate LCU investigation remains unfinished.
