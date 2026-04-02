import { prisma } from "@/lib/prisma";

type TeamPlayer = {
  riotName?: string;
  riotTag?: string;
  rank?: string;
};

export default async function TeamsPage() {
  const teams = await prisma.teamRegistration.findMany({
    where: { status: "approved" },
  });

  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl space-y-10">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Expat China League
          </p>

          <h1 className="mt-4 text-5xl font-black uppercase tracking-tight md:text-7xl">
            Teams
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
            Browse approved rosters competing in ECL Split One. Each team card
            highlights the captain and current registered lineup.
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-6 shadow-[0_0_40px_rgba(74,222,128,0.06)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
                Team Directory
              </p>
              <h2 className="mt-3 text-3xl font-black uppercase">
                Approved Teams
              </h2>
            </div>

            <div className="rounded-2xl border border-green-400/20 bg-green-400/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-green-300">
              {teams.length} team{teams.length === 1 ? "" : "s"} registered
            </div>
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-white/10 bg-zinc-900/60 p-12 text-center backdrop-blur-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Team Directory
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase text-white">
              No Approved Teams Yet
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Approved teams will appear here once registrations are reviewed and
              confirmed for Split One.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {teams.map((team) => {
              const players = Array.isArray(team.players)
                ? (team.players as TeamPlayer[])
                : [];

              return (
                <article
                  key={team.id}
                  className="group rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-green-400/30 hover:shadow-[0_20px_60px_rgba(74,222,128,0.15)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-400">
                        Team
                      </p>
                      <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight text-white transition group-hover:text-green-300">
                        {team.teamName}
                      </h2>
                    </div>

                    <div className="shrink-0 rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-green-300">
                      {players.length} player{players.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      Captain
                    </p>
                    <p className="mt-2 text-lg font-bold uppercase text-white">
                      {team.captainName}
                    </p>
                  </div>

                  <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                        Roster
                      </p>

                      <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                        Current Lineup
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {players.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/30 p-5 text-sm text-zinc-400">
                          No players listed yet.
                        </div>
                      ) : (
                        players.map((player, index) => (
                          <div
                            key={`${team.id}-${index}`}
                            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition duration-200 hover:border-white/20 hover:bg-white/[0.06] md:flex-row md:items-center md:justify-between"
                          >
                            <div>
                              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                Player {index + 1}
                              </p>
                              <p className="mt-1 break-words text-lg font-bold text-white">
                                {player.riotName && player.riotTag
                                  ? `${player.riotName}#${player.riotTag}`
                                  : "Unnamed Player"}
                              </p>
                            </div>

                            <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200">
                              {player.rank || "Rank N/A"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}