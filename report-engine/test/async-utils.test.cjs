"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  mapWithConcurrency,
  retryProviderCode,
} = require("../async-utils.cjs");

test("mapWithConcurrency preserves order and respects the limit", async () => {
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency([30, 10, 20, 5], 2, async (delay, index) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, delay));
    active -= 1;
    return index * 2;
  });

  assert.deepEqual(results, [0, 2, 4, 6]);
  assert.equal(peak, 2);
});

test("retryProviderCode backs off only for the configured provider code", async () => {
  let calls = 0;
  const delays = [];
  const result = await retryProviderCode(async () => {
    calls += 1;
    if (calls < 3) throw Object.assign(new Error("busy"), { code: "7" });
    return "ok";
  }, {
    code: "7",
    retries: 2,
    baseDelayMs: 25,
    sleep: async (delayMs) => delays.push(delayMs),
  });

  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [25, 50]);

  await assert.rejects(
    retryProviderCode(
      async () => { throw Object.assign(new Error("unauthorized"), { code: "2" }); },
      { code: "7", retries: 3, sleep: async () => assert.fail("must not sleep") },
    ),
    (error) => error.code === "2",
  );
});
