# Hub source review and next verification

Reviewed October 18, 2026 (Asia/Shanghai), against HEAD `b127def`.
This is a local follow-up to `HUB_HANDOFF_2026-10-18.md`. No commit, push,
deployment, database operation, key export, installer build or publication was
performed. This review covers source boundaries and selected reliability and
authorization paths; it is not a full security audit or live pilot result.

Subsequent owner decision: approved the scoped native-source commit and a
tester installer, with version explicitly set to **1.0.0**. The commit manifest
now contains 60 files including `TESTER_BUILD_1.0.0.md`; package/lock versions
and current README/roadmap/update pointers were updated for that request. The
59-file proposal and 0.9.2 source-version statements below are the earlier
review checkpoint. See the tester guide for final build verification; this
does not include approval for the separate backend groups.

## Preserved baseline

Before editing, copied 72 explicitly selected Hub source/document/backend files
to the Git-ignored local directory:

`backups/hub-source-review-2026-10-18-96deeb09/`

`MANIFEST.json` records HEAD, byte lengths and SHA-256 for every copied file.
Every copied file was verified against its manifest. This is a same-PC source
snapshot, not an off-device disaster-recovery backup or a signing-key backup.
It contains neither installers nor environment files nor local player storage.
The later regression fixes and this review document are outside that snapshot.

The initial 57-file desktop/document candidate set contained no private-key
material, credential-shaped literals, non-public JWTs or generated release
filenames under the checks run. The remaining selected backend files were also
checked for private-key material and credential-shaped literals. These are
limited pattern checks, not a guarantee that arbitrary secrets cannot exist.

## Local fixes after the baseline

1. `companion/src/core.cjs`: after an LCU 401/403, invalidate the displayed
   connection/player/phase together with the in-memory connection. Previously a
   recent Lobby status could remain visible and pass the restart guard despite
   authentication having failed. The phase now becomes Unknown until discovery
   succeeds. Pending jobs and their bounded retry schedule are preserved.
2. `companion/src/reporting.cjs`: ignore a late result or error from a superseded
   connection attempt. Previously a late successful response disconnected the
   newer session; a late failure could reject using the newer session's status.
   Current-generation failures still disconnect and report an error.

Three regression cases failed before the fixes and pass afterward. They cover
LCU authentication failure followed by offline app restart and recovery with a
new port/token, plus both success and failure of an obsolete reporting attempt.
The collector recovery case also checks one saved match and absence of the new
LCU token from persisted state.

These fixes are source-only. They are not installed in the running 0.9.2 app.
The package version remains 0.9.2 while the next release is undecided. Never
rebuild or publish changed code under the already-published 0.9.2 filenames.

## Proposed commit boundaries

Nothing is staged. `SOURCE_COMMIT_FILES.txt` is the exact proposed first commit
manifest, not a command to stage anything.

### A. Native Hub source and checkpoint documents (59 files)

- The 54 source, asset, dependency-lock, test, build and release-tool files under
  `companion/` named in the manifest.
- The current handoff, reporting/data setup documentation, this review and the
  manifest itself under `docs/desktop/`.
- Includes the two local reliability fixes and three regression cases above.
- Includes the desktop reporting client, which requires explicit session
  consent and handles an unavailable server. This does not include its server
  endpoints or enable production reporting.

Suggested title: `Preserve ECL Hub source and harden collector reconnection`.

### B. Review-only reporting backend (separate review/approval)

```
app/api/admin/desktop-reports/route.ts
app/api/desktop/reports/route.ts
lib/desktop-report-policy.ts
lib/desktop-reports.ts
lib/kook-commands.ts
lib/kook-notifier.ts
scripts/test-desktop-reporting.ts
```

### C. Snapshot freshness and raw-data lifecycle (separate review/approval)

```
app/api/account/refresh-stats/route.ts
app/api/jobs/desktop-retention/route.ts
lib/account-stats-on-open.ts
lib/account-stats-refresh.ts
lib/desktop-retention.ts
lib/lzyumi-refresh-queue.ts
scripts/test-desktop-lifecycle.ts
vercel.json
```

Keep `docs/ECL_SPLIT_II_HANDOFF.md`, root `package.json`, the two standalone local
collector/probe scripts and all other miscellaneous untracked scripts out of A,
B and C. Root package changes only add the standalone collector/probe commands;
the native desktop source has its own package manifest and lockfile.

Committing A locally does not authorize pushing it: a push may trigger the
website's deployment pipeline. No groups are approved for commit/deployment by
this document.

## Verification run in this follow-up

| Check | Result |
| --- | --- |
| Desktop suite, after fixes | 80 passed; one optional installer probe skipped |
| Isolated view/update-host/lifecycle/reporting suite | 20 passed; fake stores only |
| Root TypeScript, no emit and no incremental output | Passed |
| Targeted backend/test ESLint | No errors; six unused-symbol warnings in `lib/kook-commands.ts` |
| Frozen `release-pilot-092` verification | Passed: version, pinned trust, signature, installer size/hash and checked verifier sources |
| Snapshot manifest verification | 72/72 copies match their SHA-256 |
| Live custom-game collection | Pending; no League process was running at inspection |

The frozen release verifier reported version 0.9.2, installer size 128,827,446
bytes and key ID
`3cf2cd25cca9e10a6ef8c57180bd3c6dbb4da780922bcef8a2a174acd879027f`.
It did not access the private key, execute the installer, fetch the public feed
or rebuild the package. Its historical `verified-locally-not-published` output
label describes that tool's local-only operation; the handoff already records
the earlier approved publication and successful installed upgrade.

## Next real collector check

Use the installed 0.9.2 app for the currently distributed baseline. The new
source fixes require a separately approved next-version build to validate in an
installed app. Do not silently replace the installed executable with a preview.

1. On the player's Windows PC, open League and Hub. Check the detected player
   and intended server; keep KOOK reporting disconnected for this local test.
2. Complete one fresh custom Summoner's Rift 5v5 and record its Game ID. Confirm
   the actual expected ten players, sides and winner from the game.
3. Collect that exact Game ID in Hub. Record whether retrieval succeeds or goes
   into retry, with its sanitized status. A Tencent timeout is a failed/pending
   collection check, even if the League connection succeeds.
4. Inspect only that saved record locally: Game ID, completion, map/mode, both
   teams of five, one winner, distinct identities joined by participantId and
   actual kills/deaths/assists/damage/gold/vision. Compare against the real game;
   missing statistics must be reported as missing. Do not paste raw JSON,
   player identifiers or LCU tokens into chat or public storage.
5. Re-enter the same ID, restart Hub and rediscover recent history. There must
   be one saved record per collector identity/region/Game ID. Confirm it remains
   readable after restart.
6. Test League restart/reconnection, then a temporary backend/network failure
   with a pending request. Verify it survives a Hub restart and later retries
   successfully. Existing isolated tests exercise these paths with synthetic
   responses; the real-provider check remains outstanding.

## Conditions before the KOOK upload pilot

- Deploying/enabling reporting and retention still requires explicit approval.
  Make private server storage, authenticated cleanup and backlog visibility
  ready before enabling real uploads. Daily cleanup is currently bounded to
  200 records per invocation; verify the observed volume fits that limit.
- A reporter must be verified, active, linked to KOOK, an Ionia roster
  participant and on the pilot allowlist. The reporter need not be the ready
  author. All ten saved roster identities must still match verified profiles.
- Existing protected administrator reads provide summaries and individual raw
  review data. There is no administrator review UI or official approval/scoring
  endpoint in this pilot. Establish who reviews records and how before testing
  an actual upload. Receipt must never award points automatically.
- Test competing requests, duplicate submissions, expired leases, cancellation,
  wrong Game IDs/sides and lost notification responses in an approved isolated
  PostgreSQL integration environment. Fake-store tests do not establish actual
  PostgreSQL concurrency behavior.
- Verify the live bot forwards both IH number and Game ID. Check how globally
  enabling the desktop branch affects non-allowlisted reporters; do not assume
  legacy reporting remains available to them while the flag is enabled.
- Add rate limits, notification retry/outbox and administrator operational tools
  before broader distribution. Identity/roster matching does not attest that a
  submitted raw record was produced by Riot/Tencent.
- Establish a portable, separately protected signing-key recovery procedure and
  perform a restore drill before broader distribution. The existing Windows
  encrypted key file alone does not provide portable recovery. No recovery
  export or key rotation was performed here.

Some older README/roadmap sections still describe earlier prototypes or an
unfinished updater. Use the latest handoff and this review for current status;
do not apply historical deployment/version instructions as current commands.
Split II remains a separate mock-first track with no database approval.
