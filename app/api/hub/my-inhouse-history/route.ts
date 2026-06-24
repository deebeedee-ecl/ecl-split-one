import { NextRequest, NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { INHOUSE_MATCH_FILTER } from "@/lib/inhouse-filter";
import { prisma } from "@/lib/prisma";
import {
  normalizeRiotPart,
  normalizeRiotTag,
  riotIdKey,
  splitRiotId,
} from "@/lib/riot-id";

export const dynamic = "force-dynamic";

type RawPlayer = {
  nickNameStr?: string;
  nickName?: string;
  detailChampionId?: string | number;
  position?: string;
  scoreInfoNum?: number;
  goldEarned?: number;
  totalDamageDealt?: number;
  echartsMap?: {
    goldEarned?: number;
    totalDamageDealt?: number;
    killAssisScore?: number;
  };
};

type StoredReport = {
  detail?: { data?: { wgBattleDetailInfo?: RawPlayer[] } };
};

const ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeRole(position?: string | null) {
  const role = position?.trim().toUpperCase();
  if (role === "TOP" || role === "TOP_LANE") return "TOP";
  if (role === "JUNGLE" || role === "JGL") return "JGL";
  if (role === "MID" || role === "MIDDLE" || role === "MID_LANE") return "MID";
  if (role === "ADC" || role === "BOT" || role === "BOTTOM") return "ADC";
  if (role === "SUP" || role === "SUPPORT" || role === "UTILITY") return "SUP";
  return null;
}

function rawPlayerFor(
  report: unknown,
  riotName: string | null | undefined,
  riotTag: string | null | undefined,
) {
  const target = riotIdKey(riotName, riotTag);
  if (!target) return null;
  const players = (report as StoredReport | null)?.detail?.data?.wgBattleDetailInfo ?? [];
  return (
    players.find((player) => {
      const parsed = splitRiotId(player.nickNameStr ?? player.nickName);
      return riotIdKey(parsed.riotName, parsed.riotTag) === target;
    }) ?? null
  );
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export async function GET(request: NextRequest) {
  const requestedProfileId = request.nextUrl.searchParams.get("profileId")?.trim();
  const account = requestedProfileId ? null : await getAccountFromRequest(request);
  if (!requestedProfileId && !account) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const profile = await prisma.accountProfile.findFirst({
    where: requestedProfileId
      ? { id: requestedProfileId, verificationStatus: "VERIFIED", accountStatus: "ACTIVE" }
      : { userId: account!.id },
    select: { id: true, email: true, riotName: true, riotTag: true },
  });

  if (!profile?.riotName) return NextResponse.json({ games: [], summary: null });

  const riotName = normalizeRiotPart(profile.riotName);
  const cleanTag = normalizeRiotTag(profile.riotTag);
  const player = await prisma.player.findFirst({
    where: {
      OR: [
        {
          riotName: { equals: riotName, mode: "insensitive" },
          ...(cleanTag ? { riotTag: { equals: cleanTag, mode: "insensitive" } } : {}),
        },
        ...(profile.email
          ? [{ email: { equals: profile.email, mode: "insensitive" as const } }]
          : []),
      ],
    },
  });

  if (!player) return NextResponse.json({ games: [], summary: null });

  const stats = await prisma.matchGamePlayerStat.findMany({
    where: { playerId: player.id, ...INHOUSE_MATCH_FILTER },
    select: {
      id: true,
      isWin: true,
      kills: true,
      deaths: true,
      assists: true,
      gold: true,
      damage: true,
      visionScore: true,
      lpChange: true,
      eloAfter: true,
      isMVP: true,
      isSVP: true,
      createdAt: true,
      matchGame: {
        select: {
          ocrRawJson: true,
          match: { select: { roundLabel: true, matchLabel: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const enriched = stats.map((stat) => {
    const raw = rawPlayerFor(stat.matchGame.ocrRawJson, player.riotName, player.riotTag);
    return {
      stat,
      raw,
      role: normalizeRole(raw?.position),
      championId: raw?.detailChampionId ? String(raw.detailChampionId) : null,
      score: Number(raw?.scoreInfoNum) || 0,
      gold: Number(raw?.echartsMap?.goldEarned ?? stat.gold ?? 0),
      damage: Number(raw?.echartsMap?.totalDamageDealt ?? stat.damage ?? 0),
      participation: Number(raw?.echartsMap?.killAssisScore ?? 0),
    };
  });

  const games = enriched.map(({ stat, role, championId }) => ({
    id: stat.id,
    gameLabel: stat.matchGame.match.roundLabel ?? stat.matchGame.match.matchLabel ?? "IH Game",
    date: stat.createdAt.toISOString(),
    isWin: stat.isWin,
    kills: stat.kills,
    deaths: stat.deaths,
    assists: stat.assists,
    lpChange: stat.lpChange,
    eloAfter: stat.eloAfter ?? player.elo,
    isMVP: stat.isMVP,
    isSVP: stat.isSVP,
    role,
    championId,
  }));

  const wins = stats.filter((stat) => stat.isWin).length;
  const losses = stats.length - wins;
  const roleStats = ROLES.map((role) => {
    const roleGames = enriched.filter((game) => game.role === role);
    const roleWins = roleGames.filter((game) => game.stat.isWin).length;
    return {
      role,
      games: roleGames.length,
      pct: stats.length ? Math.round((roleGames.length / stats.length) * 100) : 0,
      winRate: roleGames.length ? Math.round((roleWins / roleGames.length) * 100) : 0,
    };
  });

  const championCounts = new Map<string, { games: number; wins: number }>();
  for (const game of enriched) {
    if (!game.championId) continue;
    const current = championCounts.get(game.championId) ?? { games: 0, wins: 0 };
    current.games += 1;
    current.wins += game.stat.isWin ? 1 : 0;
    championCounts.set(game.championId, current);
  }
  const topChampions = [...championCounts.entries()]
    .map(([championId, values]) => ({ championId, ...values }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .slice(0, 5);

  const rankedPlayers = await prisma.player.findMany({
    select: {
      id: true,
      name: true,
      elo: true,
      gameStats: { where: INHOUSE_MATCH_FILTER, select: { id: true } },
    },
  });
  const ladder = rankedPlayers
    .filter((entry) => entry.gameStats.length > 0)
    .sort((a, b) => b.elo - a.elo || b.gameStats.length - a.gameStats.length || a.name.localeCompare(b.name));
  const rankIndex = ladder.findIndex((entry) => entry.id === player.id);

  const currentStreak = player.winStreak > 0 ? player.winStreak : player.lossStreak;
  const streakLabel = player.winStreak > 0 ? `W${player.winStreak}` : player.lossStreak > 0 ? `L${player.lossStreak}` : "-";
  const kdas = stats.map((stat) => (stat.kills + stat.assists) / Math.max(1, stat.deaths));
  const scores = enriched.map((game) => game.score).filter((value) => value > 0);
  const scoreAverage = average(scores);
  const scoreVariance = average(scores.map((score) => (score - scoreAverage) ** 2));
  const confidence = Math.min(1, stats.length / 5);

  return NextResponse.json({
    games,
    summary: {
      elo: player.elo,
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      games: stats.length,
      wins,
      losses,
      mvps: stats.filter((stat) => stat.isMVP).length,
      svps: stats.filter((stat) => stat.isSVP).length,
      currentStreak,
      streakLabel,
      roleStats,
      topChampions,
      performance: [
        { label: "Mechanics", value: clamp(average(kdas) * 18) },
        { label: "Damage", value: clamp(average(enriched.map((game) => game.damage)) / 300) },
        { label: "Teamplay", value: clamp(average(enriched.map((game) => game.participation))) },
        { label: "Economy", value: clamp(average(enriched.map((game) => game.gold)) / 150) },
        {
          label: "Consistency",
          value: clamp((100 - Math.sqrt(scoreVariance) * 15) * confidence),
        },
      ],
    },
  });
}
