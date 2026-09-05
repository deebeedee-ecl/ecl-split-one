import { NextResponse } from "next/server";
import {
  LZYUMI_REFRESH_INTERVAL_MS,
} from "@/lib/account-stats-refresh";
import {
  enqueueDueLzyumiRefreshes,
  getLzyumiRefreshQueueSnapshot,
  processLzyumiRefreshQueue,
} from "@/lib/lzyumi-refresh-queue";

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
  const enqueued = await enqueueDueLzyumiRefreshes(batchLimit);
  const results = await processLzyumiRefreshQueue(batchLimit);
  const queue = await getLzyumiRefreshQueueSnapshot();

  const refreshed = results.filter((result) => result.ok).length;
  const failed = results.length - refreshed;

  return NextResponse.json({
    ok: true,
    staleWindowHours: LZYUMI_REFRESH_INTERVAL_MS / (1000 * 60 * 60),
    batchLimit,
    enqueued,
    selected: results.length,
    refreshed,
    failed,
    queue,
    results,
  });
}

export const POST = GET;

