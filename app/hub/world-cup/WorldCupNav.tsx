"use client";

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { BarChart3, CalendarDays, Globe2, Table2, Users } from "lucide-react";

type WorldCupNavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
};

const items: WorldCupNavItem[] = [
  { label: "Dashboard", href: "/hub/dashboard", icon: Globe2 },
  { label: "Teams", href: "/hub/world-cup/find-team", icon: Users },
  { label: "Players", href: "/hub/world-cup/players", icon: BarChart3 },
  { label: "Standings", href: "/hub/world-cup/standings", icon: Table2 },
  { label: "Fixtures", href: "/hub/world-cup/fixtures", icon: CalendarDays },
];

export function WorldCupNav({
  active,
}: {
  active: "teams" | "apply" | "create" | "standings" | "fixtures" | "dashboard" | "players";
}) {
  return (
    <nav className="mb-5 grid gap-2 border border-[#0797F2]/30 bg-[#061C4A]/92 p-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          (active === "teams" && item.label === "Teams") ||
          (active === "dashboard" && item.label === "Dashboard") ||
          (active === "players" && item.label === "Players") ||
          (active === "standings" && item.label === "Standings") ||
          (active === "fixtures" && item.label === "Fixtures");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-2 px-3 text-center text-xs font-black uppercase tracking-[0.12em] transition sm:px-4 ${
              isActive
                ? "bg-[#0755C9] text-white shadow-[0_0_24px_rgba(54,215,255,0.22)]"
                : "text-[#C9DFEB] hover:bg-[#0797F2]/18 hover:text-white"
            }`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="min-w-0 truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
