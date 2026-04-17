import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type StandingRow = {
  teamId: string;
  teamName: string;
  played: number;
  points: number;
  gameW: number;
  gameL: number;
  diff: number;
};

function createRow(
  teamId: string,
  teamName: string
): StandingRow {
  return {
    teamId,
    teamName,
    played: 0,
    points: 0,
    gameW: 0,
    gameL: 0,
    diff: 0,
  };
}

// BO2 logic
function getPoints(w: number, l: number) {
  if (w === 2 && l === 0) return 2;
  if (w === 1 && l === 1) return 1;
  return 0;
}

export async function GET() {
  try {
    const [teams, matches] = await Promise.all([
      prisma.team.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.match.findMany({
        where: {
          stage: "REGULAR_SEASON",
          status: {
            in: ["COMPLETED", "FORFEIT"],
          },
        },
      }),
    ]);

    const table = new Map<string, StandingRow>();

    for (const team of teams) {
      table.set(team.id, createRow(team.id, team.name));
    }

    for (const match of matches) {
      const home = table.get(match.homeTeamId);
      const away = table.get(match.awayTeamId);

      if (!home || !away) continue;

      home.played += 1;
      away.played += 1;

      home.gameW += match.homeScore;
      home.gameL += match.awayScore;

      away.gameW += match.awayScore;
      away.gameL += match.homeScore;

      home.points += getPoints(match.homeScore, match.awayScore);
      away.points += getPoints(match.awayScore, match.homeScore);
    }

    const standings = Array.from(table.values())
      .map((team) => ({
        ...team,
        diff: team.gameW - team.gameL,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.diff !== a.diff) return b.diff - a.diff;
        if (b.gameW !== a.gameW) return b.gameW - a.gameW;
        return a.teamName.localeCompare(b.teamName);
      })
      .map((team, index) => ({
        rank: index + 1,
        teamName: team.teamName,
        played: team.played,
        points: team.points,
        gameW: team.gameW,
        gameL: team.gameL,
        diff: team.diff,
      }));

    return NextResponse.json(standings);
  } catch (error) {
    console.error("GET /api/standings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch standings." },
      { status: 500 }
    );
  }
}