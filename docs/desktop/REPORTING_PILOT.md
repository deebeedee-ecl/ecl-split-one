# ECL Hub Desktop Reporting Pilot

## Status

Implemented locally; not deployed or enabled in production. See `KOOK_HUB_COMMAND_FLOW_2026-10-18.md` for the newer approved command responses, pinned KOOK installer channel, targeted cancellation and review queue. No database schema changes are needed. The user explicitly approved uploading assigned match JSON (all ten in-game names, PUUIDs and statistics) to `https://eclchina.lol` for storage and administrator review. This approval is not a substitute for notifying participants and establishing the event's data/retention policy before a wider rollout.

This is a **review-only Ionia pilot**, not automatic scoring or independent proof of League account ownership. New bot app-report commands give setup instructions when `ECL_DESKTOP_REPORTING_ENABLED` is not `1`; they do not silently fall back to legacy scoring. Deploy the website and bot together and ensure a designated allowlisted reporter is available for each pilot lobby.

## Player Flow

1. All ten players have verified, active ECL profiles with KOOK IDs and exact Ionia Riot names/tags.
2. One participant installs the pinned ECL Hub installer from KOOK's **ECL HUB DESKTOP APP** channel (5590769063605712), signs in, opens League on the same PC and checks Collector's detected account. The frozen tester installer is 1.0.1.
3. In Collector, choose **Connect reporting**. The native consent dialog names the HTTPS destination, identifiers, ten-player match data and server storage. Cancel is the default. Approval lasts only for this app session; no reporting token is persisted.
4. In KOOK use `!inhouse`, confirm the roster and use `!ready`. Follow the assigned blue/red sides and play the custom Summoner's Rift match.
5. The participant who will collect it sends `!report 27 11363615233`, replacing 27 with the IH number and the second number with the actual League Game ID. `!report 27` gives the instruction or existing request status. A bare Game ID is not currently a supported bot conversation.
6. The request is assigned to that command sender's verified KOOK/ECL profile, not automatically to the `!ready` author. A different reporter/Game ID for an active request requires cancellation or admin intervention.
7. Their app polls every 30 seconds while connected, claims only their job, collects that exact Game ID through the local League API and uploads only that record. Existing local matches can be reused. General automatic collection is an independent setting; reporting does not upload all recent history.
8. Server checks the ten-player ready roster, currently verified profiles, sides, reporter participation, unique PUUIDs, completion, custom mode/map, Ionia platform `HN1`, timing and duplicates. Accepted uploads enter `DESKTOP_REVIEW` and do not write results, LP, ELO or official histories.
9. A KOOK notification is attempted; if unavailable, `!report 27` or `!status 27` returns the saved review status. `!no 27` cancels only the sender's unsubmitted request; `!cancel 27` is admin-only roster cancellation. Uploads move the session to AWAITING_REVIEW so the next lobby can start. The admin review queue records reviewed/rejected decisions without results or LP. There is no desktop `!yes` scoring path.

Collector **Preview example match** is synthetic UI data only: no file/job is created, it does not increment collected counts and it cannot be uploaded. `--demo --preview-match` opens a separate sample profile directly on that scoreboard.

## Server Setup (Requires Deployment Approval)

Configure these server-only variables in the existing website hosting environment, never in Electron or `NEXT_PUBLIC_*`:

```dotenv
# Keep disabled until the deployment, credentials and review procedure are ready.
ECL_DESKTOP_REPORTING_ENABLED=0
# A new cryptographically random secret, at least 32 characters. Do not reuse a password.
ECL_DESKTOP_LINK_SECRET=
# Comma-separated ECL AccountProfile IDs for the initial reporters. Empty denies everyone.
ECL_DESKTOP_REPORTER_PROFILE_IDS=
# Strong existing admin session secret, at least 32 characters, for protected review reads.
ADMIN_SESSION_SECRET=
# Existing server bot token is required for outbound KOOK notifications.
KOOK_BOT_TOKEN=
```

The existing Supabase JWT authentication, database connection and incoming bot authentication are reused. The pilot requires an explicit allowlist of authenticated reporter profile IDs; an empty list denies everyone. All ten participants still require verification, but only designated collectors need this allowlist. Do not expose the bot token/global worker secret to clients. `companion/config.cjs` still packages only approved public Supabase configuration; server secrets are not bundled.

Deploy the reviewed website changes first. Verify disabled API requests return 503, enable the pilot only for a small informed group, and test one real match with the correct signed-in participant. A new app alone cannot activate the undeployed server endpoint. No Ubuntu worker is required.

## Review and Safety

- `POST /api/desktop/reports` supports link, claim and submit. Uses verified Supabase user IDs, not client-supplied owner/KOOK IDs. POSTs are bounded to 2 MiB; responses are non-cacheable. Only fixed-origin HTTPS is used by the app.
- The signed, user-bound consent capability expires after ten minutes and is renewed only during an active consented session. It verifies that the claimed Riot name/tag matches the profile, **not** that the desktop JSON or PUUID is attested by Riot/Tencent. Never remove manual review on this basis.
- Existing `InhouseReportJob` rows use separate `DESKTOP_*` statuses. Legacy worker claims cannot pick them up. Serializable transactions and conditional updates guard competing claims/submissions; leases last two minutes, requests one hour, with at most 20 claims.
- `/admin/desktop-reports` shows the review queue. `GET /api/admin/desktop-reports` lists the latest 20 waiting summaries; `?jobId=...` includes that record's raw JSON. Admin middleware and an explicit strong admin session secret protect these reads. Same-origin `POST` records reviewed/rejected decisions only, preserving data and awarding no LP. An authoritative final-scoring workflow and MVP/SVP selection remain future work.
- Signing out or switching ECL/League identities disconnects future uploads. Disconnect/Quit aborts in-flight client requests but cannot retract data already received by the server. Local collection jobs remain local and may finish separately.
- A 30-day raw retention policy is approved and implemented locally. The protected daily purge remains disabled until Vercel configuration/deployment; local raw files expire when Hub runs. Review-expired uploads are scrubbed without awarding points, with minimal duplicate-check identifiers retained. See `UPDATE_AND_DATA_SETUP.md` before pilot activation. An in-app erasure endpoint is not implemented. Restrict raw record access, never post PUUIDs publicly and never copy production tokens into diagnostics.
- Add server-side per-user rate limits, a notification outbox/retry policy and operational review/cancellation tools before broad distribution. The current pilot limits body size, request lifetime and claim attempts, but does not replace these controls.

## Verification

```powershell
node --import tsx --test scripts/test-desktop-reporting.ts
cd companion
npm.cmd test
```

Tests use fake profiles, fake match records and a fake transactional store. No production database calls or match uploads are performed. A real PostgreSQL concurrency/integration test, authenticated live pilot, KOOK notification and client-restart test remain required before public rollout. The production bot may be hosted separately; verify it forwards the complete `!report IH GAME_ID` command to the existing website command route.
