import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_CHINA_STATS_MATCH_FILTERS,
  chinaStatsChampionFilterKey,
  chinaStatsParticipantProfileHref,
  filterChinaStatsLiveMatches,
  normalizeChinaStatsLiveDetail,
  normalizeChinaStatsLiveHistory,
  normalizeChinaStatsLiveProfile,
  summarizeChinaStatsLiveMatches,
} from "../lib/china-stats-live.ts";
import {
  canRequestChinaStatsDetail,
  getChinaStatsDetailBudget,
  shouldRetainChinaStatsResult,
} from "../lib/china-stats-demo-states.ts";

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

test("live history recognizes reliable abbreviated and full Chinese role markers", () => {
  const matches = normalizeChinaStatsLiveHistory({ data: [
    { gameId: "top-short", titleTime: "11-25 15:00:00\u3010\u4e0a\u3011" },
    { gameId: "jungle-short", titleTime: "11-25 14:00:00\u3010\u91ce\u3011" },
    { gameId: "jungle-full", titleTime: "11-25 13:00:00\u3010\u6253\u91ce\u3011" },
    { gameId: "middle-full", title: "Ranked \u3010\u4e2d\u5355\u3011", titleTime: "11-25 12:00:00" },
    { gameId: "bottom-full", titleTime: "11-25 11:00:00\u3010\u4e0b\u8def\u3011" },
    { gameId: "support-full", titleTime: "11-25 10:00:00\u3010\u8f85\u52a9\u3011" },
    { gameId: "unknown", titleTime: "11-25 09:00:00\u3010\u672a\u77e5\u3011" },
  ] }, "SOLO_DUO", championNames);

  assert.deepEqual(matches.map((match) => match.role), [
    "Top",
    "Jungle",
    "Jungle",
    "Middle",
    "Bottom",
    "Support",
    null,
  ]);
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

test("local match filters combine queue, champion, role, and result without network requests", () => {
  const matches = [
    ...normalizeChinaStatsLiveHistory({ data: [
      { gameId: "solo-ahri-win", championId: 103, isWin: 1, titleTime: "11-25 12:00:00\u3010\u4e2d\u3011" },
      { gameId: "solo-lee-loss", championId: 64, isWin: 2, titleTime: "11-25 11:00:00\u3010\u6253\u91ce\u3011" },
    ] }, "SOLO_DUO", championNames),
    ...normalizeChinaStatsLiveHistory({ data: [
      { gameId: "flex-ahri-loss", championId: 103, isWin: 2, titleTime: "11-25 10:00:00\u3010\u8f85\u52a9\u3011" },
      { gameId: "flex-unknown", isWin: "unknown", titleTime: "11-25 09:00:00\u3010\u672a\u77e5\u3011" },
    ] }, "FLEX", championNames),
  ];
  const previousFetch = globalThis.fetch;
  let networkRequests = 0;
  globalThis.fetch = (async () => {
    networkRequests += 1;
    throw new Error("Local filters must not use the network.");
  }) as typeof fetch;

  try {
    const ahriKey = chinaStatsChampionFilterKey(matches[0]);
    assert.deepEqual(filterChinaStatsLiveMatches(matches, {
      queue: "SOLO_DUO",
      champion: ahriKey,
      role: "Middle",
      result: "W",
    }).map((match) => match.providerGameId), ["solo-ahri-win"]);
    assert.deepEqual(filterChinaStatsLiveMatches(matches, {
      queue: "FLEX",
      champion: ahriKey,
      role: "Support",
      result: "L",
    }).map((match) => match.providerGameId), ["flex-ahri-loss"]);
    assert.deepEqual(filterChinaStatsLiveMatches(matches, {
      queue: "ALL",
      champion: "ALL",
      role: "UNAVAILABLE",
      result: "UNAVAILABLE",
    }).map((match) => match.providerGameId), ["flex-unknown"]);
    assert.equal(filterChinaStatsLiveMatches(matches, {
      ...DEFAULT_CHINA_STATS_MATCH_FILTERS,
      champion: "id:999",
    }).length, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(networkRequests, 0);
});

test("live detail normalization requires the verified player and removes openId values", () => {
  const players = Array.from({ length: 10 }, (_, index) => ({
    nickNameStr: index === 9 ? "Malformed participant" : `Synthetic${index}#LAB`,
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
  assert.equal(detail.teams[0].players[0].profileRiotId, "Synthetic0#LAB");
  assert.equal(detail.teams[1].players[4].profileRiotId, null);
  assert.doesNotMatch(JSON.stringify(detail), /openId|synthetic-private-open-id|providerGameId/i);
  assert.throws(
    () => normalizeChinaStatsLiveDetail({ value: raw, searchedOpenId: "missing-open-id", championNames }),
    /verified player is missing/,
  );
});

test("scoreboard participant links require a full Riot ID and retain the selected China server", () => {
  assert.equal(
    chinaStatsParticipantProfileHref("Synthetic Player#LAB", "super-server"),
    "/labs/china-stats/live?server=super-server&riotId=Synthetic+Player%23LAB",
  );
  for (const malformed of [null, "", "No tag", "#TAG", "Name#", "Name##TAG"]) {
    assert.equal(chinaStatsParticipantProfileHref(malformed, "ionia"), null);
  }
  const href = chinaStatsParticipantProfileHref("Synthetic#LAB", "ionia");
  assert.match(href ?? "", /server=ionia/);
  assert.doesNotMatch(href ?? "", /openId|gameId|signed|provider/i);
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

test("live lookup labels role and optional recent-stat samples without unsupported claims", async () => {
  const source = await readFile("app/labs/china-stats/ChinaStatsLiveLookupClient.tsx", "utf8");
  assert.match(source, /Summary KDA/);
  assert.match(source, /games in summary/);
  assert.match(source, /different sample from the loaded match history/);
  assert.match(source, /match\.role \?\? "Role unavailable"/);
  assert.match(source, /Role mix:/);
  assert.doesNotMatch(source, /30-day KDA/);
  assert.doesNotMatch(source, /match\.role \?\? \(match\.queue/);
});

test("live lookup retains a coherent result only for the same full Riot ID and server", () => {
  const current = { riotId: "Synthetic Player#LIVE", server: "ionia" as const };
  assert.equal(shouldRetainChinaStatsResult(current, {
    riotId: " synthetic player#live ",
    server: "ionia",
  }), true);
  assert.equal(shouldRetainChinaStatsResult(current, {
    riotId: "Another Player#LIVE",
    server: "ionia",
  }), false);
  assert.equal(shouldRetainChinaStatsResult(current, {
    riotId: "Synthetic Player#LIVE",
    server: "super-server",
  }), false);
  assert.equal(shouldRetainChinaStatsResult(null, current), false);
});

test("match-detail budget allows retries but blocks a sixth unique detail request", () => {
  const requested = new Set(["game-1", "game-2", "game-3", "game-4", "game-5"]);
  assert.deepEqual(getChinaStatsDetailBudget(requested, 5), {
    used: 5,
    remaining: 0,
    maximum: 5,
    exhausted: true,
  });
  assert.equal(canRequestChinaStatsDetail(requested, "game-3", 5), true);
  assert.equal(canRequestChinaStatsDetail(requested, "game-6", 5), false);
  assert.equal(canRequestChinaStatsDetail(new Set(["game-1"]), "game-2", 5), true);
});

test("live lookup renders intentional loading, partial, empty, retry, and budget states", async () => {
  const source = await readFile("app/labs/china-stats/ChinaStatsLiveLookupClient.tsx", "utf8");
  assert.match(source, /ChinaStatsLookupSkeleton/);
  assert.match(source, /Finding the exact player/);
  assert.match(source, /Some player data is unavailable/);
  assert.match(source, /No recent matches in this queue/);
  assert.match(source, /The queue loaded successfully but returned no ranked history/);
  assert.match(source, /Retry player data/);
  assert.match(source, /Retry match details/);
  assert.match(source, /Detail limit reached/);
  assert.match(source, /canRequestChinaStatsDetail/);
  assert.match(source, /shouldRetainChinaStatsResult/);
  assert.match(source, /CHINA_STATS_SERVERS\[snapshot\.target\.server\]/);
});

test("live lookup renders local filters, reset, zero results, and safe participant navigation", async () => {
  const source = await readFile("app/labs/china-stats/ChinaStatsLiveLookupClient.tsx", "utf8");
  assert.match(source, /Match history filters/);
  assert.match(source, /All queues/);
  assert.match(source, /All champions/);
  assert.match(source, /All roles/);
  assert.match(source, /All results/);
  assert.match(source, /No matches match these filters/);
  assert.match(source, /Reset filters/);
  assert.match(source, /filterChinaStatsLiveMatches/);
  assert.match(source, /server=\{snapshot\.target\.server\}/);
  assert.match(source, /chinaStatsParticipantProfileHref/);
  assert.match(source, /prefetch=\{false\}/);
  assert.doesNotMatch(source, /match\.kda/);
});
