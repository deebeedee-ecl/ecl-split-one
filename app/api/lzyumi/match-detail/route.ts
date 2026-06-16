import { NextResponse } from "next/server";
import { fetchLzyumiMatchDetail, findPlayerInDetail, getChinaServer } from "@/lib/lzyumi";

type MatchDetailBody = {
  openId?: string;
  gameId?: string;
  areaId?: string | number;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(clean(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function unauthorized(request: Request) {
  const secret = request.headers.get("x-ecl-kook-secret");
  return !process.env.ECL_KOOK_BOT_SECRET || secret !== process.env.ECL_KOOK_BOT_SECRET;
}

export async function POST(request: Request) {
  if (unauthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as MatchDetailBody;
  const openId = clean(body.openId);
  const gameId = clean(body.gameId);
  const server = getChinaServer(cleanNumber(body.areaId));

  if (!openId || !gameId) {
    return NextResponse.json(
      { message: "openId and gameId are required." },
      { status: 400 },
    );
  }

  const detail = await fetchLzyumiMatchDetail({
    openId,
    gameId,
    areaId: server.id,
  });

  return NextResponse.json({
    detail,
    player: findPlayerInDetail(detail, openId),
    areaId: server.id,
    areaName: server.name,
  });
}
