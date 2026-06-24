import { NextRequest, NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Browser-based inhouse match reporting.
 *
 * The Kook bot runs on Railway (cloud IP), which is blocked by lzyumi.
 * This endpoint lets the reporter submit the match from their browser
 * (residential IP, not blocked).
 *
 * Flow:
 *   1. Browser fetches lzyumi profile (filter=1) → gets openId + latest gameId
 *   2. Browser fetches match detail (findOrderDetailInfoAll) → gets wgBattleDetailInfo
 *   3. Browser POSTs { rawMatchData } to this endpoint with their JWT
 *   4. This endpoint forwards to /api/kook/inhouse/report using the bot secret + their kookId
 */
export async function POST(request: NextRequest) {
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
      {
        message:
          "Your KOOK account is not linked. Type !verify CODE in the ECL Kook server first.",
      },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { rawMatchData, sessionId } = body as {
    rawMatchData?: unknown;
    sessionId?: string;
  };

  if (!rawMatchData) {
    return NextResponse.json({ message: "rawMatchData is required" }, { status: 400 });
  }

  if (!process.env.ECL_KOOK_BOT_SECRET) {
    return NextResponse.json({ message: "Bot secret not configured" }, { status: 500 });
  }

  // Delegate to the existing report route (same process, no network hop needed on Vercel).
  const origin = new URL(request.url).origin;
  const reportRes = await fetch(`${origin}/api/kook/inhouse/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ecl-kook-secret": process.env.ECL_KOOK_BOT_SECRET,
    },
    body: JSON.stringify({
      command: "!report",
      reporterKookUserId: profile.kookId,
      sessionId,
      rawMatchData,
    }),
  });

  const data = await reportRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: reportRes.status });
}
