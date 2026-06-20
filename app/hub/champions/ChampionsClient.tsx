"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

type Role = "ALL" | "TOP" | "JNG" | "MID" | "ADC" | "SUPP";
type ChampionTier = "OP" | "1" | "2" | "3";

type ChampionRow = {
  role: Exclude<Role, "ALL">;
  champion: string;
  championId: number;
  games: number;
  pickRate: number;
  banRate: number;
  winRate: number;
};

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

const championRows: ChampionRow[] = [
  {
    role: "ADC",
    champion: "Senna",
    championId: 235,
    games: 31,
    pickRate: 19.18,
    banRate: 29.08,
    winRate: 53.82,
  },
  {
    role: "JNG",
    champion: "Rek'Sai",
    championId: 421,
    games: 24,
    pickRate: 3.75,
    banRate: 6.72,
    winRate: 53.42,
  },
  {
    role: "JNG",
    champion: "Bel'Veth",
    championId: 200,
    games: 19,
    pickRate: 2.34,
    banRate: 2.5,
    winRate: 53.13,
  },
  {
    role: "TOP",
    champion: "Poppy",
    championId: 78,
    games: 18,
    pickRate: 1.87,
    banRate: 6.55,
    winRate: 52.85,
  },
  {
    role: "MID",
    champion: "Katarina",
    championId: 55,
    games: 22,
    pickRate: 5.21,
    banRate: 4.81,
    winRate: 52.71,
  },
  {
    role: "SUPP",
    champion: "Braum",
    championId: 201,
    games: 20,
    pickRate: 5.19,
    banRate: 7.51,
    winRate: 52.71,
  },
  {
    role: "TOP",
    champion: "Garen",
    championId: 86,
    games: 25,
    pickRate: 4.6,
    banRate: 2.43,
    winRate: 52.3,
  },
  {
    role: "TOP",
    champion: "Olaf",
    championId: 2,
    games: 16,
    pickRate: 3.12,
    banRate: 3.43,
    winRate: 52.27,
  },
  {
    role: "TOP",
    champion: "Shen",
    championId: 98,
    games: 14,
    pickRate: 2.59,
    banRate: 0.26,
    winRate: 52.2,
  },
  {
    role: "SUPP",
    champion: "Leona",
    championId: 89,
    games: 29,
    pickRate: 7.22,
    banRate: 6.92,
    winRate: 52.09,
  },
  {
    role: "MID",
    champion: "Twisted Fate",
    championId: 4,
    games: 21,
    pickRate: 8.72,
    banRate: 3.19,
    winRate: 51.99,
  },
  {
    role: "TOP",
    champion: "Singed",
    championId: 27,
    games: 13,
    pickRate: 2.46,
    banRate: 0.9,
    winRate: 51.81,
  },
  {
    role: "SUPP",
    champion: "Bard",
    championId: 432,
    games: 17,
    pickRate: 9.68,
    banRate: 6.79,
    winRate: 51.59,
  },
  {
    role: "SUPP",
    champion: "Thresh",
    championId: 412,
    games: 32,
    pickRate: 12.56,
    banRate: 8.97,
    winRate: 51.56,
  },
  {
    role: "ADC",
    champion: "Ashe",
    championId: 22,
    games: 26,
    pickRate: 13.75,
    banRate: 19.35,
    winRate: 51.55,
  },
  {
    role: "MID",
    champion: "Xerath",
    championId: 101,
    games: 18,
    pickRate: 5.78,
    banRate: 10.51,
    winRate: 51.23,
  },
  {
    role: "TOP",
    champion: "Malphite",
    championId: 54,
    games: 28,
    pickRate: 6.26,
    banRate: 15.12,
    winRate: 51.2,
  },
  {
    role: "TOP",
    champion: "Sion",
    championId: 14,
    games: 23,
    pickRate: 6.72,
    banRate: 1.74,
    winRate: 51.13,
  },
  {
    role: "MID",
    champion: "Syndra",
    championId: 134,
    games: 30,
    pickRate: 7.45,
    banRate: 3.04,
    winRate: 51.04,
  },
  {
    role: "ADC",
    champion: "Jinx",
    championId: 222,
    games: 34,
    pickRate: 14.1,
    banRate: 7.2,
    winRate: 50.88,
  },
  {
    role: "JNG",
    champion: "Vi",
    championId: 254,
    games: 27,
    pickRate: 10.92,
    banRate: 9.36,
    winRate: 50.44,
  },
];

const minimumSampleSize = 5;

const strengthWeights = {
  winRate: 0.45,
  pickRate: 0.3,
  banRate: 0.2,
  games: 0.05,
};

const roleStatRanges = roles
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

const opByRole = roles
  .filter((role): role is { id: Exclude<Role, "ALL">; label: string } => role.id !== "ALL")
  .reduce(
    (acc, role) => {
      const rows = championRows.filter((row) => row.role === role.id);
      acc[role.id] = rows.reduce((best, row) =>
        championScore(row) > championScore(best) ? row : best,
      );
      return acc;
    },
    {} as Record<Exclude<Role, "ALL">, ChampionRow>,
  );

const tierRank: Record<ChampionTier, number> = {
  OP: 0,
  "1": 1,
  "2": 2,
  "3": 3,
};

export function ChampionsClient() {
  const [selectedRole, setSelectedRole] = useState<Role>("ALL");
  const filtered = useMemo(() => {
    const rows =
      selectedRole === "ALL"
        ? championRows
        : championRows.filter((row) => row.role === selectedRole);

    return [...rows].sort((a, b) => {
      const tierDelta = tierRank[getTier(a)] - tierRank[getTier(b)];
      if (tierDelta !== 0) return tierDelta;

      const scoreDelta = championScore(b) - championScore(a);
      if (scoreDelta !== 0) return scoreDelta;

      const winRateDelta = b.winRate - a.winRate;
      if (winRateDelta !== 0) return winRateDelta;

      const pickRateDelta = b.pickRate - a.pickRate;
      if (pickRateDelta !== 0) return pickRateDelta;

      const gamesDelta = b.games - a.games;
      if (gamesDelta !== 0) return gamesDelta;

      return a.champion.localeCompare(b.champion);
    });
  }, [selectedRole]);

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
                  <TierBadge tier={getTier(row)} />
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

function championScore(row: ChampionRow) {
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

function getTier(row: ChampionRow): ChampionTier {
  const score = championScore(row);

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
