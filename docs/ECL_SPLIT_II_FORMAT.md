# Split II format shown in the Hub

Confirmed by the owner October 22, 2026, using the supplied league-format HTML
as a content reference. The Hub has a native Tournament format tab immediately
after Season details. It uses the existing UI components and Hub colours.

- Teams: BallBreakers, Phoenix, Zero, NextGen and Exodus. RouteOne (R1) is excluded.
- Single round robin: each team plays the other four once, for ten Bo1 games.
  Each win earns one point.
- The top four qualify; fifth place is eliminated after applying the standings
  tie-break rule.
- Semifinals: first versus fourth and second versus third. Both are Bo3.
- Final: the two semifinal winners, Bo3, on November 20.
- Ties on wins are ranked by total duration of the games each team won; the
  lower total winning time receives the higher seed. Loss durations are not
  counted. If two or more teams have the same wins and exactly the same total
  winning time, their places remain provisional until the tournament organiser
  resolves the tie.

The owner confirmed the total-winning-time rule for all equal-win standings on
November 14, 2026. The standings table exposes this value as `Win time`, and
the shared standings calculation supplies the same order to public and KOOK
surfaces.

## Confirmed semifinals (November 14)

The completed round robin and total-winning-time tie-break produced these seeds:

1. BallBreakers
2. Zero
3. Exodus
4. Phoenix
5. NextGen

The confirmed Bo3 semifinals are `SF01` BallBreakers versus Phoenix and `SF02`
Zero versus Exodus. The higher seed has side selection for Game 1: BallBreakers
in `SF01` and Zero in `SF02`. After each game, the losing team receives side
selection for the next game. The final fixture is created only after both
semifinal winners are known.

The owner explicitly confirmed Bo3 for both playoff stages, overriding the
reference file's default Bo1 selectors. The six-team reference's fifteen-game
count and two-team elimination were adapted to five teams. The display explains
the format; it does not create results or assign seeds.

## Round-robin fixtures (October 23)

The owner requested a Fixtures tab after Tournament format and confirmed two
Bo1 matches per team in each of two weeks, with generated pairings. The ten
pairings cover every opponent exactly once. Match dates and times are TBC.
The fixtures are display content; no database records or results are created.

| Week 1 | Week 2 |
| --- | --- |
| BallBreakers vs Phoenix | BallBreakers vs Zero |
| Zero vs NextGen | Phoenix vs NextGen |
| Exodus vs BallBreakers | Zero vs Exodus |
| Phoenix vs Zero | NextGen vs BallBreakers |
| NextGen vs Exodus | Exodus vs Phoenix |

Team labels and fixture pairings are maintained in
`lib/tournaments/split-ii-fixtures.ts`. DOM checks validate two appearances per
team per week, four overall, ten unique pairings, and tab navigation alongside
the existing registration, floater, audio and format flows.

The five supplied team logo assets were extracted from the reference. Its HTML,
global styles, simulator JavaScript and local result storage were not imported.
Registration, floater rules, saved consent and database records are unchanged.

## Final team roster board (October 24)

The owner supplied the final draft allocations in a roster-board screenshot.
The first tab now says Team rosters and shows the five team cards, with the
captain first and each pick's original pot number. The allocations are stored
in `lib/tournaments/split-ii-rosters.ts`; Epifanio uses the registered spelling.
Cards use the original logos at `/kook/split2/`. They adapt to the Hub's existing
content column and stack on small screens. The separate subs/floater section
and its live loading/signup behavior remain below the tabs.

This is a display of the supplied draft results. It does not create teams or
memberships in legacy tables, alter registrations, or mix tournament and
inhouse statistics. The final cards remain visible during registration API
failures, with a separate status/retry notice for registration and floater data.

Verification checks five captains, 25 unique players, pot labels, logo paths,
and existing fixtures, registration, floater, audio and error-recovery flows.
A read-only comparison confirmed all 25 saved main-roster names appear exactly
once in the final allocations, with no additional players or omissions.

At the owner's request, roster cards show each player's Riot ID after their
name in smaller grey text. The registration read API selects only the current
profile Riot name/tag for main-roster entries, so account corrections appear
without changing immutable signup snapshots or hardcoding IDs into the cards.
Floater response fields remain unchanged. Missing or ambiguous name matches
show an unavailable label instead of guessing an identity. No contact details,
account tokens or private game identifiers are published.

Verification: the existing DOM suite exercises the third tab, its five teams,
ten-game count, qualification, tie-break wording and Bo3 playoffs, plus the
existing signup/audio/floater flows. TypeScript, focused lint and the isolated
production build are checked before publishing. Browser visual inspection was
unavailable in this session.
