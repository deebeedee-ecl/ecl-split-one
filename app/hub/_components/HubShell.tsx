import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  Award,
  DoorOpen,
  Gauge,
  Globe2,
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
  | "world-cup"
  | "settings";

type HubMenuItem = {
  id: HubSection | "main-site";
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const primaryItems: HubMenuItem[] = [
  { id: "dashboard", label: "World Cup", description: "Tournament overview, dates, and entry.", href: "/hub/dashboard", icon: Gauge },
  { id: "world-cup", label: "My World Cup Team", description: "Your roster, application, or captain dashboard.", href: "/hub/world-cup/my", icon: Globe2 },
  { id: "profile", label: "My Profile", description: "Your ELO, identity, champions, and awards.", href: "/hub/me", icon: UserCircle },
  { id: "ladder", label: "Ranked Ladder", description: "Top players, form trends, and live ladder events.", href: "/hub/leaderboard", icon: Trophy },
  { id: "players", label: "Players", description: "Browse every registered ECL player profile.", href: "/hub/players", icon: Users },
  { id: "champions", label: "Champions", description: "Champion pools, win rates, and meta stats.", href: "/hub/champions", icon: Award },
  { id: "inhouses", label: "Inhouses", description: "Match history, drafts, stats, and reports.", href: "/hub/inhouses", icon: Swords },
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
  theme?: "red" | "blue";
  children: ReactNode;
}) {
  const pageBackground =
    "bg-[linear-gradient(120deg,transparent_0%,transparent_46%,rgba(7,151,242,0.16)_46%,rgba(7,151,242,0.16)_47%,transparent_47%,transparent_100%),radial-gradient(circle_at_74%_8%,rgba(54,215,255,0.24),transparent_24%),linear-gradient(135deg,#030817_0%,#061C4A_48%,#020612_100%)]";

  return (
    <main className={`fixed inset-0 z-[200] overflow-auto ${pageBackground} text-[#f2f2f2] [font-family:Poppins,Arial,sans-serif]`}>
      <div className="flex min-h-screen min-w-0 gap-3 p-0 lg:gap-5">
        <HubSidebar active={active} />
        <section className="my-3 mr-3 min-w-0 flex-1 border border-white/[0.08] bg-[#111216]/94 p-3 shadow-[0_24px_90px_rgba(0,0,0,0.48)] backdrop-blur-sm sm:p-4 lg:my-5 lg:mr-5 lg:p-6">
          {!hideHeader && (
            <div className="mb-5 flex items-end justify-between gap-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#36D7FF]">
                  {eyebrow}
                </p>
                <h1 className="mt-2 text-5xl font-black uppercase leading-none tracking-normal text-[#e7e7e7]">
                  {title}
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#a9adb4]">
                  {description}
                </p>
              </div>
              <div className="bg-[#0755C9] px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_0_32px_rgba(54,215,255,0.18)]">
                Hub
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
          <Link
            href="/"
            className="group relative flex h-12 w-12 items-center justify-center rounded-full text-[#8f96a3] transition hover:bg-[#0755C9]/18 hover:text-white"
            aria-label="Return to website"
            title="Return to website"
          >
            <DoorOpen size={23} strokeWidth={2.15} />
            <span className="pointer-events-none absolute left-[3.85rem] z-[999] w-64 border border-white/[0.12] bg-[#15161a] px-4 py-3 text-left opacity-0 shadow-[0_18px_44px_rgba(0,0,0,0.45)] transition group-hover:translate-x-1 group-hover:opacity-100">
              <span className="block text-sm font-black text-[#f2f2f2]">
                Return to website
              </span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-[#a9adb4]">
                Leave the Hub and go back to the public ECL site.
              </span>
            </span>
          </Link>
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
  const activeClass =
    "bg-[#0755C9] text-white shadow-[0_18px_48px_rgba(7,151,242,0.34)]";
  const idleClass =
    "text-[#8f96a3] hover:bg-[#0797F2]/16 hover:text-[#f2f2f2]";

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      title={item.label}
      className={`group relative flex h-12 w-12 items-center justify-center rounded-full transition ${
        active ? activeClass : idleClass
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
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#36D7FF]">
        Placeholder
      </p>
      <h2 className="mt-3 text-2xl font-black uppercase tracking-normal text-[#f2f2f2]">
        {title}
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#a9adb4]">{description}</p>
    </section>
  );
}
