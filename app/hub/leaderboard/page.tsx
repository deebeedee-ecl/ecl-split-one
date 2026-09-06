import Image from "next/image";
import Link from "next/link";
import { Minus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getFrozenInhouseLeaderboardRows,
} from "@/lib/inhouse-leaderboard";
import {
  HUB_ROLE_ICONS,
  hubRoleLabel,
  normalizeHubRole,
  type HubRole,
} from "@/lib/hub-profile";
import { HubShell } from "../_components/HubShell";
import { riotIdKey } from "@/lib/riot-id";

export const dynamic = "force-dynamic";

type LadderRow = {
  profileId: string | null;
  rank: number;
  displayName: string;
  riotId: string | null;
  elo: number;
  wins: number;
  losses: number;
  winRate: string;
  streak: string;
  primaryRole: HubRole | null;
};

function cleanTag(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^#+/, "");
}

export default async function RankedLadderPage() {
  // Get all verified profiles for display names + role + profile links
  const profiles = await prisma.accountProfile.findMany({
    where: { verificationStatus: "VERIFIED", accountStatus: "ACTIVE" },
    select: {
      id: true,
      displayName: true,
      riotName: true,
      riotTag: true,
      primaryRole: true,
    },
  });

  // Build ladder rows from every reported ranked inhouse.
  const ladderRows: LadderRow[] = (await getFrozenInhouseLeaderboardRows())
    .map((p, index) => {
      const playerRiotKey = riotIdKey(p.riotName, p.riotTag);
      const profile = profiles.find(
        (pr) => riotIdKey(pr.riotName, pr.riotTag) === playerRiotKey,
      );
      const gamesPlayed = p.wins + p.losses;
      return {
        profileId: profile?.id ?? null,
        rank: index + 1,
        displayName: profile?.displayName ?? p.name,
        riotId: p.riotName
          ? p.riotTag
            ? `${p.riotName}#${cleanTag(p.riotTag)}`
            : p.riotName
          : null,
        elo: p.elo,
        wins: p.wins,
        losses: p.losses,
        winRate: gamesPlayed === 0 ? "-" : `${Math.round((p.wins / gamesPlayed) * 100)}%`,
        streak: p.streak,
        primaryRole: normalizeHubRole(profile?.primaryRole),
      };
    });

  return (
    <HubShell
      active="ladder"
      eyebrow="Ranked Inhouse"
      title="Ranked Ladder"
      description="ECL ranked inhouse standings. Updates after every reported game."
    >
      <section className="overflow-hidden border border-white/[0.08] bg-[#24252d] shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#191a21] px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#36D7FF]">
              Ranked Inhouse
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase text-white">
              Ranked Standings
            </h2>
          </div>
          <div className="rounded-lg border border-[#36D7FF]/18 bg-[#061C4A] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#77CFFF]">
            Live after reports
          </div>
        </div>

        {ladderRows.length === 0 ? (
          <div className="p-8 text-sm font-bold text-[#aeb5da]">
            The ranked ladder will populate once inhouse games are reported.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full border-collapse">
              <thead>
                <tr className="border-b border-black/35 bg-[#25262f] text-left text-lg text-[#98a1c7]">
                  <TableHead className="w-20">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="w-28 text-center">ELO</TableHead>
                  <TableHead className="w-28 text-center">Record</TableHead>
                  <TableHead className="w-24 text-center">Win %</TableHead>
                  <TableHead className="w-24 text-center">Streak</TableHead>
                  <TableHead className="w-36 text-center">Role</TableHead>
                </tr>
              </thead>
              <tbody>
                {ladderRows.map((row) => (
                  <tr
                    key={row.rank}
                    className="border-b border-black/35 bg-[#30313c] text-[#d7dcff] last:border-b-0 odd:bg-[#333440]"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-white">#{row.rank}</span>
                        <Minus color="#8f98c0" size={24} strokeWidth={3} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {row.profileId ? (
                        <Link href={`/hub/players/${row.profileId}`} className="group">
                          <p className="text-xl font-black text-white group-hover:text-[#77CFFF]">
                            {row.displayName}
                          </p>
                          {row.riotId && (
                            <p className="mt-1 text-xs font-bold text-[#8f98c0]">{row.riotId}</p>
                          )}
                        </Link>
                      ) : (
                        <div>
                          <p className="text-xl font-black text-white">{row.displayName}</p>
                          {row.riotId && (
                            <p className="mt-1 text-xs font-bold text-[#8f98c0]">{row.riotId}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center text-2xl font-black text-[#77CFFF]">
                      {row.elo}
                    </td>
                    <td className="px-4 py-4 text-center text-xl font-black text-white">
                      <span className="text-[#20b86f]">{row.wins}</span>
                      <span className="text-[#8f98c0]">-</span>
                      <span className="text-[#ff4058]">{row.losses}</span>
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-black text-[#aeb5da]">
                      {row.winRate}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-black">
                      <span className={
                        row.streak.startsWith("W") ? "text-[#19d27f]" :
                        row.streak.startsWith("L") ? "text-[#ff4058]" :
                        "text-[#8f98c0]"
                      }>
                        {row.streak}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {row.primaryRole ? (
                        <div className="inline-flex items-center gap-2 rounded-xl bg-[#20212a] px-3 py-2">
                          <Image
                            src={HUB_ROLE_ICONS[row.primaryRole]}
                            alt={hubRoleLabel(row.primaryRole)}
                            width={22}
                            height={22}
                            className="opacity-70"
                          />
                          <span className="text-xs font-black text-white">
                            {hubRoleLabel(row.primaryRole)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-black text-[#8f98c0]">-</span>
                      )}
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
