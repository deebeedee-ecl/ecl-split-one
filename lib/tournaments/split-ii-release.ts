import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { calculateTables, type MatchPayload } from "./match-policy";
import { buildSplitTwoSemifinalPlan } from "./split-ii-playoffs";
import { SPLIT_II_SLUG } from "./split-ii-config";

type Database = PrismaClient | Prisma.TransactionClient;

export const SPLIT_II_SEMIFINAL_OPERATION = "split-ii-semifinals-v1";
const SPLIT_II_SEMIFINAL_CODES = new Set<string>(["SF01", "SF02"]);

const fixtureSelect = {
  id: true,
  code: true,
  stage: true,
  week: true,
  bestOf: true,
  pairKey: true,
  homeTeamId: true,
  awayTeamId: true,
  schedule: true,
  revision: true,
} as const;

type Fixture = Prisma.TournamentFixtureGetPayload<{ select: typeof fixtureSelect }>;
type Team = { id: string; key: string; name: string };
type ApprovedReport = { id: string; fixtureId: string; payload: unknown; reviewedAt: Date | null };

export type SplitTwoSemifinalInspection = Awaited<ReturnType<typeof inspectSplitTwoSemifinals>>;

function knownBlocker(error: unknown) {
  if (error instanceof Error && (error.message.startsWith("Split II") || error.message.startsWith("Live Split II"))) {
    return error.message;
  }
  return "Semifinal state needs review before publication.";
}

export function buildSplitTwoSemifinalInspection(
  eventId: string,
  teams: Team[],
  fixtures: Fixture[],
  reports: ApprovedReport[],
) {
  const standings = calculateTables(teams, fixtures, reports).standings;
  const blockers: string[] = [];
  let plan: ReturnType<typeof buildSplitTwoSemifinalPlan> = [];
  try {
    plan = buildSplitTwoSemifinalPlan(eventId, teams, standings);
  } catch (error) {
    blockers.push(knownBlocker(error));
  }

  const plannedCodes = new Set<string>(plan.map(row => row.code));
  const candidates = fixtures
    .filter(fixture => fixture.stage === "SEMIFINAL" || plannedCodes.has(fixture.code) || SPLIT_II_SEMIFINAL_CODES.has(fixture.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  for (const fixture of candidates) {
    const expected = plan.find(row => row.code === fixture.code);
    if (!expected || fixture.id !== expected.id || fixture.stage !== expected.stage || fixture.week !== expected.week || fixture.bestOf !== expected.bestOf || fixture.pairKey !== expected.pairKey || fixture.homeTeamId !== expected.homeTeamId || fixture.awayTeamId !== expected.awayTeamId || fixture.schedule !== null || fixture.revision !== 0) {
      blockers.push(`Existing semifinal fixture ${fixture.code} needs review.`);
    }
  }

  const teamKey = new Map(teams.map(team => [team.id, team.key]));
  const fingerprintInput = {
    operation: SPLIT_II_SEMIFINAL_OPERATION,
    eventId,
    standings: standings.map(row => ({
      team: teamKey.get(row.id) ?? null,
      played: row.played,
      wins: row.wins,
      losses: row.losses,
      winTimeSeconds: row.winTimeSeconds,
      tied: row.tied,
    })),
    approvedReports: [...reports].sort((a, b) => a.id.localeCompare(b.id)).map(report => {
      const payload = report.payload as Partial<MatchPayload>;
      return {
        id: report.id,
        fixtureId: report.fixtureId,
        reviewedAt: report.reviewedAt?.toISOString() ?? null,
        winnerTeamId: payload.winnerTeamId ?? null,
        durationSeconds: payload.durationSeconds ?? null,
      };
    }),
    existingSemifinals: candidates.map(fixture => ({
      id: fixture.id,
      code: fixture.code,
      stage: fixture.stage,
      week: fixture.week,
      bestOf: fixture.bestOf,
      pairKey: fixture.pairKey,
      home: teamKey.get(fixture.homeTeamId) ?? null,
      away: teamKey.get(fixture.awayTeamId) ?? null,
      revision: fixture.revision,
      scheduled: fixture.schedule !== null,
    })),
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(fingerprintInput)).digest("hex");
  const existingCodes = new Set(candidates.map(fixture => fixture.code));
  const status = blockers.length
    ? "blocked"
    : plan.length > 0 && plan.every(row => existingCodes.has(row.code))
      ? "applied"
      : "ready";

  return { eventId, teams, fixtures, reports, standings, plan, candidates, blockers, fingerprint, status };
}

export async function inspectSplitTwoSemifinals(db: Database, lockedEventId?: string) {
  const eventId = lockedEventId ?? (await db.tournament.findUniqueOrThrow({
    where: { slug: SPLIT_II_SLUG },
    select: { id: true },
  })).id;
  const [teams, fixtures, reports] = await Promise.all([
    db.tournamentTeam.findMany({ where: { tournamentId: eventId }, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } }),
    db.tournamentFixture.findMany({ where: { tournamentId: eventId }, select: fixtureSelect, orderBy: { code: "asc" } }),
    db.tournamentReport.findMany({ where: { tournamentId: eventId, status: "APPROVED" }, select: { id: true, fixtureId: true, payload: true, reviewedAt: true }, orderBy: { id: "asc" } }),
  ]);
  return buildSplitTwoSemifinalInspection(eventId, teams, fixtures, reports);
}

export function splitTwoSemifinalPreview(inspection: SplitTwoSemifinalInspection) {
  return {
    operation: SPLIT_II_SEMIFINAL_OPERATION,
    status: inspection.status,
    fingerprint: inspection.fingerprint,
    blockers: inspection.blockers,
    existingFixtures: inspection.candidates.map(fixture => fixture.code),
    plannedFixtures: inspection.plan.map(row => ({
      code: row.code,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      bestOf: row.bestOf,
      gameOneSideSelection: row.gameOneSideSelection,
    })),
  };
}
