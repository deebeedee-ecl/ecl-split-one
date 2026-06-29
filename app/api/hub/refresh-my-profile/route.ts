import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccountFromRequest } from "@/lib/account-auth";
import { getLzyumiRankRows, formatLzyumiRank } from "@/lib/hub-profile";

export const dynamic = "force-dynamic";

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
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ message: "Profile not found" }, { status: 404 });
  }

  const openId =
    (rawProfile as { battleInfo?: { openId?: string } })?.battleInfo?.openId ?? null;
  const ranks = getLzyumiRankRows(rawProfile);
  const hasRanks = Boolean(ranks.solo || ranks.flex);

  const updateData: Record<string, unknown> = {
    lzyumiLastLookupAt: new Date(),
  };

  if (openId) updateData.openId = openId;

  if (hasRanks) {
    updateData.lzyumiRawProfile = rawProfile;
    updateData.currentRank = getCurrentRank(rawProfile);
  }

  const rankedSolo = Array.isArray(soloGames) ? soloGames : [];
  const rankedFlex = Array.isArray(flexGames) ? flexGames : [];
  if (rankedSolo.length > 0 || rankedFlex.length > 0) {
    updateData.lzyumiRankedGames = { soloGames: rankedSolo, flexGames: rankedFlex };
  }

  if (
    recentStat &&
    typeof recentStat === "object" &&
    (recentStat as { data?: unknown }).data
  ) {
    updateData.lzyumiRecentStat = recentStat;
  }

  await prisma.accountProfile.update({
    where: { id: profile.id },
    data: updateData,
  });

  return NextResponse.json({ ok: true, hasRanks, openId: openId ?? null });
}
