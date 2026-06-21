import { Prisma } from "@prisma/client";
import {
  fetchLzyumiRankedGames,
  fetchLzyumiRecentStat,
  lookupLzyumiIdentity,
  lookupLzyumiProfile,
  recoverLzyumiPlayersFromRankedGames,
  type LzyumiLookupResponse,
  type LzyumiRecoveredPlayer,
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

function withRecoveredProfileData({
  rawProfile,
  recovered,
  riotName,
  riotTag,
  areaId,
}: {
  rawProfile: LzyumiLookupResponse;
  recovered: LzyumiRecoveredPlayer[];
  riotName: string;
  riotTag: string;
  areaId: number;
}) {
  const rankedRows = recovered
    .map((item) => item.rank)
    .filter((rank): rank is NonNullable<typeof rank> => Boolean(rank));

  if (!recovered.length && !rankedRows.length) return rawProfile;

  return {
    ...rawProfile,
    battleInfo: {
      ...(rawProfile.battleInfo ?? {}),
      nameInfoNew: `${riotName}#${riotTag}`,
      openId: recovered[0]?.openId ?? rawProfile.battleInfo?.openId,
      areaId,
      mapOneInfoList: rankedRows,
    },
  } satisfies LzyumiLookupResponse;
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
  const recoveredPlayers =
    !freshOpenId && profile.riotTag && rankedGames.status === "fulfilled"
      ? await recoverLzyumiPlayersFromRankedGames({
          riotName: profile.riotName,
          riotTag: profile.riotTag,
          areaId: profile.chinaServerId,
          rankedGames: rankedGames.value,
        }).catch(() => [])
      : [];
  const recoveredOpenId = recoveredPlayers[0]?.openId ?? null;
  const openId = freshOpenId ?? recoveredOpenId ?? profile.openId;
  const recentStat = openId
    ? await fetchLzyumiRecentStat({ openId, areaId: profile.chinaServerId }).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason }),
      )
    : ({ status: "fulfilled" as const, value: null } as const);

  const updateData: Prisma.AccountProfileUpdateInput = {
    lzyumiLastLookupAt: new Date(),
  };
  let storedRankRows = false;

  if (rawProfile.status === "fulfilled") {
    const profileForStorage =
      !hasRankRows(rawProfile.value) && profile.riotTag
        ? withRecoveredProfileData({
            rawProfile: rawProfile.value,
            recovered: recoveredPlayers,
            riotName: profile.riotName,
            riotTag: profile.riotTag,
            areaId: profile.chinaServerId,
          })
        : rawProfile.value;

    if (hasRankRows(profileForStorage)) {
      storedRankRows = true;
      updateData.lzyumiRawProfile = profileForStorage as Prisma.InputJsonValue;
      updateData.currentRank = getCurrentRankFromRawProfile(profileForStorage);
    }

    if (freshOpenId || recoveredOpenId) {
      updateData.openId = freshOpenId ?? recoveredOpenId;
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
    rankRows: storedRankRows,
  };
}

