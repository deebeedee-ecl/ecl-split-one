# ECL product context

Last reviewed: 2026-11-07

## Purpose

**Product requirement.** Expat China League (ECL) is a League of Legends community in China, described in current onboarding as active since 2016 and bringing together expatriate and local players. The product supports two related activities:

1. ranked 5v5 inhouse custom games with verified identities, balanced teams, match history, player statistics, and an ECL ladder;
2. community tournaments with registrations, rosters, fixtures, reporting, standings, and archives.

The website is the durable system of record and player-facing Hub. KOOK is where the community communicates and triggers operational workflows.

## Users and roles

| Role | Primary needs |
| --- | --- |
| Visitor | Understand ECL, China-server play, news, and tournaments |
| Registered player | Create an ECL profile and maintain Riot/player preferences |
| KOOK-verified player | Join ranked inhouses, view ladder/profile/history, and report games |
| Inhouse admin | Resolve queue/session/reporting problems without corrupting match or ELO history |
| Tournament participant/captain | Register, manage a team, find fixtures, and submit results |
| Tournament/server admin | Operate registrations, rosters, fixtures, reports, announcements, and corrections |

Authorization is a technical property, not just a UI label. Every privileged API must independently enforce the relevant role.

## Core journeys

### Join and verify

**Verified current.** The community onboarding path is:

1. A player joins the ECL KOOK server and receives the bilingual welcome message.
2. The player opens `eclchina.lol`, creates or signs in to an ECL account, and completes the Hub profile.
3. The player requests a KOOK verification code in the authenticated account flow.
4. In KOOK, the player submits `!verify CODE`; the bot sends the code and stable KOOK user ID to the ECL API.
5. The ECL account becomes linked to that KOOK account.

The current code creates a random code with a 24-hour expiry and marks it confirmed after use. Codes are credentials: never put a real code in documentation, logs, screenshots, or test fixtures.

### Play a ranked inhouse

**Verified current.** The intended operator/player loop is:

1. Players join the configured ranked-inhouse KOOK voice channel.
2. `!inhouse` checks roster size and ECL verification.
3. With exactly ten eligible players, `!ready` balances teams, persists an inhouse session, and provides voice-move instructions. Admins have a separate force-ready path.
4. Players create and play the 5v5 League custom game.
5. A participant uses `!report` (or selects a numbered pending inhouse). The website queues a report-engine job.
6. The worker finds a candidate China-server game, validates time and roster coverage, and posts a preview.
7. `!yes` submits the stored preview; `!no` cancels it.
8. A valid submission creates the ECL match/game/player statistics, applies LP, and completes the inhouse session.

The completion step must be exactly-once. A retry must return the already-completed result or safely do nothing.

### Participate in a tournament

**Verified current at the domain level.** The code and schema support tournaments, registrations, teams/members, fixtures, reports, floater appearances, notifications, and collection jobs. Individual tournament formats and release dates are event-specific; dated Split II documents are evidence for that event, not global rules.

The durable journey is registration → eligibility/roster formation → fixtures → game/result reporting → review/correction → standings/archive.

## Identity model

ECL must reconcile several identities without treating mutable names as keys:

| Identity | Durable key / rule |
| --- | --- |
| Authentication | Supabase user ID |
| ECL account | `AccountProfile.id`; player competition records resolve to a stable `Player.id` |
| Riot | Full Riot ID (name and tag), China server, and verified Lzyumi `openId` |
| KOOK | Stable KOOK user ID; username is display metadata only |
| Public profile | Display name and fields allowed by that profile's privacy choices |

ELO/LP and match history belong to the stable ECL player identity, not an email, Riot spelling, or KOOK username that can change.

## Current navigation

**Verified current from the 2026-11-07 code, supplied account screenshot, and an authenticated read-only Playwright walkthrough of the deployed Hub.**

The detailed evidence-based route and page map is maintained in [`UI_WALKTHROUGH.md`](UI_WALKTHROUGH.md).

### Public site

- Home
- Hub
- News
- How to Play
- Tournaments: current Split II entry and past tournament archive
- Log in / Sign up
- Footer: Terms & Conditions, Admin Login, Contact Us

Additional public routes expose teams, schedules/results/standings, stats, tournament archives, downloads, and event-specific pages even when they are not top-level navigation items.

### Authenticated Hub sidebar

- Dashboard
- My Profile
- Ranked Ladder
- Players
- Champions
- Inhouses
- Account Settings
- Return to website / Sign out

Account Settings currently groups account status, Riot identity and China server, KOOK linkage, player roles, nationality/timezone, profile media/bio, and privacy controls.

### Admin surface

The current admin shell links tournament operations, dashboard, teams, users, match history, ELO/LP, admin users, messages, news drafts, and the inhouse reporter. Presence in the menu does not prove that every section is complete or securely authorized.

## Product invariants

- A displayed rank/profile snapshot identifies the exact full Riot ID, China server, and `openId` it represents.
- A partial provider failure never creates a mixed fresh/stale snapshot or a false refresh timestamp.
- A reported game cannot change ECL stats or LP more than once.
- A session's saved ten-player roster is the basis for report validation; admin overrides must be explicit and auditable.
- Tournament and ranked-season history is preserved when new seasons/events start.
- Private contact/account data is never exposed merely because it exists in the profile table.
- Player-facing onboarding and critical instructions should remain understandable in English and Chinese.

## Open product questions

- What is the formal dispute/correction workflow after a ranked result is confirmed?
- Which profile fields are public by default, and how should existing profiles be migrated if defaults change?
- What is the approved mapping/merge process when Riot IDs, KOOK accounts, or duplicate `Player` rows change?
- Which tournament rules are global platform rules versus configuration for a specific event?
- What is the formal season-reset policy for LP, placements, archived standings, and player statistics?
- Should verification commands remain usable in a public channel, or should onboarding move them to a private interaction?
