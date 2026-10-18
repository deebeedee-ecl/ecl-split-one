import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DesktopReportError } from "@/lib/desktop-report-policy";
import { authorizeDesktopReview, recordDesktopReview } from "@/lib/desktop-review";
import { RAW_MATCH_RETENTION_MS } from "@/lib/desktop-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Review decisions never create official results or award LP.
export async function GET(request: NextRequest) {
  try { authorizeDesktopReview(request.cookies.get("ecl_admin_session")?.value); }
  catch (error) { const failure = error as DesktopReportError; return NextResponse.json({ message: failure.message }, { status: failure.status, headers: { "Cache-Control": "no-store" } }); }
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (jobId && !/^[a-zA-Z0-9-]{1,100}$/.test(jobId)) return NextResponse.json({ message: "Invalid job ID." }, { status: 400 });
  const reports = await prisma.inhouseReportJob.findMany({ where: { status: "DESKTOP_REVIEW", completedAt: { gt: new Date(Date.now() - RAW_MATCH_RETENTION_MS) }, ...(jobId ? { id: jobId } : {}) }, orderBy: { completedAt: "desc" }, take: jobId ? 1 : 20,
    select: { id: true, sessionId: true, completedAt: true, rawMatchData: true, session: { select: { gameLabel: true } } },
  });
  return NextResponse.json({ reports: reports.map(row => {
    const data = row.rawMatchData as { gameId?: string; summary?: unknown; raw?: unknown } | null;
    return { id: row.id, sessionId: row.sessionId, label: row.session.gameLabel, completedAt: row.completedAt, gameId: data?.gameId, summary: data?.summary, ...(jobId ? { raw: data?.raw } : {}) };
  }) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    authorizeDesktopReview(request.cookies.get("ecl_admin_session")?.value);
    if (request.headers.get("origin") !== request.nextUrl.origin) throw new DesktopReportError("Review decisions must come from the admin page.", 403);
    const text = await request.text();
    if (text.length > 2048) throw new DesktopReportError("Review request is too large.", 413);
    let body;
    try { body = JSON.parse(text); } catch { throw new DesktopReportError("Invalid review request."); }
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.jobId !== "string" || !["reviewed", "reject"].includes(body.decision) || typeof body.reason !== "string") throw new DesktopReportError("Invalid review decision.");
    return NextResponse.json({ ok: true, ...await recordDesktopReview(body.jobId, body.decision, body.reason) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof DesktopReportError;
    return NextResponse.json({ message: known ? error.message : "Review is temporarily unavailable. Reload the queue." }, { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
