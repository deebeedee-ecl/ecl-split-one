"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { BadgeCheck, BarChart3, Search, TrendingUp } from "lucide-react";

const roles = ["All", "Top", "Jungle", "Mid", "ADC", "Support"];

const roleIcons: Record<string, string> = {
  Top: "/lol/roles/top.png",
  Jungle: "/lol/roles/jungle.png",
  Mid: "/lol/roles/mid.png",
  ADC: "/lol/roles/bot.png",
  Bot: "/lol/roles/bot.png",
  Support: "/lol/roles/support.png",
  Fill: "/lol/roles/fill.png",
};

const champions = [
  {
    tier: "S",
    role: "Mid",
    name: "Ahri",
    icon: "/lol/champions/103.png",
    winRate: 57.8,
    pickRate: 34.2,
    banRate: 18.4,
    games: 42,
    trend: "+4",
    players: [
      { name: "Jade Falcon", record: "9-3", winRate: 75, kda: "5.8" },
      { name: "StormTroupe", record: "4-2", winRate: 67, kda: "4.1" },
      { name: "BeanKing", record: "2-2", winRate: 50, kda: "3.2" },
    ],
  },
  {
    tier: "S",
    role: "ADC",
    name: "Jinx",
    icon: "/lol/champions/222.png",
    winRate: 55.1,
    pickRate: 29.8,
    banRate: 12.2,
    games: 38,
    trend: "+2",
    players: [
      { name: "ShadowHex", record: "8-4", winRate: 67, kda: "4.7" },
      { name: "BaitClick", record: "5-2", winRate: 71, kda: "5.1" },
    ],
  },
  {
    tier: "S",
    role: "Jungle",
    name: "Vi",
    icon: "/lol/champions/254.png",
    winRate: 54.4,
    pickRate: 25.6,
    banRate: 9.7,
    games: 31,
    trend: "+6",
    players: [
      { name: "NightKiller", record: "6-3", winRate: 67, kda: "3.9" },
      { name: "StormTroupe", record: "2-2", winRate: 50, kda: "3.2" },
    ],
  },
  {
    tier: "A",
    role: "Mid",
    name: "Orianna",
    icon: "/lol/champions/61.png",
    winRate: 53.6,
    pickRate: 22.1,
    banRate: 4.8,
    games: 28,
    trend: "+1",
    players: [
      { name: "Jade Falcon", record: "6-3", winRate: 67, kda: "4.9" },
      { name: "WaveClear", record: "3-2", winRate: 60, kda: "3.7" },
    ],
  },
  {
    tier: "A",
    role: "Support",
    name: "Rakan",
    icon: "/lol/champions/497.png",
    winRate: 52.9,
    pickRate: 20.4,
    banRate: 7.1,
    games: 25,
    trend: "+3",
    players: [
      { name: "GhostHunter", record: "4-2", winRate: 67, kda: "4.4" },
      { name: "PeelMe", record: "3-3", winRate: 50, kda: "3.8" },
    ],
  },
  {
    tier: "A",
    role: "Top",
    name: "Aatrox",
    icon: "/lol/champions/266.png",
    winRate: 52.2,
    pickRate: 18.5,
    banRate: 11.5,
    games: 24,
    trend: "-1",
    players: [
      { name: "VortexRain", record: "5-4", winRate: 56, kda: "3.1" },
      { name: "TopBrake", record: "3-3", winRate: 50, kda: "2.8" },
    ],
  },
  {
    tier: "B",
    role: "Mid",
    name: "Syndra",
    icon: "/lol/champions/134.png",
    winRate: 50.8,
    pickRate: 16.2,
    banRate: 5.3,
    games: 22,
    trend: "-2",
    players: [
      { name: "Jade Falcon", record: "5-2", winRate: 71, kda: "5.1" },
      { name: "SLW Alpha", record: "4-1", winRate: 80, kda: "6.2" },
    ],
  },
  {
    tier: "B",
    role: "Jungle",
    name: "Lee Sin",
    icon: "/lol/champions/64.png",
    winRate: 49.9,
    pickRate: 19.8,
    banRate: 8.6,
    games: 26,
    trend: "0",
    players: [
      { name: "NightKiller", record: "5-4", winRate: 56, kda: "3.4" },
      { name: "DinoDrive", record: "4-3", winRate: 57, kda: "3.6" },
    ],
  },
  {
    tier: "C",
    role: "ADC",
    name: "Ezreal",
    icon: "/lol/champions/81.png",
    winRate: 46.8,
    pickRate: 21.5,
    banRate: 2.4,
    games: 29,
    trend: "-5",
    players: [
      { name: "ShadowHex", record: "3-4", winRate: 43, kda: "3.1" },
      { name: "BaitClick", record: "5-3", winRate: 63, kda: "4.6" },
    ],
  },
];

const tierStyles: Record<string, string> = {
  S: "bg-[#ff7088] text-white",
  A: "bg-[#8b7cff] text-white",
  B: "bg-[#48f0df] text-[#071015]",
  C: "bg-white/14 text-white",
};

export function ChampionsClient() {
  const [selectedName, setSelectedName] = useState(champions[0].name);
  const selected = useMemo(
    () => champions.find((champion) => champion.name === selectedName) ?? champions[0],
    [selectedName],
  );

  return (
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <section className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f97c5]">
              Season 1 - Ranked Inhouses
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">Champion Tier List</h2>
          </div>
          <label className="flex min-w-80 items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 text-sm font-bold text-[#8f97c5]">
            <Search size={17} />
            <span>Search champions or players...</span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {roles.map((role, index) => (
            <span
              key={role}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black ${
                index === 0
                  ? "border-[#48f0df] bg-[#48f0df] text-[#071015]"
                  : "border-white/10 bg-white/[0.04] text-[#d7dcff]"
              }`}
            >
              {roleIcons[role] && (
                <Image
                  src={roleIcons[role]}
                  alt=""
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] object-contain"
                />
              )}
              {role}
            </span>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.06]">
          <div className="grid grid-cols-[5rem_minmax(14rem,1fr)_7rem_7rem_7rem_7rem_7rem] bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#8f97c5]">
            <span>Tier</span>
            <span>Champion</span>
            <span>Role</span>
            <span>Win</span>
            <span>Pick</span>
            <span>Ban</span>
            <span>Trend</span>
          </div>
          {champions.map((champion) => (
            <button
              key={champion.name}
              type="button"
              onClick={() => setSelectedName(champion.name)}
              className={`grid w-full grid-cols-[5rem_minmax(14rem,1fr)_7rem_7rem_7rem_7rem_7rem] items-center border-t border-white/[0.06] px-4 py-4 text-left transition ${
                selected.name === champion.name ? "bg-[#48f0df]/8" : "hover:bg-white/[0.04]"
              }`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black ${tierStyles[champion.tier]}`}>
                {champion.tier}
              </span>
              <span className="flex items-center gap-3">
                <Image src={champion.icon} alt={champion.name} width={48} height={48} className="h-12 w-12 rounded-xl object-cover" />
                <span>
                  <span className="block font-black text-white">{champion.name}</span>
                  <span className="block text-xs font-bold text-[#8f97c5]">{champion.games} games tracked</span>
                </span>
              </span>
              <span className="inline-flex items-center gap-2 text-sm font-black text-[#d7dcff]">
                <Image
                  src={roleIcons[champion.role] ?? roleIcons.Fill}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                />
                {champion.role}
              </span>
              <span className="text-sm font-black text-[#48f0df]">{champion.winRate}%</span>
              <span className="text-sm font-bold text-[#d7dcff]">{champion.pickRate}%</span>
              <span className="text-sm font-bold text-[#ff7088]">{champion.banRate}%</span>
              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                champion.trend.startsWith("-")
                  ? "bg-[#ff7088]/12 text-[#ff7088]"
                  : "bg-[#48f0df]/12 text-[#48f0df]"
              }`}>
                <TrendingUp size={14} />
                {champion.trend}
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="space-y-7">
        <section className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6">
          <div className="flex items-center gap-4">
            <Image src={selected.icon} alt={selected.name} width={72} height={72} className="h-18 w-18 rounded-2xl object-cover" />
            <div>
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black ${tierStyles[selected.tier]}`}>
                {selected.tier}
              </span>
              <h2 className="mt-2 text-3xl font-black text-white">{selected.name}</h2>
              <p className="text-sm font-bold text-[#8f97c5]">{selected.role} priority pick</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Mini label="Win" value={`${selected.winRate}%`} />
            <Mini label="Pick" value={`${selected.pickRate}%`} />
            <Mini label="Ban" value={`${selected.banRate}%`} />
          </div>
        </section>

        <section className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-black text-white">Inhouse Players</h2>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ffd84d]/12 px-3 py-1 text-xs font-black text-[#ffd84d]">
              <BarChart3 size={15} />
              Usage
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {selected.players.map((player) => (
              <div key={player.name} className="rounded-2xl bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#353b73] text-sm font-black text-white">
                      {player.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="flex items-center gap-2 font-black text-white">
                        {player.name}
                        <BadgeCheck size={15} className="text-[#48f0df]" />
                      </p>
                      <p className="text-xs font-bold text-[#8f97c5]">{player.record}</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-[#48f0df]">{player.winRate}%</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-bold text-[#aeb5da]">
                  <span>KDA {player.kda}</span>
                  <span>{selected.name} games</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-3 text-center">
      <p className="text-[0.65rem] font-black uppercase text-[#8f97c5]">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}
