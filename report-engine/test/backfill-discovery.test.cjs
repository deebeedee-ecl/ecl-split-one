"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  candidatesCsv,
  classifyCandidate,
  customGameEvidence,
  findExcludedGame,
  normalizeDiscoveryPlayers,
  parseLzyumiGameTime,
} = require("../backfill-discovery.cjs");

const knownPlayers = Array.from({ length: 10 }, (_, index) => ({
  displayName: `Player ${index + 1}`,
  riotName: `Player ${index + 1}`,
  riotTag: "ECL",
  chinaServerId: 1,
  openId: "",
}));

test("normalizes string and object player entries and removes duplicates", () => {
  assert.deepEqual(normalizeDiscoveryPlayers([
    "Kasper#82130",
    { riotId: "Kasper#82130" },
    { riotName: "Another", riotTag: "CN1", areaId: 14 },
  ]), [
    { displayName: "Kasper#82130", riotName: "Kasper", riotTag: "82130", openId: "", chinaServerId: 1 },
    { displayName: "Another#CN1", riotName: "Another", riotTag: "CN1", openId: "", chinaServerId: 14 },
  ]);
});

test("parses Lzyumi China timestamps into UTC", () => {
  assert.equal(
    parseLzyumiGameTime({ titleTime: "11-05 19:03:45" }, new Date("2026-10-18T00:00:00Z")).toISOString(),
    "2026-11-05T11:03:45.000Z",
  );
});

test("classifies an exact labelled custom roster as high confidence", () => {
  const detail = {
    data: {
      gameType: "CUSTOM_GAME",
      gameMode: "CLASSIC",
      mapId: 11,
      endOfGameResult: "GameComplete",
      wgBattleDetailInfo: knownPlayers.map((player) => ({ nickNameStr: `${player.riotName}#${player.riotTag}` })),
    },
  };
  const candidate = classifyCandidate({
    game: { gameId: "11442067974", title: "\u65b0\u6a21\u5f0f", titleTime: "11-05 19:03:45" },
    detail,
    knownPlayers,
    since: new Date("2026-10-18T00:00:00Z"),
    until: new Date("2026-11-06T15:59:59Z"),
    knownGameIds: new Set(["11442067974"]),
  });
  assert.equal(candidate.reviewStatus, "HIGH_CONFIDENCE");
  assert.equal(candidate.rosterMatchCount, 10);
  assert.equal(candidate.knownGameId, true);
  assert.match(candidatesCsv([candidate]), /11442067974/);
});

test("does not treat an explicitly matched game as custom from its localized title", () => {
  const evidence = customGameEvidence(
    { title: "\u65b0\u6a21\u5f0f" },
    { data: { gameType: "MATCHED_GAME", gameMode: "SWIFTPLAY" } },
  );

  assert.equal(evidence.explicitNonCustom, true);
  assert.equal(evidence.lzyumiLabel, true);
  assert.equal(evidence.isCustomCandidate, false);
});

test("excludes a tournament match before ranked inhouse classification", () => {
  const game = {
    gameId: "provider-tournament-id",
    title: "\u65b0\u6a21\u5f0f - \u7528\u65f641\u520615\u79d2",
    titleTime: "10-27 20:38:41",
  };
  const excludedGames = [{
    competition: "ECL Split II",
    matchCode: "RR05",
    playedAt: "2026-10-27T12:38:41.000Z",
    durationSeconds: 2475,
    reason: "Tournament match",
  }];
  const detail = {
    data: {
      gameType: "CUSTOM_GAME",
      wgBattleDetailInfo: knownPlayers.map((player) => ({ nickNameStr: `${player.riotName}#${player.riotTag}` })),
    },
  };

  assert.ok(findExcludedGame(game, new Date("2026-10-27T12:38:41.000Z"), excludedGames));
  const candidate = classifyCandidate({
    game,
    detail,
    knownPlayers,
    since: new Date("2026-10-18T00:00:00Z"),
    until: new Date("2026-11-06T15:59:59Z"),
    excludedGames,
  });
  assert.equal(candidate.reviewStatus, "EXCLUDE_TOURNAMENT");
  assert.equal(candidate.excludedCompetition, "ECL Split II");
  assert.equal(candidate.excludedMatchCode, "RR05");
});

