import Image from "next/image";
import Link from "next/link";
import { Minus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { STARTING_ELO } from "@/lib/elo";
import {
  HUB_ROLE_ICONS,
  hubRoleLabel,
  normalizeHubRole,
  type HubRole,
} from "@/lib/hub-profile";
import { HubShell } from "../_components/HubShell";
import { LeaderboardCountdown } from "./LeaderboardCountdown";

// Revalidate every 24 hours — gives the ladder a daily update cadence
export const revalidate = 86400;

const INHOUSE_MATCH_FILTER = {
  matchGame: {
    match: {
      OR: [
        { roundLabel: { startsWith: "IH" } },
        { roundLabel: "Ranked Inhouse" },
      ],
    },
  },
};

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

function inhouseStreak(stats: { isWin: boolean }[]): string {
  let w = 0, l = 0;
  for (const s of stats) {
    if (s.isWin) { if (l > 0) break; w++; }
    else         { if (w > 0) break; l++; }
  }
  return w > 1 ? `W${w}` : l > 1 ? `L${l}` : "-";
}

export default async function RankedLadderPage() {
  // Fetch all inhouse stats (ordered newest-first so first entry per player = latest ELO)
  const allStats = await prisma.matchGamePlayerStat.findMany({
    where: INHOUSE_MATCH_FILTER,
    select: {
      playerId: true,
      isWin: true,
      eloAfter: true,
      createdAt: true,
      player: {
        select: {
          id: true,
          name: true,
          riotName: true,
          riotTag: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

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

  // Group stats by player — first entry is the most recent (latest ELO)
  const byPlayer = new Map<string, {
    name: string;
    riotName: string | null;
    riotTag: string | null;
    elo: number;
    wins: number;
    losses: number;
    statsSorted: { isWin: boolean }[];
  }>();

  for (const stat of allStats) {
    const existing = byPlayer.get(stat.playerId);
    if (!existing) {
      byPlayer.set(stat.playerId, {
        name: stat.player.name,
        riotName: stat.player.riotName,
        riotTag: stat.player.riotTag,
        elo: stat.eloAfter ?? STARTING_ELO,
        wins: stat.isWin ? 1 : 0,
        losses: stat.isWin ? 0 : 1,
        statsSorted: [{ isWin: stat.isWin }],
      });
    } else {
      existing.wins += stat.isWin ? 1 : 0;
      existing.losses += stat.isWin ? 0 : 1;
      existing.statsSorted.push({ isWin: stat.isWin });
    }
  }

  // Build ladder rows sorted by ELO
  const ladderRows: LadderRow[] = [...byPlayer.values()]
    .sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      const aGames = a.wins + a.losses;
      const bGames = b.wins + b.losses;
      if (bGames !== aGames) return bGames - aGames;
      return a.name.localeCompare(b.name);
    })
    .map((p, index) => {
      const riotNameLow = (p.riotName ?? "").toLowerCase();
      const riotTagLow = cleanTag(p.riotTag).toLowerCase();
      const profile = profiles.find(
        (pr) =>
          (pr.riotName ?? "").toLowerCase() === riotNameLow &&
          cleanTag(pr.riotTag).toLowerCase() === riotTagLow,
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
        streak: inhouseStreak(p.statsSorted),
        primaryRole: normalizeHubRole(profile?.primaryRole),
      };
    });

  return (
    <HubShell
      active="ladder"
      eyebrow="Ranked Inhouse"
      title="Ranked Ladder"
      description="ECL ranked inhouse standings. Updates every 24 hours."
    >
      <section className="overflow-hidden border border-white/[0.08] bg-[#24252d] shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#191a21] px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1728]">
              Ranked Inhouse
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase text-white">
              Ranked Standings
            </h2>
          </div>
          <LeaderboardCountdown generatedAt={new Date().toISOString()} />
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
                          <p className="text-xl font-black text-white group-hover:text-[#ffd84d]">
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
                    <td className="px-4 py-4 text-center text-2xl font-black text-[#ffd84d]">
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
