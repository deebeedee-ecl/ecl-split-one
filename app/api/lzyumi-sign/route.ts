import { NextRequest, NextResponse } from "next/server";
import { createLzyumiSignature, getChinaServer } from "@/lib/lzyumi";

export const dynamic = "force-dynamic";

const LZYUMI_BASE = "https://a.2025lol.top/lzyumi/lol/info";

// Returns a signed lzyumi URL so the browser can call lzyumi directly
// (bypasses server-side IP blocks – browser uses the user's residential IP).
// No auth required – the signature algorithm is public knowledge.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const nickname = searchParams.get("nickname") ?? "";
  const areaId = parseInt(searchParams.get("areaId") ?? "1", 10);
  const allCount = searchParams.get("allCount") ?? "10";
  const filter = searchParams.get("filter") ?? "1";

  if (!nickname) {
    return NextResponse.json({ error: "nickname required" }, { status: 400 });
  }

  const server = getChinaServer(areaId);
  const { lzyumiSign, signStr } = createLzyumiSignature();
  const encodedNick = encodeURIComponent(nickname.replace(/#/g, "*~*~*"));

  const url =
    `${LZYUMI_BASE}?nickname=${encodedNick}&allCount=${allCount}` +
    `&areaId=${server.id}&areaName=${encodeURIComponent(server.name)}` +
    `&seleMe=1&filter=${filter}&openId=&lzyumiSign=${lzyumiSign}&signStr=${signStr}`;

  return NextResponse.json({ url });
}
