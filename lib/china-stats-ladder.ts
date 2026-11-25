import { CHINA_STATS_SERVERS, type ChinaStatsServerKey } from "@/lib/china-stats-servers";

export const CHINA_STATS_LADDER_TIERS = ["CHALLENGER", "GRANDMASTER", "MASTER"] as const;
export type ChinaStatsLadderTier = (typeof CHINA_STATS_LADDER_TIERS)[number];

export type ChinaStatsLadderRow = {
  rank: number;
  riotId: string;
  tier: ChinaStatsLadderTier;
  leaguePoints: number;
  wins: number;
  losses: number;
  profileIconId: number | null;
};

export type ChinaStatsLadderCoverage = {
  tier: ChinaStatsLadderTier;
  totalAvailable: number;
  shown: number;
};

export type ChinaStatsLadderSnapshot = {
  schemaVersion: 1;
  source: "LCU_APEX_LADDER";
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

function riotId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 80 || !normalized.includes("#")) return null;
  return normalized;
}

export function normalizeChinaStatsLadderSnapshot(value: unknown): ChinaStatsLadderSnapshot | null {
  const source = record(value);
  if (!source || source.connected !== true || typeof source.platform !== "string") return null;

  const platformId = source.platform.trim().toUpperCase();
  const server = PLATFORM_SERVER[platformId];
  if (!server) return null;

  const capturedAtMs = typeof source.capturedAt === "string" ? Date.parse(source.capturedAt) : Number.NaN;
  if (!Number.isFinite(capturedAtMs)
    || capturedAtMs > Date.now() + 5 * 60_000
    || capturedAtMs < Date.now() - MAX_SNAPSHOT_AGE_MS) return null;

  const results = Array.isArray(source.results) ? source.results : [];
  const coverage: ChinaStatsLadderCoverage[] = [];
  const rows: ChinaStatsLadderRow[] = [];
  const identities = new Set<string>();

  for (const expectedTier of CHINA_STATS_LADDER_TIERS) {
    const group = results
      .map(record)
      .find((candidate) => candidate?.ok === true
        && candidate.queue === "RANKED_SOLO_5x5"
        && candidate.tier === expectedTier);
    if (!group) return null;

    const totalAvailable = integer(group.rowCount, 0, 100_000);
    if (totalAvailable === null) return null;

    const accepted: ChinaStatsLadderRow[] = [];
    for (const candidate of Array.isArray(group.rows) ? group.rows : []) {
      const row = record(candidate);
      if (!row || tier(row.tier) !== expectedTier) continue;
      const rank = integer(row.rank, 1, 100_000);
      const id = riotId(row.riotId);
      const leaguePoints = integer(row.leaguePoints, 0, 100_000);
      const wins = integer(row.wins, 0, 100_000);
      const losses = integer(row.losses, 0, 100_000);
      const profileIconId = row.profileIconId === null || row.profileIconId === undefined
        ? null
        : integer(row.profileIconId, 0, 100_000);
      if (rank === null || !id || leaguePoints === null || wins === null || losses === null) continue;
      const identityKey = id.toLocaleLowerCase("en-US");
      if (identities.has(identityKey)) continue;
      identities.add(identityKey);
      accepted.push({ rank, riotId: id, tier: expectedTier, leaguePoints, wins, losses, profileIconId });
    }
    accepted.sort((left, right) => left.rank - right.rank || right.leaguePoints - left.leaguePoints);
    rows.push(...accepted);
    coverage.push({ tier: expectedTier, totalAvailable, shown: accepted.length });
  }

  rows.sort((left, right) => left.rank - right.rank || right.leaguePoints - left.leaguePoints);
  return {
    schemaVersion: 1,
    source: "LCU_APEX_LADDER",
    server,
    serverName: CHINA_STATS_SERVERS[server].name,
    platformId,
    queue: "RANKED_SOLO_5x5",
    capturedAt: new Date(capturedAtMs).toISOString(),
    coverage,
    rows,
  };
}

