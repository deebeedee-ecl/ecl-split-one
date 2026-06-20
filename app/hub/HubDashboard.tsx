import {
  BarChart3,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UserCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { ShanghaiClock } from "./_components/ShanghaiClock";
import { HubShell } from "./_components/HubShell";

const moduleFilters = [
  "All Hub",
  "Profiles",
  "Ladder",
  "Champions",
  "Inhouses",
  "Awards",
  "Search",
];

const hubModules = [
  {
    title: "Player Profiles",
    subtitle: "Riot ID, KOOK verification, ELO, awards, and champion identity.",
    author: "Identity layer",
    meta: "Profiles",
    icon: UserCircle,
    preview: "profile",
  },
  {
    title: "Ranked Ladder",
    subtitle: "Top 3 showcase, table filters, win rate, and rating movement.",
    author: "ELO system",
    meta: "Competition",
    icon: Trophy,
    preview: "ladder",
  },
  {
    title: "Champion Analytics",
    subtitle: "Most played picks, win rates, KDA trends, and performance splits.",
    author: "Stats engine",
    meta: "Champions",
    icon: BarChart3,
    preview: "champions",
  },
  {
    title: "Inhouse History",
    subtitle: "Recent matches, MVP tags, queue results, and match timelines.",
    author: "KOOK loop",
    meta: "Matches",
    icon: Swords,
    preview: "matches",
  },
];

export default function HubDashboard() {
  return (
    <HubShell
      active="dashboard"
      eyebrow="League Overview"
      title="Dashboard"
      description="High-level Hub overview. Future widgets will connect live player, inhouse, match, ELO, and award data."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="relative h-[26rem] overflow-hidden border border-white/[0.08] bg-[#111216] shadow-[0_24px_90px_rgba(0,0,0,0.48)]">
          <video
            className="absolute left-[60%] top-1/2 h-[92rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 -rotate-90 object-cover [object-position:center_center]"
            src="/hub-hero-bg.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(9,10,12,0.98)_0%,rgba(9,10,12,0.9)_42%,rgba(9,10,12,0.5)_42%,rgba(9,10,12,0.28)_100%)]" />
          <div className="absolute inset-y-0 left-[35%] w-28 -skew-x-6 bg-[#ff1728]/24" />

          <div className="relative flex h-full flex-col justify-between p-8 lg:p-10">
            <div className="max-w-xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff1728]">
                ECL Player Operating System
              </p>
              <h2 className="mt-7 text-[clamp(2.5rem,4.2vw,4.9rem)] font-black uppercase leading-[1.06] tracking-normal text-[#e7e7e7]">
                Welcome to the Hub
              </h2>
              <p className="mt-5 max-w-md text-lg font-black leading-7 text-[#ff1728]">
                Queue, compete, climb, and track every ranked inhouse story.
              </p>
            </div>

            <div className="flex items-end justify-between gap-6">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center bg-[#ff1728] text-white">
                  <Sparkles size={22} />
                </span>
                <div>
                  <p className="text-sm font-black text-[#f2f2f2]">Shanghai time</p>
                  <p className="text-sm font-black text-[#ff1728]">
                    <ShanghaiClock />
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        <aside className="h-[26rem] border border-white/[0.08] bg-[#191a1f] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.34)]">
          <h2 className="text-4xl font-black uppercase tracking-normal text-[#f2f2f2]">
            Updates
          </h2>
          <p className="mt-2 inline-block bg-[#ff1728] px-4 py-1.5 text-sm font-black uppercase tracking-[0.18em] text-white">
            Patch Notes
          </p>
          <p className="mt-8 text-lg font-black leading-8 text-[#f2f2f2]">
            This is v1 of the Hub and it is under development.
          </p>
          <p className="mt-5 text-base font-semibold leading-7 text-[#a9adb4]">
            The current focus is locking in the dashboard structure, navigation,
            profile areas, ladder views, inhouse history, and future spaces for
            live KOOK data.
          </p>
        </aside>
      </div>

      <section className="mt-7">
        <h2 className="text-3xl font-black uppercase tracking-normal text-[#f2f2f2]">
          Hub Modules
        </h2>

        <div className="mt-5 flex flex-wrap gap-4">
          {moduleFilters.map((filter, index) => (
            <span
              key={filter}
              className={`rounded-full border px-6 py-3 text-sm font-bold ${
                index === 0
                  ? "border-[#ff1728] bg-[#ff1728] text-white"
                  : "border-white/[0.10] bg-[#191a1f] text-[#d7d7d7]"
              }`}
            >
              {filter}
            </span>
          ))}
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {hubModules.map((module) => {
            const Icon = module.icon;

            return (
              <article key={module.title}>
                <div className="relative h-56 overflow-hidden border border-white/[0.08] bg-[linear-gradient(135deg,#24252a,#111216)] p-5 shadow-[0_18px_54px_rgba(0,0,0,0.34)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,23,40,0.18),transparent_32%)]" />
                  <div className="relative h-full">
                    <ModulePreview type={module.preview} icon={<Icon size={24} />} />
                  </div>
                </div>
                <h3 className="mt-5 text-xl font-black uppercase leading-7 tracking-normal text-[#f2f2f2]">
                  {module.title}
                </h3>
                <p className="mt-2 min-h-16 text-sm font-semibold leading-6 text-[#a9adb4]">
                  {module.subtitle}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="h-10 w-10 bg-[#ff1728]" />
                  <div>
                    <p className="text-sm font-black text-[#f2f2f2]">{module.author}</p>
                    <p className="text-sm font-semibold text-[#a9adb4]">
                      {module.meta}
                    </p>
                  </div>
                  <ShieldCheck size={16} className="text-[#ff1728]" />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </HubShell>
  );
}

function ModulePreview({
  type,
  icon,
}: {
  type: string;
  icon: ReactNode;
}) {
  if (type === "profile") {
    return (
      <div className="flex h-full flex-col justify-end">
        <div className="mb-5 h-14 w-full bg-[linear-gradient(90deg,#3a1015,#1b1c21_60%,#ff1728)] opacity-85" />
        <div className="flex items-end gap-4">
          <span className="flex h-16 w-16 items-center justify-center bg-[#ff1728] text-white">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-2 h-4 w-28 bg-[#f2f2f2]" />
            <div className="h-2 w-36 bg-[#a9adb4]/50" />
            <div className="mt-4 flex gap-2">
              <span className="h-7 w-16 bg-[#ff1728]" />
              <span className="h-7 w-20 bg-white/10" />
              <span className="h-7 w-14 bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "ladder") {
    return (
      <div className="flex h-full flex-col justify-between">
        <span className="flex h-12 w-12 items-center justify-center bg-[#ff1728] text-white">
          {icon}
        </span>
        <div className="space-y-3">
          {[1, 2, 3].map((rank) => (
            <div key={rank} className="grid grid-cols-[2rem_minmax(0,1fr)_3rem] items-center gap-3">
              <span className="text-lg font-black text-[#ff1728]">#{rank}</span>
              <span className="h-3 bg-[#f2f2f2]/80" />
              <span className="h-3 bg-white/18" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "champions") {
    return (
      <div className="flex h-full flex-col justify-between">
        <span className="flex h-12 w-12 items-center justify-center bg-[#ff1728] text-white">
          {icon}
        </span>
        <div className="grid grid-cols-5 items-end gap-3">
          {[72, 48, 88, 60, 38].map((height, index) => (
            <div key={index} className="flex flex-col items-center gap-2">
              <span className="w-full bg-[#ff1728]" style={{ height }} />
              <span className="h-8 w-8 bg-[#f2f2f2]/75" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between">
      <span className="flex h-12 w-12 items-center justify-center bg-[#ff1728] text-white">
        {icon}
      </span>
      <div className="space-y-3">
        {["ECL", "MVP", "KDA"].map((label, index) => (
          <div key={label} className="grid grid-cols-[3rem_minmax(0,1fr)_2.5rem] items-center gap-3 border border-white/10 bg-black/20 px-3 py-2">
            <span className="text-[10px] font-black text-[#ff1728]">{label}</span>
            <span className="h-2 bg-[#f2f2f2]/70" />
            <span className={index === 0 ? "h-2 bg-[#ff1728]" : "h-2 bg-white/20"} />
          </div>
        ))}
      </div>
    </div>
  );
}
