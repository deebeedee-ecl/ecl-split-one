import type { Prisma } from "@prisma/client";

const RANKED_INHOUSE_REPORT_LOCK_KEY = "ecl-ranked-inhouse-report";

export async function acquireRankedInhouseReportLock(
  tx: Pick<Prisma.TransactionClient, "$queryRaw">,
) {
  const rows = await tx.$queryRaw<Array<{ lockAcquired: number }>>`
    SELECT 1 AS "lockAcquired"
    FROM (
      SELECT pg_advisory_xact_lock(hashtext(${RANKED_INHOUSE_REPORT_LOCK_KEY}))
    ) AS acquired
  `;

  if (rows.length !== 1 || rows[0]?.lockAcquired !== 1) {
    throw new Error("Failed to acquire the ranked inhouse report transaction lock.");
  }
}
