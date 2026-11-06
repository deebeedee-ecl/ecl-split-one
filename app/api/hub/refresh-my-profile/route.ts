import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccountFromRequest } from "@/lib/account-auth";
import { getLzyumiRankRows, formatLzyumiRank } from "@/lib/hub-profile";
import {
  hasLzyumiRecentStatData,
  LzyumiSnapshotValidationError,
  markValidatedLzyumiSnapshot,
  normalizeLzyumiRankedGames,
  validateLzyumiSnapshotIdentity,
} from "@/lib/lzyumi-snapshot";

export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

function getCurrentRank(raw: unknown): string | null {
  const ranks = getLzyumiRankRows(raw);
  const rank = ranks.solo ?? ranks.flex;
  const formatted = formatLzyumiRank(rank);
  return formatted.label === "Unranked" ? null : formatted.label;
}

export async function POST(request: Request) {
  const account = await getAccountFromRequest(request);
  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let body: {
    rawProfile?: unknown;
    recentStat?: unknown;
    soloGames?: unknown[];
    flexGames?: unknown[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { rawProfile, recentStat, soloGames, flexGames } = body;
  if (!rawProfile) {
    return NextResponse.json({ error: "rawProfile required" }, { status: 400 });
  }

  const profile = await prisma.accountProfile.findUnique({
    where: { userId: account.id },
    select: {
      id: true,
      riotName: true,
      riotTag: true,
      chinaServerId: true,
      openId: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ message: "Profile not found" }, { status: 404 });
  }

  if (!profile.chinaServerId) {
    return NextResponse.json({ message: "Profile is missing a China server." }, { status: 409 });
  }

  try {
    const identity = validateLzyumiSnapshotIdentity({
      rawProfile,
      riotName: profile.riotName,
      riotTag: profile.riotTag,
      areaId: profile.chinaServerId,
      existingOpenId: profile.openId,
    });
    const rankedGames = normalizeLzyumiRankedGames(soloGames, flexGames);

    const ranks = getLzyumiRankRows(rawProfile);
    const hasRanks = Boolean(ranks.solo || ranks.flex);
    const validatedRawProfile = markValidatedLzyumiSnapshot(rawProfile);
    const validatedRecentStat = hasLzyumiRecentStatData(recentStat)
      ? markValidatedLzyumiSnapshot(recentStat)
      : null;

    // Save one coherent snapshot. A failed source leaves the previous snapshot
    // and timestamp untouched instead of mixing fresh and stale sections.
    await prisma.accountProfile.update({
      where: { id: profile.id },
      data: {
        openId: identity.openId,
        lzyumiVerifiedAt: new Date(),
        lzyumiLastLookupAt: new Date(),
        lzyumiRawProfile: validatedRawProfile as Prisma.InputJsonValue,
        lzyumiRecentStat: validatedRecentStat
          ? (validatedRecentStat as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        lzyumiRankedGames: rankedGames as Prisma.InputJsonValue,
        currentRank: hasRanks ? getCurrentRank(rawProfile) : null,
      },
    });

    return NextResponse.json({
      ok: true,
      hasRanks,
      hasRecentStat: Boolean(validatedRecentStat),
      openId: identity.openId,
    });
  } catch (error) {
    if (error instanceof LzyumiSnapshotValidationError) {
      const status = error.code === "INVALID_SNAPSHOT" ? 422 : 409;
      return NextResponse.json({ message: error.message, code: error.code }, { status });
    }

    throw error;
  }
}
