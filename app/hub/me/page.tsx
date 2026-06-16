import Image from "next/image";
import type { ReactNode } from "react";
import {
  Award,
  BadgeCheck,
  Camera,
  Crown,
  Flame,
  ImageIcon,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";
import { HubShell } from "../_components/HubShell";

const roleIcons: Record<string, string> = {
  Top: "/lol/roles/top.png",
  Jungle: "/lol/roles/jungle.png",
  Mid: "/lol/roles/mid.png",
  ADC: "/lol/roles/bot.png",
  Bot: "/lol/roles/bot.png",
  Support: "/lol/roles/support.png",
  Fill: "/lol/roles/fill.png",
  Flex: "/lol/roles/fill.png",
};

const championPool = [
  { name: "Ahri", icon: "/lol/champions/103.png", role: "Mid", games: 12, winRate: 75, kda: "5.8" },
  { name: "Orianna", icon: "/lol/champions/61.png", role: "Mid", games: 9, winRate: 67, kda: "4.9" },
  { name: "Syndra", icon: "/lol/champions/134.png", role: "Mid", games: 7, winRate: 71, kda: "5.1" },
  { name: "Taliyah", icon: "/lol/champions/163.png", role: "Flex", games: 5, winRate: 60, kda: "3.8" },
  { name: "Vi", icon: "/lol/champions/254.png", role: "Jungle", games: 4, winRate: 50, kda: "3.2" },
  { name: "Rakan", icon: "/lol/champions/497.png", role: "Support", games: 3, winRate: 67, kda: "4.4" },
];

const recentMatches = [
  { champion: "Ahri", icon: "/lol/champions/103.png", result: "WIN", kda: "9/2/11", elo: "+24", tag: "MVP" },
  { champion: "Orianna", icon: "/lol/champions/61.png", result: "WIN", kda: "6/3/14", elo: "+18", tag: "Control" },
  { champion: "Syndra", icon: "/lol/champions/134.png", result: "LOSS", kda: "7/5/8", elo: "-12", tag: "SVP" },
  { champion: "Taliyah", icon: "/lol/champions/163.png", result: "WIN", kda: "5/1/13", elo: "+21", tag: "Roam" },
];

const awards = [
  { label: "Weekly MVP", value: "2x", icon: Crown },
  { label: "Pentakill", value: "1x", icon: Sparkles },
  { label: "Most In Form", value: "3w", icon: Flame },
];

const titleBadges = [
  { label: "The Carry", active: true },
  { label: "Shotcaller", active: false },
  { label: "Control Mage", active: false },
  { label: "Clutch Player", active: false },
];

const roleBreakdown = [
  { role: "Mid", value: 62, accent: "bg-[#48f0df]" },
  { role: "Jungle", value: 18, accent: "bg-[#8b7cff]" },
  { role: "Support", value: 12, accent: "bg-[#ffd84d]" },
  { role: "ADC", value: 8, accent: "bg-[#ff7088]" },
];

const radar = [
  { label: "Mechanics", value: 86 },
  { label: "Macro", value: 74 },
  { label: "Teamfight", value: 91 },
  { label: "Vision", value: 62 },
  { label: "Clutch", value: 88 },
  { label: "Consistency", value: 79 },
];

export default function MyProfilePage() {
  return (
    <HubShell
      active="profile"
      eyebrow="Player Identity"
      title="My Profile"
      description="Player profile, ELO, champion pool, match history, awards, and inhouse participation."
    >
      <div className="space-y-7">
        <section className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <ProfileHeader />
          <section className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f97c5]">
              Inhouse Record
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Metric label="ELO" value="1984" accent="text-[#ffd84d]" />
              <Metric label="Rank" value="#1" accent="text-[#48f0df]" />
              <Metric label="W/L" value="31-12" />
              <Metric label="MVPs" value="9" />
            </div>
          </section>
        </section>

        <section className="grid gap-7 xl:grid-cols-[22rem_minmax(0,1fr)_22rem]">
          <PerformanceRadar />
          <ChampionPool />
          <AwardsCard />
        </section>

        <section className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <RecentMatches />
          <InhouseSummary />
        </section>
      </div>
    </HubShell>
  );
}

function ProfileHeader() {
  return (
    <div className="relative overflow-hidden rounded-[1.7rem] border border-[#7f6bff]/25 bg-[#11141f] shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
      <div className="relative h-44 overflow-hidden bg-[radial-gradient(circle_at_80%_15%,rgba(72,240,223,0.32),transparent_28%),linear-gradient(135deg,#252b64,#10131f_58%,#07090f)]">
        <button
          type="button"
          className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full bg-black/35 px-4 py-2 text-xs font-black text-white ring-1 ring-white/10 backdrop-blur"
        >
          <ImageIcon size={15} />
          Upload Banner
        </button>
      </div>

      <div className="-mt-14 flex items-end gap-6 px-7 pb-7">
        <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-[1.7rem] bg-[#2f3568] text-4xl font-black text-white ring-4 ring-[#11141f]">
          JF
          <button
            type="button"
            className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#48f0df] text-[#071015] shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
            aria-label="Upload avatar"
          >
            <Camera size={18} />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-5xl font-black tracking-normal text-white">
              Jade Falcon
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#48f0df]/12 px-3 py-1 text-xs font-black text-[#48f0df]">
              <BadgeCheck size={15} />
              KOOK Verified
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#8b7cff]/14 px-4 py-2 text-sm font-black text-[#c9c2ff]">
              <Image
                src={roleIcons.Mid}
                alt=""
                width={18}
                height={18}
                className="h-[18px] w-[18px] object-contain"
              />
              Main Role: Mid
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2 text-sm font-bold text-[#d7dcff]">
              <Image
                src={roleIcons.Support}
                alt=""
                width={18}
                height={18}
                className="h-[18px] w-[18px] object-contain"
              />
              Secondary: Support
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ffd84d]/12 px-4 py-2 text-sm font-black text-[#ffd84d]">
              <Crown size={16} />
              Active Title: The Carry
            </span>
          </div>

          <p className="mt-3 text-base font-bold text-[#aeb5da]">
            Riot ID: JadeFalcon#2209 - KOOK ID: jade.falcon - China Server: Ionia
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {titleBadges.map((item) => (
              <span
                key={item.label}
                className={`rounded-full px-4 py-2 text-sm font-bold ${
                  item.active
                    ? "bg-[#48f0df] text-[#071015]"
                    : "bg-white/[0.07] text-[#d7dcff]"
                }`}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent = "text-white" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f97c5]">{label}</p>
      <p className={`mt-2 text-3xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

function PerformanceRadar() {
  const points = radar
    .map((item, index) => {
      const angle = (Math.PI * 2 * index) / radar.length - Math.PI / 2;
      const radius = (item.value / 100) * 42;
      return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`;
    })
    .join(" ");

  return (
    <section className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6">
      <h2 className="text-xl font-black text-white">Performance Radar</h2>
      <svg viewBox="0 0 100 100" className="mt-4 h-56 w-full">
        {[14, 28, 42].map((radius) => (
          <polygon
            key={radius}
            points={radar
              .map((_, index) => {
                const angle = (Math.PI * 2 * index) / radar.length - Math.PI / 2;
                return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`;
              })
              .join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
          />
        ))}
        <polygon points={points} fill="rgba(72,240,223,0.28)" stroke="#48f0df" strokeWidth="2" />
      </svg>
      <div className="grid grid-cols-2 gap-2">
        {radar.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-xs font-bold">
            <span className="text-[#aeb5da]">{item.label}</span>
            <span className="text-white">{item.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChampionPool() {
  return (
    <section className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-black text-white">Champion Pool</h2>
        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-[#aeb5da]">
          Role Breakdown
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {roleBreakdown.map((role) => (
          <div key={role.role} className="rounded-2xl bg-white/[0.04] p-3">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="flex items-center gap-2 text-[#aeb5da]">
                <Image
                  src={roleIcons[role.role] ?? roleIcons.Fill}
                  alt=""
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] object-contain"
                />
                {role.role}
              </span>
              <span className="text-white">{role.value}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <span className={`block h-full ${role.accent}`} style={{ width: `${role.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
        {championPool.map((champion) => (
          <div key={champion.name} className="w-44 shrink-0 rounded-2xl bg-white/[0.04] p-4">
            <Image src={champion.icon} alt={champion.name} width={72} height={72} className="h-16 w-16 rounded-xl object-cover" />
            <p className="mt-4 font-black text-white">{champion.name}</p>
            <p className="mt-1 text-xs font-bold text-[#8f97c5]">{champion.role}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniChampionStat label="G" value={String(champion.games)} />
              <MiniChampionStat label="WR" value={`${champion.winRate}%`} />
              <MiniChampionStat label="KDA" value={champion.kda} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniChampionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-2 py-2">
      <p className="text-[0.62rem] font-black text-[#8f97c5]">{label}</p>
      <p className="mt-1 text-xs font-black text-white">{value}</p>
    </div>
  );
}

function AwardsCard() {
  return (
    <section className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6">
      <h2 className="text-xl font-black text-white">Awards</h2>
      <div className="mt-5 space-y-4">
        {awards.map((award) => {
          const Icon = award.icon;
          return (
            <div key={award.label} className="flex items-center gap-4 rounded-2xl bg-white/[0.04] p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ffd84d]/12 text-[#ffd84d]">
                <Icon size={22} />
              </span>
              <div>
                <p className="text-sm font-black text-white">{award.label}</p>
                <p className="text-lg font-black text-[#48f0df]">{award.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentMatches() {
  return (
    <section className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6">
      <h2 className="text-xl font-black text-white">Recent Matches</h2>
      <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.06]">
        {recentMatches.map((match) => (
          <div key={`${match.champion}-${match.kda}`} className="grid grid-cols-[minmax(12rem,1fr)_7rem_7rem_7rem_7rem] items-center border-t border-white/[0.06] px-4 py-4 first:border-t-0">
            <div className="flex items-center gap-3">
              <Image src={match.icon} alt={match.champion} width={44} height={44} className="h-11 w-11 rounded-xl object-cover" />
              <span className="font-black text-white">{match.champion}</span>
            </div>
            <span className={`font-black ${match.result === "WIN" ? "text-[#48f0df]" : "text-[#ff7088]"}`}>{match.result}</span>
            <span className="font-bold text-[#d7dcff]">{match.kda}</span>
            <span className="font-black text-[#ffd84d]">{match.elo}</span>
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-center text-xs font-black text-white">{match.tag}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function InhouseSummary() {
  return (
    <section className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6">
      <h2 className="text-xl font-black text-white">Inhouse Activity</h2>
      <div className="mt-5 space-y-4">
        <Activity icon={<Trophy size={20} />} label="Current Ladder" value="#1" />
        <Activity icon={<Zap size={20} />} label="Current Streak" value="+7W" />
        <Activity icon={<Swords size={20} />} label="Games Played" value="43" />
        <Activity icon={<Shield size={20} />} label="KOOK Status" value="Verified" />
      </div>
    </section>
  );
}

function Activity({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-4">
      <span className="flex items-center gap-3 text-sm font-bold text-[#aeb5da]">
        <span className="text-[#8b7cff]">{icon}</span>
        {label}
      </span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}
