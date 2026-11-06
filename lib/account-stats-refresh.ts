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
import {
  hasLzyumiRecentStatData,
  markValidatedLzyumiSnapshot,
  normalizeLzyumiRankedGames,
  validateLzyumiSnapshotIdentity,
} from "@/lib/lzyumi-snapshot";
import { prisma } from "@/lib/prisma";

export const LZYUMI_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 12;

type RefreshableProfile = {
  id: string;
  openId: string | null;
  chinaServerId: number | null;
  riotName: string;
  riotTag?: string | null;
};

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

function rejectedMessage(result: PromiseRejectedResult, label: string) {
  const reason = result.reason;
  const message = reason instanceof Error ? reason.message : String(reason || "Unknown error");
  return `${label}: ${message}`;
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
  if (!profile.chinaServerId || !profile.riotName || !profile.riotTag) {
    return {
      ok: false,
      profileId: profile.id,
      message: "Profile is missing a complete Riot ID or China server.",
    };
  }

  const lookupName = profile.riotTag
    ? `${profile.riotName}#${profile.riotTag}`
    : profile.riotName;
  const [rawProfile, rankedGames] = await Promise.allSettled([
    lookupProfileForRefresh(profile),
    fetchLzyumiRankedGames({ riotName: lookupName, areaId: profile.chinaServerId }),
  ]);

  if (rawProfile.status === "rejected" || rankedGames.status === "rejected") {
    return {
      ok: false,
      profileId: profile.id,
      message: [
        "The complete ECL.GG snapshot could not be refreshed.",
        ...(rawProfile.status === "rejected" ? [rejectedMessage(rawProfile, "profile")] : []),
        ...(rankedGames.status === "rejected" ? [rejectedMessage(rankedGames, "ranked")] : []),
      ].join(" "),
    };
  }

  const freshOpenId = rawProfile.value.battleInfo?.openId ?? null;
  const recoveredPlayers =
    !freshOpenId
      ? await recoverLzyumiPlayersFromRankedGames({
          riotName: profile.riotName,
          riotTag: profile.riotTag,
          areaId: profile.chinaServerId,
          rankedGames: rankedGames.value,
        }).catch(() => [])
      : [];
  const recoveredOpenId = recoveredPlayers[0]?.openId ?? null;
  const profileForStorage =
    !hasRankRows(rawProfile.value) && recoveredOpenId
      ? withRecoveredProfileData({
          rawProfile: rawProfile.value,
          recovered: recoveredPlayers,
          riotName: profile.riotName,
          riotTag: profile.riotTag,
          areaId: profile.chinaServerId,
        })
      : rawProfile.value;

  let identity;
  let normalizedRankedGames;
  try {
    identity = validateLzyumiSnapshotIdentity({
      rawProfile: profileForStorage,
      riotName: profile.riotName,
      riotTag: profile.riotTag,
      areaId: profile.chinaServerId,
      existingOpenId: profile.openId,
    });
    normalizedRankedGames = normalizeLzyumiRankedGames(
      rankedGames.value.soloGames,
      rankedGames.value.flexGames,
    );
  } catch (error) {
    return {
      ok: false,
      profileId: profile.id,
      message: error instanceof Error ? error.message : "The ECL.GG snapshot failed validation.",
    };
  }

  const recentStat = await fetchLzyumiRecentStat({
    openId: identity.openId,
    areaId: profile.chinaServerId,
  }).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ status: "rejected" as const, reason }),
  );

  const storedRankRows = hasRankRows(profileForStorage);
  const validatedRawProfile = markValidatedLzyumiSnapshot(profileForStorage);
  const validatedRecentStat =
    recentStat.status === "fulfilled" && hasLzyumiRecentStatData(recentStat.value)
      ? markValidatedLzyumiSnapshot(recentStat.value)
      : null;
  const updateData: Prisma.AccountProfileUpdateInput = {
    openId: identity.openId,
    lzyumiVerifiedAt: new Date(),
    lzyumiLastLookupAt: new Date(),
    lzyumiRawProfile: validatedRawProfile as Prisma.InputJsonValue,
    lzyumiRankedGames: normalizedRankedGames as Prisma.InputJsonValue,
    lzyumiRecentStat: validatedRecentStat
      ? (validatedRecentStat as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    currentRank: storedRankRows ? getCurrentRankFromRawProfile(profileForStorage) : null,
  };

  await prisma.accountProfile.update({
    where: { id: profile.id },
    data: updateData,
  });

  return {
    ok: true,
    profileId: profile.id,
    rawProfile: "fulfilled" as const,
    rankedGames: "fulfilled" as const,
    recentStat:
      validatedRecentStat ? "fulfilled" as const : "unavailable" as const,
    rankRows: storedRankRows,
  };
}

