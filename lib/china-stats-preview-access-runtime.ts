import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveChinaStatsPreviewAccess } from "@/lib/china-stats-preview-access";

export async function hasChinaStatsPreviewAccess(userId: string) {
  return resolveChinaStatsPreviewAccess({ userId, database: prisma });
}
