import type { Prisma } from "@prisma/client";
import { STARTING_ELO, applyInactivityDecay } from "@/lib/elo";
import { INHOUSE_MATCH_FILTER } from "@/lib/inhouse-filter";
import { prisma } from "@/lib/prisma";
import { deployedRankedSeason } from "@/lib/ranked-season-config";

export type RankedSeason = { id: string; name: string; startedAt: Date };

// A complete environment override can configure a later season. Partial overrides
// still fail closed instead of mixing fields with the checked-in season.
export function rankedSeasonEnvironment(environment: Partial<Record<string, string | undefined>> = process.env) {
  return Object.keys(deployedRankedSeason).some(key => environment[key] !== undefined)
    ? environment : deployedRankedSeason;
}

// Explicitly passing {} supports legacy-scope audit/replay checks. Normal callers
// use the deployed boundary; no old results or scoreboards are rewritten.
export function getRankedSeason(environment: Partial<Record<string, string | undefined>> = rankedSeasonEnvironment(), now = new Date()): RankedSeason | null {
  const start = environment.ECL_RANKED_SEASON_START;
  const id = environment.ECL_RANKED_SEASON_ID;
  const name = environment.ECL_RANKED_SEASON_NAME;
  if (start === undefined && id === undefined && name === undefined) return null;
  if (!start || !id || !name || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)
    || name.length > 100 || !name.trim() || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(start)) {
    throw new Error("Ranked season configuration is incomplete or invalid.");
  }
  const startedAt = new Date(start);
  const canonicalStart = start.replace(/(?:\.(\d{1,3}))?Z$/, (_value, fraction: string | undefined) => `.${(fraction ?? "").padEnd(3, "0")}Z`);
  if (!Number.isFinite(startedAt.getTime()) || startedAt.toISOString() !== canonicalStart) throw new Error("Ranked season start is invalid.");
  if (startedAt > now) return null;
  return { id, name: name.trim(), startedAt };
}

export function currentRankedFilter(season = getRankedSeason()): Prisma.MatchGamePlayerStatWhereInput {
  return { ...INHOUSE_MATCH_FILTER, ...(season ? { createdAt: { gte: season.startedAt } } : {}) };
}

export type RankedStat = { id?: string; createdAt: Date; isWin: boolean; lpChange: number; eloAfter?: number | null };

export function rankedSeasonState<T extends RankedStat>(stats: T[], season: RankedSeason, now = new Date()) {
  const current = stats.filter(stat => stat.createdAt >= season.startedAt)
    .slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (b.id ?? "").localeCompare(a.id ?? ""));
  // Sum this season's recorded changes from its baseline. An old cached Player.elo
  // or an eloAfter from a separate tournament cannot restore the previous season.
  const elo = current.reduce((sum, stat) => sum + stat.lpChange, STARTING_ELO);
  const wins = current.filter(stat => stat.isWin).length;
  const firstResult = current[0]?.isWin;
  let streak = 0;
  for (const stat of current) { if (stat.isWin !== firstResult) break; streak++; }
  return {
    stats: current, elo, displayElo: applyInactivityDecay(elo, current[0]?.createdAt, now),
    gamesPlayed: current.length, wins, losses: current.length - wins,
    winStreak: firstResult === true ? streak : 0, lossStreak: firstResult === false ? streak : 0,
    lastPlayedAt: current[0]?.createdAt,
  };
}

type RankedDatabase = Pick<typeof prisma, "matchGamePlayerStat">;
export async function loadRankedSeasonStates(playerIds: string[], season: RankedSeason, db: RankedDatabase = prisma) {
  const stats = playerIds.length ? await db.matchGamePlayerStat.findMany({
    where: { ...currentRankedFilter(season), playerId: { in: playerIds } },
    select: { id: true, playerId: true, createdAt: true, isWin: true, lpChange: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  }) : [];
  return new Map(playerIds.map(id => [id, rankedSeasonState(stats.filter(stat => stat.playerId === id), season)]));
}

export function isRankedInhouse(roundLabel: string | null | undefined) {
  return typeof roundLabel === "string" && (roundLabel.startsWith("IH") || roundLabel === "Ranked Inhouse");
}

export class ArchivedRankedMatchError extends Error {}

export function assertCurrentRankedWrite(createdAt: Date, roundLabel: string | null | undefined, season = getRankedSeason()) {
  if (season && isRankedInhouse(roundLabel) && createdAt < season.startedAt) {
    throw new ArchivedRankedMatchError("This ranked match belongs to an archived season. Its original results are preserved.");
  }
}
