"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  LzyumiDiscoveryBudgetError,
  LzyumiDiscoveryCooldownError,
  createDiscoveryRequestBudget,
  createProviderPressureCooldown,
  detailConfirmsCustomGame,
  detailParticipantMatchesExpectedIdentity,
  findBoundedLzyumiMatch,
  historyCandidatePriority,
  sourceMatchesExpectedIdentity,
} = require("../lzyumi-discovery.cjs");

function game(gameId, battleTypeInfo, distance = 0) {
  return { gameId, battleTypeInfo, distance };
}

function detail(gameType, matched = 10) {
  return { data: { gameType, matched } };
}

test("classifies only observed history types as a prefilter and requires detail confirmation", () => {
  assert.equal(historyCandidatePriority(game("custom-0", 0)), 0);
  assert.equal(historyCandidatePriority(game("custom-7", "7")), 0);
  assert.equal(historyCandidatePriority(game("custom-10", 10)), 0);
  assert.equal(historyCandidatePriority(game("matched", 9)), null);
  assert.equal(historyCandidatePriority(game("unknown", 42)), 1);
  assert.equal(historyCandidatePriority(game("missing")), 1);
  assert.equal(detailConfirmsCustomGame(detail("CUSTOM_GAME")), true);
  assert.equal(detailConfirmsCustomGame(detail("MATCHED_GAME")), false);
  assert.equal(detailConfirmsCustomGame({ data: {} }), false);
});

test("source identity requires the full Riot ID and rejects server or openId mismatches", () => {
  const player = {
    riotName: "Synthetic Player",
    riotTag: "TEST",
    chinaServerId: 1,
    openId: "synthetic-open-id",
  };
  const matches = (resolved, name, tag) => resolved === `${name}#${tag}`;
  const valid = {
    player,
    profile: { battleInfo: { nameInfoNew: "Synthetic Player#TEST", openId: "synthetic-open-id", areaId: 1 } },
    openId: "synthetic-open-id",
    areaId: 1,
    resolvedRiotIdMatches: matches,
  };

  assert.equal(sourceMatchesExpectedIdentity(valid), true);
  assert.equal(sourceMatchesExpectedIdentity({ ...valid, player: { ...player, openId: null } }), false);
  assert.equal(sourceMatchesExpectedIdentity({ ...valid, openId: "other-open-id" }), false);
  assert.equal(sourceMatchesExpectedIdentity({
    ...valid,
    profile: { battleInfo: { ...valid.profile.battleInfo, areaId: 14 } },
  }), false);
  assert.equal(sourceMatchesExpectedIdentity({
    ...valid,
    profile: { battleInfo: { ...valid.profile.battleInfo, nameInfoNew: "Other Player#TEST" } },
  }), false);
});

test("detail roster identity rejects full Riot ID, server, and openId mismatches", () => {
  const player = { chinaServerId: 1, openId: "synthetic-open-id" };
  const valid = {
    player,
    detailPlayer: { openIdNow: "synthetic-open-id", translateAreaId: 1, identityOk: true },
    riotIdentityMatches: (_expected, actual) => actual.identityOk,
  };

  assert.equal(detailParticipantMatchesExpectedIdentity(valid), true);
  assert.equal(detailParticipantMatchesExpectedIdentity({
    ...valid,
    player: { ...player, openId: null },
  }), false);
  assert.equal(detailParticipantMatchesExpectedIdentity({
    ...valid,
    detailPlayer: { ...valid.detailPlayer, identityOk: false },
  }), false);
  assert.equal(detailParticipantMatchesExpectedIdentity({
    ...valid,
    detailPlayer: { ...valid.detailPlayer, translateAreaId: 14 },
  }), false);
  assert.equal(detailParticipantMatchesExpectedIdentity({
    ...valid,
    detailPlayer: { ...valid.detailPlayer, openIdNow: "other-open-id" },
  }), false);
});

test("request budget counts actual attempts and fails closed at each ceiling", () => {
  const budget = createDiscoveryRequestBudget({ historyLimit: 2, detailLimit: 1 });
  budget.consumeHistory();
  budget.consumeHistory();
  budget.consumeDetail();
  assert.throws(() => budget.consumeHistory(), (error) =>
    error instanceof LzyumiDiscoveryBudgetError && error.kind === "history" && error.limit === 2);
  assert.throws(() => budget.consumeDetail(), (error) =>
    error instanceof LzyumiDiscoveryBudgetError && error.kind === "detail" && error.limit === 1);
  assert.deepEqual(budget.snapshot(), {
    history: { used: 2, limit: 2 },
    detail: { used: 1, limit: 1 },
  });
});

test("bounded discovery dedupes and filters before detail, confirms custom, and stops early", async () => {
  const historyCalls = [];
  const detailCalls = [];
  const budget = createDiscoveryRequestBudget({ historyLimit: 8, detailLimit: 4 });

  const result = await findBoundedLzyumiMatch({
    players: ["reporter", "unused-fallback"],
    filters: [1, 2, 3, 4, 5, 6],
    historyConcurrency: 2,
    budget,
    reportedGameIds: ["reported"],
    fetchHistory: async (player, filter, requestBudget) => {
      requestBudget.consumeHistory();
      historyCalls.push({ player, filter });
      const games = filter === 1
        ? [game("reported", 0), game("outside", 0, 999), game("matched", 9), game("not-custom", 0, 1)]
        : filter === 2
          ? [game("not-custom", 0, 1), game("winner", 10, 2)]
          : [game(`late-${filter}`, 0, filter)];
      return { player, games };
    },
    fetchDetail: async (_source, candidate, requestBudget) => {
      requestBudget.consumeDetail();
      detailCalls.push(candidate.gameId);
      return candidate.gameId === "winner" ? detail("CUSTOM_GAME", 10) : detail("MATCHED_GAME", 10);
    },
    isInWindow: (candidate) => candidate.gameId !== "outside",
    sortValue: (candidate) => candidate.distance,
    matchRoster: (candidateDetail) => ({
      matched: Array.from({ length: candidateDetail.data.matched }, (_, index) => `p${index}`),
      missing: [],
    }),
    requiredMatches: 8,
  });

  assert.equal(result.match.game.gameId, "winner");
  assert.deepEqual(historyCalls, [
    { player: "reporter", filter: 1 },
    { player: "reporter", filter: 2 },
  ]);
  assert.deepEqual(detailCalls, ["not-custom", "winner"]);
  assert.deepEqual(result.budget, {
    history: { used: 2, limit: 8 },
    detail: { used: 2, limit: 4 },
  });
});

test("bounded discovery never exceeds two concurrent history filters", async () => {
  let active = 0;
  let peak = 0;
  const budget = createDiscoveryRequestBudget({ historyLimit: 4, detailLimit: 1 });

  await findBoundedLzyumiMatch({
    players: ["reporter"],
    filters: [1, 2, 3, 4],
    historyConcurrency: 10,
    budget,
    fetchHistory: async (_player, _filter, requestBudget) => {
      requestBudget.consumeHistory();
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { games: [] };
    },
    fetchDetail: async () => assert.fail("no detail expected"),
    isInWindow: () => true,
    sortValue: () => 0,
    matchRoster: () => ({ matched: [], missing: [] }),
    requiredMatches: 8,
  });

  assert.equal(peak, 2);
  assert.equal(budget.snapshot().history.used, 4);
});

test("provider pressure starts a cooldown without exposing provider data", () => {
  let now = 1_000;
  const cooldown = createProviderPressureCooldown({ cooldownMs: 5_000, now: () => now });
  assert.equal(cooldown.record(Object.assign(new Error("busy"), { code: "7" })), true);
  assert.throws(() => cooldown.assertAvailable(), (error) =>
    error instanceof LzyumiDiscoveryCooldownError && error.retryAfterMs === 5_000);
  now = 6_000;
  assert.doesNotThrow(() => cooldown.assertAvailable());
  assert.equal(cooldown.record(Object.assign(new Error("network rejected"), { code: "8" })), true);
  assert.throws(() => cooldown.assertAvailable(), LzyumiDiscoveryCooldownError);
  now = 11_000;
  assert.equal(cooldown.record(Object.assign(new Error("auth"), { code: "6" })), false);
});
