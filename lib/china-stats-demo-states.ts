import type { ChinaStatsServerKey } from "./china-stats-servers";

export type ChinaStatsLookupTarget = {
  riotId: string;
  server: ChinaStatsServerKey;
};

export type ChinaStatsDetailBudget = {
  used: number;
  remaining: number;
  maximum: number;
  exhausted: boolean;
};

function normalizedRiotId(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function shouldRetainChinaStatsResult(
  current: ChinaStatsLookupTarget | null,
  next: ChinaStatsLookupTarget,
) {
  return current !== null
    && current.server === next.server
    && normalizedRiotId(current.riotId) === normalizedRiotId(next.riotId);
}

export function getChinaStatsDetailBudget(
  requestedGameIds: ReadonlySet<string>,
  maximum: number,
): ChinaStatsDetailBudget {
  const used = Math.min(requestedGameIds.size, maximum);
  return {
    used,
    remaining: Math.max(0, maximum - used),
    maximum,
    exhausted: used >= maximum,
  };
}

export function canRequestChinaStatsDetail(
  requestedGameIds: ReadonlySet<string>,
  gameId: string,
  maximum: number,
) {
  return requestedGameIds.has(gameId) || requestedGameIds.size < maximum;
}
