"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { findFirstRecentGameSource } = require("../report-sources.cjs");

test("reporter history stops roster lookups as soon as it yields games", async () => {
  const calls = [];
  const reporterSource = { games: [{ gameId: "reporter-game" }] };

  const result = await findFirstRecentGameSource({
    players: ["reporter", "fallback-1", "fallback-2"],
    fetchSource: async (player) => {
      calls.push(player);
      return reporterSource;
    },
  });

  assert.deepEqual(calls, ["reporter"]);
  assert.equal(result.source, reporterSource);
  assert.equal(result.playerIndex, 0);
  assert.equal(result.checked, 1);
  assert.equal(result.failures, 0);
});

test("a failed reporter lookup falls back without discarding the next usable source", async () => {
  const providerError = Object.assign(new Error("provider busy"), { code: "7" });
  const errors = [];

  const result = await findFirstRecentGameSource({
    players: ["reporter", "fallback"],
    fetchSource: async (_player, playerIndex) => {
      if (playerIndex === 0) throw providerError;
      return { games: [{ gameId: "fallback-game" }] };
    },
    onLookupError: async (event) => errors.push(event),
  });

  assert.equal(result.source.games[0].gameId, "fallback-game");
  assert.equal(result.playerIndex, 1);
  assert.equal(result.checked, 2);
  assert.equal(result.failures, 1);
  assert.deepEqual(errors, [{
    error: providerError,
    playerIndex: 0,
    reporter: true,
  }]);
});

test("empty sources continue in priority order until games are available", async () => {
  const calls = [];
  const result = await findFirstRecentGameSource({
    players: ["reporter", "empty", "usable", "unused"],
    fetchSource: async (player) => {
      calls.push(player);
      if (player === "reporter") return null;
      if (player === "empty") return { games: [] };
      return { games: [{ gameId: "usable-game" }] };
    },
  });

  assert.deepEqual(calls, ["reporter", "empty", "usable"]);
  assert.equal(result.source.games[0].gameId, "usable-game");
  assert.equal(result.checked, 3);
});

test("all failed or empty lookups return a bounded empty result", async () => {
  const result = await findFirstRecentGameSource({
    players: ["reporter", "fallback"],
    fetchSource: async (player) => {
      if (player === "reporter") throw new Error("temporary failure");
      return null;
    },
  });

  assert.equal(result.source, null);
  assert.equal(result.playerIndex, null);
  assert.equal(result.checked, 2);
  assert.equal(result.failures, 1);
});
