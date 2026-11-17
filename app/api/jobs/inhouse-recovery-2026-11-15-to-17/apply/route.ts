import { NextResponse } from "next/server";
import { unauthorizedReportWorker } from "@/lib/inhouse-report-jobs";
import {
  applyRankedInhouseRecovery,
  preflightRankedInhouseRecovery,
  RECOVERY_APPLY_OPERATION,
} from "@/lib/ranked-inhouse-recovery-apply-2026-11-15-to-17";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex" },
  });
}

export async function POST(request: Request) {
  if (unauthorizedReportWorker(request)) return json({ ok: false, code: "UNAUTHORIZED" }, 401);
  if (request.headers.get("x-ecl-recovery-operation") !== RECOVERY_APPLY_OPERATION) {
    return json({ ok: false, code: "INVALID_OPERATION" }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ ok: false, code: "JSON_REQUIRED" }, 415);
  }
  let body: { action?: unknown; fingerprint?: unknown; manifest?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "INVALID_JSON" }, 400);
  }
  try {
    if (body.action === "preflight") {
      const plan = await preflightRankedInhouseRecovery(body.manifest);
      return json({ ok: plan.clean, mode: "preflight", readOnly: true, plan }, plan.clean ? 200 : 409);
    }
    if (body.action !== "apply") return json({ ok: false, code: "INVALID_ACTION" }, 400);
    if (process.env.VERCEL_ENV !== "production") {
      return json({ ok: false, code: "PRODUCTION_ONLY" }, 409);
    }
    const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";
    if (!fingerprint) return json({ ok: false, code: "FINGERPRINT_REQUIRED" }, 400);
    const result = await applyRankedInhouseRecovery(body.manifest, fingerprint);
    return json({ ok: true, mode: "apply", result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const conflict = /blocked|fingerprint|collision|mismatch|already/i.test(message);
    return json({ ok: false, code: conflict ? "RECOVERY_CONFLICT" : "RECOVERY_FAILED" }, conflict ? 409 : 503);
  }
}
