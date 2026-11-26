import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeChinaStatsLadderSnapshot,
  validateChinaStatsLadderSnapshot,
  type ChinaStatsLadderSnapshot,
} from "../lib/china-stats-ladder";
import {
  classifyChinaStatsLadderStoreCause,
  chinaStatsCollectorAuthorized,
  chinaStatsCollectorConfigured,
  chinaStatsLadderContentHash,
  storeChinaStatsLadderSnapshot,
  type ChinaStatsLadderDatabase,
} from "../lib/china-stats-ladder-ingest";
import { POST as ingestSnapshot } from "../app/api/jobs/china-stats-ladder/route";

function source(platform = "HN1") {
  return {
    connected: true,
    platform,
    capturedAt: new Date(Date.now() - 60_000).toISOString(),
    results: [
      group("CHALLENGER", 200, 1, "Alpha#CN1"),
      group("GRANDMASTER", 500, 201, "Bravo#CN1"),
      group("MASTER", 10_000, 701, "Charlie#CN1"),
    ],
  };
}

function group(tier: string, rowCount: number, rank: number, riotId: string) {
  return {
    ok: true,
    queue: "RANKED_SOLO_5x5",
    tier,
    rowCount,
    rows: [{
      rank,
      riotId,
      tier,
      leaguePoints: 1800,
      wins: 100,
      losses: 70,
      profileIconId: 29,
      puuid: "must-not-leak",
      summonerId: 123456,
    }],
  };
}

test("normalizes an Ionia apex snapshot into the public projection", () => {
  const snapshot = normalizeChinaStatsLadderSnapshot(source());

  assert.ok(snapshot);
  assert.equal(snapshot.server, "ionia");
  assert.equal(snapshot.platformId, "HN1");
  assert.deepEqual(snapshot.coverage.map((item) => item.totalAvailable), [200, 500, 10_000]);
  assert.deepEqual(snapshot.rows.map((row) => row.riotId), ["Alpha#CN1", "Bravo#CN1", "Charlie#CN1"]);
  assert.equal("puuid" in snapshot.rows[0], false);
  assert.equal("summonerId" in snapshot.rows[0], false);
});

test("maps BGP2 to Super Server and rejects unknown or incomplete sources", () => {
  assert.equal(normalizeChinaStatsLadderSnapshot(source("BGP2"))?.server, "super-server");
  assert.equal(normalizeChinaStatsLadderSnapshot(source("UNKNOWN")), null);

  const incomplete = source();
  incomplete.results = incomplete.results.slice(0, 2);
  assert.equal(normalizeChinaStatsLadderSnapshot(incomplete), null);

  const stale = source();
  stale.capturedAt = new Date(Date.now() - 25 * 60 * 60_000).toISOString();
  assert.equal(normalizeChinaStatsLadderSnapshot(stale), null);
});

test("validates the durable public projection without accepting identity drift", () => {
  const snapshot = normalizeChinaStatsLadderSnapshot(source());
  assert.ok(snapshot);
  assert.deepEqual(validateChinaStatsLadderSnapshot(snapshot), snapshot);
  assert.equal(validateChinaStatsLadderSnapshot({ ...snapshot, platformId: "BGP2" }), null);
  assert.equal(validateChinaStatsLadderSnapshot({
    ...snapshot,
    rows: snapshot.rows.map((row, index) => index === 0 ? { ...row, riotId: snapshot.rows[1].riotId } : row),
  }), null);
});

test("collector authentication fails closed and uses a dedicated exact secret", () => {
  const secret = "s".repeat(32);
  const configured = { CHINA_STATS_LADDER_INGEST_ENABLED: "true", CHINA_STATS_COLLECTOR_SECRET: secret };
  assert.equal(chinaStatsCollectorConfigured({}), false);
  assert.equal(chinaStatsCollectorConfigured({ ...configured, CHINA_STATS_LADDER_INGEST_ENABLED: "false" }), false);
  assert.equal(chinaStatsCollectorAuthorized(new Request("https://ecl.example/api", { headers: { "x-ecl-china-stats-secret": secret } }), configured), true);
  assert.equal(chinaStatsCollectorAuthorized(new Request("https://ecl.example/api", { headers: { "x-ecl-china-stats-secret": `${secret}x` } }), configured), false);
});

test("collector route rejects disabled, unauthorized, and malformed uploads before database access", async () => {
  const savedEnabled = process.env.CHINA_STATS_LADDER_INGEST_ENABLED;
  const savedSecret = process.env.CHINA_STATS_COLLECTOR_SECRET;
  const secret = "r".repeat(32);
  try {
    delete process.env.CHINA_STATS_LADDER_INGEST_ENABLED;
    delete process.env.CHINA_STATS_COLLECTOR_SECRET;
    assert.equal((await ingestSnapshot(new Request("https://ecl.example/api", { method: "POST" }))).status, 503);

    process.env.CHINA_STATS_LADDER_INGEST_ENABLED = "true";
    process.env.CHINA_STATS_COLLECTOR_SECRET = secret;
    assert.equal((await ingestSnapshot(new Request("https://ecl.example/api", { method: "POST" }))).status, 401);
    assert.equal((await ingestSnapshot(new Request("https://ecl.example/api", {
      method: "POST",
      headers: { "x-ecl-china-stats-secret": secret },
    }))).status, 415);
    assert.equal((await ingestSnapshot(new Request("https://ecl.example/api", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ecl-china-stats-secret": secret },
      body: "not-json",
    }))).status, 400);
    assert.equal((await ingestSnapshot(new Request("https://ecl.example/api", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ecl-china-stats-secret": secret },
      body: "{}",
    }))).status, 422);
  } finally {
    if (savedEnabled === undefined) delete process.env.CHINA_STATS_LADDER_INGEST_ENABLED;
    else process.env.CHINA_STATS_LADDER_INGEST_ENABLED = savedEnabled;
    if (savedSecret === undefined) delete process.env.CHINA_STATS_COLLECTOR_SECRET;
    else process.env.CHINA_STATS_COLLECTOR_SECRET = savedSecret;
  }
});

function fakeDatabase(initial: { capturedAt: Date; contentHash: string } | null = null) {
  let current = initial;
  const events: string[] = [];
  const database = {
    async $transaction<T>(operation: (transaction: never) => Promise<T>) {
      return operation({
        async $executeRaw() {
          events.push("lock");
          return 1;
        },
        chinaStatsLadderSnapshot: {
          async findUnique() {
            events.push("read");
            return current;
          },
          async create(args: { data: { capturedAt: Date; contentHash: string } }) {
            events.push("create");
            current = { capturedAt: args.data.capturedAt, contentHash: args.data.contentHash };
          },
          async update(args: { data: { capturedAt: Date; contentHash: string } }) {
            events.push("update");
            current = { capturedAt: args.data.capturedAt, contentHash: args.data.contentHash };
          },
        },
      } as never);
    },
  } as ChinaStatsLadderDatabase;
  return { database, events, current: () => current };
}

test("durable ladder writes lock by server and reject rollback, replay drift, and duplicate work", async () => {
  const snapshot = normalizeChinaStatsLadderSnapshot(source());
  assert.ok(snapshot);
  const fake = fakeDatabase();

  assert.equal((await storeChinaStatsLadderSnapshot(fake.database, snapshot)).status, "created");
  assert.deepEqual(fake.events.slice(0, 3), ["lock", "read", "create"]);
  assert.equal((await storeChinaStatsLadderSnapshot(fake.database, snapshot)).status, "duplicate");

  const conflict: ChinaStatsLadderSnapshot = {
    ...snapshot,
    rows: snapshot.rows.map((row, index) => index === 0 ? { ...row, wins: row.wins + 1 } : row),
  };
  assert.equal((await storeChinaStatsLadderSnapshot(fake.database, conflict)).status, "conflict");

  const older = { ...snapshot, capturedAt: new Date(Date.parse(snapshot.capturedAt) - 60_000).toISOString() };
  assert.equal((await storeChinaStatsLadderSnapshot(fake.database, older)).status, "stale");

  const newer = { ...snapshot, capturedAt: new Date(Date.parse(snapshot.capturedAt) + 60_000).toISOString() };
  assert.equal((await storeChinaStatsLadderSnapshot(fake.database, newer)).status, "replaced");
  assert.equal(fake.current()?.contentHash, chinaStatsLadderContentHash(newer));
});

test("durable ladder write failures expose only their bounded store stage", async () => {
  const snapshot = normalizeChinaStatsLadderSnapshot(source());
  assert.ok(snapshot);
  const database = {
    async $transaction<T>(operation: (transaction: never) => Promise<T>) {
      return operation({
        async $executeRaw() {
          throw new Error("credential-like diagnostic details must not escape");
        },
      } as never);
    },
  } as ChinaStatsLadderDatabase;

  await assert.rejects(
    storeChinaStatsLadderSnapshot(database, snapshot),
    (error: Error & { storeStage?: string; causeCategory?: string }) => {
      assert.equal(error.storeStage, "ADVISORY_LOCK");
      assert.equal(error.causeCategory, "UNKNOWN");
      assert.equal(error.message, "China stats ladder persistence failed.");
      assert.doesNotMatch(error.message, /credential/i);
      return true;
    },
  );
});

test("database failures are reduced to bounded categories without exposing messages", () => {
  assert.equal(classifyChinaStatsLadderStoreCause(Object.assign(new Error("password authentication failed for private user"), { errorCode: "P1000" })), "AUTHENTICATION");
  assert.equal(classifyChinaStatsLadderStoreCause(new Error("FATAL: Tenant or user not found")), "POOLER_IDENTITY");
  assert.equal(classifyChinaStatsLadderStoreCause(Object.assign(new Error("private host must not escape"), { errorCode: "P1001" })), "UNREACHABLE");
  assert.equal(classifyChinaStatsLadderStoreCause(new Error("invalid database URL containing private input")), "INVALID_CONFIGURATION");
  assert.equal(classifyChinaStatsLadderStoreCause(Object.assign(new Error("private permission detail"), { code: "P1010" })), "PERMISSION");
  assert.equal(classifyChinaStatsLadderStoreCause(new Error("credential-like diagnostic details must not escape")), "UNKNOWN");
});

test("leaderboard route preserves account authorization and private identifiers", async () => {
  const [route, ingestRoute, migration] = await Promise.all([
    readFile(new URL("../app/api/china-stats/leaderboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/jobs/china-stats-ladder/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20261126030000_add_china_stats_ladder_snapshots/migration.sql", import.meta.url), "utf8"),
  ]);

  assert.match(route, /getAccountFromRequest/);
  assert.match(route, /hasChinaStatsPreviewAccess/);
  assert.match(route, /status: 403/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.doesNotMatch(route, /puuid/i);
  assert.doesNotMatch(route, /summonerId/i);
  assert.match(ingestRoute, /chinaStatsCollectorAuthorized/);
  assert.match(ingestRoute, /MAX_BODY_BYTES/);
  assert.match(ingestRoute, /status === "stale"/);
  assert.doesNotMatch(ingestRoute, /ECL_JOB_SECRET|ECL_KOOK_BOT_SECRET|ECL_REPORT_ENGINE_SECRET/);
  assert.match(migration, /REVOKE ALL PRIVILEGES[\s\S]*PUBLIC, anon, authenticated/);
  assert.match(migration, /CHECK \(server IN \('ionia', 'super-server'\)\)/);
});
