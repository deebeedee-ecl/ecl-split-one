import { NextResponse } from "next/server";
import { getFrozenInhouseLeaderboardRows } from "@/lib/inhouse-leaderboard";

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

export async function GET() {
  try {
    const leaderboard = (await getFrozenInhouseLeaderboardRows())
      .slice(0, 10)
      .map((player) => ({
        rank: player.rank,
        name: player.name,
        teamTag: getTeamTag(player.teamName),
        elo: player.elo,
        gamesPlayed: player.gamesPlayed,
        winRate: player.winRate,
        kda: player.kda,
        mvpCount: player.mvpCount,
        streakLabel: player.streak,
      }));

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("GET /api/leaderboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard." },
      { status: 500 },
    );
  }
}
