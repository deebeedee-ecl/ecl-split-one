# Split II interface release — 28 October 2026

Completed fixtures show winners in green and losers in red. Results use a winner-first 1–0 score and **View match stats**, without internal RR fixture tags. The website match dialog sits above the fixed Hub shell; its X and Escape controls close it and return focus to the result.

The website dashboard now rotates logo-versus-logo round-robin matchups. The dedicated Split II sidebar entry retains rosters, floaters, fixtures, results, standings and tournament player stats. Public tournament reads refresh automatically every minute and on return to the page. A failed refresh retains the last valid snapshot and retries; unavailable live data never becomes a fabricated unplayed fixture list.

Hub **1.0.3** redesigns the Split II section with Overview, Teams, Fixtures, Results, Standings and Player stats tabs. Its match dialog includes all ten players, champions, items, KDA, damage, gold and MVP. Team and item assets are packaged locally and allowed through narrowly scoped desktop protocol paths. The dashboard rotates team logos. Tournament reporting remains disconnected by default, requested-game-only, and subject to administrator review.

The standard Hub sections and ranked inhouse scoring are unchanged. This release changes no live database schema or tournament results, and sends no KOOK messages.

The news article `/news/split-ii-round-robin-underway` announces the five-team round robin, Bo1 league games, top-four qualification, Bo3 semifinals/final and the first published Exodus 1–0 NextGen result.

## Validation

- Focused client interaction checks passed: fixtures, result dialog, profile/registration consent, roster recovery, cached results, native tabs and logo carousel. No live signup was sent.
- Actual packaged desktop visual checks passed at wide and compact sizes: five teams, 25 players, ten fixtures, ten scoreboard players, loaded images, horizontal tabs, winner/loser colours, X/Escape, standings and automatic carousel rotation; no renderer errors.
- Website visual checks passed inside the real Hub shell: dialog z-index 1001 above Hub 200, image loading, X/Escape, restored focus, completed fixture colours and compact layout.
- Focused ESLint passed. Desktop tournament and signature checks: nine passed, one optional real-installer test skipped. The actual 1.0.3 installer separately passed protected-key signature and packaged-source verification.

The signed automatic-update feed is `https://eclchina.lol/desktop-updates/windows/`. Existing supported installations check and download updates automatically. Applying the new interface requires **Restart to update**; subsequent match data refreshes require no installer. Publication verifies immutable version files and the complete public installer SHA-512 before switching `latest.yml`. Earlier installers remain available for recovery.

Unrelated working-tree changes were excluded from the release checkout and commit.
