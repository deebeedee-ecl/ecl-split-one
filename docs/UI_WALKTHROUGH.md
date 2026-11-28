# ECL UI walkthrough

Last reviewed: 2026-11-26

## Scope and evidence

This map combines four evidence levels:

- **Live public** — read-only walkthrough of `eclchina.lol` on 2026-11-07.
- **Live authenticated** — isolated headed Edge/Playwright walkthrough of 12 desktop and 4 mobile Hub routes, with same-origin non-GET requests blocked after login.
- **Current code** — route/component inspection in this repository at the same date.
- **Supplied authenticated screenshot** — the account settings screen supplied by the project operator.

The normal browser-control connector could not attach to the operator's existing Edge tab, so the authenticated pass used a temporary isolated Edge profile. The pass navigated routes directly and did not submit forms, save settings, upload files, request verification codes, refresh provider data, or confirm reports. Do not treat code presence or a successful GET as proof that a mutation works in production.

## Global public shell

The current public header presents:

- Home
- Hub
- News
- How to Play
- Tournaments, with the current Split II entry and past-tournament archive
- Log in
- Sign up

The footer presents Terms & Conditions, Admin Login, and Contact Us.

The public header, mobile navigation, and footer are owned by the `(public)` route-group layout. The public `/hub` introduction remains inside that shell, while `/hub/*` application routes use a separate `(hub)` layout boundary and do not render the public chrome behind the Hub surface.

The home page positions ECL around a five-step loop: link a player profile → join through KOOK → play community games → report the result → track profile/rank/history. It also explains the Hub, ranked inhouses, player progression, China-server lookup, privacy separation, and tournament archives.

## Public route map

| Route | Current user-facing purpose | Evidence |
| --- | --- | --- |
| `/` | Product landing page and primary calls to Hub/How to Play/current tournament | Live public |
| `/hub` | Public Hub introduction; “Enter the Hub” leads to `/hub/dashboard` | Live public |
| `/news` | News index | Current code; live fetch was unavailable |
| `/how-to-play` | Ionia/WeGame/KOOK onboarding, launch/language troubleshooting, support form | Live public |
| `/split-ii` | Split II event landing, dates/format, login CTA, rules CTA | Live public |
| `/tournaments` | Past-tournament archive | Current code; live fetch was unavailable |
| `/tournaments/winter-cup` | Winter Cup archive | Current code |
| `/tournaments/split-one` | Split One archive | Current code |
| `/tournaments/world-cup` | World Cup event/archive landing and roster CTAs | Current code plus indexed public snapshot |
| `/login` | Email/password login and password-reset link | Live public |
| `/signup` | Account, Riot identity/server, KOOK username, and optional WeChat onboarding | Public crawl snapshot plus current code |
| `/rules` | Community, identity, KOOK participation, integrity, records, disputes, beta, and privacy terms | Live public |
| `/contact` | Support form for account, registration, rules, matches, and general support | Live public |

Contact and onboarding surfaces collect personal contact/identity data. UI changes must preserve explicit purpose, server-side authorization, safe defaults, and privacy projection.

## Hub access states

The Hub layout's shared bootstrap and `HubAccessGate` create three relevant user states:

1. No Supabase session → “Log in to enter the Hub” with a login CTA.
2. Logged in but no loadable ECL profile → “Complete your Hub profile” with a settings CTA that retains the intended destination.
3. Logged in with a profile → requested Hub content.

Account Settings is the exception: it allows the authenticated no-profile state so the user can create/complete the profile. The server-rendered shell initially shows “Checking Hub access...” while the client resolves the shared session/minimal-profile bootstrap. Route-specific narrow profile projections still load inside Profile, Settings, and other pages that need them.

## Authenticated Hub shell

The current desktop Hub uses a narrow fixed left icon sidebar with hover descriptions and a full-page dark blue/black content surface. Below the desktop breakpoint, that sidebar becomes a sticky horizontal icon navigation with a bounded local scroller; keyboard focus brings every navigation action into view. The shared page header reflows its title, description, and `HUB` badge rather than retaining the desktop row. Its route-group layout is separate from the public shell and owns the shared authenticated bootstrap. Page-level `HubShell` instances keep the existing presentation while their `HubAccessGate` consumers reuse the layout-level session/profile state.

Primary navigation:

- Dashboard → `/hub/dashboard`
- My Profile → `/hub/me`
- Ranked Ladder → `/hub/leaderboard`
- Players → `/hub/players`
- Champions → `/hub/champions`
- Inhouses → `/hub/inhouses`

Secondary actions:

- Account Settings → `/hub/settings`
- Return to website
- Log out

The Hub navigation does not currently include the existing World Cup route family. Historical mobile evidence showed the desktop fixed-width sidebar at narrow widths; the responsive shell now uses the bounded horizontal navigation described above.

## Hub page map

### Dashboard

`/hub/dashboard` is currently event-specific, not a neutral product dashboard. It renders the Split II registration/dashboard component and is described in the sidebar as “Split II: Draft and player registration.”

The authenticated desktop and mobile pass confirmed that this is a large event microsite embedded inside the Hub shell rather than a compact overview dashboard.

### My Profile

`/hub/me` is the main player identity/stat surface. Current sections include:

- display identity, avatar/banner, nationality, roles, KOOK verification, and optionally public Riot ID;
- Solo/Duo and Flex rank context from a validated provider snapshot;
- ECL inhouse ELO, ladder rank, W/L, average KDA, and data freshness state;
- performance radar, role stats, top inhouse champions, and awards;
- reported champion/ranked-game snapshot;
- personal inhouse match-history preview;
- an owner-only `Refresh stats` action when the verified snapshot is stale or incomplete;
- a KOOK verification notice/code flow when the profile is not linked.

The route-specific profile request renders the last coherent stored snapshot first. When manual refresh permits are enabled, `/hub/me` leaves a stale or incomplete snapshot visible and actionable instead of starting the legacy signed-browser refresh during page entry. Disabling the flag restores that implicit owner refresh as the immediate rollback. A completed refresh replaces the snapshot only after the complete identity-checked snapshot is accepted, and freshness remains tied to the last successful coherent replacement.

The explicit owner action uses concise refresh, success, unavailable, failure, and durable cooldown states. Core profile/Solo/Flex failure keeps the previous snapshot and timestamp; optional recent champion data may be marked unavailable. The action is not rendered on `/hub/players/[slug]`, because a signed provider request does not attest a viewer-supplied response body.

Historical walkthrough evidence from 2026-11-07 captured “Loading profile...” at 2.5 seconds because the provider refresh blocked the stored snapshot. The current flow still waits for the route-specific account profile request, but no longer waits for the browser-based Lzyumi refresh before rendering a valid saved snapshot.

The route-specific request has a bounded skeleton and distinguishes a missing profile from a timeout/API failure. Failures offer an explicit retry; background refresh separately reports refreshing, success, and failure while preserving the last coherent snapshot. The performance radar starts with valid positive dimensions before its responsive measurement, avoiding the earlier Recharts `width(-1)` / `height(-1)` mount.

### Ranked Ladder

`/hub/leaderboard` shows the active ranked-season description and rows derived from reported ranked inhouses. The empty state explains that the ladder populates after reports. Player names link to public Hub player profiles.

The authenticated pass showed the live October 2026 ladder populated with player rank, Riot ID, ELO, record, win percentage, streak, and role.

### Players

`/hub/players` lists verified ECL profiles with display name, Riot ID, roles, and event/team status where available. It supports text search plus primary/secondary role filters. World Cup player/free-agent filtering is conditionally shown when the loaded data includes World Cup status.

`/hub/players/[slug]` is the public/profile-detail surface for another player and reuses the profile presentation without the authenticated user's personal controls. It renders the last verified provider snapshot and timestamp but does not implicitly sign or send Lzyumi requests through the viewer's browser, and it does not expose the owner-only manual refresh action.

### Champions

`/hub/champions` aggregates reported inhouse champion data. It supports role tabs, champion search, minimum-games filtering, and sorting by strength, win rate, pick rate, ban rate, or games. The table presents champion, tier, role, games, win rate, and pick rate, with an explicit no-data state.

The authenticated pass showed this table populated from current reported inhouses.

### Inhouses

`/hub/inhouses` presents five recent matches and a selected broadcast-style report. `/hub/inhouses/archive` lists the full archive, and `/hub/inhouses/[matchId]` shows draft, game stats, damage, objectives, and standouts.

**Known presentation risk:** when `fetchInhouseMatches()` returns no rows, all three clients currently fall back to hard-coded mock matches. That can present sample data as real history instead of an empty/error state. Treat this as a product/data-integrity defect before relying on the screen during an incident.

The authenticated pass did receive current live matches, so the mock fallback was not active during the walkthrough. The dormant fallback remains a defect for empty/error conditions.

`/hub/me/report-inhouse` is a separate player reporting surface used by the authenticated flow.

### Game Finder

`/admin/game-finder` is a dedicated admin-session-protected, read-only Lzyumi
custom-game lookup for administrators/operators, not a result-publication
screen. The legacy `/hub/search-engine` URL redirects to the protected admin
route and is no longer shown in player Hub navigation. The finder requests the exact full Riot ID, China
server, approximate China date, and optional champion/opponent clues. The page
uses the signed browser flow, displays its bounded request summary, and exposes
only detail-confirmed `CUSTOM_GAME` candidates with sanitized participant rows
and the private provider game ID. It has no submit, approve, publish, ranked,
LP, or tournament write action.

### China Stats preview

The bounded product objective, first-demo Definition of Done, stop rule, and
post-demo ECL-versus-standalone decision gate are maintained in
[`CHINA_STATS_DEMO.md`](CHINA_STATS_DEMO.md).

`/labs/china-stats` is a direct-link, `noindex`, feature-gated preview for a
possible standalone China-server analytics experience. Its root redirects to
the apex leaderboard. The surface is absent from Hub navigation and uses the
authenticated Hub gate in deployed environments. It then checks the stable active/verified
profile against the server-side preview allowlist. Non-invited accounts see a
preview-access message, and the signer independently returns `403`; knowing the
URL is not sufficient.

`/labs/china-stats/leaderboard` presents the latest validated client snapshot
for Ionia or Super Server. It supports Challenger, Grandmaster, and Master tier
filters, Riot-ID search, responsive rows, coverage/freshness context, and links
each player into the existing live profile and match-history lookup. The first
local prototype includes up to 100 resolved players per tier. A server without
a collected snapshot has an explicit unavailable state; it does not reuse the
other server's rows. The API repeats account and preview-allowlist authorization
and never exposes client credentials, PUUIDs, summoner IDs, or raw payloads.

`/labs/china-stats/live` requests one exact full Riot ID and either Ionia or
Super Server, then uses the authenticated, fixed-scope
`/api/china-stats/sign` POST contract and the residential-browser flow.
Identity resolution is bounded to bare-name/full-ID attempts and must prove the
full ID, selected server, and `openId`. Filters `1`, `2`, and `3` plus optional
recent stats are normalized only in the current browser tab; partial Solo/Flex
provider failure is labelled unavailable rather than empty. Match detail is
lazy, limited to five user-triggered requests per lookup, and never renders the
provider game ID. Queue record, win rate, form, streak, role mix, and champion
pool are derived locally from the bounded history rows. The route performs no
profile snapshot save, database write, report, LP, or tournament action.

The live lookup has explicit presentation states: a profile-shaped first-load
skeleton; progress copy for identity and ranked-data loading; same-target
retention of the last coherent result; separate partial, successful-empty, and
error states; retry controls for failed lookup sections and match details; and
a visible five-unique-detail budget that blocks a sixth provider request. A
search for a different full Riot ID or server never retains the prior player's
result. The 2026-11-28 production rollout retained the signed-out access gate
and `noindex`/`nofollow` metadata; see `CHINA_STATS_DEMO.md` for its evidence and
rollback target.

The production match-history usability implementation renders compact rows
with separate result, champion, role, queue, timestamp, and
verified MVP/SVP treatment. Its queue, champion, role, and result filters are
purely local projections of already loaded history and provide both reset and
intentional zero-results states; they do not sign or send another provider
request. History K/D/A remains absent because the normalized history contract
does not supply it, while a loaded detail scoreboard may show its normalized
`scoreInfo`. A scoreboard identity becomes a profile link only after validating
one full Riot ID; the destination preserves the selected China server and
contains no `openId`, provider game ID, signed URL, or raw payload. Incomplete or
malformed participant identities remain plain text. The existing leaderboard
and global China Stats navigation continue to provide the minimal return path.
The 2026-11-28 rollout retained the deployed access and robots boundaries; its
exact production evidence and rollback target are in `CHINA_STATS_DEMO.md`.

### Account Settings

`/hub/settings`, confirmed by the supplied authenticated screenshot and current component, contains:

- account status, display identity, Riot ID summary, roles, nationality, server, and sign out;
- KOOK verification status/code controls;
- Identity: display name, Riot name/tag, China server;
- Linked Accounts: KOOK username, read-only stable KOOK ID, WeChat ID;
- Player Setup: primary/secondary role, nationality, timezone. The nationality dropdown offers an ISO 3166-1-based country and territory set, excluding Hong Kong (`HK`) and Taiwan (`TW`), while retaining “Prefer not to say”;
- Profile Image: avatar, bio, banner, and banner position;
- Privacy: public Riot ID, email, and WeChat toggles;
- Save/Create Profile action.

Real account values, KOOK IDs, verification codes, contact details, and uploaded media must never be copied into repository documentation or fixtures.

Settings loads an editable settings projection rather than the full account row. Its initial request uses the same bounded timeout/error/retry contract as Profile, while an authenticated account with no profile still reaches the creation form instead of being treated as an API failure.

## Event-specific Hub routes

### Split II

The current main dashboard and public navigation are centered on Split II. Event behavior is implemented by the Split II registration/dashboard components and event-specific admin routes.

The Results tab presents approved matches in chronological order, oldest first. The ordering is derived from each report payload's `playedAt` timestamp, with game number and report ID used only as deterministic tie-breakers.

The Standings tab orders teams by wins and then by lower total duration of the
games they won. It displays that `Win time` value; only teams equal on both
wins and total winning time retain the provisional `*` marker.

The Fixtures tab shows confirmed playoff series before the completed
round-robin weeks. Semifinal cards expose Bo3 scoring, the Game 1 side-selection
team, the rule that each game's loser selects side for the next game, and any
confirmed China-time schedule. Tournament format shows the same seeded bracket.

The match-stat dialog labels registered floaters and approved last-minute guest players with a `SUB` badge. Guest Riot IDs are result snapshots, not links to an ECL account.

### World Cup

The repository also contains a full World Cup route family:

- archive/event landing;
- find team, create team, apply, and personal team status;
- players, standings, fixtures, and team/captain dashboard.

World Cup pages define their own local navigation (Archive, Teams, Players, Standings, Fixtures), but the current global Hub sidebar has no World Cup item. These routes are therefore event/CTA/direct-link surfaces rather than primary Hub navigation in the current shell.

The authenticated pass confirmed that direct World Cup routes remain deployed and populated. Their page copy still references a September team deadline/start while the primary site and dashboard are centered on Split II in October/November, so they currently read as a stale but reachable event surface.

## Admin shell

The current admin sidebar exposes:

- Split II Tournament
- Dashboard
- World Cup Teams
- Users
- Match History
- ELO / LP
- Admin Users
- Messages
- News Drafts
- Inhouse Reporter
- Sign Out / Return to Website

The Split II Tournament page includes a protected **Confirmed playoff fixtures**
release control while SF01/SF02 are absent. It shows the exact Bo3 pairings,
Game 1 side selectors, blockers, and operation fingerprint before enabling the
release. Publication revalidates that fingerprint under the event lock, is safe
to retry, returns a bounded audit ID, and sends no KOOK notification. Once both
rows exist, the control becomes a verified status message and the fixtures are
available for ordinary scheduling and reporting.

This is a navigation inventory, not a security endorsement. Admin authentication and authorization are known hardening work, and menu visibility never replaces route-level authorization.

## Observed drift and follow-up checks

- Current local layout and current home page show “Split II: Draft.” An older indexed/crawled signup snapshot showed “ECL World Cup,” demonstrating that event navigation has drifted across deployments or cache snapshots. Recheck all public pages in a real browser after each event-nav switch.
- The dashboard is hard-wired to the current event, while older event route families remain in the app. A future neutral dashboard/event switcher needs an explicit product decision rather than another one-off replacement.
- Inhouse mock fallback must be replaced by a clearly labelled development fixture or a production empty/error state.
- Historical evidence from the 2026-11-07 authenticated walkthrough showed React production hydration error `#418` on every audited Hub route. The shared Hub bootstrap introduced afterward now exposes the same deterministic `loading` snapshot to server rendering and the first client render, then resolves auth in an effect. A 2026-11-12 follow-up found no hydration error on cold desktop/mobile Hub loads or synthetic authenticated client navigation; retain the focused bootstrap snapshot test and browser-console assertion so browser storage cannot re-enter the initial render path.
- Historical evidence from 2026-11-07 captured a Recharts width/height `-1` warning. The current chart supplies positive initial/minimum dimensions; retain a browser-console assertion in preview checks so a responsive-layout regression is not hidden.
- Historical 2026-11-07 evidence at 390 pixels showed the fixed Hub sidebar, a wider inner scroll area, and the Settings `HUB` badge beyond the container edge. The responsive shell now reflows the navigation/header, contains intentionally wide archive tables in labelled keyboard-focusable scrollers, and uses a compact Inhouses score layout below the tablet breakpoint. Retain browser checks at 320, 360, 390, and 768 pixels so page-level overflow cannot regress.
- Historical cold Profile and Settings navigation could look stuck in generic loading text. The current route requests use bounded skeleton, error, and retry states; authenticated preview verification should cover both cold refresh and client navigation.
- The authenticated pass verified read-only loaded states only. Save/upload/verification-code/provider-refresh/report/tournament-application actions still require focused tests and explicit approval before any live exercise.
