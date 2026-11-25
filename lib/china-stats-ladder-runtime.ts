import "server-only";

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  normalizeChinaStatsLadderSnapshot,
  validateChinaStatsLadderSnapshot,
} from "@/lib/china-stats-ladder";
import { chinaStatsLadderContentHash } from "@/lib/china-stats-ladder-ingest";
import type { ChinaStatsServerKey } from "@/lib/china-stats-servers";
import { prisma } from "@/lib/prisma";

const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;

export class ChinaStatsLadderSourceError extends Error {
  constructor(readonly kind: "unavailable" | "invalid") {
    super(kind === "invalid"
      ? "The ladder snapshot is invalid."
      : "The ladder snapshot is unavailable.");
  }
}

type StoredSnapshot = {
  server: string;
  platformId: string;
  queue: string;
  capturedAt: Date;
  coverage: unknown;
  rows: unknown;
  contentHash: string;
  collectorVersion: number;
};

export type ChinaStatsLadderReadDatabase = {
  chinaStatsLadderSnapshot: {
    findUnique(args: unknown): Promise<StoredSnapshot | null>;
  };
};

async function loadLocalSnapshot(configured: string) {
  const snapshotPath = path.isAbsolute(configured)
    ? path.resolve(/* turbopackIgnore: true */ configured)
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);

  try {
    const metadata = await stat(snapshotPath);
    if (!metadata.isFile() || metadata.size < 2 || metadata.size > MAX_SNAPSHOT_BYTES) {
      throw new ChinaStatsLadderSourceError("invalid");
    }
    const value = JSON.parse(await readFile(snapshotPath, "utf8")) as unknown;
    const snapshot = normalizeChinaStatsLadderSnapshot(value);
    if (!snapshot) throw new ChinaStatsLadderSourceError("invalid");
    return snapshot;
  } catch (error) {
    if (error instanceof ChinaStatsLadderSourceError) throw error;
    throw new ChinaStatsLadderSourceError("unavailable");
  }
}

export async function loadChinaStatsLadderSnapshot(
  server: ChinaStatsServerKey,
  environment: Record<string, string | undefined> = process.env,
  database: ChinaStatsLadderReadDatabase = prisma as unknown as ChinaStatsLadderReadDatabase,
) {
  const configured = environment.CHINA_STATS_LADDER_SNAPSHOT_PATH?.trim();
  if (configured) {
    const snapshot = await loadLocalSnapshot(configured);
    return snapshot.server === server ? snapshot : null;
  }

  try {
    const stored = await database.chinaStatsLadderSnapshot.findUnique({
      where: { server },
      select: {
        server: true,
        platformId: true,
        queue: true,
        capturedAt: true,
        coverage: true,
        rows: true,
        contentHash: true,
        collectorVersion: true,
      },
    });
    if (!stored) return null;
    const snapshot = validateChinaStatsLadderSnapshot({
      schemaVersion: stored.collectorVersion,
      source: "LCU_APEX_LADDER",
      server: stored.server,
      platformId: stored.platformId,
      queue: stored.queue,
      capturedAt: stored.capturedAt.toISOString(),
      coverage: stored.coverage,
      rows: stored.rows,
    });
    if (!snapshot || chinaStatsLadderContentHash(snapshot) !== stored.contentHash) {
      throw new ChinaStatsLadderSourceError("invalid");
    }
    return snapshot;
  } catch (error) {
    if (error instanceof ChinaStatsLadderSourceError) throw error;
    throw new ChinaStatsLadderSourceError("unavailable");
  }
}
