import test from "node:test";
import assert from "node:assert/strict";
import { classifyDatabaseFailure, parseOpsPreflightArguments, safeDatabaseConfiguration } from "../lib/ops-preflight";

test("ops preflight arguments default to a local no-network inspection", () => {
  assert.deepEqual(parseOpsPreflightArguments([]), { target: "local", network: false });
  assert.deepEqual(parseOpsPreflightArguments(["--target=production-read-only", "--network"]), { target: "production-read-only", network: true });
  assert.throws(() => parseOpsPreflightArguments(["--target=production"]), /Unknown ops preflight argument/);
});

test("database configuration reports only bounded non-secret metadata", () => {
  assert.deepEqual(safeDatabaseConfiguration(undefined), { configured: false, valid: false, protocol: null, schema: null });
  assert.deepEqual(safeDatabaseConfiguration("postgresql://user:password@private.example/db?schema=public"), { configured: true, valid: true, protocol: "postgresql:", schema: "public" });
  assert.deepEqual(safeDatabaseConfiguration("https://private.example/secret"), { configured: true, valid: false, protocol: null, schema: null });
});

test("database failures are reduced to safe categories", () => {
  assert.deepEqual(classifyDatabaseFailure({ message: "Can't reach database server at private.example", errorCode: "P1001" }), { code: "P1001", category: "unreachable" });
  assert.deepEqual(classifyDatabaseFailure({ message: "password authentication failed", code: "28P01" }), { code: "28P01", category: "authentication" });
  assert.deepEqual(classifyDatabaseFailure(new Error("arbitrary private failure")), { code: null, category: "unknown" });
});
