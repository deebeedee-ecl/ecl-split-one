# Fresh ranked season — prepared locally, not activated

The user chose a fresh ranked season with all old match history retained, then
removed the opening three-game placement bonus. Everyone starts at **800 LP**
with zero wins, losses and streak. Normal scoring applies from game one.
No commits, deployment, publication, server configuration or database writes
were performed for this reset.

## Scoring retained

These are the source defaults from `lib/elo.ts` and `lib/elo-rule-config.ts`.
The runtime rule editor is process-local; no persistent custom rules were found.

| Result at 800–1400 LP | LP |
| --- | ---: |
| Win | +29 |
| Win with MVP | +33 |
| Loss | -18 |
| Loss with SVP | -15 |
| Win number 3–5 in a consecutive streak | +44 (+48 MVP) |
| Win number 6 onward in a consecutive streak | +59 (+63 MVP) |
| Loss number 3 in a consecutive streak | -20 (-17 SVP) |
| Loss number 4 in a consecutive streak | -22 (-19 SVP) |

- The +29 win is the configured +24 plus the existing fixed +5. That fixed +5
  remains; only the old +65/0 placement branch was removed.
- Losses 1 and 2 are -18 each. From loss 3 onward, the loss grows by 2 per
  consecutive loss. A win resets the loss streak and vice versa. Opening games
  count toward ordinary streaks, so three opening wins yield 829, 858, 902 LP.
- Above 1400 effective LP, wins lose 1 per complete 25 above 1400, and losses
  grow by 1 per complete 35. At 1500, an ordinary win is +25 and loss -20.
  MVP/SVP and streak modifiers still apply. The code retains its win/loss clamps.
- Thursday and Friday use China time. The **first ranked game of the day**
  receives doubled winning LP if it is a win: +58 ordinary, +66 MVP before any
  other modifiers. Losing the first game consumes the opportunity. It is not
  a first-win-of-the-day bonus. Season-aware manual entry and replay now use
  the same eligibility rule as KOOK reports.
- After seven China calendar days without a ranked game, decay is 10 LP per
  extra day, stopping at 600. Gameplay losses can go below 600. A player with
  zero games in the new season has no inherited inactivity penalty. When the
  player returns, any unapplied decay is included in the next game's LP change.
- Kills, damage, gold and KDA have no direct LP bonus; MVP/SVP flags do.

## Reset and preservation

The new season is defined by three server environment variables:

```text
ECL_RANKED_SEASON_ID=ranked-2026-10-18
ECL_RANKED_SEASON_NAME=Ranked Season October 2026
ECL_RANKED_SEASON_START=<approved UTC cutover timestamp, ISO 8601 ending in Z>
```

All three unset preserves legacy season scope. Incomplete/invalid configuration
fails closed; a future timestamp takes effect only at that boundary. The normal
scoring change is code, so it takes effect on deployment independently of the
season timestamp. Deploy and cut over during a quiet reporting window.

Season LP is 800 plus recorded current-season ranked LP changes, with existing
inactivity decay applied for display. Current-season stats determine records,
streaks and KOOK balancing. Legacy `Player.elo` caches and old `eloAfter` values
cannot restore the old season. Normal future reports mirror the season rating
to the player cache, but no bulk player update or schema migration is required.

All-time match history and scoreboards retain original rows and original LP.
The own-history API retains its existing latest-100 window. Season summary
totals cover all season results; role/champion samples cover the latest 100.
All 33 former participants stay visible at baseline even before playing again;
the other player records start at baseline when joining ranked. Tied positions
retain the existing name ordering. Split II registration is unchanged.

Archived ranked matches reject normal edits/deletion/ingestion so old results
cannot be rescored with the new formula. Pre-season ready sessions must be
recreated. Current-season admin recalculation skips archived results. The legacy
raw-player ELO override returns 409 during a season because that cache is not
the season ledger; use current-season match corrections instead. A separate
audited manual-adjustment ledger would need a future design.

`scripts/reset-leaderboard.ts` is retired: its former implementation deleted
all stat rows, including other modes. Do not use it for this reset.

## Read-only audit and checkpoint

The October 18 read-only repeatable-read audit found 45 player records, 33
ranked participants, 25 ranked games and 237 ranked stat rows; zero active
recent ready sessions or pending report jobs. All 45 projected to 800 LP with
zero season games. Latest old stat: 2026-09-14T14:04:03.351Z.

Private metadata-only checkpoint, without account names, email, PUUIDs or raw
match payloads:
`backups/ranked-season-2026-10-18T09-49-10-269Z-ddd89122.json`.
Its metadata SHA-256 is
`98cfc88e61d9b02b39767457d4e05c778c5ef74d6352fb0520733e75177872f7`.
The preview's proposed start is a simulation, not an activation time.

Refresh the audit immediately before an approved cutover:

```powershell
node --env-file=.env.local --import tsx scripts/preview-ranked-season.ts --backup
```

## Review and rollout

The worktree contains unrelated desktop-reporting, snapshot-refresh and retention
backend changes. Do not deploy or stage the entire worktree. In particular,
`lib/kook-commands.ts` contains both the season summary change and pending
desktop-reporting changes. Include only the season import and `formatMeMessage`
change from that file. Leave reporting flags and the retention cron untouched.

The native client source now accepts season metadata, labels the current
season, handles zero-game win rate and separates current form from all-time
history. Already-built 1.0.1 artifacts are unchanged. This source must be
released under a new version before distribution; do not rebuild the frozen
1.0.1 installer. Older apps fall back to website standings and lack the new
season labels/zero-game handling.

Before activation: approve the scoped deployment, rerun the read-only preview,
choose the real start time, verify no in-flight reporting, set the three server
variables and deploy. Verify all 33 old participants show 800 / 0 games, old
histories/scoreboards still load, KOOK shows 800 / 0–0 and balances from season
ratings, then test a controlled new ranked result. Production activation and
any installer publication still require approval under the user's handoff.

Rolling back before any new-season game can restore the old deployment and
remove the three variables without restoring a database backup. After new
season games exist, do not blindly clear the boundary: all-time calculations
could mix seasons. Review the recorded season results before rollback.

## Local verification

- Nine ranked tests cover fresh 800 LP, opening games, normal streaks, scaling,
  Thursday bonus, preserved history and disabled archived writes/legacy overrides.
- Full fake-store backend/view/lifecycle/reporting suite: 29 passed.
- Desktop suite: 82 passed, one optional real-installer signature probe skipped.
- Desktop demo smoke passed: season label, 800 / zero games / no win rate,
  no inherited form streak, old history still present, other screens/localization.
- Root TypeScript and scoped ESLint passed (eight existing unused-symbol warnings).
- Isolated scoped website production build passed with dummy database settings;
  no production database calls or deployment. Existing workspace-root inference
  and deprecated middleware-convention warnings remain.

The clean source review copy is `.tmp/ranked-season-review`, based on commit
`16ed057f4732eceab390c4ba0a77f428a74079e2`, with per-file hashes in
`RANKED_REVIEW_MANIFEST.json`. It contains the season changes without the pending
desktop reporting/retention/snapshot backend. Its dependency junction is local
build infrastructure, not an artifact to upload. No secrets were copied into it.
