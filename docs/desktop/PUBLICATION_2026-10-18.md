# News publication and runtime source backup

On 18 October 2026 the owner authorized publishing the Patch 2.2 and ECL Hub
articles and committing/pushing the remaining relevant source.

## Published on main

Commit `21032de0d9fb5ac99914a4bc034a376bc5826713` publishes:

- https://eclchina.lol/news/patch-2-2
- https://eclchina.lol/news/meet-ecl-hub

Both URLs returned HTTP 200 and passed the production browser checks at desktop
and mobile sizes. The existing Hub news parser extracts both posts from `/news`,
so installed clients receive them through refresh without a new installer.
The earlier 1.0.0 and 1.0.1 installer source commits were pushed with main.
No binary was uploaded or update-feed version changed by this publication.

## Runtime changes kept separate

Website branch: `codex/hub-ranked-and-reporting`.
Bot repository branch: `codex/hub-reporting`, commit `d9a2df6`.

These preserve the season scoping and normal opening-game LP formula, Hub
reporting/admin review, snapshot freshness and 30-day desktop retention source,
along with native source improvements and tests. They are not merged into main.
The bot was not restarted. No season flags, reporting allowlist, database schema
or production records were changed. The news therefore describes these as an
upcoming rollout.

Before activation, follow the ranked reset and reporting pilot handoffs and
verify a real ten-player custom game end to end. Review-only uploads do not
create official match results or award LP. Source changes after the frozen
1.0.1 installer need a future installer version before distribution.

## Verification and workspace

- Isolated news production build and TypeScript passed.
- News desktop/mobile layout, metadata, sitemap, unknown-post 404 and Hub feed
  checks passed locally and against production.
- Ranked, lifecycle, desktop reporting and KOOK flow tests: 36 passed.
- Bot adapter checks: 3 passed. Native unit tests: 83 passed, 1 optional skip.
- The combined runtime branch was built separately using dummy service settings.

The owner's original working directories retain their edits; reviewed files
are committed in separate worktrees under `.tmp`. Unrelated Split II handoff
edits, local collector/probe helpers and ad hoc database repair scripts remain
local and are excluded. The bot's untracked `refresh-worker.js` is excluded.
