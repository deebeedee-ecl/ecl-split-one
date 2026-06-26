import { NextRequest, NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const REPORT_WINDOW_HOURS = 48;

export async function GET(request: NextRequest) {
  const account = await getAccountFromRequest(request);
  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const profile = await prisma.accountProfile.findUnique({
    where: { userId: account.id },
    select: { kookId: true },
  });

  if (!profile?.kookId) {
    return NextResponse.json(
      { message: "Verify your KOOK account before reporting an inhouse." },
      { status: 400 },
    );
  }

  const since = new Date(Date.now() - REPORT_WINDOW_HOURS * 60 * 60 * 1000);
  const sessionSelect = {
    id: true,
    gameLabel: true,
    status: true,
    createdAt: true,
    completedAt: true,
    players: {
      select: {
        id: true,
        kookUserId: true,
        displayName: true,
        riotName: true,
        riotTag: true,
        side: true,
        profileId: true,
      },
    },
  } as const;

  const [sessions, recentlyCompleted] = await Promise.all([
    prisma.inhouseSession.findMany({
      where: {
        status: "ASSIGNED",
        createdAt: { gte: since },
        players: { some: { kookUserId: profile.kookId } },
      },
      select: sessionSelect,
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.inhouseSession.findFirst({
      where: {
        status: "COMPLETED",
        completedAt: { gte: since },
        players: { some: { kookUserId: profile.kookId } },
      },
      select: sessionSelect,
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const sessionPlayers = sessions.flatMap((session) => session.players);
  const profileIds = sessionPlayers
    .map((player) => player.profileId)
    .filter((id): id is string => Boolean(id));
  const kookIds = sessionPlayers
    .filter((player) => !player.profileId)
    .map((player) => player.kookUserId)
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

  const profileMap = new Map(profilesById.map((profile) => [profile.id, profile]));
  const kookMap = new Map(profilesByKook.map((profile) => [profile.kookId!, profile]));
  const enrichSession = (session: (typeof sessions)[number]) => ({
    ...session,
    players: session.players.map((player) => {
      const enrichedProfile =
        (player.profileId ? profileMap.get(player.profileId) : null) ??
        kookMap.get(player.kookUserId) ??
        null;

      return {
        id: player.id,
        kookUserId: player.kookUserId,
        displayName: player.displayName,
        riotName: player.riotName || enrichedProfile?.riotName || null,
        riotTag: player.riotTag || enrichedProfile?.riotTag || null,
        side: player.side,
        chinaServerId: enrichedProfile?.chinaServerId ?? null,
      };
    }),
  });

  return NextResponse.json({
    sessions: sessions.map(enrichSession),
    recentlyCompleted: recentlyCompleted ? enrichSession(recentlyCompleted) : null,
  });
}
