import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Protected by middleware (admin session cookie).
// Submits an admin-initiated inhouse report, bypassing the reporter-in-session check.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { sessionId, rawMatchData } = body as {
    sessionId?: string;
    rawMatchData?: unknown;
  };

  if (!sessionId || !rawMatchData) {
    return NextResponse.json({ message: "sessionId and rawMatchData are required" }, { status: 400 });
  }

  if (!process.env.ECL_KOOK_BOT_SECRET) {
    return NextResponse.json({ message: "Bot secret not configured" }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const reportRes = await fetch(`${origin}/api/kook/inhouse/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ecl-kook-secret": process.env.ECL_KOOK_BOT_SECRET,
    },
    body: JSON.stringify({
      adminOverride: true,
      reporterKookUserId: "ADMIN",
      sessionId,
      rawMatchData,
    }),
  });

  const data = await reportRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: reportRes.status });
}
