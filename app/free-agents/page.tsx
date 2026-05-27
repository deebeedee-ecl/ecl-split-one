import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FreeAgentsPage() {
  const freeAgents = await prisma.freeAgentRegistration.findMany({
    where: {
      status: {
        in: ["approved", "signed"],
      },
    },
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
  });

  const availableAgents = freeAgents.filter((agent) => agent.status === "approved");
  const signedAgents = freeAgents.filter((agent) => agent.status === "signed");

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
              Expat China League
            </p>

            <h1 className="mt-4 text-5xl font-black uppercase tracking-tight md:text-7xl">
              Still Want To Play?
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
              Free agency is open for late roster pickups, emergency subs, and
              players who want to be considered for future ECL tournaments.
              Sign up once and stay visible to captains.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/register/free-agent"
                className="inline-flex justify-center rounded-xl bg-green-400 px-7 py-4 font-black uppercase tracking-wide text-black shadow-[0_0_25px_rgba(74,222,128,0.22)] transition duration-200 hover:scale-[1.02] hover:bg-green-300"
              >
                Sign Up As Free Agent
              </Link>

              <Link
                href="/contact"
                className="inline-flex justify-center rounded-xl border border-white/10 bg-white/5 px-7 py-4 font-bold uppercase tracking-wide text-white/75 transition hover:border-green-400/30 hover:bg-green-400/10 hover:text-white"
              >
                Talk To Admins
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-green-400/20 bg-green-400/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-300">
                Available
              </p>
              <p className="mt-2 text-4xl font-black">{availableAgents.length}</p>
              <p className="mt-1 text-sm text-zinc-300">
                Players captains can scout now.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
                Signed
              </p>
              <p className="mt-2 text-4xl font-black">{signedAgents.length}</p>
              <p className="mt-1 text-sm text-zinc-300">
                Players already picked up.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                Future Tournaments
              </p>
              <p className="mt-2 text-2xl font-black uppercase">Open Pool</p>
              <p className="mt-1 text-sm text-zinc-300">
                Stay on the radar after Split One.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
              1. Register
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Add your Riot ID, roles, rank, and contact notes.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
              2. Review
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Admins approve valid signups before they appear publicly.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
              3. Get Picked Up
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Captains can contact you for subs, trades, or future rosters.
            </p>
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Player Pool
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase">
              Free Agent Directory
            </h2>
          </div>

          <div className="rounded-2xl border border-green-400/20 bg-green-400/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-green-300">
            {freeAgents.length} player{freeAgents.length === 1 ? "" : "s"} listed
          </div>
        </div>

        {freeAgents.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-white/10 bg-zinc-900/60 p-12 text-center backdrop-blur-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Scouting Pool
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase text-white">
              No Approved Free Agents Yet
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Once player registrations are reviewed and approved, they will
              appear here for teams and captains to browse.
            </p>
            <Link
              href="/register/free-agent"
              className="mt-6 inline-flex rounded-xl bg-green-400 px-6 py-3 font-black uppercase tracking-wide text-black transition hover:bg-green-300"
            >
              Be The First To Sign Up
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {freeAgents.map((agent) => {
              const isSigned = agent.status === "signed";
              const signedTeamName = agent.signedToTeamName?.trim() || "";

              return (
                <article
                  key={agent.id}
                  className={`group rounded-[2rem] border p-6 transition-all duration-300 ${
                    isSigned
                      ? "border-blue-400/20 bg-gradient-to-br from-zinc-900 via-[#08111f] to-black shadow-[0_10px_40px_rgba(0,0,0,0.45)]"
                      : "border-white/10 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 shadow-[0_10px_40px_rgba(0,0,0,0.45)] hover:-translate-y-1 hover:scale-[1.01] hover:border-green-400/30 hover:shadow-[0_20px_60px_rgba(74,222,128,0.15)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className={`text-sm font-semibold uppercase tracking-[0.2em] ${
                          isSigned ? "text-blue-400" : "text-green-400"
                        }`}
                      >
                        {isSigned ? "Signed Free Agent" : "Free Agent"}
                      </p>

                      <h2
                        className={`mt-3 text-2xl font-black uppercase leading-tight tracking-tight text-white transition ${
                          isSigned
                            ? "group-hover:text-blue-300"
                            : "group-hover:text-green-300"
                        }`}
                      >
                        {agent.playerName}
                      </h2>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
                          isSigned
                            ? "border border-blue-400/20 bg-blue-400/10 text-blue-300"
                            : "border border-green-400/20 bg-green-400/10 text-green-300"
                        }`}
                      >
                        {isSigned ? "Signed" : "Available"}
                      </div>

                      <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300">
                        {agent.currentRank || "Rank N/A"}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`mt-6 rounded-2xl border p-4 backdrop-blur-sm ${
                      isSigned
                        ? "border-blue-400/10 bg-blue-400/[0.04]"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      Riot ID
                    </p>
                    <p className="mt-2 break-words text-lg font-bold text-white">
                      {agent.riotName}#{agent.riotTag}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200">
                      Primary: {agent.primaryRole}
                    </div>

                    <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200">
                      Secondary: {agent.secondaryRole || "None"}
                    </div>
                  </div>

                  <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                  <div className="mt-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      Notes
                    </p>
                    <p className="mt-3 min-h-[72px] text-sm leading-7 text-zinc-300">
                      {agent.notes?.trim()
                        ? agent.notes
                        : "No additional notes provided for this player."}
                    </p>
                  </div>

                  {isSigned && signedTeamName && (
                    <div className="mt-6 rounded-2xl border border-blue-400/15 bg-blue-400/[0.06] px-4 py-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-300">
                        Signed To
                      </p>
                      <p className="mt-1 text-base font-semibold text-white">
                        {signedTeamName}
                      </p>
                    </div>
                  )}

                  {isSigned && (
                    <div className="mt-4 rounded-2xl border border-blue-400/15 bg-blue-400/[0.06] px-4 py-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-300">
                        Player Signed
                      </p>
                      <p className="mt-1 text-sm text-zinc-300">
                        This player has already been picked up and is no longer
                        available for teams.
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
