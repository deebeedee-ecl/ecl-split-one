import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccountFromRequest } from "@/lib/account-auth";
import { refreshAccountProfileStats } from "@/lib/account-stats-refresh";

export async function POST(request: Request) {
  const account = await getAccountFromRequest(request);

  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const profile = await prisma.accountProfile.findUnique({
    where: { userId: account.id },
    select: { id: true, openId: true, chinaServerId: true, riotName: true },
  });

  if (!profile?.chinaServerId || !profile.riotName) {
    return NextResponse.json(
      { message: "No ecl.gg profile on file. Please re-verify your account." },
      { status: 400 },
    );
  }

  try {
    const result = await refreshAccountProfileStats(profile);
    if (!result.ok) {
      return NextResponse.json(
        { message: result.message },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("refresh-stats error:", err);
    return NextResponse.json(
      { message: "Failed to fetch stats from ecl.gg." },
      { status: 502 },
    );
  }
}
