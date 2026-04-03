import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type TeamPlayer = {
  playerName?: string;
  name?: string;
  riotName?: string;
  riotTag?: string;
  currentRank?: string;
  rank?: string;
  primaryRole?: string;
  secondaryRole?: string;
};

export default async function TeamsPage() {
  const teams = await prisma.teamRegistration.findMany({
    where: { status: "approved" },
    orderBy: { submittedAt: "desc" },
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

        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_0_40px_rgba(74,222,128,0.06)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
                Team Directory
              </p>
              <h2 className="mt-3 text-3xl font-black uppercase">
                Approved Teams
              </h2>
            </div>

            <div className="rounded-xl border border-green-400/20 bg-green-400/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-green-300">
              {teams.length} team{teams.length === 1 ? "" : "s"} registered
            </div>
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/60 p-12 text-center backdrop-blur-sm">
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
                ? (team.players as TeamPlayer[]).filter((player) => {
                    if (!player) return false;

                    return [
                      player.playerName,
                      player.name,
                      player.riotName,
                      player.riotTag,
                      player.currentRank,
                      player.rank,
                      player.primaryRole,
                      player.secondaryRole,
                    ].some(
                      (value) =>
                        typeof value === "string" && value.trim() !== ""
                    );
                  })
                : [];

              return (
                <article
                  key={team.id}
                  className="group rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,27,0.98)_0%,rgba(8,8,10,1)_100%)] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.55)] transition-all duration-300 hover:-translate-y-1 hover:border-green-400/35 hover:shadow-[0_18px_60px_rgba(74,222,128,0.12)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-4 h-1 w-16 rounded-full bg-green-400/80" />

                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-400">
                        Team
                      </p>

                      <h2 className="mt-3 break-words text-3xl font-black uppercase leading-tight tracking-[0.03em] text-white transition group-hover:text-green-300">
                        {team.teamName}
                      </h2>
                    </div>

                    <div className="shrink-0 rounded-xl border border-green-400/20 bg-green-400/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-green-300">
                      {players.length} player{players.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4">
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
                        <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-5 text-sm text-zinc-400">
                          No players listed yet.
                        </div>
                      ) : (
                        players.map((player, index) => {
                          const displayName =
                            player.playerName ||
                            player.name ||
                            (player.riotName && player.riotTag
                              ? `${player.riotName}#${player.riotTag}`
                              : player.riotName || "Unnamed Player");

                          const displayRank =
                            player.currentRank || player.rank || "Rank N/A";

                          return (
                            <div
                              key={`${team.id}-${index}`}
                              className="grid grid-cols-[64px_1fr_auto] items-center gap-4 rounded-xl border border-white/10 bg-black/40 px-4 py-4 transition-all duration-200 hover:border-green-400/30 hover:bg-white/[0.05]"
                            >
                              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-green-400/20 bg-green-400/10 text-sm font-black uppercase tracking-[0.14em] text-green-300">
                                P{index + 1}
                              </div>

                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                  Summoner
                                </p>
                                <p className="mt-1 truncate text-lg font-bold text-white">
                                  {displayName}
                                </p>
                              </div>

                              <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200">
                                {displayRank}
                              </div>
                            </div>
                          );
                        })
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