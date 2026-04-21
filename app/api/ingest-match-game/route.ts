import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLpChange } from "@/lib/elo";

type ParsedPlayer = {
  name?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  gold?: number;
  damage?: number;
  isMVP?: boolean;
  isSVP?: boolean;
};

type ParsedTeamStats = {
  kills?: number;
  gold?: number;
  towers?: number;
  inhibitors?: number;
  barons?: number;
  drakes?: number;
  isWinner?: boolean;
};

function normalizeRiotNameParts(rawName: string) {
  const trimmed = rawName.trim();
  const [name, tag] = trimmed.split("#");

  return {
    riotName: name?.trim() || "",
    riotTag: tag?.trim() || "",
  };
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

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
      include: {
        homeTeam: {
          include: {
            players: true,
          },
        },
        awayTeam: {
          include: {
            players: true,
          },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const homeTeamId = match.homeTeamId;
    const awayTeamId = match.awayTeamId;
    const matchBestOf = match.bestOf;
    const currentHomeScore = match.homeScore;
    const currentAwayScore = match.awayScore;
    const currentStatus = match.status;
    const currentWinnerTeamId = match.winnerTeamId;

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

    const homeRosterKeys = new Set(
      (match.homeTeam?.players ?? []).flatMap((p) => {
        const riotName = p.riotName?.trim();
        const riotTag = p.riotTag?.trim();

        if (!riotName || !riotTag) return [];

        return [`${riotName.toLowerCase()}#${riotTag.toLowerCase()}`];
      })
    );

    const awayRosterKeys = new Set(
      (match.awayTeam?.players ?? []).flatMap((p) => {
        const riotName = p.riotName?.trim();
        const riotTag = p.riotTag?.trim();

        if (!riotName || !riotTag) return [];

        return [`${riotName.toLowerCase()}#${riotTag.toLowerCase()}`];
      })
    );

    function scoreSideAgainstRoster(
      players: ParsedPlayer[],
      rosterKeys: Set<string>
    ) {
      let score = 0;

      for (const p of players) {
        const rawName = typeof p?.name === "string" ? p.name.trim() : "";
        if (!rawName.includes("#")) continue;

        const { riotName, riotTag } = normalizeRiotNameParts(rawName);
        const key = `${riotName.toLowerCase()}#${riotTag.toLowerCase()}`;

        if (rosterKeys.has(key)) {
          score++;
        }
      }

      return score;
    }

    const topSidePlayers = topTeam?.isWinner ? winningPlayers : losingPlayers;
    const bottomSidePlayers = topTeam?.isWinner ? losingPlayers : winningPlayers;

    const topVsHomeScore = scoreSideAgainstRoster(topSidePlayers, homeRosterKeys);
    const topVsAwayScore = scoreSideAgainstRoster(topSidePlayers, awayRosterKeys);
    const bottomVsHomeScore = scoreSideAgainstRoster(
      bottomSidePlayers,
      homeRosterKeys
    );
    const bottomVsAwayScore = scoreSideAgainstRoster(
      bottomSidePlayers,
      awayRosterKeys
    );

    let topTeamId: string | null = null;
    let bottomTeamId: string | null = null;

    if (topVsHomeScore > topVsAwayScore && bottomVsAwayScore >= bottomVsHomeScore) {
      topTeamId = homeTeamId;
      bottomTeamId = awayTeamId;
    } else if (
      topVsAwayScore > topVsHomeScore &&
      bottomVsHomeScore >= bottomVsAwayScore
    ) {
      topTeamId = awayTeamId;
      bottomTeamId = homeTeamId;
    } else {
      return NextResponse.json(
        {
          error: "Could not map screenshot sides to scheduled teams",
          debug: {
            topVsHomeScore,
            topVsAwayScore,
            bottomVsHomeScore,
            bottomVsAwayScore,
          },
        },
        { status: 400 }
      );
    }

    const homeIsTop = topTeamId === homeTeamId;

    const homeTeamStats: ParsedTeamStats = homeIsTop ? topTeam : bottomTeam;
    const awayTeamStats: ParsedTeamStats = homeIsTop ? bottomTeam : topTeam;

    const winnerTeamId = topTeam.isWinner ? topTeamId : bottomTeamId;
    const loserTeamId = winnerTeamId === homeTeamId ? awayTeamId : homeTeamId;

    if (!winnerTeamId || !loserTeamId) {
      return NextResponse.json(
        { error: "Failed to determine winner/loser team IDs" },
        { status: 400 }
      );
    }

    const allPlayers = [
      ...(Array.isArray(winningPlayers) ? winningPlayers : []),
      ...(Array.isArray(losingPlayers) ? losingPlayers : []),
    ];

    const mvpPlayer = allPlayers.find((p: ParsedPlayer) => p?.isMVP);
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
        homeKills: safeNumber(homeTeamStats.kills),
        awayKills: safeNumber(awayTeamStats.kills),
        homeGold: safeNumber(homeTeamStats.gold),
        awayGold: safeNumber(awayTeamStats.gold),
        homeTowers: safeNumber(homeTeamStats.towers),
        awayTowers: safeNumber(awayTeamStats.towers),
        homeInhibitors: safeNumber(homeTeamStats.inhibitors),
        awayInhibitors: safeNumber(awayTeamStats.inhibitors),
        homeBarons: safeNumber(homeTeamStats.barons),
        awayBarons: safeNumber(awayTeamStats.barons),
        homeDrakes: safeNumber(homeTeamStats.drakes),
        awayDrakes: safeNumber(awayTeamStats.drakes),
        mvpName,
        ocrRawJson: body,
      },
      create: {
        matchId,
        gameNumber,
        winnerTeamId,
        durationSeconds,
        homeKills: safeNumber(homeTeamStats.kills),
        awayKills: safeNumber(awayTeamStats.kills),
        homeGold: safeNumber(homeTeamStats.gold),
        awayGold: safeNumber(awayTeamStats.gold),
        homeTowers: safeNumber(homeTeamStats.towers),
        awayTowers: safeNumber(awayTeamStats.towers),
        homeInhibitors: safeNumber(homeTeamStats.inhibitors),
        awayInhibitors: safeNumber(awayTeamStats.inhibitors),
        homeBarons: safeNumber(homeTeamStats.barons),
        awayBarons: safeNumber(awayTeamStats.barons),
        homeDrakes: safeNumber(homeTeamStats.drakes),
        awayDrakes: safeNumber(awayTeamStats.drakes),
        mvpName,
        ocrRawJson: body,
      },
    });

    let matched = 0;
    let skipped = 0;

    async function processPlayer(p: ParsedPlayer) {
      const rawName = typeof p.name === "string" ? p.name.trim() : "";
      const { riotName, riotTag } = normalizeRiotNameParts(rawName);

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

      if (player.teamId !== homeTeamId && player.teamId !== awayTeamId) {
        console.log("⚠️ Not in this match:", p.name);
        skipped++;
        return;
      }

      const teamId = player.teamId;
      const isWin = teamId === winnerTeamId;

      if (!teamId) {
        console.log("⚠️ Player has no teamId:", p.name);
        skipped++;
        return;
      }

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
          kills: safeNumber(p.kills),
          deaths: safeNumber(p.deaths),
          assists: safeNumber(p.assists),
          isMVP: Boolean(p.isMVP),
          isSVP: Boolean(p.isSVP),
          gold: safeNumber(p.gold),
          damage: safeNumber(p.damage),
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
          kills: safeNumber(p.kills),
          deaths: safeNumber(p.deaths),
          assists: safeNumber(p.assists),
          gold: safeNumber(p.gold),
          damage: safeNumber(p.damage),
          isWin,
          isMVP: Boolean(p.isMVP),
          isSVP: Boolean(p.isSVP),
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
          kills: safeNumber(p.kills),
          deaths: safeNumber(p.deaths),
          assists: safeNumber(p.assists),
          gold: safeNumber(p.gold),
          damage: safeNumber(p.damage),
          isWin,
          isMVP: Boolean(p.isMVP),
          isSVP: Boolean(p.isSVP),
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

    for (const p of allPlayers) {
      await processPlayer(p);
    }

    console.log(`✅ Matched: ${matched}, ❌ Skipped: ${skipped}`);

    let homeScore = currentHomeScore;
    let awayScore = currentAwayScore;

    if (isNewGame) {
      homeScore =
        winnerTeamId === homeTeamId ? currentHomeScore + 1 : currentHomeScore;

      awayScore =
        winnerTeamId === awayTeamId ? currentAwayScore + 1 : currentAwayScore;
    }

    let status = currentStatus;
    let finalWinner = currentWinnerTeamId;

    if (matchBestOf === 2) {
      const totalGamesPlayed = homeScore + awayScore;

      if (totalGamesPlayed >= 2) {
        status = "COMPLETED";

        if (homeScore > awayScore) finalWinner = homeTeamId;
        else if (awayScore > homeScore) finalWinner = awayTeamId;
        else finalWinner = null;
      } else {
        status = "SCHEDULED";
        finalWinner = null;
      }
    } else {
      const winsNeeded = Math.ceil(matchBestOf / 2);

      if (homeScore >= winsNeeded) {
        status = "COMPLETED";
        finalWinner = homeTeamId;
      } else if (awayScore >= winsNeeded) {
        status = "COMPLETED";
        finalWinner = awayTeamId;
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
      debug: {
        topTeamId,
        bottomTeamId,
        winnerTeamId,
        homeScore,
        awayScore,
      },
    });
  } catch (err) {
    console.error("INGEST ERROR:", err);
    return NextResponse.json(
      { error: "Failed to ingest match game" },
      { status: 500 }
    );
  }
}