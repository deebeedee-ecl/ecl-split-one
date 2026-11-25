import { NextResponse } from "next/server";
import { normalizeChinaStatsLadderSnapshot } from "@/lib/china-stats-ladder";
import {
  chinaStatsCollectorAuthorized,
  chinaStatsCollectorConfigured,
  storeChinaStatsLadderSnapshot,
  type ChinaStatsLadderDatabase,
} from "@/lib/china-stats-ladder-ingest";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "icn1";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const responseHeaders = { "Cache-Control": "no-store, max-age=0" };

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

export async function POST(request: Request) {
  if (!chinaStatsCollectorConfigured()) {
    return json({ ok: false, code: "COLLECTOR_UNAVAILABLE" }, 503);
  }
  if (!chinaStatsCollectorAuthorized(request)) {
    return json({ ok: false, code: "UNAUTHORIZED" }, 401);
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ ok: false, code: "JSON_REQUIRED" }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ ok: false, code: "BODY_TOO_LARGE" }, 413);
  }

  let value: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
      return json({ ok: false, code: "BODY_TOO_LARGE" }, 413);
    }
    value = JSON.parse(text) as unknown;
  } catch {
    return json({ ok: false, code: "INVALID_JSON" }, 400);
  }

  const snapshot = normalizeChinaStatsLadderSnapshot(value);
  if (!snapshot) return json({ ok: false, code: "INVALID_SNAPSHOT" }, 422);

  try {
    const result = await storeChinaStatsLadderSnapshot(
      prisma as unknown as ChinaStatsLadderDatabase,
      snapshot,
    );
    if (result.status === "stale" || result.status === "conflict") {
      return json({ ok: false, code: result.status === "stale" ? "STALE_SNAPSHOT" : "SNAPSHOT_CONFLICT" }, 409);
    }
    return json({
      ok: true,
      status: result.status,
      server: snapshot.server,
      capturedAt: snapshot.capturedAt,
      rows: snapshot.rows.length,
    }, result.status === "created" ? 201 : 200);
  } catch {
    return json({ ok: false, code: "STORE_UNAVAILABLE" }, 503);
  }
}
