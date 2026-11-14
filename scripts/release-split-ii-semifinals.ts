// Read-only unless `apply --apply` is supplied with the immediately preceding fingerprint.
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { calculateTables, type MatchPayload } from "../lib/tournaments/match-policy";
import { eventLock } from "../lib/tournaments/matches";
import { buildSplitTwoSemifinalPlan } from "../lib/tournaments/split-ii-playoffs";
import { SPLIT_II_SLUG } from "../lib/tournaments/split-ii-config";

type Database = PrismaClient | Prisma.TransactionClient;

function option(name: string) {
  const prefix = `${name}=`;
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length) ?? "";
}

async function inspect(db: Database) {
  const event = await db.tournament.findUniqueOrThrow({ where: { slug: SPLIT_II_SLUG }, select: { id: true } });
  const [teams, fixtures, reports] = await Promise.all([
    db.tournamentTeam.findMany({ where: { tournamentId: event.id }, select: { id: true, key: true, name: true } }),
    db.tournamentFixture.findMany({ where: { tournamentId: event.id }, select: { id: true, code: true, stage: true, week: true, bestOf: true, pairKey: true, homeTeamId: true, awayTeamId: true, schedule: true, revision: true }, orderBy: { code: "asc" } }),
    db.tournamentReport.findMany({ where: { tournamentId: event.id, status: "APPROVED" }, select: { id: true, fixtureId: true, payload: true, reviewedAt: true }, orderBy: { id: "asc" } }),
  ]);
  const standings = calculateTables(teams, fixtures, reports).standings;
  const plan = buildSplitTwoSemifinalPlan(event.id, teams, standings);
  const teamKey = new Map(teams.map(team => [team.id, team.key]));
  const existing = fixtures.filter(fixture => fixture.stage === "SEMIFINAL");
  const blockers: string[] = [];
  for (const fixture of existing) {
    const expected = plan.find(row => row.code === fixture.code);
    if (!expected || fixture.id !== expected.id || fixture.week !== expected.week || fixture.bestOf !== expected.bestOf || fixture.pairKey !== expected.pairKey || fixture.homeTeamId !== expected.homeTeamId || fixture.awayTeamId !== expected.awayTeamId) {
      blockers.push(`Unexpected or mismatched semifinal fixture: ${fixture.code}.`);
    }
  }
  const fingerprintInput = {
    standings: standings.map(row => ({ team: teamKey.get(row.id), played: row.played, wins: row.wins, losses: row.losses, winTimeSeconds: row.winTimeSeconds, tied: row.tied })),
    approvedReports: reports.map(report => ({ id: report.id, fixtureId: report.fixtureId, reviewedAt: report.reviewedAt?.toISOString() ?? null, winnerTeamId: (report.payload as unknown as MatchPayload).winnerTeamId, durationSeconds: (report.payload as unknown as MatchPayload).durationSeconds })),
    existingSemifinals: existing.map(fixture => ({ code: fixture.code, stage: fixture.stage, week: fixture.week, bestOf: fixture.bestOf, pairKey: fixture.pairKey, home: teamKey.get(fixture.homeTeamId), away: teamKey.get(fixture.awayTeamId), revision: fixture.revision, scheduled: fixture.schedule !== null })),
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(fingerprintInput)).digest("hex");
  return { event, teams, plan, existing, standings, fingerprint, blockers };
}

async function main() {
  const action = process.argv[2] ?? "check";
  if (!['check', 'apply'].includes(action)) throw new Error("Use check or apply --apply.");
  if (option("--target") !== "production") throw new Error("Name the intended target with --target=production.");
  if (action === "apply" && !process.argv.includes("--apply")) throw new Error("Apply requires explicit approval and --apply.");
  loadEnvConfig(process.cwd(), false);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const target = new URL(process.env.DATABASE_URL);
  if (target.protocol !== "postgres:" && target.protocol !== "postgresql:") throw new Error("Expected PostgreSQL DATABASE_URL.");
  if (target.searchParams.has("schema") && target.searchParams.get("schema") !== "public") throw new Error("Expected the existing public schema.");
  const db = new PrismaClient({ log: [] });
  try {
    const before = await inspect(db);
    const summary = {
      action,
      target: "production",
      standings: before.standings.map(row => ({ name: row.name, played: row.played, wins: row.wins, losses: row.losses, winTimeSeconds: row.winTimeSeconds, tied: row.tied })),
      planned: before.plan.map(row => ({ code: row.code, matchup: `${row.homeTeam} vs ${row.awayTeam}`, bestOf: row.bestOf, gameOneSideSelection: row.gameOneSideSelection })),
      existingSemifinals: before.existing.map(row => row.code),
      fingerprint: before.fingerprint,
      blockers: before.blockers,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (before.blockers.length) throw new Error("Semifinal preflight has blockers.");
    if (action === "check") return;
    const suppliedFingerprint = option("--fingerprint");
    if (!/^[a-f0-9]{64}$/.test(suppliedFingerprint)) throw new Error("Apply requires --fingerprint from the immediately preceding check.");

    const applied = await db.$transaction(async tx => {
      await eventLock(tx);
      const current = await inspect(tx);
      if (current.blockers.length) throw new Error("Semifinal apply has blockers.");
      if (current.fingerprint !== suppliedFingerprint) throw new Error("Tournament state changed after preflight. Run check again.");
      const existingCodes = new Set(current.existing.map(row => row.code));
      const inserted: string[] = [];
      for (const row of current.plan) {
        if (existingCodes.has(row.code)) continue;
        await tx.tournamentFixture.create({ data: {
          id: row.id,
          tournamentId: row.tournamentId,
          code: row.code,
          stage: row.stage,
          week: row.week,
          bestOf: row.bestOf,
          pairKey: row.pairKey,
          homeTeamId: row.homeTeamId,
          awayTeamId: row.awayTeamId,
          schedule: Prisma.DbNull,
          revision: row.revision,
        } });
        inserted.push(row.code);
      }
      return { inserted, alreadyApplied: inserted.length === 0 };
    }, { maxWait: 10_000, timeout: 30_000 });

    const after = await inspect(db);
    if (after.blockers.length || after.existing.length !== 2 || after.plan.some(row => !after.existing.some(existing => existing.code === row.code))) {
      throw new Error("Post-apply semifinal verification failed.");
    }
    const audit = {
      at: new Date().toISOString(),
      target: "production",
      preflightFingerprint: suppliedFingerprint,
      applied,
      fixtures: after.plan.map(row => ({ code: row.code, matchup: `${row.homeTeam} vs ${row.awayTeam}`, bestOf: row.bestOf, gameOneSideSelection: row.gameOneSideSelection })),
      recovery: "Before any semifinal schedule/report exists, remove only SF01 and SF02 in one reviewed transaction. After use, preserve fixture history and correct records through the tournament workflow.",
    };
    await writeFile(".tmp/split-ii-semifinals-production-audit.json", JSON.stringify(audit, null, 2));
    console.log(JSON.stringify({ applied, verifiedFixtures: after.existing.map(row => row.code), audit: ".tmp/split-ii-semifinals-production-audit.json" }, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => {
  const safe = error instanceof Error && /^(Use |Name |Apply |DATABASE_URL|Expected |Semifinal |Tournament state|Split II|Live Split II|Post-apply)/.test(error.message)
    ? error.message
    : "Semifinal release failed. No credentials were printed; inspect state before retrying.";
  console.error(safe);
  process.exitCode = 1;
});
