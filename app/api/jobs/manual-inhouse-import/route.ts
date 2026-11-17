import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  applyRankedInhouseImport,
  preflightRankedInhouseImport,
} from "@/lib/ranked-inhouse-import";
import {
  MANUAL_INHOUSE_IMPORT_APPLY_OPERATION,
  manualInhouseImportDefinition,
} from "@/lib/manual-inhouse-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BODY_BYTES = 5 * 1024 * 1024;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function unauthorizedManualImportWorker(request: Request) {
  const expectedSecrets = [process.env.ECL_REPORT_ENGINE_SECRET, process.env.ECL_JOB_SECRET]
    .map(clean)
    .filter(Boolean);
  const supplied = clean(
    request.headers.get("x-ecl-report-engine-secret")
      ?? request.headers.get("x-ecl-job-secret"),
  );
  return expectedSecrets.length === 0 || !expectedSecrets.some((secret) => secureEqual(secret, supplied));
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex",
    },
  });
}

export async function POST(request: Request) {
  if (unauthorizedManualImportWorker(request)) return json({ ok: false, code: "UNAUTHORIZED" }, 401);
  if (request.headers.get("x-ecl-manual-inhouse-operation") !== MANUAL_INHOUSE_IMPORT_APPLY_OPERATION) {
    return json({ ok: false, code: "INVALID_OPERATION" }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ ok: false, code: "JSON_REQUIRED" }, 415);
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ ok: false, code: "BODY_TOO_LARGE" }, 413);

  let body: { action?: unknown; fingerprint?: unknown; manifest?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "INVALID_JSON" }, 400);
  }

  try {
    if (body.action !== "preflight" && body.action !== "apply") {
      return json({ ok: false, code: "INVALID_ACTION" }, 400);
    }
    const definition = manualInhouseImportDefinition(body.manifest);
    if (body.action === "preflight") {
      const plan = await preflightRankedInhouseImport(body.manifest, definition);
      return json({ ok: plan.clean, mode: "preflight", readOnly: true, plan }, plan.clean ? 200 : 409);
    }
    if (process.env.VERCEL_ENV !== "production") {
      return json({ ok: false, code: "PRODUCTION_ONLY" }, 409);
    }
    const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";
    if (!fingerprint) return json({ ok: false, code: "FINGERPRINT_REQUIRED" }, 400);
    const result = await applyRankedInhouseImport(body.manifest, fingerprint, definition);
    return json({ ok: true, mode: "apply", result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const conflict = /blocked|fingerprint|collision|mismatch|already|approval|different/i.test(message);
    return json({ ok: false, code: conflict ? "IMPORT_CONFLICT" : "IMPORT_FAILED" }, conflict ? 409 : 503);
  }
}
