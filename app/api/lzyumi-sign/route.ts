import { NextRequest, NextResponse } from "next/server";
import { createLzyumiSignature, getChinaServer } from "@/lib/lzyumi";
import { buildLzyumiEndpointUrl } from "@/lib/lzyumi-browser-contract";
import { buildLzyumiIdentityAttempts } from "@/lib/lzyumi-browser-identity";
import { getAccountFromRequest } from "@/lib/account-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

const LZYUMI_BASE = "https://a.2025lol.top/lzyumi/lol";

// Returns signed Lzyumi URLs so the browser can call Lzyumi directly
// (bypasses server-side IP blocks; the browser uses the user's residential IP).
// Direct public signing remains unauthenticated because the signature algorithm
// is public knowledge. The stored-owner profile bundle is authenticated.
//
// type=info (default): sign a profile lookup URL (nickname required)
// type=profile-refresh: sign a bounded identity bundle from the authenticated owner's stored identity
// type=detail: sign a match detail URL (openId + gameId required)
// type=recent: sign a recent-stat URL (openId required)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "info";
  const areaId = parseInt(searchParams.get("areaId") ?? "1", 10);

  if (type === "profile-refresh") {
    const account = await getAccountFromRequest(req);
    if (!account) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const profile = await prisma.accountProfile.findUnique({
      where: { userId: account.id },
      select: {
        riotName: true,
        riotTag: true,
        chinaServerId: true,
        openId: true,
      },
    });
    if (!profile) {
      return NextResponse.json({ message: "Profile not found" }, { status: 404 });
    }
    if (!profile.riotName || !profile.riotTag || !profile.chinaServerId) {
      return NextResponse.json(
        { message: "Profile is missing a complete Riot ID or China server." },
        { status: 409 },
      );
    }

    const server = getChinaServer(profile.chinaServerId);
    const attempts = buildLzyumiIdentityAttempts({
      riotName: profile.riotName,
      riotTag: profile.riotTag,
      hasSavedOpenId: Boolean(profile.openId?.trim()),
    }).map((attempt) => {
      const { lzyumiSign, signStr } = createLzyumiSignature();
      const url = buildLzyumiEndpointUrl(LZYUMI_BASE, "profile");
      url.searchParams.set("nickname", attempt.nickname.replace(/#/g, "*~*~*"));
      url.searchParams.set("allCount", "10");
      url.searchParams.set("areaId", String(server.id));
      url.searchParams.set("areaName", server.name);
      url.searchParams.set("seleMe", "1");
      url.searchParams.set("filter", "1");
      url.searchParams.set(
        "openId",
        attempt.useSavedOpenId ? profile.openId?.trim() ?? "" : "",
      );
      url.searchParams.set("lzyumiSign", lzyumiSign);
      url.searchParams.set("signStr", signStr);
      return { kind: attempt.kind, url: url.toString() };
    });

    return NextResponse.json(
      { attempts },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const server = getChinaServer(areaId);
  const { lzyumiSign, signStr } = createLzyumiSignature();

  if (type === "detail") {
    const openId = searchParams.get("openId") ?? "";
    const gameId = searchParams.get("gameId") ?? "";

    if (!openId || !gameId) {
      return NextResponse.json({ error: "openId and gameId required for detail" }, { status: 400 });
    }

    const url = buildLzyumiEndpointUrl(LZYUMI_BASE, "detail");
    url.searchParams.set("openId", openId);
    url.searchParams.set("gameId", gameId);
    url.searchParams.set("areaId", String(server.id));
    url.searchParams.set("lzyumiSign", lzyumiSign);
    url.searchParams.set("signStr", signStr);

    return NextResponse.json({ url: url.toString() });
  }

  if (type === "recent") {
    const openId = searchParams.get("openId") ?? "";

    if (!openId) {
      return NextResponse.json({ error: "openId required for recent stats" }, { status: 400 });
    }

    const url = buildLzyumiEndpointUrl(LZYUMI_BASE, "recent");
    url.searchParams.set("openId", openId);
    url.searchParams.set("areaId", String(server.id));
    url.searchParams.set("lzyumiSign", lzyumiSign);
    url.searchParams.set("signStr", signStr);

    return NextResponse.json({ url: url.toString() });
  }

  // Default: info / profile lookup
  const nickname = searchParams.get("nickname") ?? "";
  const openId = searchParams.get("openId") ?? "";
  const allCount = searchParams.get("allCount") ?? "10";
  const filter = searchParams.get("filter") ?? "1";

  if (!nickname && !openId) {
    return NextResponse.json({ error: "nickname or openId required" }, { status: 400 });
  }

  const encodedNick = encodeURIComponent(nickname.replace(/#/g, "*~*~*"));
  const encodedOpenId = encodeURIComponent(openId);

  const url =
    `${LZYUMI_BASE}/info?nickname=${encodedNick}&allCount=${allCount}` +
    `&areaId=${server.id}&areaName=${encodeURIComponent(server.name)}` +
    `&seleMe=1&filter=${filter}&openId=${encodedOpenId}&lzyumiSign=${lzyumiSign}&signStr=${signStr}`;

  return NextResponse.json({ url });
}
