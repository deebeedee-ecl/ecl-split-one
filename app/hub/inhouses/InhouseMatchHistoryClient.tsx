"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";

const championIcons: Record<string, string> = {
  Aatrox: "/lol/champions/266.png",
  Ahri: "/lol/champions/103.png",
  Aphelios: "/lol/champions/523.png",
  Azir: "/lol/champions/268.png",
  Braum: "/lol/champions/201.png",
  "Kai'Sa": "/lol/champions/145.png",
  "K'Sante": "/lol/champions/897.png",
  LeeSin: "/lol/champions/64.png",
  "Lee Sin": "/lol/champions/64.png",
  Lulu: "/lol/champions/117.png",
  Maokai: "/lol/champions/57.png",
  Nautilus: "/lol/champions/111.png",
  Ornn: "/lol/champions/516.png",
  Orianna: "/lol/champions/61.png",
  Rakan: "/lol/champions/497.png",
  Rell: "/lol/champions/526.png",
  Renekton: "/lol/champions/58.png",
  Syndra: "/lol/champions/134.png",
  Taliyah: "/lol/champions/163.png",
  Thresh: "/lol/champions/412.png",
  Vi: "/lol/champions/254.png",
  Viego: "/lol/champions/234.png",
  Viktor: "/lol/champions/112.png",
  Xayah: "/lol/champions/498.png",
  XinZhao: "/lol/champions/5.png",
  "Xin Zhao": "/lol/champions/5.png",
  Zeri: "/lol/champions/221.png",
  Gwen: "/lol/champions/887.png",
  Jarvan: "/lol/champions/59.png",
  Jinx: "/lol/champions/222.png",
  Ezreal: "/lol/champions/81.png",
};

const objectiveIcons: Record<string, string> = {
  Barons: "/lol/objectives/baron.png",
  Drakes: "/lol/objectives/dragon.png",
  Elders: "/lol/objectives/elder.png",
  Heralds: "/lol/objectives/herald.png",
  Towers: "/lol/objectives/tower.png",
  "Void Grubs": "/lol/objectives/void-grub.png",
};

const dragonIcons: Record<string, string> = {
  Cloud: "/lol/objectives/dragon-air.png",
  Infernal: "/lol/objectives/dragon-fire.png",
  Mountain: "/lol/objectives/dragon-earth.png",
  Ocean: "/lol/objectives/dragon-water.png",
  Hextech: "/lol/objectives/dragon.png",
};

const matches = [
  {
    id: "IH-1042",
    date: "14 Jun",
    blue: "Sky Smash VC",
    red: "Thunder Spike VC",
    score: "3 - 2",
    blueResult: "WIN",
    redResult: "LOSS",
    duration: "38:42",
    stage: "Ranked Inhouse",
    game: "Game 1",
    stats: {
      kda: ["34/27/83", "27/34/66"],
      gold: ["72.4K", "68.9K"],
      towers: ["9", "6"],
      grubs: ["3", "-"],
      heralds: ["1", "-"],
      drakes: ["Cloud", "Infernal", "Mountain", "Cloud"],
      elders: ["-", "-"],
      barons: ["1", "-"],
    },
    blueDraft: ["Ahri", "Vi", "Jinx", "Thresh", "Aatrox"],
    redDraft: ["Orianna", "Viego", "Kai'Sa", "Rakan", "K'Sante"],
    blueDamage: [
      ["Jade", "Ahri", 28.4],
      ["Storm", "Vi", 18.1],
      ["Shadow", "Jinx", 31.7],
      ["Ghost", "Thresh", 7.8],
      ["Vortex", "Aatrox", 14.2],
    ],
    redDamage: [
      ["Night", "Orianna", 27.2],
      ["Killer", "Viego", 22.8],
      ["Spike", "Kai'Sa", 29.6],
      ["Bolt", "Rakan", 8.4],
      ["Anchor", "K'Sante", 18.9],
    ],
    goldDiff: [0, 0.4, 1.1, 2.8, 3.2, 4.5, 3.9, 5.8, 8.1, 6.4, 7.2, 3.5],
  },
  {
    id: "IH-1041",
    date: "14 Jun",
    blue: "Sigma Lone Wolves",
    red: "Kiff's Drive",
    score: "2 - 0",
    blueResult: "WIN",
    redResult: "LOSS",
    duration: "29:15",
    stage: "Ranked Inhouse",
    game: "Game 2",
    stats: {
      kda: ["29/13/71", "13/29/34"],
      gold: ["61.3K", "49.2K"],
      towers: ["10", "3"],
      grubs: ["2", "1"],
      heralds: ["1", "-"],
      drakes: ["Infernal", "Ocean", "Ocean"],
      elders: ["-", "-"],
      barons: ["1", "-"],
    },
    blueDraft: ["Syndra", "Lee Sin", "Ezreal", "Nautilus", "Renekton"],
    redDraft: ["Viktor", "Xin Zhao", "Zeri", "Lulu", "Ornn"],
    blueDamage: [
      ["Alpha", "Syndra", 32.1],
      ["Dino", "Lee Sin", 19.4],
      ["Bait", "Ezreal", 26.8],
      ["Ward", "Nautilus", 6.7],
      ["Brake", "Renekton", 14.9],
    ],
    redDamage: [
      ["Kiffa", "Viktor", 21.2],
      ["Drive", "Xin Zhao", 13.5],
      ["Zip", "Zeri", 18.4],
      ["Bloom", "Lulu", 5.9],
      ["Forge", "Ornn", 12.7],
    ],
    goldDiff: [0, 1.2, 2.7, 4.9, 5.3, 7.1, 8.4, 10.2, 12.1, 11.8],
  },
  {
    id: "IH-1040",
    date: "13 Jun",
    blue: "Bean There Done That",
    red: "Big Booty Brodies",
    score: "0 - 1",
    blueResult: "LOSS",
    redResult: "WIN",
    duration: "41:06",
    stage: "Ranked Inhouse",
    game: "Game 3",
    stats: {
      kda: ["17/24/48", "24/17/62"],
      gold: ["70.1K", "75.6K"],
      towers: ["5", "8"],
      grubs: ["1", "3"],
      heralds: ["-", "1"],
      drakes: ["Ocean", "Hextech", "Hextech", "Cloud"],
      elders: ["-", "1"],
      barons: ["-", "1"],
    },
    blueDraft: ["Azir", "Jarvan", "Xayah", "Rell", "Gwen"],
    redDraft: ["Taliyah", "Maokai", "Aphelios", "Braum", "Jax"],
    blueDamage: [
      ["Bean", "Azir", 28.2],
      ["Flag", "Jarvan", 11.9],
      ["Feather", "Xayah", 24.4],
      ["Crash", "Rell", 7.2],
      ["Snip", "Gwen", 18.6],
    ],
    redDamage: [
      ["Booty", "Aphelios", 35.9],
      ["Root", "Maokai", 11.8],
      ["Side", "Jax", 18.6],
      ["Peel", "Braum", 5.4],
      ["Wave", "Taliyah", 20.1],
    ],
    goldDiff: [0, -0.3, -1.2, -2.4, -1.6, -3.1, -5.4, -6.8, -5.9, -8.1, -5.5],
  },
];

const statLabels = [
  ["KDA", "kda"],
  ["Gold", "gold"],
  ["Towers", "towers"],
  ["Void Grubs", "grubs"],
  ["Heralds", "heralds"],
  ["Drakes", "drakes"],
  ["Elders", "elders"],
  ["Barons", "barons"],
] as const;

export function InhouseMatchHistoryClient() {
  const [selectedId, setSelectedId] = useState(matches[0].id);
  const selected = useMemo(
    () => matches.find((match) => match.id === selectedId) ?? matches[0],
    [selectedId],
  );

  return (
    <div className="grid gap-7 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white">Match History</h2>
          <MoreHorizontal size={22} className="text-[#8f97c5]" />
        </div>
        <div className="mt-5 space-y-3">
          {matches.map((match) => (
            <button
              key={match.id}
              type="button"
              onClick={() => setSelectedId(match.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selected.id === match.id
                  ? "border-[#7f6bff] bg-[#7f6bff]/14"
                  : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#8f97c5]">
                  {match.id}
                </span>
                <span className="text-xs font-bold text-[#48f0df]">{match.date}</span>
              </div>
              <p className="mt-3 text-sm font-black leading-5 text-white">
                {match.blue} vs {match.red}
              </p>
              <p className="mt-3 text-lg font-black text-white">{match.score}</p>
            </button>
          ))}
        </div>
      </aside>

      <BroadcastReport match={selected} />
    </div>
  );
}

function BroadcastReport({ match }: { match: (typeof matches)[number] }) {
  return (
    <section className="relative overflow-hidden rounded-[1.4rem] border border-[#7f6bff]/30 bg-[#0c0620] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.42)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(104,96,255,0.34),transparent_24%),radial-gradient(circle_at_88%_10%,rgba(255,93,128,0.24),transparent_28%),linear-gradient(135deg,rgba(60,30,140,0.55),rgba(8,4,26,0.96)_46%,rgba(16,10,44,0.98))]" />
      <div className="relative">
        <ScoreStrip match={match} />

        <div className="mt-5 grid gap-6 xl:grid-cols-[42%_58%]">
          <GameStats match={match} />

          <div className="space-y-6">
            <DamagePanel match={match} />
            <GoldDiffChart values={match.goldDiff} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm font-black uppercase tracking-[0.14em] text-[#c9cee9]">
          <span>ECL Ranked Inhouses</span>
          <span>
            {match.stage} | {match.game}
          </span>
          <span>{match.date}</span>
        </div>
      </div>
    </section>
  );
}

function ScoreStrip({ match }: { match: (typeof matches)[number] }) {
  const [blueScore, redScore] = match.score.split(" - ");

  return (
    <div className="grid grid-cols-[1fr_5rem_6rem_8rem_6rem_5rem_1fr] items-center overflow-hidden rounded-sm border border-white/10 bg-black/35 text-white">
      <div className="bg-[#161039] px-6 py-5 text-4xl font-black uppercase tracking-normal">
        {match.blue}
      </div>
      <div className="border-l border-white/15 py-5 text-center text-5xl font-black text-[#8b7cff]">
        {blueScore}
      </div>
      <div className="border-x border-white/15 py-5 text-center text-2xl font-light uppercase text-white/70">
        {match.blueResult}
      </div>
      <div className="py-4 text-center">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-white/65">
          Game Time
        </p>
        <p className="text-4xl font-light tracking-normal">{match.duration}</p>
      </div>
      <div className="border-x border-white/15 py-5 text-center text-2xl font-light uppercase text-white/70">
        {match.redResult}
      </div>
      <div className="py-5 text-center text-5xl font-black text-[#ff7088]">
        {redScore}
      </div>
      <div className="bg-[linear-gradient(90deg,rgba(255,112,136,0.1),rgba(255,112,136,0.62))] px-6 py-5 text-right text-4xl font-black uppercase tracking-normal">
        {match.red}
      </div>
    </div>
  );
}

function GameStats({ match }: { match: (typeof matches)[number] }) {
  return (
    <section className="rounded-sm bg-black/24 p-6">
      <h2 className="text-center text-xl font-black uppercase tracking-[0.14em] text-white">
        Game Stats
      </h2>
      <div className="mt-5 border-t border-white/16">
        {statLabels.map(([label, key]) => {
          const value = match.stats[key];
          const blue = Array.isArray(value) && key === "drakes" ? value.slice(0, 2).join(" / ") : value[0];
          const red = Array.isArray(value) && key === "drakes" ? value.slice(2).join(" / ") : value[1];

          return (
            <div
              key={label}
              className="grid grid-cols-[1fr_9rem_1fr] items-center border-b border-white/16 py-4 text-center"
            >
              <span className="text-2xl font-light text-white">
                {key === "drakes" ? <DragonList value={blue} /> : blue}
              </span>
              <span className="text-sm font-black uppercase tracking-[0.08em] text-white/75">
                <StatLabel label={label} />
              </span>
              <span className="text-2xl font-light text-white">
                {key === "drakes" ? <DragonList value={red} /> : red}
              </span>
            </div>
          );
        })}
        <div className="grid grid-cols-[1fr_9rem_1fr] items-center border-b border-white/16 py-4">
          <DraftIcons champions={match.blueDraft} tone="blue" />
          <span className="text-center text-sm font-black uppercase tracking-[0.08em] text-white/75">
            Bans
          </span>
          <DraftIcons champions={match.redDraft} tone="red" />
        </div>
      </div>
    </section>
  );
}

function DraftIcons({ champions, tone }: { champions: string[]; tone: "blue" | "red" }) {
  return (
    <div className={`flex gap-2 ${tone === "red" ? "justify-end" : ""}`}>
      {champions.map((champion) => (
        <ChampionIcon
          key={champion}
          champion={champion}
          className={`h-9 w-9 rounded-sm ring-1 ${
            tone === "blue" ? "ring-[#8b7cff]/55" : "ring-[#ff7088]/55"
          }`}
        />
      ))}
    </div>
  );
}

function DamagePanel({ match }: { match: (typeof matches)[number] }) {
  const maxDamage = Math.max(
    ...match.blueDamage.map((item) => Number(item[2])),
    ...match.redDamage.map((item) => Number(item[2])),
  );

  return (
    <section className="rounded-sm bg-black/20 p-6">
      <h2 className="text-center text-xl font-black uppercase tracking-[0.14em] text-white">
        Total Damage Dealt
      </h2>
      <div className="mt-5 space-y-4">
        {match.blueDamage.map((bluePlayer, index) => {
          const redPlayer = match.redDamage[index];

          return (
            <div
              key={String(bluePlayer[0])}
              className="grid grid-cols-[1fr_5rem_1fr] items-center gap-4"
            >
              <DamageBar player={bluePlayer} max={maxDamage} tone="blue" />
              <span className="h-px bg-white/10" />
              <DamageBar player={redPlayer} max={maxDamage} tone="red" align="right" />
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center gap-3 text-xs font-bold text-white/70">
        <span className="h-2 w-10 bg-[#8b7cff]" />
        <span className="h-2 w-10 bg-[#ff7088]" />
        <span>Damage dealt by champion</span>
      </div>
    </section>
  );
}

function DamageBar({
  player,
  max,
  tone,
  align = "left",
}: {
  player: (typeof matches)[number]["blueDamage"][number];
  max: number;
  tone: "blue" | "red";
  align?: "left" | "right";
}) {
  const width = (Number(player[2]) / max) * 100;

  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className={`flex items-center gap-3 ${align === "right" ? "justify-end" : ""}`}>
        {align === "left" && <ChampionIcon champion={String(player[1])} className="h-12 w-12 rounded-sm" />}
        <p className="text-lg font-black leading-5 text-white">
          {player[0]}
          <span className="block text-white/80">{player[2]}K</span>
        </p>
        {align === "right" && <ChampionIcon champion={String(player[1])} className="h-12 w-12 rounded-sm" />}
      </div>
      <div className={`mt-2 flex ${align === "right" ? "justify-end" : ""}`}>
        <span
          className={`block h-3 ${tone === "blue" ? "bg-[#8b7cff]" : "bg-[#ff7088]"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function StatLabel({ label }: { label: string }) {
  const icon = objectiveIcons[label];

  return (
    <span className="inline-flex items-center justify-center gap-2">
      {icon && (
        <Image
          src={icon}
          alt=""
          width={22}
          height={22}
          className="h-5 w-5 object-contain opacity-85"
        />
      )}
      {label}
    </span>
  );
}

function DragonList({ value }: { value: string }) {
  if (!value || value === "-") return <span>-</span>;

  return (
    <span className="inline-flex items-center justify-center gap-1">
      {value.split(" / ").map((dragon, index) => {
        const icon = dragonIcons[dragon] ?? objectiveIcons.Drakes;

        return (
          <Image
            key={`${dragon}-${index}`}
            src={icon}
            alt={dragon}
            width={24}
            height={24}
            title={dragon}
            className="h-6 w-6 object-contain"
          />
        );
      })}
    </span>
  );
}

function ChampionIcon({
  champion,
  className,
}: {
  champion: string;
  className: string;
}) {
  const icon = championIcons[champion];

  if (!icon) {
    return (
      <span className={`flex items-center justify-center bg-white/10 text-[0.62rem] font-black text-white ${className}`}>
        {champion.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={icon}
      alt={champion}
      width={64}
      height={64}
      title={champion}
      className={`object-cover ${className}`}
    />
  );
}

function GoldDiffChart({ values }: { values: number[] }) {
  const min = Math.min(...values, -1);
  const max = Math.max(...values, 1);
  const range = max - min;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="rounded-sm bg-black/20 p-6">
      <h2 className="text-center text-xl font-black uppercase tracking-[0.14em] text-white">
        Gold Difference
      </h2>
      <svg
        className="mt-6 h-56 w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label="Gold difference graph"
      >
        <defs>
          <linearGradient id="matchGoldFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff7088" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#8b7cff" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((x) => (
          <line key={x} x1={x} x2={x} y1="0" y2="100" stroke="rgba(255,255,255,0.16)" />
        ))}
        <line x1="0" x2="100" y1="50" y2="50" stroke="rgba(255,255,255,0.28)" />
        <polygon points={`0,50 ${points} 100,50`} fill="url(#matchGoldFill)" />
        <polyline
          points={points}
          fill="none"
          stroke="#ff7088"
          strokeWidth="2.2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex justify-between text-sm font-black text-white/70">
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>25</span>
        <span>31</span>
      </div>
    </section>
  );
}
