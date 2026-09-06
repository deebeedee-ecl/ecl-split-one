import {
  normalizeHubRole,
  type HubRole,
} from "@/lib/hub-profile";
import { prisma } from "@/lib/prisma";
import { riotIdKey } from "@/lib/riot-id";
import { HubShell } from "../../_components/HubShell";
import { PlayersDirectoryClient, type PlayerDirectoryRow } from "../../players/PlayersDirectoryClient";
import { WorldCupNav } from "../WorldCupNav";

export const dynamic = "force-dynamic";

type TeamPlayer = {
  playerName?: string;
  name?: string;
  riotName?: string;
  riotTag?: string;
};

function clean(value?: string | null) {
  return value?.trim() || "";
}

function realRosterPlayers(players: unknown) {
  return Array.isArray(players)
    ? (players as TeamPlayer[]).filter((player) =>
        Boolean(clean(player.playerName) || clean(player.name) || clean(player.riotName) || clean(player.riotTag)),
      )
    : [];
}

export default async function WorldCupPlayersPage() {
  const [teamRegistrations, applications] = await Promise.all([
    prisma.teamRegistration.findMany({
      select: {
        players: true,
      },
    }),
    prisma.freeAgentRegistration.findMany({
      where: {
        notes: {
          contains: "World Cup Team Application",
        },
      },
      select: {
        riotName: true,
        riotTag: true,
      },
    }),
  ]);

  const riotKeys = new Set<string>();

  for (const team of teamRegistrations) {
    for (const player of realRosterPlayers(team.players)) {
      const key = riotIdKey(player.riotName, player.riotTag);
      if (key) riotKeys.add(key);
    }
  }

  for (const application of applications) {
    const key = riotIdKey(application.riotName, application.riotTag);
    if (key) riotKeys.add(key);
  }

  const profiles = await prisma.accountProfile.findMany({
    where: {
      verificationStatus: "VERIFIED",
      accountStatus: "ACTIVE",
    },
    orderBy: [{ displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      riotName: true,
      riotTag: true,
      primaryRole: true,
      secondaryRole: true,
    },
  });

  const players: PlayerDirectoryRow[] = profiles
    .filter((profile) => riotKeys.has(riotIdKey(profile.riotName, profile.riotTag) ?? ""))
    .map((profile) => ({
      id: profile.id,
      name: profile.displayName,
      riotId: `${profile.riotName}#${profile.riotTag}`,
      roles: [normalizeHubRole(profile.primaryRole), normalizeHubRole(profile.secondaryRole)].filter(
        Boolean,
      ) as HubRole[],
      primaryRole: normalizeHubRole(profile.primaryRole),
      secondaryRole: normalizeHubRole(profile.secondaryRole),
    }));

  return (
    <HubShell
      active="world-cup"
      eyebrow="World Cup"
      title="Players"
      description="Verified Hub profiles attached to World Cup teams and applications."
      theme="blue"
      hideHeader
    >
      <header className="mb-5 border border-[#0797F2]/30 bg-[#061C4A]/92 p-6 shadow-[0_18px_54px_rgba(0,0,0,0.28)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#36D7FF]">
          World Cup
        </p>
        <h1 className="mt-2 text-4xl font-black uppercase leading-none tracking-normal text-white md:text-5xl">
          Players
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#C9DFEB]">
          Scout verified players who are attached to a World Cup roster or application.
        </p>
      </header>

      <WorldCupNav active="players" />

      {players.length === 0 ? (
        <section className="border border-[#0797F2]/30 bg-[#061C4A]/92 p-8 text-sm font-bold text-[#C9DFEB]">
          World Cup players will appear here once rosters or applications match verified Hub profiles.
        </section>
      ) : (
        <PlayersDirectoryClient players={players} />
      )}
    </HubShell>
  );
}
