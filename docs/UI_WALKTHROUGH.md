# ECL UI walkthrough

Last reviewed: 2026-11-09

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
- a KOOK verification notice/code flow when the profile is not linked.

The route-specific profile request renders the last coherent stored snapshot before any stale/missing provider refresh completes. The signed browser refresh then runs in the background, keeps that snapshot visible while pending or failed, and replaces it only after the complete identity-checked snapshot is accepted. Data freshness remains tied to the last successful coherent replacement.

Historical walkthrough evidence from 2026-11-07 captured “Loading profile...” at 2.5 seconds because the provider refresh blocked the stored snapshot. The current flow still waits for the route-specific account profile request, but no longer waits for the browser-based Lzyumi refresh before rendering a valid saved snapshot.

The route-specific request has a bounded skeleton and distinguishes a missing profile from a timeout/API failure. Failures offer an explicit retry; background refresh separately reports refreshing, success, and failure while preserving the last coherent snapshot. The performance radar starts with valid positive dimensions before its responsive measurement, avoiding the earlier Recharts `width(-1)` / `height(-1)` mount.

### Ranked Ladder

`/hub/leaderboard` shows the active ranked-season description and rows derived from reported ranked inhouses. The empty state explains that the ladder populates after reports. Player names link to public Hub player profiles.

The authenticated pass showed the live October 2026 ladder populated with player rank, Riot ID, ELO, record, win percentage, streak, and role.

### Players

`/hub/players` lists verified ECL profiles with display name, Riot ID, roles, and event/team status where available. It supports text search plus primary/secondary role filters. World Cup player/free-agent filtering is conditionally shown when the loaded data includes World Cup status.

`/hub/players/[slug]` is the public/profile-detail surface for another player and reuses the profile presentation without the authenticated user's personal controls. It renders the last verified provider snapshot and timestamp but does not implicitly sign or send Lzyumi requests through the viewer's browser.

### Champions

`/hub/champions` aggregates reported inhouse champion data. It supports role tabs, champion search, minimum-games filtering, and sorting by strength, win rate, pick rate, ban rate, or games. The table presents champion, tier, role, games, win rate, and pick rate, with an explicit no-data state.

The authenticated pass showed this table populated from current reported inhouses.

### Inhouses

`/hub/inhouses` presents five recent matches and a selected broadcast-style report. `/hub/inhouses/archive` lists the full archive, and `/hub/inhouses/[matchId]` shows draft, game stats, damage, objectives, and standouts.

**Known presentation risk:** when `fetchInhouseMatches()` returns no rows, all three clients currently fall back to hard-coded mock matches. That can present sample data as real history instead of an empty/error state. Treat this as a product/data-integrity defect before relying on the screen during an incident.

The authenticated pass did receive current live matches, so the mock fallback was not active during the walkthrough. The dormant fallback remains a defect for empty/error conditions.

`/hub/me/report-inhouse` is a separate player reporting surface used by the authenticated flow.

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
