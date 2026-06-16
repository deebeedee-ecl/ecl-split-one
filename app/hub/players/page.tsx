import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Search, Users, Zap } from "lucide-react";
import { HubShell } from "../_components/HubShell";

const roleIcons: Record<string, string> = {
  Top: "/lol/roles/top.png",
  Jungle: "/lol/roles/jungle.png",
  Mid: "/lol/roles/mid.png",
  Bot: "/lol/roles/bot.png",
  ADC: "/lol/roles/bot.png",
  Support: "/lol/roles/support.png",
  Fill: "/lol/roles/fill.png",
};

const players = [
  { name: "Jade Falcon", riot: "JadeFalcon#2209", role: "Mid", elo: 1984, winRate: 72, status: "Online" },
  { name: "NightKiller", riot: "NightKiller#1190", role: "Jungle", elo: 1907, winRate: 64, status: "Online" },
  { name: "ShadowHex", riot: "ShadowHex#0445", role: "ADC", elo: 1842, winRate: 63, status: "In Game" },
  { name: "VortexRain", riot: "VortexRain#8801", role: "Top", elo: 1788, winRate: 56, status: "Away" },
  { name: "GhostHunter", riot: "GhostHunter#3320", role: "Support", elo: 1729, winRate: 54, status: "Online" },
  { name: "StormTroupe", riot: "StormTroupe#6560", role: "Mid", elo: 1684, winRate: 50, status: "Online" },
  { name: "BaitClick", riot: "BaitClick#7711", role: "ADC", elo: 1652, winRate: 58, status: "Offline" },
  { name: "TopBrake", riot: "TopBrake#4410", role: "Top", elo: 1618, winRate: 52, status: "Online" },
];

const roles = ["All", "Top", "Jungle", "Mid", "Bot", "Support", "Fill"];

export default function PlayersPage() {
  return (
    <HubShell
      active="players"
      eyebrow="Player Directory"
      title="Players"
      description="Browse ECL players by name, role, Riot ID, ELO, and current activity."
    >
      <div className="space-y-7">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem_18rem]">
          <div className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6">
            <label className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-4 text-sm font-bold text-[#8f97c5]">
              <Search size={18} />
              <span>Search player, Riot ID, KOOK ID, role...</span>
            </label>
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
                      width={16}
                      height={16}
                      className="h-4 w-4 object-contain"
                    />
                  )}
                  {role}
                </span>
              ))}
            </div>
          </div>
          <SummaryCard icon={<Users size={24} />} label="Registered Players" value="86" />
          <SummaryCard icon={<Zap size={24} />} label="Online Now" value="18" />
        </section>

        <section className="overflow-hidden rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6 shadow-[0_18px_54px_rgba(0,0,0,0.22)]">
          <div className="grid grid-cols-[minmax(16rem,1fr)_11rem_10rem_8rem_9rem] border-b border-white/[0.06] px-4 pb-3 text-xs font-black uppercase tracking-[0.14em] text-[#8f97c5]">
            <span>Player</span>
            <span>Role</span>
            <span>ELO</span>
            <span>Win</span>
            <span>Status</span>
          </div>

          {players.map((player) => (
            <Link
              key={player.name}
              href="/hub/me"
              className="grid grid-cols-[minmax(16rem,1fr)_11rem_10rem_8rem_9rem] items-center border-b border-white/[0.06] px-4 py-4 transition last:border-b-0 hover:bg-white/[0.04]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#353b73] text-sm font-black text-white">
                  {player.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-black text-white">
                    {player.name}
                    <BadgeCheck size={15} className="text-[#48f0df]" />
                  </span>
                  <span className="mt-1 block truncate text-xs font-bold text-[#8f97c5]">
                    {player.riot}
                  </span>
                </span>
              </span>

              <span className="inline-flex items-center gap-2 text-sm font-black text-[#d7dcff]">
                <Image
                  src={roleIcons[player.role]}
                  alt=""
                  width={22}
                  height={22}
                  className="h-5 w-5 object-contain"
                />
                {player.role}
              </span>
              <span className="text-sm font-black text-[#ffd84d]">{player.elo}</span>
              <span className="text-sm font-black text-[#48f0df]">{player.winRate}%</span>
              <span className="w-fit rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white">
                {player.status}
              </span>
            </Link>
          ))}
        </section>
      </div>
    </HubShell>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <section className="rounded-[1.7rem] border border-white/[0.07] bg-[#11141f] p-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8b7cff]/14 text-[#c9c2ff]">
        {icon}
      </span>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#8f97c5]">{label}</p>
      <p className="mt-2 text-4xl font-black text-white">{value}</p>
    </section>
  );
}
