import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLpChange } from "@/lib/elo";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      matchGameId,
      playerId,
      teamId,
      kills,
      deaths,
      assists,
      isMVP = false,
    } = body;

    // Basic validation
    if (!matchGameId || !playerId || !teamId) {
      return NextResponse.json(
        { error: "Missing required fields: matchGameId, playerId, or teamId" },
        { status: 400 }
      );
    }

    if (
      kills === undefined ||
      deaths === undefined ||
      assists === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required stat fields: kills, deaths, assists" },
        { status: 400 }
      );
    }

    const numericKills = Number(kills);
    const numericDeaths = Number(deaths);
    const numericAssists = Number(assists);

    if (
      Number.isNaN(numericKills) ||
      Number.isNaN(numericDeaths) ||
      Number.isNaN(numericAssists)
    ) {
      return NextResponse.json(
        { error: "Kills, deaths, and assists must be valid numbers" },
        { status: 400 }
      );
    }

    // Get player
    const player = await prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Get match game so we can auto-detect win/loss
    const matchGame = await prisma.matchGame.findUnique({
      where: { id: matchGameId },
    });

    if (!matchGame) {
      return NextResponse.json({ error: "Match game not found" }, { status: 404 });
    }

    if (!matchGame.winnerTeamId) {
      return NextResponse.json(
        { error: "This game does not have a winner set yet" },
        { status: 400 }
      );
    }

    const isWin = teamId === matchGame.winnerTeamId;

    // Duplicate protection
    const existingStat = await prisma.matchGamePlayerStat.findUnique({
      where: {
        matchGameId_playerId: {
          matchGameId,
          playerId,
        },
      },
    });

    if (existingStat) {
      return NextResponse.json(
        {
          error: "Stats for this player in this game already exist",
          existingStatId: existingStat.id,
        },
        { status: 409 }
      );
    }

    const { lpChange } = calculateLpChange({
      win: isWin,
      kills: numericKills,
      deaths: numericDeaths,
      assists: numericAssists,
      isMVP,
      winStreak: player.winStreak,
      lossStreak: player.lossStreak,
    });

    const newElo = player.elo + lpChange;

    // Update streaks
    let newWinStreak = player.winStreak;
    let newLossStreak = player.lossStreak;

    if (isWin) {
      newWinStreak += 1;
      newLossStreak = 0;
    } else {
      newLossStreak += 1;
      newWinStreak = 0;
    }

    await prisma.matchGamePlayerStat.create({
      data: {
        matchGameId,
        playerId,
        teamId,
        kills: numericKills,
        deaths: numericDeaths,
        assists: numericAssists,
        isMVP,
        isWin,
        lpChange,
        eloBefore: player.elo,
        eloAfter: newElo,
      },
    });

    await prisma.player.update({
      where: { id: playerId },
      data: {
        elo: newElo,
        winStreak: newWinStreak,
        lossStreak: newLossStreak,
      },
    });

    return NextResponse.json({
      success: true,
      isWin,
      lpChange,
      eloBefore: player.elo,
      eloAfter: newElo,
      winStreak: newWinStreak,
      lossStreak: newLossStreak,
    });
  } catch (err) {
    console.error("POST /api/match-game-player-stat error:", err);
    return NextResponse.json(
      { error: "Failed to create player stat" },
      { status: 500 }
    );
  }
}