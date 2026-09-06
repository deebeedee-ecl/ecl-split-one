import { prisma } from "@/lib/prisma";
import {
  normalizeHubRole,
  type HubRole,
} from "@/lib/hub-profile";
import { HubShell } from "../_components/HubShell";
import { PlayersDirectoryClient, type PlayerDirectoryRow } from "./PlayersDirectoryClient";

export const dynamic = "force-dynamic";

type PlayerCard = PlayerDirectoryRow & {
  id: string;
  name: string;
  riotId: string;
  roles: HubRole[];
};

export default async function PlayersPage() {
  const profiles = await prisma.accountProfile.findMany({
    where: {
      verificationStatus: "VERIFIED",
      accountStatus: "ACTIVE",
    },
    orderBy: [{ updatedAt: "asc" }],
    select: {
      id: true,
      displayName: true,
      riotName: true,
      riotTag: true,
      primaryRole: true,
      secondaryRole: true,
    },
  });

  const players: PlayerCard[] = profiles.map((profile) => ({
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
      active="players"
      eyebrow="Player Directory"
      title="Players"
      description="Verified ECL player profiles, roles, KOOK verification, and League identity records."
    >
      {players.length === 0 ? (
        <section className="rounded-[1.3rem] border border-white/[0.08] bg-[#111217] p-8 text-sm font-bold text-[#aeb5da]">
          Verified players will appear here after KOOK verification.
        </section>
      ) : (
        <PlayersDirectoryClient players={players} />
      )}
    </HubShell>
  );
}
