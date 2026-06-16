import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Medal,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UserCircle,
  Users,
} from "lucide-react";

type Stat = {
  label: string;
  value: string;
  note: string;
};

type Feature = {
  title: string;
  description: string;
  href?: string;
  icon: LucideIcon;
};

export const hubStats: Stat[] = [
  { label: "Active players", value: "128", note: "mock community size" },
  { label: "Inhouse games", value: "342", note: "planned tracked matches" },
  { label: "Champion picks", value: "89", note: "future champion database" },
  { label: "Weekly awards", value: "12", note: "seasonal progression hooks" },
];

export const hubFeatures: Feature[] = [
  {
    title: "Player Search",
    description: "Find public profiles, Riot IDs, KOOK links, form, and roles.",
    href: "/hub/players",
    icon: Users,
  },
  {
    title: "My Dashboard",
    description: "Personal account home for linked identity and progression.",
    href: "/hub/me",
    icon: UserCircle,
  },
  {
    title: "Leaderboard",
    description: "Ranked inhouse ELO table with wins, losses, and recent form.",
    href: "/hub/leaderboard",
    icon: Medal,
  },
  {
    title: "Champion Stats",
    description: "Pick rates, win rates, MVPs, and player champion pools.",
    href: "/hub/champions",
    icon: Sparkles,
  },
  {
    title: "Match History",
    description: "Recorded inhouses, reports, game stats, and imports.",
    href: "/hub/matches",
    icon: Swords,
  },
  {
    title: "Search Engine",
    description: "Experimental China server search and import workflow.",
    href: "/hub/search-engine",
    icon: Search,
  },
];

const mockLeaderboard = [
  { rank: "01", player: "Jade Falcon", elo: "1,724", record: "22-9" },
  { rank: "02", player: "Mango Mid", elo: "1,681", record: "19-10" },
  { rank: "03", player: "River Warden", elo: "1,655", record: "17-8" },
  { rank: "12", player: "deebeedee", elo: "1,612", record: "18-11" },
];

export function HubPage({
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f6f2ea] text-stone-950">
      <section className="border-b border-stone-200 bg-[#fbfaf7]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-stone-700">
                <Icon size={15} />
                {eyebrow}
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-normal text-stone-950 sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 text-base leading-7 text-stone-600 sm:text-lg">
                {description}
              </p>
            </div>
            <Link
              href="/hub"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-stone-700 transition hover:border-stone-500 hover:text-black"
            >
              Hub Home
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </section>
    </main>
  );
}

export function StatGrid({ stats = hubStats }: { stats?: Stat[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
        >
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-stone-500">
            {stat.label}
          </p>
          <p className="mt-3 text-3xl font-black text-stone-950">
            {stat.value}
          </p>
          <p className="mt-1 text-sm text-stone-500">{stat.note}</p>
        </div>
      ))}
    </div>
  );
}

export function FeatureGrid({ features = hubFeatures }: { features?: Feature[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {features.map((feature) => {
        const Icon = feature.icon;
        const content = (
          <>
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-stone-100 text-stone-800">
              <Icon size={22} />
            </div>
            <h2 className="mt-5 text-xl font-black text-stone-950">
              {feature.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {feature.description}
            </p>
          </>
        );

        if (!feature.href) {
          return (
            <div
              key={feature.title}
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
            >
              {content}
            </div>
          );
        }

        return (
          <Link
            key={feature.title}
            href={feature.href}
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-400 hover:shadow-md"
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}

export function SearchPanel({
  label = "Search",
  placeholder = "Search players, champions, or match IDs",
}: {
  label?: string;
  placeholder?: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <label
        htmlFor="hub-search"
        className="text-xs font-bold uppercase tracking-[0.12em] text-stone-500"
      >
        {label}
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <div className="flex min-h-12 flex-1 items-center gap-3 rounded-md border border-stone-300 bg-[#fbfaf7] px-4 text-stone-500">
          <Search size={18} />
          <input
            id="hub-search"
            type="search"
            placeholder={placeholder}
            className="w-full bg-transparent py-3 text-sm text-stone-900 outline-none placeholder:text-stone-400"
          />
        </div>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-stone-950 px-5 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-stone-800"
        >
          Search
        </button>
      </div>
    </div>
  );
}

export function LeaderboardPreview() {
  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-stone-500">
            Inhouse Ladder
          </p>
          <h2 className="mt-1 text-xl font-black text-stone-950">
            Top Players
          </h2>
        </div>
        <Medal className="text-stone-700" size={24} />
      </div>
      <div className="divide-y divide-stone-200">
        {mockLeaderboard.map((player) => (
          <div
            key={player.rank}
            className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-5 py-4"
          >
            <span className="font-black text-stone-400">{player.rank}</span>
            <div>
              <p className="font-bold text-stone-950">{player.player}</p>
              <p className="text-sm text-stone-500">{player.record}</p>
            </div>
            <span className="rounded-md bg-stone-100 px-3 py-2 text-sm font-black text-stone-800">
              {player.elo}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center">
      <ShieldCheck className="mx-auto text-stone-700" size={30} />
      <h2 className="mt-4 text-2xl font-black text-stone-950">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-stone-600">
        {description}
      </p>
    </div>
  );
}

export function ArchiveCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-400 hover:shadow-md"
    >
      <CalendarDays className="text-stone-700" size={25} />
      <h2 className="mt-4 text-2xl font-black text-stone-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-stone-600">{description}</p>
    </Link>
  );
}

export { BarChart3, Medal, Search, Sparkles, Swords, Trophy, UserCircle, Users };
