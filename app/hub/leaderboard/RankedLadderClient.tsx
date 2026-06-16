"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  Award,
  Flame,
  Medal,
  Search,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

const championIcons: Record<string, string> = {
  Aatrox: "/lol/champions/266.png",
  Ahri: "/lol/champions/103.png",
  Azir: "/lol/champions/268.png",
  Ezreal: "/lol/champions/81.png",
  Jinx: "/lol/champions/222.png",
  "Kai'Sa": "/lol/champions/145.png",
  "K'Sante": "/lol/champions/897.png",
  "Lee Sin": "/lol/champions/64.png",
  Nautilus: "/lol/champions/111.png",
  Orianna: "/lol/champions/61.png",
  Rakan: "/lol/champions/497.png",
  Renekton: "/lol/champions/58.png",
  Syndra: "/lol/champions/134.png",
  Taliyah: "/lol/champions/163.png",
  Thresh: "/lol/champions/412.png",
  Vi: "/lol/champions/254.png",
  Viego: "/lol/champions/234.png",
  Viktor: "/lol/champions/112.png",
};

const roleIcons: Record<string, string> = {
  Top: "/lol/roles/top.png",
  Jungle: "/lol/roles/jungle.png",
  Mid: "/lol/roles/mid.png",
  ADC: "/lol/roles/bot.png",
  Bot: "/lol/roles/bot.png",
  Support: "/lol/roles/support.png",
  Fill: "/lol/roles/fill.png",
};

const players = [
  {
    rank: 1,
    name: "Jade Falcon",
    riot: "#2209",
    role: "Mid",
    elo: 1984,
    record: "31-12",
    winRate: 72,
    streak: "+7W",
    kills: 284,
    mvps: 9,
    status: "Online",
    trend: [46, 54, 58, 63, 61, 68, 72],
    champions: ["Ahri", "Orianna", "Syndra"],
  },
  {
    rank: 2,
    name: "NightKiller",
    riot: "#1190",
    role: "Jungle",
    elo: 1907,
    record: "27-15",
    winRate: 64,
    streak: "+3W",
    kills: 241,
    mvps: 7,
    status: "Online",
    trend: [48, 52, 49, 56, 59, 62, 64],
    champions: ["Lee Sin", "Vi", "Viego"],
  },
  {
    rank: 3,
    name: "ShadowHex",
    riot: "#445",
    role: "ADC",
    elo: 1842,
    record: "24-14",
    winRate: 63,
    streak: "+2W",
    kills: 312,
    mvps: 6,
    status: "In Game",
    trend: [55, 53, 57, 58, 60, 61, 63],
    champions: ["Jinx", "Kai'Sa", "Ezreal"],
  },
  {
    rank: 4,
    name: "VortexRain",
    riot: "#8801",
    role: "Top",
    elo: 1788,
    record: "22-17",
    winRate: 56,
    streak: "-1L",
    kills: 198,
    mvps: 5,
    status: "Away",
    trend: [61, 60, 58, 54, 57, 55, 56],
    champions: ["Aatrox", "K'Sante", "Renekton"],
  },
  {
    rank: 5,
    name: "GhostHunter",
    riot: "#3320",
    role: "Support",
    elo: 1729,
    record: "19-16",
    winRate: 54,
    streak: "+1W",
    kills: 92,
    mvps: 4,
    status: "Online",
    trend: [49, 51, 50, 53, 52, 55, 54],
    champions: ["Thresh", "Rakan", "Nautilus"],
  },
  {
    rank: 6,
    name: "StormTroupe",
    riot: "#6560",
    role: "Mid",
    elo: 1684,
    record: "18-18",
    winRate: 50,
    streak: "+4W",
    kills: 207,
    mvps: 3,
    status: "Online",
    trend: [38, 41, 44, 47, 48, 49, 50],
    champions: ["Taliyah", "Azir", "Viktor"],
  },
];

const topStats = [
  {
    label: "Highest Climber",
    value: "+186 ELO",
    name: "StormTroupe",
    icon: TrendingUp,
    tone: "from-[#ffd84d] to-[#8b6b08]",
  },
  {
    label: "Most Kills",
    value: "312",
    name: "ShadowHex",
    icon: Swords,
    tone: "from-[#ff6b6b] to-[#6f1d39]",
  },
  {
    label: "Most MVPs",
    value: "9",
    name: "Jade Falcon",
    icon: Award,
    tone: "from-[#48d8f0] to-[#253c89]",
  },
];

const liveEvents = [
  {
    icon: Flame,
    title: "ShadowHex secured a pentakill",
    time: "2 min ago",
    highlight: "pentakill",
  },
  {
    icon: Medal,
    title: "Jade Falcon earned MVP in back-to-back games",
    time: "8 min ago",
    highlight: "MVP",
  },
  {
    icon: TrendingUp,
    title: "StormTroupe is the most in-form player this week",
    time: "19 min ago",
    highlight: "in-form",
  },
  {
    icon: Zap,
    title: "NightKiller climbed into the top two",
    time: "31 min ago",
    highlight: "top two",
  },
];

export function RankedLadderClient() {
  const [selectedName, setSelectedName] = useState(players[0].name);
  const selected = useMemo(
    () => players.find((player) => player.name === selectedName) ?? players[0],
    [selectedName],
  );

  return (
    <div className="space-y-7">
      <section className="grid gap-5 xl:grid-cols-3">
        {topStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.label}
              className="relative h-64 overflow-hidden rounded-[1.6rem] border border-white/[0.07] bg-[#181d32] p-6 shadow-[0_18px_54px_rgba(0,0,0,0.25)]"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${stat.tone} opacity-35`}
              />
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex h-full flex-col justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/35 text-white">
                  <Icon size={24} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">
                    {stat.label}
                  </p>
                  <h2 className="mt-2 text-4xl font-black tracking-normal text-white">
                    {stat.value}
                  </h2>
                  <p className="mt-2 text-base font-bold text-[#d7dcff]">
                    {stat.name}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6 shadow-[0_20px_64px_rgba(0,0,0,0.28)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f97c5]">
                Season 1 - Global Ranked
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-normal text-white">
                Top Players
              </h2>
            </div>
            <label className="flex min-w-80 items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 text-sm text-[#8f97c5]">
              <Search size={17} />
              <span>Search players, roles, Riot IDs...</span>
            </label>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.06]">
            <div className="grid grid-cols-[4rem_minmax(15rem,1fr)_6rem_6rem_7rem_7rem_7rem] bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#8f97c5]">
              <span>#</span>
              <span>Player</span>
              <span>Role</span>
              <span>ELO</span>
              <span>Record</span>
              <span>Win Rate</span>
              <span>Status</span>
            </div>

            {players.map((player) => (
              <button
                key={player.name}
                type="button"
                onClick={() => setSelectedName(player.name)}
                className={`grid w-full grid-cols-[4rem_minmax(15rem,1fr)_6rem_6rem_7rem_7rem_7rem] items-center border-t border-white/[0.06] px-4 py-4 text-left transition ${
                  selected.name === player.name
                    ? "bg-[#ffd84d]/10"
                    : "bg-transparent hover:bg-white/[0.04]"
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-sm font-black text-white">
                  {player.rank}
                </span>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#353b73] text-sm font-black text-white">
                    {player.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-black text-white">
                      {player.name}
                    </span>
                    <span className="block text-xs font-semibold text-[#8f97c5]">
                      {player.riot}
                    </span>
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 text-sm font-bold text-[#c9cee9]">
                  <Image
                    src={roleIcons[player.role] ?? roleIcons.Fill}
                    alt=""
                    width={20}
                    height={20}
                    className="h-5 w-5 object-contain"
                  />
                  {player.role}
                </span>
                <span className="text-sm font-black text-[#ffd84d]">{player.elo}</span>
                <span className="text-sm font-bold text-[#c9cee9]">{player.record}</span>
                <span className="text-sm font-black text-white">{player.winRate}%</span>
                <span className="w-fit rounded-full bg-[#ffd84d]/12 px-3 py-1 text-xs font-black text-[#ffd84d]">
                  {player.status}
                </span>
              </button>
            ))}
          </div>
        </div>

        <aside className="space-y-7">
          <section className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6 shadow-[0_20px_64px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f97c5]">
                  Selected Player
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  {selected.name}
                </h2>
              </div>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#353b73] text-lg font-black text-white">
                #{selected.rank}
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/20 p-5">
              <div className="flex items-end justify-between">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-white">
                  Win Rate Trend
                </p>
                <p className="text-3xl font-black text-[#ffd84d]">
                  {selected.winRate}%
                </p>
              </div>
              <TrendChart values={selected.trend} />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <MiniStat label="Streak" value={selected.streak} />
              <MiniStat label="Kills" value={String(selected.kills)} />
              <MiniStat label="MVPs" value={String(selected.mvps)} />
            </div>

            <div className="mt-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f97c5]">
                Main Champions
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.champions.map((champion) => (
                  <span
                    key={champion}
                    className="flex items-center gap-2 rounded-full bg-white/[0.07] py-1.5 pl-1.5 pr-3 text-xs font-bold text-[#d7dcff]"
                  >
                    {championIcons[champion] && (
                      <Image
                        src={championIcons[champion]}
                        alt={champion}
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    )}
                    {champion}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6 shadow-[0_20px_64px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black tracking-normal text-white">
                Live Events
              </h2>
              <span className="rounded-full bg-[#ffd84d]/12 px-3 py-1 text-xs font-black text-[#ffd84d]">
                Live
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {liveEvents.map((event) => {
                const Icon = event.icon;

                return (
                  <div key={event.title} className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffd84d]/10 text-[#ffd84d]">
                      <Icon size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-bold leading-5 text-white">
                        {event.title}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#8f97c5]">
                        {event.time} - {event.highlight}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-4">
      <p className="text-xs font-bold text-[#8f97c5]">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function TrendChart({ values }: { values: number[] }) {
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 100 - value;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="mt-5 h-32 w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label="Selected player win rate trend"
    >
      <defs>
        <linearGradient id="ladderTrendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffd84d" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffd84d" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill="url(#ladderTrendFill)" />
      <polyline
        points={points}
        fill="none"
        stroke="#ffd84d"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
