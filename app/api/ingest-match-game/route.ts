import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLpChange } from "@/lib/elo";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      matchId,
      gameNumber,
      topTeam,
      bottomTeam,
      winningPlayers,
      losingPlayers,
      durationMinutes,
    } = body;

    if (!matchId || gameNumber === undefined) {
      return NextResponse.json(
        { error: "Missing matchId or gameNumber" },
        { status: 400 }
      );
    }

    if (!topTeam || !bottomTeam) {
      return NextResponse.json(
        { error: "Missing topTeam or bottomTeam" },
        { status: 400 }
      );
    }

    if (!Array.isArray(winningPlayers) || !Array.isArray(losingPlayers)) {
      return NextResponse.json(
        { error: "winningPlayers and losingPlayers must be arrays" },
        { status: 400 }
      );
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const existingGame = await prisma.matchGame.findUnique({
      where: {
        matchId_gameNumber: {
          matchId,
          gameNumber,
        },
      },
      select: {
        id: true,
        winnerTeamId: true,
      },
    });

    const isNewGame = !existingGame;

    const homeIsTop = true;

    const homeTeamStats = homeIsTop ? topTeam : bottomTeam;
    const awayTeamStats = homeIsTop ? bottomTeam : topTeam;

    const winnerTeamId = homeTeamStats.isWinner
      ? match.homeTeamId
      : match.awayTeamId;

    const loserTeamId =
      winnerTeamId === match.homeTeamId
        ? match.awayTeamId
        : match.homeTeamId;

    const allPlayers = [
      ...(Array.isArray(winningPlayers) ? winningPlayers : []),
      ...(Array.isArray(losingPlayers) ? losingPlayers : []),
    ];

    const mvpPlayer = allPlayers.find((p: any) => p?.isMVP);
    const mvpName = mvpPlayer?.name ?? null;

    const safeDurationMinutes =
      typeof durationMinutes === "number" &&
      Number.isFinite(durationMinutes) &&
      durationMinutes >= 0
        ? Math.floor(durationMinutes)
        : null;

    const durationSeconds =
      safeDurationMinutes !== null ? safeDurationMinutes * 60 : null;

    const game = await prisma.matchGame.upsert({
      where: {
        matchId_gameNumber: {
          matchId,
          gameNumber,
        },
      },
      update: {
        winnerTeamId,
        durationSeconds,
        homeKills: homeTeamStats.kills,
        awayKills: awayTeamStats.kills,
        homeGold: homeTeamStats.gold,
        awayGold: awayTeamStats.gold,
        homeTowers: homeTeamStats.towers,
        awayTowers: awayTeamStats.towers,
        homeInhibitors: homeTeamStats.inhibitors,
        awayInhibitors: awayTeamStats.inhibitors,
        homeBarons: homeTeamStats.barons,
        awayBarons: awayTeamStats.barons,
        homeDrakes: homeTeamStats.drakes,
        awayDrakes: awayTeamStats.drakes,
        mvpName,
        ocrRawJson: body,
      },
      create: {
        matchId,
        gameNumber,
        winnerTeamId,
        durationSeconds,
        homeKills: homeTeamStats.kills,
        awayKills: awayTeamStats.kills,
        homeGold: homeTeamStats.gold,
        awayGold: awayTeamStats.gold,
        homeTowers: homeTeamStats.towers,
        awayTowers: awayTeamStats.towers,
        homeInhibitors: homeTeamStats.inhibitors,
        awayInhibitors: awayTeamStats.inhibitors,
        homeBarons: homeTeamStats.barons,
        awayBarons: awayTeamStats.barons,
        homeDrakes: homeTeamStats.drakes,
        awayDrakes: awayTeamStats.drakes,
        mvpName,
        ocrRawJson: body,
      },
    });

    let matched = 0;
    let skipped = 0;

    async function processPlayer(p: any) {
      const rawName = typeof p.name === "string" ? p.name.trim() : "";
      const [parsedRiotName, parsedRiotTag] = rawName.split("#");

      const riotName = parsedRiotName?.trim();
      const riotTag = parsedRiotTag?.trim();

      if (!riotName || !riotTag) {
        console.log("❌ Invalid tag:", p.name);
        skipped++;
        return;
      }

      const player = await prisma.player.findFirst({
        where: {
          riotName,
          riotTag,
        },
      });

      if (!player) {
        console.log("⚠️ Not in DB:", p.name);
        skipped++;
        return;
      }

      // 🔥 NEW: roster validation
      if (
        player.teamId !== match.homeTeamId &&
        player.teamId !== match.awayTeamId
      ) {
        console.log("⚠️ Not in this match:", p.name);
        skipped++;
        return;
      }

      const teamId = player.teamId!;
      const isWin = teamId === winnerTeamId;

      matched++;

      const existingStat = await prisma.matchGamePlayerStat.findUnique({
        where: {
          matchGameId_playerId: {
            matchGameId: game.id,
            playerId: player.id,
          },
        },
        select: { id: true },
      });

      const isNewStat = !existingStat;

      let lpChange = 0;
      let eloBefore = player.elo;
      let eloAfter = player.elo;

      if (isNewStat) {
        const eloResult = calculateLpChange({
          win: isWin,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          isMVP: p.isMVP,
          isSVP: p.isSVP,
          gold: p.gold,
          damage: p.damage,
          winStreak: player.winStreak,
          lossStreak: player.lossStreak,
        });

        lpChange = eloResult.lpChange;
        eloAfter = player.elo + lpChange;
      }

      await prisma.matchGamePlayerStat.upsert({
        where: {
          matchGameId_playerId: {
            matchGameId: game.id,
            playerId: player.id,
          },
        },
        update: {
          teamId,
          riotName,
          riotTag,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          gold: p.gold,
          damage: p.damage,
          isWin,
          isMVP: p.isMVP,
          isSVP: p.isSVP,
          lpChange,
          eloBefore,
          eloAfter,
        },
        create: {
          matchGameId: game.id,
          playerId: player.id,
          teamId,
          riotName,
          riotTag,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          gold: p.gold,
          damage: p.damage,
          isWin,
          isMVP: p.isMVP,
          isSVP: p.isSVP,
          lpChange,
          eloBefore,
          eloAfter,
        },
      });

      if (isNewStat) {
        await prisma.player.update({
          where: { id: player.id },
          data: {
            elo: eloAfter,
            winStreak: isWin ? player.winStreak + 1 : 0,
            lossStreak: isWin ? 0 : player.lossStreak + 1,
          },
        });
      }
    }

    // 🔥 Changed: process ALL players together
    for (const p of allPlayers) {
      await processPlayer(p);
    }

    console.log(`✅ Matched: ${matched}, ❌ Skipped: ${skipped}`);

    let homeScore = match.homeScore;
    let awayScore = match.awayScore;

    if (isNewGame) {
      homeScore =
        winnerTeamId === match.homeTeamId
          ? match.homeScore + 1
          : match.homeScore;

      awayScore =
        winnerTeamId === match.awayTeamId
          ? match.awayScore + 1
          : match.awayScore;
    }

    let status = match.status;
    let finalWinner = match.winnerTeamId;

    if (match.bestOf === 2) {
      const totalGamesPlayed = homeScore + awayScore;

      if (totalGamesPlayed >= 2) {
        status = "COMPLETED";

        if (homeScore > awayScore) finalWinner = match.homeTeamId;
        else if (awayScore > homeScore) finalWinner = match.awayTeamId;
        else finalWinner = null;
      } else {
        status = "SCHEDULED";
        finalWinner = null;
      }
    } else {
      const winsNeeded = Math.ceil(match.bestOf / 2);

      if (homeScore >= winsNeeded) {
        status = "COMPLETED";
        finalWinner = match.homeTeamId;
      } else if (awayScore >= winsNeeded) {
        status = "COMPLETED";
        finalWinner = match.awayTeamId;
      }
    }

    await prisma.match.update({
      where: { id: matchId },
      data: {
        homeScore,
        awayScore,
        status,
        winnerTeamId: finalWinner,
      },
    });

    return NextResponse.json({
      success: true,
      gameId: game.id,
      isNewGame,
      matchedPlayers: matched,
      skippedPlayers: skipped,
    });
  } catch (err) {
    console.error("INGEST ERROR:", err);
    return NextResponse.json(
      { error: "Failed to ingest match game" },
      { status: 500 }
    );
  }
}