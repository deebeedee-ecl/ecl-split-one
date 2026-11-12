import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  BASELINE_DATABASE_URL_ENV,
  baselineInspectPlan,
  parsePrismaBaselineInspectArgs,
  runPrismaBaselineInspection,
  validateBaselineDatabaseUrl,
} from "../scripts/prisma-baseline-inspect.mjs";

const cwd = path.resolve("synthetic-workspace");

test("baseline inspection requires an explicit production read-only target", () => {
  assert.throws(
    () => parsePrismaBaselineInspectArgs([], cwd),
    /--target=production-read-only/,
  );

  const parsed = parsePrismaBaselineInspectArgs([
    "--target=production-read-only",
  ], cwd);
  assert.equal(parsed.executeReadOnly, false);
  assert.equal(
    parsed.outputDir,
    path.join(cwd, ".tmp", "prisma-baseline"),
  );
});

test("unknown arguments fail without echoing their value", () => {
  const accidentalSecret = "postgresql://do-not-echo.invalid/private";
  assert.throws(
    () => parsePrismaBaselineInspectArgs([
      "--target=production-read-only",
      `--database-url=${accidentalSecret}`,
    ], cwd),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes(accidentalSecret), false);
      return true;
    },
  );
});

test("baseline artifacts cannot escape the ignored prisma-baseline directory", () => {
  assert.throws(
    () => parsePrismaBaselineInspectArgs([
      "--target=production-read-only",
      "--output-dir=artifacts",
    ], cwd),
    /must stay under/,
  );
  assert.throws(
    () => parsePrismaBaselineInspectArgs([
      "--target=production-read-only",
      "--output-dir=.tmp/prisma-baseline/../outside",
    ], cwd),
    /must stay under/,
  );
});

test("database URL validation accepts only public-schema PostgreSQL targets", () => {
  const synthetic = "postgresql://synthetic:synthetic@db.invalid:5432/app?schema=public";
  assert.equal(validateBaselineDatabaseUrl(synthetic), synthetic);
  assert.throws(
    () => validateBaselineDatabaseUrl("https://db.invalid/app"),
    /must use PostgreSQL/,
  );
  assert.throws(
    () => validateBaselineDatabaseUrl(
      "postgresql://synthetic:synthetic@db.invalid:5432/app?schema=private",
    ),
    /restricted to the public schema/,
  );
  assert.throws(
    () => validateBaselineDatabaseUrl("not-a-secret-bearing-url"),
    new RegExp(BASELINE_DATABASE_URL_ENV),
  );
});

test("the default command is a credential-free plan with no database writes", () => {
  const parsed = parsePrismaBaselineInspectArgs([
    "--target=production-read-only",
  ], cwd);
  assert.deepEqual(baselineInspectPlan(parsed, cwd), {
    schemaVersion: 1,
    target: "production-read-only",
    mode: "plan",
    databaseUrlEnv: BASELINE_DATABASE_URL_ENV,
    outputDir: path.join(".tmp", "prisma-baseline"),
    writesDatabase: false,
    printsDatabaseUrl: false,
  });
});

test("execute mode fails before Prisma when the dedicated URL is absent", () => {
  assert.throws(
    () => runPrismaBaselineInspection({
      argv: ["--target=production-read-only", "--execute-read-only"],
      cwd,
      env: { NODE_ENV: "test" },
    }),
    new RegExp(BASELINE_DATABASE_URL_ENV),
  );
});
