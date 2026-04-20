import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import DeleteTeamButton from "@/components/DeleteTeamButton";

type TeamPlayer = {
  playerName?: string;
  name?: string;
  riotName?: string;
  riotTag?: string;
  primaryRole?: string;
  secondaryRole?: string;
  currentRank?: string;
  rank?: string;
};

function cleanText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRank(rank?: string | null) {
  const value = cleanText(rank).toLowerCase();

  if (value.includes("challenger")) return "Challenger";
  if (value.includes("grandmaster")) return "Grandmaster";
  if (value.includes("master")) return "Master";
  if (value.includes("diamond")) return "Diamond";
  if (value.includes("emerald")) return "Emerald";
  if (value.includes("platinum")) return "Platinum";
  if (value.includes("gold")) return "Gold";
  if (value.includes("silver")) return "Silver";
  if (value.includes("bronze")) return "Bronze";
  if (value.includes("iron")) return "Iron";

  return "Unranked";
}

function isRealTeamPlayer(player: TeamPlayer) {
  return Boolean(
    cleanText(player.playerName) ||
      cleanText(player.name) ||
      cleanText(player.riotName) ||
      cleanText(player.riotTag) ||
      cleanText(player.primaryRole) ||
      cleanText(player.secondaryRole) ||
      cleanText(player.currentRank) ||
      cleanText(player.rank)
  );
}

async function updateTeamStatus(formData: FormData) {
  "use server";

  const teamId = String(formData.get("teamId") || "");
  const status = String(formData.get("status") || "");

  if (!teamId || !["approved", "rejected", "pending"].includes(status)) {
    redirect("/admin/teams?message=invalid");
  }

  await prisma.teamRegistration.update({
    where: { id: teamId },
    data: { status },
  });

  revalidatePath("/admin/teams");

  if (status === "approved") {
    redirect("/admin/teams?message=approved");
  }

  if (status === "rejected") {
    redirect("/admin/teams?message=rejected");
  }

  redirect("/admin/teams?message=pending");
}

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams?: { message?: string | string[] };
}) {
  const message =
    typeof searchParams?.message === "string"
      ? searchParams.message
      : Array.isArray(searchParams?.message)
      ? searchParams.message[0]
      : undefined;

  const [teams, savedTeams] = await Promise.all([
    prisma.teamRegistration.findMany({
      orderBy: { submittedAt: "desc" },
    }),
    prisma.team.findMany({
      select: {
        id: true,
        name: true,
        logoUrl: true,
      },
    }),
  ]);

  const savedTeamMap = new Map(
    savedTeams.map((team) => [cleanText(team.name).toLowerCase(), team])
  );

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-black uppercase tracking-[0.08em]">
            Team Registrations
          </h1>
          <p className="mt-2 text-white/60">
            Review, approve, reject, edit, and remove team signups.
          </p>
        </div>

        {message === "approved" && (
          <div className="mb-6 rounded-2xl border border-green-400/25 bg-green-400/10 px-5 py-4 text-sm font-semibold text-green-300">
            Team approved.
          </div>
        )}

        {message === "rejected" && (
          <div className="mb-6 rounded-2xl border border-yellow-400/25 bg-yellow-400/10 px-5 py-4 text-sm font-semibold text-yellow-300">
            Team rejected.
          </div>
        )}

        {message === "pending" && (
          <div className="mb-6 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-semibold text-white/85">
            Team set back to pending.
          </div>
        )}

        {message === "saved" && (
          <div className="mb-6 rounded-2xl border border-blue-400/25 bg-blue-400/10 px-5 py-4 text-sm font-semibold text-blue-300">
            Team updated successfully.
          </div>
        )}

        {message === "invalid" && (
          <div className="mb-6 rounded-2xl border border-red-400/25 bg-red-400/10 px-5 py-4 text-sm font-semibold text-red-300">
            Invalid team action.
          </div>
        )}

        {teams.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-white/60">
            No team registrations found.
          </div>
        ) : (
          <div className="space-y-6">
            {teams.map((team) => {
              const players = Array.isArray(team.players)
                ? (team.players as TeamPlayer[]).filter(isRealTeamPlayer)
                : [];

              const matchedSavedTeam = savedTeamMap.get(
                cleanText(team.teamName).toLowerCase()
              );

              const logoUrl = matchedSavedTeam?.logoUrl || null;

              return (
                <section
                  key={team.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-green-400/25"
                >
                  <div className="border-b border-white/10 px-6 py-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={`${team.teamName} logo`}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                              No Logo
                            </div>
                          )}
                        </div>

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

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-300">
                              {team.status}
                            </span>

                            {logoUrl ? (
                              <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-300">
                                Logo Saved
                              </span>
                            ) : (
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/60">
                                No Logo Yet
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/admin/teams/${team.id}/edit`}
                          className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
                        >
                          Edit Team
                        </Link>

                        <form action={updateTeamStatus}>
                          <input type="hidden" name="teamId" value={team.id} />
                          <input type="hidden" name="status" value="approved" />
                          <button
                            type="submit"
                            className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500/20"
                          >
                            Approve
                          </button>
                        </form>

                        <form action={updateTeamStatus}>
                          <input type="hidden" name="teamId" value={team.id} />
                          <input type="hidden" name="status" value="rejected" />
                          <button
                            type="submit"
                            className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm font-semibold text-yellow-300 transition hover:bg-yellow-500/20"
                          >
                            Reject
                          </button>
                        </form>

                        <form action={updateTeamStatus}>
                          <input type="hidden" name="teamId" value={team.id} />
                          <input type="hidden" name="status" value="pending" />
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
                            {players.map((player, index) => {
                              const displayName =
                                cleanText(player.playerName) ||
                                cleanText(player.name) ||
                                cleanText(player.riotName) ||
                                "Unknown Player";

                              const displayRiotName =
                                cleanText(player.riotName) || "-";
                              const displayTag = cleanText(player.riotTag) || "-";
                              const displayRank = normalizeRank(
                                cleanText(player.currentRank) ||
                                  cleanText(player.rank) ||
                                  "Unranked"
                              );
                              const displayPrimary =
                                cleanText(player.primaryRole) || "-";
                              const displaySecondary =
                                cleanText(player.secondaryRole) || "-";

                              return (
                                <tr
                                  key={`${team.id}-${index}`}
                                  className="border-t border-white/10 hover:bg-white/5"
                                >
                                  <td className="px-4 py-3 font-medium">
                                    {displayName}
                                  </td>
                                  <td className="px-4 py-3 text-white/80">
                                    {displayRiotName}
                                  </td>
                                  <td className="px-4 py-3 text-white/80">
                                    {displayTag}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="rounded-full border border-green-400/30 bg-green-400/10 px-2 py-1 text-xs font-semibold text-green-300">
                                      {displayRank}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-white/80">
                                    {displayPrimary}
                                  </td>
                                  <td className="px-4 py-3 text-white/80">
                                    {displaySecondary}
                                  </td>
                                </tr>
                              );
                            })}
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