import Image from "next/image";
import Link from "next/link";
import { Minus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  HUB_ROLE_ICONS,
  hubRoleLabel,
  normalizeHubRole,
  type HubRole,
} from "@/lib/hub-profile";
import { HubShell } from "../_components/HubShell";

export const dynamic = "force-dynamic";

type LadderRow = {
  id: string;
  rank: number;
  player: string;
  riotId: string;
  elo: number;
  record: string;
  mostPlayedRole: HubRole | null;
};

export default async function RankedLadderPage() {
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
    },
  });

  const rows: LadderRow[] = profiles.map((profile, index) => ({
    id: profile.id,
    rank: index + 1,
    player: profile.displayName,
    riotId: `${profile.riotName}#${profile.riotTag}`,
    elo: 800,
    record: "0-0",
    mostPlayedRole: normalizeHubRole(profile.primaryRole),
  }));

  return (
    <HubShell
      active="ladder"
      eyebrow="Ranked Inhouse"
      title="Ranked Ladder"
      description="ECL ranked inhouse standings, player form, ELO movement, MVPs, and season records."
    >
      <section className="overflow-hidden border border-white/[0.08] bg-[#24252d] shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
        <div className="border-b border-white/[0.08] bg-[#191a21] px-5 py-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1728]">
            Verified players
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase text-white">
            Ranked Standings
          </h2>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-sm font-bold text-[#aeb5da]">
            The ranked ladder will populate as players complete KOOK verification.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse">
              <thead>
                <tr className="border-b border-black/35 bg-[#25262f] text-left text-lg text-[#98a1c7]">
                  <TableHead className="w-24">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="w-32 text-center">ELO</TableHead>
                  <TableHead className="w-32 text-center">Record</TableHead>
                  <TableHead className="w-40 text-center">Main role</TableHead>
                  <TableHead>Highest winrate champs</TableHead>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-black/35 bg-[#30313c] text-[#d7dcff] last:border-b-0 odd:bg-[#333440]"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-white">#{row.rank}</span>
                        <Minus color="#8f98c0" size={24} strokeWidth={3} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/hub/players/${row.id}`} className="group">
                        <p className="text-xl font-black text-white group-hover:text-[#ffd84d]">
                          {row.player}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#8f98c0]">{row.riotId}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-center text-2xl font-black text-[#ffd84d]">
                      {row.elo}
                    </td>
                    <td className="px-4 py-4 text-center text-xl font-black text-white">
                      <span className="text-[#20b86f]">0</span>
                      <span className="text-[#8f98c0]">-</span>
                      <span className="text-[#ff4058]">0</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {row.mostPlayedRole ? (
                        <div className="inline-flex items-center gap-3 bg-[#20212a] px-3 py-2">
                          <Image
                            src={HUB_ROLE_ICONS[row.mostPlayedRole]}
                            alt={hubRoleLabel(row.mostPlayedRole)}
                            width={28}
                            height={28}
                            className="opacity-70"
                          />
                          <span className="text-sm font-black text-white">
                            {hubRoleLabel(row.mostPlayedRole)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-black text-[#8f98c0]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-[#8f98c0]">
                      Records will populate from ranked inhouse games.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </HubShell>
  );
}

function TableHead({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-4 py-4 font-medium ${className}`}>{children}</th>;
}
