import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getLzyumiRankRows, formatLzyumiRank } from "@/lib/hub-profile";
import {
  hasLzyumiRecentStatData,
  LzyumiSnapshotValidationError,
  markValidatedLzyumiSnapshot,
  normalizeLzyumiRankedGames,
  validateLzyumiSnapshotIdentity,
} from "@/lib/lzyumi-snapshot";
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
    soloGames?: unknown;
    flexGames?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { profileId, rawProfile, recentStat, soloGames, flexGames } = body;
  if (!profileId || !rawProfile) {
    return NextResponse.json({ error: "profileId and rawProfile required" }, { status: 400 });
  }

  const profile = await prisma.accountProfile.findUnique({
    where: { id: profileId },
    select: { id: true, riotName: true, riotTag: true, chinaServerId: true, openId: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.chinaServerId) {
    return NextResponse.json({ error: "Profile is missing a China server" }, { status: 409 });
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
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
