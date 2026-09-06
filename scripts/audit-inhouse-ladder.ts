import { STARTING_ELO, calculateLpChange } from "../lib/elo";
import { INHOUSE_MATCH_FILTER } from "../lib/inhouse-filter";
import { getInhouseLeaderboardRows } from "../lib/inhouse-leaderboard";
import { prisma } from "../lib/prisma";

type AuditStat = Awaited<ReturnType<typeof loadInhouseStats>>[number];
type AuditRow = {
  name: string;
  riotId: string;
  games: number;
  record: string;
  storedElo: number;
  expectedElo: number;
  eloDelta: number;
  storedStreak: string;
  expectedStreak: string;
  storedDriftCount: number;
  firstGame: string | null;
  lastGame: string | null;
};

function statTime(stat: AuditStat) {
  return (
    stat.matchGame.match.scheduledAt?.getTime() ??
    stat.matchGame.createdAt.getTime() ??
    stat.createdAt.getTime()
  );
}

async function loadInhouseStats() {
  return prisma.matchGamePlayerStat.findMany({
    where: INHOUSE_MATCH_FILTER,
    include: {
      player: {
        select: {
          id: true,
          name: true,
          riotName: true,
          riotTag: true,
          elo: true,
          winStreak: true,
          lossStreak: true,
        },
      },
      matchGame: {
        include: {
          match: {
            select: {
              id: true,
              roundLabel: true,
              matchLabel: true,
              scheduledAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
}

function riotId(player: { riotName: string | null; riotTag: string | null }) {
  if (!player.riotName) return "-";
  return player.riotTag ? `${player.riotName}#${player.riotTag}` : player.riotName;
}

async function main() {
  const stats = await loadInhouseStats();
  const byPlayer = new Map<string, AuditStat[]>();
  const matchGameIds = new Set(stats.map((stat) => stat.matchGameId));
  const matchIds = new Set(stats.map((stat) => stat.matchGame.match.id));

  for (const stat of stats) {
    byPlayer.set(stat.playerId, [...(byPlayer.get(stat.playerId) ?? []), stat]);
  }

  const rows: AuditRow[] = [];
  const mismatches: AuditRow[] = [];

  for (const playerStats of byPlayer.values()) {
    playerStats.sort((a, b) => {
      const byTime = statTime(a) - statTime(b);
      if (byTime !== 0) return byTime;
      if (a.matchGame.gameNumber !== b.matchGame.gameNumber) {
        return a.matchGame.gameNumber - b.matchGame.gameNumber;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const player = playerStats[0].player;
    let elo = STARTING_ELO;
    let winStreak = 0;
    let lossStreak = 0;
    let wins = 0;
    let losses = 0;
    let storedDriftCount = 0;

    for (let gamesPlayed = 0; gamesPlayed < playerStats.length; gamesPlayed++) {
      const stat = playerStats[gamesPlayed];
      const { lpChange } = calculateLpChange({
        win: stat.isWin,
        kills: stat.kills,
        deaths: stat.deaths,
        assists: stat.assists,
        isMVP: stat.isMVP,
        isSVP: stat.isSVP,
        currentElo: elo,
        gamesPlayed,
        winStreak,
        lossStreak,
      });
      const expectedBefore = elo;
      const expectedAfter = expectedBefore + lpChange;

      if (
        stat.lpChange !== lpChange ||
        stat.eloBefore !== expectedBefore ||
        stat.eloAfter !== expectedAfter
      ) {
        storedDriftCount += 1;
      }

      elo = expectedAfter;
      if (stat.isWin) {
        wins += 1;
        winStreak += 1;
        lossStreak = 0;
      } else {
        losses += 1;
        lossStreak += 1;
        winStreak = 0;
      }
    }

    const finalDrift =
      player.elo !== elo ||
      player.winStreak !== winStreak ||
      player.lossStreak !== lossStreak;
    const row = {
      name: player.name,
      riotId: riotId(player),
      games: playerStats.length,
      record: `${wins}-${losses}`,
      storedElo: player.elo,
      expectedElo: elo,
      eloDelta: player.elo - elo,
      storedStreak: player.winStreak > 0 ? `W${player.winStreak}` : player.lossStreak > 0 ? `L${player.lossStreak}` : "-",
      expectedStreak: winStreak > 0 ? `W${winStreak}` : lossStreak > 0 ? `L${lossStreak}` : "-",
      storedDriftCount,
      firstGame:
        playerStats[0].matchGame.match.roundLabel ??
        playerStats[0].matchGame.match.matchLabel,
      lastGame:
        playerStats[playerStats.length - 1].matchGame.match.roundLabel ??
        playerStats[playerStats.length - 1].matchGame.match.matchLabel,
    };
    rows.push(row);
    if (finalDrift || storedDriftCount > 0) mismatches.push(row);
  }

  rows.sort((a, b) => {
    if (b.expectedElo !== a.expectedElo) return b.expectedElo - a.expectedElo;
    if (b.games !== a.games) return b.games - a.games;
    return a.name.localeCompare(b.name);
  });

  const games = await prisma.matchGame.findMany({
    where: { playerStats: { some: INHOUSE_MATCH_FILTER } },
    include: {
      match: {
        select: {
          roundLabel: true,
          matchLabel: true,
          createdAt: true,
          scheduledAt: true,
        },
      },
      playerStats: {
        select: {
          isWin: true,
          player: {
            select: {
              name: true,
              riotName: true,
              riotTag: true,
            },
          },
        },
      },
      _count: { select: { playerStats: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const gameSummaries = games.map((game) => {
    const winners = game.playerStats.filter((stat) => stat.isWin).length;
    const losers = game.playerStats.length - winners;
    return {
      label: game.match.roundLabel ?? game.match.matchLabel ?? game.id,
      createdAt: game.createdAt,
      playerRows: game._count.playerStats,
      winners,
      losers,
      incomplete: game._count.playerStats !== 10 || winners !== 5 || losers !== 5,
      players: game.playerStats
        .map((stat) => `${stat.player.name} (${riotId(stat.player)})`)
        .sort(),
    };
  });

  const sessions = await prisma.inhouseSession.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      players: {
        select: {
          displayName: true,
          riotName: true,
          riotTag: true,
        },
      },
    },
  });

  const sessionMatchGameIds = sessions
    .map((session) => session.matchGameId)
    .filter((id): id is string => Boolean(id));
  const sessionMatchGames = await prisma.matchGame.findMany({
    where: { id: { in: sessionMatchGameIds } },
    include: {
      playerStats: {
        select: {
          player: {
            select: {
              riotName: true,
              riotTag: true,
            },
          },
        },
      },
    },
  });
  const sessionMatchGameById = new Map(
    sessionMatchGames.map((matchGame) => [matchGame.id, matchGame]),
  );

  const completedSessionSummaries = sessions
    .filter((session) => session.status === "COMPLETED" || session.matchGameId)
    .map((session) => {
      const matchGame = session.matchGameId
        ? sessionMatchGameById.get(session.matchGameId)
        : null;
      const statKeys = new Set(
        (matchGame?.playerStats ?? []).map(
          (stat) => `${stat.player.riotName ?? ""}#${stat.player.riotTag ?? ""}`.toLowerCase(),
        ),
      );
      return {
        label: session.gameLabel ?? session.id,
        status: session.status,
        sessionPlayers: session.players.length,
        statRows: matchGame?.playerStats.length ?? 0,
        missingFromStats: session.players
          .filter((player) => {
            const key = `${player.riotName ?? ""}#${player.riotTag ?? ""}`.toLowerCase();
            return !statKeys.has(key);
          })
          .map((player) => `${player.displayName} (${player.riotName ?? "-"}#${player.riotTag ?? "-"})`),
      };
    });
  const displayedRows = await getInhouseLeaderboardRows();

  console.log(
    JSON.stringify(
      {
        totals: {
          reportedMatches: matchIds.size,
          reportedGames: matchGameIds.size,
          playerRows: stats.length,
          playersWithInhouses: rows.length,
          playersWithMoreThanTwoGames: rows.filter((row) => row.games > 2).length,
          mismatchedPlayers: mismatches.length,
        },
        playersWithMoreThanTwoGames: rows
          .filter((row) => row.games > 2)
          .map((row) => ({
            rankByExpectedElo: rows.indexOf(row) + 1,
            name: row.name,
            riotId: row.riotId,
            games: row.games,
            record: row.record,
            storedElo: row.storedElo,
            expectedElo: row.expectedElo,
          })),
        mismatches,
        gameSummaries,
        completedSessionSummaries,
        displayedLeaderboard: {
          top: displayedRows.slice(0, 20).map((row) => ({
            rank: row.rank,
            name: row.name,
            games: row.gamesPlayed,
            record: `${row.wins}-${row.losses}`,
            elo: row.elo,
          })),
        },
        leaderboardTop: rows.slice(0, 20).map((row, index) => ({
          rank: index + 1,
          name: row.name,
          riotId: row.riotId,
          games: row.games,
          record: row.record,
          expectedElo: row.expectedElo,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
