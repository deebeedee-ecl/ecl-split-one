import {
  BarChart3,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UserCircle,
} from "lucide-react";
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
  },
  {
    title: "Ranked Ladder",
    subtitle: "Top 3 showcase, table filters, win rate, and rating movement.",
    author: "ELO system",
    meta: "Competition",
    icon: Trophy,
  },
  {
    title: "Champion Analytics",
    subtitle: "Most played picks, win rates, KDA trends, and performance splits.",
    author: "Stats engine",
    meta: "Champions",
    icon: BarChart3,
  },
  {
    title: "Inhouse History",
    subtitle: "Recent matches, MVP tags, queue results, and match timelines.",
    author: "KOOK loop",
    meta: "Matches",
    icon: Swords,
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
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="relative h-[26rem] overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#272d5a] shadow-[0_24px_90px_rgba(0,0,0,0.42)]">
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
          <div className="absolute inset-0 bg-[linear-gradient(92deg,rgba(32,37,78,0.9)_0%,rgba(32,37,78,0.84)_36%,rgba(56,61,105,0.38)_36%,rgba(56,61,105,0.24)_100%)]" />
          <div className="absolute inset-y-0 left-[35%] w-32 -skew-x-6 bg-white/[0.07]" />

          <div className="relative flex h-full flex-col justify-between p-8 lg:p-10">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b7bee7]">
                ECL Player Operating System
              </p>
              <h2 className="mt-7 text-[clamp(2.5rem,4.2vw,4.9rem)] font-semibold leading-[1.06] tracking-normal text-white">
                Welcome to the Hub
              </h2>
              <p className="mt-5 max-w-md text-lg font-medium leading-7 text-[#48d8f0]">
                Queue, compete, climb, and track every ranked inhouse story.
              </p>
            </div>

            <div className="flex items-end justify-between gap-6">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3d4274] text-white">
                  <Sparkles size={22} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Shanghai time</p>
                  <p className="text-sm font-semibold text-[#48d8f0]">
                    <ShanghaiClock />
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="h-3 w-10 rounded-full bg-white" />
                <span className="h-3 w-3 rounded-full bg-white/35" />
                <span className="h-3 w-3 rounded-full bg-white/35" />
                <span className="h-3 w-3 rounded-full bg-white/35" />
              </div>
            </div>
          </div>
        </section>

        <aside className="h-[26rem] rounded-[2rem] border border-white/[0.08] bg-[radial-gradient(circle_at_45%_55%,rgba(105,87,255,0.18),transparent_34%),linear-gradient(180deg,#222650,#111635)] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.36)]">
          <h2 className="text-4xl font-medium uppercase tracking-normal text-white">
            Updates
          </h2>
          <p className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-[#48d8f0]">
            Patch Notes
          </p>
          <p className="mt-8 text-lg font-semibold leading-8 text-[#d8ddff]">
            This is v1 of the Hub and it is under development.
          </p>
          <p className="mt-5 text-base font-medium leading-7 text-[#aeb5da]">
            The current focus is locking in the dashboard structure, navigation,
            profile areas, ladder views, inhouse history, and future spaces for
            live KOOK data.
          </p>
        </aside>
      </div>

      <section className="mt-9">
        <h2 className="text-3xl font-black tracking-normal text-white">
          Hub Modules
        </h2>

        <div className="mt-5 flex flex-wrap gap-4">
          {moduleFilters.map((filter, index) => (
            <span
              key={filter}
              className={`rounded-full border px-6 py-3 text-sm font-bold ${
                index === 0
                  ? "border-white bg-white text-[#11142e]"
                  : "border-[#505789] bg-transparent text-[#c9cee9]"
              }`}
            >
              {filter}
            </span>
          ))}
        </div>

        <div className="mt-7 grid gap-7 md:grid-cols-2 xl:grid-cols-4">
          {hubModules.map((module) => {
            const Icon = module.icon;

            return (
              <article key={module.title}>
                <div className="flex h-56 items-end overflow-hidden rounded-[1.4rem] border border-white/[0.07] bg-[#3b4073] p-6 shadow-[0_18px_54px_rgba(0,0,0,0.2)]">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#272d5a] text-[#48d8f0]">
                    <Icon size={27} />
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-black leading-7 tracking-normal text-white">
                  {module.title}
                </h3>
                <p className="mt-2 min-h-16 text-sm font-semibold leading-6 text-[#b9bed7]">
                  {module.subtitle}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="h-10 w-10 rounded-full bg-[#3b4073]" />
                  <div>
                    <p className="text-sm font-black text-white">{module.author}</p>
                    <p className="text-sm font-semibold text-[#a9aed0]">
                      {module.meta}
                    </p>
                  </div>
                  <ShieldCheck size={16} className="text-white" />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </HubShell>
  );
}
