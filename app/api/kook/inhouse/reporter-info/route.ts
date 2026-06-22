import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function unauthorized(request: Request) {
  const secret = request.headers.get("x-ecl-kook-secret");
  return !process.env.ECL_KOOK_BOT_SECRET || secret !== process.env.ECL_KOOK_BOT_SECRET;
}

const ACTIVE_SESSION_HOURS = 8;

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

  const sessionPlayer = await prisma.inhouseSessionPlayer.findFirst({
    where: {
      kookUserId,
      session: {
        status: "ASSIGNED",
        createdAt: { gte: activeSince },
      },
    },
    select: {
      profileId: true,
    },
    orderBy: {
      id: "desc",
    },
  });

  if (!sessionPlayer?.profileId) {
    return NextResponse.json(
      { message: "No active inhouse session found for this KOOK user." },
      { status: 404 },
    );
  }

  const profile = await prisma.accountProfile.findUnique({
    where: { id: sessionPlayer.profileId },
    select: {
      riotName: true,
      riotTag: true,
      chinaServerId: true,
    },
  });

  if (!profile?.riotName) {
    return NextResponse.json(
      { message: "Reporter does not have a linked ECL profile with a riot name." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    riotName: profile.riotName,
    riotTag: profile.riotTag ?? "",
    areaId: profile.chinaServerId ?? 1,
  });
}
