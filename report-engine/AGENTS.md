# Report engine instructions

This folder is an independently deployed Node.js worker. It discovers China-server match evidence for an existing ECL inhouse report job; the website/API remains the authority that validates and commits the result.

## Required behavior

- Preserve job claim/lock/retry semantics. Assume a worker or network call can fail after either side has acted.
- Never make result application depend on exactly-once delivery. Return stable provider game IDs and enough identity/roster evidence for the web API to deduplicate and revalidate.
- Lzyumi is the primary provider when configured. Keep concurrency conservative and provider-code-`7` retries bounded with backoff.
- Verify the resolved full Riot ID, China server, and `openId`; never combine candidates from different identities.
- Treat WeGame as an explicit configured/fallback path, not evidence that every user needs the companion.
- Never log or commit provider tokens, cookies, passwords, proxy credentials, local browser profiles, or unsanitized player payloads.

## Verification and operations

- Run `npm test` for changes in this folder.
- Use the documented `--check-player` path only as an approved read-only probe with an approved test identity.
- Discovery/backfill output is local evidence. Do not submit it to ECL or claim live jobs without explicit authorization.
- Do not deploy or alter Railway variables without explicit user approval.
