import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const RAW_MATCH_RETENTION_MS = 30 * 86400000;

export async function purgeExpiredDesktopReports(db = prisma, now = new Date()) {
  const cutoff = new Date(now.getTime() - RAW_MATCH_RETENTION_MS);
  const rows = await db.inhouseReportJob.findMany({
    where: { completedAt: { lte: cutoff }, rawMatchData: { path: ["source"], equals: "desktop-upload-v1" } },
    select: { id: true, status: true, completedAt: true, rawMatchData: true }, orderBy: { completedAt: "asc" }, take: 200,
  });
  let deleted = 0;
  for (const row of rows) {
    const data = row.rawMatchData as { source?: unknown; gameId?: unknown; platformId?: unknown; ownerProfileId?: unknown } | null;
    if (data?.source !== "desktop-upload-v1") continue;
    // Keep only the request identifiers for deduplication, not the raw payload or player summary.
    const tombstone = { source: "desktop-expired-v1", gameId: data.gameId, platformId: data.platformId, ownerProfileId: data.ownerProfileId, rawDeletedAt: now.toISOString() };
    const result = await db.inhouseReportJob.updateMany({
      where: { id: row.id, status: row.status, completedAt: row.completedAt, rawMatchData: { path: ["source"], equals: "desktop-upload-v1" } },
      data: { rawMatchData: JSON.parse(JSON.stringify(tombstone)) as Prisma.InputJsonValue, ...(row.status === "DESKTOP_REVIEW" ? { status: "DESKTOP_REVIEW_EXPIRED" } : {}) },
    });
    deleted += result.count;
  }
  return { deleted, cutoff: cutoff.toISOString(), batchLimit: 200 };
}
