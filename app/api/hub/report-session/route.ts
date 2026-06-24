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
        displayName: true,
        riotName: true,
        riotTag: true,
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

  return NextResponse.json({ sessions, recentlyCompleted });
}
