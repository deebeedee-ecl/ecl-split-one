import { NextRequest, NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Debug endpoint: tells the client which lzyumi filters contain which game types
// Usage: GET /api/hub/debug-filters  (returns signed URLs for filters 1-10)
export async function GET(request: NextRequest) {
  const account = await getAccountFromRequest(request);
  if (!account) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const profile = await prisma.accountProfile.findUnique({
    where: { userId: account.id },
    select: { riotName: true, riotTag: true, chinaServerId: true },
  });

  if (!profile?.riotName || !profile?.chinaServerId) {
    return NextResponse.json({ message: "Profile incomplete" }, { status: 400 });
  }

  const nickname = profile.riotTag
    ? `${profile.riotName}#${profile.riotTag.replace(/^#+/, "")}`
    : profile.riotName;
  const areaId = profile.chinaServerId;

  const { LZYUMI_SECRET, LZYUMI_BASE_URL } = process.env;
  if (!LZYUMI_SECRET || !LZYUMI_BASE_URL) {
    return NextResponse.json({ message: "Missing env" }, { status: 500 });
  }

  // Return signed URLs for filters 1-10 so the client can fetch directly
  const filters = Array.from({ length: 10 }, (_, i) => i + 1);
  const baseUrl = `${request.nextUrl.origin}/api/lzyumi-sign`;

  const urls = filters.map((f) => ({
    filter: f,
    signUrl: `${baseUrl}?nickname=${encodeURIComponent(nickname)}&areaId=${areaId}&filter=${f}&allCount=5`,
  }));

  return NextResponse.json({ nickname, areaId, urls });
}
