import { NextResponse } from "next/server";
import { unauthorizedReportWorker } from "@/lib/inhouse-report-jobs";
import {
  applyManualInhouseImport,
  MANUAL_INHOUSE_IMPORT_OPERATION,
  parseManualInhouseImportManifest,
  preflightManualInhouseImport,
} from "@/lib/manual-inhouse-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type RequestBody = {
  action?: unknown;
  fingerprint?: unknown;
  manifest?: unknown;
};

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Manual inhouse import failed.";
  const conflict = /blocked|fingerprint|already exists|collision|partial|replay/i.test(message);
  return NextResponse.json({ ok: false, message }, { status: conflict ? 409 : 400 });
}
export async function POST(request: Request) {
  if (unauthorizedReportWorker(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  if (request.headers.get("x-ecl-manual-operation") !== MANUAL_INHOUSE_IMPORT_OPERATION) {
    return NextResponse.json({ ok: false, message: "Manual operation header is missing or invalid." }, { status: 400 });
  }

  try {
    const body = await request.json() as RequestBody;
    const manifest = parseManualInhouseImportManifest(body.manifest);
    if (body.action === "preflight") {
      const plan = await preflightManualInhouseImport(manifest);
      return NextResponse.json({ ok: plan.clean, mode: "preflight", readOnly: true, plan }, { status: plan.clean ? 200 : 409 });
    }
    if (body.action !== "apply") {
      return NextResponse.json({ ok: false, message: "action must be preflight or apply." }, { status: 400 });
    }
    if (process.env.VERCEL_ENV !== "production") {
      return NextResponse.json({ ok: false, message: "Apply is restricted to the production deployment." }, { status: 409 });
    }
    const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";
    const result = await applyManualInhouseImport(manifest, fingerprint);
    return NextResponse.json({ ok: true, mode: "apply", notify: false, ...result });
  } catch (error) {
    return failure(error);
  }
}
