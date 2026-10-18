import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { refreshStatsOnOpen } from "../lib/account-stats-on-open";
import { purgeExpiredDesktopReports, RAW_MATCH_RETENTION_MS } from "../lib/desktop-retention";
import { desktopUpdateTarget } from "../lib/desktop-update-host";

const now = new Date("2026-10-17T12:00:00Z");
function profileStore(fresh = false) {
  let held = false;
  const writes: unknown[] = [];
  const store = {
    accountProfile: { findUnique: async ({ where }: { where: { userId: string } }) => {
      assert.equal(where.userId, "signed-in-user");
      return { id: "own-profile", riotName: "Player", chinaServerId: 1, accountStatus: "ACTIVE", lzyumiLastLookupAt: fresh ? now : null };
    } },
    lzyumiRefreshQueue: {
      upsert: async () => ({}),
      updateMany: async (args: { data: { status: string }; where: unknown }) => {
        writes.push(args);
        if (args.data.status === "PROCESSING") { if (held) return { count: 0 }; held = true; }
        return { count: 1 };
      },
    },
  };
  return { db: store as unknown as PrismaClient, writes };
}
test("fresh account snapshot skips provider and queue writes", async () => {
  const { db, writes } = profileStore(true);
  const result = await refreshStatsOnOpen("signed-in-user", true, db, async () => { throw new Error("must not refresh"); }, now);
  assert.equal(result.status, "fresh"); assert.equal(writes.length, 0);
});
test("concurrent app refresh requests share an atomic per-profile lease", async () => {
  const { db, writes } = profileStore(); let calls = 0;
  const results = await Promise.all([1, 2].map(() => refreshStatsOnOpen("signed-in-user", true, db, async () => { calls++; return { ok: true }; }, now)));
  assert.equal(calls, 1); assert.deepEqual(results.map(r => r.status).sort(), ["cooldown", "updated"]);
  assert.ok(JSON.stringify(writes).includes("lastAttemptAt"));
});
test("provider failures keep saved stats and set a retry cooldown without exposing upstream secrets", async () => {
  const { db, writes } = profileStore();
  const result = await refreshStatsOnOpen("signed-in-user", true, db, async () => { throw new Error("private-provider-token"); }, now);
  assert.equal(result.ok, false); assert.equal(result.status, "unavailable");
  assert.ok(JSON.stringify(writes).includes("FAILED")); assert.ok(!JSON.stringify([writes, result]).includes("private-provider"));
});
test("retention only targets expired desktop uploads, removes raw and summary, preserves dedupe identifiers", async () => {
  let query: unknown;
  const updates: Array<{ where: unknown; data: { rawMatchData: Record<string, unknown>; status?: string } }> = [];
  const db = { inhouseReportJob: {
    findMany: async (args: unknown) => { query = args; return [{ id: "old", status: "DESKTOP_REVIEW", completedAt: new Date(now.getTime() - RAW_MATCH_RETENTION_MS), rawMatchData: { source: "desktop-upload-v1", gameId: "123456789", platformId: "HN1", ownerProfileId: "own-profile", raw: { secret: "private-puuid" }, summary: { players: ["private-name"] } } }]; },
    updateMany: async (args: typeof updates[number]) => { updates.push(args); return { count: 1 }; },
  } } as unknown as PrismaClient;
  const result = await purgeExpiredDesktopReports(db, now);
  assert.equal(result.deleted, 1); assert.ok(JSON.stringify(query).includes("desktop-upload-v1"));
  assert.equal(updates[0].data.status, "DESKTOP_REVIEW_EXPIRED");
  assert.equal(updates[0].data.rawMatchData.gameId, "123456789");
  assert.ok(!JSON.stringify(updates).includes("private-"));
  assert.equal(updates[0].data.rawMatchData.raw, undefined); assert.equal(updates[0].data.rawMatchData.summary, undefined);
});
test("website update downloads are restricted to the configured public Vercel Blob prefix", () => {
  const base = "https://example.public.blob.vercel-storage.com/ecl/windows/";
  assert.equal(desktopUpdateTarget("latest.yml", base), `${base}latest.yml`);
  assert.equal(desktopUpdateTarget("ECL-Hub-Setup-1.2.3.exe", base), `${base}ECL-Hub-Setup-1.2.3.exe`);
  assert.ok(desktopUpdateTarget("ECL-Hub-Setup-1.2.3.exe.blockmap", base));
  assert.ok(desktopUpdateTarget("ECL-Hub-Release-1.2.3.json", base));
  const eclStore = "https://wjeuparxlihzvwlv.public.blob.vercel-storage.com/ecl/windows/";
  assert.equal(desktopUpdateTarget("latest.yml", eclStore), `${eclStore}latest.yml`);
  for (const file of ["../latest.yml", "latest.yml?token=secret", "https://evil.example/file.exe", "other.exe"]) assert.equal(desktopUpdateTarget(file, base), null);
  for (const host of [undefined, "https://evil.example/", "http://example.public.blob.vercel-storage.com/", `${base}?token=secret`, "https://name:secret@example.public.blob.vercel-storage.com/"]) assert.equal(desktopUpdateTarget("latest.yml", host), null);
});
test("cleanup and update endpoints fail closed before server configuration", async () => {
  const env = { ...process.env };
  try {
    delete process.env.ECL_DESKTOP_RETENTION_ENABLED; delete process.env.CRON_SECRET; delete process.env.ECL_DESKTOP_UPDATE_BLOB_BASE;
    const cleanup = await import("../app/api/jobs/desktop-retention/route");
    assert.equal((await cleanup.GET(new Request("https://eclchina.lol/api/jobs/desktop-retention"))).status, 503);
    process.env.ECL_DESKTOP_RETENTION_ENABLED = "1"; process.env.CRON_SECRET = "x".repeat(32);
    assert.equal((await cleanup.GET(new Request("https://eclchina.lol/api/jobs/desktop-retention"))).status, 401);
    const update = await import("../app/desktop-updates/windows/[file]/route");
    assert.equal((await update.GET(new Request("https://eclchina.lol/desktop-updates/windows/latest.yml"), { params: Promise.resolve({ file: "latest.yml" }) })).status, 404);
    process.env.ECL_DESKTOP_UPDATE_BLOB_BASE = "https://example.public.blob.vercel-storage.com/ecl/windows/";
    const response = await update.GET(new Request("https://eclchina.lol/desktop-updates/windows/ECL-Hub-Setup-1.2.3.exe", { headers: { range: "bytes=0-99" } }), { params: Promise.resolve({ file: "ECL-Hub-Setup-1.2.3.exe" }) });
    assert.equal(response.status, 307); assert.equal(response.headers.get("cache-control"), "no-store"); assert.ok(response.headers.get("location")?.endsWith("/ECL-Hub-Setup-1.2.3.exe"));
  } finally { for (const key of ["ECL_DESKTOP_RETENTION_ENABLED", "CRON_SECRET", "ECL_DESKTOP_UPDATE_BLOB_BASE"]) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; } }
});
