import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STALE_HOURS = 12;

function unauthorized(request: NextRequest) {
  const secret = request.headers.get("x-ecl-kook-secret");
  return !process.env.ECL_KOOK_BOT_SECRET || secret !== process.env.ECL_KOOK_BOT_SECRET;
}

export async function GET(request: NextRequest) {
  if (unauthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const staleBefore = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

  const profiles = await prisma.accountProfile.findMany({
    where: {
      accountStatus: "ACTIVE",
      verificationStatus: "VERIFIED",
      riotName: { not: "" },
      chinaServerId: { not: null },
      OR: [
        { lzyumiRawProfile: null },
        { lzyumiLastLookupAt: null },
        { lzyumiLastLookupAt: { lt: staleBefore } },
      ],
    },
    orderBy: [
      { lzyumiRawProfile: "asc" },   // null first (new players)
      { lzyumiLastLookupAt: "asc" },
    ],
    select: {
      id: true,
      displayName: true,
      riotName: true,
      riotTag: true,
      chinaServerId: true,
    },
  });

  return NextResponse.json({ profiles, count: profiles.length });
}
