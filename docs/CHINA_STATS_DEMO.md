# China Stats demo brief

Last reviewed: 2026-11-28

Status: active, allowlisted product demo

## Product decision

**Product requirement.** Build a credible English-first demo for viewing real
mainland China League of Legends ranked data without requiring the viewer to
navigate WeGame or the Chinese League client.

The demo lives inside ECL for speed, authentication, and reuse of the existing
Lzyumi/WeGame boundaries. It is not yet a decision that China Stats must remain
an ECL feature. After real users evaluate the demo, the owner will choose
whether to keep it as an ECL lab, integrate it into ECL, build a standalone
product, or stop the experiment.

The immediate objective is evidence, not feature completeness:

> Can an English-speaking coach, scout, analyst, or serious player quickly find
> useful Ionia and Super Server players and understand why this product is
> valuable?

## Intended audience

The first reviewers are a small invited group, not the general public:

- the ECL owner and one trusted collaborator;
- Western coaches, scouts, analysts, and content creators;
- players interested in high-elo mainland China solo queue;
- possible partners who can judge whether the data is commercially useful.

The demo should be understandable without Chinese-language knowledge or an
explanation of Lzyumi, WeGame, LCU, signed URLs, or provider identifiers.

## Hypotheses to test

1. Ionia and Super Server data has meaningful novelty for Western users.
2. A leaderboard-to-profile-to-match journey is more useful than isolated Riot
   ID lookup.
3. Matchup and recent-form presentation can turn raw China-server data into a
   scouting workflow.
4. Users value an English, linkable experience enough to return, recommend it,
   or pay for a reliable version.
5. The audience and brand fit will reveal whether the product belongs inside
   ECL or deserves a standalone identity.

## Verified current foundation

The following is implemented and has been exercised in the allowlisted preview
or production demo:

- `/labs/china-stats` redirects to the China Stats leaderboard.
- `/labs/china-stats/leaderboard` shows validated Ionia and Super Server apex
  snapshots with Challenger, Grandmaster, Master, and Riot-ID filters.
- Each server snapshot can contain up to 100 rows per apex tier.
- Leaderboard rows link to `/labs/china-stats/live` with the selected server and
  full Riot ID.
- `/labs/china-stats/live` verifies the resolved full Riot ID, China server, and
  Lzyumi `openId`, then shows profile/rank, Solo/Duo, Flex, optional recent
  statistics, recent form, role mix, champion summaries, and bounded match
  history.
- A match row can lazily load a complete 5v5 scoreboard, with a maximum of five
  unique detail requests per lookup.
- Player lookup uses the residential-browser signed request path; the server
  does not expose a general provider proxy.
- Ladder snapshots are collected from an official logged-in League/WeGame
  boundary, sanitized locally, revalidated by ECL, and stored as one coherent
  snapshot per server.
- The deployed surface is `noindex`, absent from Hub navigation, and protected
  by normal ECL authentication plus a stable-profile allowlist.
- The experience is read-only. It does not save searched profiles, report
  games, change ECL LP, or write tournament results.

The implementation and operational contracts remain authoritative in
[`UI_WALKTHROUGH.md`](UI_WALKTHROUGH.md),
[`INTEGRATIONS.md`](INTEGRATIONS.md),
[`ARCHITECTURE.md`](ARCHITECTURE.md), and [`RUNBOOK.md`](RUNBOOK.md).

## Demo scope

The first demo is complete only when the following user journey feels coherent.

### 1. Entry and navigation

- Keep the direct-link, authenticated, allowlisted entry.
- Present only two primary destinations: **Leaderboard** and **Player search**.
- Keep Ionia and Super Server visible as the supported demo coverage.
- Do not expose provider, authentication, collector, or ECL implementation
  terminology in normal product copy.

### 2. Leaderboard

- Switch between Ionia and Super Server.
- Filter All apex, Challenger, Grandmaster, and Master.
- Search the loaded snapshot by full Riot ID.
- Show rank, full Riot ID, tier, LP, available champion context, and honest
  unavailable fields.
- Make every row clearly clickable and open the corresponding live profile.
- Use one compact hierarchy consistent with the player-profile design; avoid a
  large marketing hero that pushes the data below the fold.
- Show snapshot freshness and coverage without presenting collector metadata as
  user-facing content.

### 3. Player profile

- Show full Riot ID, server, level, Solo/Duo rank, Flex rank, recent form, and
  recent champion context in a compact header.
- Remove labels that do not add user meaning, including "verified China
  profile". Identity validation remains an internal invariant.
- Keep rank, form, and freshness visually prominent.
- Preserve separate unavailable states for optional recent statistics,
  Solo/Duo, and Flex.
- Avoid showing `openId`, provider game IDs, signed URLs, or raw payloads.

### 4. Match history and details

- Use compact rows with clear win/loss color, champion portrait, champion name,
  role, queue, timestamp, K/D/A, and MVP/SVP emphasis when verified.
- Visually distinguish champion, role, and queue instead of rendering them as
  equivalent text.
- Add role icons where the normalized role is reliable.
- Support useful local filters over already loaded rows: queue, champion, role,
  and result. Filtering must not create additional provider requests.
- Expand a row in place to show the complete 5v5 scoreboard.
- Make every participant with a verified full Riot ID clickable into their
  China Stats profile on the same server.
- Use explicit loading, partial-failure, retry, empty, and detail-budget states.

### 5. Matchups

- Present Matchups as a separate profile tab or section, not as one more match
  history filter.
- Pair the searched player with the opposing player on the same normalized
  role only when the detail payload supports an unambiguous pairing.
- Show the opponent's champion and clickable Riot ID plus final K/D/A, gold,
  champion damage, kill participation, match result, and team score/objective
  context when available.
- Optionally show allied and enemy junglers from the same match.
- Label all comparisons as final-state data. Do not imply lane-at-15, gank
  attribution, build order, or timeline coverage.
- Stay inside the existing five-detail-request ceiling.

### 6. Product polish

- Use skeletons shaped like the eventual profile, rank cards, and match rows.
- Keep the prior coherent result visible while a new request is loading when
  identity safety permits it.
- Use short, restrained transitions for tabs, row expansion, skeleton-to-data,
  and clickable states.
- Avoid blank screens and ambiguous indefinite spinners.
- Present user-meaningful progress such as finding the player, loading ranked
  queues, and preparing match details without mentioning provider internals.
- Desktop is the primary demo surface; mobile must remain readable and
  functional but does not need a separate redesign before the first demos.

## Definition of Done

The demo is ready to show when all of these are true:

- [ ] Fresh Ionia and Super Server snapshots load with the expected apex-tier
      coverage and honest freshness labels.
- [ ] A reviewer can move from leaderboard to player profile and back without
      explanation or a dead end.
- [ ] Exact full-Riot-ID search works for a normal profile and a known hidden
      profile while preserving full-ID/server/`openId` verification.
- [ ] Solo/Duo, Flex, optional recent statistics, empty history, and partial
      provider failures have intentional presentation states.
- [ ] Match rows are compact, readable, and expose the agreed filters.
- [ ] Expanded scoreboards show ten players, and verified participant links
      open the correct server/profile search.
- [ ] The bounded Matchups view communicates useful final-state comparisons
      without unsupported timeline claims.
- [ ] Loading, retry, empty, unavailable, and request-budget states are visible
      and do not produce a blank or broken page.
- [ ] No browser console error or unhandled failed fetch appears during the
      scripted demo journey.
- [ ] No secret, provider identifier, stable private identifier, raw payload,
      or internal collector detail is exposed.
- [ ] The allowlist and `noindex` controls still fail closed for an uninvited
      account and a direct URL.
- [ ] The desktop experience has one coherent visual hierarchy across the
      leaderboard, profile, matches, and matchups.
- [ ] Focused tests, TypeScript, lint, build, and an isolated preview smoke pass
      before any production change.
- [ ] The owner and trusted collaborator can independently complete the demo
      script on production.

## Stop rule

Once the Definition of Done passes, stop adding features and show the demo to
at least three relevant external reviewers.

Before those demos, a new idea may replace an existing requirement only if it
fixes a blocker in the scripted journey. It must not expand the demo merely
because the underlying data or UI idea is interesting. Record non-blocking
ideas under **Deferred until after feedback**.

## Explicitly not required for the first demo

These ideas are valuable but must not delay the first external demonstrations:

- a public launch or unrestricted self-service access;
- support for every mainland China server;
- automated always-on ladder collection;
- unlimited profile/detail refreshes or public-scale rate limiting;
- a complete LPL/LDL team and pro-account knowledge graph;
- verified pro-player labels or multiple-account ownership claims;
- aggregate population-wide champion/build statistics;
- gold, XP, CS, level, kill, assist, item, or objective timelines;
- map playback, gank attribution, lane-at-15, or build-order claims;
- final item slots until the normalized Lzyumi detail field/value contract is
  verified by a privacy-safe schema probe;
- assets, skin collections, champion mastery, honor screenshots, TFT history,
  bots, mobile apps, or a commercial API;
- redesigning the rest of ECL to match the demo;
- choosing the final ECL-versus-standalone architecture or brand;
- claiming to be the first product to expose mainland China data.

## Completed delivery slices

- **Role and recent-stat label correctness:** abbreviated and full reliable
  China-history role markers normalize to English roles, while an unresolved
  role remains explicitly unavailable instead of falling back to a queue label.
  The optional recent-stat card no longer claims an unverified 30-day KDA period
  and clearly distinguishes its summary sample from the loaded match history.
- **Intentional live-lookup states:** the
  first lookup uses a profile-shaped skeleton; a same-player retry retains the
  last coherent result; partial, successful-empty, and terminal-error states
  remain distinct; lookup and match-detail failures offer bounded retries; and
  the five-unique-detail limit is visible and blocks a sixth provider request.

### Production delivery checkpoint: role and recent-stat label correctness

- PR [#101](https://github.com/deebeedee-ecl/ecl-split-one/pull/101), merged
  as `7dc89d2497153cba8ac2481cdb7a9c6126d5f0fd`.
- Vercel production deployment `dpl_4hBEkefbQJ6rEYsf4WJafnkApYVw` reached
  `READY`; GitHub CI reached `SUCCESS`.
- Local verification passed 183/183 tests, TypeScript, targeted ESLint, and the
  production build. Production layout smoke passed all 20 route/viewport
  combinations; signed-out China Stats access returned `401`, and the surface
  retained `noindex`/`nofollow`.
- No database, provider, or Railway mutation occurred.
- Rollback target: `c5c97aebedc12f82fe1f2d9e6b0e6e15eff3dd2d`.

### Production delivery checkpoint: intentional live-lookup states

- PR [#102](https://github.com/deebeedee-ecl/ecl-split-one/pull/102), merged
  as `bd91036d2658816defb0acaf367e4d318812aceb`; the implementation commit is
  `6993d923856e84989fdb57bf728e3769df1d0f7f`.
- GitHub CI reached `SUCCESS`. Vercel production deployment
  `dpl_6wWAQB1bUEPcvy8NM11VPTrufDib` reached `READY` for the exact merge SHA.
- Local verification passed focused China Stats live tests (10/10), the full
  root test suite (186/186), TypeScript with incremental compilation disabled,
  targeted ESLint, and the production build.
- A synthetic Playwright smoke passed loading, partial, successful-empty,
  detail-retry, and detail-budget states. It observed five unique detail
  requests plus one retry, blocked a sixth provider request, produced no
  browser/page error, and contacted neither the real provider nor the database.
- A branch-scoped preview enabled China Stats and delegated only its allowlist
  decision to `https://eclchina.lol`. The rebuilt preview reached `READY` and
  returned `200` with `noindex`/`nofollow`; authenticated browser smoke was not
  completed because the owner chose not to perform the additional manual Vercel
  Protection login.
- Production layout smoke passed all 20 route/viewport combinations without
  horizontal overflow. The China Stats live route returned `200`, retained
  `noindex`/`nofollow`/`nocache`, and its signed-out access API returned `401`.
- No database, provider, Railway, or KOOK mutation occurred. The only external
  pre-production changes were two non-secret branch-scoped Vercel preview
  variables and the isolated preview deployment.
- Rollback target: previous production commit
  `280b824b4a20eb50893005dee0eb5420c33ed842` at
  `ecl-split-f9zxrow7v-deebeedee-ecls-projects.vercel.app`.
- The next canonical implementation slice is compact match rows, local filters,
  verified participant links, and navigation. Keep it separate from Matchups,
  leaderboard redesign, database changes, and provider write flows.

## Known issues to resolve or label

- WeGame ladder snapshots do not provide W/L records. Display unavailable, not
  `0W / 0L` or an inferred record.
- Viewer-triggered public-scale refresh remains unresolved. The allowlisted demo
  may use the current residential-browser path; a public product needs durable
  cross-instance pressure controls and a reviewed trust model.
- The exact long-term legality, licensing, and commercial durability of every
  upstream source remains an open business risk, not a UI assumption.

## Demo script

Target duration: five minutes.

1. Open the leaderboard and explain that it is a fresh mainland China snapshot.
2. Switch between Ionia and Super Server, then filter an apex tier.
3. Search or select an interesting player and open the live profile.
4. Read rank, recent form, role/champion context, and match history.
5. Expand one match, inspect both teams, and open another participant.
6. Open Matchups and explain one final-state comparison plus jungle context.
7. Ask which part would change the reviewer's current scouting or analysis
   workflow.

Do not lead with implementation, ECL authentication, provider names, or the
collector. Lead with the data and the scouting use case.

## Feedback to capture

For each reviewer, record only product feedback, not private Riot/provider
identifiers:

- role and organization type;
- whether the value was clear in the first 30 seconds;
- most and least useful screen;
- missing decision-critical information;
- trust in freshness and identity accuracy;
- expected frequency of use;
- whether they would share, recommend, or pay for it;
- preferred product shape: ECL feature, standalone product, API/data service,
  or no ongoing need;
- the single next feature they would choose if only one could be built.

## Post-demo decision gate

After at least three relevant reviews, choose one outcome deliberately:

1. **Archive the experiment** if the novelty does not translate into a repeated
   use case.
2. **Keep an ECL lab** if it mainly benefits the existing community and the
   operational burden should remain small.
3. **Integrate into ECL** if China Stats strengthens ECL acquisition and player
   journeys without confusing the core community product.
4. **Build a standalone product** if Western scouting/analysis demand is real,
   the audience extends beyond ECL, and data collection can support the needed
   reliability and scale.
5. **Explore a data/API product** only if authorized upstream access, licensing,
   support, and unit economics are credible.

Evaluate the options using observed demand, audience overlap, acquisition,
provider durability, refresh cost, privacy/compliance, operational ownership,
and willingness to pay. Do not choose based only on visual enthusiasm for the
prototype.

## Deferred until after feedback

- Pro Players directory: league -> team -> roster -> role -> known accounts.
- Multiple verified accounts per pro and account ownership history.
- Saved watchlists, comparisons, alerts, and scout notes.
- Aggregate matchup samples across many players and patches.
- Public profiles and shareable report exports.
- Broader mainland server coverage.
- Public access, subscriptions, quotas, and commercial packaging.
- A standalone name, repository, deployment, and brand.

## Product-positioning note

Chinese domestic services already expose mainland profile and hidden-history
data. The demo must not rely on a broad "first China data website" claim.

The differentiation to test is:

> An English-first, Western-facing scouting and analytics experience for Ionia
> and Super Server, with trusted player identity, navigable leaderboards,
> readable match data, and useful matchup context.

Competitor research is intentionally pinned until after the core demo is ready;
it should inform positioning and later scope, not trigger an open-ended attempt
to copy every domestic feature.

## Delivery order

Keep implementation in small vertical slices:

1. Fix misleading role/recent-stat labels and establish the compact shared
   visual hierarchy.
2. Add intentional loading, partial, empty, retry, and budget states.
3. Finish compact match rows, agreed local filters, scoreboard participant
   links, and navigation.
4. Add the bounded final-state Matchups view.
5. Redesign the leaderboard in the same visual system.
6. Run focused checks and isolated preview verification.
7. Obtain explicit production authorization, deploy, and smoke the scripted
   journey.
8. Freeze scope and conduct external demos.

Refactors, public scaling, data migrations, Pro Players, and standalone-product
work remain separate changes unless the owner explicitly changes this brief.
