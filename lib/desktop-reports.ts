import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendKookChannelMessage } from "@/lib/kook-notifier";
import { DesktopReportError, eligible, requestData, validateDesktopMatch, type DesktopOwner, type DesktopIdentity } from "./desktop-report-policy";
import { isDesktopSession } from "@/lib/desktop-session";
import { getRankedSeason } from "@/lib/ranked-season";

const active = ["DESKTOP_PENDING", "DESKTOP_COLLECTING", "DESKTOP_REVIEW", "DESKTOP_REVIEW_EXPIRED", "DESKTOP_REVIEWED", "DESKTOP_REJECTED"];
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const freshSession = (id: string, kookId: string) => ({ id, status: "ASSIGNED", lzyumiGameId: null, createdAt: { gte: new Date(Date.now() - 48 * 3600000) }, players: { some: { kookUserId: kookId } } });
export async function ownerForUser(userId: string) {
  const profile = await prisma.accountProfile.findUnique({ where: { userId }, select: { id: true, userId: true, kookId: true, riotName: true, riotTag: true, chinaServerId: true, verificationStatus: true, accountStatus: true } });
  if (!profile) throw new DesktopReportError("Complete your ECL profile first.", 403);
  eligible(profile); return profile;
}
export async function enqueueDesktopReport(sessionId: string, kookId: string, gameId: string, channelId?: string, db = prisma) {
  if (!/^\d{5,20}$/.test(gameId)) throw new DesktopReportError("Provide a numeric League Game ID after the inhouse number.");
  const profiles = await db.accountProfile.findMany({ where: { kookId }, take: 2 });
  if (profiles.length !== 1) throw new DesktopReportError("Your KOOK identity must belong to exactly one verified ECL profile.", 403);
  const owner = profiles[0]; eligible(owner);
  return db.$transaction(async tx => {
    const session = await tx.inhouseSession.findFirst({ where: freshSession(sessionId, kookId), include: { players: true } });
    if (!session || !session.players.some(p => p.profileId === owner.id && p.kookUserId === kookId)) throw new DesktopReportError("No eligible pending inhouse found for your account.", 403);
    const season = getRankedSeason();
    if (season && session.createdAt < season.startedAt) throw new DesktopReportError("Create a fresh !ready roster for the current ranked season.", 409);
    // Serialize requests for one ready session, including competing reporters.
    await tx.inhouseSession.update({ where: { id: session.id }, data: { updatedAt: new Date() } });
    const existing = await tx.inhouseReportJob.findFirst({ where: { sessionId, status: { in: [...active, "PENDING", "PROCESSING"] } }, orderBy: { createdAt: "desc" } });
    if (existing) {
      const data = existing.rawMatchData as { gameId?: string; expiresAt?: number } | null;
      if (["DESKTOP_PENDING", "DESKTOP_COLLECTING"].includes(existing.status) && data?.expiresAt && data.expiresAt <= Date.now()) {
        await tx.inhouseReportJob.update({ where: { id: existing.id }, data: { status: "DESKTOP_EXPIRED", lockedBy: null, lockedAt: null } });
      } else {
        if (existing.requestedByKookId === kookId && data?.gameId === gameId) return existing;
        throw new DesktopReportError("This inhouse already has a report request or is awaiting review. Ask an admin before changing the reporter or Game ID.", 409);
      }
    }
    if (session.reportRawJson && !isDesktopSession(session.reportRawJson)) throw new DesktopReportError("This session already has a legacy report confirmation. Resolve it first.", 409);
    return tx.inhouseReportJob.create({ data: { sessionId, requestedByKookId: kookId, responseChannelId: channelId || null, status: "DESKTOP_PENDING", rawMatchData: json({ source: "desktop-request-v1", ownerProfileId: owner.id, gameId, expiresAt: Date.now() + 60 * 60000 }) } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function claimDesktopReport(owner: DesktopOwner, db = prisma) {
  return db.$transaction(async tx => {
    const job = await tx.inhouseReportJob.findFirst({ where: {
      requestedByKookId: owner.kookId!, session: { ...freshSessionForOwner(owner), status: "ASSIGNED" },
      OR: [{ status: "DESKTOP_PENDING" }, { status: "DESKTOP_COLLECTING", lockedAt: { lt: new Date(Date.now() - 2 * 60000) } }],
    }, orderBy: { createdAt: "asc" }, include: { session: { include: { players: true } } } });
    if (!job) return null;
    const season = getRankedSeason();
    if (season && job.session.createdAt < season.startedAt) return null;
    let data;
    try { data = requestData(job.rawMatchData, owner); }
    catch { await tx.inhouseReportJob.update({ where: { id: job.id }, data: { status: "DESKTOP_EXPIRED", lockedBy: null, lockedAt: null } }); return null; }
    if (job.attempts >= 20) { await tx.inhouseReportJob.update({ where: { id: job.id }, data: { status: "DESKTOP_FAILED", lockedBy: null, lockedAt: null } }); return null; }
    const lease = randomUUID();
    const result = await tx.inhouseReportJob.updateMany({ where: { id: job.id, status: job.status, lockedAt: job.lockedAt, requestedByKookId: owner.kookId! }, data: { status: "DESKTOP_COLLECTING", lockedBy: lease, lockedAt: new Date(), attempts: { increment: 1 } } });
    return result.count === 1 ? { id: job.id, gameId: data.gameId, label: job.session.gameLabel, lease, expiresAt: Math.min(data.expiresAt, Date.now() + 2 * 60000) } : null;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
function freshSessionForOwner(owner: DesktopOwner) {
  return { status: { in: ["ASSIGNED", "AWAITING_REVIEW"] }, lzyumiGameId: null, createdAt: { gte: new Date(Date.now() - 48 * 3600000) }, players: { some: { profileId: owner.id, kookUserId: owner.kookId! } } };
}
export async function submitDesktopReport(owner: DesktopOwner, local: DesktopIdentity, jobId: string, lease: string, raw: unknown, db = prisma) {
  const result = await db.$transaction(async tx => {
    const job = await tx.inhouseReportJob.findFirst({ where: { id: jobId, requestedByKookId: owner.kookId!, session: freshSessionForOwner(owner) }, include: { session: { include: { players: true } } } });
    if (!job) throw new DesktopReportError("This request is not assigned to your account.", 403);
    const saved = job.rawMatchData as { gameId?: string; ownerProfileId?: string } | null;
    if (job.status === "DESKTOP_REVIEW" && saved?.ownerProfileId === owner.id) return { job, duplicate: true };
    const data = requestData(job.rawMatchData, owner);
    const season = getRankedSeason();
    if (season && job.session.createdAt < season.startedAt) throw new DesktopReportError("This roster belongs to the previous ranked season.", 409);
    if (job.session.status && job.session.status !== "ASSIGNED") throw new DesktopReportError("This session is no longer accepting collection uploads.", 409);
    if (job.status !== "DESKTOP_COLLECTING" || job.lockedBy !== lease || !job.lockedAt || job.lockedAt.getTime() < Date.now() - 2 * 60000) throw new DesktopReportError("Report lease expired. Let ECL Hub check again.", 409);
    const ids = job.session.players.map(p => p.profileId).filter((id): id is string => !!id);
    const profiles = await tx.accountProfile.findMany({ where: { id: { in: ids }, verificationStatus: "VERIFIED", accountStatus: "ACTIVE", chinaServerId: 1 }, select: { id: true, kookId: true, riotName: true, riotTag: true } });
    if (profiles.length !== 10 || job.session.players.some(p => !profiles.some(v => v.id === p.profileId && v.kookId === p.kookUserId && v.riotName === p.riotName && v.riotTag === p.riotTag))) throw new DesktopReportError("All ten ready identities must still match verified active Ionia profiles.", 409);
    const summary = validateDesktopMatch(raw, data.gameId, local, job.session);
    // Lock the session and reject the same region/Game ID in another review or official result.
    await tx.inhouseSession.update({ where: { id: job.sessionId }, data: { updatedAt: new Date() } });
    const prior = await tx.inhouseSession.findFirst({ where: { lzyumiGameId: data.gameId } });
    const review = await tx.inhouseReportJob.findFirst({ where: { id: { not: job.id }, status: { in: ["DESKTOP_REVIEW", "DESKTOP_REVIEW_EXPIRED", "DESKTOP_REVIEWED", "DESKTOP_REJECTED"] }, rawMatchData: { path: ["gameId"], equals: data.gameId } } });
    if (prior || review) throw new DesktopReportError("This Game ID has already been reported or is awaiting review.", 409);
    const update = await tx.inhouseReportJob.updateMany({ where: { id: job.id, status: "DESKTOP_COLLECTING", lockedBy: lease }, data: { status: "DESKTOP_REVIEW", rawMatchData: json({ source: "desktop-upload-v1", ownerProfileId: owner.id, gameId: data.gameId, platformId: "HN1", summary, raw }), lockedBy: null, lockedAt: null, completedAt: new Date() } });
    if (!update.count) throw new DesktopReportError("Another request changed this report. Check its status.", 409);
    await tx.inhouseSession.update({ where: { id: job.sessionId }, data: { status: "AWAITING_REVIEW" } });
    return { job, duplicate: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  let notified = false;
  if (!result.duplicate && result.job.responseChannelId) {
    try { notified = (await sendKookChannelMessage({ channelId: result.job.responseChannelId, content: `${result.job.session.gameLabel || "Inhouse"}: desktop match received. All ten ready players and sides matched. Administrator review is required; no result or rating has been applied.`, signal: AbortSignal.timeout(8000) })).ok; } catch { /* The saved review remains discoverable through !report even if KOOK is unavailable. */ }
  }
  return { status: "REVIEW_REQUIRED", notified };
}
