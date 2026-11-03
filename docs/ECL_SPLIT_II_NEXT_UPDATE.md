# Split II follow-up

## Coach reporting — next work, noted 4 November 2026

Owner's requested order:

1. [ ] Test one real game ourselves through this chat first. Confirm retrieval, game ID, fixture, actual ten-player lineup, winner, duration and available stats before saving or approving a report. A connected client alone does not establish that Tencent can return the match data.
2. [ ] Set up Coach to handle tournament game reporting through KOOK, reducing manual work. Inspect the existing `!split2` adapter and deployed review/collection workflow before building another path. Keep all records in the existing event-scoped `tournament_*` dataset, separate from ranked inhouse reports and LP.
3. [ ] Fix and update the KOOK command routing, replies and help text to match the tested workflow. Check `!split2 help`, `fixtures`, `schedule`, `confirm`, `cancel` and `report`; make unavailable match history and pending review clear. Verify with isolated tests before a real KOOK run. Do not treat automatic collection as approval to publish unreviewed results.
4. [ ] Enter the three outstanding games after the test works. Identify their fixtures/game IDs, check for existing pending or approved reports, and validate evidence. Preserve any existing pending entries; do not invent winners/stats, create duplicates or silently approve them.

Known outstanding game: **Phoenix vs BallBreakers / RR01 / 11436337984**. The owner's own Hub returned HTTP 404 / `Match file not found`. This game has not been published. The cause is unconfirmed; nonparticipation has not been established as the cause. A participant-client comparison is still needed.

Progress on 4 November: owner supplied BB/Phoenix scoreboard screenshots. A manual draft validates all ten accounts, BB victory, 30:42 and Epifanio MVP. The text attachment was empty; exact item IDs and full-unit damage/gold are not invented. Biaomei was manually added against his existing confirmed login after owner-confirmed rules/ToS acceptance, replaced Doolittlesy, and Shidian became Phoenix captain. The manual report is saved pending review; publication is a separate action. See `database/tournaments/PHOENIX_ROSTER_2026_11_04.md` and the private pending-report audit.

The other two game IDs and matchups have not yet been supplied or verified. Confirm them before entering results; do not assume which fixtures were played.

This section records follow-up work. Adding the note does not change the bot, send KOOK messages, enter results or approve games.

## Next match-details update

- Show both summoner spells beside each player's champion in the website and desktop match scoreboards.
- Preserve the two spell IDs in the tournament report payload when the source provides them; show their local icons and readable names.
- Keep missing spells blank or marked unavailable. Do not infer them from champion, role or screenshots alone.
- Retain the actual accounts and spell choices used in that match, separately from current Hub profile data.
- Apply through the existing tournament report/review path; never write tournament statistics into ranked inhouse tables.

Requested 28 October 2026. Deferred deliberately; this carousel update does not add spell collection or display yet.
