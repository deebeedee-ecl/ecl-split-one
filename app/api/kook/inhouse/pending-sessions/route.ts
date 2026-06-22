import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ACTIVE_SESSION_HOURS = 48;

function unauthorized(request: Request) {
  const secret = request.headers.get("x-ecl-kook-secret");
  return !process.env.ECL_KOOK_BOT_SECRET || secret !== process.env.ECL_KOOK_BOT_SECRET;
}

/**
 * Returns the open (not yet reported) inhouse sessions that a KOOK user
 * participated in — used by the bot to present the !report selection list.
 */
export async function GET(request: Request) {
  if (unauthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const kookUserId = searchParams.get("kookUserId")?.trim();

  if (!kookUserId) {
    return NextResponse.json({ message: "kookUserId is required" }, { status: 400 });
  }

  const activeSince = new Date(Date.now() - ACTIVE_SESSION_HOURS * 60 * 60 * 1000);

  const sessions = await prisma.inhouseSession.findMany({
    where: {
      status: "ASSIGNED",
      lzyumiGameId: null,
      createdAt: { gte: activeSince },
      players: { some: { kookUserId } },
    },
    select: {
      id: true,
      gameLabel: true,
      createdAt: true,
      players: {
        select: { side: true, displayName: true },
        orderBy: { side: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({ sessions });
}
