"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { ChampionStatsRow } from "@/lib/champion-stats";

type Role = "ALL" | "TOP" | "JNG" | "MID" | "ADC" | "SUPP";
type ChampionTier = "OP" | "1" | "2" | "3";

type ChampionRow = ChampionStatsRow;

type RoleStatRange = {
  highestPickRate: number;
  highestBanRate: number;
  highestGames: number;
};

const roles: Array<{ id: Role; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "TOP", label: "Top" },
  { id: "JNG", label: "Jungle" },
  { id: "MID", label: "Middle" },
  { id: "ADC", label: "Bottom" },
  { id: "SUPP", label: "Support" },
];

const roleIcons: Record<Exclude<Role, "ALL">, string> = {
  TOP: "/lol/roles/top.png",
  JNG: "/lol/roles/jungle.png",
  MID: "/lol/roles/mid.png",
  ADC: "/lol/roles/bot.png",
  SUPP: "/lol/roles/support.png",
};

const minimumSampleSize = 5;

const strengthWeights = {
  winRate: 0.45,
  pickRate: 0.3,
  banRate: 0.2,
  games: 0.05,
};

const tierRank: Record<ChampionTier, number> = {
  OP: 0,
  "1": 1,
  "2": 2,
  "3": 3,
};

export function ChampionsClient({ championRows }: { championRows: ChampionRow[] }) {
  const [selectedRole, setSelectedRole] = useState<Role>("ALL");
  const roleStatRanges = useMemo(() => getRoleStatRanges(championRows), [championRows]);
  const opByRole = useMemo(
    () => getOpByRole(championRows, roleStatRanges),
    [championRows, roleStatRanges],
  );
  const filtered = useMemo(() => {
    const rows =
      selectedRole === "ALL"
        ? championRows
        : championRows.filter((row) => row.role === selectedRole);

    return [...rows].sort((a, b) => {
      const tierDelta =
        tierRank[getTier(a, opByRole, roleStatRanges)] -
        tierRank[getTier(b, opByRole, roleStatRanges)];
      if (tierDelta !== 0) return tierDelta;

      const scoreDelta = championScore(b, roleStatRanges) - championScore(a, roleStatRanges);
      if (scoreDelta !== 0) return scoreDelta;

      const winRateDelta = b.winRate - a.winRate;
      if (winRateDelta !== 0) return winRateDelta;

      const pickRateDelta = b.pickRate - a.pickRate;
      if (pickRateDelta !== 0) return pickRateDelta;

      const gamesDelta = b.games - a.games;
      if (gamesDelta !== 0) return gamesDelta;

      return a.champion.localeCompare(b.champion);
    });
  }, [championRows, opByRole, roleStatRanges, selectedRole]);

  return (
    <section className="overflow-hidden border border-white/[0.08] bg-[#24252d] shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
      <div className="flex flex-wrap gap-2 border-b border-white/[0.08] bg-[#191a21] p-3">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => setSelectedRole(role.id)}
            className={`min-h-10 min-w-24 border px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition ${
              selectedRole === role.id
                ? "border-[#5588e8] bg-[#5588e8]"
                : "border-white/[0.10] bg-[#2c2d38] hover:border-white/[0.24] hover:bg-[#353746]"
            }`}
          >
            {role.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[880px] w-full border-collapse">
          <thead>
            <tr className="border-b border-black/35 bg-[#25262f] text-left text-lg text-[#98a1c7]">
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Champion</TableHead>
              <TableHead className="w-28 text-center text-[#6a95ff]">Tier</TableHead>
              <TableHead className="w-28 text-center">Role</TableHead>
              <TableHead className="w-28 text-center">Games</TableHead>
              <TableHead className="w-36 text-center">Win rate</TableHead>
              <TableHead className="w-36 text-center">Pick rate</TableHead>
              <TableHead className="w-36 text-center">Ban rate</TableHead>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => (
              <tr
                key={`${row.role}-${row.champion}`}
                className="border-b border-black/35 bg-[#30313c] text-[#b8c2ea] last:border-b-0 odd:bg-[#333440]"
              >
                <td className="px-4 py-3 text-xl font-semibold text-[#8f98c0]">
                  {index + 1}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-4">
                    <ChampionIcon championId={row.championId} champion={row.champion} size={56} />
                    <span className="text-xl font-black text-white">{row.champion}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <TierBadge tier={getTier(row, opByRole, roleStatRanges)} />
                </td>
                <td className="px-4 py-3 text-center">
                  <Image
                    src={roleIcons[row.role]}
                    alt={row.role}
                    width={34}
                    height={34}
                    className="mx-auto opacity-55"
                  />
                </td>
                <td className="px-4 py-3 text-center text-xl font-semibold">
                  {row.games}
                </td>
                <td className="px-4 py-3 text-center text-xl font-semibold">
                  {formatRate(row.winRate)}
                </td>
                <td className="px-4 py-3 text-center text-xl font-semibold">
                  {formatRate(row.pickRate)}
                </td>
                <td className="px-4 py-3 text-center text-xl font-semibold">
                  {formatRate(row.banRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <div className="border-t border-black/35 bg-[#30313c] px-6 py-10 text-center">
            <p className="text-lg font-black text-white">No champion data recorded yet.</p>
            <p className="mt-2 text-sm font-semibold text-[#98a1c7]">
              This page fills automatically once reported inhouse games include champion details.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TableHead({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <th className={`px-4 py-4 font-medium ${className}`}>{children}</th>;
}

function TierBadge({ tier }: { tier: ChampionTier }) {
  const colors: Record<ChampionTier, string> = {
    OP: "#f23f5e",
    "1": "#1598f2",
    "2": "#20b86f",
    "3": "#f08a24",
  };

  return (
    <span
      className="inline-flex h-10 min-w-9 items-center justify-center px-2 text-lg font-black text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)]"
      style={{
        backgroundColor: colors[tier],
        clipPath:
          "polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)",
      }}
    >
      {tier}
    </span>
  );
}

function ChampionIcon({
  championId,
  champion,
  size,
  rounded = false,
}: {
  championId: number;
  champion: string;
  size: number;
  rounded?: boolean;
}) {
  return (
    <Image
      src={`/lol/champions/${championId}.png`}
      alt={champion}
      width={size}
      height={size}
      className={`shrink-0 object-cover ring-1 ring-black/40 ${
        rounded ? "rounded-full" : "rounded-md"
      }`}
    />
  );
}

function formatRate(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}%`;
}

function getRoleStatRanges(championRows: ChampionRow[]) {
  return roles
    .filter((role): role is { id: Exclude<Role, "ALL">; label: string } => role.id !== "ALL")
    .reduce(
      (acc, role) => {
        const rows = championRows.filter((row) => row.role === role.id);
        acc[role.id] = {
          highestPickRate: Math.max(...rows.map((row) => row.pickRate), 1),
          highestBanRate: Math.max(...rows.map((row) => row.banRate), 1),
          highestGames: Math.max(...rows.map((row) => row.games), 1),
        };
        return acc;
      },
      {} as Record<Exclude<Role, "ALL">, RoleStatRange>,
    );
}

function getOpByRole(
  championRows: ChampionRow[],
  roleStatRanges: Record<Exclude<Role, "ALL">, RoleStatRange>,
) {
  return roles
    .filter((role): role is { id: Exclude<Role, "ALL">; label: string } => role.id !== "ALL")
    .reduce(
      (acc, role) => {
        const rows = championRows.filter((row) => row.role === role.id);
        const best = rows.reduce<ChampionRow | null>(
          (currentBest, row) =>
            !currentBest ||
            championScore(row, roleStatRanges) > championScore(currentBest, roleStatRanges)
              ? row
              : currentBest,
          null,
        );
        if (best) acc[role.id] = best;
        return acc;
      },
      {} as Partial<Record<Exclude<Role, "ALL">, ChampionRow>>,
    );
}

function championScore(
  row: ChampionRow,
  roleStatRanges: Record<Exclude<Role, "ALL">, RoleStatRange>,
) {
  const ranges = roleStatRanges[row.role];
  const winRateScore = clamp(((row.winRate - 45) / 12) * 100, 0, 100);
  const pickRateScore = clamp((row.pickRate / ranges.highestPickRate) * 100, 0, 100);
  const banRateScore = clamp((row.banRate / ranges.highestBanRate) * 100, 0, 100);
  const gamesScore = clamp((row.games / ranges.highestGames) * 100, 0, 100);

  return (
    winRateScore * strengthWeights.winRate +
    pickRateScore * strengthWeights.pickRate +
    banRateScore * strengthWeights.banRate +
    gamesScore * strengthWeights.games
  );
}

function getTier(
  row: ChampionRow,
  opByRole: Partial<Record<Exclude<Role, "ALL">, ChampionRow>>,
  roleStatRanges: Record<Exclude<Role, "ALL">, RoleStatRange>,
): ChampionTier {
  const score = championScore(row, roleStatRanges);

  if (
    opByRole[row.role]?.champion === row.champion &&
    score >= 85 &&
    row.games >= minimumSampleSize
  ) {
    return "OP";
  }

  if (score >= 70) return "1";
  if (score >= 55) return "2";
  return "3";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
