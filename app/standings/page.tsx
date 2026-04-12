import Image from "next/image";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type StandingRow = {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  played: number;
  points: number;
  gameW: number;
  gameL: number;
  diff: number;
};

function createRow(
  teamId: string,
  teamName: string,
  logoUrl: string | null
): StandingRow {
  return {
    teamId,
    teamName,
    logoUrl,
    played: 0,
    points: 0,
    gameW: 0,
    gameL: 0,
    diff: 0,
  };
}

// Current BO2 system based on your earlier standings logic
// 2-0 = 2 points
// 1-1 = 1 point each
// 0-2 = 0 points
function getPoints(w: number, l: number) {
  if (w === 2 && l === 0) return 2;
  if (w === 1 && l === 1) return 1;
  return 0;
}

function getRowClass(index: number, total: number) {
  if (index === 0) {
    return "bg-gradient-to-r from-yellow-500/20 via-yellow-400/10 to-transparent";
  }

  if (index === 1) {
    return "bg-gradient-to-r from-zinc-300/20 via-zinc-200/10 to-transparent";
  }

  if (index === 2) {
    return "bg-gradient-to-r from-orange-500/20 via-orange-400/10 to-transparent";
  }

  if (index === total - 1 && total > 1) {
    return "bg-gradient-to-r from-red-900/40 via-red-800/20 to-transparent";
  }

  return "bg-white/[0.02]";
}

function getRankTextClass(index: number, total: number) {
  if (index === 0) return "text-yellow-300";
  if (index === 1) return "text-zinc-200";
  if (index === 2) return "text-orange-300";
  if (index === total - 1 && total > 1) return "text-red-300";
  return "text-zinc-400";
}

export default async function StandingsPage() {
  const [teams, matches] = await Promise.all([
    prisma.team.findMany({
      orderBy: {
        name: "asc",
      },
    }),
    prisma.match.findMany({
      where: {
        stage: "REGULAR_SEASON",
        status: {
          in: ["COMPLETED", "FORFEIT"],
        },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    }),
  ]);

  const table = new Map<string, StandingRow>();

  for (const team of teams) {
    table.set(team.id, createRow(team.id, team.name, team.logoUrl ?? null));
  }

  for (const match of matches) {
    const home = table.get(match.homeTeamId);
    const away = table.get(match.awayTeamId);

    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;

    home.gameW += match.homeScore;
    home.gameL += match.awayScore;

    away.gameW += match.awayScore;
    away.gameL += match.homeScore;

    home.points += getPoints(match.homeScore, match.awayScore);
    away.points += getPoints(match.awayScore, match.homeScore);
  }

  const standings = Array.from(table.values())
    .map((team) => ({
      ...team,
      diff: team.gameW - team.gameL,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.gameW !== a.gameW) return b.gameW - a.gameW;
      return a.teamName.localeCompare(b.teamName);
    });

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Expat China League
          </p>

          <h1 className="mt-4 text-5xl font-black uppercase md:text-7xl">
            Standings
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-zinc-300">
            Teams are ranked by points and game difference across the regular
            season. Completed BO2 results update the table automatically.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        {standings.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-zinc-950 px-6 py-12 text-center text-zinc-400 shadow-[0_0_40px_rgba(0,0,0,0.3)]">
            No standings data yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-[0_0_40px_rgba(0,0,0,0.3)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-black/40 text-left text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                  <tr>
                    <th className="px-6 py-5">#</th>
                    <th className="px-6 py-5">Team</th>
                    <th className="px-6 py-5 text-center">P</th>
                    <th className="px-6 py-5 text-center">Game</th>
                    <th className="px-6 py-5 text-center">Diff</th>
                    <th className="px-6 py-5 text-center">Pts</th>
                  </tr>
                </thead>

                <tbody>
                  {standings.map((team, index) => (
                    <tr
                      key={team.teamId}
                      className={`border-t border-white/10 transition hover:bg-white/[0.04] ${getRowClass(
                        index,
                        standings.length
                      )}`}
                    >
                      <td
                        className={`px-6 py-5 text-3xl font-black ${getRankTextClass(
                          index,
                          standings.length
                        )}`}
                      >
                        {index + 1}
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black p-2 shadow-[0_0_10px_rgba(0,0,0,0.35)]">
                            {team.logoUrl ? (
                              <Image
                                src={team.logoUrl}
                                alt={team.teamName}
                                width={48}
                                height={48}
                                className="h-10 w-10 object-contain"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-xs font-black uppercase text-zinc-400">
                                {team.teamName.slice(0, 3)}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-2xl font-black uppercase tracking-[0.08em] text-white">
                              {team.teamName}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-center text-lg font-bold text-white">
                        {team.played}
                      </td>

                      <td className="px-6 py-5 text-center text-lg font-bold text-white">
                        {team.gameW}-{team.gameL}
                      </td>

                      <td className="px-6 py-5 text-center text-lg font-bold text-white">
                        {team.diff > 0 ? `+${team.diff}` : team.diff}
                      </td>

                      <td className="px-6 py-5 text-center text-2xl font-black text-green-400">
                        {team.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-400">
          <span className="font-semibold text-white">Scoring:</span> 2-0 win =
          2 points, 1-1 draw = 1 point each, 0-2 loss = 0 points.
        </div>
      </section>
    </main>
  );
}