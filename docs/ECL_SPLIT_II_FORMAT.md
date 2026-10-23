# Split II format shown in the Hub

Confirmed by the owner October 22, 2026, using the supplied league-format HTML
as a content reference. The Hub has a native Tournament format tab immediately
after Season details. It uses the existing UI components and Hub colours.

- Teams: BallBreakers, Phoenix, Zero, NextGen and Exodus. RouteOne (R1) is excluded.
- Single round robin: each team plays the other four once, for ten Bo1 games.
  Each win earns one point.
- The top four qualify; fifth place is eliminated after required tie-breakers.
- Semifinals: first versus fourth and second versus third. Both are Bo3.
- Final: the two semifinal winners, Bo3, on November 20.
- Ties on wins use Bo1 tie-breakers for qualification/seeding. For a three-way tie
  for third through fifth, total winning-game time eliminates the slowest team;
  the other two play a Bo1 to decide third and fourth.

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

Verification: the existing DOM suite exercises the third tab, its five teams,
ten-game count, qualification, tie-break wording and Bo3 playoffs, plus the
existing signup/audio/floater flows. TypeScript, focused lint and the isolated
production build are checked before publishing. Browser visual inspection was
unavailable in this session.
