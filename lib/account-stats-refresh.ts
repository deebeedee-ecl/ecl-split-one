import { Prisma } from "@prisma/client";
import {
  fetchLzyumiRankedGames,
  fetchLzyumiRecentStat,
  lookupLzyumiIdentity,
  lookupLzyumiProfile,
} from "@/lib/lzyumi";
import { formatLzyumiRank, getLzyumiRankRows } from "@/lib/hub-profile";
import { prisma } from "@/lib/prisma";

export const LZYUMI_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 12;

type RefreshableProfile = {
  id: string;
  openId: string | null;
  chinaServerId: number | null;
  riotName: string;
  riotTag?: string | null;
};

function hasRankedGames(value: unknown) {
  if (!value || typeof value !== "object") return false;

  const rankedGames = value as { soloGames?: unknown; flexGames?: unknown };

  return (
    (Array.isArray(rankedGames.soloGames) && rankedGames.soloGames.length > 0) ||
    (Array.isArray(rankedGames.flexGames) && rankedGames.flexGames.length > 0)
  );
}

function hasRankRows(value: unknown) {
  const ranks = getLzyumiRankRows(value);
  return Boolean(ranks.solo || ranks.flex);
}

function getCurrentRankFromRawProfile(value: unknown) {
  const ranks = getLzyumiRankRows(value);
  const rank = ranks.solo ?? ranks.flex;
  const formatted = formatLzyumiRank(rank);

  return formatted.label === "Unranked" ? null : formatted.label;
}

async function lookupProfileForRefresh(profile: RefreshableProfile) {
  if (profile.riotTag) {
    const identity = await lookupLzyumiIdentity({
      riotName: profile.riotName,
      riotTag: profile.riotTag,
      areaId: profile.chinaServerId!,
    });

    if (identity.status === "mismatch") {
      throw new Error(
        `ecl.gg resolved ${identity.resolvedName ?? "another account"} instead of ${profile.riotName}#${profile.riotTag}.`,
      );
    }

    return identity.rawProfile;
  }

  return lookupLzyumiProfile({ riotName: profile.riotName, areaId: profile.chinaServerId! });
}

export async function refreshAccountProfileStats(profile: RefreshableProfile) {
  if (!profile.chinaServerId || !profile.riotName) {
    return {
      ok: false,
      profileId: profile.id,
      message: "Profile is missing Riot name or China server.",
    };
  }

  const lookupName = profile.riotTag
    ? `${profile.riotName}#${profile.riotTag}`
    : profile.riotName;
  const [rawProfile, rankedGames] = await Promise.allSettled([
    lookupProfileForRefresh(profile),
    fetchLzyumiRankedGames({ riotName: lookupName, areaId: profile.chinaServerId }),
  ]);

  const freshOpenId =
    rawProfile.status === "fulfilled" ? rawProfile.value.battleInfo?.openId ?? null : null;
  const openId = freshOpenId ?? profile.openId;
  const recentStat = openId
    ? await fetchLzyumiRecentStat({ openId, areaId: profile.chinaServerId }).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason }),
      )
    : ({ status: "fulfilled" as const, value: null } as const);

  const updateData: Prisma.AccountProfileUpdateInput = {
    lzyumiLastLookupAt: new Date(),
  };

  if (rawProfile.status === "fulfilled") {
    if (hasRankRows(rawProfile.value)) {
      updateData.lzyumiRawProfile = rawProfile.value as Prisma.InputJsonValue;
      updateData.currentRank = getCurrentRankFromRawProfile(rawProfile.value);
    }

    if (freshOpenId) {
      updateData.openId = freshOpenId;
    }
  }

  if (rankedGames.status === "fulfilled" && hasRankedGames(rankedGames.value)) {
    updateData.lzyumiRankedGames = rankedGames.value as Prisma.InputJsonValue;
  }

  if (recentStat.status === "fulfilled" && recentStat.value?.data) {
    updateData.lzyumiRecentStat = recentStat.value as Prisma.InputJsonValue;
  }

  if (
    rawProfile.status === "rejected" &&
    rankedGames.status === "rejected" &&
    recentStat.status === "rejected"
  ) {
    return {
      ok: false,
      profileId: profile.id,
      message: "Raw profile, ranked games, and recent stats failed.",
    };
  }

  await prisma.accountProfile.update({
    where: { id: profile.id },
    data: updateData,
  });

  return {
    ok: true,
    profileId: profile.id,
    rawProfile: rawProfile.status,
    rankedGames: rankedGames.status,
    recentStat: recentStat.status,
    rankRows: rawProfile.status === "fulfilled" && hasRankRows(rawProfile.value),
  };
}

