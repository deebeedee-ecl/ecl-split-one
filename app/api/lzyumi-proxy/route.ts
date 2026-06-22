import { NextRequest, NextResponse } from "next/server";
import {
  fetchLzyumiRankedGames,
  fetchLzyumiRecentStat,
  lookupLzyumiProfile,
} from "@/lib/lzyumi";

export const dynamic = "force-dynamic";

function isUnauthorized(req: NextRequest): boolean {
  const expected = process.env.ECL_JOB_SECRET ?? process.env.ECL_KOOK_BOT_SECRET;
  const supplied =
    req.headers.get("x-ecl-job-secret") ?? req.headers.get("x-ecl-kook-secret");
  return !expected || supplied !== expected;
}

export async function GET(req: NextRequest) {
  if (isUnauthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action");
  const nickname = searchParams.get("nickname") ?? "";
  const openId = searchParams.get("openId") ?? "";
  const areaId = parseInt(searchParams.get("areaId") ?? "1", 10);

  try {
    if (action === "lookup") {
      if (!nickname) return NextResponse.json({ error: "nickname required" }, { status: 400 });
      const result = await lookupLzyumiProfile({ riotName: nickname, areaId });
      return NextResponse.json(result);
    }

    if (action === "ranked") {
      if (!nickname) return NextResponse.json({ error: "nickname required" }, { status: 400 });
      const result = await fetchLzyumiRankedGames({ riotName: nickname, areaId });
      return NextResponse.json(result);
    }

    if (action === "recent") {
      if (!openId) return NextResponse.json({ error: "openId required" }, { status: 400 });
      const result = await fetchLzyumiRecentStat({ openId, areaId });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "action must be lookup | ranked | recent" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
