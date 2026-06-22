import { NextResponse } from "next/server";
import {
  LZYUMI_REFRESH_INTERVAL_MS,
  refreshAccountProfileStats,
} from "@/lib/account-stats-refresh";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const preferredRegion = ["sin1", "hkg1", "nrt1", "icn1"];

const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 50;

function isUnauthorized(request: Request) {
  const expectedSecret = process.env.ECL_JOB_SECRET ?? process.env.ECL_KOOK_BOT_SECRET;
  const suppliedSecret =
    request.headers.get("x-ecl-job-secret") ??
    request.headers.get("x-ecl-kook-secret");

  return !expectedSecret || suppliedSecret !== expectedSecret;
}

function getBatchLimit(request: Request) {
  const url = new URL(request.url);
  const parsed = Number(url.searchParams.get("limit"));

  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_BATCH_LIMIT;

  return Math.min(parsed, MAX_BATCH_LIMIT);
}

export async function GET(request: Request) {
  if (isUnauthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const batchLimit = getBatchLimit(request);
  const staleBefore = new Date(Date.now() - LZYUMI_REFRESH_INTERVAL_MS);

  const profiles = await prisma.accountProfile.findMany({
    where: {
      riotName: {
        not: "",
      },
      chinaServerId: {
        not: null,
      },
      OR: [
        {
          lzyumiLastLookupAt: null,
        },
        {
          lzyumiLastLookupAt: {
            lt: staleBefore,
          },
        },
      ],
    },
    orderBy: [
      {
        lzyumiLastLookupAt: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    take: batchLimit,
    select: {
      id: true,
      displayName: true,
      riotName: true,
      riotTag: true,
      openId: true,
      chinaServerId: true,
      lzyumiLastLookupAt: true,
    },
  });

  const results = [];

  for (const profile of profiles) {
    try {
      const result = await refreshAccountProfileStats(profile);
      results.push({
        ...result,
        displayName: profile.displayName,
        riotId: `${profile.riotName}#${profile.riotTag}`,
      });
    } catch (error) {
      results.push({
        ok: false,
        profileId: profile.id,
        displayName: profile.displayName,
        riotId: `${profile.riotName}#${profile.riotTag}`,
        message: error instanceof Error ? error.message : "Unknown refresh error.",
      });
    }
  }

  const refreshed = results.filter((result) => result.ok).length;
  const failed = results.length - refreshed;

  return NextResponse.json({
    ok: true,
    staleWindowHours: LZYUMI_REFRESH_INTERVAL_MS / (1000 * 60 * 60),
    batchLimit,
    selected: profiles.length,
    refreshed,
    failed,
    results,
  });
}

export const POST = GET;

