import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { desktopEnabled, DesktopReportError } from "@/lib/desktop-report-policy";
import { enqueueDesktopReport } from "@/lib/desktop-reports";
import { getRankedSeason } from "@/lib/ranked-season";
import { HUB_REMINDER, REPORTER_REMINDER, inhouseNumber, inhouseSelector, reportStage } from "@/lib/hub-bot-copy";

const include = { players: true, reportJobs: { orderBy: { createdAt: "desc" as const }, take: 1 } };
type Session = Prisma.InhouseSessionGetPayload<{ include: typeof include }>;
export type HubCommandReply = { reply: string; status: string; request?: { id: string; selector: string; createdAt: string } };
type Options = { userId: string; args: string[]; admin?: boolean; channelId?: string; db?: typeof prisma };
const result = (status: string, reply: string): HubCommandReply => ({ status, reply });

async function sessionsFor(options: Options, admin = false) {
  return (options.db ?? prisma).inhouseSession.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 48 * 3600000) }, ...(admin ? {} : { players: { some: { kookUserId: options.userId } } }) },
    include, orderBy: { createdAt: "desc" }, take: 50,
  });
}
function pick(sessions: Session[], selector?: string) {
  if (!selector) return sessions.length === 1 ? sessions[0] : null;
  const key = inhouseSelector(selector);
  return sessions.find(session => session.id === key || inhouseNumber(session.gameLabel) === key) ?? null;
}
function choose(sessions: Session[], command: string, selector?: string) {
  if (!sessions.length) return result("NO_SESSION", "No recent inhouse found for your KOOK account. Join the ranked voice channel and use !inhouse.");
  return result("CHOOSE_SESSION", [selector ? `Could not select inhouse ${selector}.` : "Choose the inhouse:", ...sessions.map(session => `${session.gameLabel || session.id}: ${command} ${inhouseNumber(session.gameLabel) || session.id}`)].join("\n"));
}
function describe(session: Session): HubCommandReply {
  const job = session.reportJobs[0];
  const label = session.gameLabel || "Inhouse";
  if (session.status === "COMPLETED") return result("COMPLETED", `${label} was already officially reported. Check Hub's Inhouse History.`);
  if (session.status === "CANCELLED") return result("CANCELLED", `${label} was cancelled. Uploaded review records are retained. No new collection can be requested.`);
  if (!job) return result("READY_TO_REPORT", `${label} — teams assigned.\nAfter the game, your Hub reporter should use !report ${inhouseNumber(session.gameLabel) || session.id} GAME_ID.\n\n${HUB_REMINDER}`);
  const data = job.rawMatchData as { gameId?: string; review?: { reason?: string } } | null;
  const stage = reportStage(job.status, data);
  const reporter = session.players.find(player => player.kookUserId === job.requestedByKookId)?.displayName || "assigned participant";
  return { status: stage.code, reply: [label, data?.gameId ? `Game ID: ${data.gameId}` : "", `Reporter: ${reporter}`, stage.label, data?.review?.reason ? `Review note: ${data.review.reason}` : "", "No LP awarded by this app reporting pilot.", stage.code === "WAITING_FOR_HUB" ? REPORTER_REMINDER : ""].filter(Boolean).join("\n"), request: { id: job.id, selector: inhouseNumber(session.gameLabel) || session.id, createdAt: job.createdAt.toISOString() } };
}

export async function hubStatus(options: Options): Promise<HubCommandReply> {
  if (options.args.length > 1) return result("USAGE", "Use !status IH_NUMBER.");
  const sessions = await sessionsFor(options, !!options.admin);
  const selected = options.args.length ? pick(sessions, options.args[0]) : sessions.find(session => session.status === "ASSIGNED") || sessions[0];
  if (!selected) return choose(sessions, "!status", options.args[0]);
  return describe(selected);
}

export async function hubReport(options: Options): Promise<HubCommandReply> {
  if (options.args.length > 2) return result("USAGE", `Use !report IH_NUMBER GAME_ID.\n\n${REPORTER_REMINDER}`);
  const all = await sessionsFor(options);
  const sessions = options.args.length ? all : all.filter(session => ["ASSIGNED", "AWAITING_REVIEW"].includes(session.status));
  const session = pick(sessions, options.args[0]);
  if (!session) return { ...choose(sessions, "!report", options.args[0]), reply: `${choose(sessions, "!report", options.args[0]).reply}\n\n${REPORTER_REMINDER}` };
  if (session.status !== "ASSIGNED") return describe(session);
  const season = getRankedSeason();
  if (season && session.createdAt < season.startedAt) return result("ARCHIVED_SESSION", "This ready roster belongs to the previous ranked season. Ask an admin to cancel it and create a fresh !ready roster.");
  const existing = session.reportJobs[0];
  if (!options.args[1]) {
    if (existing && !["DESKTOP_CANCELLED", "DESKTOP_FAILED", "DESKTOP_EXPIRED"].includes(existing.status) && reportStage(existing.status, existing.rawMatchData).code !== "EXPIRED") return describe(session);
    return result("GAME_ID_REQUIRED", `Report ${session.gameLabel || "this inhouse"}\n\n${REPORTER_REMINDER}\n\nUse: !report ${inhouseNumber(session.gameLabel) || session.id} GAME_ID\nExample: !report ${inhouseNumber(session.gameLabel) || session.id} 11363615233\nNo !yes confirmation is needed.`);
  }
  if (!desktopEnabled()) return result("REPORTING_DISABLED", `Hub reporting is not enabled on the server yet. Ask an administrator to enable your reporter profile.\n\n${REPORTER_REMINDER}`);
  try {
    const job = await enqueueDesktopReport(session.id, options.userId, options.args[1], options.channelId, options.db ?? prisma);
    const updated = describe({ ...session, reportJobs: [job] });
    return { ...updated, reply: `${updated.reply}\nUse !status ${inhouseNumber(session.gameLabel) || session.id} to check progress.` };
  } catch (error) {
    if (error instanceof DesktopReportError) return result("REPORT_NOT_ACCEPTED", `${error.message}\nNo LP changed.\n\n${REPORTER_REMINDER}`);
    throw error;
  }
}

export async function hubCancelRequest(options: Options): Promise<HubCommandReply> {
  if (options.args.length > 1) return result("USAGE", "Use !no IH_NUMBER to cancel your unsubmitted request.");
  const all = await sessionsFor(options);
  const candidates = options.args.length ? all : all.filter(session => session.status === "ASSIGNED" && session.reportJobs.some(job => job.requestedByKookId === options.userId && ["DESKTOP_PENDING", "DESKTOP_COLLECTING"].includes(job.status)));
  const session = pick(candidates, options.args[0]);
  if (!session) return choose(candidates, "!no", options.args[0]);
  const db = options.db ?? prisma;
  const cancelled = await db.$transaction(async tx => {
    const locked = await tx.inhouseSession.updateMany({ where: { id: session.id, status: "ASSIGNED" }, data: { updatedAt: new Date() } });
    if (!locked.count) return { count: 0 };
    return tx.inhouseReportJob.updateMany({ where: { sessionId: session.id, requestedByKookId: options.userId, status: { in: ["DESKTOP_PENDING", "DESKTOP_COLLECTING"] } }, data: { status: "DESKTOP_CANCELLED", lockedAt: null, lockedBy: null } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return result(cancelled.count ? "REQUEST_CANCELLED" : "NOT_CANCELLABLE", cancelled.count ? `${session.gameLabel}: your unsubmitted request was cancelled. The ready roster is unchanged. Reports already received for review are retained.` : "No unsubmitted request belonging to you can be cancelled for this inhouse. Use !status to check its saved state.");
}

export async function hubCancelSession(options: Options): Promise<HubCommandReply> {
  if (!options.admin) return result("ADMIN_REQUIRED", "!cancel is restricted to administrators. Use !no IH_NUMBER to cancel your own unsubmitted collection request.");
  if (options.args.length !== 1) return result("USAGE", "Use !cancel IH_NUMBER. A specific inhouse number is required.");
  const sessions = await sessionsFor(options, true), session = pick(sessions, options.args[0]);
  if (!session) return choose(sessions, "!cancel", options.args[0]);
  if (session.status !== "ASSIGNED") return result("NOT_CANCELLABLE", `${session.gameLabel} is ${session.status}. Received uploads must be resolved in the administrator review queue.`);
  const cancelled = await (options.db ?? prisma).$transaction(async tx => {
    const locked = await tx.inhouseSession.updateMany({ where: { id: session.id, status: "ASSIGNED" }, data: { status: "CANCELLED" } });
    if (!locked.count) return false;
    await tx.inhouseReportJob.updateMany({ where: { sessionId: session.id, status: { in: ["DESKTOP_PENDING", "DESKTOP_COLLECTING"] } }, data: { status: "DESKTOP_CANCELLED", lockedAt: null, lockedBy: null } });
    await tx.inhouseReportJob.updateMany({ where: { sessionId: session.id, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "CANCELLED", lockedAt: null, lockedBy: null } });
    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return result(cancelled ? "SESSION_CANCELLED" : "SESSION_CHANGED", cancelled ? `${session.gameLabel} cancelled, including its unsubmitted collection jobs. Uploaded review records and old match history are retained.` : "The session changed while cancelling. Check !status before trying again.");
}
