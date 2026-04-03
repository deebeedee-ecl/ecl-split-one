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

const accentThemes = [
  {
    bar: "bg-green-400/80",
    badge: "border-green-400/30 bg-green-400/10 text-green-300",
    captain: "border-green-400/20 bg-green-400/10",
    slot: "border-green-400/20 bg-green-400/10 text-green-300",
    hover:
      "hover:border-green-400/35 hover:shadow-[0_18px_60px_rgba(74,222,128,0.12)]",
  },
  {
    bar: "bg-cyan-400/80",
    badge: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
    captain: "border-cyan-400/20 bg-cyan-400/10",
    slot: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
    hover:
      "hover:border-cyan-400/35 hover:shadow-[0_18px_60px_rgba(34,211,238,0.12)]",
  },
  {
    bar: "bg-violet-400/80",
    badge: "border-violet-400/30 bg-violet-400/10 text-violet-300",
    captain: "border-violet-400/20 bg-violet-400/10",
    slot: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    hover:
      "hover:border-violet-400/35 hover:shadow-[0_18px_60px_rgba(167,139,250,0.12)]",
  },
  {
    bar: "bg-amber-400/80",
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    captain: "border-amber-400/20 bg-amber-400/10",
    slot: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    hover:
      "hover:border-amber-400/35 hover:shadow-[0_18px_60px_rgba(251,191,36,0.12)]",
  },
  {
    bar: "bg-rose-400/80",
    badge: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    captain: "border-rose-400/20 bg-rose-400/10",
    slot: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    hover:
      "hover:border-rose-400/35 hover:shadow-[0_18px_60px_rgba(251,113,133,0.12)]",
  },
  {
    bar: "bg-fuchsia-400/80",
    badge: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300",
    captain: "border-fuchsia-400/20 bg-fuchsia-400/10",
    slot: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300",
    hover:
      "hover:border-fuchsia-400/35 hover:shadow-[0_18px_60px_rgba(232,121,249,0.12)]",
  },
];

function getTeamTag(teamName: string) {
  const words = teamName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "ECL";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

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
            {teams.map((team, teamIndex) => {
              const accent = accentThemes[teamIndex % accentThemes.length];
              const teamTag = getTeamTag(team.teamName);

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
                  className={`group rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,27,0.98)_0%,rgba(8,8,10,1)_100%)] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.55)] transition-all duration-300 hover:-translate-y-1 ${accent.hover}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className={`mb-4 h-1 w-16 rounded-full ${accent.bar}`} />

                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Team Identity
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <h2 className="break-words text-2xl font-black uppercase tracking-[0.03em] text-white transition group-hover:text-white/95">
                          {team.teamName}
                        </h2>

                        <div
                          className={`rounded-lg border px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${accent.badge}`}
                        >
                          {teamTag}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] ${accent.badge}`}
                    >
                      {players.length} player{players.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className={`mt-6 rounded-xl border p-4 ${accent.captain}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                          Team Captain
                        </p>
                        <p className="mt-2 text-lg font-bold uppercase text-white">
                          {team.captainName}
                        </p>
                      </div>

                      <div
                        className={`rounded-lg border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${accent.badge}`}
                      >
                        Captain
                      </div>
                    </div>
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
                              className="grid grid-cols-[64px_1fr_auto] items-center gap-4 rounded-xl border border-white/10 bg-black/40 px-4 py-4 transition-all duration-200 hover:bg-white/[0.05]"
                            >
                              <div
                                className={`flex h-12 w-12 items-center justify-center rounded-lg border text-sm font-black uppercase tracking-[0.14em] ${accent.slot}`}
                              >
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