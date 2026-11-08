"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { LzyumiResponseError } = require("../lzyumi-client.cjs");
const { collectLzyumiHistoryResponses } = require("../lzyumi-history.cjs");

function malformed() {
  return new LzyumiResponseError("missing data", null, {
    reason: "malformed-history",
    responseShape: { type: "object", keys: ["code"], code: "1", dataType: "undefined" },
  });
}

test("malformed history resets the browser once and retries after all filters settle", async () => {
  let pass = 0;
  const calls = [];
  const resets = [];
  const warnings = [];

  const responses = await collectLzyumiHistoryResponses({
    filters: [1, 2],
    concurrency: 2,
    malformedRetries: 1,
    fetchHistory: async (filter) => {
      calls.push({ pass, filter });
      if (pass === 0 && filter === 1) throw malformed();
      return { code: 1, data: [{ gameId: `${pass}-${filter}` }] };
    },
    resetBrowserSession: async (reason) => {
      resets.push(reason);
      pass += 1;
    },
    onMalformed: async (warning) => warnings.push(warning),
  });

  assert.deepEqual(calls, [
    { pass: 0, filter: 1 },
    { pass: 0, filter: 2 },
    { pass: 1, filter: 1 },
    { pass: 1, filter: 2 },
  ]);
  assert.deepEqual(resets, ["malformed-history-response"]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].willRetry, true);
  assert.deepEqual(responses.map((response) => response.data[0].gameId), ["1-1", "1-2"]);
});

test("one persistently malformed filter does not discard valid history filters", async () => {
  let resets = 0;
  const responses = await collectLzyumiHistoryResponses({
    filters: [1, 2],
    concurrency: 1,
    malformedRetries: 1,
    fetchHistory: async (filter) => {
      if (filter === 1) throw malformed();
      return { code: 1, data: [{ gameId: "valid-game" }] };
    },
    resetBrowserSession: async () => { resets += 1; },
  });

  assert.equal(resets, 1);
  assert.deepEqual(responses, [{ code: 1, data: [{ gameId: "valid-game" }] }]);
});

test("all malformed filters fail clearly after the bounded retry", async () => {
  let resets = 0;
  await assert.rejects(
    collectLzyumiHistoryResponses({
      filters: [1, 2],
      concurrency: 2,
      malformedRetries: 1,
      fetchHistory: async () => { throw malformed(); },
      resetBrowserSession: async () => { resets += 1; },
    }),
    (error) => error instanceof LzyumiResponseError
      && error.reason === "malformed-history"
      && /refreshing the report browser session/.test(error.message),
  );
  assert.equal(resets, 1);
});

test("non-malformed provider errors are not hidden or retried as browser failures", async () => {
  const providerError = new LzyumiResponseError("provider busy", "7");
  let resets = 0;
  await assert.rejects(
    collectLzyumiHistoryResponses({
      filters: [1],
      concurrency: 1,
      malformedRetries: 1,
      fetchHistory: async () => { throw providerError; },
      resetBrowserSession: async () => { resets += 1; },
    }),
    (error) => error === providerError,
  );
  assert.equal(resets, 0);
});
