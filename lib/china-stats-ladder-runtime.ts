import "server-only";

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { normalizeChinaStatsLadderSnapshot } from "@/lib/china-stats-ladder";

const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;

export class ChinaStatsLadderSourceError extends Error {
  constructor(readonly kind: "not-configured" | "unavailable" | "invalid") {
    super(kind === "not-configured"
      ? "The ladder snapshot source is not configured."
      : kind === "invalid"
        ? "The ladder snapshot is invalid."
        : "The ladder snapshot is unavailable.");
  }
}
export async function loadChinaStatsLadderSnapshot(
  environment: Record<string, string | undefined> = process.env,
) {
  const configured = environment.CHINA_STATS_LADDER_SNAPSHOT_PATH?.trim();
  if (!configured) throw new ChinaStatsLadderSourceError("not-configured");
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

