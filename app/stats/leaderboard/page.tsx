import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getTeamTag(teamName?: string | null) {
  if (!teamName) return "FA";

  const words = teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "FA";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();

  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function getRowStyles(rank: number) {
  if (rank === 0) {
    return "bg-yellow-400/[0.08] shadow-[inset_0_0_0_1px_rgba(250,204,21,0.20)]";
  }
  if (rank === 1) {
    return "bg-zinc-300/[0.07] shadow-[inset_0_0_0_1px_rgba(212,212,216,0.16)]";
  }
  if (rank === 2) {
    return "bg-amber-700/[0.10] shadow-[inset_0_0_0_1px_rgba(180,83,9,0.24)]";
  }
  return "";
}

function getRankTextStyles(rank: number) {
  if (rank === 0) return "text-yellow-300";
  if (rank === 1) return "text-zinc-200";
  if (rank === 2) return "text-amber-500";
  return "text-white";
}

function getRankBadge(rank: number) {
  if (rank === 0) return "👑";
  if (rank === 1) return "🥈";
  if (rank === 2) return "🥉";
  return null;
}

function formatWinRate(wins: number, gamesPlayed: number) {
  if (gamesPlayed === 0) return "—";
  return `${Math.round((wins / gamesPlayed) * 100)}%`;
}

function formatKDA(kills: number, deaths: number, assists: number) {
  if (kills === 0 && deaths === 0 && assists === 0) return "—";
  const kda = (kills + assists) / Math.max(1, deaths);
  return kda.toFixed(2);
}

export default async function LeaderboardPage() {
  const players = await prisma.player.findMany({
    include: {
      team: true,
      gameStats: true,
    },
  });

  const leaderboard = players
    .map((player) => {
      const teamTag = getTeamTag(player.team?.name);

      const gamesPlayed = player.gameStats.length;
      const wins = player.gameStats.filter((stat) => stat.isWin).length;
      const mvpCount = player.gameStats.filter((stat) => stat.isMVP).length;

      const totalKills = player.gameStats.reduce((sum, stat) => sum + stat.kills, 0);
      const totalDeaths = player.gameStats.reduce((sum, stat) => sum + stat.deaths, 0);
      const totalAssists = player.gameStats.reduce((sum, stat) => sum + stat.assists, 0);

      let streakLabel = "—";
      if (player.winStreak > 0) {
        streakLabel = `W${player.winStreak}`;
      } else if (player.lossStreak > 0) {
        streakLabel = `L${player.lossStreak}`;
      }

      return {
        id: player.id,
        name: player.name,
        riotLine:
          player.riotName || player.riotTag
            ? [player.riotName, player.riotTag].filter(Boolean).join("#")
            : null,
        teamTag,
        elo: player.elo,
        gamesPlayed,
        wins,
        winRate: formatWinRate(wins, gamesPlayed),
        kda: formatKDA(totalKills, totalDeaths, totalAssists),
        mvpCount,
        streakLabel,
      };
    })
    .sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return a.name.localeCompare(b.name);
    });

  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/stats"
          className="mb-6 inline-flex items-center text-sm font-semibold text-white/60 transition hover:text-green-400"
        >
          ← Back to Stats
        </Link>

        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          Expat China League
        </p>

        <h1 className="mt-4 text-5xl font-black uppercase tracking-tight md:text-7xl">
          Leaderboard
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
          Live player rankings based on current ELO, match performance, and
          recorded game stats. Unsigned players are shown as [FA].
        </p>

        <div className="mt-10 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.2em] text-white/50">
                <th className="px-4 py-4 text-left">Rank</th>
                <th className="px-4 py-4 text-left">Player</th>
                <th className="px-4 py-4 text-center">Team</th>
                <th className="px-4 py-4 text-center">ELO</th>
                <th className="px-4 py-4 text-center">GP</th>
                <th className="px-4 py-4 text-center">WR</th>
                <th className="px-4 py-4 text-center">KDA</th>
                <th className="px-4 py-4 text-center">MVP</th>
                <th className="px-4 py-4 text-center">Streak</th>
              </tr>
            </thead>

            <tbody>
              {leaderboard.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-sm text-white/50"
                  >
                    No players found yet.
                  </td>
                </tr>
              ) : (
                leaderboard.map((player, i) => {
                  const badge = getRankBadge(i);

                  return (
                    <tr
                      key={player.id}
                      className={`border-b border-white/[0.06] transition hover:bg-green-400/[0.06] ${getRowStyles(i)}`}
                    >
                      <td
                        className={`px-4 py-4 text-lg font-black ${getRankTextStyles(i)}`}
                      >
                        <div className="flex items-center gap-2">
                          <span>#{i + 1}</span>
                          {badge ? <span className="text-base">{badge}</span> : null}
                        </div>
                      </td>

                      <td className="px-4 py-4 font-semibold text-white">
                        <div className="flex flex-col">
                          <span>{player.name}</span>
                          {player.riotLine ? (
                            <span className="text-xs font-medium text-white/40">
                              {player.riotLine}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center text-white/70">
                        [{player.teamTag}]
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-green-400">
                        {player.elo}
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-white">
                        {player.gamesPlayed}
                      </td>

                      <td className="px-4 py-4 text-center text-white">
                        {player.winRate}
                      </td>

                      <td className="px-4 py-4 text-center text-white">
                        {player.kda}
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-yellow-400">
                        {player.mvpCount}
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-white">
                        {player.streakLabel}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}