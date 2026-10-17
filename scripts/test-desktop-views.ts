import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { inhouseChampionId, inhouseRawPlayer, normalizeInhouseRole } from "../lib/inhouse-player-display";
import { leagueSnapshotChampions } from "../lib/league-snapshot-champions";

test("historical champion picks join exact Riot identities and never infer missing positions", () => {
  const raw = { detail: { data: { wgBattleDetailInfo: [{ nickNameStr: "Player#12345", detailChampionId: "246", position: "MID", puuid: "discard" }, { nickNameStr: "Player#54321", detailChampionId: "7" }] } } };
  assert.equal(inhouseChampionId(inhouseRawPlayer(raw, "Player", "12345")), "246");
  assert.equal(inhouseChampionId(inhouseRawPlayer(raw, "Player", "54321")), "7");
  assert.equal(inhouseRawPlayer(raw, "Player", "00000"), null);
  assert.equal(inhouseRawPlayer({ detail: { data: { wgBattleDetailInfo: {} } } }, "Player", "12345"), null);
  assert.equal(normalizeInhouseRole("JNG"), "JGL"); assert.equal(normalizeInhouseRole(null), null);
});

test("ladder champion picks use saved Lzyumi counts, sorted and deduplicated, never inhouse guesses", () => {
  const result = leagueSnapshotChampions({ data: { recentState: { common_use_champions: [null, { key: 7, value: 9 }, { key: 246, value: 2 }, { key: 7, value: 8 }, { key: 412, value: 5 }, { key: 110, value: 3 }, { key: "../../secret", value: 100 }, { key: 59, value: -1 }] } } });
  assert.deepEqual(result, [{ championId: "7", games: 9 }, { championId: "412", games: 5 }, { championId: "110", games: 3 }]);
  assert.deepEqual(leagueSnapshotChampions(null), []);
  assert.deepEqual(leagueSnapshotChampions({ data: { recentState: { common_use_champions: {} } } }), []);
});

test("desktop read routes enforce own history and return minimized scoreboards and full ladder, with fake stores only", async () => {
  const env = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://desktop-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-test-key";
  const { prisma } = await import("../lib/prisma");
  const history = await import("../app/api/hub/my-inhouse-history/route");
  const ladder = await import("../app/api/hub/ladder/route");
  const savedFetch = globalThis.fetch;
  const saved = { profile: prisma.accountProfile.findFirst, profiles: prisma.accountProfile.findMany, player: prisma.player.findFirst, players: prisma.player.findMany, stats: prisma.matchGamePlayerStat.findMany };
  let scoreboardReads = 0;
  const now = new Date();
  const raw = { detail: { data: { wgBattleDetailInfo: [{ nickNameStr: "Player#12345", detailChampionId: "246", position: "MID", puuid: "private-puuid" }] } } };
  const player = { id: "own-player", name: "Player", riotName: "Player", riotTag: "12345", email: "private-email", team: null, gameStats: [{ isWin: true, kills: 10, deaths: 3, assists: 4, lpChange: 20, eloAfter: 1020, createdAt: now }] };
  globalThis.fetch = async input => {
    assert.match(String(input), /^https:\/\/desktop-test\.supabase\.co\/auth\/v1\/user/);
    return Response.json({ id: "own-user", email: "private-email", aud: "authenticated" });
  };
  Object.assign(prisma.accountProfile, { findFirst: async () => ({ id: "own-profile", riotName: "Player", riotTag: "12345", email: "private-email" }) });
  const publicProfile = { riotName: "Player", riotTag: "12345", lzyumiLastLookupAt: now, lzyumiRecentStat: { data: { recentState: { common_use_champions: [{ key: 7, value: 40 }, { key: 246, value: 30 }, { key: 412, value: 20 }] } } }, email: "private-email", puuid: "private-puuid" };
  Object.assign(prisma.accountProfile, { findMany: async (args: { where: unknown }) => { assert.deepEqual(args.where, { verificationStatus: "VERIFIED", accountStatus: "ACTIVE" }); return [publicProfile]; } });
  Object.assign(prisma.player, { findFirst: async () => player, findMany: async () => [player] });
  Object.assign(prisma.matchGamePlayerStat, { findMany: async (args: { where: { playerId?: unknown; matchGameId?: string } }) => {
    if (args.where.matchGameId) {
      scoreboardReads++; assert.equal(args.where.matchGameId, "own-game");
      return Array.from({ length: 10 }, (_, i) => ({ player: { name: `Player ${i}`, riotName: "Player", riotTag: "12345", email: "private-email" }, riotName: "Player", riotTag: "12345", isWin: i < 5, kills: 10, deaths: 3, assists: 4, damage: 10000, gold: 11000, visionScore: null, cs: 123 }));
    }
    if (typeof args.where.playerId === "string") return [{ id: "own-stat", matchGameId: "own-game", createdAt: now, matchGame: { ocrRawJson: raw, match: { roundLabel: "IH #028" } } }];
    return [{ playerId: "own-player", riotName: "Player", riotTag: "12345", isWin: true, matchGame: { ocrRawJson: raw } }];
  } });
  const request = (query: string, authenticated = true) => new NextRequest(`https://eclchina.lol/api/hub/my-inhouse-history?${query}`, { headers: authenticated ? { Authorization: "Bearer fake-token" } : {} });
  try {
    assert.equal((await history.GET(request("statId=own-stat", false))).status, 401);
    assert.equal((await history.GET(request("statId=own-stat&profileId=other"))).status, 400);
    assert.equal((await history.GET(request("statId=other-stat"))).status, 404);
    assert.equal(scoreboardReads, 0);
    const detail = await history.GET(request("statId=own-stat"));
    assert.equal(detail.status, 200); assert.equal(detail.headers.get("cache-control"), "private, no-store");
    const body = await detail.json();
    assert.equal(body.scoreboard.players.length, 10); assert.equal(body.scoreboard.players[0].championId, "246");
    assert.equal(body.scoreboard.players[0].vision, null); assert.ok(!JSON.stringify(body).includes("private-"));
    const standings = await ladder.GET(); const rows = await standings.json();
    assert.equal(rows.coverage, "full"); assert.equal(rows.scope, "all-time");
    assert.equal(rows.players[0].topChampions[0].championId, "7");
    assert.equal(rows.players[0].championSource, "ecl-snapshot");
    assert.equal(rows.players[0].championsUpdatedAt, now.toISOString());
    assert.ok(!JSON.stringify(rows).includes("private-")); assert.equal(rows.players[0].playerId, undefined);
    Object.assign(prisma.accountProfile, { findMany: async () => [publicProfile, publicProfile] });
    const ambiguous = await (await ladder.GET()).json();
    assert.deepEqual(ambiguous.players[0].topChampions, []);
  } finally {
    globalThis.fetch = savedFetch;
    Object.assign(prisma.accountProfile, { findFirst: saved.profile, findMany: saved.profiles });
    Object.assign(prisma.player, { findFirst: saved.player, findMany: saved.players });
    Object.assign(prisma.matchGamePlayerStat, { findMany: saved.stats });
    if (env.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = env.url;
    if (env.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.key;
    await prisma.$disconnect();
  }
});
