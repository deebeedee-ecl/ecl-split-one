import { createHash } from "node:crypto";

export type ChinaServer = {
  id: number;
  name: string;
};

export const CHINA_SERVERS: ChinaServer[] = [
  { id: 1, name: "\u827e\u6b27\u5c3c\u4e9a" },
  { id: 14, name: "\u9ed1\u8272\u73ab\u7470" },
  { id: 31, name: "\u5ce1\u8c37\u4e4b\u5dc5" },
  { id: 30, name: "\u7537\u7235\u9886\u57df" },
  { id: 3, name: "\u7956\u5b89" },
  { id: 4, name: "\u8bfa\u514b\u8428\u65af" },
  { id: 16, name: "\u6055\u745e\u739b" },
];

export type LzyumiPlayerDetail = {
  scoreInfo?: string;
  scoreInfoNum?: number;
  detailChampionId?: string;
  nickName?: string;
  nickNameStr?: string;
  duanweiInfo?: string;
  wasSvp?: string;
  wasMvp?: string;
  win?: string;
  goldEarned?: number;
  totalDamageDealt?: number;
  teamId?: string;
  translateAreaId?: number;
  position?: string;
  openIdNow?: string;
  echartsMap?: Record<string, unknown>;
  [key: string]: unknown;
};

export type LzyumiTeamDetail = {
  teamId?: string;
  win?: string;
  totalKills?: number;
  totalDeaths?: number;
  totalAssists?: number;
  totalGoldEarned?: number;
  totalTurretsKilled?: number;
  totalDragonKills?: number;
  totalBaronKills?: number;
  isSurrender?: number;
  [key: string]: unknown;
};

export type LzyumiRecentMatch = {
  gameId?: string;
  title?: string;
  titleTime?: string;
  isWin?: number;
  [key: string]: unknown;
};

export type LzyumiLookupResponse = {
  code?: number | string;
  message?: string;
  publicInfo?: string;
  onlineInfo?: string | null;
  battleInfo?: {
    nameInfoNew?: string;
    openId?: string;
    areaId?: number;
    level?: number;
    praise?: number;
    seasonInfoMap?: unknown;
    mapOneInfoList?: unknown;
    [key: string]: unknown;
  } | null;
  data?: LzyumiRecentMatch[] | null;
  [key: string]: unknown;
};

export type LzyumiDetailResponse = {
  code?: number | string;
  message?: string;
  data?: {
    gameType?: string;
    gameMode?: string;
    wgBattleDetailInfo?: LzyumiPlayerDetail[];
    teamDetails?: LzyumiTeamDetail[];
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export type LzyumiRecentStatResponse = {
  code?: number | string;
  message?: string;
  data?: {
    recentState?: {
      kda?: number;
      win_times?: number;
      play_times?: number;
      kill_30days?: number;
      death_30days?: number;
      assist_30days?: number;
      last_game_time?: string;
      common_position?: Array<{ Key: string; Value: number }>;
      common_use_champions?: Array<{ key: number; value: number }>;
      [key: string]: unknown;
    };
    gameCareer?: {
      total_mvp_times?: number;
      total_svp_times?: number;
      total_triple_kills?: number;
      total_quadra_kills?: number;
      total_penta_kills?: number;
      total_kills?: number;
      total_assists?: number;
      kda?: number;
      [key: string]: unknown;
    };
    commonPositionInfo?: Array<{
      Key: string;
      Value: number;
      rate: number;
    }>;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export type LzyumiIdentityResult =
  | {
      status: "matched";
      openId: string;
      resolvedName: string;
      areaId: number;
      areaName: string;
      rawProfile: LzyumiLookupResponse;
    }
  | {
      status: "not_found" | "mismatch";
      resolvedName?: string;
      areaId: number;
      areaName: string;
      rawProfile: LzyumiLookupResponse;
    };

const defaultBaseUrl =
  process.env.LZYUMI_BASE_URL ?? "https://a.2025lol.top/lzyumi/lol/info";

export function getChinaServer(areaId?: number | null, fallbackName?: string | null) {
  const server = CHINA_SERVERS.find((item) => item.id === areaId);

  if (server) return server;

  if (fallbackName) {
    const byName = CHINA_SERVERS.find((item) => item.name === fallbackName);
    if (byName) return byName;
  }

  return CHINA_SERVERS[0];
}

export function createLzyumiSignature(now = new Date()) {
  const month = String(now.getMonth() + 1);
  const day = String(now.getDate());
  const hours = String(now.getHours());
  const minutes = String(now.getMinutes());
  const seconds = String(now.getSeconds());
  const signSource = `dld${month.padStart(2, "0")}o${day.padStart(
    2,
    "0",
  )}u${hours.padStart(2, "0")}d${minutes.padStart(2, "0")}o${seconds.padStart(
    2,
    "0",
  )}dld`;

  return {
    lzyumiSign: createHash("md5").update(signSource).digest("hex"),
    signStr: `${month}${day}${hours}${minutes}${seconds}${month.length * 3}${
      day.length * 3
    }${hours.length * 3}${minutes.length * 3}${seconds.length * 3}`,
    signSource,
  };
}

export function normalizeRiotId(riotName: string, riotTag: string) {
  return `${riotName.trim()}#${riotTag.trim()}`.toLowerCase();
}

export function isResolvedRiotIdMatch(
  resolvedName: string | undefined,
  riotName: string,
  riotTag: string,
) {
  if (!resolvedName) return false;
  return resolvedName.trim().toLowerCase() === normalizeRiotId(riotName, riotTag);
}

function signedLookupUrl({
  riotName,
  areaId,
  baseUrl = defaultBaseUrl,
}: {
  riotName: string;
  areaId: number;
  baseUrl?: string;
}) {
  const server = getChinaServer(areaId);
  const { lzyumiSign, signStr } = createLzyumiSignature();
  const params = [
    `nickname=${encodeURIComponent(riotName.trim())}`,
    "allCount=10",
    `areaId=${server.id}`,
    `areaName=${encodeURIComponent(server.name)}`,
    "seleMe=1",
    "filter=1",
    "openId=",
    `lzyumiSign=${lzyumiSign}`,
    `signStr=${signStr}`,
  ];

  return `${baseUrl}?${params.join("&")}`;
}

function signedDetailUrl({
  openId,
  gameId,
  areaId,
  baseUrl = defaultBaseUrl,
}: {
  openId: string;
  gameId: string;
  areaId: number;
  baseUrl?: string;
}) {
  const { lzyumiSign, signStr } = createLzyumiSignature();
  const url = new URL(`${baseUrl}/findOrderDetailInfoAll`);

  url.searchParams.set("openId", openId);
  url.searchParams.set("gameId", gameId);
  url.searchParams.set("areaId", String(areaId));
  url.searchParams.set("lzyumiSign", lzyumiSign);
  url.searchParams.set("signStr", signStr);

  return url.toString();
}

async function lzyumiFetch<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: "https://a.2025lol.top/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Lzyumi request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function lookupLzyumiProfile({
  riotName,
  areaId,
  baseUrl = defaultBaseUrl,
}: {
  riotName: string;
  areaId: number;
  baseUrl?: string;
}) {
  return lzyumiFetch<LzyumiLookupResponse>(
    signedLookupUrl({ riotName, areaId, baseUrl }),
  );
}

export async function lookupLzyumiIdentity({
  riotName,
  riotTag,
  areaId,
  baseUrl = defaultBaseUrl,
}: {
  riotName: string;
  riotTag: string;
  areaId: number;
  baseUrl?: string;
}): Promise<LzyumiIdentityResult> {
  const server = getChinaServer(areaId);
  const lookupNames = Array.from(
    new Set([riotName.trim(), `${riotName.trim()}#${riotTag.trim()}`]),
  ).filter(Boolean);
  let fallback: LzyumiIdentityResult | null = null;

  for (const lookupName of lookupNames) {
    const rawProfile = await lookupLzyumiProfile({ riotName: lookupName, areaId, baseUrl });
    const resolvedName = rawProfile.battleInfo?.nameInfoNew;
    const openId = rawProfile.battleInfo?.openId;

    if (!rawProfile.battleInfo || !openId || !resolvedName) {
      fallback ??= {
        status: "not_found",
        areaId: server.id,
        areaName: server.name,
        rawProfile,
      };
      continue;
    }

    if (!isResolvedRiotIdMatch(resolvedName, riotName, riotTag)) {
      fallback ??= {
        status: "mismatch",
        resolvedName,
        areaId: server.id,
        areaName: server.name,
        rawProfile,
      };
      continue;
    }

    return {
      status: "matched",
      openId,
      resolvedName,
      areaId: server.id,
      areaName: server.name,
      rawProfile,
    };
  }

  return fallback!;
}

export async function fetchLzyumiRankedGames({
  riotName,
  areaId,
  baseUrl = defaultBaseUrl,
}: {
  riotName: string;
  areaId: number;
  baseUrl?: string;
}): Promise<{ soloGames: LzyumiRecentMatch[]; flexGames: LzyumiRecentMatch[] }> {
  const server = getChinaServer(areaId);

  async function fetchFilter(filter: number) {
    const { lzyumiSign, signStr } = createLzyumiSignature();
    const params = [
      `nickname=${encodeURIComponent(riotName.trim())}`,
      "allCount=20",
      `areaId=${server.id}`,
      `areaName=${encodeURIComponent(server.name)}`,
      "seleMe=1",
      `filter=${filter}`,
      "openId=",
      `lzyumiSign=${lzyumiSign}`,
      `signStr=${signStr}`,
    ];
    const url = `${baseUrl}?${params.join("&")}`;
    const res = await lzyumiFetch<LzyumiLookupResponse>(url);
    return Array.isArray(res.data) ? res.data : [];
  }

  const [soloGames, flexGames] = await Promise.all([
    fetchFilter(2), // Solo/Duo ranked
    fetchFilter(3), // Flex ranked
  ]);

  return { soloGames, flexGames };
}

export async function fetchLzyumiRecentStat({
  openId,
  areaId,
  baseUrl = defaultBaseUrl,
}: {
  openId: string;
  areaId: number;
  baseUrl?: string;
}): Promise<LzyumiRecentStatResponse> {
  const { lzyumiSign, signStr } = createLzyumiSignature();
  const url = new URL(`${baseUrl}/getPlayerRecentStat`);
  url.searchParams.set("openId", openId);
  url.searchParams.set("areaId", String(areaId));
  url.searchParams.set("lzyumiSign", lzyumiSign);
  url.searchParams.set("signStr", signStr);
  return lzyumiFetch<LzyumiRecentStatResponse>(url.toString());
}

export async function fetchLzyumiMatchDetail({
  openId,
  gameId,
  areaId,
  baseUrl = defaultBaseUrl,
}: {
  openId: string;
  gameId: string;
  areaId: number;
  baseUrl?: string;
}) {
  return lzyumiFetch<LzyumiDetailResponse>(
    signedDetailUrl({ openId, gameId, areaId, baseUrl }),
  );
}

export function findPlayerInDetail(detail: LzyumiDetailResponse, openId: string) {
  return detail.data?.wgBattleDetailInfo?.find((player) => player.openIdNow === openId) ?? null;
}

export function findPlayerInDetailByRiotId(
  detail: LzyumiDetailResponse,
  riotName: string,
  riotTag: string,
) {
  const target = normalizeRiotId(riotName, riotTag);

  return (
    detail.data?.wgBattleDetailInfo?.find((player) => {
      const names = [player.nickNameStr, player.nickName]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toLowerCase());

      return names.includes(target);
    }) ?? null
  );
}

export function firstRecentGame(profile: LzyumiLookupResponse) {
  return profile.data?.find((match) => typeof match.gameId === "string" && match.gameId) ?? null;
}

export type LzyumiRecoveredRank = {
  tier: string;
  winPoint?: number;
  type: "Solo/Duo" | "Flex";
};

export type LzyumiRecoveredPlayer = {
  openId: string;
  queue: "solo" | "flex";
  game: LzyumiRecentMatch;
  player: LzyumiPlayerDetail;
  rank: LzyumiRecoveredRank | null;
};

function parseDuanweiInfo(value: string | undefined, queue: "solo" | "flex") {
  if (!value || value.includes("\u65e0\u6bb5\u4f4d")) return null;

  const match = value.match(/^(.+?)\s*(\d+)\s*\u70b9/);

  return {
    tier: (match?.[1] ?? value).trim(),
    winPoint: match?.[2] ? Number(match[2]) : undefined,
    type: queue === "solo" ? "Solo/Duo" : "Flex",
  } satisfies LzyumiRecoveredRank;
}

export async function recoverLzyumiPlayersFromRankedGames({
  riotName,
  riotTag,
  areaId,
  rankedGames,
  baseUrl = defaultBaseUrl,
}: {
  riotName: string;
  riotTag: string;
  areaId: number;
  rankedGames: { soloGames?: LzyumiRecentMatch[]; flexGames?: LzyumiRecentMatch[] };
  baseUrl?: string;
}) {
  const recovered: LzyumiRecoveredPlayer[] = [];
  const candidates: Array<{ queue: "solo" | "flex"; games: LzyumiRecentMatch[] }> = [
    { queue: "solo", games: rankedGames.soloGames ?? [] },
    { queue: "flex", games: rankedGames.flexGames ?? [] },
  ];

  for (const { queue, games } of candidates) {
    for (const game of games.slice(0, 4)) {
      if (!game.gameId) continue;

      const detail = await fetchLzyumiMatchDetail({
        openId: "",
        gameId: game.gameId,
        areaId,
        baseUrl,
      });
      const player = findPlayerInDetailByRiotId(detail, riotName, riotTag);
      const openId = player?.openIdNow;

      if (!player || !openId) continue;

      recovered.push({
        openId,
        queue,
        game,
        player,
        rank: parseDuanweiInfo(player.duanweiInfo, queue),
      });
      break;
    }
  }

  return recovered;
}

export async function fetchLatestLzyumiMatch({
  riotName,
  areaId,
  baseUrl = defaultBaseUrl,
}: {
  riotName: string;
  areaId: number;
  baseUrl?: string;
}) {
  const profile = await lookupLzyumiProfile({ riotName, areaId, baseUrl });
  const openId = profile.battleInfo?.openId;
  const recentMatch = firstRecentGame(profile);

  if (!openId || !recentMatch?.gameId) {
    return {
      status: "not_found" as const,
      profile,
      recentMatch,
      detail: null,
      player: null,
    };
  }

  const detail = await fetchLzyumiMatchDetail({
    openId,
    gameId: recentMatch.gameId,
    areaId,
    baseUrl,
  });

  return {
    status: "found" as const,
    profile,
    recentMatch,
    detail,
    player: findPlayerInDetail(detail, openId),
  };
}
