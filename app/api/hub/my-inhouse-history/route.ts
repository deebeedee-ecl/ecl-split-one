import { NextRequest, NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { INHOUSE_MATCH_FILTER } from "@/lib/inhouse-filter";
import { prisma } from "@/lib/prisma";
import { normalizeRiotPart, normalizeRiotTag } from "@/lib/riot-id";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const account = await getAccountFromRequest(request);
  if (!account) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const profile = await prisma.accountProfile.findUnique({
    where: { userId: account.id },
    select: { riotName: true, riotTag: true },
  });

  if (!profile?.riotName) return NextResponse.json({ games: [] });

  const riotName = normalizeRiotPart(profile.riotName);
  const cleanTag = normalizeRiotTag(profile.riotTag);

  const player = await prisma.player.findFirst({
    where: {
      riotName: { equals: riotName, mode: "insensitive" },
      ...(cleanTag ? { riotTag: { equals: cleanTag, mode: "insensitive" } } : {}),
    },
  });

  if (!player) return NextResponse.json({ games: [] });

  const stats = await prisma.matchGamePlayerStat.findMany({
    where: {
      playerId: player.id,
      ...INHOUSE_MATCH_FILTER,
    },
    select: {
      id: true,
      isWin: true,
      kills: true,
      deaths: true,
      assists: true,
      lpChange: true,
      eloAfter: true,
      isMVP: true,
      isSVP: true,
      createdAt: true,
      matchGame: {
        select: {
          match: { select: { roundLabel: true, matchLabel: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const games = stats.map((s) => ({
    id: s.id,
    gameLabel: s.matchGame.match.roundLabel ?? s.matchGame.match.matchLabel ?? "IH Game",
    date: s.createdAt.toISOString(),
    isWin: s.isWin,
    kills: s.kills,
    deaths: s.deaths,
    assists: s.assists,
    lpChange: s.lpChange,
    eloAfter: s.eloAfter,
    isMVP: s.isMVP,
    isSVP: s.isSVP,
  }));

  return NextResponse.json({ games });
}
