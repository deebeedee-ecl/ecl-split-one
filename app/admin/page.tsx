import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const rankOrder = [
  "CHALLENGER",
  "GRANDMASTER",
  "MASTER",
  "DIAMOND I",
  "DIAMOND II",
  "DIAMOND III",
  "DIAMOND IV",
  "EMERALD I",
  "EMERALD II",
  "EMERALD III",
  "EMERALD IV",
  "PLATINUM I",
  "PLATINUM II",
  "PLATINUM III",
  "PLATINUM IV",
  "GOLD I",
  "GOLD II",
  "GOLD III",
  "GOLD IV",
  "SILVER I",
  "SILVER II",
  "SILVER III",
  "SILVER IV",
  "BRONZE I",
  "BRONZE II",
  "BRONZE III",
  "BRONZE IV",
  "IRON I",
  "IRON II",
  "IRON III",
  "IRON IV",
  "UNRANKED",
];

function getRankValue(rank?: string | null) {
  if (!rank) return 999;
  const normalized = rank.trim().toUpperCase();
  const index = rankOrder.indexOf(normalized);
  return index === -1 ? 999 : index;
}

type CombinedPlayer = {
  id: string;
  playerName: string;
  riotName?: string;
  riotTag?: string;
  primaryRole?: string;
  secondaryRole?: string;
  currentRank?: string;
  status: string;
  source: "Free Agent" | "Team";
  teamName?: string;
  submittedAt: Date;
};

type TeamPlayerJson = {
  playerName?: string;
  name?: string;
  riotName?: string;
  riotTag?: string;
  primaryRole?: string;
  secondaryRole?: string;
  currentRank?: string;
  rank?: string;
};

export default async function AdminPage() {
  const [freeAgents, teams] = await Promise.all([
    prisma.freeAgentRegistration.findMany({
      orderBy: { submittedAt: "desc" },
    }),
    prisma.teamRegistration.findMany({
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const freeAgentPlayers: CombinedPlayer[] = freeAgents.map((player) => ({
    id: player.id,
    playerName: player.playerName || player.riotName || "Unknown Player",
    riotName: player.riotName || "",
    riotTag: player.riotTag || "",
    primaryRole: player.primaryRole ?? "",
    secondaryRole: player.secondaryRole ?? "",
    currentRank: player.currentRank ?? "UNRANKED",
    status: player.status,
    source: "Free Agent",
    teamName: "",
    submittedAt: player.submittedAt,
  }));

  const teamPlayers: CombinedPlayer[] = teams.flatMap((team) => {
    const players = Array.isArray(team.players)
      ? (team.players as TeamPlayerJson[])
      : [];

    return players.map((player, index) => ({
      id: `${team.id}-${index}`,
      playerName:
        player.playerName ||
        player.name ||
        player.riotName ||
        "Unknown Player",
      riotName: player.riotName || "",
      riotTag: player.riotTag || "",
      primaryRole: player.primaryRole || "",
      secondaryRole: player.secondaryRole || "",
      currentRank: player.currentRank || player.rank || "UNRANKED",
      status: team.status,
      source: "Team" as const,
      teamName: team.teamName,
      submittedAt: team.submittedAt,
    }));
  });

  const allPlayers = [...freeAgentPlayers, ...teamPlayers].sort((a, b) => {
    const rankDiff = getRankValue(a.currentRank) - getRankValue(b.currentRank);
    if (rankDiff !== 0) return rankDiff;
    return a.playerName.localeCompare(b.playerName);
  });

  const approvedFreeAgents = freeAgents.filter(
    (p) => p.status === "approved"
  ).length;

  const pendingFreeAgents = freeAgents.filter(
    (p) => p.status === "pending"
  ).length;

  const approvedTeams = teams.filter((t) => t.status === "approved").length;

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-black uppercase tracking-[0.08em]">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-white/60">
            Manage registrations and view all players in one place.
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Free Agents" value={freeAgents.length} />
          <StatCard label="Approved Free Agents" value={approvedFreeAgents} />
          <StatCard label="Pending Free Agents" value={pendingFreeAgents} />
          <StatCard label="Approved Teams" value={approvedTeams} />
        </div>

        <div className="mb-10 grid gap-4 md:grid-cols-2">
          <Link
            href="/admin/free-agents"
            className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-green-400/40 hover:bg-green-400/10"
          >
            <h2 className="text-2xl font-bold">Free Agents</h2>
            <p className="mt-2 text-sm text-white/65">
              Approve, reject, sign, and delete solo registrations.
            </p>
          </Link>

          <Link
            href="/admin/teams"
            className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-green-400/40 hover:bg-green-400/10"
          >
            <h2 className="text-2xl font-bold">Teams</h2>
            <p className="mt-2 text-sm text-white/65">
              Review team registrations and manage full rosters.
            </p>
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="text-2xl font-bold">All Players</h2>
            <p className="mt-1 text-sm text-white/60">
              Sorted from highest rank to lowest.
            </p>
          </div>

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
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {allPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-white/50">
                      No players found.
                    </td>
                  </tr>
                ) : (
                  allPlayers.map((player) => (
                    <tr
                      key={player.id}
                      className="border-t border-white/10 hover:bg-white/5"
                    >
                      <td className="px-4 py-3 font-medium">
                        {player.playerName || "Unknown Player"}
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
                      <td className="px-4 py-3 text-white/80">
                        {player.source}
                      </td>
                      <td className="px-4 py-3 text-white/80">
                        {player.teamName || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs uppercase tracking-wide text-white/80">
                          {player.status}
                        </span>
                      </td>
                    </tr>
                  ))
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