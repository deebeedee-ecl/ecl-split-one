"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

const championIcons: Record<string, string> = {
  Aatrox: "/lol/champions/266.png",
  Ahri: "/lol/champions/103.png",
  Annie: "/lol/champions/1.png",
  Aphelios: "/lol/champions/523.png",
  Azir: "/lol/champions/268.png",
  Blitzcrank: "/lol/champions/53.png",
  Braum: "/lol/champions/201.png",
  Brand: "/lol/champions/63.png",
  "Cho'Gath": "/lol/champions/31.png",
  "Kai'Sa": "/lol/champions/145.png",
  "K'Sante": "/lol/champions/897.png",
  Caitlyn: "/lol/champions/51.png",
  Darius: "/lol/champions/122.png",
  Draven: "/lol/champions/119.png",
  Elise: "/lol/champions/60.png",
  Fiora: "/lol/champions/114.png",
  Galio: "/lol/champions/3.png",
  Gragas: "/lol/champions/79.png",
  Jax: "/lol/champions/24.png",
  Kennen: "/lol/champions/85.png",
  Kayn: "/lol/champions/141.png",
  Karma: "/lol/champions/43.png",
  LeeSin: "/lol/champions/64.png",
  "Lee Sin": "/lol/champions/64.png",
  Leona: "/lol/champions/89.png",
  Lucian: "/lol/champions/236.png",
  Lulu: "/lol/champions/117.png",
  Malphite: "/lol/champions/54.png",
  Maokai: "/lol/champions/57.png",
  MasterYi: "/lol/champions/11.png",
  "Master Yi": "/lol/champions/11.png",
  Mel: "/lol/champions/800.png",
  Milio: "/lol/champions/902.png",
  Morgana: "/lol/champions/25.png",
  Naafiri: "/lol/champions/950.png",
  Nasus: "/lol/champions/75.png",
  Nautilus: "/lol/champions/111.png",
  Neeko: "/lol/champions/518.png",
  Ornn: "/lol/champions/516.png",
  Orianna: "/lol/champions/61.png",
  Rakan: "/lol/champions/497.png",
  Rell: "/lol/champions/526.png",
  Renekton: "/lol/champions/58.png",
  Seraphine: "/lol/champions/147.png",
  Sett: "/lol/champions/875.png",
  Samira: "/lol/champions/360.png",
  Shaco: "/lol/champions/35.png",
  Sion: "/lol/champions/14.png",
  Swain: "/lol/champions/50.png",
  Sylas: "/lol/champions/517.png",
  Syndra: "/lol/champions/134.png",
  Taliyah: "/lol/champions/163.png",
  Thresh: "/lol/champions/412.png",
  Trundle: "/lol/champions/48.png",
  Varus: "/lol/champions/110.png",
  Vi: "/lol/champions/254.png",
  Viego: "/lol/champions/234.png",
  Viktor: "/lol/champions/112.png",
  Vladimir: "/lol/champions/8.png",
  Xayah: "/lol/champions/498.png",
  Yone: "/lol/champions/777.png",
  XinZhao: "/lol/champions/5.png",
  "Xin Zhao": "/lol/champions/5.png",
  Yuumi: "/lol/champions/350.png",
  Zed: "/lol/champions/238.png",
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
    id: "IH - 001",
    date: "19 Jun",
    blue: "Blue Side",
    red: "Red Side",
    score: "0 - 1",
    blueResult: "LOSS",
    redResult: "WIN",
    duration: "31:28",
    stage: "Flex source",
    game: "ecl.gg Galio sample",
    stats: {
      kda: ["21/38/30", "38/21/73"],
      gold: ["56.1K", "71.4K"],
      towers: ["3", "11"],
      grubs: ["-", "-"],
      heralds: ["-", "-"],
      drakes: ["0", "4"],
      elders: ["-", "-"],
      barons: ["1", "1"],
    },
    blueDraft: ["Darius", "Yone", "Elise", "Draven", "Thresh"],
    redDraft: ["Malphite", "Zed", "Shaco", "Lulu", "Swain"],
    blueDamage: [
      ["03射手座代言人#70860", "Kennen", 28.7, "3/7/4"],
      ["过季短袖#42152", "Xin Zhao", 16.8, "5/7/9"],
      ["重蹈覆辙#70801", "Sylas", 20.2, "6/5/5"],
      ["耐摔の牢大科比#98914", "Varus", 28.3, "6/9/5"],
      ["对鱼说#73597", "Neeko", 8.7, "1/10/7"],
    ],
    redDamage: [
      ["Flan#55511", "Fiora", 21.7, "4/5/11"],
      ["MADᅠCUZᅠBAD#36614", "Morgana", 23.7, "9/5/14"],
      ["deebeedee#34323", "Galio", 32.7, "8/4/16"],
      ["Uunlru#43247", "Caitlyn", 46.7, "16/5/11"],
      ["xrcrhino#69949", "Seraphine", 10.9, "1/2/21"],
    ],
    standouts: {
      mvp: ["Uunlru#43247", "Caitlyn", "16/5/11"],
      svp: ["重蹈覆辙#70801", "Sylas", "6/5/5"],
    },
    goldDiff: [],
  },
  {
    id: "IH - 002",
    date: "09 Jun",
    blue: "Blue Side",
    red: "Red Side",
    score: "0 - 1",
    blueResult: "LOSS",
    redResult: "WIN",
    duration: "17:01",
    stage: "Solo/Duo source",
    game: "ecl.gg Ahri sample",
    stats: {
      kda: ["6/17/6", "17/6/21"],
      gold: ["26.6K", "37.0K"],
      towers: ["0", "5"],
      grubs: ["-", "-"],
      heralds: ["-", "-"],
      drakes: ["0", "2"],
      elders: ["-", "-"],
      barons: ["0", "0"],
    },
    blueDraft: ["Brand", "Blitzcrank", "Nasus", "Zed", "No Ban"],
    redDraft: ["Sylas", "Thresh", "Yuumi", "Master Yi", "Morgana"],
    blueDamage: [
      ["遇坑送不解释#73505", "Malphite", 5.5, "0/2/1"],
      ["漫步野区喷全场#74892", "Kayn", 6.4, "2/4/2"],
      ["deebeedee#34323", "Ahri", 5.6, "2/1/1"],
      ["她对我来说#43738", "Lucian", 8.8, "2/5/1"],
      ["一二三四丶吴先生#36012", "Milio", 3.0, "0/5/1"],
    ],
    redDamage: [
      ["天才美少女卡沙#90567", "Sion", 9.2, "1/1/5"],
      ["QaQ#69147", "Naafiri", 7.0, "3/1/6"],
      ["雪落成眠#25126", "Mel", 6.3, "3/1/0"],
      ["秋秋叶#20574", "Samira", 9.0, "9/1/2"],
      ["小小贝#26304", "Nautilus", 3.5, "1/2/8"],
    ],
    standouts: {
      mvp: ["秋秋叶#20574", "Samira", "9/1/2"],
      svp: ["deebeedee#34323", "Ahri", "2/1/1"],
    },
    goldDiff: [],
  },
  {
    id: "IH - 003",
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
    goldDiff: [0, -0.1, -0.3, -0.4, -0.2, 0.1, 0.4, 0.3, 0.7, 0.5, 0.8, 0.6, 1.0, 0.8, 0.9, 1.2, 0.8, 0.6, 5.8, 6.4, 5.5, 3.1, 3.5, 1.2, 0.9, 4.5, 5.4, 6.2, 5.0, 7.2, 5.9],
  },
  {
    id: "IH - 004",
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
    goldDiff: [0, 0.1, 0.6, 1.1, 1.4, 1.2, -0.7, -1.3, -1.1, -0.8, 0.4, 1.7, 1.9, 0.1, -0.3, -2.1, -1.7, -2.2, -1.9, -2.5, -2.0, 0.3, -3.4, -5.2, -7.7],
  },
  {
    id: "IH - 005",
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

// Type for live data fetched from the DB (compatible with mock shape)
export type LiveMatchData = {
  id: string;
  date: string;
  blue: string;
  red: string;
  score: string;
  blueResult: string;
  redResult: string;
  duration: string;
  stage: string;
  game: string;
  stats: { kda: [string, string]; gold: [string, string]; towers: [string, string]; grubs: [string, string]; heralds: [string, string]; drakes: [string, string]; elders: [string, string]; barons: [string, string] };
  blueDraft: string[];
  redDraft: string[];
  blueDamage: [string, string, number, string?][];
  redDamage: [string, string, number, string?][];
  goldDiff: number[];
};

// Show all matches (real data will override the mock array via props)
const visibleMatches = matches;

function getMatchSlug(matchId: string) {
  return matchId
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function findMatchBySlug(matchId: string, haystack: LiveMatchData[]) {
  return haystack.find((match) => getMatchSlug(match.id) === matchId) ?? haystack[0];
}

export function InhouseMatchHistoryClient({ liveMatches }: { liveMatches?: LiveMatchData[] }) {
  const allMatches = (liveMatches && liveMatches.length > 0 ? liveMatches : visibleMatches) as LiveMatchData[];
  const recentMatches = allMatches.slice(0, 5);
  const [selectedId, setSelectedId] = useState(allMatches[0]?.id ?? "");
  const selected = useMemo(
    () => recentMatches.find((match) => match.id === selectedId) ?? recentMatches[0],
    [selectedId, recentMatches],
  );

  return (
    <div className="grid gap-7" style={{ gridTemplateColumns: "20rem minmax(0, 1fr)" }}>
      <aside className="rounded-[1.7rem] border border-white/[0.07] bg-[#101420] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white">Match History</h2>
          <Link
            href="/hub/inhouses/archive"
            className="rounded-full border border-white/[0.10] px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#48f0df] transition hover:border-[#48f0df]/70 hover:bg-[#48f0df]/10"
          >
            View all
          </Link>
        </div>
        <div className="mt-5 space-y-3">
          {recentMatches.map((match, index) => {
            const isRedCard = index % 2 === 0;
            const isSelected = selected.id === match.id;

            return (
              <button
                key={match.id}
                type="button"
                onClick={() => setSelectedId(match.id)}
                className="w-full rounded-2xl border p-4 text-left transition hover:brightness-110"
                style={{
                  background: isRedCard
                    ? "linear-gradient(135deg, #8f1627 0%, #5c0b16 48%, #2a0409 100%)"
                    : "linear-gradient(135deg, #050609 0%, #101116 100%)",
                  borderColor: isSelected
                    ? isRedCard
                      ? "rgba(255, 112, 128, 0.92)"
                      : "rgba(255, 255, 255, 0.72)"
                    : isRedCard
                      ? "rgba(255, 35, 56, 0.48)"
                      : "rgba(255, 255, 255, 0.08)",
                  boxShadow: isSelected && isRedCard
                    ? "0 0 34px rgba(255, 35, 56, 0.18)"
                    : undefined,
                }}
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
            );
          })}
        </div>
      </aside>

      <BroadcastReport match={selected} />
    </div>
  );
}

export function InhouseArchiveClient({ liveMatches }: { liveMatches?: LiveMatchData[] }) {
  const allMatches = (liveMatches && liveMatches.length > 0 ? liveMatches : visibleMatches) as LiveMatchData[];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1728]">
            Stored Inhouses
          </p>
          <h2 className="mt-2 text-3xl font-black uppercase text-white">
            Full Match Archive
          </h2>
        </div>
        <Link
          href="/hub/inhouses"
          className="border border-white/[0.10] bg-[#15161a] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/[0.06]"
        >
          Back to latest 5
        </Link>
      </div>

      <section className="overflow-hidden rounded-[1.4rem] border border-white/[0.08] bg-[#101420] shadow-[0_24px_90px_rgba(0,0,0,0.34)]">
        <div className="grid grid-cols-[7rem_minmax(14rem,1fr)_8rem_7rem_8rem_7rem] border-b border-white/[0.08] px-5 py-4 text-xs font-black uppercase tracking-[0.14em] text-[#8f97c5]">
          <span>ID</span>
          <span>Match</span>
          <span>Score</span>
          <span>Date</span>
          <span>Duration</span>
          <span />
        </div>
        {allMatches.map((match) => (
          <Link
            key={match.id}
            href={`/hub/inhouses/${getMatchSlug(match.id)}`}
            className="grid grid-cols-[7rem_minmax(14rem,1fr)_8rem_7rem_8rem_7rem] items-center border-b border-white/[0.06] px-5 py-4 text-sm font-bold text-white transition last:border-b-0 hover:bg-white/[0.04]"
          >
            <span className="font-black text-[#48f0df]">{match.id}</span>
            <span className="min-w-0">
              <span className="block truncate font-black">
                {match.blue} vs {match.red}
              </span>
              <span className="mt-1 block text-xs font-semibold text-[#8f97c5]">
                {match.stage} | {match.game}
              </span>
            </span>
            <span className="text-lg font-black">{match.score}</span>
            <span className="text-[#c9cee9]">{match.date}</span>
            <span className="text-[#c9cee9]">{match.duration}</span>
            <span className="text-right text-xs font-black uppercase tracking-[0.12em] text-[#ff7088]">
              View
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}

export function InhouseMatchDetailClient({ matchId, liveMatches }: { matchId: string; liveMatches?: LiveMatchData[] }) {
  const allMatches = (liveMatches && liveMatches.length > 0 ? liveMatches : visibleMatches) as LiveMatchData[];
  const match = findMatchBySlug(matchId, allMatches);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1728]">
            {match.id}
          </p>
          <h2 className="mt-2 text-3xl font-black uppercase text-white">
            {match.blue} vs {match.red}
          </h2>
        </div>
        <Link
          href="/hub/inhouses/archive"
          className="border border-white/[0.10] bg-[#15161a] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/[0.06]"
        >
          Back to archive
        </Link>
      </div>
      <BroadcastReport match={match} />
    </div>
  );
}

function BroadcastReport({ match }: { match: LiveMatchData }) {
  return (
    <section className="relative overflow-hidden rounded-[1.4rem] border border-[#7f6bff]/35 bg-[#0c0620] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.42)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(104,96,255,0.42),transparent_25%),radial-gradient(circle_at_88%_10%,rgba(255,93,128,0.3),transparent_30%),linear-gradient(135deg,rgba(60,30,140,0.68),rgba(8,4,26,0.98)_46%,rgba(18,4,31,0.98))]" />
      <div className="relative">
        <ScoreStrip match={match} />

        <div className="mt-5 grid gap-6" style={{ gridTemplateColumns: "42% minmax(0, 58%)" }}>
          <GameStats match={match} />

          <div className="space-y-6">
            <DamagePanel match={match} />
            <MatchStandouts match={match} />
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

function ScoreStrip({ match }: { match: LiveMatchData }) {
  const [blueScore, redScore] = match.score.split(" - ");

  return (
    <div
      className="grid items-center overflow-hidden rounded-sm text-white shadow-[0_18px_54px_rgba(36,30,120,0.24)]"
      style={{
        gridTemplateColumns: "1fr 5rem 6rem 8rem 6rem 5rem 1fr",
        background:
          "linear-gradient(90deg, rgba(42, 85, 255, 0.95) 0%, rgba(35, 59, 180, 0.78) 20%, rgba(13, 11, 31, 0.98) 43%, rgba(13, 11, 31, 0.98) 57%, rgba(126, 18, 47, 0.78) 80%, rgba(255, 30, 48, 0.95) 100%)",
      }}
    >
      <div className="px-6 py-5 text-4xl font-black uppercase tracking-normal">
        {match.blue}
      </div>
      <div className="border-l border-white/[0.16] py-5 text-center text-5xl font-black text-[#7c8cff]">
        {blueScore}
      </div>
      <div className="border-x border-white/[0.16] py-5 text-center text-2xl font-light uppercase text-white/74">
        {match.blueResult}
      </div>
      <div className="py-4 text-center">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-white/65">
          Game Time
        </p>
        <p className="text-4xl font-light tracking-normal">{match.duration}</p>
      </div>
      <div className="border-x border-white/[0.16] py-5 text-center text-2xl font-light uppercase text-white/74">
        {match.redResult}
      </div>
      <div className="py-5 text-center text-5xl font-black text-[#ff3048]">
        {redScore}
      </div>
      <div className="px-6 py-5 text-right text-4xl font-black uppercase tracking-normal">
        {match.red}
      </div>
    </div>
  );
}

function GameStats({ match }: { match: LiveMatchData }) {
  return (
    <section className="rounded-sm bg-[#11072b]/80 p-6">
      <h2 className="text-center text-xl font-black uppercase tracking-[0.14em] text-white">
        Game Stats
      </h2>
      <div className="mt-5 border-t border-white/16">
        {statLabels.map(([label, key]) => {
          const value = match.stats[key];
          const drakeCounts =
            key === "drakes" &&
            Array.isArray(value) &&
            value.length === 2 &&
            value.every((item) => /^\d+$/.test(String(item)));
          const blue = Array.isArray(value) && key === "drakes" && !drakeCounts ? value.slice(0, 2).join(" / ") : value[0];
          const red = Array.isArray(value) && key === "drakes" && !drakeCounts ? value.slice(2).join(" / ") : value[1];

          return (
            <div
              key={label}
              className="grid items-center border-b border-white/16 py-4 text-center"
              style={{ gridTemplateColumns: "1fr 9rem 1fr" }}
            >
              <span className="text-2xl font-light text-white">
                {key === "drakes" && !drakeCounts ? <DragonList value={blue} /> : blue}
              </span>
              <span className="text-sm font-black uppercase tracking-[0.08em] text-white/75">
                <StatLabel label={label} />
              </span>
              <span className="text-2xl font-light text-white">
                {key === "drakes" && !drakeCounts ? <DragonList value={red} /> : red}
              </span>
            </div>
          );
        })}
        <div
          className="grid items-center border-b border-white/16 py-4"
          style={{ gridTemplateColumns: "1fr 9rem 1fr" }}
        >
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
            tone === "blue" ? "ring-[#8b7cff]/70" : "ring-[#ff7088]/70"
          }`}
        />
      ))}
    </div>
  );
}

function DamagePanel({ match }: { match: LiveMatchData }) {
  const maxDamage = Math.max(
    ...match.blueDamage.map((item) => Number(item[2])),
    ...match.redDamage.map((item) => Number(item[2])),
  );

  return (
    <section className="rounded-sm bg-[#09031a]/80 p-6">
      <h2 className="text-center text-xl font-black uppercase tracking-[0.14em] text-white">
        Total Damage Dealt
      </h2>
      <div className="mt-5 space-y-4">
        {match.blueDamage.map((bluePlayer, index) => {
          const redPlayer = match.redDamage[index];

          return (
            <div
              key={String(bluePlayer[0])}
              className="grid items-center gap-4"
              style={{ gridTemplateColumns: "1fr 5rem 1fr" }}
            >
              <DamageBar player={bluePlayer} max={maxDamage} tone="blue" />
              <span className="h-px bg-white/10" />
              <DamageBar player={redPlayer} max={maxDamage} tone="red" align="right" />
            </div>
          );
        })}
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
  player: LiveMatchData["blueDamage"][number];
  max: number;
  tone: "blue" | "red";
  align?: "left" | "right";
}) {
  const [playerName, champion, damage, kda] = player as unknown as readonly [
    string,
    string,
    number,
    string | undefined,
  ];
  const width = (Number(player[2]) / max) * 100;
  const kdaColor = tone === "blue" ? "text-[#83a8ff]" : "text-[#ff7b8a]";

  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}>
      <div className={`flex items-center gap-3 ${align === "right" ? "justify-end" : ""}`}>
        {align === "left" && <ChampionIcon champion={champion} className="h-12 w-12 rounded-sm" />}
        <p className="text-lg font-black leading-5 text-white">
          {stripRiotTag(playerName)}
          <span className="block text-white/80">
            {damage}K
            {kda && <span className={`ml-2 ${kdaColor}`}>{kda}</span>}
          </span>
        </p>
        {align === "right" && <ChampionIcon champion={champion} className="h-12 w-12 rounded-sm" />}
      </div>
      <div className="mt-2 h-3 w-full">
        <span
          className="block h-full min-w-8"
          style={{
            backgroundColor: tone === "blue" ? "#246bff" : "#ff2338",
            marginLeft: align === "right" ? "auto" : undefined,
            width: `${Math.max(width, 12)}%`,
          }}
        />
      </div>
    </div>
  );
}

function MatchStandouts({ match }: { match: LiveMatchData }) {
  const standouts = getStandouts(match);

  return (
    <section className="rounded-sm bg-[linear-gradient(135deg,rgba(26,34,80,0.72),rgba(7,5,18,0.94)_48%,rgba(78,12,28,0.62))] p-6">
      <h2 className="text-center text-xl font-black uppercase tracking-[0.14em] text-white">
        Match Standouts
      </h2>
      <div className="mt-6 grid gap-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <StandoutCard label="MVP" player={standouts.mvp} tone="red" />
        <StandoutCard label="SVP" player={standouts.svp} tone="blue" />
      </div>
    </section>
  );
}

function StandoutCard({
  label,
  player,
  tone,
}: {
  label: "MVP" | "SVP";
  player: readonly [string, string, string];
  tone: "blue" | "red";
}) {
  const accent = tone === "blue" ? "#246bff" : "#ff2338";
  const soft = tone === "blue" ? "rgba(36,107,255,0.16)" : "rgba(255,35,56,0.16)";

  return (
    <div
      className="rounded-sm border border-white/[0.08] p-5"
      style={{ background: `linear-gradient(135deg, ${soft}, rgba(7,8,14,0.76))` }}
    >
      <div className="flex items-center gap-4">
        <ChampionIcon champion={player[1]} className="h-16 w-16 rounded-sm" />
        <div className="min-w-0">
          <p
            className="text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: accent }}
          >
            {label}
          </p>
          <p className="mt-1 truncate text-2xl font-black text-white">
            {stripRiotTag(player[0])}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-white/45">
            Champion
          </p>
          <p className="mt-1 text-lg font-black text-white">{player[1]}</p>
        </div>
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-white/45">
            KDA
          </p>
          <p className="mt-1 text-lg font-black" style={{ color: accent }}>
            {player[2]}
          </p>
        </div>
      </div>
    </div>
  );
}

function getStandouts(match: LiveMatchData) {
  const explicitStandouts = (match as unknown as {
    standouts?: {
      mvp: readonly [string, string, string];
      svp: readonly [string, string, string];
    };
  }).standouts;

  if (explicitStandouts) {
    return explicitStandouts;
  }

  const winnerDamage = match.blueResult === "WIN" ? match.blueDamage : match.redDamage;
  const loserDamage = match.blueResult === "WIN" ? match.redDamage : match.blueDamage;

  return {
    mvp: damagePlayerToStandout(findTopDamage(winnerDamage)),
    svp: damagePlayerToStandout(findTopDamage(loserDamage)),
  };
}

function findTopDamage(players: LiveMatchData["blueDamage"]) {
  return players.reduce((best, player) => (Number(player[2]) > Number(best[2]) ? player : best));
}

function damagePlayerToStandout(player: LiveMatchData["blueDamage"][number]) {
  const [name, champion, , kda] = player as unknown as readonly [
    string,
    string,
    number,
    string | undefined,
  ];

  return [name, champion, kda ?? "-"] as const;
}

function StatLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center">
      {label}
    </span>
  );
}

function stripRiotTag(name: string) {
  return name.split("#")[0] ?? name;
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
  if (champion === "No Ban") {
    return (
      <span
        title="No ban"
        className={`flex items-center justify-center bg-[#050608] ${className}`}
      >
        <svg
          viewBox="0 0 64 64"
          aria-hidden="true"
          className="h-[72%] w-[72%]"
        >
          <path
            d="M32 8 48 18 52 39 41 34 34 51 30 51 23 34 12 39 16 18 32 8Z"
            fill="#6d7a80"
          />
          <path
            d="M22 26c5 1 8 4 10 10 2-6 5-9 10-10-3 9-7 14-10 17-3-3-7-8-10-17Z"
            fill="#050608"
          />
          <path
            d="M32 8 48 18 52 39 41 34 34 51 30 51 23 34 12 39 16 18 32 8Z"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="2"
          />
        </svg>
      </span>
    );
  }

  // Support numeric champion IDs (e.g. "238" for Zed) as returned by lzyumi
  const icon = championIcons[champion] ?? (/^\d+$/.test(champion) ? `/lol/champions/${champion}.png` : null);

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
  const chart = { left: 10, right: 116, top: 14, bottom: 76 };
  const minuteTicks = [0, 7, 15, 23, 31, 39];

  if (values.length < 2) {
    return (
      <section className="rounded-sm bg-[radial-gradient(circle_at_78%_18%,rgba(93,69,190,0.28),transparent_28%),linear-gradient(180deg,#10072a,#070312)] p-6">
        <h2 className="text-center text-xl font-black uppercase tracking-[0.14em] text-white">
          Gold Difference
        </h2>
        <svg
          className="mt-4 h-56 w-full overflow-visible"
          viewBox="0 0 120 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Gold difference graph unavailable"
        >
          {minuteTicks.map((minute) => {
            const x = chart.left + (minute / minuteTicks[minuteTicks.length - 1]) * (chart.right - chart.left);

            return (
              <line
                key={minute}
                x1={x}
                x2={x}
                y1={chart.top}
                y2={chart.bottom}
                stroke="rgba(255,255,255,0.24)"
                strokeWidth="0.45"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          <line
            x1={chart.left}
            x2={chart.right}
            y1="45"
            y2="45"
            stroke="rgba(214,219,255,0.42)"
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
          />
          <text x="4" y="18" fill="#ffffff" fontSize="4.2" fontWeight="900">
            -
          </text>
          <text x="4" y="46.5" fill="#ffffff" fontSize="4.2" fontWeight="900">
            0
          </text>
          <text x="4" y="77" fill="#ffffff" fontSize="4.2" fontWeight="900">
            -
          </text>
          <text x="63" y="46" fill="rgba(255,255,255,0.58)" fontSize="4" fontWeight="900" textAnchor="middle">
            GOLD TIMELINE NOT AVAILABLE
          </text>
          {minuteTicks.map((minute) => {
            const x = chart.left + (minute / minuteTicks[minuteTicks.length - 1]) * (chart.right - chart.left);

            return (
              <text
                key={`label-${minute}`}
                x={x}
                y="88"
                fill="rgba(255,255,255,0.72)"
                fontSize="4.2"
                fontWeight="900"
                textAnchor="middle"
              >
                {minute}
              </text>
            );
          })}
        </svg>
      </section>
    );
  }

  const denseValues = values.flatMap((value, index) => {
    if (index === values.length - 1) return [value];

    const next = values[index + 1];
    return Array.from({ length: 4 }, (_, step) => {
      const progress = step / 4;
      const drift = Math.sin((index * 4 + step) * 1.73) * 0.08;
      return value + (next - value) * progress + drift;
    });
  });
  const min = Math.min(...denseValues, -0.4);
  const max = Math.max(...denseValues, 0.4);
  const range = max - min;
  const yFor = (value: number) => chart.top + ((max - value) / range) * (chart.bottom - chart.top);
  const baseline = yFor(0);
  const plotted = denseValues.map((value, index) => {
    const x = chart.left + (index / (denseValues.length - 1)) * (chart.right - chart.left);
    const y = yFor(value);
    return { value, x, y };
  });
  const blueAreas = buildGoldDiffAreas(plotted, baseline, "blue");
  const redAreas = buildGoldDiffAreas(plotted, baseline, "red");
  const maxMinute = minuteTicks[minuteTicks.length - 1];

  return (
    <section className="rounded-sm bg-[radial-gradient(circle_at_78%_18%,rgba(93,69,190,0.28),transparent_28%),linear-gradient(180deg,#10072a,#070312)] p-6">
      <h2 className="text-center text-xl font-black uppercase tracking-[0.14em] text-white">
        Gold Difference
      </h2>
      <svg
        className="mt-4 h-56 w-full overflow-visible"
        viewBox="0 0 120 100"
        preserveAspectRatio="none"
        role="img"
        aria-label="Gold difference graph"
      >
        <defs>
          <linearGradient id="goldBlueFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6d78ff" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#3940ff" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="goldRedFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff5f72" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ff5f72" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {minuteTicks.map((minute) => {
          const x = chart.left + (minute / maxMinute) * (chart.right - chart.left);

          return (
            <line
              key={minute}
              x1={x}
              x2={x}
              y1={chart.top}
              y2={chart.bottom}
              stroke="rgba(255,255,255,0.42)"
              strokeWidth="0.45"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        <line
          x1={chart.left}
          x2={chart.right}
          y1={baseline}
          y2={baseline}
          stroke="rgba(214,219,255,0.72)"
          strokeWidth="0.7"
          vectorEffect="non-scaling-stroke"
        />
        {blueAreas.map((points, index) => (
          <polygon key={`blue-${index}`} points={points} fill="url(#goldBlueFill)" />
        ))}
        {redAreas.map((points, index) => (
          <polygon key={`red-${index}`} points={points} fill="url(#goldRedFill)" />
        ))}
        {plotted.slice(1).map((point, index) => {
          const previous = plotted[index];
          const stroke = (previous.value + point.value) / 2 >= 0 ? "#6f78ff" : "#ff6b78";

          return (
            <line
              key={`${previous.x}-${point.x}`}
              x1={previous.x}
              y1={previous.y}
              x2={point.x}
              y2={point.y}
              stroke={stroke}
              strokeLinecap="round"
              strokeWidth="1.8"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        <text x="0.5" y={chart.top + 2} fill="#ffffff" fontSize="4.6" fontWeight="900">
          {formatGoldLabel(max)}
        </text>
        <text x="0.5" y={baseline + 1.5} fill="#ffffff" fontSize="4.6" fontWeight="900">
          0
        </text>
        <text x="0.5" y={chart.bottom + 2} fill="#ffffff" fontSize="4.6" fontWeight="900">
          {formatGoldLabel(Math.abs(min))}
        </text>
        {minuteTicks.map((minute) => {
          const x = chart.left + (minute / maxMinute) * (chart.right - chart.left);

          return (
            <text
              key={`label-${minute}`}
              x={x}
              y="88"
              fill="rgba(255,255,255,0.92)"
              fontSize="4.8"
              fontWeight="900"
              textAnchor="middle"
            >
              {minute}
            </text>
          );
        })}
        <ObjectiveMarker x={chart.left + (15 / maxMinute) * (chart.right - chart.left)} y={96} tone="blue" type="dragon" />
        <ObjectiveMarker x={chart.left + (26 / maxMinute) * (chart.right - chart.left)} y={96} tone="blue" type="baron" />
        <ObjectiveMarker x={chart.left + (33 / maxMinute) * (chart.right - chart.left)} y={96} tone="blue" type="baron" />
        <ObjectiveMarker x={chart.left + (38 / maxMinute) * (chart.right - chart.left)} y={96} tone="blue" type="ace" />
      </svg>
    </section>
  );
}

function ObjectiveMarker({
  x,
  y,
  tone,
  type,
}: {
  x: number;
  y: number;
  tone: "blue" | "red";
  type: "dragon" | "baron" | "ace";
}) {
  const color = tone === "blue" ? "#6f78ff" : "#ff6b78";

  if (type === "ace") {
    return (
      <g transform={`translate(${x} ${y})`}>
        <circle r="3" fill={color} />
        <text x="0" y="1.5" fill="#09031a" fontSize="4" fontWeight="900" textAnchor="middle">
          A
        </text>
      </g>
    );
  }

  if (type === "baron") {
    return (
      <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2">
        <path d="M-3 2 -1 -3 0 -1 1 -3 3 2" />
        <path d="M-2 1c1.2 1 2.8 1 4 0" />
      </g>
    );
  }

  return (
    <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2">
      <path d="M0 -4 3 -1 0 4 -3 -1Z" />
      <path d="M0 -2v4" />
    </g>
  );
}

function buildGoldDiffAreas(
  points: Array<{ value: number; x: number; y: number }>,
  baseline: number,
  side: "blue" | "red",
) {
  const isSide = (value: number) => (side === "blue" ? value >= 0 : value <= 0);
  const areas: string[] = [];
  let segment: Array<{ x: number; y: number }> = [];

  points.forEach((point, index) => {
    const previous = points[index - 1];

    if (previous && isSide(previous.value) !== isSide(point.value)) {
      const ratio = Math.abs(previous.value) / (Math.abs(previous.value) + Math.abs(point.value));
      const crossingX = previous.x + (point.x - previous.x) * ratio;
      segment.push({ x: crossingX, y: baseline });
      if (segment.length > 1) {
        areas.push(toAreaPoints(segment, baseline));
      }
      segment = [{ x: crossingX, y: baseline }];
    }

    if (isSide(point.value)) {
      segment.push({ x: point.x, y: point.y });
    } else if (segment.length > 1) {
      areas.push(toAreaPoints(segment, baseline));
      segment = [];
    }
  });

  if (segment.length > 1) {
    areas.push(toAreaPoints(segment, baseline));
  }

  return areas;
}

function toAreaPoints(segment: Array<{ x: number; y: number }>, baseline: number) {
  const first = segment[0];
  const last = segment[segment.length - 1];
  return `${first.x},${baseline} ${segment.map((point) => `${point.x},${point.y}`).join(" ")} ${last.x},${baseline}`;
}

function formatGoldLabel(value: number) {
  return `${Math.abs(value).toFixed(1)}K`;
}
