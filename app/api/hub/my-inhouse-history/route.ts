import { NextRequest, NextResponse } from "next/server";
import { getAccountFromRequest } from "@/lib/account-auth";
import { INHOUSE_MATCH_FILTER } from "@/lib/inhouse-filter";
import { prisma } from "@/lib/prisma";
import { getRankedSeason, rankedSeasonState } from "@/lib/ranked-season";
import { getInhouseLeaderboardRows } from "@/lib/inhouse-leaderboard";
import { inhouseRawPlayer, inhouseChampionId, normalizeInhouseRole, inhouseScoreboardMetrics } from "@/lib/inhouse-player-display";
import {
  normalizeRiotPart,
  normalizeRiotTag,
} from "@/lib/riot-id";

export const dynamic = "force-dynamic";

const ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export async function GET(request: NextRequest) {
  const requestedProfileId = request.nextUrl.searchParams.get("profileId")?.trim();
  const statId = request.nextUrl.searchParams.get("statId");
  if (statId && (requestedProfileId || !/^[a-zA-Z0-9_-]{1,128}$/.test(statId))) return NextResponse.json({ message: "Invalid match request" }, { status: 400 });
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
      matchGameId: true,
      riotName: true,
      riotTag: true,
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

  if (statId) {
    const own = stats.find(stat => stat.id === statId);
    if (!own) return NextResponse.json({ message: "Match not found in your history" }, { status: 404 });
    const players = await prisma.matchGamePlayerStat.findMany({
      where: { ...INHOUSE_MATCH_FILTER, matchGameId: own.matchGameId },
      take: 10,
      select: { riotName: true, riotTag: true, kills: true, deaths: true, assists: true, damage: true, gold: true, visionScore: true, cs: true, isWin: true, isMVP: true, isSVP: true, player: { select: { name: true, riotName: true, riotTag: true } } },
    });
    return NextResponse.json({ scoreboard: { id: own.id, metricsVersion: 2, label: own.matchGame.match.roundLabel ?? own.matchGame.match.matchLabel ?? "IH Game", date: own.createdAt.toISOString(), players: players.map(stat => {
      const raw = inhouseRawPlayer(own.matchGame.ocrRawJson, stat.riotName ?? stat.player.riotName, stat.riotTag ?? stat.player.riotTag);
      return { name: stat.player.name, championId: inhouseChampionId(raw), role: normalizeInhouseRole(raw?.position), isWin: stat.isWin, isMVP: stat.isMVP, isSVP: stat.isSVP, kills: stat.kills, deaths: stat.deaths, assists: stat.assists, cs: stat.cs, ...inhouseScoreboardMetrics(own.matchGame.ocrRawJson, raw, stat) };
    }) } }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const season = getRankedSeason();
  // History stays at its existing latest-100 limit across seasons. Season totals
  // use all current-season metadata; role/champion samples use the latest 100.
  const seasonStats = season ? await prisma.matchGamePlayerStat.findMany({
    where: { playerId: player.id, ...INHOUSE_MATCH_FILTER, createdAt: { gte: season.startedAt } },
    select: { id: true, createdAt: true, isWin: true, lpChange: true, kills: true, deaths: true, assists: true, isMVP: true, isSVP: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  }) : null;
  const seasonState = season && seasonStats ? rankedSeasonState(seasonStats, season) : null;
  const enriched = stats.map((stat) => {
    const raw = inhouseRawPlayer(stat.matchGame.ocrRawJson, stat.riotName ?? player.riotName, stat.riotTag ?? player.riotTag);
    return {
      stat,
      raw,
      role: normalizeInhouseRole(raw?.position),
      championId: inhouseChampionId(raw),
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

  const summaryStats = seasonStats ?? stats;
  const summaryEnriched = season ? enriched.filter(game => game.stat.createdAt >= season.startedAt) : enriched;
  const wins = summaryStats.filter((stat) => stat.isWin).length;
  const losses = summaryStats.length - wins;
  const roleStats = ROLES.map((role) => {
    const roleGames = summaryEnriched.filter((game) => game.role === role);
    const roleWins = roleGames.filter((game) => game.stat.isWin).length;
    return {
      role,
      games: roleGames.length,
      pct: summaryEnriched.length ? Math.round((roleGames.length / summaryEnriched.length) * 100) : 0,
      winRate: roleGames.length ? Math.round((roleWins / roleGames.length) * 100) : 0,
    };
  });

  const championCounts = new Map<string, { games: number; wins: number }>();
  for (const game of summaryEnriched) {
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

  const rankedPlayers = season ? [] : await prisma.player.findMany({
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
  const seasonLadder = season ? await getInhouseLeaderboardRows(season) : null;
  const rankIndex = seasonLadder ? seasonLadder.findIndex(entry => entry.playerId === player.id) : ladder.findIndex((entry) => entry.id === player.id);

  const winStreak = seasonState?.winStreak ?? player.winStreak;
  const lossStreak = seasonState?.lossStreak ?? player.lossStreak;
  const currentStreak = winStreak > 0 ? winStreak : lossStreak;
  const streakLabel = winStreak > 0 ? `W${winStreak}` : lossStreak > 0 ? `L${lossStreak}` : "-";
  const kdas = summaryStats.map((stat) => (stat.kills + stat.assists) / Math.max(1, stat.deaths));
  const scores = summaryEnriched.map((game) => game.score).filter((value) => value > 0);
  const scoreAverage = average(scores);
  const scoreVariance = average(scores.map((score) => (score - scoreAverage) ** 2));
  const confidence = Math.min(1, summaryStats.length / 5);

  return NextResponse.json({
    games,
    season: season ? { id: season.id, name: season.name, startedAt: season.startedAt.toISOString(), historyScope: "all-time", summaryScope: "season" } : null,
    summary: {
      elo: seasonState?.displayElo ?? player.elo,
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      games: summaryStats.length,
      wins,
      losses,
      averageKda: Number(average(kdas).toFixed(2)),
      mvps: summaryStats.filter((stat) => stat.isMVP).length,
      svps: summaryStats.filter((stat) => stat.isSVP).length,
      currentStreak,
      streakLabel,
      roleStats,
      topChampions,
      performance: [
        { label: "Mechanics", value: clamp(average(kdas) * 18) },
        { label: "Damage", value: clamp(average(summaryEnriched.map((game) => game.damage)) / 300) },
        { label: "Teamplay", value: clamp(average(summaryEnriched.map((game) => game.participation))) },
        { label: "Economy", value: clamp(average(summaryEnriched.map((game) => game.gold)) / 150) },
        {
          label: "Consistency",
          value: clamp((100 - Math.sqrt(scoreVariance) * 15) * confidence),
        },
      ],
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
