import { STARTING_ELO, calculateLpChange } from "../lib/elo";
import { INHOUSE_MATCH_FILTER } from "../lib/inhouse-filter";
import { prisma } from "../lib/prisma";

type RepairStat = Awaited<ReturnType<typeof loadInhouseStats>>[number];

async function loadInhouseStats() {
  return prisma.matchGamePlayerStat.findMany({
    where: INHOUSE_MATCH_FILTER,
    include: {
      player: {
        select: {
          id: true,
          name: true,
          elo: true,
          winStreak: true,
          lossStreak: true,
        },
      },
      matchGame: {
        select: {
          gameNumber: true,
          createdAt: true,
          match: {
            select: {
              scheduledAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
}

function statTime(stat: RepairStat) {
  return (
    stat.matchGame.match.scheduledAt?.getTime() ??
    stat.matchGame.createdAt.getTime() ??
    stat.createdAt.getTime()
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const stats = await loadInhouseStats();
  const byPlayer = new Map<string, RepairStat[]>();

  for (const stat of stats) {
    byPlayer.set(stat.playerId, [...(byPlayer.get(stat.playerId) ?? []), stat]);
  }

  let touchedPlayers = 0;
  let touchedStats = 0;
  const changes = [];

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
    const updates = [];

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
      const eloBefore = elo;
      const eloAfter = eloBefore + lpChange;

      if (
        stat.lpChange !== lpChange ||
        stat.eloBefore !== eloBefore ||
        stat.eloAfter !== eloAfter
      ) {
        touchedStats += 1;
        updates.push(
          prisma.matchGamePlayerStat.update({
            where: { id: stat.id },
            data: { lpChange, eloBefore, eloAfter },
          }),
        );
      }

      elo = eloAfter;
      if (stat.isWin) {
        winStreak += 1;
        lossStreak = 0;
      } else {
        lossStreak += 1;
        winStreak = 0;
      }
    }

    if (
      player.elo !== elo ||
      player.winStreak !== winStreak ||
      player.lossStreak !== lossStreak
    ) {
      touchedPlayers += 1;
      changes.push({
        player: player.name,
        from: {
          elo: player.elo,
          winStreak: player.winStreak,
          lossStreak: player.lossStreak,
        },
        to: { elo, winStreak, lossStreak },
      });
      updates.push(
        prisma.player.update({
          where: { id: player.id },
          data: { elo, winStreak, lossStreak },
        }),
      );
    }

    if (!dryRun && updates.length > 0) {
      await prisma.$transaction(updates);
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        playersChecked: byPlayer.size,
        touchedPlayers,
        touchedStats,
        changes,
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
