import { NextResponse } from "next/server";
import { getChinaServer, lookupLzyumiIdentity, lookupLzyumiProfile } from "@/lib/lzyumi";

type LookupBody = {
  riotName?: string;
  riotTag?: string;
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

  const body = (await request.json()) as LookupBody;
  const riotName = clean(body.riotName);
  const riotTag = clean(body.riotTag);
  const server = getChinaServer(cleanNumber(body.areaId));

  if (!riotName) {
    return NextResponse.json({ message: "riotName is required." }, { status: 400 });
  }

  if (riotTag) {
    const identity = await lookupLzyumiIdentity({
      riotName,
      riotTag,
      areaId: server.id,
    });

    return NextResponse.json({ identity });
  }

  const profile = await lookupLzyumiProfile({
    riotName,
    areaId: server.id,
  });

  return NextResponse.json({
    profile,
    resolvedName: profile.battleInfo?.nameInfoNew ?? null,
    openId: profile.battleInfo?.openId ?? null,
    areaId: server.id,
    areaName: server.name,
  });
}
