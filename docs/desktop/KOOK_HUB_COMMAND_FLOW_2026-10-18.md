# KOOK and Hub command flow — local implementation

The owner approved implementing the proposed bot responses and reminders, then
chose a pinned KOOK installer instead of website hosting. Installer channel:
**ECL HUB DESKTOP APP**, ID **5590769063605712**. No download website/page or
new installer publication is included. The bot directs players to that channel
by its name and ID; it does not claim a public download URL exists.

## Player commands

- `!hub`: installer location and sign-in → League connection → Collector >
  Connect reporting instructions. All ten players need verified profiles;
  only the participating designated reporter needs collection running.
- `!help`/`!commands`: short app flow and primary commands. Compatibility
  aliases remain, but `!forceready` no longer bypasses ranked verification.
- `!inhouse`: existing count/roster check with a warning that at least one
  participant needs Hub installed, signed in, League connected and reporting
  enabled. The warning includes the pinned installer channel.
- `!ready`: ten verified active Ionia profiles with complete Riot IDs; balance,
  save the roster, return voice move instructions and the IH number. An admin's
  ordinary ready cannot bypass these checks. IH label allocation is serialized.
- `!report`/`!report IH`: select a pending session and show the exact command.
  Multiple sessions require an explicit IH number. Numeric selectors match the
  actual label, never an unstable position in a list.
- `!report IH GAME_ID`: request collection from the **sender's** verified,
  allowlisted Hub identity. The reporter must be a roster participant. Responses
  distinguish waiting, collecting, awaiting review, reviewed, rejected, expired
  and cancelled; they do not fabricate app-online presence.
- `!status IH`: selected session's game, reporter and current saved stage.
- `!no IH`: cancel only the sender's unsubmitted collection request. A bare
  `!no` can select one request, but asks for a selector if multiple exist. It
  cannot delete received review data or cancel the ready roster.
- `!cancel IH`: admin-only cancellation of a specified active roster and its
  pending/collecting jobs. No implicit globally-newest-session cancellation.
- `!yes`/`!confirm`: explain the app review flow; never submit legacy previews.
  Legacy result ingestion also refuses marked Hub sessions/jobs, including an
  admin override through the old endpoint.
- `!me`, `!rank` and `!leaderboard` retain the shared ladder reads. The separately
  prepared 800 LP reset is not activated by these bot changes.

The bot forwards all arguments for report/status/cancel, reports voice movement
only when instructions were supplied and moves actually succeeded, and schedules
one reminder after 60 seconds if the **same job** remains unclaimed. The reminder
is best effort in bot memory, not a durable outbox; a bot restart can lose it.
Authoritative progress remains available through `!status IH`.

## Review lifecycle, with no automatic LP

```text
ASSIGNED + DESKTOP_PENDING
→ DESKTOP_COLLECTING
→ session AWAITING_REVIEW + job DESKTOP_REVIEW
→ administrator marks reviewed or rejects
→ session REVIEWED / REJECTED + job DESKTOP_REVIEWED / DESKTOP_REJECTED
```

Receiving an upload frees the voice lobby for another ready roster while keeping
the uploaded match independently reviewable. Repeated submission is idempotent.
Game IDs remain reserved across pending review, reviewed, rejected and expired
review records. No match, match-stat or player-rating writes occur in this flow.

`/admin/desktop-reports` shows the latest 20 waiting uploads and all ten players'
name/tag, side, champion ID, K/D/A, damage and gold. The existing protected API now
supports same-origin, strongly authenticated review decisions. Rejection needs
a note. Decisions retain a timestamp, reason and the shared-admin actor label;
there are no individual named admin accounts in this existing session scheme.

**Mark reviewed · no LP** is a review receipt, not official match acceptance or
scoring. Choosing MVP/SVP, creating official history and an explicit authoritative
LP application remain separate future work. Rejected/reviewed raw payloads still
follow the existing 30-day retention policy.

The native reporter source also now reclaims an expired collection lease before
uploading a slowly collected match. That change is for a future installer;
the frozen 1.0.1 installer was not rebuilt or modified.

## Files and verification

Website: new command/copy/review services, KOOK routes, desktop reporting and
review UI. Removed unused KOOK provider-report lookup/confirmation code.
Bot project: `C:/Users/muiri/Desktop/ECL/ECL-Bot/bot.js`.
The sibling project's unrelated `refresh-worker.js` was not changed.
Before-edit source backup: `.tmp/hub-bot-flow-backup/`.
Isolated review/build source: `.tmp/hub-bot-flow-review/` plus hash manifest.
The review copy excludes unrelated profile refresh changes and the pending LP
formula reset; it uses dummy settings for local build/UI verification.

Verification: 41 combined fake-store backend/ranking/lifecycle/view tests,
three bot adapter tests with mocked HTTP/timers, 83 desktop tests passed and one
optional signature probe skipped. Root TypeScript and scoped ESLint passed.
The existing signed 1.0.1 release check was rerun successfully.
The isolated production build passed. A local automated browser with synthetic
reports verified the protected admin queue, all ten rows, required rejection
note, 1280px/390px layouts, the no-LP review action and the empty queue afterwards.
Screenshots are private local artifacts under `.tmp/hub-review-ui/`.

## Installer to pin

`companion/release-test-101/ECL-Hub-Setup-1.0.1.exe`

119,270,898 bytes. SHA-256:
`97bce4cb80a3889f87eb2653c6ac27ab58e392897d0e41666bf08a04d05a3730`.
Users only need the EXE to install. Keep the signing/update metadata for ECL's
own release process; it is not required as a separate tester download.
The pinned EXE does not activate undeployed reporting server code.

Suggested pinned message:

```text
ECL Hub Desktop App — Windows tester build 1.0.1

Download the attached EXE, install and sign in with your ECL account.
Open League and check Hub is connected. For the enabled reporting pilot:
Collector > Connect reporting.

After your ranked inhouse: !report IH_NUMBER GAME_ID
The person sending this command needs their own Hub connected.
Uploads require administrator review. No automatic LP.

If League runs as administrator, keep the installer's administrator
launch option selected. Windows may ask for administrator approval.
```

## Activation still pending

No bot restart, website deployment, production configuration, database write or
schema change was performed locally. Deploy the server and bot together after
approval, with `ECL_DESKTOP_REPORTING_ENABLED=1`, explicit reporter profile IDs,
the existing strong link/admin secrets and KOOK notifier configuration, and the
approved retention job configured. Do not copy test credentials to production.

The new bot commands intentionally stop using old player `!yes` scoring. This
affects bot reporting for everyone, while the pilot upload allowlist still
restricts designated reporters; make sure each test lobby has an enabled reporter
before switching the bot. Do not restart the bot alone against the old website.
No new schema is needed: statuses use existing string fields and existing JSON.
Real KOOK/Hub collection/upload/concurrency still needs an enabled pilot test.
