import { prisma } from "@/lib/prisma";
import { LZYUMI_REFRESH_INTERVAL_MS, refreshAccountProfileStats } from "@/lib/account-stats-refresh";

export async function refreshStatsOnOpen(userId: string, ifStale: boolean, db = prisma, refresh: (profile: Parameters<typeof refreshAccountProfileStats>[0]) => Promise<{ ok: boolean }> = refreshAccountProfileStats, now = new Date()) {
  const profile = await db.accountProfile.findUnique({ where: { userId } });
  if (!profile?.chinaServerId || !profile.riotName || profile.accountStatus !== "ACTIVE") return { ok: false, status: "ineligible" };
  if (ifStale && profile.lzyumiLastLookupAt && now >= profile.lzyumiLastLookupAt && now.getTime() - profile.lzyumiLastLookupAt.getTime() < LZYUMI_REFRESH_INTERVAL_MS) return { ok: true, status: "fresh" };

  // The existing per-profile queue acts as a cross-device lease and retry cooldown.
  await db.lzyumiRefreshQueue.upsert({ where: { profileId: profile.id }, create: { profileId: profile.id, nextAttemptAt: now }, update: {} });
  const claim = await db.lzyumiRefreshQueue.updateMany({
    where: { profileId: profile.id, nextAttemptAt: { lte: now }, OR: [
      { status: { not: "PROCESSING" } },
      { status: "PROCESSING", lastAttemptAt: { lt: new Date(now.getTime() - 30 * 60000) } },
    ] },
    data: { status: "PROCESSING", lastAttemptAt: now, nextAttemptAt: new Date(now.getTime() + 5 * 60000) },
  });
  if (!claim.count) return { ok: true, status: "cooldown" };
  try {
    const result = await refresh(profile);
    if (!result.ok) throw new Error("Provider unavailable");
    await db.lzyumiRefreshQueue.updateMany({ where: { profileId: profile.id, status: "PROCESSING", lastAttemptAt: now }, data: {
      status: "SUCCEEDED", attemptCount: 0, lastSuccessAt: new Date(), lastError: null, notifiedAt: null,
      nextAttemptAt: new Date(now.getTime() + (ifStale ? LZYUMI_REFRESH_INTERVAL_MS : 5 * 60000)),
    } });
    return { ok: true, status: "updated" };
  } catch {
    await db.lzyumiRefreshQueue.updateMany({ where: { profileId: profile.id, status: "PROCESSING", lastAttemptAt: now }, data: {
      status: "FAILED", attemptCount: { increment: 1 }, lastError: "Profile refresh unavailable. Saved statistics were retained.", nextAttemptAt: new Date(now.getTime() + 5 * 60000),
    } });
    return { ok: false, status: "unavailable" };
  }
}
