import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export type ChampionRole = "TOP" | "JNG" | "MID" | "ADC" | "SUPP";

export type ChampionStatsRow = {
  role: ChampionRole;
  champion: string;
  championId: number;
  games: number;
  pickRate: number;
  banRate: number;
  winRate: number;
};

type RawPlayer = {
  detailChampionId?: string | number;
  position?: string;
  win?: string;
};

type RawTeam = {
  banInfoList?: Array<{ championId?: string | number; banChampionId?: string | number }>;
};

type StoredReport = {
  detail?: {
    data?: {
      wgBattleDetailInfo?: RawPlayer[];
      teamDetails?: RawTeam[];
    };
  };
};

function normalizeRole(position?: string | null): ChampionRole | null {
  const role = position?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (role === "TOP" || role === "TOP_LANE") return "TOP";
  if (role === "JUNGLE" || role === "JGL") return "JNG";
  if (role === "MID" || role === "MIDDLE" || role === "MID_LANE") return "MID";
  if (role === "ADC" || role === "BOT" || role === "BOTTOM" || role === "BOTTOM_LANE") {
    return "ADC";
  }
  if (role === "SUP" || role === "SUPPORT" || role === "UTILITY") return "SUPP";
  return null;
}

function isWin(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "win" || normalized === "victory";
}

function rate(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

async function loadChampionNames() {
  const file = await readFile(
    path.join(process.cwd(), "public", "lol", "champions", "champions.json"),
    "utf8",
  );
  const champions = JSON.parse(file.replace(/^\uFEFF/, "")) as Array<{ id: number; name: string }>;
  return new Map(champions.map((champion) => [String(champion.id), champion.name]));
}

export async function getChampionStatsRows(): Promise<ChampionStatsRow[]> {
  const championNames = await loadChampionNames();
  const games = await prisma.matchGame.findMany({
    where: {
      match: {
        OR: [{ roundLabel: { startsWith: "IH" } }, { roundLabel: "Ranked Inhouse" }],
      },
    },
    select: {
      id: true,
      ocrRawJson: true,
    },
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  const picks = new Map<
    string,
    { role: ChampionRole; championId: number; games: number; wins: number }
  >();
  const bans = new Map<string, number>();
  const roleTotals = new Map<ChampionRole, number>();
  let gamesWithBans = 0;

  for (const game of games) {
    const report = game.ocrRawJson as StoredReport | null;
    const players = report?.detail?.data?.wgBattleDetailInfo ?? [];

    for (const player of players) {
      const role = normalizeRole(player.position);
      const championId = Number(player.detailChampionId);
      if (!role || !Number.isFinite(championId) || championId <= 0) continue;

      const key = `${role}:${championId}`;
      const current = picks.get(key) ?? { role, championId, games: 0, wins: 0 };
      current.games += 1;
      current.wins += isWin(player.win) ? 1 : 0;
      picks.set(key, current);
      roleTotals.set(role, (roleTotals.get(role) ?? 0) + 1);
    }

    const bannedChampionIds =
      report?.detail?.data?.teamDetails
        ?.flatMap((team) => team.banInfoList ?? [])
        .map((ban) => ban.championId ?? ban.banChampionId)
        .filter(
          (championId): championId is string | number =>
            championId !== undefined && championId !== null,
        ) ??
      [];

    if (bannedChampionIds.length > 0) gamesWithBans += 1;
    for (const championId of bannedChampionIds) {
      bans.set(String(championId), (bans.get(String(championId)) ?? 0) + 1);
    }
  }

  return [...picks.values()]
    .map((pick): ChampionStatsRow => ({
      role: pick.role,
      champion: championNames.get(String(pick.championId)) ?? `Champion ${pick.championId}`,
      championId: pick.championId,
      games: pick.games,
      pickRate: rate(pick.games, roleTotals.get(pick.role) ?? 0),
      banRate: rate(bans.get(String(pick.championId)) ?? 0, gamesWithBans),
      winRate: rate(pick.wins, pick.games),
    }))
    .sort(
      (a, b) => b.games - a.games || b.winRate - a.winRate || a.champion.localeCompare(b.champion),
    );
}
