import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLzyumiRankRows, formatLzyumiRank } from "@/lib/hub-profile";

export const dynamic = "force-dynamic";

function unauthorized(request: NextRequest) {
  const secret = request.headers.get("x-ecl-kook-secret");
  return !process.env.ECL_KOOK_BOT_SECRET || secret !== process.env.ECL_KOOK_BOT_SECRET;
}

function getCurrentRank(raw: unknown): string | null {
  const ranks = getLzyumiRankRows(raw);
  const rank = ranks.solo ?? ranks.flex;
  const formatted = formatLzyumiRank(rank);
  return formatted.label === "Unranked" ? null : formatted.label;
}

export async function POST(request: NextRequest) {
  if (unauthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: {
    profileId?: string;
    rawProfile?: unknown;
    soloGames?: unknown[];
    flexGames?: unknown[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { profileId, rawProfile, soloGames, flexGames } = body;
  if (!profileId || !rawProfile) {
    return NextResponse.json({ error: "profileId and rawProfile required" }, { status: 400 });
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

  await prisma.accountProfile.update({
    where: { id: profileId },
    data: updateData,
  });

  return NextResponse.json({ ok: true, hasRanks, openId: openId ?? null });
}
