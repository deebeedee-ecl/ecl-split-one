import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  HUB_ROLE_ICONS,
  hubRoleLabel,
  normalizeHubRole,
  type HubRole,
} from "@/lib/hub-profile";
import { HubShell } from "../_components/HubShell";

export const dynamic = "force-dynamic";

type PlayerCard = {
  id: string;
  name: string;
  riotId: string;
  rank: number;
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

  const players: PlayerCard[] = profiles.map((profile, index) => ({
    id: profile.id,
    name: profile.displayName,
    riotId: `${profile.riotName}#${profile.riotTag}`,
    rank: index + 1,
    roles: [normalizeHubRole(profile.primaryRole), normalizeHubRole(profile.secondaryRole)].filter(
      Boolean,
    ) as HubRole[],
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
        <section className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
          {players.map((player) => (
            <Link
              key={player.id}
              href={`/hub/players/${player.id}`}
              className="group relative min-h-[6.55rem] overflow-hidden rounded-[0.9rem] border border-white/10 bg-[#111217] p-3 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_10px_28px_rgba(0,0,0,0.34)] transition duration-200 hover:-translate-y-1 hover:scale-[1.025] hover:border-[#ff1728]/55 hover:shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_18px_46px_rgba(0,0,0,0.52),0_0_24px_rgba(255,23,40,0.12)]"
            >
              <div
                className="pointer-events-none absolute inset-0 rounded-[0.9rem]"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.1), transparent 28%), radial-gradient(circle at 88% 6%, rgba(255,23,40,0.18), transparent 42%), linear-gradient(180deg, rgba(255,216,77,0.055), transparent 58%)",
                }}
              />
              <div className="pointer-events-none absolute inset-[1px] rounded-[0.85rem] border border-white/[0.045]" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r from-[#ff1728] via-[#ff4058] to-transparent opacity-85" />
              <div className="relative flex h-full flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black leading-none text-white transition group-hover:text-[#ffd84d]">
                      {player.name}
                    </h2>
                    <p className="mt-2 truncate text-[0.68rem] font-bold text-[#8f98c0]">
                      {player.riotId}
                    </p>
                    <p className="mt-2 inline-flex rounded-full border border-[#ffd84d]/25 bg-[#ffd84d]/10 px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em] text-[#ffd84d]">
                      #{player.rank}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    {player.roles.map((role) => (
                      <span
                        key={`${player.id}-${role}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ffd84d]/25 bg-[#ff1728]/18 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_0_18px_rgba(255,23,40,0.2)]"
                        title={hubRoleLabel(role)}
                      >
                        <Image
                          src={HUB_ROLE_ICONS[role]}
                          alt={hubRoleLabel(role)}
                          width={23}
                          height={23}
                          className="opacity-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.22)]"
                        />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <span />
                  <span className="h-1.5 w-10 rounded-full bg-[#ff1728]" />
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </HubShell>
  );
}
