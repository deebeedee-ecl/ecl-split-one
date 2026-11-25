import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeChinaStatsLiveDetail,
  normalizeChinaStatsLiveHistory,
  normalizeChinaStatsLiveProfile,
  summarizeChinaStatsLiveMatches,
} from "../lib/china-stats-live.ts";

const championNames = new Map([
  ["103", "Ahri"],
  ["64", "Lee Sin"],
]);

test("live profile normalization exposes only bounded rank and optional recent-stat fields", () => {
  const profile = normalizeChinaStatsLiveProfile({
    profileResponse: {
      battleInfo: {
        level: 321,
        mapOneInfoList: [
          { type: "\u5355\u53cc\u6392", tier: "\u5927\u5e08 432", winPoint: 432, wins: 12, losses: 8, rate: 0.6 },
          { type: "\u7075\u6d3b\u6392\u4f4d", tier: "\u5b97\u5e08", winPoint: 210, wins: 7, losses: 3, rate: 70 },
        ],
      },
    },
    recentResponse: {
      data: {
        recentState: {
          kda: 4.25,
          play_times: 20,
          win_times: 12,
          kill_30days: 101,
          death_30days: 53,
          assist_30days: 144,
          common_use_champions: [{ key: 103, value: 9 }, { key: 64, value: 4 }],
        },
      },
    },
    riotId: "Synthetic#LIVE",
    serverName: "Ionia",
    areaId: 1,
    championNames,
    fetchedAt: new Date("2026-11-25T12:00:00.000Z"),
  });

  assert.equal(profile.level, 321);
  assert.equal(profile.ranks.solo.label, "Master 432");
  assert.equal(profile.ranks.solo.winRate, 60);
  assert.equal(profile.ranks.flex.label, "Grandmaster");
  assert.equal(profile.recentStatus, "available");
  assert.deepEqual(profile.recent?.champions[0], { championId: "103", champion: "Ahri", games: 9 });
  assert.doesNotMatch(JSON.stringify(profile), /openId|signedUrl|providerGameId/i);
});
test("live history normalization deduplicates provider IDs and enforces the twenty-row ceiling", () => {
  const rows = Array.from({ length: 24 }, (_, index) => ({
    gameId: `synthetic-game-${index}`,
    championId: index % 2 ? 64 : 103,
    isWin: index % 2 ? 2 : 1,
    title: "\u5355\u53cc\u6392",
    titleTime: `11-25 1${index % 10}:00:00\u3010\u4e2d\u3011`,
  }));
  rows.splice(1, 0, { ...rows[0] });
  const matches = normalizeChinaStatsLiveHistory({ data: rows }, "SOLO_DUO", championNames, 99);
  assert.equal(matches.length, 20);
  assert.equal(new Set(matches.map((match) => match.providerGameId)).size, 20);
  assert.equal(matches[0].champion, "Ahri");
  assert.equal(matches[0].role, "Middle");
  assert.equal(matches[0].result, "W");
});

test("live history summary derives bounded form and champion performance without extra provider data", () => {
  const matches = normalizeChinaStatsLiveHistory({ data: [
    { gameId: "game-1", championId: 103, isWin: 1, titleTime: "11-25 12:00:00\u3010\u4e2d\u3011" },
    { gameId: "game-2", championId: 103, isWin: 1, titleTime: "11-25 11:00:00\u3010\u4e2d\u3011" },
    { gameId: "game-3", championId: 64, isWin: 2, titleTime: "11-25 10:00:00\u3010\u6253\u91ce\u3011" },
    { gameId: "game-4", championId: 103, isWin: "unknown", titleTime: "11-25 09:00:00\u3010\u4e2d\u3011" },
  ] }, "SOLO_DUO", championNames);
  const summary = summarizeChinaStatsLiveMatches(matches);

  assert.equal(summary.games, 4);
  assert.equal(summary.decidedGames, 3);
  assert.ok(summary.winRate !== null && Math.abs(summary.winRate - (200 / 3)) < 0.000_001);
  assert.deepEqual(summary.currentStreak, { result: "W", length: 2 });
  assert.deepEqual(summary.recentForm, ["W", "W", "L", null]);
  assert.deepEqual(summary.champions[0], {
    championId: "103",
    champion: "Ahri",
    games: 3,
    wins: 2,
    losses: 0,
    winRate: 100,
  });
  assert.deepEqual(summary.roles[0], { role: "Middle", games: 3 });
  assert.doesNotMatch(JSON.stringify(summary), /openId|providerGameId/i);
});

test("live detail normalization requires the verified player and removes openId values", () => {
  const players = Array.from({ length: 10 }, (_, index) => ({
    nickNameStr: `Synthetic${index}#LAB`,
    openIdNow: index === 0 ? "synthetic-private-open-id" : `synthetic-other-${index}`,
    detailChampionId: index % 2 ? 64 : 103,
    teamId: index < 5 ? 100 : 200,
    position: index % 5 === 0 ? "TOP" : "MID",
    scoreInfo: `${index + 1}/2/3`,
    win: index < 5 ? "win" : "loss",
    echartsMap: { goldEarned: 10_000 + index * 500, totalDamageDealt: 20_000 + index * 1000 },
  }));
  const raw = {
    data: {
      gameType: "MATCHED_GAME",
      gameMode: "CLASSIC",
      wgBattleDetailInfo: players,
      teamDetails: [{ teamId: 100, win: "win" }, { teamId: 200, win: "loss" }],
    },
  };
  const detail = normalizeChinaStatsLiveDetail({
    value: raw,
    searchedOpenId: "synthetic-private-open-id",
    championNames,
  });
  assert.equal(detail.teams.length, 2);
  assert.ok(detail.teams.every((team) => team.players.length === 5));
  assert.equal(detail.teams[0].players[0].searchedPlayer, true);
  assert.equal(detail.teams[0].result, "Win");
  assert.doesNotMatch(JSON.stringify(detail), /openId|synthetic-private-open-id|providerGameId/i);
  assert.throws(
    () => normalizeChinaStatsLiveDetail({ value: raw, searchedOpenId: "missing-open-id", championNames }),
    /verified player is missing/,
  );
});

test("live lookup stays on the authenticated signed browser read-only contract", async () => {
  const source = await readFile("app/labs/china-stats/ChinaStatsLiveLookupClient.tsx", "utf8");
  assert.match(source, /\/api\/china-stats\/sign/);
  assert.match(source, /fetchLzyumiBrowserResponse/);
  assert.match(source, /type: "profile"/);
  assert.match(source, /historyRequest\(2\)/);
  assert.match(source, /historyRequest\(3\)/);
  assert.match(source, /MAX_DETAIL_REQUESTS = 5/);
  assert.match(source, /method:\s*["']POST["']/);
  assert.match(source, /Authorization/);
  assert.doesNotMatch(source, /\/api\/lzyumi-sign/);
  assert.doesNotMatch(source, /\/api\/admin|refresh-my-profile|save-lzyumi|report-match/);
});
