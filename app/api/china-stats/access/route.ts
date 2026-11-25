import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { hasChinaStatsPreviewAccess } from "@/lib/china-stats-preview-access-runtime";

export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Vary: "Authorization",
};

export async function GET(request: Request) {
  const account = await getAccountFromRequest(request);
  if (!account) {
    return NextResponse.json({ allowed: false }, { status: 401, headers: responseHeaders });
  }
  if (!await hasChinaStatsPreviewAccess(account.id)) {
    return NextResponse.json({ allowed: false }, { status: 403, headers: responseHeaders });
  }
  return NextResponse.json({ allowed: true }, { headers: responseHeaders });
}
