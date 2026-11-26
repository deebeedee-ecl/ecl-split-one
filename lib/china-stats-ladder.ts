import { CHINA_STATS_SERVERS, type ChinaStatsServerKey } from "@/lib/china-stats-servers";

export const CHINA_STATS_LADDER_TIERS = ["CHALLENGER", "GRANDMASTER", "MASTER"] as const;
export type ChinaStatsLadderTier = (typeof CHINA_STATS_LADDER_TIERS)[number];
export type ChinaStatsLadderSource = "LCU_APEX_LADDER" | "WEGAME_TIER_RANK";

export type ChinaStatsLadderRow = {
  rank: number;
  riotId: string;
  tier: ChinaStatsLadderTier;
  leaguePoints: number;
  wins: number | null;
  losses: number | null;
  profileIconId: number | null;
  championIds?: number[];
};

export type ChinaStatsLadderCoverage = {
  tier: ChinaStatsLadderTier;
  totalAvailable: number;
  shown: number;
};

export type ChinaStatsLadderSnapshot = {
  schemaVersion: 1 | 2;
  source: ChinaStatsLadderSource;
  server: ChinaStatsServerKey;
  serverName: string;
  platformId: string;
  queue: "RANKED_SOLO_5x5";
  capturedAt: string;
  coverage: ChinaStatsLadderCoverage[];
  rows: ChinaStatsLadderRow[];
};

const PLATFORM_SERVER: Record<string, ChinaStatsServerKey> = {
  HN1: "ionia",
  BGP2: "super-server",
};

const SOURCE_VERSION: Record<ChinaStatsLadderSource, 1 | 2> = {
  LCU_APEX_LADDER: 1,
  WEGAME_TIER_RANK: 2,
};

const MAX_SNAPSHOT_AGE_MS = 24 * 60 * 60_000;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function integer(value: unknown, minimum: number, maximum: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null;
}

function tier(value: unknown): ChinaStatsLadderTier | null {
  return CHINA_STATS_LADDER_TIERS.includes(value as ChinaStatsLadderTier)
    ? value as ChinaStatsLadderTier
    : null;
}

function sourceName(value: unknown): ChinaStatsLadderSource | null {
  return value === "LCU_APEX_LADDER" || value === "WEGAME_TIER_RANK" ? value : null;
}

function riotId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 80 || !normalized.includes("#")) return null;
  return normalized;
}

function championIds(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 5) return null;
  const ids = value.map((candidate) => integer(candidate, 1, 10_000));
  if (ids.some((candidate) => candidate === null)) return null;
  return [...new Set(ids as number[])];
}

function captureTime(value: unknown) {
  const milliseconds = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(milliseconds)
    || milliseconds > Date.now() + 5 * 60_000
    || milliseconds < Date.now() - MAX_SNAPSHOT_AGE_MS) return null;
  return new Date(milliseconds).toISOString();
}

function normalizeRow(
  candidate: unknown,
  expectedTier: ChinaStatsLadderTier,
  source: ChinaStatsLadderSource,
): ChinaStatsLadderRow | null {
  const row = record(candidate);
  if (!row || tier(row.tier) !== expectedTier) return null;
  const rank = integer(row.rank, 1, 100_000);
  const id = riotId(row.riotId);
  const leaguePoints = integer(row.leaguePoints, 0, 100_000);
  const profileIconId = row.profileIconId === null || row.profileIconId === undefined
    ? null
    : integer(row.profileIconId, 0, 100_000);
  const champions = championIds(row.championIds);
  if (rank === null || !id || leaguePoints === null || champions === null) return null;

  if (source === "LCU_APEX_LADDER") {
    const wins = integer(row.wins, 0, 100_000);
    const losses = integer(row.losses, 0, 100_000);
    if (wins === null || losses === null) return null;
    if (champions.length > 0) return null;
    return { rank, riotId: id, tier: expectedTier, leaguePoints, wins, losses, profileIconId };
  }

  if ((row.wins !== null && row.wins !== undefined) || (row.losses !== null && row.losses !== undefined)) return null;
  return { rank, riotId: id, tier: expectedTier, leaguePoints, wins: null, losses: null, profileIconId, championIds: champions };
}

export function normalizeChinaStatsLadderSnapshot(value: unknown): ChinaStatsLadderSnapshot | null {
  const input = record(value);
  if (!input || input.connected !== true || typeof input.platform !== "string") return null;

  const source = input.source === undefined ? "LCU_APEX_LADDER" : sourceName(input.source);
  if (!source || (input.schemaVersion !== undefined && input.schemaVersion !== SOURCE_VERSION[source])) return null;
  const platformId = input.platform.trim().toUpperCase();
  const server = PLATFORM_SERVER[platformId];
  if (!server) return null;
  const capturedAt = captureTime(input.capturedAt);
  if (!capturedAt) return null;

  const results = Array.isArray(input.results) ? input.results : [];
  const coverage: ChinaStatsLadderCoverage[] = [];
  const rows: ChinaStatsLadderRow[] = [];
  const identities = new Set<string>();
  const ranks = new Set<number>();

  for (const expectedTier of CHINA_STATS_LADDER_TIERS) {
    const group = results
      .map(record)
      .find((candidate) => candidate?.ok === true
        && candidate.queue === "RANKED_SOLO_5x5"
        && candidate.tier === expectedTier);
    if (!group) return null;

    const totalAvailable = integer(group.rowCount, 1, 100_000);
    if (totalAvailable === null) return null;

    const accepted: ChinaStatsLadderRow[] = [];
    for (const candidate of Array.isArray(group.rows) ? group.rows : []) {
      const row = normalizeRow(candidate, expectedTier, source);
      if (!row) continue;
      const identityKey = row.riotId.toLocaleLowerCase("en-US");
      if (identities.has(identityKey) || ranks.has(row.rank)) continue;
      identities.add(identityKey);
      ranks.add(row.rank);
      accepted.push(row);
    }
    accepted.sort((left, right) => left.rank - right.rank || right.leaguePoints - left.leaguePoints);
    if (accepted.length === 0) return null;
    rows.push(...accepted);
    coverage.push({ tier: expectedTier, totalAvailable, shown: accepted.length });
  }

  rows.sort((left, right) => left.rank - right.rank || right.leaguePoints - left.leaguePoints);
  return {
    schemaVersion: SOURCE_VERSION[source],
    source,
    server,
    serverName: CHINA_STATS_SERVERS[server].name,
    platformId,
    queue: "RANKED_SOLO_5x5",
    capturedAt,
    coverage,
    rows,
  };
}

export function validateChinaStatsLadderSnapshot(value: unknown): ChinaStatsLadderSnapshot | null {
  const input = record(value);
  const source = sourceName(input?.source);
  if (!input
    || !source
    || input.schemaVersion !== SOURCE_VERSION[source]
    || input.queue !== "RANKED_SOLO_5x5"
    || typeof input.platformId !== "string"
    || typeof input.server !== "string") return null;

  const platformId = input.platformId.trim().toUpperCase();
  const server = PLATFORM_SERVER[platformId];
  if (!server || input.server !== server) return null;
  const capturedAt = captureTime(input.capturedAt);
  if (!capturedAt) return null;

  const coverageSource = Array.isArray(input.coverage) ? input.coverage.map(record) : [];
  const coverage: ChinaStatsLadderCoverage[] = [];
  for (const expectedTier of CHINA_STATS_LADDER_TIERS) {
    const matches = coverageSource.filter((candidate) => tier(candidate?.tier) === expectedTier);
    if (matches.length !== 1) return null;
    const totalAvailable = integer(matches[0]?.totalAvailable, 1, 100_000);
    const shown = integer(matches[0]?.shown, 1, 100_000);
    if (totalAvailable === null || shown === null || shown > totalAvailable) return null;
    coverage.push({ tier: expectedTier, totalAvailable, shown });
  }

  if (!Array.isArray(input.rows) || input.rows.length > 30_000) return null;
  const rows: ChinaStatsLadderRow[] = [];
  const identities = new Set<string>();
  const ranks = new Set<number>();
  for (const candidate of input.rows) {
    const rowRecord = record(candidate);
    const rowTier = tier(rowRecord?.tier);
    if (!rowTier) return null;
    const row = normalizeRow(rowRecord, rowTier, source);
    if (!row) return null;
    const identityKey = row.riotId.toLocaleLowerCase("en-US");
    if (identities.has(identityKey) || ranks.has(row.rank)) return null;
    identities.add(identityKey);
    ranks.add(row.rank);
    rows.push(row);
  }

  for (const item of coverage) {
    if (rows.filter((row) => row.tier === item.tier).length !== item.shown) return null;
  }
  rows.sort((left, right) => left.rank - right.rank || right.leaguePoints - left.leaguePoints);

  return {
    schemaVersion: SOURCE_VERSION[source],
    source,
    server,
    serverName: CHINA_STATS_SERVERS[server].name,
    platformId,
    queue: "RANKED_SOLO_5x5",
    capturedAt,
    coverage,
    rows,
  };
}
