import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { hasChinaStatsPreviewAccess } from "@/lib/china-stats-preview-access-runtime";
import { loadChinaStatsLadderSnapshot } from "@/lib/china-stats-ladder-runtime";
import { CHINA_STATS_SERVER_KEYS, type ChinaStatsServerKey } from "@/lib/china-stats-servers";

export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Vary: "Authorization",
};

function requestedServer(request: Request): ChinaStatsServerKey | null {
  const value = new URL(request.url).searchParams.get("server");
  return CHINA_STATS_SERVER_KEYS.includes(value as ChinaStatsServerKey)
    ? value as ChinaStatsServerKey
    : null;
}
export async function GET(request: Request) {
  const developmentBypass = process.env.NODE_ENV === "development";
  const account = developmentBypass ? null : await getAccountFromRequest(request);
  if (!developmentBypass && !account) {
    return NextResponse.json({ message: "Sign in to view the China ranked ladder." }, { status: 401, headers: responseHeaders });
  }
  if (account && !await hasChinaStatsPreviewAccess(account.id, request.headers.get("authorization"))) {
    return NextResponse.json({ message: "This ECL account is not invited to the China Stats preview." }, { status: 403, headers: responseHeaders });
  }

  const server = requestedServer(request);
  if (!server) {
    return NextResponse.json({ message: "Choose a supported China server." }, { status: 400, headers: responseHeaders });
  }

  try {
    const snapshot = await loadChinaStatsLadderSnapshot(server);
    if (!snapshot) {
      return NextResponse.json({
        available: false,
        message: `A ${server === "ionia" ? "Ionia" : "Super Server"} ladder snapshot has not been collected yet.`,
      }, { status: 404, headers: responseHeaders });
    }
    return NextResponse.json({ available: true, snapshot }, { headers: responseHeaders });
  } catch {
    return NextResponse.json({
      available: false,
      message: "The latest ladder snapshot is not available right now.",
    }, { status: 503, headers: responseHeaders });
  }
}

