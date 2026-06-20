import Image from "next/image";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { HubShell } from "../_components/HubShell";

type Role = "TOP" | "JNG" | "MID" | "ADC" | "SUPP";
type Form = "UP" | "DOWN" | "SAME";

type LadderPlayer = {
  rank: number;
  previousRank: number;
  player: string;
  riotId: string;
  elo: number;
  eloChange: number;
  record: string;
  recentForm: Array<"W" | "L">;
  mostPlayedRole: Role;
  topChampions: Array<{
    champion: string;
    championId: number;
    winRate: number;
  }>;
};

const roleIcons: Record<Role, string> = {
  TOP: "/lol/roles/top.png",
  JNG: "/lol/roles/jungle.png",
  MID: "/lol/roles/mid.png",
  ADC: "/lol/roles/bot.png",
  SUPP: "/lol/roles/support.png",
};

const ladderRows: LadderPlayer[] = [
  {
    rank: 1,
    previousRank: 2,
    player: "Jade",
    riotId: "JadeFalcon#2209",
    elo: 1984,
    eloChange: 24,
    record: "31-12",
    recentForm: ["W", "W", "L", "W", "W"],
    mostPlayedRole: "MID",
    topChampions: [
      { champion: "Ahri", championId: 103, winRate: 75 },
      { champion: "Orianna", championId: 61, winRate: 67 },
      { champion: "Syndra", championId: 134, winRate: 71 },
    ],
  },
  {
    rank: 2,
    previousRank: 1,
    player: "Storm",
    riotId: "Stormline#1102",
    elo: 1958,
    eloChange: -18,
    record: "28-13",
    recentForm: ["L", "W", "W", "L", "W"],
    mostPlayedRole: "ADC",
    topChampions: [
      { champion: "Caitlyn", championId: 51, winRate: 69 },
      { champion: "Jinx", championId: 222, winRate: 64 },
      { champion: "Varus", championId: 110, winRate: 61 },
    ],
  },
  {
    rank: 3,
    previousRank: 3,
    player: "Night",
    riotId: "NightShift#4401",
    elo: 1917,
    eloChange: 0,
    record: "25-14",
    recentForm: ["W", "L", "W", "L", "W"],
    mostPlayedRole: "JNG",
    topChampions: [
      { champion: "Vi", championId: 254, winRate: 66 },
      { champion: "Viego", championId: 234, winRate: 63 },
      { champion: "Lee Sin", championId: 64, winRate: 59 },
    ],
  },
  {
    rank: 4,
    previousRank: 6,
    player: "Killer",
    riotId: "KillerInstinct#8750",
    elo: 1882,
    eloChange: 31,
    record: "22-15",
    recentForm: ["W", "W", "W", "L", "W"],
    mostPlayedRole: "TOP",
    topChampions: [
      { champion: "Fiora", championId: 114, winRate: 68 },
      { champion: "Garen", championId: 86, winRate: 62 },
      { champion: "Malphite", championId: 54, winRate: 58 },
    ],
  },
  {
    rank: 5,
    previousRank: 4,
    player: "Anchor",
    riotId: "AnchorPoint#3021",
    elo: 1846,
    eloChange: -12,
    record: "21-16",
    recentForm: ["L", "W", "L", "W", "L"],
    mostPlayedRole: "SUPP",
    topChampions: [
      { champion: "Thresh", championId: 412, winRate: 65 },
      { champion: "Braum", championId: 201, winRate: 60 },
      { champion: "Leona", championId: 89, winRate: 57 },
    ],
  },
  {
    rank: 6,
    previousRank: 7,
    player: "Shadow",
    riotId: "ShadowPlay#9090",
    elo: 1815,
    eloChange: 16,
    record: "20-17",
    recentForm: ["W", "L", "W", "W", "L"],
    mostPlayedRole: "MID",
    topChampions: [
      { champion: "Galio", championId: 3, winRate: 64 },
      { champion: "Twisted Fate", championId: 4, winRate: 58 },
      { champion: "Xerath", championId: 101, winRate: 55 },
    ],
  },
  {
    rank: 7,
    previousRank: 5,
    player: "Vortex",
    riotId: "VortexCall#6611",
    elo: 1789,
    eloChange: -27,
    record: "18-18",
    recentForm: ["L", "L", "W", "L", "W"],
    mostPlayedRole: "TOP",
    topChampions: [
      { champion: "Sion", championId: 14, winRate: 59 },
      { champion: "Shen", championId: 98, winRate: 56 },
      { champion: "Poppy", championId: 78, winRate: 53 },
    ],
  },
  {
    rank: 8,
    previousRank: 8,
    player: "Bolt",
    riotId: "BoltAction#7120",
    elo: 1762,
    eloChange: 0,
    record: "17-18",
    recentForm: ["L", "W", "L", "W", "L"],
    mostPlayedRole: "ADC",
    topChampions: [
      { champion: "Ashe", championId: 22, winRate: 61 },
      { champion: "Ezreal", championId: 81, winRate: 55 },
      { champion: "Kai'Sa", championId: 145, winRate: 52 },
    ],
  },
];

export default function RankedLadderPage() {
  const sortedRows = [...ladderRows].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return b.elo - a.elo;
  });

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
            Beta ladder mockup
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase text-white">
            Ranked Standings
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full border-collapse">
            <thead>
              <tr className="border-b border-black/35 bg-[#25262f] text-left text-lg text-[#98a1c7]">
                <TableHead className="w-20">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="w-32 text-center">ELO</TableHead>
                <TableHead className="w-28 text-center">+/-</TableHead>
                <TableHead className="w-32 text-center">Record</TableHead>
                <TableHead className="w-36 text-center">Main role</TableHead>
                <TableHead className="w-[22rem]">Highest winrate champs</TableHead>
                <TableHead className="w-44 text-center">Recent form</TableHead>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={row.riotId}
                  className="border-b border-black/35 bg-[#30313c] text-[#d7dcff] last:border-b-0 odd:bg-[#333440]"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black text-white">#{row.rank}</span>
                      <FormMarker form={getForm(row)} />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-xl font-black text-white">{row.player}</p>
                    <p className="mt-1 text-xs font-bold text-[#8f98c0]">{row.riotId}</p>
                  </td>
                  <td className="px-4 py-4 text-center text-2xl font-black text-[#ffd84d]">
                    {row.elo}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <EloChange value={row.eloChange} />
                  </td>
                  <td className="px-4 py-4 text-center text-xl font-black text-white">
                    {row.record}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="inline-flex items-center gap-3 bg-[#20212a] px-3 py-2">
                      <Image
                        src={roleIcons[row.mostPlayedRole]}
                        alt={row.mostPlayedRole}
                        width={28}
                        height={28}
                        className="opacity-70"
                      />
                      <span className="text-sm font-black text-white">{roleLabel(row.mostPlayedRole)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-3">
                      {row.topChampions.map((champion) => (
                        <div
                          key={champion.championId}
                          className="flex min-w-24 items-center gap-2 bg-[#20212a] px-2 py-2"
                        >
                          <Image
                            src={`/lol/champions/${champion.championId}.png`}
                            alt={champion.champion}
                            width={34}
                            height={34}
                            className="rounded-sm object-cover ring-1 ring-black/40"
                          />
                          <div>
                            <p className="text-xs font-black text-white">{champion.champion}</p>
                            <p className="text-[0.68rem] font-black text-[#48f0df]">
                              {champion.winRate}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center gap-1.5">
                      {row.recentForm.map((result, index) => (
                        <span
                          key={`${row.riotId}-${index}`}
                          className="flex h-8 w-8 items-center justify-center text-xs font-black text-white"
                          style={{
                            backgroundColor: result === "W" ? "#20b86f" : "#ff4058",
                          }}
                        >
                          {result}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

function getForm(row: LadderPlayer): Form {
  if (row.rank < row.previousRank) return "UP";
  if (row.rank > row.previousRank) return "DOWN";
  return "SAME";
}

function FormMarker({ form }: { form: Form }) {
  if (form === "UP") return <ArrowUp color="#20b86f" size={22} strokeWidth={3} />;
  if (form === "DOWN") return <ArrowDown color="#ff4058" size={22} strokeWidth={3} />;
  return <Minus color="#8f98c0" size={24} strokeWidth={3} />;
}

function EloChange({ value }: { value: number }) {
  if (value > 0) {
    return <span className="text-lg font-black text-[#51f0a3]">+{value}</span>;
  }

  if (value < 0) {
    return <span className="text-lg font-black text-[#ff7588]">{value}</span>;
  }

  return <span className="text-lg font-black text-[#8f98c0]">0</span>;
}

function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    TOP: "Top",
    JNG: "Jungle",
    MID: "Middle",
    ADC: "Bottom",
    SUPP: "Support",
  };

  return labels[role];
}
