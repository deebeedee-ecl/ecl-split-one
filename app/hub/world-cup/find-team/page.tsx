import Link from "next/link";
import { ArrowLeft, ArrowRight, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { HubShell } from "../../_components/HubShell";
import { prisma } from "@/lib/prisma";
import { riotIdKey } from "@/lib/riot-id";
import { countryNameLabel, formatCountryLabel } from "@/lib/world-cup-countries";
import { WorldCupNav } from "../WorldCupNav";
import { WorldCupFlag } from "../WorldCupFlag";

export const dynamic = "force-dynamic";

type TeamPlayer = {
  playerName?: string;
  name?: string;
  riotName?: string;
  riotTag?: string;
  primaryRole?: string;
  secondaryRole?: string;
  nationality?: string;
  countryCode?: string;
  countryFlag?: string;
  teamCountry?: string;
  teamCountryCode?: string;
  teamCountryFlag?: string;
};

function cleanText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function playerName(player: TeamPlayer) {
  return cleanText(player.playerName) || cleanText(player.name) || "Player";
}

function playerRiotId(player: TeamPlayer) {
  const name = cleanText(player.riotName);
  const tag = cleanText(player.riotTag);
  return name && tag ? `${name}#${tag}` : "Riot ID pending";
}

function playerCountry(player: TeamPlayer) {
  return formatCountryLabel({
    flag: player.countryFlag || player.teamCountryFlag,
    countryName: player.nationality || player.teamCountry,
    countryCode: player.countryCode || player.teamCountryCode,
  });
}

function teamCountry(players: TeamPlayer[]) {
  const first = players.find(
    (player) =>
      cleanText(player.teamCountry) ||
      cleanText(player.teamCountryCode) ||
      cleanText(player.teamCountryFlag) ||
      cleanText(player.nationality) ||
      cleanText(player.countryCode) ||
      cleanText(player.countryFlag),
  );

  return formatCountryLabel({
    flag: first?.teamCountryFlag || first?.countryFlag,
    countryName: first?.teamCountry || first?.nationality,
    countryCode: first?.teamCountryCode || first?.countryCode,
  });
}

function teamCountryName(players: TeamPlayer[]) {
  const first = players.find(
    (player) =>
      cleanText(player.teamCountry) ||
      cleanText(player.teamCountryCode) ||
      cleanText(player.nationality) ||
      cleanText(player.countryCode),
  );

  return countryNameLabel({
    countryName: first?.teamCountry || first?.nationality,
    countryCode: first?.teamCountryCode || first?.countryCode,
  });
}

function playerCountryName(player: TeamPlayer) {
  return countryNameLabel({
    countryName: player.nationality || player.teamCountry,
    countryCode: player.countryCode || player.teamCountryCode,
  });
}

function teamCountryCode(players: TeamPlayer[]) {
  const first = players.find(
    (player) =>
      cleanText(player.teamCountryCode) ||
      cleanText(player.countryCode),
  );

  return first?.teamCountryCode || first?.countryCode || "";
}

function realPlayers(players: TeamPlayer[]) {
  return players.filter(
    (player) =>
      cleanText(player.playerName) ||
      cleanText(player.name) ||
      cleanText(player.riotName) ||
      cleanText(player.riotTag),
  );
}

export default async function WorldCupFindTeamPage() {
  const [teams, profiles, freeAgents] = await Promise.all([
    prisma.teamRegistration.findMany({
      orderBy: { submittedAt: "desc" },
    }),
    prisma.accountProfile.findMany({
      where: {
        verificationStatus: "VERIFIED",
        accountStatus: "ACTIVE",
      },
      select: {
        id: true,
        riotName: true,
        riotTag: true,
      },
    }),
    prisma.freeAgentRegistration.findMany({
      where: { status: "approved" },
      orderBy: { submittedAt: "desc" },
      take: 8,
    }),
  ]);

  const profileByRiotId = new Map(
    profiles
      .map((profile) => [riotIdKey(profile.riotName, profile.riotTag), profile.id] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[0])),
  );

  return (
    <HubShell
      active="world-cup"
      eyebrow="World Cup"
      title="Find Team"
      description="Browse approved national rosters and send applications to admins."
      theme="blue"
      hideHeader
    >
      <header className="mb-5 border border-[#2d6bff]/30 bg-[#081431]/92 p-6 shadow-[0_18px_54px_rgba(0,0,0,0.28)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#70a7ff]">
          World Cup
        </p>
        <h1 className="mt-2 text-4xl font-black uppercase leading-none tracking-normal text-white md:text-5xl">
          Team Board
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#aebfe4]">
          Browse approved national rosters, inspect players, and apply for a place.
        </p>
      </header>
      <WorldCupNav active="teams" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/hub/dashboard"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#8dbbff] transition hover:text-white"
        >
          <ArrowLeft size={15} />
          Back To World Cup
        </Link>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/hub/world-cup/apply"
            className="inline-flex min-h-10 items-center gap-2 bg-[#1456ff] px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#2d6bff]"
          >
            Apply For Team
            <UserPlus size={15} />
          </Link>
          <Link
            href="/hub/world-cup/create-team"
            className="inline-flex min-h-10 items-center gap-2 border border-[#69a7ff]/24 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#d7e6ff] transition hover:border-white/45 hover:text-white"
          >
            Create Team
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {teams.length === 0 ? (
            <section className="border border-dashed border-[#69a7ff]/24 bg-[#081431]/92 p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#d7e6ff]/45 bg-[#1456ff]/18 text-white">
                <Search size={24} />
              </div>
              <h2 className="mt-5 text-3xl font-black uppercase text-white">
                No Approved Teams Yet
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-[#aebfe4]">
                Teams will appear here once captains submit World Cup rosters.
                Players can still create a team or apply as available.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/hub/world-cup/create-team"
                  className="inline-flex min-h-11 items-center gap-2 bg-[#1456ff] px-5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#2d6bff]"
                >
                  Create Team
                </Link>
                <Link
                  href="/hub/world-cup/apply"
                  className="inline-flex min-h-11 items-center gap-2 border border-[#69a7ff]/24 px-5 text-xs font-black uppercase tracking-[0.12em] text-[#d7e6ff] transition hover:border-white/45 hover:text-white"
                >
                  Apply For Team
                </Link>
              </div>
            </section>
          ) : (
            teams.map((team, index) => {
              const players = realPlayers(Array.isArray(team.players) ? (team.players as TeamPlayer[]) : []);
              const sourcePlayers = Array.isArray(team.players) ? (team.players as TeamPlayer[]) : [];
              const countryCode = teamCountryCode(sourcePlayers);
              const countryLabel = teamCountryName(sourcePlayers);
              const openSlots = Math.max(0, 6 - players.length);

              return (
                <article
                  key={team.id}
                  className="overflow-hidden border border-[#2d6bff]/30 bg-[#081431]/92 shadow-[0_18px_54px_rgba(0,0,0,0.28)]"
                >
                  <div className="grid gap-0 lg:grid-cols-[18rem_minmax(0,1fr)]">
                    <div className="border-b border-[#69a7ff]/14 bg-[#020817]/42 p-6 lg:border-b-0 lg:border-r lg:border-[#69a7ff]/14">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8dbbff]">
                        Approved Team #{index + 1}
                      </p>
                      <h2 className="mt-3 break-words text-3xl font-black uppercase leading-tight text-white">
                        {team.teamName}
                      </h2>
                      <p className="mt-4 text-lg font-black text-[#d7e6ff]">
                        <WorldCupFlag code={countryCode} label={countryLabel} />
                      </p>
                      <p className="mt-3 text-sm font-bold text-[#aebfe4]">
                        Captain: {team.captainName}
                      </p>
                      <p className="mt-3 inline-flex border border-[#36D7FF]/18 bg-[#0755C9]/16 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#77CFFF]">
                        {team.status}
                      </p>
                      <div className="mt-5 grid grid-cols-2 gap-2 text-center">
                        <Stat label="Filled" value={`${Math.min(players.length, 6)}/6`} />
                        <Stat label="Open" value={String(openSlots)} />
                      </div>
                      <Link
                        href={`/hub/world-cup/apply?teamId=${team.id}`}
                        className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 bg-[#1456ff] px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#2d6bff]"
                      >
                        Apply
                        <UserPlus size={15} />
                      </Link>
                      <Link
                        href={`/hub/world-cup/team/${team.id}`}
                        className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 border border-[#69a7ff]/24 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#d7e6ff] transition hover:border-white/45 hover:text-white"
                      >
                        Team Dashboard
                      </Link>
                    </div>

                    <div className="divide-y divide-[#69a7ff]/12">
                      {players.length === 0 ? (
                        <p className="p-5 text-sm font-semibold text-[#aebfe4]">
                          Roster slots are open. Apply to put yourself in front of the captain and admins.
                        </p>
                      ) : (
                        players.map((player, playerIndex) => {
                          const profileId = profileByRiotId.get(
                            riotIdKey(player.riotName, player.riotTag) ?? "",
                          );

                          return (
                            <div
                              key={`${team.id}-${playerIndex}`}
                              className="grid gap-3 p-4 md:grid-cols-[4.5rem_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.9fr)_7rem] md:items-center"
                            >
                              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#8dbbff]">
                                Slot {playerIndex + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="break-words text-base font-black text-white">
                                  {playerName(player)}
                                </p>
                                <p className="mt-1 break-all text-xs font-bold text-[#8094c2]">
                                  {playerRiotId(player)}
                                </p>
                              </div>
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#aebfe4]">
                                {player.primaryRole || "Role pending"}
                                {player.secondaryRole ? ` / ${player.secondaryRole}` : ""}
                              </p>
                              <p className="text-xs font-bold text-[#d7e6ff]">
                                <WorldCupFlag
                                  code={player.countryCode || player.teamCountryCode}
                                  label={playerCountryName(player)}
                                />
                              </p>
                              {profileId ? (
                                <Link
                                  href={`/hub/players/${profileId}`}
                                  className="inline-flex min-h-9 items-center justify-center border border-[#69a7ff]/24 px-3 text-xs font-black uppercase tracking-[0.1em] text-[#d7e6ff] transition hover:border-white/45 hover:text-white"
                                >
                                  Profile
                                </Link>
                              ) : (
                                <span className="text-xs font-bold text-[#5f7fb8]">
                                  Hub pending
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <aside className="space-y-4">
          <section className="border border-[#2d6bff]/30 bg-[#081431]/92 p-5">
            <div className="flex items-center gap-3 text-[#8dbbff]">
              <Users size={18} />
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">
                Need A Roster?
              </h2>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#aebfe4]">
              Apply to a specific approved team or mark yourself available for any national roster.
            </p>
            <Link
              href="/hub/world-cup/apply"
              className="mt-4 inline-flex min-h-10 items-center gap-2 border border-[#69a7ff]/24 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#d7e6ff] transition hover:border-white/45 hover:text-white"
            >
              Apply For Team
              <ArrowRight size={15} />
            </Link>
          </section>

          <section className="border border-[#2d6bff]/30 bg-[#081431]/92 p-5">
            <div className="flex items-center gap-3 text-[#8dbbff]">
              <ShieldCheck size={18} />
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">
                Admin Approved
              </h2>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#aebfe4]">
              Teams only appear after approval. Applications land in the admin dashboard before roster moves are final.
            </p>
          </section>

          <section className="border border-[#2d6bff]/30 bg-[#020817]/55 p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8dbbff]">
              Approved Available Players
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {freeAgents.length}
            </p>
            <div className="mt-4 space-y-2">
              {freeAgents.slice(0, 5).map((agent) => (
                <div
                  key={agent.id}
                  className="border border-[#69a7ff]/14 bg-[#081431]/70 px-3 py-2"
                >
                  <p className="truncate text-sm font-black text-white">
                    {agent.playerName}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#8094c2]">
                    {agent.primaryRole}
                    {agent.secondaryRole ? ` / ${agent.secondaryRole}` : ""}
                  </p>
                </div>
              ))}
              {freeAgents.length === 0 && (
                <p className="text-sm font-semibold leading-6 text-[#aebfe4]">
                  No approved available players yet.
                </p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </HubShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#69a7ff]/14 bg-[#081431]/70 px-3 py-2">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#8094c2]">
        {label}
      </p>
    </div>
  );
}
