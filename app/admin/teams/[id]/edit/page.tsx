import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type TeamPlayer = {
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

const roleOptions = ["Top", "Jungle", "Mid", "ADC", "Support", "Fill"];

const rankOptions = [
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger",
  "Unranked",
];

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

function normalizePlayers(players: unknown): TeamPlayer[] {
  return Array.isArray(players) ? (players as TeamPlayer[]) : [];
}

async function saveTeam(formData: FormData) {
  "use server";

  const teamId = String(formData.get("teamId") || "");

  if (!teamId) {
    redirect("/admin/teams?message=invalid");
  }

  const teamName = cleanText(String(formData.get("teamName") || ""));
  const captainName = cleanText(String(formData.get("captainName") || ""));
  const captainEmail = cleanText(String(formData.get("captainEmail") || ""));
  const logoUrl = cleanText(String(formData.get("logoUrl") || ""));
  const kitUrl = cleanText(String(formData.get("kitUrl") || ""));

  const playerNames = formData.getAll("playerName");
  const riotNames = formData.getAll("riotName");
  const riotTags = formData.getAll("riotTag");
  const primaryRoles = formData.getAll("primaryRole");
  const secondaryRoles = formData.getAll("secondaryRole");
  const currentRanks = formData.getAll("currentRank");
  const freeAgentIds = formData.getAll("freeAgentId");
  const emails = formData.getAll("playerEmail");
  const notes = formData.getAll("playerNotes");

  const players: TeamPlayer[] = playerNames
    .map((_, index) => {
      const playerName = cleanText(String(playerNames[index] || ""));
      const riotName = cleanText(String(riotNames[index] || ""));
      const riotTag = cleanText(String(riotTags[index] || ""));
      const primaryRole = cleanText(String(primaryRoles[index] || ""));
      const secondaryRole = cleanText(String(secondaryRoles[index] || ""));
      const currentRank = normalizeRank(String(currentRanks[index] || ""));
      const freeAgentId = cleanText(String(freeAgentIds[index] || ""));
      const email = cleanText(String(emails[index] || ""));
      const note = cleanText(String(notes[index] || ""));

      const isRealPlayer =
        playerName ||
        riotName ||
        riotTag ||
        primaryRole ||
        secondaryRole ||
        currentRank !== "Unranked";

      if (!isRealPlayer) return null;

      return {
        freeAgentId: freeAgentId || undefined,
        playerName: playerName || undefined,
        riotName: riotName || undefined,
        riotTag: riotTag || undefined,
        primaryRole: primaryRole || undefined,
        secondaryRole: secondaryRole || undefined,
        currentRank,
        email: email || undefined,
        notes: note || undefined,
      };
    })
    .filter(Boolean) as TeamPlayer[];

  await prisma.teamRegistration.update({
    where: { id: teamId },
    data: {
      teamName,
      captainName,
      captainEmail,
      players,
    },
  });

  await prisma.team.upsert({
    where: { name: teamName },
    update: {
      name: teamName,
      logoUrl: logoUrl || null,
      kitUrl: kitUrl || null,
    },
    create: {
      name: teamName,
      logoUrl: logoUrl || null,
      kitUrl: kitUrl || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${teamId}/edit`);
  revalidatePath("/teams");
  revalidatePath("/free-agents");

  redirect("/admin/teams?message=saved");
}

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const team = await prisma.teamRegistration.findUnique({
    where: { id },
  });

  if (!team) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/admin/teams"
            className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back to Teams
          </Link>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8 text-white/70">
            Team not found.
          </div>
        </div>
      </main>
    );
  }

  const savedTeam = await prisma.team.findFirst({
    where: {
      name: team.teamName,
    },
  });

  const players = normalizePlayers(team.players);
  const paddedPlayers = [...players];

  while (paddedPlayers.length < 7) {
    paddedPlayers.push({});
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href="/admin/teams"
            className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ← Back to Teams
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-black uppercase tracking-[0.08em]">
            Edit Team
          </h1>
          <p className="mt-2 text-white/60">
            Update team details, branding, and roster information.
          </p>
        </div>

        <form action={saveTeam} className="space-y-8">
          <input type="hidden" name="teamId" value={team.id} />

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-2xl font-bold">Team Details</h2>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Team Name
                </label>
                <input
                  name="teamName"
                  defaultValue={team.teamName}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Captain Name
                </label>
                <input
                  name="captainName"
                  defaultValue={team.captainName}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Captain Email
                </label>
                <input
                  name="captainEmail"
                  defaultValue={team.captainEmail}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-2xl font-bold">Branding</h2>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Logo URL
                </label>
                <input
                  name="logoUrl"
                  defaultValue={savedTeam?.logoUrl || ""}
                  placeholder="/logos/mfg.png"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                />

                <p className="mt-2 text-xs text-white/45">
                  Example: /logos/mfg.png
                </p>

                <div className="mt-4 flex h-32 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  {savedTeam?.logoUrl ? (
                    <img
                      src={savedTeam.logoUrl}
                      alt={`${team.teamName} logo preview`}
                      className="max-h-24 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs uppercase tracking-[0.18em] text-white/30">
                      No logo preview
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Kit URL
                </label>
                <input
                  name="kitUrl"
                  defaultValue={savedTeam?.kitUrl || ""}
                  placeholder="/kit/mfg.png"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                />

                <p className="mt-2 text-xs text-white/45">
                  Example: /kit/mfg.png
                </p>

                <div className="mt-4 flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {savedTeam?.kitUrl ? (
                    <img
                      src={savedTeam.kitUrl}
                      alt={`${team.teamName} kit preview`}
                      className="h-full max-h-36 w-auto object-contain"
                    />
                  ) : (
                    <span className="text-xs uppercase tracking-[0.18em] text-white/30">
                      No kit preview
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-2xl font-bold">Roster</h2>

            <div className="space-y-6">
              {paddedPlayers.map((player, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <h3 className="mb-4 text-lg font-bold text-white/90">
                    Player {index + 1}
                  </h3>

                  <input
                    type="hidden"
                    name="freeAgentId"
                    defaultValue={cleanText(player.freeAgentId)}
                  />
                  <input
                    type="hidden"
                    name="playerEmail"
                    defaultValue={cleanText(player.email)}
                  />
                  <input
                    type="hidden"
                    name="playerNotes"
                    defaultValue={cleanText(player.notes)}
                  />

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white/80">
                        Player Name
                      </label>
                      <input
                        name="playerName"
                        defaultValue={
                          cleanText(player.playerName) || cleanText(player.name)
                        }
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white/80">
                        Riot Name
                      </label>
                      <input
                        name="riotName"
                        defaultValue={cleanText(player.riotName)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white/80">
                        Riot Tag
                      </label>
                      <input
                        name="riotTag"
                        defaultValue={cleanText(player.riotTag)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white/80">
                        Primary Role
                      </label>
                      <select
                        name="primaryRole"
                        defaultValue={cleanText(player.primaryRole)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                      >
                        <option value="">Select role</option>
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white/80">
                        Secondary Role
                      </label>
                      <select
                        name="secondaryRole"
                        defaultValue={cleanText(player.secondaryRole)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                      >
                        <option value="">None</option>
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white/80">
                        Rank
                      </label>
                      <select
                        name="currentRank"
                        defaultValue={normalizeRank(
                          cleanText(player.currentRank) || cleanText(player.rank)
                        )}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                      >
                        {rankOptions.map((rank) => (
                          <option key={rank} value={rank}>
                            {rank}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              Save Team Changes
            </button>

            <Link
              href="/admin/teams"
              className="rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}