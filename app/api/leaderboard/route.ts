import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getTeamTag(teamName?: string | null) {
  if (!teamName) return "FA";

  const words = teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "FA";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();

  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatWinRate(wins: number, gamesPlayed: number) {
  if (gamesPlayed === 0) return "—";
  return `${Math.round((wins / gamesPlayed) * 100)}%`;
}

function formatKDA(kills: number, deaths: number, assists: number) {
  if (kills === 0 && deaths === 0 && assists === 0) return "—";
  const kda = (kills + assists) / Math.max(1, deaths);
  return kda.toFixed(2);
}

export async function GET() {
  try {
    const players = await prisma.player.findMany({
      include: {
        team: true,
        gameStats: {
          where: { matchGame: { match: { roundLabel: "Ranked Inhouse" } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const leaderboard = players
      .map((player) => {
        const teamTag = getTeamTag(player.team?.name);

        const gamesPlayed = player.gameStats.length;
        const wins = player.gameStats.filter((s) => s.isWin).length;
        const mvpCount = player.gameStats.filter((s) => s.isMVP).length;

        const totalKills = player.gameStats.reduce((sum, s) => sum + s.kills, 0);
        const totalDeaths = player.gameStats.reduce((sum, s) => sum + s.deaths, 0);
        const totalAssists = player.gameStats.reduce((sum, s) => sum + s.assists, 0);

        // Derive ELO and streak from inhouse stats only (Player.elo is polluted by old league data)
        const elo = player.gameStats[0]?.eloAfter ?? 800;
        let streakLabel = "—";
        let w = 0, l = 0;
        for (const s of player.gameStats) {
          if (s.isWin) { if (l > 0) break; w++; }
          else         { if (w > 0) break; l++; }
        }
        if (w > 0) streakLabel = `W${w}`;
        else if (l > 0) streakLabel = `L${l}`;

        return {
          name: player.name,
          teamTag,
          elo,
          gamesPlayed,
          winRate: formatWinRate(wins, gamesPlayed),
          kda: formatKDA(totalKills, totalDeaths, totalAssists),
          mvpCount,
          streakLabel,
        };
      })
      .filter((p) => p.gamesPlayed > 0)
      .sort((a, b) => {
        if (b.elo !== a.elo) return b.elo - a.elo;
        if (b.gamesPlayed !== a.gamesPlayed)
          return b.gamesPlayed - a.gamesPlayed;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 10)
      .map((player, index) => ({
        rank: index + 1,
        ...player,
      }));

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("GET /api/leaderboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard." },
      { status: 500 }
    );
  }
}