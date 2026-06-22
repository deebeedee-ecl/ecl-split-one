import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const profiles = await prisma.accountProfile.findMany({
    where: {
      accountStatus: "ACTIVE",
      verificationStatus: "VERIFIED",
      riotName: { not: "" },
      chinaServerId: { not: null },
    },
    orderBy: { lzyumiLastLookupAt: "asc" },
    take: 100,
    select: {
      id: true,
      displayName: true,
      riotName: true,
      riotTag: true,
      chinaServerId: true,
    },
  });

  return NextResponse.json({ profiles });
}
