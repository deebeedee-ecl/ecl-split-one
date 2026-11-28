import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  consumeLzyumiRefreshPermit,
  hashLzyumiRefreshPermitToken,
  issueLzyumiRefreshPermit,
  LzyumiRefreshPermitConfigurationError,
  orderedLzyumiRefreshPermitLockKeys,
  readLzyumiRefreshPermitPolicy,
} from "../lib/lzyumi-refresh-permit-runtime";
import type { LzyumiRefreshPermitPolicy } from "../lib/lzyumi-refresh-permit";

const minute = 60_000;
const requesterId = "00000000-0000-4000-8000-000000000001";
const targetId = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-11-17T00:00:00.000Z");
const policy: LzyumiRefreshPermitPolicy = {
  permitTtlMs: 2 * minute,
  profileCooldownMs: 5 * minute,
  requesterCooldownMs: minute,
  requesterWindowMs: 24 * 60 * minute,
  requesterMaxPermitsPerWindow: 20,
};

type FakePermit = {
  id: string;
  tokenHash: string;
  requesterProfileId: string;
  targetProfileId: string;
  status: "ISSUED" | "COMPLETED" | "REJECTED" | "EXPIRED";
  issuedAt: Date;
  expiresAt: Date;
  terminalCode: string | null;
};

type SqlLike = {
  strings?: readonly string[];
  values?: unknown[];
} | readonly string[];

function sqlText(query: SqlLike) {
  if (Array.isArray(query)) return (query as readonly string[]).join("?");
  return (query as { strings?: readonly string[] }).strings?.join("?") ?? "";
}

class TransactionFaithfulFakeDatabase {
  permits: FakePermit[] = [];
  target = {
    id: targetId,
    userId: "synthetic-target-user",
    riotName: "ContractTester",
    riotTag: "T100",
    chinaServerId: 1,
    chinaServerName: "synthetic-server",
    openId: "synthetic-open-id",
    verificationStatus: "VERIFIED",
    accountStatus: "ACTIVE",
    lzyumiLastLookupAt: null as Date | null,
    lzyumiVerifiedAt: null as Date | null,
    lzyumiRawProfile: null as unknown,
    lzyumiRecentStat: null as unknown,
    lzyumiRankedGames: null as unknown,
    currentRank: null as string | null,
  };
  private transactionTail: Promise<void> = Promise.resolve();

  accountProfile = {
    findUnique: async ({ where }: { where: { userId?: string; id?: string } }) => {
      if (where.userId === "synthetic-requester-user") return { id: requesterId };
      if (where.userId === "synthetic-owner-user") return { id: targetId };
      if (where.id === requesterId) return { id: requesterId };
      if (where.id === targetId) return { ...this.target };
      return null;
    },
  };

  $transaction = async <T>(operation: (transaction: unknown) => Promise<T>) => {
    const previous = this.transactionTail;
    let release!: () => void;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation(this.transaction());
    } finally {
      release();
    }
  };

  private transaction() {
    return {
      accountProfile: {
        findUnique: this.accountProfile.findUnique,
        updateMany: async ({ where, data }: {
          where: { id: string; lzyumiLastLookupAt: Date | null };
          data: Record<string, unknown>;
        }) => {
          if (
            where.id !== targetId ||
            where.lzyumiLastLookupAt?.getTime() !== this.target.lzyumiLastLookupAt?.getTime()
          ) return { count: 0 };
          Object.assign(this.target, data);
          return { count: 1 };
        },
      },
      $queryRaw: async (query: { strings?: readonly string[]; values?: unknown[] }) => {
        const text = sqlText(query);
        const values = query.values ?? [];
        if (text.includes("ORDER BY issued_at DESC")) {
          const targetProfileId = String(values[0]);
          const latest = this.permits
            .filter((permit) => permit.targetProfileId === targetProfileId)
            .sort((left, right) => right.issuedAt.getTime() - left.issuedAt.getTime())[0];
          return latest ? [{ issuedAt: latest.issuedAt }] : [];
        }
        if (text.includes("COUNT(*)::bigint")) {
          const profileId = String(values[0]);
          const windowStart = values[1] as Date;
          const rows = this.permits.filter((permit) =>
            permit.requesterProfileId === profileId && permit.issuedAt >= windowStart
          );
          return [{
            count: BigInt(rows.length),
            oldest: rows.length
              ? new Date(Math.min(...rows.map((permit) => permit.issuedAt.getTime())))
              : null,
            latest: rows.length
              ? new Date(Math.max(...rows.map((permit) => permit.issuedAt.getTime())))
              : null,
          }];
        }
        if (text.includes("WHERE token_hash")) {
          const permit = this.permits.find((entry) => entry.tokenHash === values[0]);
          return permit ? [{
            id: permit.id,
            tokenHash: permit.tokenHash,
            requesterProfileId: permit.requesterProfileId,
            targetProfileId: permit.targetProfileId,
            status: permit.status,
            expiresAt: permit.expiresAt,
          }] : [];
        }
        if (text.includes('FROM public."AccountProfile"')) {
          return values[0] === targetId ? [{ id: targetId }] : [];
        }
        throw new Error(`Unhandled fake query: ${text}`);
      },
      $executeRaw: async (
        query: SqlLike,
        ...tagValues: unknown[]
      ) => {
        const text = sqlText(query);
        const values: unknown[] = Array.isArray(query)
          ? tagValues
          : (query as { values?: unknown[] }).values ?? [];
        if (text.includes("pg_advisory_xact_lock")) return 1;
        if (text.includes("INSERT INTO public.lzyumi_refresh_permits")) {
          this.permits.push({
            id: String(values[0]),
            tokenHash: String(values[1]),
            requesterProfileId: String(values[2]),
            targetProfileId: String(values[3]),
            status: "ISSUED",
            issuedAt: values[4] as Date,
            expiresAt: values[5] as Date,
            terminalCode: null,
          });
          return 1;
        }
        if (text.includes("UPDATE public.lzyumi_refresh_permits")) {
          const permit = this.permits.find((entry) => values.includes(entry.id));
          if (!permit || permit.status !== "ISSUED") return 0;
          if (text.includes("'COMPLETED'")) {
            permit.status = "COMPLETED";
            permit.terminalCode = "SNAPSHOT_REPLACED";
          } else if (text.includes("'REJECTED'")) {
            permit.status = "REJECTED";
            permit.terminalCode = String(values[0]);
          } else if (text.includes("'EXPIRED'")) {
            permit.status = "EXPIRED";
            permit.terminalCode = "PERMIT_EXPIRED";
          }
          return 1;
        }
        throw new Error(`Unhandled fake execute: ${text}`);
      },
    };
  }
}

test("manual permit rollout configuration fails closed and rejects incoherent limits", () => {
  assert.throws(
    () => readLzyumiRefreshPermitPolicy({}),
    LzyumiRefreshPermitConfigurationError,
  );
  assert.deepEqual(readLzyumiRefreshPermitPolicy({
    LZYUMI_MANUAL_REFRESH_PERMITS_ENABLED: "true",
    LZYUMI_MANUAL_REFRESH_PERMIT_TTL_MS: String(policy.permitTtlMs),
    LZYUMI_MANUAL_REFRESH_PROFILE_COOLDOWN_MS: String(policy.profileCooldownMs),
    LZYUMI_MANUAL_REFRESH_REQUESTER_COOLDOWN_MS: String(policy.requesterCooldownMs),
    LZYUMI_MANUAL_REFRESH_REQUESTER_WINDOW_MS: String(policy.requesterWindowMs),
    LZYUMI_MANUAL_REFRESH_REQUESTER_MAX_PERMITS: String(
      policy.requesterMaxPermitsPerWindow,
    ),
  }), policy);
  assert.throws(
    () => readLzyumiRefreshPermitPolicy({
      LZYUMI_MANUAL_REFRESH_PERMITS_ENABLED: "true",
      LZYUMI_MANUAL_REFRESH_PERMIT_TTL_MS: "60000",
      LZYUMI_MANUAL_REFRESH_PROFILE_COOLDOWN_MS: "30000",
      LZYUMI_MANUAL_REFRESH_REQUESTER_COOLDOWN_MS: "10000",
      LZYUMI_MANUAL_REFRESH_REQUESTER_WINDOW_MS: "60000",
      LZYUMI_MANUAL_REFRESH_REQUESTER_MAX_PERMITS: "5",
    }),
    LzyumiRefreshPermitConfigurationError,
  );
});

test("lock scopes have a deterministic order for requester/target concurrency", () => {
  assert.deepEqual(
    orderedLzyumiRefreshPermitLockKeys("requester", "target"),
    [
      "lzyumi-refresh-permit:requester:requester",
      "lzyumi-refresh-permit:target:target",
    ],
  );
});

test("simultaneous issuance for one target creates one permit and one cooldown rejection", async () => {
  const database = new TransactionFaithfulFakeDatabase();
  const input = {
    requesterUserId: "synthetic-owner-user",
    targetProfileId: targetId,
    policy,
    now,
    database: database as never,
  };

  const results = await Promise.all([
    issueLzyumiRefreshPermit(input),
    issueLzyumiRefreshPermit(input),
  ]);

  assert.equal(results.filter((result) => result.status === "issued").length, 1);
  assert.deepEqual(
    results.filter((result) => result.status === "rejected").map((result) => result.code),
    ["PROFILE_COOLDOWN"],
  );
  assert.equal(database.permits.length, 1);

  const issued = results.find((result) => result.status === "issued");
  assert.ok(issued && issued.status === "issued");
  if (!issued || issued.status !== "issued") return;
  assert.deepEqual(
    issued.requests.identityAttempts.map((attempt) => attempt.kind),
    [
      "bare-name",
      "full-id",
      "bare-name-with-open-id",
      "full-id-with-open-id",
      "open-id-only",
    ],
  );
  const identityQueries = issued.requests.identityAttempts.map((attempt) =>
    new URL(attempt.url).searchParams
  );
  assert.deepEqual(
    identityQueries.map((query) => query.get("nickname")),
    [
      "ContractTester",
      "ContractTester*~*~*T100",
      "ContractTester",
      "ContractTester*~*~*T100",
      "",
    ],
  );
  assert.deepEqual(
    identityQueries.map((query) => query.get("openId")),
    ["", "", "synthetic-open-id", "synthetic-open-id", "synthetic-open-id"],
  );
  assert.equal(
    new URL(issued.requests.solo).searchParams.get("openId"),
    "synthetic-open-id",
  );
  assert.equal(
    new URL(issued.requests.flex).searchParams.get("openId"),
    "synthetic-open-id",
  );
});

test("simultaneous consumption commits once and rejects replay", async () => {
  const database = new TransactionFaithfulFakeDatabase();
  const staleRecent = { marker: "stale-recent" };
  database.target.lzyumiRecentStat = staleRecent;
  const issued = await issueLzyumiRefreshPermit({
    requesterUserId: "synthetic-owner-user",
    targetProfileId: targetId,
    policy,
    now,
    database: database as never,
  });
  assert.equal(issued.status, "issued");
  if (issued.status !== "issued") return;

  const consume = () => consumeLzyumiRefreshPermit({
    requesterUserId: "synthetic-owner-user",
    targetProfileId: targetId,
    permitToken: issued.permitToken,
    now: new Date(now.getTime() + 30_000),
    database: database as never,
    snapshot: {
      profileResponse: {
        code: 1,
        battleInfo: {
          nameInfoNew: "ContractTester#T100",
          openId: "synthetic-open-id",
          areaId: 1,
          mapOneInfoList: [],
        },
        data: [],
      },
      soloResponse: { code: 1, data: [] },
      flexResponse: { code: 1, data: [] },
      recentStat: { status: "unavailable", reason: "throttled" },
    },
  });

  const results = await Promise.all([consume(), consume()]);
  assert.equal(results.filter((result) => result.status === "completed").length, 1);
  assert.deepEqual(
    results.filter((result) => result.status === "rejected").map((result) => result.code),
    ["PERMIT_ALREADY_USED"],
  );
  assert.equal(database.permits[0].status, "COMPLETED");
  const completed = results.find((result) => result.status === "completed");
  assert.equal(completed?.recentStatStatus, "unavailable");
  assert.notEqual(database.target.lzyumiRecentStat, staleRecent);
});

test("provider failure rejects the permit without replacing snapshot or freshness", async () => {
  const database = new TransactionFaithfulFakeDatabase();
  const previousSnapshot = { marker: "previous-coherent-snapshot" };
  const previousTimestamp = new Date(now.getTime() - 13 * 60 * minute);
  database.target.lzyumiRawProfile = previousSnapshot;
  database.target.lzyumiRankedGames = {
    _eclSnapshotVersion: 2,
    soloGames: [],
    flexGames: [],
  };
  database.target.lzyumiLastLookupAt = previousTimestamp;

  const issued = await issueLzyumiRefreshPermit({
    requesterUserId: "synthetic-owner-user",
    targetProfileId: targetId,
    policy,
    now,
    database: database as never,
  });
  assert.equal(issued.status, "issued");
  if (issued.status !== "issued") return;

  const result = await consumeLzyumiRefreshPermit({
    requesterUserId: "synthetic-owner-user",
    targetProfileId: targetId,
    permitToken: issued.permitToken,
    now: new Date(now.getTime() + 30_000),
    database: database as never,
    snapshot: {
      profileResponse: { code: 7, data: [] },
      soloResponse: { code: 1, data: [] },
      flexResponse: { code: 1, data: [] },
    },
  });

  assert.deepEqual(result, {
    status: "rejected",
    code: "PROVIDER_PROFILE_THROTTLED",
  });
  assert.equal(database.permits[0].status, "REJECTED");
  assert.equal(database.target.lzyumiRawProfile, previousSnapshot);
  assert.equal(database.target.lzyumiLastLookupAt, previousTimestamp);
});

test("a viewer cannot use correct target identity with forged history to replace another profile", async () => {
  const database = new TransactionFaithfulFakeDatabase();
  const previousProfile = { marker: "previous-profile" };
  const previousHistory = { marker: "previous-history" };
  const previousTimestamp = new Date(now.getTime() - 13 * 60 * minute);
  database.target.lzyumiRawProfile = previousProfile;
  database.target.lzyumiRankedGames = previousHistory;
  database.target.lzyumiLastLookupAt = previousTimestamp;

  const permitToken = "synthetic-viewer-permit-token-with-sufficient-length";
  database.permits.push({
    id: "00000000-0000-4000-8000-000000000003",
    tokenHash: hashLzyumiRefreshPermitToken(permitToken),
    requesterProfileId: requesterId,
    targetProfileId: targetId,
    status: "ISSUED",
    issuedAt: now,
    expiresAt: new Date(now.getTime() + policy.permitTtlMs),
    terminalCode: null,
  });

  const result = await consumeLzyumiRefreshPermit({
    requesterUserId: "synthetic-requester-user",
    targetProfileId: targetId,
    permitToken,
    now: new Date(now.getTime() + 30_000),
    database: database as never,
    snapshot: {
      profileResponse: {
        code: 1,
        battleInfo: {
          nameInfoNew: "ContractTester#T100",
          openId: "synthetic-open-id",
          areaId: 1,
          mapOneInfoList: [],
        },
        data: [],
      },
      soloResponse: { code: 1, data: [{ gameId: "forged-solo-game" }] },
      flexResponse: { code: 1, data: [{ gameId: "foreign-flex-game" }] },
      recentStat: { status: "unavailable", reason: "network-rejected" },
    },
  });

  assert.deepEqual(result, { status: "rejected", code: "OWNER_ONLY" });
  assert.equal(database.permits[0].status, "REJECTED");
  assert.equal(database.target.lzyumiRawProfile, previousProfile);
  assert.equal(database.target.lzyumiRankedGames, previousHistory);
  assert.equal(database.target.lzyumiLastLookupAt, previousTimestamp);
});

test("the additive migration keeps the ledger private and retention-safe", async () => {
  const migration = await readFile(
    "prisma/migrations/20261117143000_add_lzyumi_refresh_permits/migration.sql",
    "utf8",
  );
  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.equal((migration.match(/ON DELETE RESTRICT/g) ?? []).length, 2);
  assert.match(migration, /REVOKE ALL PRIVILEGES[\s\S]*FROM PUBLIC, anon, authenticated;/);
  assert.match(migration, /requester_profile_id, issued_at/);
  assert.match(migration, /target_profile_id, issued_at/);
  assert.match(migration, /token_hash TEXT NOT NULL/);
  assert.doesNotMatch(migration, /open_id|riot_name|provider_payload/i);
  assert.doesNotMatch(migration, /^\s*(?:DROP|TRUNCATE|DELETE)\b/im);
});

test("permit routes reject unauthenticated issuance and consumption", async () => {
  const [{ POST: issue }, { POST: consume }] = await Promise.all([
    import("../app/api/hub/lzyumi-refresh-permits/route"),
    import("../app/api/hub/lzyumi-refresh-permits/consume/route"),
  ]);
  const [issueResponse, consumeResponse] = await Promise.all([
    issue(new Request("http://localhost/api/hub/lzyumi-refresh-permits", { method: "POST" })),
    consume(new Request("http://localhost/api/hub/lzyumi-refresh-permits/consume", { method: "POST" })),
  ]);
  assert.equal(issueResponse.status, 401);
  assert.equal(consumeResponse.status, 401);
});

test("the legacy background-save route remains owner-bound", async () => {
  const { ownerRefreshProfileWhere } = await import(
    "../app/api/hub/refresh-my-profile/route"
  );
  assert.deepEqual(ownerRefreshProfileWhere("synthetic-owner", targetId), {
    id: targetId,
    userId: "synthetic-owner",
    verificationStatus: "VERIFIED",
    accountStatus: "ACTIVE",
  });
});
