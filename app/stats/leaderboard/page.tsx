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

export default async function LeaderboardPage() {
  const players = await prisma.player.findMany({
    include: {
      team: true,
    },
    orderBy: [
      { elo: "desc" },
      { name: "asc" },
    ],
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
          Live player rankings based on current ELO. Unsigned players are shown
          as [FA].
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
                <th className="px-4 py-4 text-center">Streak</th>
              </tr>
            </thead>

            <tbody>
              {players.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-white/50"
                  >
                    No players found yet.
                  </td>
                </tr>
              ) : (
                players.map((player, i) => {
                  const badge = getRankBadge(i);
                  const teamTag = getTeamTag(player.team?.name);
                  const gamesPlayed = 0;
                  const winRate = "—";

                  let streakLabel = "—";
                  if (player.winStreak > 0) {
                    streakLabel = `W${player.winStreak}`;
                  } else if (player.lossStreak > 0) {
                    streakLabel = `L${player.lossStreak}`;
                  }

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
                          {(player.riotName || player.riotTag) && (
                            <span className="text-xs font-medium text-white/40">
                              {[player.riotName, player.riotTag]
                                .filter(Boolean)
                                .join("#")}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center text-white/70">
                        [{teamTag}]
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-green-400">
                        {player.elo}
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-white">
                        {gamesPlayed}
                      </td>

                      <td className="px-4 py-4 text-center text-white">
                        {winRate}
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-white">
                        {streakLabel}
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