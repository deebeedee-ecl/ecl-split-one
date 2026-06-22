import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLzyumiRankRows, formatLzyumiRank } from "@/lib/hub-profile";

export const dynamic = "force-dynamic";

function getCurrentRank(raw: unknown): string | null {
  const ranks = getLzyumiRankRows(raw);
  const rank = ranks.solo ?? ranks.flex;
  const formatted = formatLzyumiRank(rank);
  return formatted.label === "Unranked" ? null : formatted.label;
}

export async function POST(req: Request) {
  let body: { profileId?: string; rawProfile?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { profileId, rawProfile } = body;
  if (!profileId || !rawProfile) {
    return NextResponse.json({ error: "profileId and rawProfile required" }, { status: 400 });
  }

  const ranks = getLzyumiRankRows(rawProfile);
  const hasRanks = Boolean(ranks.solo || ranks.flex);
  const openId =
    (rawProfile as Record<string, unknown> & { battleInfo?: { openId?: string } })
      ?.battleInfo?.openId ?? null;

  const updateData: Record<string, unknown> = { lzyumiLastLookupAt: new Date() };

  if (hasRanks) {
    updateData.lzyumiRawProfile = rawProfile;
    updateData.currentRank = getCurrentRank(rawProfile);
  }
  if (openId) {
    updateData.openId = openId;
  }

  await prisma.accountProfile.update({
    where: { id: profileId },
    data: updateData,
  });

  return NextResponse.json({ ok: true, hasRanks, openId: openId ?? null });
}
