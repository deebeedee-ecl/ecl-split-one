import assert from "node:assert/strict";
import test from "node:test";

import {
  PERFORMANCE_RESPONSE_HEADER,
  normalizePerformanceRequestId,
  recordActiveDatabaseQuery,
  withPerformanceTrace,
  type PerformanceRecord,
} from "../lib/performance-timing";

test("keeps correlated timing output bounded to sanitized metadata", async () => {
  const records: PerformanceRecord[] = [];
  const response = await withPerformanceTrace({
    route: "api.account.profile.get",
    requestId: "perf-00000000-0000-4000-8000-000000000001",
    logger: (record) => records.push(record),
  }, async (trace) => {
    await trace.phase("api.authentication", async () => undefined);
    recordActiveDatabaseQuery("AccountProfile", "findUnique", 275.44);
    return trace.phaseSync("api.serialization", () => Response.json({ private: "not-logged" }));
  });

  assert.equal(
    response.headers.get(PERFORMANCE_RESPONSE_HEADER),
    "perf-00000000-0000-4000-8000-000000000001",
  );
  assert.match(response.headers.get("server-timing") ?? "", /api\.authentication;dur=/);
  assert.match(response.headers.get("server-timing") ?? "", /database;dur=275\.4/);
  assert.equal(records.length, 1);
  assert.equal(records[0].requestId, "perf-00000000-0000-4000-8000-000000000001");
  assert.equal(records[0].outcome, "ok");
  assert.equal(records[0].status, 200);
  assert.equal(records[0].database.queryCount, 1);
  assert.equal(records[0].database.slowQueryCount, 1);
  assert.deepEqual(records[0].database.slowQueries, [{
    name: "AccountProfile.findUnique",
    durationMs: 275.4,
  }]);
  assert.equal(JSON.stringify(records[0]).includes("not-logged"), false);
});

test("rejects unsafe incoming correlation values and omits thrown error details", async () => {
  assert.notEqual(normalizePerformanceRequestId("profile@example.com"), "profile@example.com");

  const records: PerformanceRecord[] = [];
  const privateError = new Error("private provider payload");
  await assert.rejects(
    withPerformanceTrace({
      route: "hub.players.page",
      requestId: "profile@example.com",
      logger: (record) => records.push(record),
    }, async () => {
      throw privateError;
    }),
    privateError,
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].outcome, "error");
  assert.match(records[0].requestId, /^perf-[a-f0-9-]{36}$/);
  assert.equal(JSON.stringify(records[0]).includes("private provider payload"), false);
});

test("does not attach per-request timing headers to publicly cacheable responses", async () => {
  const records: PerformanceRecord[] = [];
  const response = await withPerformanceTrace({
    route: "api.hub.my-inhouse-history.get",
    requestId: "perf-00000000-0000-4000-8000-000000000002",
    logger: (record) => records.push(record),
  }, async () => new Response("public", {
    headers: { "Cache-Control": "public, s-maxage=60" },
  }));

  assert.equal(response.headers.get(PERFORMANCE_RESPONSE_HEADER), null);
  assert.equal(response.headers.get("server-timing"), null);
  assert.equal(records[0].status, 200);
  assert.equal(records[0].requestId, "perf-00000000-0000-4000-8000-000000000002");
});
