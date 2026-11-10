import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getLzyumiRankRows, formatLzyumiRank } from "@/lib/hub-profile";
import {
  LzyumiSnapshotValidationError,
  resolveLzyumiSnapshotRefresh,
} from "@/lib/lzyumi-snapshot";
import { LzyumiBrowserContractError } from "@/lib/lzyumi-browser-contract";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "ecl2026";
}

async function requireAdmin() {
  const jar = await cookies();
  return jar.get("ecl_admin_session")?.value === getAdminSessionSecret();
}

function getCurrentRank(raw: unknown): string | null {
  const ranks = getLzyumiRankRows(raw);
  const rank = ranks.solo ?? ranks.flex;
  const formatted = formatLzyumiRank(rank);
  return formatted.label === "Unranked" ? null : formatted.label;
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    profileId?: string;
    rawProfile?: unknown;
    recentStat?: unknown;
    soloResponse?: unknown;
    flexResponse?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { profileId, rawProfile, recentStat, soloResponse, flexResponse } = body;
  if (!profileId || !rawProfile || !recentStat || !soloResponse || !flexResponse) {
    return NextResponse.json(
      { error: "profileId and complete Lzyumi responses required" },
      { status: 400 },
    );
  }

  const profile = await prisma.accountProfile.findUnique({
    where: { id: profileId },
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
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.chinaServerId) {
    return NextResponse.json({ error: "Profile is missing a China server" }, { status: 409 });
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
      return NextResponse.json({ error: error.message, code }, { status });
    }

    const ranks = getLzyumiRankRows(refresh.rawProfile);
    const hasRanks = Boolean(ranks.solo || ranks.flex);
    await prisma.accountProfile.update({
      where: { id: profile.id },
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

    return NextResponse.json({
      ok: true,
      hasRanks,
      hasRecentStat: Boolean(refresh.recentStat),
      recentStatStatus: refresh.recentStatStatus,
      openId: refresh.identity.openId,
    });
  } catch (error) {
    if (error instanceof LzyumiSnapshotValidationError) {
      const status = error.code === "INVALID_SNAPSHOT" ? 422 : 409;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
