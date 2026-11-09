"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { LzyumiResponseError } = require("../lzyumi-client.cjs");
const {
  createSerializedOperationQueue,
  isLzyumiSessionError,
  shouldFallbackToLzyumiBrowser,
  summarizeLzyumiTokenStatus,
  withLzyumiSessionRecovery,
} = require("../lzyumi-session.cjs");

test("serializes page operations and continues after a failure", async () => {
  const serialize = createSerializedOperationQueue();
  const events = [];

  const first = serialize(async () => {
    events.push("first:start");
    await new Promise((resolve) => setTimeout(resolve, 5));
    events.push("first:end");
    throw new Error("expected failure");
  });
  const second = serialize(async () => {
    events.push("second:start");
    events.push("second:end");
    return "ok";
  });

  await assert.rejects(first, /expected failure/);
  assert.equal(await second, "ok");
  assert.deepEqual(events, ["first:start", "first:end", "second:start", "second:end"]);
});

test("recognizes provider code 6 as a rejected Lzyumi browser session", () => {
  assert.equal(isLzyumiSessionError(new LzyumiResponseError("login required", "6")), true);
  assert.equal(isLzyumiSessionError(new LzyumiResponseError("provider network", "8")), false);
  assert.equal(isLzyumiSessionError(new LzyumiResponseError("busy", "7")), false);
  assert.equal(isLzyumiSessionError(new Error("6")), false);
});

test("falls back from API failures that the authenticated browser may resolve", () => {
  assert.equal(shouldFallbackToLzyumiBrowser(new LzyumiResponseError("login required", "6")), true);
  assert.equal(shouldFallbackToLzyumiBrowser(new LzyumiResponseError("provider network", "8")), true);
  assert.equal(shouldFallbackToLzyumiBrowser(new LzyumiResponseError("busy", "7")), false);
});

test("summarizes token status without retaining account or token fields", () => {
  assert.deepEqual(
    summarizeLzyumiTokenStatus({
      code: 1,
      data: {
        endTime: "2026-12-31 23:59:59",
        name: "private-account",
        token: "private-token",
        pwd: "private-password",
      },
    }),
    {
      code: "1",
      authenticated: true,
      loginRequired: false,
      providerFailure: false,
      endTime: "2026-12-31 23:59:59",
    },
  );
});

test("refreshes once and retries a rejected Lzyumi session", async () => {
  let calls = 0;
  let recoveries = 0;
  let retries = 0;

  const value = await withLzyumiSessionRecovery({
    operation: async () => {
      calls += 1;
      if (calls === 1) throw new LzyumiResponseError("rejected", "6");
      return "ok";
    },
    recoverSession: async () => { recoveries += 1; },
    onRetry: async () => { retries += 1; },
  });

  assert.equal(value, "ok");
  assert.equal(calls, 2);
  assert.equal(recoveries, 1);
  assert.equal(retries, 1);
});

test("does not refresh unrelated provider failures", async () => {
  const failure = new LzyumiResponseError("busy", "7");
  let recoveries = 0;

  await assert.rejects(
    withLzyumiSessionRecovery({
      operation: async () => { throw failure; },
      recoverSession: async () => { recoveries += 1; },
    }),
    (error) => error === failure,
  );

  assert.equal(recoveries, 0);
});

test("does not loop when the refreshed session is still rejected", async () => {
  let calls = 0;
  let recoveries = 0;

  await assert.rejects(
    withLzyumiSessionRecovery({
      operation: async () => {
        calls += 1;
        throw new LzyumiResponseError("rejected", "6");
      },
      recoverSession: async () => { recoveries += 1; },
    }),
    (error) => isLzyumiSessionError(error),
  );

  assert.equal(calls, 2);
  assert.equal(recoveries, 1);
});
