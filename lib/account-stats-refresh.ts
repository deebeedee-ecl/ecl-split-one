import { Prisma } from "@prisma/client";
import { fetchLzyumiRankedGames, fetchLzyumiRecentStat } from "@/lib/lzyumi";
import { prisma } from "@/lib/prisma";

export const LZYUMI_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 12;

type RefreshableProfile = {
  id: string;
  openId: string | null;
  chinaServerId: number | null;
  riotName: string;
};

function hasRankedGames(value: unknown) {
  if (!value || typeof value !== "object") return false;

  const rankedGames = value as { soloGames?: unknown; flexGames?: unknown };

  return (
    (Array.isArray(rankedGames.soloGames) && rankedGames.soloGames.length > 0) ||
    (Array.isArray(rankedGames.flexGames) && rankedGames.flexGames.length > 0)
  );
}

export async function refreshAccountProfileStats(profile: RefreshableProfile) {
  if (!profile.chinaServerId || !profile.riotName) {
    return {
      ok: false,
      profileId: profile.id,
      message: "Profile is missing Riot name or China server.",
    };
  }

  const [rankedGames, recentStat] = await Promise.allSettled([
    fetchLzyumiRankedGames({ riotName: profile.riotName, areaId: profile.chinaServerId }),
    profile.openId
      ? fetchLzyumiRecentStat({ openId: profile.openId, areaId: profile.chinaServerId })
      : Promise.resolve(null),
  ]);

  const updateData: Record<string, unknown> = {
    lzyumiLastLookupAt: new Date(),
  };

  if (rankedGames.status === "fulfilled" && hasRankedGames(rankedGames.value)) {
    updateData.lzyumiRankedGames = rankedGames.value as Prisma.InputJsonValue;
  }

  if (recentStat.status === "fulfilled" && recentStat.value?.data) {
    updateData.lzyumiRecentStat = recentStat.value as Prisma.InputJsonValue;
  }

  if (rankedGames.status === "rejected" && recentStat.status === "rejected") {
    return {
      ok: false,
      profileId: profile.id,
      message: "Both ranked games and recent stats failed.",
    };
  }

  await prisma.accountProfile.update({
    where: { id: profile.id },
    data: updateData,
  });

  return {
    ok: true,
    profileId: profile.id,
    rankedGames: rankedGames.status,
    recentStat: recentStat.status,
  };
}

