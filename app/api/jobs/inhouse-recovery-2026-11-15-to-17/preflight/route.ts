import { PrismaClient } from "@prisma/client";
import {
  buildRecoveryReadOnlyDatabaseUrl,
  recoveryPreflightResponse,
} from "@/lib/ranked-inhouse-recovery-preflight-endpoint";
import { databaseDryRun } from "@/lib/ranked-inhouse-recovery-review-2026-11-15-to-17";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

let readOnlyPrisma: PrismaClient | null = null;

function recoveryDatabase() {
  if (!readOnlyPrisma) {
    readOnlyPrisma = new PrismaClient({
      datasourceUrl: buildRecoveryReadOnlyDatabaseUrl(process.env.DATABASE_URL),
      log: ["error"],
    });
  }
  return readOnlyPrisma;
}

export async function POST(request: Request) {
  return recoveryPreflightResponse(request, {
    expectedSecrets: [
      process.env.ECL_REPORT_ENGINE_SECRET,
      process.env.ECL_JOB_SECRET,
      process.env.ECL_KOOK_BOT_SECRET,
    ],
    runDatabasePreflight: (manifest) => databaseDryRun(manifest, recoveryDatabase()),
  });
}
