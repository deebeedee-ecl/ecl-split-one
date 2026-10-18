import { prisma } from "@/lib/prisma";
import { STARTING_ELO, calculateLpChange, chinaDayBounds } from "@/lib/elo";
import { getRankedSeason, isRankedInhouse, currentRankedFilter, assertCurrentRankedWrite } from "@/lib/ranked-season";
import { INHOUSE_MATCH_FILTER } from "@/lib/inhouse-filter";

export async function resetGameStats(matchId: string, gameNumber: number) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      games: {
        include: {
          playerStats: true,
        },
        orderBy: {
          gameNumber: "asc",
        },
      },
    },
  });

  if (!match) {
    throw new Error("Match not found.");
  }
  const season = getRankedSeason();
  assertCurrentRankedWrite(match.createdAt, match.roundLabel, season);

  const targetGame = match.games.find((game) => game.gameNumber === gameNumber);

  if (!targetGame) {
    throw new Error("Game not found.");
  }

  if (targetGame.playerStats.length === 0) {
    return {
      success: true,
      deletedStats: 0,
      recalculatedPlayers: 0,
      message: `Game ${gameNumber} has no player stats to reset.`,
    };
  }

  const affectedPlayerIds = [...new Set(targetGame.playerStats.map((stat) => stat.playerId))];

  await prisma.$transaction(async (tx) => {
    // 1) Delete this game's player stat rows
    await tx.matchGamePlayerStat.deleteMany({
      where: {
        matchGameId: targetGame.id,
      },
    });

    // 2) Reset affected players to clean baseline first
    await tx.player.updateMany({
      where: {
        id: {
          in: affectedPlayerIds,
        },
      },
      data: {
        elo: STARTING_ELO,
        winStreak: 0,
        lossStreak: 0,
      },
    });

    // 3) Recalculate all remaining stats for affected players in original creation order
    for (const playerId of affectedPlayerIds) {
      const remainingStats = await tx.matchGamePlayerStat.findMany({
        where: {
          playerId,
          ...(season ? isRankedInhouse(match.roundLabel) ? currentRankedFilter(season) : { NOT: INHOUSE_MATCH_FILTER } : {}),
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      let currentElo = STARTING_ELO;
      let currentWinStreak = 0;
      let currentLossStreak = 0;
      let gamesPlayed = 0;

      for (const stat of remainingStats) {
        const { lpChange } = calculateLpChange({
          win: stat.isWin,
          kills: stat.kills,
          deaths: stat.deaths,
          assists: stat.assists,
          isMVP: stat.isMVP,
          isSVP: stat.isSVP,
          currentElo,
          gamesPlayed,
          winStreak: currentWinStreak,
          lossStreak: currentLossStreak,
          ...(season && isRankedInhouse(match.roundLabel) ? { playedAt: stat.createdAt, lastPlayedAt: remainingStats[gamesPlayed - 1]?.createdAt, doubleLpEligible: true, hasPlayedOnDoubleLpDay: !!remainingStats[gamesPlayed - 1] && remainingStats[gamesPlayed - 1].createdAt >= chinaDayBounds(stat.createdAt).start } : {}),
        });

        const eloBefore = currentElo;
        const eloAfter = currentElo + lpChange;

        await tx.matchGamePlayerStat.update({
          where: { id: stat.id },
          data: {
            lpChange,
            eloBefore,
            eloAfter,
          },
        });

        currentElo = eloAfter;

        if (stat.isWin) {
          currentWinStreak += 1;
          currentLossStreak = 0;
        } else {
          currentLossStreak += 1;
          currentWinStreak = 0;
        }
        gamesPlayed += 1;
      }

      await tx.player.update({
        where: { id: playerId },
        data: {
          elo: currentElo,
          winStreak: currentWinStreak,
          lossStreak: currentLossStreak,
        },
      });
    }
  });

  return {
    success: true,
    deletedStats: targetGame.playerStats.length,
    recalculatedPlayers: affectedPlayerIds.length,
    message: `Game ${gameNumber} player stats were reset successfully.`,
  };
}
