import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  countryByCode,
  countryFlagImagePath,
  worldCupCountries,
} from "@/lib/world-cup-countries";
import {
  notesWithCaptainDecision,
  parseWorldCupApplication,
} from "@/lib/world-cup-applications";

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
  nationality?: string;
  countryCode?: string;
  countryFlag?: string;
  teamCountry?: string;
  teamCountryCode?: string;
  teamCountryFlag?: string;
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

function teamCountryCode(players: TeamPlayer[]) {
  const first = players.find(
    (player) => cleanText(player.teamCountryCode) || cleanText(player.countryCode),
  );

  return cleanText(first?.teamCountryCode) || cleanText(first?.countryCode);
}

function normalizeTeamKey(value?: string | null) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isRosterPlayer(player: TeamPlayer) {
  return Boolean(
    cleanText(player.playerName || player.name) ||
      cleanText(player.riotName) ||
      cleanText(player.riotTag),
  );
}

function sameRosterPlayer(
  player: TeamPlayer,
  freeAgentId: string,
  email: string,
  riotName: string,
  riotTag: string,
  playerName: string,
) {
  const rosterFreeAgentId = cleanText(player.freeAgentId);
  const rosterEmail = cleanText(player.email).toLowerCase();
  const rosterRiotName = cleanText(player.riotName).toLowerCase();
  const rosterRiotTag = cleanText(player.riotTag).toLowerCase();
  const rosterPlayerName = cleanText(player.playerName || player.name).toLowerCase();

  const targetEmail = cleanText(email).toLowerCase();
  const targetRiotName = cleanText(riotName).toLowerCase();
  const targetRiotTag = cleanText(riotTag).toLowerCase();
  const targetPlayerName = cleanText(playerName).toLowerCase();

  if (rosterFreeAgentId && rosterFreeAgentId === freeAgentId) return true;
  if (targetEmail && rosterEmail && rosterEmail === targetEmail) return true;

  if (
    targetRiotName &&
    targetRiotTag &&
    rosterRiotName &&
    rosterRiotTag &&
    rosterRiotName === targetRiotName &&
    rosterRiotTag === targetRiotTag
  ) {
    return true;
  }

  if (targetPlayerName && rosterPlayerName && rosterPlayerName === targetPlayerName) {
    return true;
  }

  return false;
}

function revalidateTeamAdminPaths(teamId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${teamId}/edit`);
  revalidatePath("/admin/free-agents");
  revalidatePath("/teams");
  revalidatePath("/free-agents");
  revalidatePath("/hub/world-cup/find-team");
  revalidatePath("/hub/world-cup/standings");
  revalidatePath(`/hub/world-cup/team/${teamId}`);
}

function messageText(message?: string) {
  if (message === "player-accepted") return "Player accepted and added to the roster.";
  if (message === "player-rejected") return "Player application rejected.";
  if (message === "roster-full") return "That roster already has 6 players.";
  if (message === "wrong-team") return "That application belongs to another team.";
  if (message === "missing-application") return "That player application was not found.";
  if (message === "invalid") return "Something was missing from the request.";
  return "";
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
  const countryCode = cleanText(String(formData.get("teamCountryCode") || "")).toUpperCase();
  const country = countryByCode(countryCode);

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
        teamCountry: country?.name || undefined,
        teamCountryCode: country?.code || undefined,
        teamCountryFlag: country?.flag || undefined,
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
      logoUrl: null,
      kitUrl: null,
    },
    create: {
      name: teamName,
      logoUrl: null,
      kitUrl: null,
    },
  });

  revalidateTeamAdminPaths(teamId);

  redirect("/admin/teams?message=saved");
}

async function acceptTeamApplication(formData: FormData) {
  "use server";

  const teamId = cleanText(String(formData.get("teamId") || ""));
  const applicationId = cleanText(String(formData.get("applicationId") || ""));

  if (!teamId || !applicationId) {
    redirect(`/admin/teams/${teamId || ""}/edit?message=invalid`);
  }

  const [team, application] = await Promise.all([
    prisma.teamRegistration.findUnique({ where: { id: teamId } }),
    prisma.freeAgentRegistration.findUnique({ where: { id: applicationId } }),
  ]);

  if (!team || !application) {
    redirect(`/admin/teams/${teamId}/edit?message=missing-application`);
  }

  const applicationMeta = parseWorldCupApplication(application.notes);
  const requestedTeamId = cleanText(applicationMeta.requestedTeamId);
  const requestedTeamName = cleanText(applicationMeta.requestedTeam);
  const belongsToTeam =
    !applicationMeta.isWorldCup ||
    requestedTeamId === team.id ||
    normalizeTeamKey(requestedTeamName) === normalizeTeamKey(team.teamName);

  if (!belongsToTeam) {
    redirect(`/admin/teams/${teamId}/edit?message=wrong-team`);
  }

  const countryCode = teamCountryCode(normalizePlayers(team.players));
  const country = countryByCode(countryCode);
  const existingPlayers = normalizePlayers(team.players);
  const alreadyExists = existingPlayers.some((player) =>
    sameRosterPlayer(
      player,
      application.id,
      application.email,
      application.riotName,
      application.riotTag,
      application.playerName,
    ),
  );

  if (!alreadyExists && existingPlayers.filter(isRosterPlayer).length >= 6) {
    redirect(`/admin/teams/${teamId}/edit?message=roster-full`);
  }

  await prisma.$transaction(async (tx) => {
    const savedTeam = await tx.team.upsert({
      where: { name: team.teamName },
      update: { name: team.teamName },
      create: {
        name: team.teamName,
        logoUrl: null,
        kitUrl: null,
      },
      select: { id: true, name: true },
    });

    const allTeamRegistrations = await tx.teamRegistration.findMany({
      select: { id: true, players: true },
    });

    for (const registration of allTeamRegistrations) {
      const registrationPlayers = normalizePlayers(registration.players);
      const filteredPlayers = registrationPlayers.filter(
        (player) =>
          !sameRosterPlayer(
            player,
            application.id,
            application.email,
            application.riotName,
            application.riotTag,
            application.playerName,
          ),
      );

      if (filteredPlayers.length !== registrationPlayers.length) {
        await tx.teamRegistration.update({
          where: { id: registration.id },
          data: { players: filteredPlayers },
        });
      }
    }

    const nextRosterEntry: TeamPlayer = {
      freeAgentId: application.id,
      playerName: application.playerName || application.riotName || "Unknown Player",
      riotName: application.riotName || undefined,
      riotTag: application.riotTag || undefined,
      primaryRole: application.primaryRole || undefined,
      secondaryRole: application.secondaryRole || undefined,
      currentRank: normalizeRank(application.currentRank),
      email: application.email || undefined,
      notes: notesWithCaptainDecision(application.notes, "Accepted") || undefined,
      nationality: applicationMeta.nationality || undefined,
      countryCode: applicationMeta.nationalityCode || undefined,
      teamCountry: country?.name || undefined,
      teamCountryCode: country?.code || undefined,
      teamCountryFlag: country?.flag || undefined,
    };

    const latestTeam = await tx.teamRegistration.findUnique({
      where: { id: team.id },
      select: { players: true },
    });
    const latestPlayers = normalizePlayers(latestTeam?.players);

    await tx.teamRegistration.update({
      where: { id: team.id },
      data: { players: [...latestPlayers, nextRosterEntry] },
    });

    await tx.freeAgentRegistration.update({
      where: { id: application.id },
      data: {
        status: "signed",
        signedToTeamId: savedTeam.id,
        signedToTeamName: savedTeam.name,
        notes: notesWithCaptainDecision(application.notes, "Accepted"),
      },
    });

    const matchedPlayer = application.email
      ? await tx.player.findFirst({
          where: { email: application.email },
          select: { id: true },
        })
      : application.riotName && application.riotTag
        ? await tx.player.findFirst({
            where: {
              riotName: application.riotName,
              riotTag: application.riotTag,
            },
            select: { id: true },
          })
        : null;

    if (matchedPlayer) {
      await tx.player.update({
        where: { id: matchedPlayer.id },
        data: { teamId: savedTeam.id },
      });
    }
  });

  revalidateTeamAdminPaths(teamId);
  redirect(`/admin/teams/${teamId}/edit?message=player-accepted`);
}

async function rejectTeamApplication(formData: FormData) {
  "use server";

  const teamId = cleanText(String(formData.get("teamId") || ""));
  const applicationId = cleanText(String(formData.get("applicationId") || ""));

  if (!teamId || !applicationId) {
    redirect(`/admin/teams/${teamId || ""}/edit?message=invalid`);
  }

  const [team, application] = await Promise.all([
    prisma.teamRegistration.findUnique({ where: { id: teamId } }),
    prisma.freeAgentRegistration.findUnique({ where: { id: applicationId } }),
  ]);

  if (!team || !application) {
    redirect(`/admin/teams/${teamId}/edit?message=missing-application`);
  }

  const applicationMeta = parseWorldCupApplication(application.notes);
  const belongsToTeam =
    !applicationMeta.isWorldCup ||
    cleanText(applicationMeta.requestedTeamId) === team.id ||
    normalizeTeamKey(applicationMeta.requestedTeam) === normalizeTeamKey(team.teamName);

  if (!belongsToTeam) {
    redirect(`/admin/teams/${teamId}/edit?message=wrong-team`);
  }

  await prisma.freeAgentRegistration.update({
    where: { id: application.id },
    data: {
      status: "rejected",
      signedToTeamId: null,
      signedToTeamName: null,
      notes: notesWithCaptainDecision(application.notes, "Rejected"),
    },
  });

  revalidateTeamAdminPaths(teamId);
  redirect(`/admin/teams/${teamId}/edit?message=player-rejected`);
}

export default async function EditTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ message?: string | string[] }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawMessage = resolvedSearchParams.message;
  const pageMessage = messageText(Array.isArray(rawMessage) ? rawMessage[0] : rawMessage);

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

  const players = normalizePlayers(team.players);
  const paddedPlayers = [...players];

  while (paddedPlayers.length < 6) {
    paddedPlayers.push({});
  }

  const selectedCountryCode = teamCountryCode(players);
  const selectedCountry = countryByCode(selectedCountryCode);
  const selectedFlagSrc = countryFlagImagePath(selectedCountryCode);
  const applications = (
    await prisma.freeAgentRegistration.findMany({
      orderBy: { submittedAt: "desc" },
    })
  )
    .map((application) => ({
      ...application,
      meta: parseWorldCupApplication(application.notes),
    }))
    .filter((application) => {
      if (!application.meta.isWorldCup) return false;

      return (
        cleanText(application.meta.requestedTeamId) === team.id ||
        normalizeTeamKey(application.meta.requestedTeam) === normalizeTeamKey(team.teamName)
      );
    });

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
            Update team details, World Cup flag, and roster information.
          </p>
        </div>

        {pageMessage ? (
          <div className="mb-6 rounded-2xl border border-green-400/30 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-100">
            {pageMessage}
          </div>
        ) : null}

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
                  Captain Account Contact
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
            <h2 className="mb-4 text-2xl font-bold">World Cup Flag</h2>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Team Country
                </label>
                <select
                  name="teamCountryCode"
                  defaultValue={selectedCountryCode}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                >
                  <option value="">Select country</option>
                  {worldCupCountries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-white/45">
                  This flag is used as the World Cup team identity across Hub pages.
                </p>
              </div>

              <div className="flex min-h-32 items-center justify-center rounded-2xl border border-white/10 bg-black/20 p-4">
                {selectedFlagSrc ? (
                  <img
                    src={selectedFlagSrc}
                    alt={selectedCountry?.name || "Team flag"}
                    className="h-20 w-32 rounded object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.2)]"
                  />
                ) : (
                  <span className="text-xs uppercase tracking-[0.18em] text-white/30">
                    No flag selected
                  </span>
                )}
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

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Join Applications</h2>
              <p className="mt-1 text-sm text-white/55">
                Review World Cup players who asked to join this team.
              </p>
            </div>
            <Link
              href="/admin/free-agents"
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              View All Free Agents
            </Link>
          </div>

          {applications.length ? (
            <div className="space-y-3">
              {applications.map((application) => {
                const alreadyOnRoster = players.some((player) =>
                  sameRosterPlayer(
                    player,
                    application.id,
                    application.email,
                    application.riotName,
                    application.riotTag,
                    application.playerName,
                  ),
                );
                const rosterFull = players.filter(isRosterPlayer).length >= 6 && !alreadyOnRoster;
                const signedToThisTeam =
                  application.status === "signed" &&
                  normalizeTeamKey(application.signedToTeamName) === normalizeTeamKey(team.teamName);
                const canAccept =
                  !rosterFull && !alreadyOnRoster && application.status !== "signed";

                return (
                  <div
                    key={application.id}
                    className="grid gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-white">
                          {application.playerName}
                        </h3>
                        <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/65">
                          {application.status}
                        </span>
                        {application.meta.captainDecision ? (
                          <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
                            Captain {application.meta.captainDecision}
                          </span>
                        ) : null}
                        {alreadyOnRoster || signedToThisTeam ? (
                          <span className="rounded-full border border-green-300/25 bg-green-400/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-green-100">
                            On roster
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 grid gap-2 text-sm text-white/65 md:grid-cols-3">
                        <div>
                          <span className="block text-xs uppercase tracking-[0.14em] text-white/35">
                            Riot ID
                          </span>
                          {application.riotName}#{application.riotTag}
                        </div>
                        <div>
                          <span className="block text-xs uppercase tracking-[0.14em] text-white/35">
                            Roles
                          </span>
                          {application.primaryRole}
                          {application.secondaryRole ? ` / ${application.secondaryRole}` : ""}
                        </div>
                        <div>
                          <span className="block text-xs uppercase tracking-[0.14em] text-white/35">
                            Rank
                          </span>
                          {normalizeRank(application.currentRank)}
                        </div>
                      </div>

                      {application.meta.pitch ? (
                        <p className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white/65">
                          {application.meta.pitch}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      {canAccept ? (
                        <form action={acceptTeamApplication}>
                          <input type="hidden" name="teamId" value={team.id} />
                          <input
                            type="hidden"
                            name="applicationId"
                            value={application.id}
                          />
                          <button
                            type="submit"
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500"
                          >
                            Accept to Roster
                          </button>
                        </form>
                      ) : (
                        <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/45">
                          {rosterFull ? "Roster Full" : "No Action Needed"}
                        </span>
                      )}

                      {application.status !== "rejected" && application.status !== "signed" ? (
                        <form action={rejectTeamApplication}>
                          <input type="hidden" name="teamId" value={team.id} />
                          <input
                            type="hidden"
                            name="applicationId"
                            value={application.id}
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-red-300/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
                          >
                            Reject
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-5 text-sm text-white/55">
              No join applications are attached to this team yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
