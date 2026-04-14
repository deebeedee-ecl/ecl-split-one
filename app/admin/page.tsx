import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SyncPlayersButton from "@/components/admin/SyncPlayersButton";

export const dynamic = "force-dynamic";

const rankOrder = [
  "CHALLENGER",
  "GRANDMASTER",
  "MASTER",
  "DIAMOND",
  "EMERALD",
  "PLATINUM",
  "GOLD",
  "SILVER",
  "BRONZE",
  "IRON",
  "UNRANKED",
];

type SortKey = "rank" | "player" | "source" | "team" | "status";
type SortDirection = "asc" | "desc";

function normalizeRank(rank?: string | null) {
  if (!rank) return "UNRANKED";

  const upper = rank.trim().toUpperCase();

  if (upper.includes("CHALLENGER")) return "CHALLENGER";
  if (upper.includes("GRANDMASTER")) return "GRANDMASTER";
  if (upper.includes("MASTER")) return "MASTER";
  if (upper.includes("DIAMOND")) return "DIAMOND";
  if (upper.includes("EMERALD")) return "EMERALD";
  if (upper.includes("PLATINUM")) return "PLATINUM";
  if (upper.includes("GOLD")) return "GOLD";
  if (upper.includes("SILVER")) return "SILVER";
  if (upper.includes("BRONZE")) return "BRONZE";
  if (upper.includes("IRON")) return "IRON";

  return "UNRANKED";
}

function getRankValue(rank?: string | null) {
  const normalized = normalizeRank(rank);
  const index = rankOrder.indexOf(normalized);
  return index === -1 ? 999 : index;
}

function getStatusValue(status?: string | null) {
  const value = (status || "").trim().toLowerCase();

  if (value === "approved") return 0;
  if (value === "signed") return 1;
  if (value === "pending") return 2;
  if (value === "rejected") return 3;

  return 999;
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
  freeAgentId?: string;
  playerName?: string;
  name?: string;
  riotName?: string;
  riotTag?: string;
  primaryRole?: string;
  secondaryRole?: string;
  currentRank?: string;
  rank?: string;
  email?: string;
  notes?: string;
};

function cleanText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function isRealTeamPlayer(player: TeamPlayerJson) {
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

function compareText(a: string, b: string, direction: SortDirection) {
  return direction === "asc" ? a.localeCompare(b) : b.localeCompare(a);
}

function compareNumber(a: number, b: number, direction: SortDirection) {
  return direction === "asc" ? a - b : b - a;
}

function getNextDirection(
  currentSort: SortKey,
  currentDir: SortDirection,
  clickedSort: SortKey
): SortDirection {
  if (currentSort === clickedSort) {
    return currentDir === "asc" ? "desc" : "asc";
  }

  if (clickedSort === "rank") return "asc";
  return "asc";
}

function SortLink({
  label,
  sortKey,
  currentSort,
  currentDir,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDirection;
}) {
  const isActive = currentSort === sortKey;
  const nextDir = getNextDirection(currentSort, currentDir, sortKey);

  return (
    <Link
      href={`/admin?sort=${sortKey}&dir=${nextDir}`}
      className={`inline-flex items-center gap-1 transition ${
        isActive ? "text-green-300" : "text-white/70 hover:text-white"
      }`}
    >
      <span>{label}</span>
      {isActive && <span>{currentDir === "asc" ? "↑" : "↓"}</span>}
    </Link>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ sort?: string; dir?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const requestedSort = resolvedSearchParams?.sort;
  const requestedDir = resolvedSearchParams?.dir;

  const sort: SortKey =
    requestedSort === "player" ||
    requestedSort === "source" ||
    requestedSort === "team" ||
    requestedSort === "status" ||
    requestedSort === "rank"
      ? requestedSort
      : "rank";

  const dir: SortDirection =
    requestedDir === "desc" || requestedDir === "asc"
      ? requestedDir
      : sort === "rank"
      ? "asc"
      : "asc";

  const [
    freeAgents,
    teams,
    leagueWireCount,
    visibleLeagueWireCount,
    totalMatches,
    scheduledMatches,
    completedMatches,
  ] = await Promise.all([
    prisma.freeAgentRegistration.findMany({
      orderBy: { submittedAt: "desc" },
    }),
    prisma.teamRegistration.findMany({
      orderBy: { submittedAt: "desc" },
    }),
    prisma.leagueWireItem.count(),
    prisma.leagueWireItem.count({
      where: {
        isVisible: true,
      },
    }),
    prisma.match.count(),
    prisma.match.count({
      where: {
        status: "SCHEDULED",
      },
    }),
    prisma.match.count({
      where: {
        status: "COMPLETED",
      },
    }),
  ]);

  const freeAgentPlayers: CombinedPlayer[] = freeAgents
    .filter(
      (player) =>
        player.status !== "signed" &&
        (cleanText(player.playerName) ||
          cleanText(player.riotName) ||
          cleanText(player.riotTag))
    )
    .map((player) => ({
      id: player.id,
      playerName:
        cleanText(player.playerName) ||
        cleanText(player.riotName) ||
        "Unknown Player",
      riotName: cleanText(player.riotName),
      riotTag: cleanText(player.riotTag),
      primaryRole: cleanText(player.primaryRole),
      secondaryRole: cleanText(player.secondaryRole),
      currentRank: normalizeRank(player.currentRank),
      status: player.status,
      source: "Free Agent",
      teamName: cleanText(player.signedToTeamName),
      submittedAt: player.submittedAt,
    }));

  const teamPlayers: CombinedPlayer[] = teams.flatMap((team) => {
    const players = Array.isArray(team.players)
      ? (team.players as TeamPlayerJson[])
      : [];

    return players.filter(isRealTeamPlayer).map((player, index) => ({
      id: `${team.id}-${index}`,
      playerName:
        cleanText(player.playerName) ||
        cleanText(player.name) ||
        cleanText(player.riotName) ||
        "Unknown Player",
      riotName: cleanText(player.riotName),
      riotTag: cleanText(player.riotTag),
      primaryRole: cleanText(player.primaryRole),
      secondaryRole: cleanText(player.secondaryRole),
      currentRank: normalizeRank(player.currentRank || player.rank),
      status: team.status,
      source: "Team" as const,
      teamName: team.teamName,
      submittedAt: team.submittedAt,
    }));
  });

  const allPlayers = [...freeAgentPlayers, ...teamPlayers].sort((a, b) => {
    if (sort === "rank") {
      const diff = compareNumber(
        getRankValue(a.currentRank),
        getRankValue(b.currentRank),
        dir
      );
      if (diff !== 0) return diff;
      return a.playerName.localeCompare(b.playerName);
    }

    if (sort === "player") {
      const diff = compareText(a.playerName, b.playerName, dir);
      if (diff !== 0) return diff;
      return getRankValue(a.currentRank) - getRankValue(b.currentRank);
    }

    if (sort === "source") {
      const diff = compareText(a.source, b.source, dir);
      if (diff !== 0) return diff;
      return a.playerName.localeCompare(b.playerName);
    }

    if (sort === "team") {
      const diff = compareText(a.teamName || "", b.teamName || "", dir);
      if (diff !== 0) return diff;
      return a.playerName.localeCompare(b.playerName);
    }

    if (sort === "status") {
      const diff = compareNumber(
        getStatusValue(a.status),
        getStatusValue(b.status),
        dir
      );
      if (diff !== 0) return diff;
      return a.playerName.localeCompare(b.playerName);
    }

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
            Manage registrations, homepage updates, and view all players in one
            place.
          </p>
        </div>

        <div className="mb-8">
          <SyncPlayersButton />
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Free Agents" value={freeAgents.length} />
          <StatCard label="Approved Free Agents" value={approvedFreeAgents} />
          <StatCard label="Pending Free Agents" value={pendingFreeAgents} />
          <StatCard label="Approved Teams" value={approvedTeams} />
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Matches" value={totalMatches} />
          <StatCard label="Scheduled Matches" value={scheduledMatches} />
          <StatCard label="Completed Matches" value={completedMatches} />
        </div>

        <div className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

          <Link
            href="/admin/matches"
            className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-green-400/40 hover:bg-green-400/10"
          >
            <h2 className="text-2xl font-bold">Matches</h2>
            <p className="mt-2 text-sm text-white/65">
              Create fixtures and manage match records for schedule and results.
            </p>
          </Link>

          <Link
            href="/admin/league-wire"
            className="rounded-2xl border border-green-400/20 bg-green-500/10 p-6 transition hover:border-green-400/50 hover:bg-green-400/15"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold">League Wire</h2>
              <span className="rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-300">
                {visibleLeagueWireCount}/{leagueWireCount}
              </span>
            </div>
            <p className="mt-2 text-sm text-white/65">
              Manage homepage ticker updates and control which items are live.
            </p>
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="text-2xl font-bold">All Players</h2>
            <p className="mt-1 text-sm text-white/60">
              Click a header to sort the table.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-left text-white/70">
                <tr>
                  <th className="px-4 py-3">
                    <SortLink
                      label="Player"
                      sortKey="player"
                      currentSort={sort}
                      currentDir={dir}
                    />
                  </th>
                  <th className="px-4 py-3">Riot ID</th>
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3">
                    <SortLink
                      label="Rank"
                      sortKey="rank"
                      currentSort={sort}
                      currentDir={dir}
                    />
                  </th>
                  <th className="px-4 py-3">Primary</th>
                  <th className="px-4 py-3">Secondary</th>
                  <th className="px-4 py-3">
                    <SortLink
                      label="Source"
                      sortKey="source"
                      currentSort={sort}
                      currentDir={dir}
                    />
                  </th>
                  <th className="px-4 py-3">
                    <SortLink
                      label="Team"
                      sortKey="team"
                      currentSort={sort}
                      currentDir={dir}
                    />
                  </th>
                  <th className="px-4 py-3">
                    <SortLink
                      label="Status"
                      sortKey="status"
                      currentSort={sort}
                      currentDir={dir}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {allPlayers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-white/50"
                    >
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
                        {player.playerName}
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