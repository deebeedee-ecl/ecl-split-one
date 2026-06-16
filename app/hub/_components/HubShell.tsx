import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  Award,
  Gauge,
  Home,
  Search,
  Settings,
  Swords,
  Trophy,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

type HubSection =
  | "dashboard"
  | "profile"
  | "ladder"
  | "players"
  | "champions"
  | "inhouses"
  | "search"
  | "settings";

type HubMenuItem = {
  id: HubSection | "main-site";
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const primaryItems: HubMenuItem[] = [
  { id: "dashboard", label: "Dashboard", description: "Hub overview, updates, and key modules.", href: "/hub/dashboard", icon: Gauge },
  { id: "profile", label: "My Profile", description: "Your ELO, identity, champions, and awards.", href: "/hub/me", icon: UserCircle },
  { id: "ladder", label: "Ranked Ladder", description: "Top players, form trends, and live ladder events.", href: "/hub/leaderboard", icon: Trophy },
  { id: "players", label: "Players", description: "Browse every registered ECL player profile.", href: "/hub/players", icon: Users },
  { id: "champions", label: "Champions", description: "Champion pools, win rates, and meta stats.", href: "/hub/champions", icon: Award },
  { id: "inhouses", label: "Inhouses", description: "Match history, drafts, stats, and reports.", href: "/hub/inhouses", icon: Swords },
  { id: "search", label: "Search", description: "Find players, matches, champions, and records.", href: "/hub/search", icon: Search },
];

const secondaryItems: HubMenuItem[] = [
  { id: "settings", label: "Settings", description: "Account, Riot ID, KOOK, and preferences.", href: "/hub/settings", icon: Settings },
  { id: "main-site", label: "Main Website", description: "Return to the public ECL website.", href: "/", icon: Home },
];

export function HubShell({
  active,
  eyebrow,
  title,
  description,
  children,
}: {
  active: HubSection;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="fixed inset-0 z-[200] overflow-auto bg-[#06081d] text-white [font-family:Poppins,Arial,sans-serif]">
      <div className="flex min-h-screen min-w-[72rem] gap-7 p-0">
        <HubSidebar active={active} />
        <section className="my-7 mr-7 min-w-0 flex-1 rounded-[2rem] border border-white/[0.06] bg-[#0a0d0c] p-7">
          <div className="mb-7 flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8ea4a0]">
                {eyebrow}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-normal">
                {title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8ea4a0]">
                {description}
              </p>
            </div>
            <div className="rounded-2xl bg-[#151716] px-4 py-2.5 text-xs font-semibold text-[#9aa8a5]">
              Phase 1 Skeleton
            </div>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}

function HubSidebar({ active }: { active: HubSection }) {
  return (
    <aside className="sticky top-0 z-50 flex h-screen w-[84px] shrink-0 flex-col items-center overflow-visible border-r border-[#7d4cff]/35 bg-[linear-gradient(180deg,#222a5b_0%,#10173c_44%,#06091f_100%)] py-9 shadow-[18px_0_70px_rgba(0,0,0,0.38)]">
      <div
        className="mb-[3.25rem] flex h-16 w-16 items-center justify-center overflow-hidden"
        aria-label="ECL Hub"
        title="ECL Hub"
      >
        <Image
          src="/ecl-logo.png"
          alt="ECL"
          width={96}
          height={96}
          className="h-24 w-24 max-w-none object-contain"
          priority
        />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-9">
        <div className="flex flex-col items-center gap-9">
          {primaryItems.map((item) => (
            <SidebarItem key={item.id} item={item} active={active === item.id} />
          ))}
        </div>

        <div className="mt-auto flex flex-col items-center gap-9 pb-3">
          {secondaryItems.map((item) => (
            <SidebarItem key={item.id} item={item} active={active === item.id} />
          ))}
        </div>
      </nav>
    </aside>
  );
}

function SidebarItem({
  item,
  active,
}: {
  item: HubMenuItem;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      title={item.label}
      className={`group relative flex h-12 w-12 items-center justify-center rounded-full transition ${
        active
          ? "bg-[#6957ff] text-white shadow-[0_18px_48px_rgba(105,87,255,0.42)]"
          : "text-[#9ca2c9] hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <Icon
        size={active ? 22 : 23}
        strokeWidth={active ? 2.8 : 2.15}
        className="transition"
      />
      <span className="pointer-events-none absolute left-[3.85rem] z-[999] w-64 rounded-2xl bg-[#151a45] px-4 py-3 text-left opacity-0 shadow-[0_18px_44px_rgba(0,0,0,0.42)] ring-1 ring-white/10 transition group-hover:translate-x-1 group-hover:opacity-100">
        <span className="block text-sm font-black text-white">{item.label}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-[#aeb5da]">
          {item.description}
        </span>
      </span>
    </Link>
  );
}

export function PlaceholderGrid({
  children,
  columns = "three",
}: {
  children: ReactNode;
  columns?: "two" | "three" | "four";
}) {
  const columnClass =
    columns === "four"
      ? "xl:grid-cols-4"
      : columns === "two"
        ? "xl:grid-cols-2"
        : "xl:grid-cols-3";

  return <div className={`grid gap-5 md:grid-cols-2 ${columnClass}`}>{children}</div>;
}

export function PlaceholderCard({
  title,
  description,
  tall = false,
}: {
  title: string;
  description: string;
  tall?: boolean;
}) {
  return (
    <section
      className={`rounded-[1.4rem] border border-white/[0.07] bg-[#1b1b1b] p-6 shadow-[0_18px_54px_rgba(0,0,0,0.22)] ${
        tall ? "min-h-72" : "min-h-40"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8ea4a0]">
        Placeholder
      </p>
      <h2 className="mt-3 text-2xl font-black tracking-normal text-white">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#a8aaa7]">{description}</p>
    </section>
  );
}
