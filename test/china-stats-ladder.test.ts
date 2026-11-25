import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeChinaStatsLadderSnapshot } from "../lib/china-stats-ladder";

function source(platform = "HN1") {
  return {
    connected: true,
    platform,
    capturedAt: new Date(Date.now() - 60_000).toISOString(),
    results: [
      group("CHALLENGER", 200, 1, "Alpha#CN1"),
      group("GRANDMASTER", 500, 201, "Bravo#CN1"),
      group("MASTER", 10_000, 701, "Charlie#CN1"),
    ],
  };
}

function group(tier: string, rowCount: number, rank: number, riotId: string) {
  return {
    ok: true,
    queue: "RANKED_SOLO_5x5",
    tier,
    rowCount,
    rows: [{
      rank,
      riotId,
      tier,
      leaguePoints: 1800,
      wins: 100,
      losses: 70,
      profileIconId: 29,
      puuid: "must-not-leak",
      summonerId: 123456,
    }],
  };
}

test("normalizes an Ionia apex snapshot into the public projection", () => {
  const snapshot = normalizeChinaStatsLadderSnapshot(source());

  assert.ok(snapshot);
  assert.equal(snapshot.server, "ionia");
  assert.equal(snapshot.platformId, "HN1");
  assert.deepEqual(snapshot.coverage.map((item) => item.totalAvailable), [200, 500, 10_000]);
  assert.deepEqual(snapshot.rows.map((row) => row.riotId), ["Alpha#CN1", "Bravo#CN1", "Charlie#CN1"]);
  assert.equal("puuid" in snapshot.rows[0], false);
  assert.equal("summonerId" in snapshot.rows[0], false);
});

test("maps BGP2 to Super Server and rejects unknown or incomplete sources", () => {
  assert.equal(normalizeChinaStatsLadderSnapshot(source("BGP2"))?.server, "super-server");
  assert.equal(normalizeChinaStatsLadderSnapshot(source("UNKNOWN")), null);

  const incomplete = source();
  incomplete.results = incomplete.results.slice(0, 2);
  assert.equal(normalizeChinaStatsLadderSnapshot(incomplete), null);

  const stale = source();
  stale.capturedAt = new Date(Date.now() - 25 * 60 * 60_000).toISOString();
  assert.equal(normalizeChinaStatsLadderSnapshot(stale), null);
});

test("leaderboard route preserves account authorization and private identifiers", async () => {
  const route = await readFile(new URL("../app/api/china-stats/leaderboard/route.ts", import.meta.url), "utf8");

  assert.match(route, /getAccountFromRequest/);
  assert.match(route, /hasChinaStatsPreviewAccess/);
  assert.match(route, /status: 403/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.doesNotMatch(route, /puuid/i);
  assert.doesNotMatch(route, /summonerId/i);
});
