import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { acquireRankedInhouseReportLock } from "../lib/inhouse-report-lock.ts";

test("ranked inhouse lock hides PostgreSQL's void result from Prisma", async () => {
  let queryText = "";
  let queryValues: unknown[] = [];
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      queryText = strings.join("?");
      queryValues = values;
      return [{ lockAcquired: 1 }];
    },
  } as unknown as Pick<Prisma.TransactionClient, "$queryRaw">;

  await acquireRankedInhouseReportLock(tx);

  assert.match(queryText, /SELECT 1 AS "lockAcquired"/);
  assert.match(queryText, /FROM \(\s*SELECT pg_advisory_xact_lock/);
  assert.deepEqual(queryValues, ["ecl-ranked-inhouse-report"]);
});

test("ranked inhouse lock fails closed when no sentinel row is returned", async () => {
  const tx = {
    $queryRaw: async () => [],
  } as unknown as Pick<Prisma.TransactionClient, "$queryRaw">;

  await assert.rejects(
    acquireRankedInhouseReportLock(tx),
    /Failed to acquire the ranked inhouse report transaction lock/,
  );
});
