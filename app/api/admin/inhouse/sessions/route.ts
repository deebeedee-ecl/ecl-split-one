import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Protected by middleware (admin session cookie).
export async function GET() {
  const sessions = await prisma.inhouseSession.findMany({
    where: { status: "ASSIGNED" },
    include: { players: true },
    orderBy: { createdAt: "desc" },
  });

  if (sessions.length === 0) {
    return NextResponse.json({ sessions: [] });
  }

  // Batch load chinaServerId from AccountProfile for lzyumi lookup
  const profileIds = sessions
    .flatMap((s) => s.players.map((p) => p.profileId))
    .filter((id): id is string => Boolean(id));

  const profiles =
    profileIds.length > 0
      ? await prisma.accountProfile.findMany({
          where: { id: { in: profileIds } },
          select: { id: true, chinaServerId: true },
        })
      : [];

  const profileMap = new Map(profiles.map((p) => [p.id, p.chinaServerId]));

  const enriched = sessions.map((session) => ({
    id: session.id,
    gameLabel: session.gameLabel,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    players: session.players.map((p) => ({
      id: p.id,
      kookUserId: p.kookUserId,
      displayName: p.displayName,
      riotName: p.riotName,
      riotTag: p.riotTag,
      side: p.side,
      eloAtReady: p.eloAtReady,
      chinaServerId: p.profileId ? (profileMap.get(p.profileId) ?? null) : null,
    })),
  }));

  return NextResponse.json({ sessions: enriched });
}
