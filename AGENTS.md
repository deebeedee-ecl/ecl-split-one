<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Lzyumi / China League data

- Lzyumi is this project's primary external source for China League of Legends profile, rank, and match data. Treat it as the China-server equivalent of the Riot/OP.GG data source before proposing a companion application.
- Lzyumi may block cloud/server IPs. The established flow is: request a short-lived signed URL from `/api/lzyumi-sign`, then fetch that URL in the user's browser so the request uses the user's residential IP.
- A companion application is not required for ordinary profile/rank/history refreshes while the signed browser flow works. Do not claim otherwise without testing the Lzyumi flow first.
- For profile lookups, filter `1` supplies identity/profile/rank data, filter `2` supplies Solo/Duo history, and filter `3` supplies Flex history. `getPlayerRecentStat` is optional and may be unavailable; its failure must not invalidate an otherwise verified profile/rank snapshot or preserve stale champion data.
- Before saving or displaying a snapshot, verify the resolved full Riot ID, China server, and `openId`. Never mix fresh and stale snapshot sections or advance the displayed refresh time for data that was not replaced.
