import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { hubReport, hubStatus, hubCancelRequest, hubCancelSession } from "../lib/kook-hub-commands";
import { hubCommandHelp, hubSetupMessage } from "../lib/hub-bot-copy";
import { recordDesktopReview, authorizeDesktopReview } from "../lib/desktop-review";
import { prisma } from "../lib/prisma";

function store() {
  const sessions = [27, 28].map(number => ({ id: `session-${number}`, status: "ASSIGNED", gameLabel: `IH #0${number}`, createdAt: new Date(), lzyumiGameId: null, reportRawJson: { source: "desktop-session-v1" }, players: [{ kookUserId: "reporter", profileId: "profile", displayName: "Reporter" }] }));
  const jobs: Record<string, unknown>[] = [];
  const writes: { table: string; where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => typeof value === "object" && value !== null && "in" in value ? (value.in as unknown[]).includes(row[key]) : value === row[key]);
  const tx = {
    accountProfile: { findMany: async () => [{ id: "profile", kookId: "reporter", verificationStatus: "VERIFIED", accountStatus: "ACTIVE", chinaServerId: 1 }] },
    inhouseSession: {
      findMany: async () => sessions.map(session => ({ ...session, reportJobs: jobs.filter(job => job.sessionId === session.id).slice(-1) })),
      findFirst: async ({ where }: { where: { id: string } }) => sessions.find(session => session.id === where.id) || null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { const row = sessions.find(session => session.id === where.id)!; Object.assign(row, data); writes.push({ table: "session", where, data }); return row; },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => { const rows = sessions.filter(session => matches(session, where)); rows.forEach(row => Object.assign(row, data)); writes.push({ table: "session", where, data }); return { count: rows.length }; },
    },
    inhouseReportJob: {
      findFirst: async ({ where }: { where: { sessionId: string } }) => jobs.filter(job => job.sessionId === where.sessionId && !["DESKTOP_CANCELLED", "DESKTOP_EXPIRED", "DESKTOP_FAILED"].includes(String(job.status))).at(-1) || null,
      findUnique: async ({ where }: { where: { id: string } }) => jobs.find(job => job.id === where.id) || null,
      create: async ({ data }: { data: Record<string, unknown> }) => { const job = { ...data, id: `job-${jobs.length + 1}`, createdAt: new Date() }; jobs.push(job); return job; },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => { const rows = jobs.filter(job => matches(job, where)); rows.forEach(row => Object.assign(row, data)); writes.push({ table: "job", where, data }); return { count: rows.length }; },
    },
  };
  const db = { ...tx, $transaction: async (run: (value: typeof tx) => unknown) => run(tx) } as unknown as typeof prisma;
  return { db, sessions, jobs, writes };
}
const options = (db: typeof prisma, args: string[]) => ({ userId: "reporter", args, channelId: "channel", db });

test("help and setup use the KOOK installer and the short app flow without a player scoring confirmation", () => {
  const help = hubCommandHelp(); assert.match(help, /!hub/); assert.match(help, /!report IH GAME_ID/);
  assert.match(help, /No !yes confirmation/); assert.doesNotMatch(help, /ECL\.GG|forceready/);
  assert.match(hubSetupMessage(), /ECL HUB DESKTOP APP/); assert.match(hubSetupMessage(), /5590769063605712/);
});

test("report selection is exact and cannot silently select a different game", async () => {
  const { db } = store();
  assert.equal((await hubReport(options(db, []))).status, "CHOOSE_SESSION");
  assert.equal((await hubReport(options(db, ["1"]))).status, "CHOOSE_SESSION");
  const selected = await hubReport(options(db, ["28"]));
  assert.equal(selected.status, "GAME_ID_REQUIRED"); assert.match(selected.reply, /!report 28 GAME_ID/);
  assert.match(selected.reply, /KOOK account linked to your ECL Hub/);
});

test("an enabled assigned request is created for the reporter, status is truthful and retries do not duplicate it", async () => {
  const before = { ...process.env };
  try {
    process.env.ECL_DESKTOP_REPORTING_ENABLED = "1"; process.env.ECL_DESKTOP_REPORTER_PROFILE_IDS = "profile";
    const { db, jobs } = store();
    const request = await hubReport(options(db, ["28", "11363615233"]));
    assert.equal(request.status, "WAITING_FOR_HUB"); assert.equal(jobs.length, 1); assert.equal(jobs[0].sessionId, "session-28");
    assert.equal(jobs[0].requestedByKookId, "reporter"); assert.equal(request.request?.selector, "28");
    assert.doesNotMatch(request.reply, /Hub is connected/);
    await hubReport(options(db, ["28", "11363615233"])); assert.equal(jobs.length, 1);
    jobs[0].status = "DESKTOP_COLLECTING";
    assert.equal((await hubStatus(options(db, ["28"]))).status, "COLLECTING");
    jobs[0].status = "DESKTOP_REVIEW";
    assert.equal((await hubStatus(options(db, ["28"]))).status, "AWAITING_REVIEW");
  } finally { for (const key of ["ECL_DESKTOP_REPORTING_ENABLED", "ECL_DESKTOP_REPORTER_PROFILE_IDS"]) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; } }
});

test("a disabled pilot gives setup instructions instead of falling back to old automatic scoring", async () => {
  const before = process.env.ECL_DESKTOP_REPORTING_ENABLED; delete process.env.ECL_DESKTOP_REPORTING_ENABLED;
  try { const { db, jobs } = store(); assert.equal((await hubReport(options(db, ["28", "11363615233"]))).status, "REPORTING_DISABLED"); assert.equal(jobs.length, 0); }
  finally { if (before !== undefined) process.env.ECL_DESKTOP_REPORTING_ENABLED = before; }
});

test("player cancellation only cancels their specified unsubmitted request and retains the roster and received uploads", async () => {
  const { db, sessions, jobs } = store();
  jobs.push({ id: "one", sessionId: "session-27", requestedByKookId: "reporter", status: "DESKTOP_PENDING", createdAt: new Date() }, { id: "two", sessionId: "session-28", requestedByKookId: "reporter", status: "DESKTOP_PENDING", createdAt: new Date() });
  assert.equal((await hubCancelRequest(options(db, []))).status, "CHOOSE_SESSION");
  assert.equal((await hubCancelRequest(options(db, ["28"]))).status, "REQUEST_CANCELLED");
  assert.equal(jobs[0].status, "DESKTOP_PENDING"); assert.equal(jobs[1].status, "DESKTOP_CANCELLED");
  assert.equal(sessions[1].status, "ASSIGNED");
  jobs[1].status = "DESKTOP_REVIEW"; sessions[1].status = "AWAITING_REVIEW";
  assert.equal((await hubCancelRequest(options(db, ["28"]))).status, "NOT_CANCELLABLE"); assert.equal(jobs[1].status, "DESKTOP_REVIEW");
});

test("admin cancellation requires an exact selector and cancels only that session's jobs", async () => {
  const { db, sessions, jobs } = store(); jobs.push({ id: "one", sessionId: "session-27", status: "DESKTOP_PENDING" }, { id: "two", sessionId: "session-28", status: "DESKTOP_COLLECTING" });
  assert.equal((await hubCancelSession(options(db, ["28"]))).status, "ADMIN_REQUIRED");
  assert.equal((await hubCancelSession({ ...options(db, []), admin: true })).status, "USAGE");
  assert.equal((await hubCancelSession({ ...options(db, ["28"]), admin: true })).status, "SESSION_CANCELLED");
  assert.equal(sessions[0].status, "ASSIGNED"); assert.equal(sessions[1].status, "CANCELLED");
  assert.equal(jobs[0].status, "DESKTOP_PENDING"); assert.equal(jobs[1].status, "DESKTOP_CANCELLED");
});

test("review decisions are idempotent, audited and never touch a player, official result or LP table", async () => {
  const { db, sessions, jobs, writes } = store(); sessions[1].status = "AWAITING_REVIEW";
  jobs.push({ id: "review-1", sessionId: "session-28", status: "DESKTOP_REVIEW", completedAt: new Date(), rawMatchData: { source: "desktop-upload-v1", gameId: "11363615233", raw: { retained: true } } });
  const decision = await recordDesktopReview("review-1", "reviewed", "Checked all players", db);
  assert.equal(decision.lpApplied, false); assert.equal(sessions[1].status, "REVIEWED");
  assert.equal(jobs[0].status, "DESKTOP_REVIEWED"); assert.ok(writes.every(write => ["session", "job"].includes(write.table)));
  assert.equal((await recordDesktopReview("review-1", "reviewed", "", db)).duplicate, true);
  await assert.rejects(recordDesktopReview("review-1", "reject", "Wrong match", db), /no longer/);
});

test("review rejects missing reasons and unconfigured/unauthenticated administrators", async () => {
  const before = { ...process.env };
  try {
    delete process.env.ECL_DESKTOP_REPORTING_ENABLED; assert.throws(() => authorizeDesktopReview("anything"), /not configured/);
    process.env.ECL_DESKTOP_REPORTING_ENABLED = "1"; process.env.ADMIN_SESSION_SECRET = "synthetic-admin-session-secret-for-tests";
    assert.throws(() => authorizeDesktopReview("wrong"), /Admin access/); assert.doesNotThrow(() => authorizeDesktopReview(process.env.ADMIN_SESSION_SECRET));
    await assert.rejects(recordDesktopReview("review-1", "reject", "", store().db), /reason/);
  } finally { for (const key of ["ECL_DESKTOP_REPORTING_ENABLED", "ADMIN_SESSION_SECRET"]) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; } }
});

test("the !yes route returns review instructions without reading old confirmations or applying any result", async () => {
  const secret = process.env.ECL_KOOK_BOT_SECRET, read = prisma.inhouseSession.findMany;
  try {
    process.env.ECL_KOOK_BOT_SECRET = "synthetic-command-secret";
    Object.assign(prisma.inhouseSession, { findMany: async () => { throw new Error("Old confirmations must not be read"); } });
    const { POST } = await import("../app/api/kook/commands/route");
    const response = await POST(new Request("https://example.test/api/kook/commands", { method: "POST", headers: { "x-ecl-kook-secret": "synthetic-command-secret" }, body: JSON.stringify({ command: "!yes", kookUserId: "reporter" }) }));
    const body = await response.json(); assert.equal(body.status, "APP_REVIEW_REQUIRED"); assert.match(body.reply, /No automatic LP/);
  } finally { if (secret === undefined) delete process.env.ECL_KOOK_BOT_SECRET; else process.env.ECL_KOOK_BOT_SECRET = secret; Object.assign(prisma.inhouseSession, { findMany: read }); }
});

test("a Hub roster cannot be scored by the old endpoint, even through an admin override", async () => {
  const secret = process.env.ECL_KOOK_BOT_SECRET, read = prisma.inhouseSession.findFirst;
  try {
    process.env.ECL_KOOK_BOT_SECRET = "synthetic-command-secret";
    Object.assign(prisma.inhouseSession, { findFirst: async (args: { where: { status: string } }) => args.where.status === "COMPLETED" ? null : { id: "session", reportRawJson: { source: "desktop-session-v1" }, players: [] } });
    const { POST } = await import("../app/api/kook/inhouse/report/route");
    const response = await POST(new NextRequest("https://example.test/api/kook/inhouse/report", { method: "POST", headers: { "x-ecl-kook-secret": "synthetic-command-secret" }, body: JSON.stringify({ sessionId: "session", adminOverride: true }) }));
    assert.equal(response.status, 409); assert.equal((await response.json()).status, "DESKTOP_REVIEW_REQUIRED");
  } finally { if (secret === undefined) delete process.env.ECL_KOOK_BOT_SECRET; else process.env.ECL_KOOK_BOT_SECRET = secret; Object.assign(prisma.inhouseSession, { findFirst: read }); }
});

test("inhouse responses name the pinned installer channel and admin ready cannot bypass missing verification", async () => {
  const secret = process.env.ECL_KOOK_BOT_SECRET, read = prisma.inhouseSession.findFirst, profiles = prisma.accountProfile.findMany;
  try {
    process.env.ECL_KOOK_BOT_SECRET = "synthetic-command-secret";
    Object.assign(prisma.inhouseSession, { findFirst: async () => null }); Object.assign(prisma.accountProfile, { findMany: async () => [] });
    const { POST } = await import("../app/api/kook/inhouse/route");
    const { RANKED_INHOUSE_CHANNEL_ID } = await import("../lib/kook-inhouse");
    const request = (count: number, command: string) => new Request("https://example.test/api/kook/inhouse", { method: "POST", headers: { "x-ecl-kook-secret": "synthetic-command-secret" }, body: JSON.stringify({ command, channelId: RANKED_INHOUSE_CHANNEL_ID, isAdmin: true, members: Array.from({ length: count }, (_, i) => ({ id: `member-${i}` })) }) });
    const waiting = await (await POST(request(8, "!inhouse"))).json(); assert.equal(waiting.status, "WAITING"); assert.match(waiting.reply, /5590769063605712/);
    const blocked = await (await POST(request(10, "!ready"))).json(); assert.equal(blocked.status, "UNVERIFIED_PLAYERS"); assert.match(blocked.reply, /All ten players need verified Ionia/);
  } finally { if (secret === undefined) delete process.env.ECL_KOOK_BOT_SECRET; else process.env.ECL_KOOK_BOT_SECRET = secret; Object.assign(prisma.inhouseSession, { findFirst: read }); Object.assign(prisma.accountProfile, { findMany: profiles }); }
});

test("review API requires admin authorization and same-origin decisions before any database access", async () => {
  const before = { ...process.env }, read = prisma.inhouseReportJob.findMany;
  try {
    process.env.ECL_DESKTOP_REPORTING_ENABLED = "1"; process.env.ADMIN_SESSION_SECRET = "synthetic-admin-session-secret-for-tests";
    Object.assign(prisma.inhouseReportJob, { findMany: async () => { throw new Error("Unexpected database access"); } });
    const { POST, GET } = await import("../app/api/admin/desktop-reports/route");
    const request = (body: string, origin?: string, cookie = true) => new NextRequest("https://example.test/api/admin/desktop-reports", { method: "POST", headers: { ...(cookie ? { cookie: `ecl_admin_session=${process.env.ADMIN_SESSION_SECRET}` } : {}), ...(origin ? { origin } : {}) }, body });
    assert.equal((await POST(request("{}", "https://example.test", false))).status, 401);
    assert.equal((await POST(request("{}", "https://another.test"))).status, 403);
    assert.equal((await POST(request("null", "https://example.test"))).status, 400);
    assert.equal((await POST(request("x".repeat(2050), "https://example.test"))).status, 413);
    assert.equal((await POST(request(JSON.stringify({ jobId: "review-1", decision: "reject", reason: "" }), "https://example.test"))).status, 400);
    assert.equal((await GET(new NextRequest("https://example.test/api/admin/desktop-reports?jobId=../private", { headers: { cookie: `ecl_admin_session=${process.env.ADMIN_SESSION_SECRET}` } }))).status, 400);
  } finally { for (const key of ["ECL_DESKTOP_REPORTING_ENABLED", "ADMIN_SESSION_SECRET"]) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; } Object.assign(prisma.inhouseReportJob, { findMany: read }); }
});
