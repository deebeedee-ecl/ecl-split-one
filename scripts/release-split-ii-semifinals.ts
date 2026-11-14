// Read-only unless `apply --apply` is supplied with the immediately preceding fingerprint.
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import { publishSplitTwoSemifinals } from "../lib/tournaments/matches";
import { inspectSplitTwoSemifinals, splitTwoSemifinalPreview } from "../lib/tournaments/split-ii-release";

function option(name: string) {
  const prefix = `${name}=`;
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length) ?? "";
}

async function main() {
  const action = process.argv[2] ?? "check";
  if (!["check", "apply"].includes(action)) throw new Error("Use check or apply --apply.");
  if (option("--target") !== "production") throw new Error("Name the intended target with --target=production.");
  if (action === "apply" && !process.argv.includes("--apply")) throw new Error("Apply requires explicit approval and --apply.");
  loadEnvConfig(process.cwd(), false);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const target = new URL(process.env.DATABASE_URL);
  if (target.protocol !== "postgres:" && target.protocol !== "postgresql:") throw new Error("Expected PostgreSQL DATABASE_URL.");
  if (target.searchParams.has("schema") && target.searchParams.get("schema") !== "public") throw new Error("Expected the existing public schema.");

  const db = new PrismaClient({ log: [] });
  try {
    const before = await inspectSplitTwoSemifinals(db);
    const preview = splitTwoSemifinalPreview(before);
    console.log(JSON.stringify({
      action,
      target: "production",
      status: preview.status,
      standings: before.standings.map(row => ({ name: row.name, played: row.played, wins: row.wins, losses: row.losses, winTimeSeconds: row.winTimeSeconds, tied: row.tied })),
      planned: preview.plannedFixtures.map(row => ({ code: row.code, matchup: `${row.homeTeam} vs ${row.awayTeam}`, bestOf: row.bestOf, gameOneSideSelection: row.gameOneSideSelection })),
      existingSemifinals: preview.existingFixtures,
      fingerprint: preview.fingerprint,
      blockers: preview.blockers,
    }, null, 2));
    if (preview.blockers.length) throw new Error("Semifinal preflight has blockers.");
    if (action === "check") return;

    const suppliedFingerprint = option("--fingerprint");
    if (!/^[a-f0-9]{64}$/.test(suppliedFingerprint)) throw new Error("Apply requires --fingerprint from the immediately preceding check.");
    const applied = await publishSplitTwoSemifinals(db, { admin: true }, suppliedFingerprint);
    const after = splitTwoSemifinalPreview(await inspectSplitTwoSemifinals(db));
    if (after.blockers.length || after.status !== "applied") throw new Error("Post-apply semifinal verification failed.");

    const audit = {
      at: new Date().toISOString(),
      target: "production",
      operation: applied.operation,
      auditId: applied.auditId,
      preflightFingerprint: suppliedFingerprint,
      inserted: applied.inserted,
      alreadyApplied: applied.alreadyApplied,
      notificationQueued: applied.notificationQueued,
      fixtures: applied.fixtures,
      recovery: "Before any semifinal schedule/report exists, remove only SF01 and SF02 in one reviewed transaction. After use, preserve fixture history and correct records through the tournament workflow.",
    };
    await mkdir(".tmp", { recursive: true });
    await writeFile(".tmp/split-ii-semifinals-production-audit.json", JSON.stringify(audit, null, 2));
    console.log(JSON.stringify({ applied, verifiedFixtures: after.existingFixtures, audit: ".tmp/split-ii-semifinals-production-audit.json" }, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => {
  const safe = error instanceof Error && /^(Use |Name |Apply |DATABASE_URL|Expected |Semifinal |Tournament state|Split II|Live Split II|Post-apply|Publish )/.test(error.message)
    ? error.message
    : "Semifinal release failed. No credentials were printed; inspect state before retrying.";
  console.error(safe);
  process.exitCode = 1;
});
