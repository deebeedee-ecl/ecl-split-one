import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchLatestLzyumiMatch,
  getChinaServer,
  type LzyumiPlayerDetail,
} from "@/lib/lzyumi";

type LatestMatchBody = {
  kookUserId?: string;
  riotName?: string;
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

function summarizePlayer(player: LzyumiPlayerDetail | null) {
  if (!player) return null;

  return {
    riotId: player.nickNameStr ?? player.nickName ?? null,
    championId: player.detailChampionId ?? null,
    position: player.position ?? null,
    result: player.win ?? null,
    kda: player.scoreInfo ?? null,
    score: player.scoreInfoNum ?? null,
    wasMvp: player.wasMvp === "1",
    wasSvp: player.wasSvp === "1",
    gold: player.echartsMap?.goldEarned ?? player.goldEarned ?? null,
    damageDealt: player.echartsMap?.totalDamageDealt ?? player.totalDamageDealt ?? null,
    damageTaken: player.echartsMap?.totalDamageTaken ?? null,
    killParticipation: player.echartsMap?.killAssisScore ?? null,
    teamId: player.teamId ?? null,
  };
}

async function findLinkedProfile(kookUserId: string) {
  return prisma.accountProfile.findFirst({
    where: {
      kookId: kookUserId,
      verificationStatus: "VERIFIED",
      accountStatus: "ACTIVE",
    },
    select: {
      id: true,
      displayName: true,
      riotName: true,
      riotTag: true,
      chinaServerId: true,
      chinaServerName: true,
      openId: true,
    },
  });
}

export async function POST(request: Request) {
  if (unauthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as LatestMatchBody;
  const kookUserId = clean(body.kookUserId);
  let riotName = clean(body.riotName);
  let areaId = cleanNumber(body.areaId);
  let linkedProfile: Awaited<ReturnType<typeof findLinkedProfile>> = null;

  if (kookUserId) {
    linkedProfile = await findLinkedProfile(kookUserId);

    if (!linkedProfile) {
      return NextResponse.json({ message: "Linked KOOK profile not found." }, { status: 404 });
    }

    riotName = linkedProfile.riotName;
    areaId = linkedProfile.chinaServerId ?? areaId;
  }

  const server = getChinaServer(areaId);

  if (!riotName) {
    return NextResponse.json(
      { message: "Provide kookUserId or riotName." },
      { status: 400 },
    );
  }

  const latest = await fetchLatestLzyumiMatch({
    riotName,
    areaId: server.id,
  });

  if (latest.status !== "found") {
    return NextResponse.json(
      {
        status: latest.status,
        message: "No recent ecl.gg match found.",
        profile: linkedProfile,
        lzyumiProfile: latest.profile,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    status: "found",
    profile: linkedProfile,
    lzyumiProfile: {
      resolvedName: latest.profile.battleInfo?.nameInfoNew ?? null,
      openId: latest.profile.battleInfo?.openId ?? null,
      level: latest.profile.battleInfo?.level ?? null,
      areaId: server.id,
      areaName: server.name,
    },
    recentMatch: latest.recentMatch,
    player: summarizePlayer(latest.player),
    teamDetails: latest.detail.data?.teamDetails ?? [],
    rawDetail: latest.detail,
  });
}
