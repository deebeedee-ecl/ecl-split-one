import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccountFromRequest } from "@/lib/account-auth";
import { getLzyumiRankRows, formatLzyumiRank } from "@/lib/hub-profile";
import {
  hasLzyumiRecentStatData,
  LzyumiSnapshotValidationError,
  markValidatedLzyumiSnapshot,
  normalizeLzyumiRankedGames,
  shouldRefreshLzyumiSnapshots,
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
    targetProfileId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { rawProfile, recentStat, soloGames, flexGames } = body;
  if (!rawProfile) {
    return NextResponse.json({ message: "rawProfile required" }, { status: 400 });
  }

  const targetProfileId = typeof body.targetProfileId === "string"
    ? body.targetProfileId.trim()
    : null;
  if (targetProfileId && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(targetProfileId)) {
    return NextResponse.json({ message: "Invalid target profile" }, { status: 400 });
  }

  const payloadSize = JSON.stringify({ rawProfile, recentStat, soloGames, flexGames }).length;
  if (payloadSize > 2_000_000) {
    return NextResponse.json({ message: "ECL.GG snapshot is too large" }, { status: 413 });
  }

  const profile = await prisma.accountProfile.findFirst({
    where: targetProfileId
      ? {
          id: targetProfileId,
          verificationStatus: "VERIFIED",
          accountStatus: "ACTIVE",
        }
      : { userId: account.id },
    select: {
      id: true,
      riotName: true,
      riotTag: true,
      chinaServerId: true,
      openId: true,
      lzyumiLastLookupAt: true,
      lzyumiRawProfile: true,
      lzyumiRankedGames: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ message: "Profile not found" }, { status: 404 });
  }

  if (!profile.chinaServerId) {
    return NextResponse.json({ message: "Profile is missing a China server." }, { status: 409 });
  }

  try {
    const fetchedAt = new Date();
    const identity = validateLzyumiSnapshotIdentity({
      rawProfile,
      riotName: profile.riotName,
      riotTag: profile.riotTag,
      areaId: profile.chinaServerId,
      existingOpenId: profile.openId,
    });
    const rankedGames = normalizeLzyumiRankedGames(soloGames, flexGames);

    if (!shouldRefreshLzyumiSnapshots(
      profile.lzyumiRawProfile,
      profile.lzyumiRankedGames,
      profile.lzyumiLastLookupAt,
      fetchedAt.getTime(),
    )) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "fresh-snapshot",
        fetchedAt: profile.lzyumiLastLookupAt?.toISOString() ?? null,
      });
    }

    const ranks = getLzyumiRankRows(rawProfile);
    const hasRanks = Boolean(ranks.solo || ranks.flex);
    const validatedRawProfile = markValidatedLzyumiSnapshot(rawProfile, fetchedAt);
    const validatedRecentStat = hasLzyumiRecentStatData(recentStat)
      ? markValidatedLzyumiSnapshot(recentStat, fetchedAt)
      : null;

    // Save one coherent snapshot. A failed source leaves the previous snapshot
    // and timestamp untouched instead of mixing fresh and stale sections.
    const update = await prisma.accountProfile.updateMany({
      where: {
        id: profile.id,
        lzyumiLastLookupAt: profile.lzyumiLastLookupAt,
      },
      data: {
        openId: identity.openId,
        lzyumiVerifiedAt: fetchedAt,
        lzyumiLastLookupAt: fetchedAt,
        lzyumiRawProfile: validatedRawProfile as Prisma.InputJsonValue,
        lzyumiRecentStat: validatedRecentStat
          ? (validatedRecentStat as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        lzyumiRankedGames: rankedGames as Prisma.InputJsonValue,
        currentRank: hasRanks ? getCurrentRank(rawProfile) : null,
      },
    });

    if (update.count === 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "concurrent-refresh",
        fetchedAt: fetchedAt.toISOString(),
      });
    }

    revalidatePath(`/hub/players/${profile.id}`);

    return NextResponse.json({
      ok: true,
      skipped: false,
      hasRanks,
      hasRecentStat: Boolean(validatedRecentStat),
      fetchedAt: fetchedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof LzyumiSnapshotValidationError) {
      const status = error.code === "INVALID_SNAPSHOT" ? 422 : 409;
      return NextResponse.json({ message: error.message, code: error.code }, { status });
    }

    throw error;
  }
}
