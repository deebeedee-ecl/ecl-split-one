import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MatchStage, MatchStatus } from "@prisma/client";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
      },
    });

    if (!match) {
      return NextResponse.json(
        { error: "Match not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(match);
  } catch (error) {
    console.error("GET /api/matches/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch match." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existingMatch = await prisma.match.findUnique({
      where: { id },
    });

    if (!existingMatch) {
      return NextResponse.json(
        { error: "Match not found." },
        { status: 404 }
      );
    }

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

    const nextHomeTeamId = homeTeamId ?? existingMatch.homeTeamId;
    const nextAwayTeamId = awayTeamId ?? existingMatch.awayTeamId;

    if (nextHomeTeamId === nextAwayTeamId) {
      return NextResponse.json(
        { error: "A team cannot play against itself." },
        { status: 400 }
      );
    }

    if (stage && !Object.values(MatchStage).includes(stage)) {
      return NextResponse.json(
        { error: "Invalid stage." },
        { status: 400 }
      );
    }

    if (
      bestOf !== undefined &&
      (typeof bestOf !== "number" || ![1, 2, 3, 5].includes(bestOf))
    ) {
      return NextResponse.json(
        { error: "bestOf must be one of: 1, 2, 3, or 5." },
        { status: 400 }
      );
    }

    if (status && !Object.values(MatchStatus).includes(status)) {
      return NextResponse.json(
        { error: "Invalid status." },
        { status: 400 }
      );
    }

    if (homeTeamId) {
      const homeTeam = await prisma.team.findUnique({
        where: { id: homeTeamId },
      });

      if (!homeTeam) {
        return NextResponse.json(
          { error: "New home team does not exist." },
          { status: 400 }
        );
      }
    }

    if (awayTeamId) {
      const awayTeam = await prisma.team.findUnique({
        where: { id: awayTeamId },
      });

      if (!awayTeam) {
        return NextResponse.json(
          { error: "New away team does not exist." },
          { status: 400 }
        );
      }
    }

    const finalWinnerTeamId =
      winnerTeamId === null
        ? null
        : winnerTeamId ?? existingMatch.winnerTeamId;

    if (
      finalWinnerTeamId &&
      finalWinnerTeamId !== nextHomeTeamId &&
      finalWinnerTeamId !== nextAwayTeamId
    ) {
      return NextResponse.json(
        { error: "winnerTeamId must match one of the two teams." },
        { status: 400 }
      );
    }

    const updatedMatch = await prisma.match.update({
      where: { id },
      data: {
        homeTeamId: nextHomeTeamId,
        awayTeamId: nextAwayTeamId,
        stage: stage ?? existingMatch.stage,
        roundLabel:
          roundLabel !== undefined ? roundLabel || null : existingMatch.roundLabel,
        matchLabel:
          matchLabel !== undefined ? matchLabel || null : existingMatch.matchLabel,
        bestOf: bestOf ?? existingMatch.bestOf,
        scheduledAt:
          scheduledAt !== undefined
            ? scheduledAt
              ? new Date(scheduledAt)
              : null
            : existingMatch.scheduledAt,
        status: status ?? existingMatch.status,
        homeScore:
          homeScore !== undefined ? homeScore : existingMatch.homeScore,
        awayScore:
          awayScore !== undefined ? awayScore : existingMatch.awayScore,
        winnerTeamId: finalWinnerTeamId,
        notes: notes !== undefined ? notes || null : existingMatch.notes,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
      },
    });

    return NextResponse.json(updatedMatch);
  } catch (error) {
    console.error("PATCH /api/matches/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update match." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const existingMatch = await prisma.match.findUnique({
      where: { id },
    });

    if (!existingMatch) {
      return NextResponse.json(
        { error: "Match not found." },
        { status: 404 }
      );
    }

    await prisma.match.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/matches/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete match." },
      { status: 500 }
    );
  }
}