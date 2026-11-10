import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccountFromRequest } from "@/lib/account-auth";
import { getLzyumiRankRows, formatLzyumiRank } from "@/lib/hub-profile";
import {
  LzyumiSnapshotValidationError,
  resolveLzyumiSnapshotRefresh,
  shouldRefreshLzyumiSnapshots,
} from "@/lib/lzyumi-snapshot";
import { LzyumiBrowserContractError } from "@/lib/lzyumi-browser-contract";

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
    soloResponse?: unknown;
    flexResponse?: unknown;
    targetProfileId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { rawProfile, recentStat, soloResponse, flexResponse } = body;
  if (!rawProfile || !recentStat || !soloResponse || !flexResponse) {
    return NextResponse.json(
      { message: "Complete Lzyumi responses are required" },
      { status: 400 },
    );
  }

  const targetProfileId = typeof body.targetProfileId === "string"
    ? body.targetProfileId.trim()
    : null;
  if (targetProfileId && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(targetProfileId)) {
    return NextResponse.json({ message: "Invalid target profile" }, { status: 400 });
  }

  const payloadSize = JSON.stringify({ rawProfile, recentStat, soloResponse, flexResponse }).length;
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
      lzyumiRecentStat: true,
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
    const refresh = resolveLzyumiSnapshotRefresh(
      {
        rawProfile: profile.lzyumiRawProfile,
        recentStat: profile.lzyumiRecentStat,
        rankedGames: profile.lzyumiRankedGames,
        lastLookupAt: profile.lzyumiLastLookupAt,
      },
      {
        profileResponse: rawProfile,
        soloResponse,
        flexResponse,
        recentStat,
        riotName: profile.riotName,
        riotTag: profile.riotTag,
        areaId: profile.chinaServerId,
        existingOpenId: profile.openId,
        fetchedAt,
      },
    );

    if (refresh.status === "rejected") {
      const error = refresh.error;
      const status =
        error instanceof LzyumiSnapshotValidationError && error.code !== "INVALID_SNAPSHOT"
          ? 409
          : 422;
      const code = error instanceof LzyumiBrowserContractError ? error.kind : error.code;
      return NextResponse.json({ message: error.message, code }, { status });
    }

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

    const ranks = getLzyumiRankRows(refresh.rawProfile);
    const hasRanks = Boolean(ranks.solo || ranks.flex);

    // Save one coherent snapshot. A failed source leaves the previous snapshot
    // and timestamp untouched instead of mixing fresh and stale sections.
    const update = await prisma.accountProfile.updateMany({
      where: {
        id: profile.id,
        lzyumiLastLookupAt: profile.lzyumiLastLookupAt,
      },
      data: {
        openId: refresh.identity.openId,
        lzyumiVerifiedAt: fetchedAt,
        lzyumiLastLookupAt: fetchedAt,
        lzyumiRawProfile: refresh.rawProfile as Prisma.InputJsonValue,
        lzyumiRecentStat: refresh.recentStat
          ? (refresh.recentStat as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        lzyumiRankedGames: refresh.rankedGames as Prisma.InputJsonValue,
        currentRank: hasRanks ? getCurrentRank(refresh.rawProfile) : null,
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
      hasRecentStat: Boolean(refresh.recentStat),
      recentStatStatus: refresh.recentStatStatus,
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
