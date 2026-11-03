# Hub 1.0.4 — admin match lookup

Requested 4 November 2026. Desktop app only; the website dashboard keeps its restored full tournament layout.

In **Split II → Admin match lookup**, sign in with the existing website admin username/password, enter a numeric League game ID and select **Check game**. A complete Ionia custom match shows ten players, champions, items, winner, KDA, damage and gold. The administrator does not have to be a participant. Lookup stays local and does not upload or publish anything.

Select the actual Split II fixture and game number, then **Save for review**. After the upload confirmation, the app uses the existing admin import endpoint. The server verifies the complete lineup, sides, fixture, game identity and duplicate rules. The report is pending; approval remains at `/admin/split-ii`. No automatic result publication or inhouse scoring is added.

The existing website admin session is held only in the desktop main process, expires after twelve hours and clears on admin sign-out, ECL account change or app exit. Passwords are cleared from the form; cookies, raw match JSON and League credentials are not sent to the renderer or persisted locally by this feature. Only a minimized scoreboard preview reaches the interface. Sample/test mode disables live admin login, lookup and upload.

**Retrieval limitation:** administrator permission cannot override Tencent returning HTTP 404 / `Match file not found`. For game `11436337984`, the owner supplied a screenshot of that response from their own Hub. This does not prove whether a participant's client can retrieve it. A participant's JSON or manual evidence remains an alternative. No result for that game is inferred or published by this release.

The app dashboard carousel now displays completed fixtures winner-first with a green/red score, including Exodus **1–0** NextGen, while unplayed fixtures show **VS**. It uses approved tournament fixture scores, so new results appear through the existing automatic data refresh.

Summoner spell collection and display remain queued in `ECL_SPLIT_II_NEXT_UPDATE.md`; missing spell values are not invented.

## Data separation

This release reuses `tournament_fixtures`, `tournament_reports`, `tournament_members`, registrations and the existing event-scoped review workflow. There is no schema migration, new Supabase project, or write to ranked inhouse matches, ratings or report jobs. The existing Coach `!split2` adapter remains separate from inhouse reporting.

## Release checks

- Desktop unit suite: 92 passed, one optional legacy installer probe skipped, zero failures. Eight new admin tests cover login, private fields, nonparticipant lookup, 404, stale sessions, cached-match-only submission and pending review.
- Focused client interaction checks passed, including winner-first completed carousel scores and unplayed VS slides.
- Actual packaged desktop visual checks passed for the admin panel, ten-player preview, loaded assets, password clearing, disabled live operations in smoke mode, compact scrolling, existing Split II tabs/dialog and automatic carousel rotation. No renderer errors.
- Live website admin login and read-only fixture access succeeded using the new module. No live match upload or publication was sent.
- Installer signed using the existing protected ECL key and verified against the isolated source checkout. Unrelated pending desktop/bot changes were excluded.

Public release publication verifies immutable files and the full installer SHA-512 before switching `latest.yml`. Earlier installers stay available. Users apply the new interface with **Restart to update**; tournament scores continue refreshing automatically.
