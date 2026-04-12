import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MatchStage, MatchStatus } from "@prisma/client";

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      orderBy: [
        { scheduledAt: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
      },
    });

    return NextResponse.json(matches);
  } catch (error) {
    console.error("GET /api/matches error:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      homeTeamId,
      awayTeamId,
      stage,
      roundLabel,
      matchLabel,
      bestOf,
      scheduledAt,
      status,
      homeScore,
      awayScore,
      winnerTeamId,
      notes,
    } = body;

    if (!homeTeamId || !awayTeamId) {
      return NextResponse.json(
        { error: "homeTeamId and awayTeamId are required." },
        { status: 400 }
      );
    }

    if (homeTeamId === awayTeamId) {
      return NextResponse.json(
        { error: "A team cannot play against itself." },
        { status: 400 }
      );
    }

    if (!stage || !Object.values(MatchStage).includes(stage)) {
      return NextResponse.json(
        { error: "A valid stage is required." },
        { status: 400 }
      );
    }

    if (
      typeof bestOf !== "number" ||
      ![1, 2, 3, 5].includes(bestOf)
    ) {
      return NextResponse.json(
        { error: "bestOf must be one of: 1, 2, 3, or 5." },
        { status: 400 }
      );
    }

    if (status && !Object.values(MatchStatus).includes(status)) {
      return NextResponse.json(
        { error: "Invalid match status." },
        { status: 400 }
      );
    }

    const homeTeam = await prisma.team.findUnique({
      where: { id: homeTeamId },
    });

    const awayTeam = await prisma.team.findUnique({
      where: { id: awayTeamId },
    });

    if (!homeTeam || !awayTeam) {
      return NextResponse.json(
        { error: "One or both teams do not exist." },
        { status: 400 }
      );
    }

    if (winnerTeamId) {
      const validWinner =
        winnerTeamId === homeTeamId || winnerTeamId === awayTeamId;

      if (!validWinner) {
        return NextResponse.json(
          { error: "winnerTeamId must match one of the two teams." },
          { status: 400 }
        );
      }
    }

    const match = await prisma.match.create({
      data: {
        homeTeamId,
        awayTeamId,
        stage,
        roundLabel: roundLabel || null,
        matchLabel: matchLabel || null,
        bestOf,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: status || MatchStatus.SCHEDULED,
        homeScore: typeof homeScore === "number" ? homeScore : 0,
        awayScore: typeof awayScore === "number" ? awayScore : 0,
        winnerTeamId: winnerTeamId || null,
        notes: notes || null,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
      },
    });

    return NextResponse.json(match, { status: 201 });
  } catch (error) {
    console.error("POST /api/matches error:", error);
    return NextResponse.json(
      { error: "Failed to create match." },
      { status: 500 }
    );
  }
}