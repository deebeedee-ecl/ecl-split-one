import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { ChinaStatsLadderSnapshot } from "@/lib/china-stats-ladder";

type StoredSnapshotIdentity = {
  capturedAt: Date;
  contentHash: string;
};

type LadderTransaction = {
  $queryRaw<T>(query: Prisma.Sql): Promise<T>;
  chinaStatsLadderSnapshot: {
    findUnique(args: unknown): Promise<StoredSnapshotIdentity | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
};

export type ChinaStatsLadderDatabase = {
  $transaction<T>(operation: (transaction: LadderTransaction) => Promise<T>): Promise<T>;
};

export type ChinaStatsLadderWriteResult = {
  status: "created" | "replaced" | "duplicate" | "stale" | "conflict";
  contentHash: string;
};

type ChinaStatsLadderStoreStage =
  | "TRANSACTION_START"
  | "ADVISORY_LOCK"
  | "READ_CURRENT"
  | "CREATE_SNAPSHOT"
  | "UPDATE_SNAPSHOT";

class ChinaStatsLadderStoreError extends Error {
  readonly storeStage: ChinaStatsLadderStoreStage;
  readonly code?: string;

  constructor(stage: ChinaStatsLadderStoreStage, cause: unknown) {
    super("China stats ladder persistence failed.");
    this.name = "ChinaStatsLadderStoreError";
    this.storeStage = stage;
    const source = cause && typeof cause === "object" ? cause as Record<string, unknown> : {};
    if (typeof source.code === "string" && /^P\d{4}$/.test(source.code)) this.code = source.code;
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function chinaStatsCollectorConfigured(environment: Record<string, string | undefined> = process.env) {
  return environment.CHINA_STATS_LADDER_INGEST_ENABLED === "true"
    && clean(environment.CHINA_STATS_COLLECTOR_SECRET).length >= 32;
}

export function chinaStatsCollectorAuthorized(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
) {
  if (!chinaStatsCollectorConfigured(environment)) return false;
  const expected = clean(environment.CHINA_STATS_COLLECTOR_SECRET);
  const supplied = clean(request.headers.get("x-ecl-china-stats-secret"));
  return Boolean(supplied) && secureEqual(supplied, expected);
}

export function chinaStatsLadderContentHash(snapshot: ChinaStatsLadderSnapshot) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export async function storeChinaStatsLadderSnapshot(
  database: ChinaStatsLadderDatabase,
  snapshot: ChinaStatsLadderSnapshot,
): Promise<ChinaStatsLadderWriteResult> {
  const contentHash = chinaStatsLadderContentHash(snapshot);
  const capturedAt = new Date(snapshot.capturedAt);
  let stage: ChinaStatsLadderStoreStage = "TRANSACTION_START";

  try {
    return await database.$transaction(async (transaction) => {
      stage = "ADVISORY_LOCK";
      await transaction.$queryRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`china-stats-ladder:${snapshot.server}`}, 0)
        ) AS locked
      `);
      stage = "READ_CURRENT";
      const current = await transaction.chinaStatsLadderSnapshot.findUnique({
        where: { server: snapshot.server },
        select: { capturedAt: true, contentHash: true },
      });

      if (current) {
        const currentTime = current.capturedAt.getTime();
        const incomingTime = capturedAt.getTime();
        if (currentTime > incomingTime) return { status: "stale", contentHash };
        if (currentTime === incomingTime) {
          return { status: current.contentHash === contentHash ? "duplicate" : "conflict", contentHash };
        }
        stage = "UPDATE_SNAPSHOT";
        await transaction.chinaStatsLadderSnapshot.update({
          where: { server: snapshot.server },
          data: {
            platformId: snapshot.platformId,
            queue: snapshot.queue,
            capturedAt,
            coverage: snapshot.coverage as unknown as Prisma.InputJsonValue,
            rows: snapshot.rows as unknown as Prisma.InputJsonValue,
            contentHash,
            collectorVersion: snapshot.schemaVersion,
          },
        });
        return { status: "replaced", contentHash };
      }

      stage = "CREATE_SNAPSHOT";
      await transaction.chinaStatsLadderSnapshot.create({
        data: {
          server: snapshot.server,
          platformId: snapshot.platformId,
          queue: snapshot.queue,
          capturedAt,
          coverage: snapshot.coverage as unknown as Prisma.InputJsonValue,
          rows: snapshot.rows as unknown as Prisma.InputJsonValue,
          contentHash,
          collectorVersion: snapshot.schemaVersion,
        },
      });
      return { status: "created", contentHash };
    });
  } catch (error) {
    throw new ChinaStatsLadderStoreError(stage, error);
  }
}
