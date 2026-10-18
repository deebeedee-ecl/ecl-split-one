import { Prisma } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { DesktopReportError, desktopEnabled } from "@/lib/desktop-report-policy";
import { RAW_MATCH_RETENTION_MS } from "@/lib/desktop-retention";

export function authorizeDesktopReview(cookie: string | undefined) {
  const expected = process.env.ADMIN_SESSION_SECRET;
  if (!desktopEnabled() || !expected || expected.length < 32) throw new DesktopReportError("Pilot review is not configured.", 503);
  const a = Buffer.from(cookie || ""), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new DesktopReportError("Admin access required.", 401);
}

export async function recordDesktopReview(jobId: string, decision: "reviewed" | "reject", reason: string, db = prisma) {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(jobId) || !["reviewed", "reject"].includes(decision) || reason.length > 500 || (decision === "reject" && !reason.trim())) throw new DesktopReportError("Choose a report and decision. Rejection needs a reason (maximum 500 characters).");
  return db.$transaction(async tx => {
    const job = await tx.inhouseReportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new DesktopReportError("Report not found.", 404);
    const data = job.rawMatchData as Record<string, unknown> | null;
    const target = decision === "reviewed" ? "DESKTOP_REVIEWED" : "DESKTOP_REJECTED";
    if (job.status === target) return { status: target, duplicate: true, lpApplied: false };
    if (job.status !== "DESKTOP_REVIEW" || data?.source !== "desktop-upload-v1" || !job.completedAt || job.completedAt.getTime() <= Date.now() - RAW_MATCH_RETENTION_MS) throw new DesktopReportError("This report is no longer available for review.", 409);
    const session = await tx.inhouseSession.updateMany({ where: { id: job.sessionId, status: { in: ["ASSIGNED", "AWAITING_REVIEW"] } }, data: { updatedAt: new Date() } });
    if (!session.count) throw new DesktopReportError("The session changed. Reload the review queue.", 409);
    const review = { decision, reason: reason.trim(), reviewedAt: new Date().toISOString(), reviewedBy: "administrator", lpApplied: false };
    const updated = await tx.inhouseReportJob.updateMany({ where: { id: job.id, status: "DESKTOP_REVIEW" }, data: { status: target, rawMatchData: JSON.parse(JSON.stringify({ ...data, review })) as Prisma.InputJsonValue } });
    if (!updated.count) throw new DesktopReportError("Another administrator already changed this report.", 409);
    await tx.inhouseSession.update({ where: { id: job.sessionId }, data: { status: decision === "reviewed" ? "REVIEWED" : "REJECTED" } });
    return { status: target, duplicate: false, lpApplied: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
