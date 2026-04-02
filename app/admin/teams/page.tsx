import { prisma } from "@/lib/prisma";
import DeleteTeamButton from "@/components/DeleteTeamButton";

export const dynamic = "force-dynamic";

type TeamPlayer = {
  playerName?: string;
  name?: string;
  riotName?: string;
  riotTag?: string;
  primaryRole?: string;
  secondaryRole?: string;
  currentRank?: string;
};

async function updateTeamStatus(id: string, status: string) {
  "use server";

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/team-registration/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to update team status");
  }
}

export default async function AdminTeamsPage() {
  const teams = await prisma.teamRegistration.findMany({
    orderBy: { submittedAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-black uppercase tracking-[0.08em]">
            Team Registrations
          </h1>
          <p className="mt-2 text-white/60">
            Review, approve, reject, and remove team signups.
          </p>
        </div>

        {teams.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-white/60">
            No team registrations found.
          </div>
        ) : (
          <div className="space-y-6">
            {teams.map((team) => {
              const players = Array.isArray(team.players)
                ? (team.players as TeamPlayer[])
                : [];

              return (
                <section
                  key={team.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
                >
                  <div className="border-b border-white/10 px-6 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h2 className="text-2xl font-bold">{team.teamName}</h2>
                        <div className="mt-2 space-y-1 text-sm text-white/65">
                          <p>
                            <span className="font-semibold text-white/85">
                              Captain:
                            </span>{" "}
                            {team.captainName}
                          </p>
                          <p>
                            <span className="font-semibold text-white/85">
                              Email:
                            </span>{" "}
                            {team.captainEmail}
                          </p>
                          <p>
                            <span className="font-semibold text-white/85">
                              Submitted:
                            </span>{" "}
                            {new Date(team.submittedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-300">
                          {team.status}
                        </span>

                        <form
                          action={async () => {
                            "use server";
                            await prisma.teamRegistration.update({
                              where: { id: team.id },
                              data: { status: "approved" },
                            });
                          }}
                        >
                          <button
                            type="submit"
                            className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500/20"
                          >
                            Approve
                          </button>
                        </form>

                        <form
                          action={async () => {
                            "use server";
                            await prisma.teamRegistration.update({
                              where: { id: team.id },
                              data: { status: "rejected" },
                            });
                          }}
                        >
                          <button
                            type="submit"
                            className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm font-semibold text-yellow-300 transition hover:bg-yellow-500/20"
                          >
                            Reject
                          </button>
                        </form>

                        <form
                          action={async () => {
                            "use server";
                            await prisma.teamRegistration.update({
                              where: { id: team.id },
                              data: { status: "pending" },
                            });
                          }}
                        >
                          <button
                            type="submit"
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                          >
                            Set Pending
                          </button>
                        </form>

                        <DeleteTeamButton teamId={team.id} />
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-5">
                    <h3 className="mb-4 text-lg font-bold text-white/90">
                      Roster
                    </h3>

                    {players.length === 0 ? (
                      <p className="text-sm text-white/50">
                        No player data found.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-white/5 text-left text-white/70">
                            <tr>
                              <th className="px-4 py-3">Player</th>
                              <th className="px-4 py-3">Riot ID</th>
                              <th className="px-4 py-3">Tag</th>
                              <th className="px-4 py-3">Rank</th>
                              <th className="px-4 py-3">Primary</th>
                              <th className="px-4 py-3">Secondary</th>
                            </tr>
                          </thead>
                          <tbody>
                            {players.map((player, index) => (
                              <tr
                                key={`${team.id}-${index}`}
                                className="border-t border-white/10 hover:bg-white/5"
                              >
                                <td className="px-4 py-3 font-medium">
                                  {player.playerName || player.name || "-"}
                                </td>
                                <td className="px-4 py-3 text-white/80">
                                  {player.riotName || "-"}
                                </td>
                                <td className="px-4 py-3 text-white/80">
                                  {player.riotTag || "-"}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="rounded-full border border-green-400/30 bg-green-400/10 px-2 py-1 text-xs font-semibold text-green-300">
                                    {player.currentRank || "UNRANKED"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-white/80">
                                  {player.primaryRole || "-"}
                                </td>
                                <td className="px-4 py-3 text-white/80">
                                  {player.secondaryRole || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}