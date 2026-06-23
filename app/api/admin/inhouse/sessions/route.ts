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

  // Batch load from AccountProfile — by profileId AND by kookId fallback
  const profileIds = sessions
    .flatMap((s) => s.players.map((p) => p.profileId))
    .filter((id): id is string => Boolean(id));

  const kookIds = sessions
    .flatMap((s) => s.players.filter((p) => !p.profileId).map((p) => p.kookUserId))
    .filter(Boolean);

  const [profilesById, profilesByKook] = await Promise.all([
    profileIds.length > 0
      ? prisma.accountProfile.findMany({
          where: { id: { in: profileIds } },
          select: { id: true, chinaServerId: true, riotName: true, riotTag: true },
        })
      : Promise.resolve([]),
    kookIds.length > 0
      ? prisma.accountProfile.findMany({
          where: { kookId: { in: kookIds } },
          select: { kookId: true, chinaServerId: true, riotName: true, riotTag: true },
        })
      : Promise.resolve([]),
  ]);

  const profileMap = new Map(profilesById.map((p) => [p.id, p]));
  const kookMap = new Map(profilesByKook.map((p) => [p.kookId!, p]));

  const enriched = sessions.map((session) => ({
    id: session.id,
    gameLabel: session.gameLabel,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    players: session.players.map((p) => {
      const prof = (p.profileId ? profileMap.get(p.profileId) : null) ?? kookMap.get(p.kookUserId) ?? null;
      const riotName = p.riotName || prof?.riotName || null;
      const rawTag = p.riotTag || prof?.riotTag || null;
      const riotTag = rawTag ? rawTag.replace(/^#+/, "") : null;
      return {
        id: p.id,
        kookUserId: p.kookUserId,
        displayName: p.displayName,
        riotName,
        riotTag,
        side: p.side,
        eloAtReady: p.eloAtReady,
        chinaServerId: prof?.chinaServerId ?? null,
      };
    }),
  }));

  return NextResponse.json({ sessions: enriched });
}
