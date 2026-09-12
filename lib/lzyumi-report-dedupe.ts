import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type GameIdRow = {
  gameId: string | null;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueGameIds(values: Iterable<unknown>) {
  return Array.from(new Set(Array.from(values).map(clean).filter(Boolean)));
}

async function matchGameLzyumiIds(candidateGameIds: string[] = []) {
  const ids = uniqueGameIds(candidateGameIds);

  if (ids.length > 0) {
    return prisma.$queryRaw<GameIdRow[]>(Prisma.sql`
      SELECT DISTINCT value AS "gameId"
      FROM (
        SELECT "ocrRawJson" #>> '{recentMatch,gameId}' AS value FROM "MatchGame"
        UNION ALL
        SELECT "ocrRawJson" #>> '{gameId}' AS value FROM "MatchGame"
      ) ids
      WHERE value IN (${Prisma.join(ids)})
    `);
  }

  return prisma.$queryRaw<GameIdRow[]>(Prisma.sql`
    SELECT value AS "gameId"
    FROM (
      SELECT "ocrRawJson" #>> '{recentMatch,gameId}' AS value, "createdAt" FROM "MatchGame"
      UNION ALL
      SELECT "ocrRawJson" #>> '{gameId}' AS value, "createdAt" FROM "MatchGame"
    ) ids
    WHERE value IS NOT NULL
    ORDER BY "createdAt" DESC
    LIMIT 500
  `);
}

export async function reportedLzyumiGameIds(candidateGameIds: string[] = [], exceptSessionId?: string) {
  const ids = uniqueGameIds(candidateGameIds);
  const [sessions, matchGames] = await Promise.all([
    prisma.inhouseSession.findMany({
      where: {
        status: "COMPLETED",
        lzyumiGameId: ids.length > 0 ? { in: ids } : { not: null },
        ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}),
      },
      orderBy: { completedAt: "desc" },
      take: ids.length > 0 ? undefined : 500,
      select: { lzyumiGameId: true },
    }),
    matchGameLzyumiIds(ids),
  ]);

  return uniqueGameIds([
    ...sessions.map((session) => session.lzyumiGameId),
    ...matchGames.map((row) => row.gameId),
  ]);
}

export async function isLzyumiGameAlreadyReported(gameId: string | null | undefined, exceptSessionId?: string) {
  const id = clean(gameId);
  if (!id) return false;
  return (await reportedLzyumiGameIds([id], exceptSessionId)).includes(id);
}
