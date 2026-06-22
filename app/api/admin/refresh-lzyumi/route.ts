import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { refreshAccountProfileStats } from "@/lib/account-stats-refresh";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const preferredRegion = ["sin1", "hkg1", "nrt1", "icn1"];

type RefreshRequestBody = {
  limit?: unknown;
  profileId?: unknown;
};

function parseLimit(value: unknown) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 50;
  }

  return Math.min(parsed, 100);
}

export async function POST(request: Request) {
  let body: RefreshRequestBody = {};

  try {
    body = (await request.json()) as RefreshRequestBody;
  } catch {
    body = {};
  }

  const profileId = typeof body.profileId === "string" ? body.profileId : null;
  const limit = parseLimit(body.limit);

  const profiles = await prisma.accountProfile.findMany({
    where: profileId
      ? { id: profileId }
      : {
          accountStatus: "ACTIVE",
          verificationStatus: "VERIFIED",
          riotName: { not: "" },
          chinaServerId: { not: null },
        },
    orderBy: { updatedAt: "asc" },
    take: profileId ? 1 : limit,
    select: {
      id: true,
      displayName: true,
      riotName: true,
      riotTag: true,
      openId: true,
      chinaServerId: true,
    },
  });

  const results = [];

  for (const profile of profiles) {
    const result = await refreshAccountProfileStats(profile);
    results.push({
      displayName: profile.displayName,
      riotName: profile.riotName,
      ...result,
    });

    revalidatePath(`/hub/players/${profile.id}`);
  }

  revalidatePath("/hub/me");
  revalidatePath("/hub/players");
  revalidatePath("/hub/leaderboard");

  const failed = results.filter((result) => !result.ok).length;

  return NextResponse.json({
    success: failed === 0,
    selected: profiles.length,
    refreshed: results.length - failed,
    failed,
    results,
  });
}
