import { STARTING_ELO, calculateLpChange } from "../lib/elo";
import { prisma } from "../lib/prisma";

async function main() {
  const finalsOnly = process.argv.includes("--finals-only");
  const riotTagsArg = process.argv.find((arg) => arg.startsWith("--riot-tags="));
  const riotTags =
    riotTagsArg
      ?.slice("--riot-tags=".length)
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean) ?? [];
  const finalsMatch = finalsOnly
    ? await prisma.match.findFirst({
        where: {
          stage: "FINALS",
          homeTeam: { name: "Exiled Bunzz" },
          awayTeam: { name: "niuniupower" },
        },
        include: {
          games: {
            include: {
              playerStats: {
                select: {
                  playerId: true,
                },
              },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      })
    : null;

  const finalsPlayerIds =
    finalsMatch?.games.flatMap((game) =>
      game.playerStats.map((stat) => stat.playerId)
    ) ?? [];

  const players = await prisma.player.findMany({
    where: {
      gameStats: {
        some: {},
      },
      ...(finalsOnly
        ? {
            id: {
              in: [...new Set(finalsPlayerIds)],
            },
          }
        : {}),
      ...(riotTags.length > 0
        ? {
            riotTag: {
              in: riotTags,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  let updatedPlayers = 0;
  let updatedStats = 0;

  for (const player of players) {
    const stats = await prisma.matchGamePlayerStat.findMany({
      where: {
        playerId: player.id,
      },
      include: {
        matchGame: {
          include: {
            match: true,
          },
        },
      },
    });

    stats.sort((a, b) => {
      const aTime =
        a.matchGame.match.scheduledAt?.getTime() ??
        a.matchGame.match.createdAt.getTime();
      const bTime =
        b.matchGame.match.scheduledAt?.getTime() ??
        b.matchGame.match.createdAt.getTime();

      if (aTime !== bTime) return aTime - bTime;
      if (a.matchGame.gameNumber !== b.matchGame.gameNumber) {
        return a.matchGame.gameNumber - b.matchGame.gameNumber;
      }

      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    let elo = STARTING_ELO;
    let winStreak = 0;
    let lossStreak = 0;
    let gamesPlayed = 0;
    const updates = [];

    for (const stat of stats) {
      const { lpChange } = calculateLpChange({
        win: stat.isWin,
        kills: stat.kills,
        deaths: stat.deaths,
        assists: stat.assists,
        isMVP: stat.isMVP,
        isSVP: stat.isSVP,
        gold: stat.gold ?? undefined,
        damage: stat.damage ?? undefined,
        currentElo: elo,
        gamesPlayed,
        winStreak,
        lossStreak,
      });

      const eloBefore = elo;
      const eloAfter = eloBefore + lpChange;

      updates.push(
        prisma.matchGamePlayerStat.update({
          where: {
            id: stat.id,
          },
          data: {
            lpChange,
            eloBefore,
            eloAfter,
          },
        })
      );

      updatedStats += 1;
      elo = eloAfter;

      if (stat.isWin) {
        winStreak += 1;
        lossStreak = 0;
      } else {
        lossStreak += 1;
        winStreak = 0;
      }
      gamesPlayed += 1;
    }

    updates.push(
      prisma.player.update({
        where: {
          id: player.id,
        },
        data: {
          elo,
          winStreak,
          lossStreak,
        },
      })
    );

    await prisma.$transaction(updates);

    updatedPlayers += 1;
  }

  console.log(JSON.stringify({ updatedPlayers, updatedStats }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
