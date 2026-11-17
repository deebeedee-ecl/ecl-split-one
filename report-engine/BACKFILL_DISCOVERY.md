# Retroactive inhouse discovery

This command performs a read-only search of Lzyumi histories and match details. It does not connect to or modify Supabase.

1. Copy `backfill-players.example.json` to `backfill-players.local.json`.
2. Replace the example players with every full Riot ID that may have participated in an ECL inhouse.
3. Add only operator-reviewed provider game IDs under `knownGameIds`.
4. Run the discovery inside the report-engine container:

```sh
npm run discover:inhouse -- --players ./backfill-players.local.json
```

Optional overrides:

```sh
npm run discover:inhouse -- \
  --players ./backfill-players.local.json \
  --since 2026-10-18 \
  --until 2026-11-06 \
  --all-count 100 \
  --known-game provider-game-id-from-reviewed-evidence \
  --output ./inhouse-discovery-october
```

The command refuses to replace an existing JSON/CSV pair unless `--overwrite` is
passed explicitly. Output contains provider payloads and player identities: keep it
local, do not commit it, and do not paste the unrestricted files into chat or logs.

By default, history rows are prefiltered by Lzyumi's localized custom-game label before detail requests are made. Pass `--all-games` only for a slower audit of every game in the date range.

The command produces a JSON file with the complete provider payload and a CSV review sheet. Candidate statuses are:

- `HIGH_CONFIDENCE`: 10 supplied ECL players and a provider custom-game marker.
- `REVIEW`: at least 8 supplied ECL players, or an explicitly supplied known game ID.
- `EXCLUDE`: outside the requested date range or fewer than 8 supplied players.
- `ERROR`: the match detail could not be retrieved.

Check `coverage[].oldest` in the JSON result. If active players do not reach October 18, increase `allCount` or add lower-volume players whose histories cover the missing dates.

Discovery intentionally stops before database import. The worker queries complementary participant detail variants until it has a complete ten-player detail or exhausts the bounded source set, then merges only non-conflicting identities. This reduces false partial results without weakening review.

After reviewing candidates, copy `manual-inhouse-import-review.example.json` to an ignored `inhouse-discovery-*.json` file and list only the approved provider game IDs. Prepare the immutable import manifest from the repository root:

```sh
npm run inhouse:import:prepare -- \
  --discovery=report-engine/inhouse-discovery-example.json \
  --review=report-engine/inhouse-discovery-example-review.json \
  --output=report-engine/inhouse-discovery-example-manifest.json
```

The permanent backend workflow and production approval rules are documented under **Manual ranked-inhouse import** in `docs/RUNBOOK.md`. `lzyumiGameId` remains the durable idempotency key. Discovery and manifest preparation never connect to the ECL database.

## Tournament exclusions

`ranked-inhouse-exclusions.json` is applied by default. It contains official ECL tournament games that may look like inhouses because they are also custom games, but must never affect the ranked inhouse archive or ladder. A match is excluded by its provider ID when available, otherwise by its official start time plus duration.

To use a different file, set `excludedGamesFile` in the player config. Keep the path relative to that config file.

