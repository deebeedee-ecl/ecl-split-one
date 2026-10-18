import test from "node:test";
import assert from "node:assert/strict";
import { calculateLpChange } from "../lib/elo";
import { getRankedSeason, currentRankedFilter, rankedSeasonState, loadRankedSeasonStates, assertCurrentRankedWrite, ArchivedRankedMatchError, type RankedSeason } from "../lib/ranked-season";
import { prisma } from "../lib/prisma";
import { NextRequest } from "next/server";

const start = new Date("2026-10-18T12:00:00.000Z");
const season: RankedSeason = { id: "ranked-2026-10", name: "October ranked", startedAt: start };
const env = { ECL_RANKED_SEASON_ID: season.id, ECL_RANKED_SEASON_NAME: season.name, ECL_RANKED_SEASON_START: start.toISOString() };
const old = { id: "old", createdAt: new Date("2026-09-14T14:04:03.351Z"), isWin: true, lpChange: 900, eloAfter: 1700 };
const fresh = { id: "fresh", createdAt: new Date("2026-10-18T13:00:00Z"), isWin: true, lpChange: 29, eloAfter: 9999 };

test("season configuration is optional, strict and does not activate before its start", () => {
  assert.equal(getRankedSeason({}), null);
  assert.equal(getRankedSeason(env, new Date(start.getTime() - 1)), null);
  assert.equal(getRankedSeason(env, start)?.id, season.id);
  for (const values of [{ ...env, ECL_RANKED_SEASON_START: "" }, { ...env, ECL_RANKED_SEASON_START: "2026-02-31T00:00:00Z" }, { ...env, ECL_RANKED_SEASON_START: "2026-10-18" }, { ...env, ECL_RANKED_SEASON_ID: "../bad" }]) assert.throws(() => getRankedSeason(values, start));
  assert.deepEqual(currentRankedFilter(season).createdAt, { gte: start });
});

test("fresh season resets rating, records, streak and inactivity while preserving the old rows", () => {
  const rows = [old]; const before = JSON.stringify(rows);
  const state = rankedSeasonState(rows, season, new Date("2026-12-01T00:00:00Z"));
  assert.equal(state.elo, 800); assert.equal(state.displayElo, 800);
  assert.equal(state.gamesPlayed, 0); assert.equal(state.wins, 0); assert.equal(state.losses, 0);
  assert.equal(state.winStreak, 0); assert.equal(state.lossStreak, 0); assert.equal(state.lastPlayedAt, undefined);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(calculateLpChange({ win: true, kills: 1, deaths: 1, assists: 1, currentElo: state.elo, gamesPlayed: state.gamesPlayed, winStreak: state.winStreak, lossStreak: state.lossStreak }).lpChange, 29);
});

test("current-season LP comes from this season only, regardless of old cached ratings and eloAfter", () => {
  const state = rankedSeasonState([old, fresh], season, fresh.createdAt);
  assert.equal(state.elo, 829); assert.equal(state.gamesPlayed, 1); assert.equal(state.winStreak, 1);
  assert.equal(state.wins, 1); assert.equal(state.losses, 0);
  assert.equal(rankedSeasonState([{ ...fresh, createdAt: start }], season, start).gamesPlayed, 1);
});

test("batch rating reads scope all identities to the new season and never write", async () => {
  let query: unknown;
  const db = { matchGamePlayerStat: { findMany: async (args: unknown) => { query = args; return [{ ...fresh, playerId: "p1" }]; } } } as unknown as Parameters<typeof loadRankedSeasonStates>[2];
  const states = await loadRankedSeasonStates(["p1", "p2"], season, db);
  assert.equal(states.get("p1")?.elo, 829); assert.equal(states.get("p2")?.elo, 800);
  assert.ok(JSON.stringify(query).includes(start.toISOString()));
  assert.ok(JSON.stringify(query).includes("playerId"));
});

test("archive protection only blocks older ranked matches and leaves other competitions alone", () => {
  assert.throws(() => assertCurrentRankedWrite(old.createdAt, "IH #001", season), ArchivedRankedMatchError);
  assert.throws(() => assertCurrentRankedWrite(old.createdAt, "Ranked Inhouse", season), ArchivedRankedMatchError);
  assert.doesNotThrow(() => assertCurrentRankedWrite(old.createdAt, "World Cup final", season));
  assert.doesNotThrow(() => assertCurrentRankedWrite(start, "IH #026", season));
});

test("the current LP calculation matches the breakdown, including streak thresholds and first-game bonus", () => {
  const base = { win: true, kills: 4, deaths: 2, assists: 6, currentElo: 800, gamesPlayed: 3, winStreak: 0, lossStreak: 0, playedAt: new Date("2026-10-18T04:00:00Z") };
  for (const [override, expected] of [
    [{}, 29], [{ isMVP: true }, 33], [{ win: false }, -18], [{ win: false, isSVP: true }, -15],
    [{ gamesPlayed: 0 }, 29], [{ gamesPlayed: 0, isMVP: true }, 33], [{ gamesPlayed: 2, win: false }, -18], [{ gamesPlayed: 1, win: false, isSVP: true }, -15], [{ winStreak: 2 }, 44], [{ winStreak: 5 }, 59],
    [{ lossStreak: 1, win: false }, -18], [{ lossStreak: 2, win: false }, -20],
    [{ currentElo: 1500 }, 25], [{ currentElo: 1500, win: false }, -20],
    [{ playedAt: new Date("2026-10-22T04:00:00Z"), doubleLpEligible: true }, 58],
    [{ playedAt: new Date("2026-10-22T04:00:00Z"), doubleLpEligible: true, gamesPlayed: 0 }, 58],
    [{ playedAt: new Date("2026-10-22T04:00:00Z"), doubleLpEligible: true, hasPlayedOnDoubleLpDay: true }, 29],
  ] as const) assert.equal(calculateLpChange({ ...base, ...override }).lpChange, expected);
});

test("season APIs reset the displayed ladder and summary while keeping old game LP and history intact", async () => {
  const envBefore = { ...process.env };
  const methods = {
    players: prisma.player.findMany, player: prisma.player.findFirst,
    profiles: prisma.accountProfile.findMany, profile: prisma.accountProfile.findFirst,
    stats: prisma.matchGamePlayerStat.findMany,
  };
  const boundary = new Date(Date.now() - 60000);
  const archived = { ...old, matchGameId: "old-game", playerId: "player", lpChange: 65,
    kills: 4, deaths: 2, assists: 6, isMVP: false, isSVP: false,
    matchGame: { ocrRawJson: null, match: { roundLabel: "IH #001" } },
  };
  let current: (typeof archived)[] = [];
  const player = { id: "player", name: "Player", riotName: "Player", riotTag: "12345", email: "discard", elo: 1700, winStreak: 8, lossStreak: 0, team: null, gameStats: [archived] };
  try {
    process.env.ECL_RANKED_SEASON_ID = season.id; process.env.ECL_RANKED_SEASON_NAME = season.name; process.env.ECL_RANKED_SEASON_START = boundary.toISOString();
    Object.assign(prisma.player, { findFirst: async () => player, findMany: async () => [{ ...player, gameStats: [...current, archived] }] });
    Object.assign(prisma.accountProfile, { findFirst: async () => ({ id: "profile", riotName: "Player", riotTag: "12345" }), findMany: async () => [] });
    Object.assign(prisma.matchGamePlayerStat, { findMany: async (args: { where: { createdAt?: { gte: Date } } }) => args.where.createdAt ? current : [...current, archived] });
    const ladder = await import("../app/api/hub/ladder/route");
    const history = await import("../app/api/hub/my-inhouse-history/route");
    const admin = await import("../app/api/admin/elo-players/route");
    const response = await ladder.GET(); const standings = await response.json();
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(standings.scope, "season"); assert.equal(standings.season.id, season.id);
    assert.equal(standings.players[0].elo, 800); assert.equal(standings.players[0].gamesPlayed, 0); assert.equal(standings.players[0].winRate, "-");
    assert.ok(!JSON.stringify(standings).includes("discard"));
    assert.equal((await (await admin.GET()).json()).players[0].elo, 800);
    const readHistory = () => history.GET(new NextRequest("https://eclchina.lol/api/hub/my-inhouse-history?profileId=profile"));
    const empty = await (await readHistory()).json();
    assert.equal(empty.summary.elo, 800); assert.equal(empty.summary.games, 0); assert.equal(empty.summary.streakLabel, "-");
    assert.equal(empty.games[0].id, old.id); assert.equal(empty.games[0].lpChange, 65); assert.equal(empty.games[0].eloAfter, 1700);
    assert.equal(empty.season.historyScope, "all-time");
    current = [{ ...archived, id: "new", createdAt: new Date(), lpChange: 29, eloAfter: 9999 }];
    const active = await (await readHistory()).json();
    assert.equal(active.summary.elo, 829); assert.equal(active.summary.games, 1); assert.equal(active.summary.wins, 1); assert.equal(active.summary.streakLabel, "W1");
    assert.equal(active.games.length, 2); assert.equal(active.games[1].lpChange, 65);
    assert.equal((await (await ladder.GET()).json()).players[0].elo, active.summary.elo);
    assert.equal((await (await admin.GET()).json()).players[0].elo, active.summary.elo);
  } finally {
    for (const key of ["ECL_RANKED_SEASON_ID", "ECL_RANKED_SEASON_NAME", "ECL_RANKED_SEASON_START"]) { if (envBefore[key] === undefined) delete process.env[key]; else process.env[key] = envBefore[key]; }
    Object.assign(prisma.player, { findMany: methods.players, findFirst: methods.player });
    Object.assign(prisma.accountProfile, { findMany: methods.profiles, findFirst: methods.profile });
    Object.assign(prisma.matchGamePlayerStat, { findMany: methods.stats });
  }
});

test("every opening game uses normal scoring and only earned streak bonuses apply", () => {
  const base = { kills: 4, deaths: 2, assists: 6, currentElo: 800, playedAt: new Date("2026-10-18T04:00:00Z") };
  const results = [true, true, true, false, false, false];
  let elo = 800, winStreak = 0, lossStreak = 0;
  const changes = results.map((win, gamesPlayed) => {
    const result = calculateLpChange({ ...base, win, currentElo: elo, gamesPlayed, winStreak, lossStreak });
    assert.equal(result.isPlacement, false); elo += result.lpChange;
    winStreak = win ? winStreak + 1 : 0; lossStreak = win ? 0 : lossStreak + 1;
    return result.lpChange;
  });
  assert.deepEqual(changes, [29, 29, 44, -18, -18, -20]);
  assert.equal(elo, 846);
});

test("archived match API writes and ineffective legacy LP overrides are rejected without database writes", async () => {
  const envBefore = { ...process.env };
  const findUnique = prisma.match.findUnique, update = prisma.match.update, remove = prisma.match.delete, playerUpdate = prisma.player.update;
  let writes = 0;
  try {
    process.env.ECL_RANKED_SEASON_ID = season.id; process.env.ECL_RANKED_SEASON_NAME = season.name;
    process.env.ECL_RANKED_SEASON_START = new Date(Date.now() - 60000).toISOString();
    Object.assign(prisma.match, { findUnique: async () => ({ id: "old", createdAt: old.createdAt, roundLabel: "IH #001" }), update: async () => { writes++; }, delete: async () => { writes++; } });
    Object.assign(prisma.player, { update: async () => { writes++; } });
    const matches = await import("../app/api/matches/[id]/route");
    const overrides = await import("../app/api/admin/elo-override/route");
    const context = { params: Promise.resolve({ id: "old" }) };
    assert.equal((await matches.PATCH(new NextRequest("https://eclchina.lol/api/matches/old", { method: "PATCH", body: "{}" }), context)).status, 409);
    assert.equal((await matches.DELETE(new NextRequest("https://eclchina.lol/api/matches/old", { method: "DELETE" }), context)).status, 409);
    assert.equal((await overrides.POST(new Request("https://eclchina.lol/api/admin/elo-override", { method: "POST", body: JSON.stringify({ playerId: "player", newElo: 1000, reason: "test" }) }))).status, 409);
    assert.equal(writes, 0);
  } finally {
    for (const key of ["ECL_RANKED_SEASON_ID", "ECL_RANKED_SEASON_NAME", "ECL_RANKED_SEASON_START"]) { if (envBefore[key] === undefined) delete process.env[key]; else process.env[key] = envBefore[key]; }
    Object.assign(prisma.match, { findUnique, update, delete: remove }); Object.assign(prisma.player, { update: playerUpdate });
  }
});
