# Split II Coach commands — 4 November 2026

The existing deployed KOOK adapter forwards `!split2` commands to the authenticated tournament service. These additions live in that service; no new bot token, Railway redeployment or Hub installer is required to use them once the website release is live.

| Command | Behavior |
| --- | --- |
| `!split2 help` | Current command list, scheduling syntax and reporting entry point |
| `!split2 standings` | Approved-results table: played, wins, losses and points. Tied points remain provisional. Alias: `!split2 table`. |
| `!split2 fixtures` | Remaining round-robin fixtures, grouped by week with the RR codes needed for scheduling/reporting. Aliases: `!split2 remaining`, `!split2 fixtures remaining`. |
| `!split2 fixtures all` | Full round-robin draw, with final scores for played fixtures and China-time schedules for outstanding games |
| `!split2 results` | Published scores and individual game date/duration, including an approved game in an unfinished playoff series |
| `!split2 report` | Instructions for player collection and admin import/manual reporting |
| `!split2 report RR02` | Instructions for that fixture, or its existing final score if already reported |
| `!split2 report RR02 NUMERIC_GAME_ID [GAME_NUMBER]` | Existing player-linked collection workflow: queue a request for the reporter's desktop Hub; does not approve the result |
| `!split2 schedule RR02 YYYY-MM-DD HH:mm` | Existing captain proposal workflow in China time |
| `!split2 confirm RR02 REVISION` | Existing opposing-captain confirmation workflow |
| `!split2 cancel RR02 REVISION` | Existing cancellation permissions |

Read commands use the same approved tournament records as the site/Hub. They do not require the reader to be a linked captain and do not create collection requests, schedules, reports or notifications. The existing bot authentication remains required.

Completed fixtures and already-published games cannot queue another collection request through the command. An unrelated admin gets the admin reporting link rather than a misleading player collection failure; admins registered as floaters retain the existing collection path. The normal collector still validates that the actual reporting account played when uploading. A numeric League Game ID is still required for client collection; an opaque Lzyumi ID is not interchangeable.

## Provider integration remains separate

The Lzyumi value captured in the browser is a session/login token, not a permanent public API key. The reference client can construct the new signed requests, but live runtime connectivity and token acquisition/renewal are not yet proven. These commands do not claim that Lzyumi lookup is enabled and do not send provider credentials to the Hub renderer or KOOK users.

Preferred next architecture: Coach and the Hub request a provider lookup through one authenticated tournament service; a private worker holds its own authorized provider session, fetches history/details, validates the exact fixture/lineup and saves a pending report. Admin approval then changes results, standings and player statistics together. If the intended server cannot reach Lzyumi, test retrieval in an admin's native Hub with a private session and submit through the same tournament service. Do not distribute a shared provider session token in the public Hub installer.

All report writes remain event-scoped in `tournament_*` records. No migration, inhouse result or LP change is involved. The service never treats a provider error as approval or publishes without review.

## Verification

Focused tests cover remaining/all fixture views, ties, pending-result exclusion, partial Bo3 results, authenticated routing, no writes for read commands, duplicate collection prevention, and preserving player/admin/floater reporting paths. Existing adapter tests check trusted identity forwarding and notification acknowledgement without posting live KOOK messages. Live command checks must invoke the service directly; they do not send channel messages.
