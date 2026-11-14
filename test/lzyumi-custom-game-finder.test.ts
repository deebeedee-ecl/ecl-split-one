import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateFinderCandidate,
  parseFinderGameTime,
  selectFinderHistoryCandidates,
  verifyFinderIdentity,
} from "../lib/lzyumi-custom-game-finder";

test("verified lookup accepts a bare-name response only for the exact full Riot identity and server", () => {
  const identity = verifyFinderIdentity({
    battleInfo: { nameInfoNew: "Peter#43636", openId: "private-open-id", areaId: 1 },
    data: [{ gameId: "game-1", titleTime: "11-12 20:00:00" }],
  }, "Peter#43636", 1);
  assert.equal(identity.resolvedRiotId, "Peter#43636");
  assert.equal(identity.history.length, 1);
  assert.throws(() => verifyFinderIdentity({
    battleInfo: { nameInfoNew: "Peter#OTHER", openId: "private-open-id", areaId: 1 },
    data: [],
  }, "Peter#43636", 1), /exact Riot ID/);
  assert.throws(() => verifyFinderIdentity({
    battleInfo: { nameInfoNew: "Peter#43636", openId: "private-open-id", areaId: 14 },
    data: [],
  }, "Peter#43636", 1), /selected China server/);
});

test("history timestamps use China time and candidate selection is bounded and deterministic", () => {
  const parsed = parseFinderGameTime({ gameId: "a", titleTime: "11-12 20:03:45" }, "2026-11-12");
  assert.equal(parsed?.playedAt.toISOString(), "2026-11-12T12:03:45.000Z");
  assert.equal(parseFinderGameTime({ gameId: "bad", titleTime: "13-42 29:99:99" }, "2026-11-12"), null);
  const selected = selectFinderHistoryCandidates([
    { gameId: "ranked", titleTime: "11-12 22:00:00", title: "Ranked" },
    { gameId: "custom", titleTime: "11-12 19:00:00", title: "\u65b0\u6a21\u5f0f" },
    { gameId: "custom", titleTime: "11-12 19:00:00", title: "duplicate" },
    { gameId: "outside", titleTime: "11-15 19:00:00", title: "\u65b0\u6a21\u5f0f" },
  ], "2026-11-12", 1, 2);
  assert.deepEqual(selected.map(entry => entry.game.gameId), ["custom", "ranked"]);
});

test("detail confirmation requires a custom game and the verified openId player", () => {
  const players = [
    { nickNameStr: "Peter#43636", openIdNow: "private-open-id", detailChampionId: 126, teamId: 100, position: "TOP", scoreInfo: "5/2/7" },
    { nickNameStr: "Flan#55511", openIdNow: "other-id", detailChampionId: 54, teamId: 200, position: "TOP", scoreInfo: "1/4/3" },
    ...Array.from({ length: 8 }, (_, index) => ({ nickNameStr: `Player${index}#ECL`, openIdNow: `id-${index}`, detailChampionId: index + 1, teamId: index < 4 ? 100 : 200 })),
  ];
  const detail = {
    data: {
      gameType: "CUSTOM_GAME",
      gameMode: "CLASSIC",
      mapId: 11,
      wgBattleDetailInfo: players,
      teamDetails: [{ teamId: 100 }, { teamId: 200 }],
    },
  };
  const result = evaluateFinderCandidate({
    game: { gameId: "provider-game", title: "\u65b0\u6a21\u5f0f - \u7528\u65f630\u520615\u79d2", titleTime: "11-12 20:03:45" },
    detail,
    targetDate: "2026-11-12",
    primaryRiotId: "Peter#43636",
    primaryOpenId: "private-open-id",
    primaryChampion: "Jayce",
    opponentRiotId: "Flan#55511",
    opponentChampion: "Malphite",
    championNames: new Map([["126", "Jayce"], ["54", "Malphite"]]),
  });
  assert.ok(result);
  assert.equal(result.gameType, "CUSTOM_GAME");
  assert.equal(result.durationSeconds, 1815);
  assert.deepEqual(result.clues, {
    localizedCustomLabel: true,
    primaryChampion: true,
    opponentFound: true,
    opponentOnOtherTeam: true,
    opponentChampion: true,
  });
  assert.equal(JSON.stringify(result).includes("private-open-id"), false);
  assert.equal(evaluateFinderCandidate({
    game: { gameId: "matched", titleTime: "11-12 20:03:45" },
    detail: { ...detail, data: { ...detail.data, gameType: "MATCHED_GAME" } },
    targetDate: "2026-11-12",
    primaryRiotId: "Peter#43636",
    primaryOpenId: "private-open-id",
  }), null);
  assert.equal(evaluateFinderCandidate({
    game: { gameId: "wrong-identity", titleTime: "11-12 20:03:45" },
    detail,
    targetDate: "2026-11-12",
    primaryRiotId: "Peter#43636",
    primaryOpenId: "different-open-id",
  }), null);
});

test("Hub finder stays on the signed read-only provider flow", async () => {
  const source = await readFile("app/(hub)/hub/search-engine/CustomGameFinderClient.tsx", "utf8");
  assert.match(source, /\/api\/lzyumi-sign/);
  assert.match(source, /fetchLzyumiBrowserResponse/);
  assert.doesNotMatch(source, /method:\s*["']POST["']/);
  assert.doesNotMatch(source, /\/api\/admin|report-match|publishSemifinals/);
});
