import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { INHOUSE_MATCH_FILTER } from "../lib/inhouse-filter";
import { getRankedSeason, rankedSeasonState } from "../lib/ranked-season";

// Run with Node's --env-file locally. This script never loads/publishes credentials,
// updates rating rows, deletes matches, applies SQL or changes server settings.
const argument = (key: string) => process.argv.find(value => value.startsWith(`${key}=`))?.slice(key.length + 1);
const start = argument("--starts-at") ?? new Date().toISOString();
const proposed = getRankedSeason({
  ECL_RANKED_SEASON_START: start,
  ECL_RANKED_SEASON_ID: argument("--id") ?? "ranked-2026-10-18",
  ECL_RANKED_SEASON_NAME: argument("--name") ?? "Ranked Season October 2026",
}, new Date(start));
if (!proposed) throw new Error("A proposed season is required.");

async function main() {
  const snapshot = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const players = await tx.player.findMany({ select: { id: true, elo: true, winStreak: true, lossStreak: true }, orderBy: { id: "asc" } });
    const stats = await tx.matchGamePlayerStat.findMany({
      where: INHOUSE_MATCH_FILTER,
      select: { id: true, playerId: true, matchGameId: true, createdAt: true, lpChange: true, eloBefore: true, eloAfter: true, isWin: true, isMVP: true, isSVP: true },
      orderBy: { id: "asc" },
    });
    const activeSessions = await tx.inhouseSession.count({ where: { status: "ASSIGNED", createdAt: { gte: new Date(Date.now() - 48 * 3600000) } } });
    const pendingJobs = await tx.inhouseReportJob.count({ where: { status: { in: ["PENDING", "PROCESSING", "DESKTOP_PENDING", "DESKTOP_COLLECTING", "DESKTOP_REVIEW"] } } });
    const nonRankedStats = await tx.matchGamePlayerStat.count({ where: { NOT: INHOUSE_MATCH_FILTER } });
    return { players, stats, activeSessions, pendingJobs, nonRankedStats };
  }, { isolationLevel: "RepeatableRead", timeout: 30000 });
  const projected = snapshot.players.map(player => rankedSeasonState(snapshot.stats.filter(stat => stat.playerId === player.id), proposed!));
  const metadataSha256 = createHash("sha256").update(JSON.stringify({ players: snapshot.players, stats: snapshot.stats })).digest("hex");
  let backupPath: string | null = null;
  if (process.argv.includes("--backup")) {
    fs.mkdirSync("backups", { recursive: true });
    backupPath = path.join("backups", `ranked-season-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ exportedAt: new Date().toISOString(), proposed, metadataSha256, ...snapshot }, null, 2), { flag: "wx", mode: 0o600 });
  }
  console.log(JSON.stringify({
    readOnly: true, proposed, playerRecords: snapshot.players.length,
    existingRankedPlayers: new Set(snapshot.stats.map(stat => stat.playerId)).size,
    rankedGamesPreserved: new Set(snapshot.stats.map(stat => stat.matchGameId)).size,
    rankedStatRowsPreserved: snapshot.stats.length, nonRankedStatRowsPreserved: snapshot.nonRankedStats,
    projectedBaselinePlayers: projected.filter(state => state.elo === 800 && state.gamesPlayed === 0 && state.winStreak === 0 && state.lossStreak === 0).length,
    activeSessions: snapshot.activeSessions, pendingJobs: snapshot.pendingJobs,
    readyForFreshCutover: snapshot.activeSessions === 0 && snapshot.pendingJobs === 0 && projected.every(state => state.gamesPlayed === 0),
    metadataSha256, backupPath, activated: false, databaseWrites: 0,
  }, null, 2));
}
main().catch(error => { console.error(JSON.stringify({ previewFailed: true, code: error.code ?? error.name ?? "Unknown" })); process.exitCode = 1; }).finally(() => prisma.$disconnect());
