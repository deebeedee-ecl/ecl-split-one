import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRecoveryReadOnlyDatabaseUrl,
  recoveryPreflightResponse,
} from "../lib/ranked-inhouse-recovery-preflight-endpoint";
import { RECOVERY_OPERATION, type RecoveryDryRun } from "../scripts/ranked-inhouse-recovery-review-2026-11-15-to-17";

const cleanResult: RecoveryDryRun = {
  readOnly: true,
  applyAvailable: false,
  clean: false,
  fingerprint: "synthetic-fingerprint",
  blockers: ["SYNTHETIC_BLOCKER"],
  warnings: [],
  summary: {
    operationId: RECOVERY_OPERATION,
    gameCount: 12,
    completeGames: 8,
    partialGames: 4,
    completeParticipantRows: 80,
    observedParticipantRows: 104,
    authorizedUnregisteredFillerSlots: 16,
    databaseChecked: true,
    existingSessionCollisions: 0,
    legacyGameCollisions: 0,
    reportJobCollisions: 0,
    tournamentCollisions: 0,
    tournamentCollectionCollisions: 0,
    resolvedProfiles: 0,
    resolvedPlayers: 0,
    excludedObservedParticipants: 0,
    laterRankedResults: 0,
    projectedStatRows: null,
    projectedLpDelta: null,
  },
  games: [],
};

function request({
  secret = "worker-secret",
  operation = RECOVERY_OPERATION,
  body = { manifest: { synthetic: true } },
  contentType = "application/json",
}: {
  secret?: string;
  operation?: string;
  body?: unknown;
  contentType?: string;
} = {}) {
  return new Request("https://eclchina.lol/api/jobs/inhouse-recovery-2026-11-15-to-17/preflight", {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-ecl-report-engine-secret": secret,
      "x-ecl-recovery-operation": operation,
    },
    body: JSON.stringify(body),
  });
}

function dependencies(overrides: Partial<Parameters<typeof recoveryPreflightResponse>[1]> = {}) {
  return {
    expectedSecrets: ["worker-secret"],
    validateManifest: () => ({ clean: false }),
    runDatabasePreflight: async () => cleanResult,
    ...overrides,
  };
}

test("recovery endpoint fails closed before reading an unauthorized body", async () => {
  let ran = false;
  const missing = await recoveryPreflightResponse(request(), dependencies({ expectedSecrets: [] }));
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).code, "RECOVERY_AUTH_NOT_CONFIGURED");

  const unauthorized = await recoveryPreflightResponse(
    request({ secret: "wrong-secret" }),
    dependencies({ runDatabasePreflight: async () => { ran = true; return cleanResult; } }),
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(ran, false);
});

test("recovery endpoint requires the exact dated operation and JSON envelope", async () => {
  const wrongOperation = await recoveryPreflightResponse(
    request({ operation: "different-operation" }),
    dependencies(),
  );
  assert.equal(wrongOperation.status, 403);

  const wrongType = await recoveryPreflightResponse(
    request({ contentType: "text/plain" }),
    dependencies(),
  );
  assert.equal(wrongType.status, 415);

  const invalidManifest = await recoveryPreflightResponse(
    request(),
    dependencies({ validateManifest: () => { throw new Error("private detail"); } }),
  );
  assert.equal(invalidManifest.status, 400);
  assert.equal(JSON.stringify(await invalidManifest.json()).includes("private detail"), false);
});

test("recovery endpoint returns only the bounded preflight result with no-store headers", async () => {
  const response = await recoveryPreflightResponse(request(), dependencies());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.operationId, RECOVERY_OPERATION);
  assert.deepEqual(body.result, cleanResult);
});

test("recovery endpoint hides database failures", async () => {
  const response = await recoveryPreflightResponse(
    request(),
    dependencies({ runDatabasePreflight: async () => { throw new Error("database host and private identity"); } }),
  );
  assert.equal(response.status, 503);
  const body = JSON.stringify(await response.json());
  assert.equal(body.includes("database host"), false);
  assert.equal(body.includes("private identity"), false);
});

test("read-only database URL enforces PostgreSQL session safeguards", () => {
  const value = buildRecoveryReadOnlyDatabaseUrl(
    "postgresql://writer:secret@db.example.test:5432/ecl?schema=public&pgbouncer=true",
  );
  const url = new URL(value);
  assert.match(url.searchParams.get("options") ?? "", /default_transaction_read_only=on/);
  assert.match(url.searchParams.get("options") ?? "", /statement_timeout=30000/);
  assert.equal(url.searchParams.get("connection_limit"), "1");
  assert.equal(url.searchParams.get("application_name"), "ecl-ranked-inhouse-recovery-readonly");
  assert.throws(() => buildRecoveryReadOnlyDatabaseUrl("https://db.example.test/ecl"), /PostgreSQL/);
  assert.throws(
    () => buildRecoveryReadOnlyDatabaseUrl("postgresql://reader:secret@db.example.test/ecl?schema=private"),
    /public schema/,
  );
});
