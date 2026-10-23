# Split II roster loading incident — October 23, 2026

The owner reported that the main player and floater lists disappeared behind
"The roster couldn't load." Public read-only checks reproduced intermittent
HTTP 503 responses between HTTP 200 responses containing 25 main players and
5 floaters. The saved entries were present. The underlying hosting/database
exception was not available from the public response, so its exact cause was
not confirmed.

The previous UI hid both lists on any refresh error. It also cleared its loaded
state on every authentication event, including a token refresh for the same
user. This made a temporary read failure look like missing registrations.

Recovery changes:

- Retry one GET after a known transient Prisma connection or pool error.
  Permanent configuration failures and registration POSTs are not retried.
- Client roster GETs retry one network/502/503/504 failure, with a ten-second
  timeout per attempt. Overlapping background reads are skipped.
- Keep successfully loaded rosters visible during refreshes and failures;
  show a warning and manual retry when the retained data could be stale.
- Retain loaded state during same-user token refreshes. Clear it when the
  account changes or signs out. Signup remains disabled until a read succeeds.
- Log safe Prisma error codes for future diagnosis without raw errors,
  profile data, tokens or query text.

Client regression checks cover transient failure/recovery, retained main and
floater lists, same-user token rotation, account-switch privacy, no unauthorized
read retry and no automatic POST retry. The isolated PostgreSQL suite covers
transient connection/pool errors and the existing eligibility, consent,
capacity, immutable snapshot and separate-pool rules. No live database writes
or schema changes were made for this fix.
