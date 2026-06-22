import { NextRequest, NextResponse } from "next/server";
import { createLzyumiSignature, getChinaServer } from "@/lib/lzyumi";

export const dynamic = "force-dynamic";

const LZYUMI_BASE = "https://a.2025lol.top/lzyumi/lol";

// Returns a signed lzyumi URL so the browser can call lzyumi directly
// (bypasses server-side IP blocks – browser uses the user's residential IP).
// No auth required – the signature algorithm is public knowledge.
//
// type=info (default): sign a profile lookup URL (nickname required)
// type=detail: sign a match detail URL (openId + gameId required)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "info";
  const areaId = parseInt(searchParams.get("areaId") ?? "1", 10);

  const server = getChinaServer(areaId);
  const { lzyumiSign, signStr } = createLzyumiSignature();

  if (type === "detail") {
    const openId = searchParams.get("openId") ?? "";
    const gameId = searchParams.get("gameId") ?? "";

    if (!openId || !gameId) {
      return NextResponse.json({ error: "openId and gameId required for detail" }, { status: 400 });
    }

    const url = new URL(`${LZYUMI_BASE}/findOrderDetailInfoAll`);
    url.searchParams.set("openId", openId);
    url.searchParams.set("gameId", gameId);
    url.searchParams.set("areaId", String(server.id));
    url.searchParams.set("lzyumiSign", lzyumiSign);
    url.searchParams.set("signStr", signStr);

    return NextResponse.json({ url: url.toString() });
  }

  // Default: info / profile lookup
  const nickname = searchParams.get("nickname") ?? "";
  const allCount = searchParams.get("allCount") ?? "10";
  const filter = searchParams.get("filter") ?? "1";

  if (!nickname) {
    return NextResponse.json({ error: "nickname required" }, { status: 400 });
  }

  const encodedNick = encodeURIComponent(nickname.replace(/#/g, "*~*~*"));

  const url =
    `${LZYUMI_BASE}/info?nickname=${encodedNick}&allCount=${allCount}` +
    `&areaId=${server.id}&areaName=${encodeURIComponent(server.name)}` +
    `&seleMe=1&filter=${filter}&openId=&lzyumiSign=${lzyumiSign}&signStr=${signStr}`;

  return NextResponse.json({ url });
}
