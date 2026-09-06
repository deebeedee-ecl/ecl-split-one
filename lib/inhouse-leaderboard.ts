import { STARTING_ELO } from "@/lib/elo";
import { INHOUSE_MATCH_FILTER } from "@/lib/inhouse-filter";
import { prisma } from "@/lib/prisma";

export type InhouseLeaderboardRow = {
  rank: number;
  playerId: string;
  name: string;
  riotName: string | null;
  riotTag: string | null;
  elo: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: string;
  streak: string;
  teamName: string | null;
  kda: string;
  mvpCount: number;
};

function inhouseStreak(stats: { isWin: boolean }[]): string {
  let w = 0;
  let l = 0;

  for (const stat of stats) {
    if (stat.isWin) {
      if (l > 0) break;
      w++;
    } else {
      if (w > 0) break;
      l++;
    }
  }

  return w > 0 ? `W${w}` : l > 0 ? `L${l}` : "-";
}

function fallbackElo(
  stats: { lpChange: number }[],
  startingElo = STARTING_ELO,
) {
  return stats
    .slice()
    .reverse()
    .reduce((elo, stat) => elo + stat.lpChange, startingElo);
}

function formatKda(kills: number, deaths: number, assists: number) {
  if (kills === 0 && deaths === 0 && assists === 0) return "-";
  return ((kills + assists) / Math.max(1, deaths)).toFixed(2);
}

export async function getInhouseLeaderboardRows() {
  const players = await prisma.player.findMany({
    include: {
      team: {
        select: {
          name: true,
        },
      },
      gameStats: {
        where: INHOUSE_MATCH_FILTER,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return players
    .map((player) => {
      const gamesPlayed = player.gameStats.length;
      const wins = player.gameStats.filter((stat) => stat.isWin).length;
      const losses = gamesPlayed - wins;
      const winRate = gamesPlayed === 0 ? "-" : `${Math.round((wins / gamesPlayed) * 100)}%`;
      const latestStat = player.gameStats[0];
      const elo = latestStat?.eloAfter ?? fallbackElo(player.gameStats);
      const streak = inhouseStreak(player.gameStats);
      const totalKills = player.gameStats.reduce((sum, stat) => sum + stat.kills, 0);
      const totalDeaths = player.gameStats.reduce((sum, stat) => sum + stat.deaths, 0);
      const totalAssists = player.gameStats.reduce((sum, stat) => sum + stat.assists, 0);
      const mvpCount = player.gameStats.filter((stat) => stat.isMVP).length;

      return {
        rank: 0,
        playerId: player.id,
        name: player.name,
        riotName: player.riotName,
        riotTag: player.riotTag,
        elo,
        wins,
        losses,
        gamesPlayed,
        winRate,
        streak,
        teamName: player.team?.name ?? null,
        kda: formatKda(totalKills, totalDeaths, totalAssists),
        mvpCount,
      };
    })
    .filter((row) => row.gamesPlayed > 0)
    .sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return a.name.localeCompare(b.name);
    })
    .map((row, index): InhouseLeaderboardRow => ({
      ...row,
      rank: index + 1,
    }));
}

export const getFrozenInhouseLeaderboardRows = getInhouseLeaderboardRows;
