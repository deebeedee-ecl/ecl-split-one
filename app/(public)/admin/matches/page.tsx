import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MatchStage, MatchStatus } from "@prisma/client";
import ResetGameStatsMenu from "@/components/admin/ResetGameStatsMenu";

export const dynamic = "force-dynamic";

const stageOptions = [
  { value: "REGULAR_SEASON", label: "Regular Season" },
  { value: "PLAYOFFS", label: "Playoffs" },
  { value: "SEMIFINALS", label: "Semifinals" },
  { value: "FINALS", label: "Finals" },
];

const statusOptions = [
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FORFEIT", label: "Forfeit" },
  { value: "POSTPONED", label: "Postponed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function formatStage(stage: MatchStage) {
  switch (stage) {
    case "REGULAR_SEASON":
      return "Regular Season";
    case "PLAYOFFS":
      return "Playoffs";
    case "SEMIFINALS":
      return "Semifinals";
    case "FINALS":
      return "Finals";
    default:
      return stage;
  }
}

function formatStatus(status: MatchStatus) {
  switch (status) {
    case "SCHEDULED":
      return "Scheduled";
    case "COMPLETED":
      return "Completed";
    case "FORFEIT":
      return "Forfeit";
    case "POSTPONED":
      return "Postponed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function formatDate(value?: Date | null) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getWinnerDisplay(match: {
  status: MatchStatus;
  bestOf: number;
  homeScore: number;
  awayScore: number;
  winnerTeam?: { name: string } | null;
}) {
  if (match.winnerTeam?.name) {
    return match.winnerTeam.name;
  }

  if (
    match.status === "COMPLETED" &&
    match.bestOf === 2 &&
    match.homeScore === match.awayScore
  ) {
    return "DRAW";
  }

  return "-";
}

async function createMatch(formData: FormData) {
  "use server";

  const homeTeamId = String(formData.get("homeTeamId") || "").trim();
  const awayTeamId = String(formData.get("awayTeamId") || "").trim();
  const stage = String(formData.get("stage") || "").trim() as MatchStage;
  const roundLabel = String(formData.get("roundLabel") || "").trim();
  const matchLabel = String(formData.get("matchLabel") || "").trim();
  const bestOfRaw = String(formData.get("bestOf") || "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") || "").trim();
  const status = String(formData.get("status") || "").trim() as MatchStatus;
  const notes = String(formData.get("notes") || "").trim();

  if (!homeTeamId || !awayTeamId) {
    throw new Error("Both teams are required.");
  }

  if (homeTeamId === awayTeamId) {
    throw new Error("A team cannot play itself.");
  }

  if (!Object.values(MatchStage).includes(stage)) {
    throw new Error("Invalid stage.");
  }

  if (!Object.values(MatchStatus).includes(status)) {
    throw new Error("Invalid status.");
  }

  const bestOf = Number(bestOfRaw);

  if (![1, 2, 3, 5].includes(bestOf)) {
    throw new Error("Best of must be 1, 2, 3, or 5.");
  }

  const [homeTeam, awayTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: homeTeamId } }),
    prisma.team.findUnique({ where: { id: awayTeamId } }),
  ]);

  if (!homeTeam || !awayTeam) {
    throw new Error("One or both selected teams do not exist.");
  }

  await prisma.match.create({
    data: {
      homeTeamId,
      awayTeamId,
      stage,
      roundLabel: roundLabel || null,
      matchLabel: matchLabel || null,
      bestOf,
      scheduledAt: scheduledAtRaw ? new Date(scheduledAtRaw) : null,
      status,
      notes: notes || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/matches");
  revalidatePath("/schedule");
  revalidatePath("/results");
  revalidatePath("/standings");

  redirect("/admin/matches?created=1");
}

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string; deleted?: string; created?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const showUpdatedBanner = resolvedSearchParams?.updated === "1";
  const showDeletedBanner = resolvedSearchParams?.deleted === "1";
  const showCreatedBanner = resolvedSearchParams?.created === "1";

  const [teams, matches] = await Promise.all([
    prisma.team.findMany({
      orderBy: {
        name: "asc",
      },
    }),
    prisma.match.findMany({
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
        games: {
          include: {
            _count: {
              select: {
                playerStats: true,
              },
            },
          },
          orderBy: {
            gameNumber: "asc",
          },
        },
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:text-green-400"
        >
          ← Back to Dashboard
        </Link>

        {showCreatedBanner && (
          <div className="mb-6 rounded-2xl border border-green-400/30 bg-green-500/10 px-5 py-4 text-sm font-medium text-green-300">
            Match created successfully.
          </div>
        )}

        {showUpdatedBanner && (
          <div className="mb-6 rounded-2xl border border-green-400/30 bg-green-500/10 px-5 py-4 text-sm font-medium text-green-300">
            Match updated successfully.
          </div>
        )}

        {showDeletedBanner && (
          <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-300">
            Match deleted successfully.
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-4xl font-black uppercase tracking-[0.08em]">
            Match Admin
          </h1>
          <p className="mt-2 text-white/60">
            Create and review scheduled matches for Split One.
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Matches" value={matches.length} />
          <StatCard
            label="Scheduled"
            value={matches.filter((m) => m.status === "SCHEDULED").length}
          />
          <StatCard
            label="Completed"
            value={matches.filter((m) => m.status === "COMPLETED").length}
          />
          <StatCard label="Teams" value={teams.length} />
        </div>

        <div className="mb-10 rounded-2xl border border-green-400/20 bg-green-500/10 p-6">
          <h2 className="text-2xl font-bold">Create Match</h2>
          <p className="mt-2 text-sm text-white/65">
            Add a new fixture manually now. Later the KOOK bot can write into
            this same system.
          </p>

          <form action={createMatch} className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">
                Home Team
              </label>
              <select
                name="homeTeamId"
                required
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                defaultValue=""
              >
                <option value="" disabled>
                  Select home team
                </option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">
                Away Team
              </label>
              <select
                name="awayTeamId"
                required
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                defaultValue=""
              >
                <option value="" disabled>
                  Select away team
                </option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">
                Stage
              </label>
              <select
                name="stage"
                required
                defaultValue="REGULAR_SEASON"
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
              >
                {stageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">
                Status
              </label>
              <select
                name="status"
                required
                defaultValue="SCHEDULED"
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">
                Round Label
              </label>
              <input
                name="roundLabel"
                type="text"
                placeholder="e.g. Week 1"
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">
                Match Label
              </label>
              <input
                name="matchLabel"
                type="text"
                placeholder="e.g. Match A"
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">
                Best Of
              </label>
              <select
                name="bestOf"
                required
                defaultValue="2"
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
              >
                <option value="1">BO1</option>
                <option value="2">BO2</option>
                <option value="3">BO3</option>
                <option value="5">BO5</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">
                Scheduled At
              </label>
              <input
                name="scheduledAt"
                type="datetime-local"
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-white/80">
                Notes
              </label>
              <textarea
                name="notes"
                rows={4}
                placeholder="Optional admin notes"
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-xl bg-green-400 px-6 py-3 font-bold uppercase tracking-wide text-black transition hover:scale-[1.02] hover:bg-green-300"
              >
                Create Match
              </button>
            </div>
          </form>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="text-2xl font-bold">All Matches</h2>
            <p className="mt-1 text-sm text-white/60">
              Current fixtures stored in the database.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-left text-white/70">
                <tr>
                  <th className="px-4 py-3">Match</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Round</th>
                  <th className="px-4 py-3">Best Of</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Winner</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-white/50"
                    >
                      No matches created yet.
                    </td>
                  </tr>
                ) : (
                  matches.map((match) => {
                    const gamesForReset = Array.from(
                      { length: match.bestOf },
                      (_, index) => {
                        const gameNumber = index + 1;
                        const existingGame = match.games.find(
                          (game) => game.gameNumber === gameNumber
                        );

                        return {
                          gameNumber,
                          hasStats:(existingGame?._count?.playerStats ?? 0) > 0,
                      
                        };
                      }
                    );

                    return (
                      <tr
                        key={match.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="px-4 py-3 font-medium">
                          {match.homeTeam.name} vs {match.awayTeam.name}
                        </td>
                        <td className="px-4 py-3 text-white/80">
                          {formatStage(match.stage)}
                        </td>
                        <td className="px-4 py-3 text-white/80">
                          {match.roundLabel || "-"}
                        </td>
                        <td className="px-4 py-3 text-white/80">
                          BO{match.bestOf}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs uppercase tracking-wide text-white/80">
                            {formatStatus(match.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/80">
                          {formatDate(match.scheduledAt)}
                        </td>
                        <td className="px-4 py-3 text-white/80">
                          {match.homeScore} - {match.awayScore}
                        </td>
                        <td className="px-4 py-3 text-white/80">
                          {getWinnerDisplay(match)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/admin/matches/${match.id}`}
                              className="rounded-lg border border-green-400/30 bg-green-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-green-300 transition hover:border-green-400/50 hover:bg-green-500/15"
                            >
                              Edit
                            </Link>

                            <ResetGameStatsMenu
                              matchId={match.id}
                              games={gamesForReset}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
    </div>
  );
}