import assert from "node:assert/strict";
import test from "node:test";
import {
  identityIntegrityIssues,
  parseManifest,
  publicManifestSummary,
} from "../scripts/preflight-split-ii-result";

function manifest() {
  return {
    fixtureCode: "rr06",
    gameNumber: 1,
    leagueGameId: "12345678901",
    providerId: "provider-detail-id",
    platform: "HN1",
    winnerTeamKey: "home",
    playedAt: "2026-11-08T19:23:04+08:00",
    durationSeconds: 1698,
    players: Array.from({ length: 10 }, (_, index) => ({
      teamKey: index < 5 ? "home" : "away",
      riotId: `Player${index + 1}#${String(index + 1).padStart(5, "0")}`,
      champion: String(index + 1),
      items: [0, 0, 0, 0, 0, 0, 0],
      kills: 1,
      deaths: 1,
      assists: 1,
      damage: 1,
      gold: 1,
      position: ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"][index % 5],
      ...(index === 0 ? { mvp: true } : {}),
    })),
  };
}

test("manifest validation produces a bounded non-identity summary", () => {
  const parsed = parseManifest(manifest());
  const summary = publicManifestSummary(parsed);
  assert.equal(parsed.fixtureCode, "RR06");
  assert.equal(summary.playerCount, 10);
  assert.equal(summary.completeStatLines, 10);
  assert.equal(summary.mvpCount, 1);
  assert.equal(JSON.stringify(summary).includes("Player1"), false);
});

test("manifest validation rejects a non-boolean MVP flag", () => {
  const value = manifest();
  (value.players[0] as Record<string, unknown>).mvp = "false";
  assert.throws(() => parseManifest(value), /mvp must be a boolean/);
});

test("manifest validation accepts a provider-only guest substitute recovery", () => {
  const value = manifest();
  value.leagueGameId = null as unknown as string;
  (value.players[4] as Record<string, unknown>).guestSubstitute = true;
  const parsed = parseManifest(value);
  const summary = publicManifestSummary(parsed);
  assert.equal(parsed.leagueGameId, null);
  assert.equal(summary.providerIdPresent, true);
  assert.equal(summary.guestSubstituteCount, 1);
  assert.equal(JSON.stringify(summary).includes("Player5"), false);
});

test("identity integrity accepts a coherent tournament snapshot and openId key", () => {
  assert.deepEqual(identityIntegrityIssues({
    suppliedRiotId: "Player Name#12345",
    riotNameSnapshot: "Player Name",
    riotTagSnapshot: "#12345",
    chinaServerIdSnapshot: 1,
    gameIdentityKey: "1:stable-open-id",
    profile: {
      riotName: "Player Name",
      riotTag: "12345",
      chinaServerId: 1,
      openId: "stable-open-id",
    },
  }), []);
});

test("identity integrity blocks missing openId, stale key, server drift and Riot ID drift", () => {
  assert.deepEqual(identityIntegrityIssues({
    suppliedRiotId: "Unexpected#99999",
    riotNameSnapshot: "Registered",
    riotTagSnapshot: "12345",
    chinaServerIdSnapshot: 1,
    gameIdentityKey: "1:old-open-id",
    profile: {
      riotName: "Renamed",
      riotTag: "54321",
      chinaServerId: 2,
      openId: null,
    },
  }), [
    "SUPPLIED_RIOT_ID_MISMATCH",
    "IONIA_IDENTITY_MISMATCH",
    "OPEN_ID_MISSING",
    "CURRENT_RIOT_ID_DRIFT",
  ]);

  assert.deepEqual(identityIntegrityIssues({
    suppliedRiotId: "Registered#12345",
    riotNameSnapshot: "Registered",
    riotTagSnapshot: "12345",
    chinaServerIdSnapshot: 1,
    gameIdentityKey: "1:old-open-id",
    profile: {
      riotName: "Registered",
      riotTag: "12345",
      chinaServerId: 1,
      openId: "new-open-id",
    },
  }), ["GAME_IDENTITY_KEY_MISMATCH"]);
});
