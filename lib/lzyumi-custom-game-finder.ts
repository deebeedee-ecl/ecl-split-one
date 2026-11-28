import { formatRiotId, riotIdKey, splitRiotId } from "./riot-id";
import { verifyLzyumiResolvedIdentity } from "./lzyumi-browser-identity";

export const LZYUMI_CUSTOM_LABEL = "\u65b0\u6a21\u5f0f";
export const LZYUMI_FINDER_FILTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const LZYUMI_FINDER_MAX_DETAILS = 12;

export type FinderHistoryGame = {
  gameId: string;
  title?: string;
  titleTime?: string;
};

type IdentityResponse = {
  battleInfo?: {
    nameInfoNew?: string;
    openId?: string;
    areaId?: number;
  } | null;
  data?: FinderHistoryGame[] | null;
};

type DetailPlayer = {
  nickNameStr?: string;
  nickName?: string;
  openIdNow?: string;
  detailChampionId?: string | number;
  teamId?: string | number;
  position?: string;
  scoreInfo?: string;
  win?: string;
};

export type FinderDetail = {
  data?: {
    gameType?: string;
    gameMode?: string;
    mapId?: string | number;
    endOfGameResult?: string;
    wgBattleDetailInfo?: DetailPlayer[];
    teamDetails?: Array<{ teamId?: string | number }>;
  } | null;
};

export type VerifiedFinderIdentity = {
  resolvedRiotId: string;
  areaId: number;
  openId: string;
  history: FinderHistoryGame[];
};

export type FinderCandidate = {
  gameId: string;
  playedAt: string;
  titleTime: string | null;
  durationSeconds: number | null;
  gameType: "CUSTOM_GAME";
  gameMode: string | null;
  mapId: string | null;
  score: number;
  clues: {
    localizedCustomLabel: boolean;
    primaryChampion: boolean | null;
    opponentFound: boolean | null;
    opponentOnOtherTeam: boolean | null;
    opponentChampion: boolean | null;
  };
  participants: Array<{
    riotId: string;
    championId: string | null;
    champion: string;
    teamId: string;
    role: string | null;
    kda: string | null;
    result: string | null;
    primary: boolean;
    opponent: boolean;
  }>;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function targetDateParts(targetDate: string) {
  const match = targetDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarTime = Date.UTC(year, month - 1, day);
  const date = new Date(calendarTime);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, calendarTime };
}

export function verifyFinderIdentity(value: IdentityResponse, expectedRiotId: string, expectedAreaId: number): VerifiedFinderIdentity {
  try {
    const identity = verifyLzyumiResolvedIdentity(value, expectedRiotId, expectedAreaId);
    return {
      resolvedRiotId: identity.resolvedRiotId,
      areaId: identity.areaId,
      openId: identity.openId,
      history: Array.isArray(value.data) ? value.data : [],
    };
  } catch {
    throw new Error("Lzyumi did not resolve the exact Riot ID on the selected China server.");
  }
}

export function parseFinderGameTime(game: FinderHistoryGame, targetDate: string) {
  const target = targetDateParts(targetDate);
  if (!target) return null;
  const raw = `${game.titleTime ?? ""} ${game.title ?? ""}`;
  const full = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const partial = full ? null : raw.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!full && !partial) return null;
  const year = full ? Number(full[1]) : target.year;
  const month = Number(full ? full[2] : partial![1]);
  const day = Number(full ? full[3] : partial![2]);
  const hour = Number(full ? full[4] : partial![3]);
  const minute = Number(full ? full[5] : partial![4]);
  const second = Number(full ? full[6] ?? 0 : partial![5] ?? 0);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  const playedAt = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
  if (!Number.isFinite(playedAt.getTime())) return null;
  const chinaCalendar = new Date(playedAt.getTime() + 8 * 60 * 60 * 1000);
  if (chinaCalendar.getUTCFullYear() !== year || chinaCalendar.getUTCMonth() !== month - 1 || chinaCalendar.getUTCDate() !== day || chinaCalendar.getUTCHours() !== hour) return null;
  const calendarTime = Date.UTC(year, month - 1, day);
  return {
    playedAt,
    chinaDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    dayDistance: Math.abs(Math.round((calendarTime - target.calendarTime) / 86_400_000)),
  };
}

export function selectFinderHistoryCandidates(
  games: FinderHistoryGame[],
  targetDate: string,
  dayWindow: number,
  limit = LZYUMI_FINDER_MAX_DETAILS,
) {
  const seen = new Set<string>();
  return games
    .filter(game => {
      const gameId = clean(game.gameId);
      if (!gameId || seen.has(gameId)) return false;
      seen.add(gameId);
      return true;
    })
    .map(game => ({ game, time: parseFinderGameTime(game, targetDate) }))
    .filter((entry): entry is { game: FinderHistoryGame; time: NonNullable<ReturnType<typeof parseFinderGameTime>> } => Boolean(entry.time && entry.time.dayDistance <= dayWindow))
    .sort((a, b) => {
      const labelDifference = Number(Boolean(b.game.title?.includes(LZYUMI_CUSTOM_LABEL))) - Number(Boolean(a.game.title?.includes(LZYUMI_CUSTOM_LABEL)));
      return labelDifference || a.time.dayDistance - b.time.dayDistance || b.time.playedAt.getTime() - a.time.playedAt.getTime();
    })
    .slice(0, Math.max(1, Math.min(LZYUMI_FINDER_MAX_DETAILS, limit)));
}

function durationSeconds(game: FinderHistoryGame) {
  const raw = game.title ?? "";
  const chinese = raw.match(/(?:\u7528\u65f6)?\s*(\d+)\s*\u5206\s*(\d+)?\s*\u79d2?/u);
  if (chinese) return Number(chinese[1]) * 60 + Number(chinese[2] ?? 0);
  const clock = raw.match(/\b(\d{1,2}):(\d{2})\b/);
  return clock ? Number(clock[1]) * 60 + Number(clock[2]) : null;
}

function championKey(value: string | number | null | undefined) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function playerRiotId(player: DetailPlayer) {
  const parsed = splitRiotId(player.nickNameStr ?? player.nickName);
  return formatRiotId(parsed.riotName, parsed.riotTag);
}

function championMatches(player: DetailPlayer | undefined, clue: string, championNames: ReadonlyMap<string, string>) {
  if (!clue.trim()) return null;
  if (!player) return false;
  const id = String(player.detailChampionId ?? "");
  return championKey(clue) === championKey(id) || championKey(clue) === championKey(championNames.get(id));
}

export function evaluateFinderCandidate({
  game,
  detail,
  targetDate,
  primaryRiotId,
  primaryOpenId,
  primaryChampion = "",
  opponentRiotId = "",
  opponentChampion = "",
  championNames = new Map<string, string>(),
}: {
  game: FinderHistoryGame;
  detail: FinderDetail;
  targetDate: string;
  primaryRiotId: string;
  primaryOpenId: string;
  primaryChampion?: string;
  opponentRiotId?: string;
  opponentChampion?: string;
  championNames?: ReadonlyMap<string, string>;
}): FinderCandidate | null {
  const data = detail.data;
  const players = data?.wgBattleDetailInfo;
  const teams = data?.teamDetails;
  if (clean(data?.gameType).toUpperCase() !== "CUSTOM_GAME" || !Array.isArray(players) || players.length !== 10 || !Array.isArray(teams) || teams.length !== 2) return null;
  const teamIds = teams.map(team => String(team.teamId ?? ""));
  if (teamIds.some(teamId => !teamId) || new Set(teamIds).size !== 2 || teamIds.some(teamId => players.filter(player => String(player.teamId ?? "") === teamId).length !== 5)) return null;
  const time = parseFinderGameTime(game, targetDate);
  if (!time) return null;

  const primaryKey = riotIdKey(splitRiotId(primaryRiotId).riotName, splitRiotId(primaryRiotId).riotTag);
  const opponentParts = splitRiotId(opponentRiotId);
  const opponentKey = riotIdKey(opponentParts.riotName, opponentParts.riotTag);
  const primary = players.find(player => {
    const parts = splitRiotId(player.nickNameStr ?? player.nickName);
    return riotIdKey(parts.riotName, parts.riotTag) === primaryKey && clean(player.openIdNow) === primaryOpenId;
  });
  if (!primary) return null;
  const opponent = opponentKey
    ? players.find(player => {
        const parts = splitRiotId(player.nickNameStr ?? player.nickName);
        return riotIdKey(parts.riotName, parts.riotTag) === opponentKey;
      })
    : undefined;

  const primaryTeamId = String(primary.teamId ?? "");
  const opponentTeamId = opponent ? String(opponent.teamId ?? "") : "";
  const primaryChampionMatch = championMatches(primary, primaryChampion, championNames);
  const opponentChampionMatch = championMatches(opponent, opponentChampion, championNames);
  const opponentFound = opponentKey ? Boolean(opponent) : null;
  const opponentOnOtherTeam = opponentKey && opponent ? Boolean(primaryTeamId && opponentTeamId && primaryTeamId !== opponentTeamId) : opponentKey ? false : null;
  const localizedCustomLabel = Boolean(game.title?.includes(LZYUMI_CUSTOM_LABEL));
  const score = 100 - time.dayDistance * 15 + (localizedCustomLabel ? 10 : 0) + (primaryChampionMatch === true ? 25 : primaryChampionMatch === false ? -10 : 0) + (opponentFound === true ? 25 : opponentFound === false ? -15 : 0) + (opponentOnOtherTeam === true ? 10 : opponentOnOtherTeam === false ? -10 : 0) + (opponentChampionMatch === true ? 20 : opponentChampionMatch === false ? -8 : 0);

  const participants = players.flatMap(player => {
    const riotId = playerRiotId(player);
    if (!riotId) return [];
    const championId = player.detailChampionId === undefined || player.detailChampionId === null ? null : String(player.detailChampionId);
    const key = riotIdKey(splitRiotId(riotId).riotName, splitRiotId(riotId).riotTag);
    return [{
      riotId,
      championId,
      champion: championId ? championNames.get(championId) ?? `Champion ${championId}` : "Champion unavailable",
      teamId: String(player.teamId ?? ""),
      role: clean(player.position) || null,
      kda: clean(player.scoreInfo) || null,
      result: clean(player.win) || null,
      primary: key === primaryKey,
      opponent: Boolean(opponentKey && key === opponentKey),
    }];
  });

  return {
    gameId: game.gameId,
    playedAt: time.playedAt.toISOString(),
    titleTime: clean(game.titleTime) || null,
    durationSeconds: durationSeconds(game),
    gameType: "CUSTOM_GAME",
    gameMode: clean(data?.gameMode) || null,
    mapId: data?.mapId === undefined || data.mapId === null ? null : String(data.mapId),
    score,
    clues: { localizedCustomLabel, primaryChampion: primaryChampionMatch, opponentFound, opponentOnOtherTeam, opponentChampion: opponentChampionMatch },
    participants,
  };
}
