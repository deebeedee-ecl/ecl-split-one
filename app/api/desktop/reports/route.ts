import { NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { desktopEnabled, DesktopReportError, link, verifyLink } from "@/lib/desktop-report-policy";
import { ownerForUser, claimDesktopReport, submitDesktopReport } from "@/lib/desktop-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new DesktopReportError("Missing request body.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2 * 1024 * 1024) throw new DesktopReportError("Match upload is too large.", 413); chunks.push(value); }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch (error) { await reader.cancel().catch(() => {}); if (error instanceof DesktopReportError) throw error; throw new DesktopReportError("Invalid JSON request."); }
}
export async function POST(request: Request) {
  if (!desktopEnabled()) return NextResponse.json({ message: "Desktop reporting pilot is not enabled on this server." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const account = await getAccountFromRequest(request);
    if (!account) throw new DesktopReportError("Sign in to ECL Hub again.", 401);
    const owner = await ownerForUser(account.id), body = await readBody(request);
    let data;
    if (body.action === "link") data = link(owner, body.identity);
    else {
      const local = verifyLink(owner, request.headers.get("x-ecl-desktop-link"));
      if (body.action === "claim") data = { job: await claimDesktopReport(owner) };
      else if (body.action === "submit" && typeof body.jobId === "string" && body.jobId.length <= 100 && typeof body.lease === "string" && body.lease.length <= 100) data = await submitDesktopReport(owner, local, body.jobId, body.lease, body.raw);
      else throw new DesktopReportError("Unsupported desktop reporting action.");
    }
    return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof DesktopReportError;
    return NextResponse.json({ message: known ? error.message : "Reporting is temporarily unavailable. Try again later." }, { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
