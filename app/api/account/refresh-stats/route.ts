import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { refreshStatsOnOpen } from "@/lib/account-stats-on-open";

export const maxDuration = 60;
export const preferredRegion = ["sin1", "hkg1", "nrt1", "icn1"];

export async function POST(request: Request) {
  const account = await getAccountFromRequest(request);

  if (!account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await refreshStatsOnOpen(account.id, new URL(request.url).searchParams.get("ifStale") === "1");
    const status = result.ok ? 200 : result.status === "ineligible" ? 400 : 502;
    return NextResponse.json({ ...result, message: result.ok ? undefined : "Profile refresh unavailable. Your saved statistics are unchanged." }, { status, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("refresh-stats error:", err instanceof Error ? err.name : "Unknown error");
    return NextResponse.json(
      { message: "Failed to fetch stats from ecl.gg." },
      { status: 502 },
    );
  }
}
