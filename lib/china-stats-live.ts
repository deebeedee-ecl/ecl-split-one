import { formatLzyumiRank, getLzyumiRankRows } from "./hub-profile.ts";
import { normalizeRiotPart, splitRiotId } from "./riot-id.ts";
import type { ChinaStatsServerKey } from "./china-stats-servers.ts";

export type ChinaStatsLiveQueue = "SOLO_DUO" | "FLEX";

export type ChinaStatsLiveRank = {
  label: string;
  lp: number | null;
  wins: number | null;
  losses: number | null;
  winRate: number | null;
};

export type ChinaStatsLiveRecent = {
  kda: number | null;
  games: number | null;
  wins: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  champions: Array<{ championId: string; champion: string; games: number }>;
};

export type ChinaStatsLiveProfile = {
  riotId: string;
  serverName: string;
  areaId: number;
  level: number | null;
  ranks: { solo: ChinaStatsLiveRank; flex: ChinaStatsLiveRank };
  recent: ChinaStatsLiveRecent | null;
  recentStatus: "available" | "unavailable";
  fetchedAt: string;
};

export type ChinaStatsLiveMatch = {
  providerGameId: string;
  queue: ChinaStatsLiveQueue;
  championId: string | null;
  champion: string;
  result: "W" | "L" | null;
  title: string | null;
  titleTime: string | null;
  role: string | null;
  wasMvp: boolean;
  wasSvp: boolean;
};

export type ChinaStatsLiveMatchFilters = {
  queue: ChinaStatsLiveQueue | "ALL";
  champion: string;
  role: string;
  result: "ALL" | "W" | "L" | "UNAVAILABLE";
};

export const CHINA_STATS_ALL_MATCH_FILTER = "ALL";
export const CHINA_STATS_UNAVAILABLE_MATCH_FILTER = "UNAVAILABLE";

export const DEFAULT_CHINA_STATS_MATCH_FILTERS: ChinaStatsLiveMatchFilters = {
  queue: "SOLO_DUO",
  champion: CHINA_STATS_ALL_MATCH_FILTER,
  role: CHINA_STATS_ALL_MATCH_FILTER,
  result: CHINA_STATS_ALL_MATCH_FILTER,
};

export type ChinaStatsLiveMatchSummary = {
  games: number;
  decidedGames: number;
  wins: number;
  losses: number;
  winRate: number | null;
  currentStreak: { result: "W" | "L"; length: number } | null;
  recentForm: Array<"W" | "L" | null>;
  champions: Array<{
    championId: string | null;
    champion: string;
    games: number;
    wins: number;
    losses: number;
    winRate: number | null;
  }>;
  roles: Array<{ role: string; games: number }>;
};

export type ChinaStatsLiveDetailPlayer = {
  riotId: string;
  profileRiotId: string | null;
  championId: string | null;
  champion: string;
  role: string;
  kda: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  gold: number | null;
  damage: number | null;
  searchedPlayer: boolean;
};

export type ChinaStatsLiveTeamContext = {
  kills: number | null;
  gold: number | null;
  turrets: number | null;
  dragons: number | null;
  barons: number | null;
};

export type ChinaStatsLiveDetail = {
  gameType: "CUSTOM_GAME" | "MATCHED_GAME" | "OTHER";
  gameMode: string | null;
  durationSeconds: number | null;
  teams: Array<{
    id: string;
    result: "Win" | "Loss" | "Unknown";
    context: ChinaStatsLiveTeamContext;
    players: ChinaStatsLiveDetailPlayer[];
  }>;
};

export type ChinaStatsLiveMatchup = {
  status: "available";
  role: string;
  searched: ChinaStatsLiveDetailPlayer & { killParticipation: number | null };
  opponent: ChinaStatsLiveDetailPlayer & { killParticipation: number | null };
  searchedTeam: ChinaStatsLiveTeamContext & { result: "Win" | "Loss" | "Unknown" };
  opponentTeam: ChinaStatsLiveTeamContext & { result: "Win" | "Loss" | "Unknown" };
  junglers: {
    allied: ChinaStatsLiveDetailPlayer;
    enemy: ChinaStatsLiveDetailPlayer;
  } | null;
} | {
  status: "unavailable";
  reason: "searched-role-unavailable" | "opponent-role-ambiguous";
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function chinaStatsChampionFilterKey(match: Pick<ChinaStatsLiveMatch, "championId" | "champion">) {
  return match.championId ? `id:${match.championId}` : `name:${match.champion}`;
}

export function filterChinaStatsLiveMatches(
  matches: readonly ChinaStatsLiveMatch[],
  filters: ChinaStatsLiveMatchFilters,
) {
  return matches.filter((match) => {
    if (filters.queue !== "ALL" && match.queue !== filters.queue) return false;
    if (filters.champion !== "ALL" && chinaStatsChampionFilterKey(match) !== filters.champion) return false;
    if (filters.role === "UNAVAILABLE" && match.role !== null) return false;
    if (filters.role !== "ALL" && filters.role !== "UNAVAILABLE" && match.role !== filters.role) return false;
    if (filters.result === "UNAVAILABLE" && match.result !== null) return false;
    if (filters.result !== "ALL" && filters.result !== "UNAVAILABLE" && match.result !== filters.result) return false;
    return true;
  });
}

export function normalizeChinaStatsParticipantRiotId(value: unknown) {
  const normalized = normalizeRiotPart(typeof value === "string" ? value : "");
  if (!normalized || normalized.length > 80) return null;
  const firstHash = normalized.indexOf("#");
  if (firstHash <= 0 || firstHash !== normalized.lastIndexOf("#")) return null;
  const { riotName, riotTag } = splitRiotId(normalized);
  if (!riotName || !riotTag) return null;
  return `${riotName}#${riotTag}`;
}

export function chinaStatsParticipantProfileHref(
  riotId: string | null,
  server: ChinaStatsServerKey,
) {
  const normalized = normalizeChinaStatsParticipantRiotId(riotId);
  if (!normalized) return null;
  const params = new URLSearchParams({ server, riotId: normalized });
  return `/labs/china-stats/live?${params.toString()}`;
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown) {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isSafeInteger(parsed) ? parsed : null;
}

function championName(
  championId: string | number,
  championNames: ReadonlyMap<string, string>,
) {
  return championNames.get(String(championId)) ?? `Champion ${championId}`;
}

function roleName(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const roles: Record<string, string> = {
    TOP: "Top",
    TOP_LANE: "Top",
    JUNGLE: "Jungle",
    JGL: "Jungle",
    MID: "Middle",
    MIDDLE: "Middle",
    MID_LANE: "Middle",
    ADC: "Bottom",
    BOT: "Bottom",
    BOTTOM: "Bottom",
    BOTTOM_LANE: "Bottom",
    SUPPORT: "Support",
    SUP: "Support",
    UTILITY: "Support",
  };
  return roles[normalized] ?? "Role unavailable";
}

function normalizeRate(value: unknown, wins: number | null, losses: number | null) {
  const supplied = finiteNumber(value);
  if (supplied !== null) return supplied > 0 && supplied <= 1 ? supplied * 100 : supplied;
  if (wins === null || losses === null || wins + losses === 0) return null;
  return (wins / (wins + losses)) * 100;
}

function normalizeRank(row: ReturnType<typeof getLzyumiRankRows>["solo"]): ChinaStatsLiveRank {
  const formatted = formatLzyumiRank(row);
  const wins = integer(row?.wins);
  const losses = integer(row?.losses);
  return {
    label: formatted.label,
    lp: formatted.lp,
    wins,
    losses,
    winRate: normalizeRate(row?.rate, wins, losses),
  };
}

function normalizeRecent(
  value: unknown,
  championNames: ReadonlyMap<string, string>,
): ChinaStatsLiveRecent | null {
  const root = asRecord(value);
  const data = asRecord(root?.data);
  const recent = asRecord(data?.recentState);
  if (!recent) return null;

  const champions = Array.isArray(recent.common_use_champions)
    ? recent.common_use_champions.flatMap((entry) => {
        const row = asRecord(entry);
        const id = integer(row?.key);
        const games = integer(row?.value);
        if (!id || !games || games < 1) return [];
        return [{ championId: String(id), champion: championName(id, championNames), games }];
      }).slice(0, 5)
    : [];

  return {
    kda: finiteNumber(recent.kda),
    games: integer(recent.play_times),
    wins: integer(recent.win_times),
    kills: integer(recent.kill_30days),
    deaths: integer(recent.death_30days),
    assists: integer(recent.assist_30days),
    champions,
  };
}

export function normalizeChinaStatsLiveProfile({
  profileResponse,
  recentResponse,
  riotId,
  serverName,
  areaId,
  championNames = new Map<string, string>(),
  fetchedAt = new Date(),
}: {
  profileResponse: unknown;
  recentResponse: unknown | null;
  riotId: string;
  serverName: string;
  areaId: number;
  championNames?: ReadonlyMap<string, string>;
  fetchedAt?: Date;
}): ChinaStatsLiveProfile {
  const root = asRecord(profileResponse);
  const battleInfo = asRecord(root?.battleInfo);
  const ranks = getLzyumiRankRows(profileResponse);
  const recent = normalizeRecent(recentResponse, championNames);

  return {
    riotId,
    serverName,
    areaId,
    level: integer(battleInfo?.level),
    ranks: {
      solo: normalizeRank(ranks.solo),
      flex: normalizeRank(ranks.flex),
    },
    recent,
    recentStatus: recent ? "available" : "unavailable",
    fetchedAt: fetchedAt.toISOString(),
  };
}

function historyResult(value: unknown): ChinaStatsLiveMatch["result"] {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "win", "victory", "\u80dc"].includes(normalized)) return "W";
  if (["2", "loss", "defeat", "fail", "\u8d25"].includes(normalized)) return "L";
  return null;
}

function historyRole(...values: unknown[]) {
  const roles: Record<string, string> = {
    "\u4e0a": "Top",
    "\u4e0a\u5355": "Top",
    "\u91ce": "Jungle",
    "\u6253\u91ce": "Jungle",
    "\u4e2d": "Middle",
    "\u4e2d\u5355": "Middle",
    "\u4e0b": "Bottom",
    "\u4e0b\u8def": "Bottom",
    "\u8f85": "Support",
    "\u8f85\u52a9": "Support",
  };

  for (const value of values) {
    const match = clean(value).match(/\u3010([^\u3011]+)\u3011/);
    const role = match ? roles[match[1].trim()] : null;
    if (role) return role;
  }
  return null;
}

export function normalizeChinaStatsLiveHistory(
  value: unknown,
  queue: ChinaStatsLiveQueue,
  championNames: ReadonlyMap<string, string> = new Map(),
  limit = 20,
) {
  const root = asRecord(value);
  const rows = Array.isArray(root?.data) ? root.data : [];
  const seen = new Set<string>();
  const boundedLimit = Math.max(1, Math.min(20, limit));

  return rows.flatMap((entry): ChinaStatsLiveMatch[] => {
    const game = asRecord(entry);
    const providerGameId = clean(game?.gameId);
    if (!game || !providerGameId || seen.has(providerGameId)) return [];
    seen.add(providerGameId);
    const championId = game.championId === undefined || game.championId === null
      ? null
      : clean(String(game.championId));

    return [{
      providerGameId,
      queue,
      championId: championId || null,
      champion: championId ? championName(championId, championNames) : "Champion unavailable",
      result: historyResult(game.isWin ?? game.win),
      title: clean(game.title) || null,
      titleTime: clean(game.titleTime) || null,
      role: historyRole(game.titleTime, game.title),
      wasMvp: clean(game.wasMvp).toLowerCase() === "mvp" || String(game.wasMvp) === "1",
      wasSvp: clean(game.wasSvp).toLowerCase() === "svp" || String(game.wasSvp) === "1",
    }];
  }).slice(0, boundedLimit);
}

export function summarizeChinaStatsLiveMatches(
  matches: readonly ChinaStatsLiveMatch[],
): ChinaStatsLiveMatchSummary {
  const wins = matches.filter((match) => match.result === "W").length;
  const losses = matches.filter((match) => match.result === "L").length;
  const decidedGames = wins + losses;
  const firstResult = matches[0]?.result;
  let streakLength = 0;
  if (firstResult === "W" || firstResult === "L") {
    for (const match of matches) {
      if (match.result !== firstResult) break;
      streakLength += 1;
    }
  }

  const championRows = new Map<string, {
    championId: string | null;
    champion: string;
    games: number;
    wins: number;
    losses: number;
  }>();
  const roleRows = new Map<string, number>();

  for (const match of matches) {
    const championKey = match.championId ?? `name:${match.champion}`;
    const champion = championRows.get(championKey) ?? {
      championId: match.championId,
      champion: match.champion,
      games: 0,
      wins: 0,
      losses: 0,
    };
    champion.games += 1;
    if (match.result === "W") champion.wins += 1;
    if (match.result === "L") champion.losses += 1;
    championRows.set(championKey, champion);

    if (match.role) roleRows.set(match.role, (roleRows.get(match.role) ?? 0) + 1);
  }

  return {
    games: matches.length,
    decidedGames,
    wins,
    losses,
    winRate: decidedGames ? (wins / decidedGames) * 100 : null,
    currentStreak: firstResult === "W" || firstResult === "L"
      ? { result: firstResult, length: streakLength }
      : null,
    recentForm: matches.slice(0, 10).map((match) => match.result),
    champions: [...championRows.values()]
      .sort((left, right) => right.games - left.games || right.wins - left.wins || left.champion.localeCompare(right.champion))
      .map((champion) => {
        const decidedChampionGames = champion.wins + champion.losses;
        return {
          ...champion,
          winRate: decidedChampionGames ? (champion.wins / decidedChampionGames) * 100 : null,
        };
      }),
    roles: [...roleRows.entries()]
      .map(([role, games]) => ({ role, games }))
      .sort((left, right) => right.games - left.games || left.role.localeCompare(right.role)),
  };
}

function detailGameType(value: unknown): ChinaStatsLiveDetail["gameType"] {
  const normalized = clean(value).toUpperCase();
  if (normalized === "CUSTOM_GAME") return "CUSTOM_GAME";
  if (normalized === "MATCHED_GAME") return "MATCHED_GAME";
  return "OTHER";
}

function detailResult(value: unknown): "Win" | "Loss" | "Unknown" {
  const normalized = clean(value).toLowerCase();
  if (["1", "win", "victory"].includes(normalized)) return "Win";
  if (["0", "2", "loss", "fail", "defeat"].includes(normalized)) return "Loss";
  return "Unknown";
}

function detailMetric(player: Record<string, unknown>, key: string) {
  const chart = asRecord(player.echartsMap);
  const value = finiteNumber(chart?.[key] ?? player[key]);
  return value !== null && value >= 0 ? value : null;
}

function detailKda(value: unknown) {
  const match = clean(value).match(/^(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  const values = match.slice(1).map(Number);
  if (values.some((entry) => !Number.isSafeInteger(entry))) return null;
  const [kills, deaths, assists] = values;
  return { kills, deaths, assists, label: `${kills}/${deaths}/${assists}` };
}

function nonNegativeInteger(value: unknown) {
  const parsed = integer(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function teamMetric(team: Record<string, unknown> | null, key: string) {
  return nonNegativeInteger(team?.[key]);
}

function teamTotalFromPlayers(
  players: ChinaStatsLiveDetailPlayer[],
  key: "kills" | "gold",
) {
  const values = players.map((player) => player[key]);
  return values.every((value): value is number => value !== null)
    ? values.reduce((sum, value) => sum + value, 0)
    : null;
}

function killParticipation(player: ChinaStatsLiveDetailPlayer, teamKills: number | null) {
  if (player.kills === null || player.assists === null || teamKills === null || teamKills <= 0) return null;
  return ((player.kills + player.assists) / teamKills) * 100;
}

export function normalizeChinaStatsLiveDetail({
  value,
  searchedOpenId,
  championNames = new Map<string, string>(),
}: {
  value: unknown;
  searchedOpenId: string;
  championNames?: ReadonlyMap<string, string>;
}): ChinaStatsLiveDetail {
  const root = asRecord(value);
  const data = asRecord(root?.data);
  const players = Array.isArray(data?.wgBattleDetailInfo) ? data.wgBattleDetailInfo : [];
  const teams = Array.isArray(data?.teamDetails) ? data.teamDetails : [];
  const teamIds = teams.map((team) => clean(String(asRecord(team)?.teamId ?? ""))).filter(Boolean);

  if (players.length !== 10 || teamIds.length !== 2 || new Set(teamIds).size !== 2) {
    throw new Error("The live match detail is not a coherent 5v5 game.");
  }

  let searchedPlayerCount = 0;
  const normalizedTeams = teamIds.map((teamId) => {
    const teamRecord = asRecord(teams.find((team) => clean(String(asRecord(team)?.teamId ?? "")) === teamId));
    const normalizedPlayers = players.flatMap((entry): ChinaStatsLiveDetailPlayer[] => {
      const player = asRecord(entry);
      if (!player || clean(String(player.teamId ?? "")) !== teamId) return [];
      const riotId = clean(player.nickNameStr) || clean(player.nickName);
      const championId = player.detailChampionId === undefined || player.detailChampionId === null
        ? null
        : clean(String(player.detailChampionId));
      const isSearchedPlayer = clean(player.openIdNow) === searchedOpenId;
      if (isSearchedPlayer) searchedPlayerCount += 1;
      const kda = detailKda(player.scoreInfo);
      return [{
        riotId: riotId || "Player unavailable",
        profileRiotId: normalizeChinaStatsParticipantRiotId(riotId),
        championId: championId || null,
        champion: championId ? championName(championId, championNames) : "Champion unavailable",
        role: roleName(clean(player.position)),
        kda: kda?.label ?? null,
        kills: kda?.kills ?? null,
        deaths: kda?.deaths ?? null,
        assists: kda?.assists ?? null,
        gold: detailMetric(player, "goldEarned"),
        damage: detailMetric(player, "totalDamageDealt"),
        searchedPlayer: isSearchedPlayer,
      }];
    });
    if (normalizedPlayers.length !== 5) throw new Error("The live match detail does not contain five players per team.");
    const inferredResult = normalizedPlayers.find((row) => row.searchedPlayer)
      ? detailResult(players.find((entry) => clean(asRecord(entry)?.openIdNow) === searchedOpenId) && asRecord(players.find((entry) => clean(asRecord(entry)?.openIdNow) === searchedOpenId))?.win)
      : detailResult(teamRecord?.win);
    return {
      id: teamId,
      result: inferredResult,
      context: {
        kills: teamMetric(teamRecord, "totalKills") ?? teamTotalFromPlayers(normalizedPlayers, "kills"),
        gold: teamMetric(teamRecord, "totalGoldEarned") ?? teamTotalFromPlayers(normalizedPlayers, "gold"),
        turrets: teamMetric(teamRecord, "totalTurretsKilled"),
        dragons: teamMetric(teamRecord, "totalDragonKills"),
        barons: teamMetric(teamRecord, "totalBaronKills"),
      },
      players: normalizedPlayers,
    };
  });

  if (searchedPlayerCount === 0) throw new Error("The verified player is missing from this match detail.");
  if (searchedPlayerCount > 1) throw new Error("The verified player is not unique in this match detail.");

  return {
    gameType: detailGameType(data?.gameType),
    gameMode: clean(data?.gameMode) || null,
    durationSeconds: integer(data?.gameTime ?? data?.duration ?? data?.gameDuration),
    teams: normalizedTeams,
  };
}

export function deriveChinaStatsLiveMatchup(detail: ChinaStatsLiveDetail): ChinaStatsLiveMatchup {
  const searchedTeamIndex = detail.teams.findIndex((team) => team.players.some((player) => player.searchedPlayer));
  const searchedTeam = detail.teams[searchedTeamIndex];
  const opponentTeam = detail.teams.find((_, index) => index !== searchedTeamIndex);
  const searched = searchedTeam?.players.find((player) => player.searchedPlayer);

  if (!searched || !opponentTeam || searched.role === "Role unavailable") {
    return { status: "unavailable", reason: "searched-role-unavailable" };
  }

  const sameRoleOpponents = opponentTeam.players.filter((player) => player.role === searched.role);
  if (sameRoleOpponents.length !== 1) {
    return { status: "unavailable", reason: "opponent-role-ambiguous" };
  }

  const opponent = sameRoleOpponents[0];
  const alliedJunglers = searchedTeam.players.filter((player) => player.role === "Jungle");
  const enemyJunglers = opponentTeam.players.filter((player) => player.role === "Jungle");
  const junglers = searched.role !== "Jungle" && alliedJunglers.length === 1 && enemyJunglers.length === 1
    ? { allied: alliedJunglers[0], enemy: enemyJunglers[0] }
    : null;

  return {
    status: "available",
    role: searched.role,
    searched: {
      ...searched,
      killParticipation: killParticipation(searched, searchedTeam.context.kills),
    },
    opponent: {
      ...opponent,
      killParticipation: killParticipation(opponent, opponentTeam.context.kills),
    },
    searchedTeam: { ...searchedTeam.context, result: searchedTeam.result },
    opponentTeam: { ...opponentTeam.context, result: opponentTeam.result },
    junglers,
  };
}
