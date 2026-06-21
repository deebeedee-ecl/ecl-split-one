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
import { HubLogoutButton } from "./HubLogoutButton";
import { HubAccessGate } from "./HubAccessGate";

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
  { id: "settings", label: "Account Settings", description: "Edit account, Riot ID, KOOK, and preferences.", href: "/hub/settings", icon: Settings },
];

export function HubShell({
  active,
  eyebrow,
  title,
  description,
  hideHeader = false,
  children,
}: {
  active: HubSection;
  eyebrow: string;
  title: string;
  description: string;
  hideHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="fixed inset-0 z-[200] overflow-auto bg-[linear-gradient(115deg,transparent_0%,transparent_38%,rgba(255,23,40,0.22)_38%,rgba(255,23,40,0.22)_39%,transparent_39%,transparent_100%),linear-gradient(155deg,transparent_0%,transparent_68%,rgba(255,23,40,0.28)_68%,rgba(255,23,40,0.28)_70%,transparent_70%,transparent_100%),radial-gradient(circle_at_72%_8%,rgba(255,23,40,0.26),transparent_22%),linear-gradient(135deg,#08090b_0%,#141517_45%,#0b0c0e_100%)] text-[#f2f2f2] [font-family:Poppins,Arial,sans-serif]">
      <div className="flex min-h-screen min-w-[72rem] gap-5 p-0">
        <HubSidebar active={active} />
        <section className="my-5 mr-5 min-w-0 flex-1 border border-white/[0.08] bg-[#111216]/94 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.48)] backdrop-blur-sm">
          {!hideHeader && (
            <div className="mb-5 flex items-end justify-between gap-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff1728]">
                  {eyebrow}
                </p>
                <h1 className="mt-2 text-5xl font-black uppercase leading-none tracking-normal text-[#e7e7e7]">
                  {title}
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#a9adb4]">
                  {description}
                </p>
              </div>
              <div className="bg-[#ff1728] px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_0_32px_rgba(255,23,40,0.22)]">
                Beta
              </div>
            </div>
          )}
          <HubAccessGate allowProfileSetup={active === "settings"}>
            {children}
          </HubAccessGate>
        </section>
      </div>
    </main>
  );
}

function HubSidebar({ active }: { active: HubSection }) {
  return (
    <aside className="sticky top-0 z-50 flex h-screen w-[84px] shrink-0 flex-col items-center overflow-visible border-r border-white/[0.08] bg-[linear-gradient(180deg,#18191d_0%,#0f1014_48%,#050608_100%)] py-6 shadow-[18px_0_70px_rgba(0,0,0,0.55)]">
      <Link
        href="/hub/dashboard"
        className="flex h-16 w-16 items-center justify-center transition hover:scale-105"
        aria-label="ECL Hub"
        title="ECL Hub"
      >
        <Image
          src="/ecl-logo.png"
          alt="ECL"
          width={96}
          height={96}
          className="h-20 w-20 max-w-none object-contain"
          priority
        />
      </Link>

      <Link
        href="/"
        className="group relative mt-2 flex h-9 w-9 items-center justify-center border border-white/[0.10] bg-[#101115] text-[#d7d7d7] transition hover:bg-[#ff1728] hover:text-white"
        aria-label="Return to website"
        title="Return to website"
      >
        <Home size={18} strokeWidth={2.35} />
        <span className="pointer-events-none absolute left-[3rem] z-[999] w-48 border border-white/[0.12] bg-[#15161a] px-4 py-3 text-left opacity-0 shadow-[0_18px_44px_rgba(0,0,0,0.45)] transition group-hover:translate-x-1 group-hover:opacity-100">
          <span className="block text-sm font-black text-[#f2f2f2]">
            Return to website
          </span>
        </span>
      </Link>

      <nav className="mt-10 flex flex-1 flex-col items-center gap-9">
        <div className="flex flex-col items-center gap-9">
          {primaryItems.map((item) => (
            <SidebarItem key={item.id} item={item} active={active === item.id} />
          ))}
        </div>

        <div className="mt-auto flex flex-col items-center gap-9 pb-3">
          {secondaryItems.map((item) => (
            <SidebarItem key={item.id} item={item} active={active === item.id} />
          ))}
          <HubLogoutButton />
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
          ? "bg-[#ff1728] text-white shadow-[0_18px_48px_rgba(255,23,40,0.32)]"
          : "text-[#8f96a3] hover:bg-[#ff1728]/12 hover:text-[#f2f2f2]"
      }`}
    >
      <Icon
        size={active ? 22 : 23}
        strokeWidth={active ? 2.8 : 2.15}
        className="transition"
      />
      <span className="pointer-events-none absolute left-[3.85rem] z-[999] w-64 border border-white/[0.12] bg-[#15161a] px-4 py-3 text-left opacity-0 shadow-[0_18px_44px_rgba(0,0,0,0.45)] transition group-hover:translate-x-1 group-hover:opacity-100">
        <span className="block text-sm font-black text-[#f2f2f2]">{item.label}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-[#a9adb4]">
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
      className={`border border-white/[0.08] bg-[#191a1f] p-6 shadow-[0_18px_54px_rgba(0,0,0,0.34)] ${
        tall ? "min-h-72" : "min-h-40"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ff1728]">
        Placeholder
      </p>
      <h2 className="mt-3 text-2xl font-black uppercase tracking-normal text-[#f2f2f2]">
        {title}
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#a9adb4]">{description}</p>
    </section>
  );
}
